/** Id único: hora + 64 bits al azar. getRandomValues (no randomUUID) porque anda también por http en la red local. */
export function uid(): string {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return `${Date.now()}_${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}
