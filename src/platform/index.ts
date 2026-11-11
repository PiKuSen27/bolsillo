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
