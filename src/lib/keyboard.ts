/**
 * Decides whether the calculator's global keyboard shortcuts should act.
 * Blocked while any panel/modal (role="dialog") is open or while typing in a form field.
 */
export function shouldCalculatorHandleKey(params: {
  activeTag: string | undefined;
  dialogOpen: boolean;
}): boolean {
  if (params.dialogOpen) return false;
  return !["INPUT", "TEXTAREA", "SELECT"].includes(params.activeTag ?? "");
}
