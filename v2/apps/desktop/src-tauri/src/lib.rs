mod faces;
mod notifications;
mod sidecar;
mod tray;

use tauri::{Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main(app);
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(sidecar::Sidecar::default())
        .manage(notifications::Notifier::default())
        .invoke_handler(tauri::generate_handler![
            sidecar::api_info,
            notifications::post_notification,
            notifications::withdraw_notification,
            notifications::set_notification_attention,
            notifications::notification_delivered
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Regular while a window is open, Accessory once it is closed.
            //
            // Accessory removes the dock icon and also removes the app from
            // cmd-tab, which is wrong for something with a real window: you
            // cannot switch back to it. Regular all the time leaves a dock
            // icon for an agent that mostly works in the background.
            // Switching with window visibility gives a normal app while you
            // are using it and a quiet one when you are not.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

            tray::build(app.handle())?;
            // Before anything can be posted: a handler registered later
            // misses the clicks on everything already on screen, and the dev
            // backend drops a notification's actions outright when nothing
            // is listening at send.
            notifications::init(app.handle());
            sidecar::spawn(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it. Quitting is a tray decision, so the
            // red button must not kill an agent that is mid run.
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                    #[cfg(target_os = "macos")]
                    let _ = window
                        .app_handle()
                        .set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
                // Half of presence. The window knows which agent is on
                // screen and this process does not, so the focus is sent up
                // rather than acted on here.
                WindowEvent::Focused(focused) => {
                    let _ = window.app_handle().emit("window://focus", *focused);
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the Herbie app")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                sidecar::shutdown(app);
            }
        });
}
