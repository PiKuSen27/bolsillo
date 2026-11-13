import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { PasswordField } from "./PasswordField";
import { ConfirmDialog } from "./ConfirmDialog";
import { getLockState, getVaultPrefs, recover, unlock, wipeEverything, UnlockResult } from "../db/store";
import { WIPE_AFTER_ATTEMPTS, passwordStrength } from "../lib/vault";

const waitText = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`;
};

/** Pantalla de bloqueo: no muestra ningún dato hasta que la contraseña (o el código) abre la caja. */
export function LockScreen({ onUnlocked, onWiped }: { onUnlocked: () => void; onWiped: () => void }) {
  const prefs = getVaultPrefs();
  const isLight = (prefs?.theme ?? "light") === "light";
  const [mode, setMode] = useState<"password" | "recover">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [{ failedAttempts, lockoutUntil }, setLockState] = useState(getLockState);
  const [now, setNow] = useState(Date.now());
  const [wipeStep, setWipeStep] = useState(0);

  const waiting = lockoutUntil > now;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  const remaining = WIPE_AFTER_ATTEMPTS - failedAttempts;

  const handle = async (run: () => Promise<UnlockResult>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await run();
      if (r.ok) return onUnlocked();
      if (r.reason === "lockout") {
        setLockState(getLockState());
        setNow(Date.now());
        return;
      }
      if (r.wiped) return onWiped();
      setLockState({ failedAttempts: r.failedAttempts, lockoutUntil: r.lockoutUntil });
      setNow(Date.now());
      setError(mode === "password" ? "Contraseña incorrecta" : "Código de recuperación incorrecto");
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir");
    } finally {
      setBusy(false);
    }
  };

  const newPwOk = passwordStrength(newPw).ok && newPw === newPw2;
  const field = isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white";
  const primary = isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200";

  return (
    <div
      className={`w-full h-full flex items-center justify-center p-6 pt-[calc(1.5rem+var(--safe-top))] pb-[calc(1.5rem+var(--safe-bottom))] select-none overflow-y-auto ${
        isLight ? "bg-white text-black" : "bg-black text-white"
      }`}
    >
      <div className="w-full max-w-xs flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/icons/bolsillo.svg" alt="" width={56} height={56} className={`w-14 h-14 rounded-2xl ${isLight ? "ring-1 ring-zinc-200" : ""}`} />
          <h1 className="text-lg font-extrabold flex items-center gap-1.5">
            <Lock size={16} /> Bolsillo está bloqueado
          </h1>
        </div>

        {waiting ? (
          <p role="status" className={`text-xs font-bold text-center ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>
            Demasiados intentos. Esperá {waitText(lockoutUntil - now)} para volver a probar.
          </p>
        ) : mode === "password" ? (
          <>
            <PasswordField label="Contraseña" value={password} onChange={setPassword} isLight={isLight} autoFocus onEnter={() => password && !busy && handle(() => unlock(password))} />
            <button
              type="button"
              disabled={!password || busy}
              onClick={() => handle(() => unlock(password))}
              className={`py-2.5 rounded-xl font-extrabold text-sm cursor-pointer disabled:opacity-50 ${primary}`}
            >
              {busy ? "Abriendo…" : "Desbloquear"}
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold opacity-75">Código de recuperación</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                aria-label="Código de recuperación"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className={`text-sm font-mono font-bold px-3 py-2 rounded-xl border focus:outline-none select-text ${field}`}
              />
            </div>
            <PasswordField label="Contraseña nueva" value={newPw} onChange={setNewPw} isLight={isLight} showStrength autoComplete="new-password" />
            <PasswordField label="Repetí la contraseña nueva" value={newPw2} onChange={setNewPw2} isLight={isLight} autoComplete="new-password" />
            {newPw2 && newPw !== newPw2 && <span className="text-[11px] font-bold text-[#DC2626]">Las contraseñas no coinciden</span>}
            <button
              type="button"
              disabled={!code || !newPwOk || busy}
              onClick={() => handle(() => recover(code, newPw))}
              className={`py-2.5 rounded-xl font-extrabold text-sm cursor-pointer disabled:opacity-50 ${primary}`}
            >
              {busy ? "Abriendo…" : "Entrar y guardar la contraseña nueva"}
            </button>
          </>
        )}

        {error && !waiting && (
          <p role="alert" className="text-xs font-bold text-center text-[#DC2626]">
            {error}
          </p>
        )}
        {prefs?.wipeAfter10 && remaining <= 3 && remaining > 0 && (
          <p role="alert" className="text-xs font-bold text-center px-3 py-2 rounded-xl border border-red-300 bg-red-50 text-red-700">
            {remaining === 1 ? "Queda 1 intento" : `Quedan ${remaining} intentos`} antes de que se borren todos los datos.
          </p>
        )}

        <div className="flex flex-col items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "password" ? "recover" : "password");
              setError(null);
            }}
            className="text-xs font-bold underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            {mode === "password" ? "Olvidé mi contraseña" : "Volver a la contraseña"}
          </button>
          {mode === "recover" && (
            <button type="button" onClick={() => setWipeStep(1)} className="text-[11px] font-bold opacity-70 hover:opacity-100 cursor-pointer">
              No tengo la contraseña ni el código
            </button>
          )}
        </div>
      </div>

      {wipeStep === 1 && (
        <ConfirmDialog
          title="¿Borrar todos los datos?"
          detail="Sin la contraseña ni el código de recuperación no hay forma de abrir tus datos. La única opción es borrarlos y empezar de cero."
          confirmLabel="Sí, quiero borrar todo"
          isLight={isLight}
          onCancel={() => setWipeStep(0)}
          onConfirm={() => setWipeStep(2)}
        />
      )}
      {wipeStep === 2 && (
        <ConfirmDialog
          title="Última confirmación"
          detail="Se borran para siempre todos los movimientos, deudas, fijos, cuotas y ajustes. No se puede deshacer."
          confirmLabel="Borrar todo para siempre"
          isLight={isLight}
          onCancel={() => setWipeStep(0)}
          onConfirm={async () => {
            await wipeEverything();
            onWiped();
          }}
        />
      )}
    </div>
  );
}
