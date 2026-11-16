import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { passwordStrength } from "../lib/vault";

/** Campo de contraseña con botón para ver lo escrito y, opcionalmente, indicador de fuerza. */
export function PasswordField({
  value,
  onChange,
  label,
  isLight,
  showStrength,
  autoFocus,
  autoComplete = "current-password",
  onEnter,
  numeric,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  isLight?: boolean;
  showStrength?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  onEnter?: () => void;
  numeric?: boolean; // PIN: teclado numérico en el celular
}) {
  const [visible, setVisible] = useState(false);
  const s = passwordStrength(value);
  const colors = ["bg-[#DC2626]", "bg-[#DC2626]", "bg-[#D97706]", "bg-[#16A34A]", "bg-[#16A34A]"];

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-extrabold opacity-75">{label}</label>
      <div
        className={`flex items-center rounded-xl border ${
          isLight ? "bg-zinc-100 border-zinc-300" : "bg-zinc-900 border-zinc-700"
        }`}
      >
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          aria-label={label}
          inputMode={numeric ? "numeric" : undefined}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={`flex-1 min-w-0 bg-transparent text-sm font-bold px-3 py-2 focus:outline-none select-text ${
            isLight ? "text-black" : "text-white"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="px-3 py-2 opacity-70 hover:opacity-100 cursor-pointer"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="flex flex-col gap-1" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  s.score >= i ? colors[s.score] : isLight ? "bg-zinc-200" : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
          <span className={`text-[11px] font-bold ${s.ok ? (s.score >= 3 ? "text-[#16A34A]" : "text-[#D97706]") : "text-[#DC2626]"}`}>
            {s.label}
            {s.hint ? ` · ${s.hint}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
