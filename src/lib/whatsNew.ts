export interface ReleaseNotes {
  version: string;
  items: string[];
}

/** Novedades a mostrar al abrir: solo si cambió la versión desde la última vez y hay notas escritas. */
export function whatsNewToShow(
  s: { lastSeenVersion?: string; onboardingDone: boolean },
  currentVersion: string,
  log: ReleaseNotes[]
): ReleaseNotes | null {
  if (!s.onboardingDone || s.lastSeenVersion === currentVersion) return null;
  return log.find((r) => r.version === currentVersion) ?? null;
}
