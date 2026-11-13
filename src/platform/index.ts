import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification as tauriSendNotification,
} from "@tauri-apps/plugin-notification";

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export async function setAppAutostart(enable: boolean): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("set_autostart", { enable });
    } catch (e) {
      console.warn("Failed to set autostart in Tauri:", e);
    }
  }
}

/** true si la barra del sistema tiene bandeja donde mostrar el ícono (solo Tauri). */
export async function isTrayAvailable(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>("tray_host_available");
  } catch {
    return false;
  }
}

/** Tamaño de ventana (solo Tauri): null = automático según el monitor. */
export async function setWindowZoom(zoom: number | null): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("set_window_zoom", { zoom });
  } catch (e) {
    console.warn("Failed to set window zoom:", e);
  }
}

/** Le avisa a Rust si al cerrar la ventana hay que esconderla al tray (true) o cerrar la app (false). */
export async function setCloseToTray(enable: boolean): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("set_close_to_tray", { enable });
    } catch (e) {
      console.warn("Failed to set close_to_tray:", e);
    }
  }
}

/**
 * Guarda el backup. En Tauri lo escribe en Descargas y devuelve la ruta ("path").
 * En el celular abre el menú de compartir (Guardar en Archivos, iCloud, WhatsApp…) → "shared".
 * Si no, lo descarga → "download". Si la persona cancela el menú de compartir, lanza AbortError.
 */
export async function saveBackupFile(
  fileName: string,
  contents: string
): Promise<{ kind: "path"; path: string } | { kind: "shared" } | { kind: "download" }> {
  if (isTauri()) {
    return { kind: "path", path: await invoke<string>("save_backup", { fileName, contents }) };
  }
  const file = new File([contents], fileName, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Backup de Bolsillo" });
    return { kind: "shared" };
  }
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { kind: "download" };
}

// Window Controls
export async function minimizeWindow(): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("minimize_window");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
        await appWindow.hide();
      } catch (e) {
        console.warn("Failed to minimize window:", e);
      }
    }
  }
}

export async function closeWindow(): Promise<void> {
  if (isTauri()) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (e) {
      console.warn("Failed to close window:", e);
    }
  }
}

export async function toggleAlwaysOnTop(currentPinned: boolean): Promise<boolean> {
  if (isTauri()) {
    try {
      const appWindow = getCurrentWindow();
      const nextState = !currentPinned;
      await appWindow.setAlwaysOnTop(nextState);
      return nextState;
    } catch (e) {
      console.warn("Failed to toggle always on top:", e);
      return currentPinned;
    }
  }
  return !currentPinned;
}

export async function isWindowAlwaysOnTop(): Promise<boolean> {
  if (isTauri()) {
    try {
      const appWindow = getCurrentWindow();
      return await appWindow.isAlwaysOnTop();
    } catch {
      return false;
    }
  }
  return false;
}

// Notifications
export async function requestAppNotificationPermission(): Promise<boolean> {
  if (isTauri()) {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      return granted;
    } catch (e) {
      console.warn("Tauri notification permission error:", e);
      return false;
    }
  } else if ("Notification" in window) {
    const res = await Notification.requestPermission();
    return res === "granted";
  }
  return false;
}

export async function sendAppNotification(title: string, body: string): Promise<void> {
  if (isTauri()) {
    try {
      const granted = await isPermissionGranted();
      if (granted) {
        tauriSendNotification({ title, body });
      }
    } catch (e) {
      console.warn("Tauri notification error:", e);
    }
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  }
}
