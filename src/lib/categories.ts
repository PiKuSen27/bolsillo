import { Category } from "../types";
import { TEXT_LIMITS } from "./constants";
import { normalizeText } from "./search";

/** Ids que usa la app por dentro: ninguna categoría del usuario puede llamarse así. */
const RESERVED_IDS = ["income", "compra_usd"];

/** Categoría nueva con id único; null si el nombre está vacío o ya existe (sin importar mayúsculas ni acentos). */
export function newCategory(existing: Category[], rawName: string, color: string): Category | null {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, TEXT_LIMITS.category).trim();
  if (!name || existing.some((c) => normalizeText(c.name) === normalizeText(name))) return null;
  const base = normalizeText(name).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "categoria";
  const taken = new Set([...existing.map((c) => c.id), ...RESERVED_IDS]);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  return { id, name, icon: "Tag", color };
}
