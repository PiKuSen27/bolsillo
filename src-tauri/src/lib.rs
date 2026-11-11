use std::fs;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

#[tauri::command]
fn minimize_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.minimize();
        let _ = w.hide();
    }
    Ok(())
}

/// true = al cerrar la ventana se esconde al tray (default). false = cerrar la app de verdad.
struct CloseToTray(Mutex<bool>);

/// ¿Hay una barra con bandeja (StatusNotifierHost) registrada en el bus de sesión?
/// Si no la hay, esconder la ventana dejaría la app viva pero inalcanzable.
fn tray_host_registered() -> bool {
    (|| -> zbus::Result<bool> {
        let conn = zbus::blocking::Connection::session()?;
        let proxy = zbus::blocking::Proxy::new(
            &conn,
            "org.kde.StatusNotifierWatcher",
            "/StatusNotifierWatcher",
            "org.kde.StatusNotifierWatcher",
        )?;
        proxy.get_property::<bool>("IsStatusNotifierHostRegistered")
    })()
    .unwrap_or(false)
}

#[tauri::command]
fn tray_host_available() -> bool {
    tray_host_registered()
}

#[tauri::command]
fn set_close_to_tray(state: tauri::State<CloseToTray>, enable: bool) {
    if let Ok(mut v) = state.0.lock() {
        *v = enable;
    }
}

/// Guarda el backup en la carpeta de Descargas del usuario y devuelve la ruta.
/// (En WebKitGTK el `<a download>` del navegador no hace nada.)
#[tauri::command]
fn save_backup(app: AppHandle, file_name: String, contents: String) -> Result<String, String> {
    let valid = file_name.starts_with("bolsillo-backup-")
        && file_name.ends_with(".json")
        && file_name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.');
    if !valid {
        return Err("Nombre de archivo inválido".into());
    }
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut path = dir.join(&file_name);
    let mut n = 2;
    while path.exists() {
        path = dir.join(file_name.replace(".json", &format!("-{n}.json")));
        n += 1;
    }
    fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enable: bool) -> Result<(), String> {
    if let Ok(config_dir) = app.path().config_dir() {
        let autostart_dir = config_dir.join("autostart");
        let desktop_file = autostart_dir.join("bolsillo.desktop");

        if enable {
            let _ = fs::create_dir_all(&autostart_dir);
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let content = format!(
                "[Desktop Entry]\nType=Application\nName=Bolsillo\nComment=Control de gastos\nExec={}\nIcon=bolsillo\nTerminal=false\nCategories=Office;Finance;\n",
                current_exe.display()
            );
            fs::write(desktop_file, content).map_err(|e| e.to_string())?;
        } else if desktop_file.exists() {
            let _ = fs::remove_file(desktop_file);
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CloseToTray(Mutex::new(true)))
        .plugin(tauri_plugin_notification::init())
        .plugin(
            WindowStateBuilder::default()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![set_autostart, minimize_window, set_close_to_tray, save_backup, tray_host_available])
        .setup(|app| {
            // La interfaz está diseñada a 540×600; la ventana es 810×900 y el webview
            // escala todo ×1,5 (letras y botones más grandes sin rehacer el layout).
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_zoom(1.5);
            }

            // Build Tray Icon
            let quit_i = MenuItem::with_id(app, "quit", "Salir de Bolsillo", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Abrir Bolsillo", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut tray = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            let _tray = tray
                .tooltip("Bolsillo - Control de gastos")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Según el ajuste "Cerrar al tray": esconder (siguen los recordatorios) o cerrar de verdad
                let hide = window
                    .state::<CloseToTray>()
                    .0
                    .lock()
                    .map(|v| *v)
                    .unwrap_or(true);
                // Sin bandeja en la barra, esconder = app fantasma: mejor cerrar de verdad
                if hide && tray_host_registered() {
                    let _ = window.hide();
                    api.prevent_close();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
