import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { PasswordField } from "../components/PasswordField";
import { PasswordPrompt } from "../components/PasswordPrompt";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Select } from "../components/Select";
import {
  changePassword,
  disableEncryption,
  enableEncryption,
  getVaultPrefs,
  isVaultEnabled,
  updateVaultPrefs,
} from "../db/store";
import { generateRecoveryCode, normalizeRecoveryCode, passwordStrength, WrongSecretError } from "../lib/vault";

const LOCK_OPTIONS = [
  { value: "0", label: "Al instante" },
  { value: "5000", label: "A los 5 segundos" },
  { value: "30000", label: "A los 30 segundos" },
  { value: "60000", label: "Al minuto" },
];

/** Ajustes → Contraseña y cifrado. */
export function SecuritySettings({
  isLight,
  theme,
  onLockNow,
  onChanged,
}: {
  isLight?: boolean;
  theme: "light" | "dark";
  onLockNow: () => void;
  onChanged: () => void; // el cifrado se activó o desactivó
}) {
  const enabled = isVaultEnabled();
  const prefs = getVaultPrefs();
  const [, refresh] = useState(0);
  const [step, setStep] = useState<"idle" | "password" | "code" | "verify">("idle");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [code, setCode] = useState("");
  const [codeCheck, setCodeCheck] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [changing, setChanging] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [askDisable, setAskDisable] = useState(false);
  const [askWipe, setAskWipe] = useState(false);

  const card = `p-3.5 rounded-2xl border flex flex-col gap-2.5 ${isLight ? "bg-white border-zinc-300" : "bg-[#0A0A0C] border-[#222224]"}`;
  const primary = `px-4 py-2 rounded-xl font-black text-xs cursor-pointer disabled:opacity-50 ${
    isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
  }`;
  const secondary = `px-3 py-2 rounded-xl font-extrabold text-xs border cursor-pointer ${
    isLight ? "bg-zinc-100 border-zinc-300 text-black hover:bg-zinc-200" : "bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
  }`;
  const muted = isLight ? "text-zinc-600" : "text-zinc-300";
  const newPwOk = passwordStrength(pw).ok && pw === pw2;

  const resetWizard = () => {
    setStep("idle");
    setPw("");
    setPw2("");
    setCode("");
    setCodeCheck("");
  };

  const activate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await enableEncryption(pw, code, { lockAfterMs: 5000, wipeAfter10: false, theme });
      resetWizard();
      setMessage({ ok: true, text: "Listo: tus datos quedaron cifrados con tu contraseña." });
      onChanged();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const explanation = (
    <div className={`text-[11px] font-semibold leading-relaxed flex flex-col gap-1.5 ${muted}`}>
      <p>
        <strong>Qué protege:</strong> si alguien agarra tu celular o tu computadora, o copia los archivos de la app, no puede
        leer tus montos, notas, nombres ni ajustes sin la contraseña.
      </p>
      <p>
        <strong>Qué no protege:</strong> si alguien mira la pantalla mientras Bolsillo está desbloqueado, si sabe o adivina tu
        contraseña, o si el dispositivo tiene un programa espía.
      </p>
      <p>
        <strong>Lo que de verdad protege es una contraseña larga.</strong> Una frase de 4 palabras ("mate frío lunes tarde") es
        mucho más segura que una palabra con números. La espera después de los intentos fallidos solo frena a quien prueba a
        mano en la app, no a quien copió los archivos.
      </p>
      <p>
        Los backups que exportaste <strong>antes</strong> de activar la contraseña no están cifrados: borralos de Descargas,
        Archivos o donde los hayas guardado. Además, el sistema puede tardar en borrar del disco la copia vieja sin cifrar.
      </p>
      <p>Si olvidás la contraseña y perdés el código de recuperación, nadie puede recuperar los datos (ni nosotros).</p>
    </div>
  );

  return (
    <div className={card}>
      <div className="flex items-center gap-1.5 text-xs font-black uppercase opacity-80">
        <ShieldCheck size={14} />
        <span>Contraseña y cifrado</span>
      </div>

      {!enabled && step === "idle" && (
        <>
          <p className="text-[11px] font-bold opacity-75">
            Apagado. Con contraseña, Bolsillo pide clave al abrirse y guarda todos tus datos cifrados.
          </p>
          {explanation}
          <button type="button" className={`${primary} self-start`} onClick={() => setStep("password")}>
            Activar contraseña
          </button>
        </>
      )}

      {!enabled && step === "password" && (
        <>
          <p className={`text-[11px] font-bold ${muted}`}>
            Paso 1 de 3 · Elegí una contraseña de al menos 8 caracteres. Mejor una frase larga. Antes, te conviene exportar un
            backup (más abajo).
          </p>
          <PasswordField label="Contraseña" value={pw} onChange={setPw} isLight={isLight} showStrength autoFocus autoComplete="new-password" />
          <PasswordField label="Repetila" value={pw2} onChange={setPw2} isLight={isLight} autoComplete="new-password" />
          {pw2 && pw !== pw2 && <span className="text-[11px] font-bold text-[#DC2626]">Las contraseñas no coinciden</span>}
          <div className="flex gap-2 justify-end">
            <button type="button" className={secondary} onClick={resetWizard}>
              Cancelar
            </button>
            <button
              type="button"
              className={primary}
              disabled={!newPwOk}
              onClick={() => {
                setCode(generateRecoveryCode());
                setStep("code");
              }}
            >
              Siguiente
            </button>
          </div>
        </>
      )}

      {!enabled && step === "code" && (
        <>
          <p className={`text-[11px] font-bold ${muted}`}>
            Paso 2 de 3 · Este es tu <strong>código de recuperación</strong>. Sirve para entrar si olvidás la contraseña.
            Anotalo en un papel y guardalo en un lugar seguro: no se vuelve a mostrar.
          </p>
          <div
            aria-label={`Código de recuperación: ${code}`}
            className={`p-3 rounded-xl border flex flex-wrap justify-center gap-x-2 gap-y-1 font-mono text-base font-black tracking-wider select-text ${
              isLight ? "bg-zinc-50 border-zinc-300" : "bg-black border-zinc-700"
            }`}
          >
            {code.split("-").map((g, i) => (
              <span key={i} className="whitespace-nowrap">
                {g}
                {i < 5 ? "-" : ""}
              </span>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className={secondary} onClick={resetWizard}>
              Cancelar
            </button>
            <button type="button" className={primary} onClick={() => setStep("verify")}>
              Ya lo anoté
            </button>
          </div>
        </>
      )}

      {!enabled && step === "verify" && (
        <>
          <p className={`text-[11px] font-bold ${muted}`}>Paso 3 de 3 · Escribí el código que anotaste, para confirmar que está bien copiado.</p>
          <input
            value={codeCheck}
            onChange={(e) => setCodeCheck(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            aria-label="Código de recuperación"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={`text-sm font-mono font-bold px-3 py-2 rounded-xl border focus:outline-none select-text ${
              isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"
            }`}
          />
          {codeCheck && normalizeRecoveryCode(codeCheck) !== normalizeRecoveryCode(code) && (
            <span className="text-[11px] font-bold text-[#DC2626]">Todavía no coincide con el código</span>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" className={secondary} onClick={() => setStep("code")}>
              Ver el código otra vez
            </button>
            <button
              type="button"
              className={primary}
              disabled={busy || normalizeRecoveryCode(codeCheck) !== normalizeRecoveryCode(code)}
              onClick={activate}
            >
              {busy ? "Cifrando…" : "Activar"}
            </button>
          </div>
        </>
      )}

      {enabled && prefs && (
        <>
          <p className="text-[11px] font-bold text-[#16A34A]">Activado: tus datos están cifrados.</p>
          <button type="button" className={`${secondary} self-start flex items-center gap-1.5`} onClick={onLockNow}>
            <Lock size={13} /> Bloquear ahora
          </button>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black">Bloquear al salir de la app</span>
            <Select
              ariaLabel="Bloquear al salir de la app"
              value={String(prefs.lockAfterMs)}
              options={LOCK_OPTIONS}
              isLight={isLight}
              className="w-40"
              onChange={async (v) => {
                await updateVaultPrefs({ lockAfterMs: Number(v) });
                refresh((x) => x + 1);
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-black">Borrar todos los datos después de 10 intentos fallidos</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.wipeAfter10}
              aria-label="Borrar todos los datos después de 10 intentos fallidos"
              onClick={async () => {
                if (prefs.wipeAfter10) {
                  await updateVaultPrefs({ wipeAfter10: false });
                  refresh((x) => x + 1);
                } else setAskWipe(true);
              }}
              className={`w-9 h-5 rounded-full p-0.5 flex shrink-0 cursor-pointer transition-colors ${
                prefs.wipeAfter10 ? "bg-[#DC2626] justify-end" : isLight ? "bg-zinc-300" : "bg-zinc-700"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {!changing ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} onClick={() => setChanging(true)}>
                Cambiar contraseña
              </button>
              <button type="button" className={secondary} onClick={() => setAskDisable(true)}>
                Desactivar cifrado
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <PasswordField label="Contraseña actual" value={oldPw} onChange={setOldPw} isLight={isLight} autoFocus />
              <PasswordField label="Contraseña nueva" value={pw} onChange={setPw} isLight={isLight} showStrength autoComplete="new-password" />
              <PasswordField label="Repetí la nueva" value={pw2} onChange={setPw2} isLight={isLight} autoComplete="new-password" />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className={secondary}
                  onClick={() => {
                    setChanging(false);
                    setOldPw("");
                    resetWizard();
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={primary}
                  disabled={!oldPw || !newPwOk || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await changePassword(oldPw, pw);
                      setMessage({ ok: true, text: "Contraseña cambiada. El código de recuperación sigue siendo el mismo." });
                      setChanging(false);
                      setOldPw("");
                      resetWizard();
                    } catch (e) {
                      setMessage({ ok: false, text: e instanceof WrongSecretError ? "La contraseña actual no es correcta" : String(e) });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}
          {explanation}
        </>
      )}

      {message && (
        <p role="status" className={`text-[11px] font-bold ${message.ok ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
          {message.text}
        </p>
      )}

      {askDisable && (
        <PasswordPrompt
          title="¿Desactivar el cifrado?"
          detail="Tus datos se van a guardar sin cifrar y la app ya no va a pedir contraseña."
          confirmLabel="Desactivar"
          isLight={isLight}
          onCancel={() => setAskDisable(false)}
          onSubmit={async (p) => {
            try {
              await disableEncryption(p);
            } catch (e) {
              return e instanceof WrongSecretError ? "Contraseña incorrecta" : String(e);
            }
            setAskDisable(false);
            setMessage({ ok: true, text: "Cifrado desactivado." });
            onChanged();
            return null;
          }}
        />
      )}
      {askWipe && (
        <ConfirmDialog
          title="¿Borrar todo después de 10 intentos fallidos?"
          detail="Si vos u otra persona se equivoca 10 veces con la contraseña, se borran TODOS los datos para siempre y no se pueden recuperar. Activalo solo si tenés anotado el código de recuperación y un backup reciente."
          confirmLabel="Activar"
          isLight={isLight}
          onCancel={() => setAskWipe(false)}
          onConfirm={async () => {
            setAskWipe(false);
            await updateVaultPrefs({ wipeAfter10: true });
            refresh((x) => x + 1);
          }}
        />
      )}
    </div>
  );
}
