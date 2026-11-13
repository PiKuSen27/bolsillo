import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PasswordField } from "./PasswordField";

/**
 * Pide una contraseña en un cuadro arriba de todo. onSubmit devuelve un mensaje de error
 * (y el cuadro sigue abierto para reintentar) o null si salió bien (y se cierra).
 */
export function PasswordPrompt({
  title,
  detail,
  confirmLabel,
  isLight,
  onSubmit,
  onCancel,
}: {
  title: string;
  detail?: string;
  confirmLabel: string;
  isLight?: boolean;
  onSubmit: (password: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(pw).catch((e) => (e instanceof Error ? e.message : String(e)));
    setBusy(false);
    if (err) {
      setError(err);
      setPw("");
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="pw-title" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div onClick={onCancel} className="absolute inset-0 bg-black/70" />
      <div
        className={`relative w-full max-w-xs rounded-2xl border p-4 flex flex-col gap-3 shadow-2xl ${
          isLight ? "bg-white border-zinc-300 text-black" : "bg-[#0A0A0C] border-[#262626] text-white"
        }`}
      >
        <h4 id="pw-title" className="text-sm font-extrabold">
          {title}
        </h4>
        {detail && <p className={`text-xs font-semibold ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>{detail}</p>}
        <PasswordField label="Contraseña" value={pw} onChange={setPw} isLight={isLight} autoFocus onEnter={submit} />
        {error && (
          <p role="alert" className="text-[11px] font-bold text-[#DC2626]">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={!pw || busy}
            onClick={submit}
            className={`w-full py-2 rounded-xl font-extrabold text-xs cursor-pointer disabled:opacity-50 ${
              isLight ? "bg-black text-white hover:bg-zinc-800" : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {busy ? "Un momento…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`w-full py-2 rounded-xl font-extrabold text-xs border cursor-pointer ${
              isLight ? "bg-zinc-100 border-zinc-300 text-black" : "bg-zinc-900 border-zinc-700 text-white"
            }`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
