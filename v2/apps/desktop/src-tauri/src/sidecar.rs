use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Where the sidecar is listening, once it has told us.
#[derive(Clone, Default, serde::Serialize)]
pub struct ApiInfo {
    pub port: Option<u16>,
    pub token: String,
}

#[derive(Default)]
pub struct Sidecar {
    pub info: Mutex<ApiInfo>,
    child: Mutex<Option<CommandChild>>,
}

#[derive(serde::Deserialize)]
struct Ready {
    ready: bool,
    port: u16,
}

/// Hands the webview the port and token it needs to reach the sidecar.
///
/// Neither can be known ahead of time: the port is chosen by the OS at launch
/// and the token is fresh per launch.
#[tauri::command]
pub fn api_info(state: State<'_, Sidecar>) -> ApiInfo {
    state.info.lock().expect("sidecar state poisoned").clone()
}

/// Spawns the sidecar and waits for it to say where it is.
///
/// The port is not chosen here. Asking the OS for one up front and passing it
/// down races: another process can take it between the check and the bind. The
/// sidecar binds port 0 and reports what it actually got.
pub fn spawn(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let token = uuid::Uuid::new_v4().to_string();

    let state = app.state::<Sidecar>();
    state.info.lock().expect("sidecar state poisoned").token = token.clone();

    let (mut rx, child) = app
        .shell()
        .sidecar("herbie-core")?
        .args(["--port", "0", "--token", &token])
        .spawn()?;

    *state.child.lock().expect("sidecar state poisoned") = Some(child);

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                // The sidecar logs to stderr and keeps stdout for the one ready
                // line, so this is its normal log channel rather than a fault.
                CommandEvent::Stderr(line) => {
                    log::info!("sidecar: {}", String::from_utf8_lossy(&line).trim_end());
                }
                // An early exit is the only clue when the sidecar refuses to
                // start. Dropping it turns a config problem into a window that
                // simply never shows any data.
                CommandEvent::Terminated(payload) => {
                    log::error!("sidecar exited early with {:?}", payload.code);
                }
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    let Ok(ready) = serde_json::from_str::<Ready>(text.trim()) else {
                        log::warn!("unexpected sidecar stdout: {}", text.trim_end());
                        continue;
                    };
                    if !ready.ready {
                        continue;
                    }
                    let state = handle.state::<Sidecar>();
                    state.info.lock().expect("sidecar state poisoned").port = Some(ready.port);
                    log::info!("sidecar ready on port {}", ready.port);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// Kills the sidecar.
///
/// Without this a quit leaves an orphaned process holding the port and the
/// SQLite file, and the next launch competes with a ghost. The sidecar also
/// watches its parent pid, which covers the crash that never reaches here.
pub fn shutdown(app: &AppHandle) {
    let state = app.state::<Sidecar>();
    let taken = {
        let mut guard = state.child.lock().expect("sidecar state poisoned");
        guard.take()
    };
    if let Some(child) = taken {
        let _ = child.kill();
    }
}
