import { registerSW } from "virtual:pwa-register";

/**
 * Actualizaciones de la PWA (celular). El service worker guarda la app para usarla sin internet;
 * cuando Cloudflare tiene una versión nueva, el navegador la baja en segundo plano y queda "esperando".
 * Acá se busca esa versión al abrir la app y cada vez que vuelve a primer plano, y se avisa.
 * Los datos viven en IndexedDB, aparte: actualizar y recargar no los toca.
 */
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function startPwaUpdates(onUpdateReady: () => void): void {
  if (!("serviceWorker" in navigator)) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: onUpdateReady,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      check();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      setInterval(check, 60 * 60 * 1000); // por si la app queda abierta muchas horas
    },
  });
}

/** Activa la versión nueva y recarga la página. */
export async function applyPwaUpdate(): Promise<void> {
  if (updateSW) await updateSW(true);
  else window.location.reload();
}

/** En la app de escritorio no se usa service worker: si quedó alguno viejo registrado, se saca. */
export async function removeServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
}

/**
 * Pide al navegador que no borre los datos de la app cuando falta espacio (navigator.storage.persist).
 * Devuelve true si quedaron protegidos, false si el sistema no lo aceptó, null si no se puede saber.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
