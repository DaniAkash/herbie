use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

/// Builds the tray, which is where Herbie lives when its window is closed.
pub fn build(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let open = MenuItem::with_id(app, "open", "Open Herbie", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Herbie", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;

    TrayIconBuilder::with_id("herbie")
        // Template mode keeps only the alpha channel, so the window icon, an
        // opaque squircle, would flatten to a solid black rectangle here. This
        // asset carries the outline in its alpha instead.
        .icon(tauri::include_image!("icons/tray-template.png"))
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quit" => {
                crate::sidecar::shutdown(app);
                app.exit(0)
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn show_main(app: &AppHandle) {
    // Back to a normal app while a window is up, so cmd-tab can reach it.
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
