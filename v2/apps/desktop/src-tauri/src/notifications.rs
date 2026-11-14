//! The banner, and the only process that can draw one.
//!
//! The sidecar decides what is worth interrupting someone for and the window
//! relays it here, because neither of them can post a notification and this
//! cannot know whether an agent is waiting. What lives here is the operating
//! system half: the handle per agent, the close before the repost, the click
//! that brings the window back, the dock badge and the tray.
//!
//! ## Two backends, and why they cannot become one
//!
//! | Build | Backend |
//! |---|---|
//! | macOS release | `user-notify`, over UNUserNotificationCenter |
//! | everything else | `tauri-plugin-notification` |
//!
//! UNUserNotificationCenter refuses to run outside a signed, bundled app
//! registered with Launch Services, so the release backend cannot run under
//! `tauri dev` at all: the binary there is unbundled, straight out of the
//! target directory. The plugin reaches macOS through the deprecated
//! NSUserNotificationCenter, which works from a plain binary with no bundle.
//! The old API is carried for exactly that reason and the split must not be
//! simplified away.
//!
//! The plugin also attributes every notification it posts in a dev build to
//! `com.apple.Terminal`, so it is evaluated against Terminal's notification
//! settings and carries Terminal's name and icon. Nothing observed in dev
//! says anything about what production does.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::faces;

/// What the window hands down when the sidecar decides to interrupt someone.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotifyIntent {
    pub id: String,
    pub agent_id: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub body: String,
    pub route: String,
    pub updates: u32,
    pub kind: String,
    pub shape: String,
    pub color: String,
    pub sound: bool,
}

/// What a click sends back up, so the window can land on the right thread.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenPayload {
    id: String,
    route: String,
    agent_id: String,
}

/// The live banner for each agent, so the next one can close it first.
///
/// In memory only, so a restart forgets what is still on screen. Keyed by
/// agent because the collapse key is the agent: a banner answers how one
/// agent is doing right now rather than keeping a log.
#[derive(Default)]
pub struct Notifier {
    #[cfg(all(not(debug_assertions), target_os = "macos"))]
    manager: Mutex<Option<std::sync::Arc<dyn user_notify::NotificationManager>>>,
    #[cfg(all(not(debug_assertions), target_os = "macos"))]
    handles: Mutex<std::collections::HashMap<String, Box<dyn user_notify::NotificationHandle>>>,
    /// Whether anything has ever been accepted for delivery.
    ///
    /// The permission API reports granted on every desktop platform whether
    /// or not the person has switched Herbie off in System Settings, so this
    /// is the only observable the preferences pane can honestly report from.
    delivered: Mutex<bool>,
}

impl std::fmt::Debug for Notifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Notifier").finish_non_exhaustive()
    }
}

/// The expression that says what kind of call this is.
///
/// Mapped here rather than in the window so the face has one home, and taken
/// from the set the app already draws so a banner speaks the product's own
/// language rather than inventing an iconography for notifications.
fn expression_for(kind: &str) -> &'static str {
    match kind {
        "needs_you" => "input-needed",
        "turn_failed" | "agent_parked" => "error",
        _ => "idle",
    }
}

/// Collapsing is lossy, so a replaced banner has to say how much it swallowed.
fn body_with_count(body: &str, updates: u32) -> String {
    if updates == 0 {
        return body.to_string();
    }
    format!("{body}\n{} more since you last looked", updates)
}

fn thread_id(agent_id: &str) -> String {
    format!("herbie:agent:{agent_id}")
}

/// Registers the click handler, once, before anything can be posted.
pub fn init(app: &AppHandle) {
    backend::init(app);
}

pub fn post(app: &AppHandle, intent: NotifyIntent) -> Result<(), String> {
    let face = faces::face_png(&intent.shape, &intent.color, expression_for(&intent.kind)).ok();
    backend::post(app, intent, face)
}

pub fn withdraw(app: &AppHandle, agent_id: &str) {
    backend::withdraw(app, agent_id);
}

/// The signals that are never suppressed, because a banner can be swallowed.
///
/// Focus mode, the per app switch in System Settings that no API can read, an
/// unregistered bundle id: every one of those is invisible here, so the count
/// has to reach the person some other way.
pub fn set_attention(app: &AppHandle, waiting: u32) {
    if let Some(window) = app.get_webview_window("main") {
        let count = if waiting == 0 {
            None
        } else {
            Some(i64::from(waiting))
        };
        let _ = window.set_badge_count(count);
    }

    if let Some(tray) = app.tray_by_id("herbie") {
        let icon = if waiting == 0 {
            tauri::include_image!("icons/tray-template.png")
        } else {
            tauri::include_image!("icons/tray-attention-template.png")
        };
        // One call rather than set_icon then set_icon_as_template, which can
        // show the new icon briefly under the old template setting.
        let _ = tray.set_icon_with_as_template(Some(icon), true);
    }
}

/// Whether a banner has ever been accepted, for the honest status line.
pub fn has_delivered(app: &AppHandle) -> bool {
    app.state::<Notifier>()
        .delivered
        .lock()
        .map(|flag| *flag)
        .unwrap_or(false)
}

fn mark_delivered(app: &AppHandle) {
    if let Ok(mut flag) = app.state::<Notifier>().delivered.lock() {
        *flag = true;
    }
}

/// Brings the window back and tells it where to land.
fn open_from_click(app: &AppHandle, id: String, route: String, agent_id: String) {
    crate::tray::show_main(app);
    let _ = app.emit(
        "notification://open",
        OpenPayload {
            id,
            route,
            agent_id,
        },
    );
}

#[tauri::command]
pub fn post_notification(app: AppHandle, intent: NotifyIntent) -> Result<(), String> {
    post(&app, intent)
}

#[tauri::command]
pub fn withdraw_notification(app: AppHandle, agent_id: String) -> Result<(), String> {
    withdraw(&app, &agent_id);
    Ok(())
}

#[tauri::command]
pub fn set_notification_attention(app: AppHandle, waiting: u32) -> Result<(), String> {
    set_attention(&app, waiting);
    Ok(())
}

#[tauri::command]
pub fn notification_delivered(app: AppHandle) -> bool {
    has_delivered(&app)
}

#[cfg(any(debug_assertions, not(target_os = "macos")))]
mod backend {
    //! The backend that works before a bundle exists.
    //!
    //! Everything macOS specific is missing here: the attachment is ignored,
    //! there is no subtitle, and a delivered notification cannot be
    //! withdrawn, because the path underneath is NSUserNotificationCenter and
    //! none of that reaches it. Banners still appear, which is enough to see
    //! that routing fired while developing, and nothing more should be read
    //! into what this backend does.

    use std::path::PathBuf;

    use tauri::AppHandle;
    use tauri_plugin_notification::NotificationExt;

    use super::{NotifyIntent, body_with_count, mark_delivered, open_from_click, thread_id};

    pub fn init(app: &AppHandle) {
        let handle = app.clone();
        // Registered before anything is posted, because the plugin drops a
        // notification's actions entirely when nothing is listening at send.
        let registered = app.notification().on_action(move |action| {
            let Some(extra) = action.notification().map(|posted| posted.extra()) else {
                return;
            };
            let text = |key: &str| {
                extra
                    .get(key)
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string()
            };
            let route = text("route");
            if route.is_empty() {
                return;
            }
            open_from_click(&handle, text("id"), route, text("agentId"));
        });
        if let Err(cause) = registered {
            log::error!("the notification handler would not register: {cause}");
        }
    }

    pub fn post(app: &AppHandle, intent: NotifyIntent, _face: Option<PathBuf>) -> Result<(), String> {
        // No subtitle slot on this backend, so the reason joins the body
        // rather than being dropped on the floor.
        let body = match intent.subtitle.as_deref().filter(|text| !text.is_empty()) {
            Some(subtitle) => format!("{subtitle}\n{}", intent.body),
            None => intent.body.clone(),
        };
        let mut builder = app
            .notification()
            .builder()
            .title(&intent.title)
            .body(body_with_count(&body, intent.updates))
            .extra("id", intent.id.clone())
            .extra("route", intent.route.clone())
            .extra("agentId", intent.agent_id.clone())
            // Desktop ignores grouping, but this is the same collapse key the
            // release backend threads by and it costs nothing to be honest.
            .group(thread_id(&intent.agent_id));
        if intent.sound {
            builder = builder.sound("Glass");
        }
        builder.show().map_err(|cause| cause.to_string())?;
        mark_delivered(app);
        Ok(())
    }

    pub fn withdraw(_app: &AppHandle, _agent_id: &str) {
        // Nothing to do: this backend cannot retract a delivered notification.
    }
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
mod backend {
    //! The real one, over UNUserNotificationCenter.
    //!
    //! Every call into it has to happen on the macOS main thread. The crate
    //! does not enforce that and the underlying objc2 calls simply do nothing
    //! when made from anywhere else, so the symptom of getting it wrong is
    //! silence rather than an error.

    use std::collections::HashMap;
    use std::path::PathBuf;

    use tauri::{AppHandle, Manager};
    use user_notify::{NotificationBuilder, get_notification_manager};

    use super::{
        NotifyIntent, Notifier, body_with_count, mark_delivered, open_from_click, thread_id,
    };

    pub fn init(app: &AppHandle) {
        let bundle_id = app.config().identifier.clone();
        let for_callback = app.clone();
        let for_storage = app.clone();

        let dispatched = app.run_on_main_thread(move || {
            let manager = get_notification_manager(bundle_id, None);
            let registered = manager.register(
                Box::new(move |response| {
                    let text =
                        |key: &str| response.user_info.get(key).cloned().unwrap_or_default();
                    let route = text("route");
                    if route.is_empty() {
                        return;
                    }
                    open_from_click(&for_callback, text("id"), route, text("agentId"));
                }),
                Vec::new(),
            );
            if let Err(cause) = registered {
                log::error!("the notification handler would not register: {cause}");
                return;
            }
            if let Ok(mut slot) = for_storage.state::<Notifier>().manager.lock() {
                *slot = Some(manager);
            }
        });
        if let Err(cause) = dispatched {
            log::error!("the notification handler never reached the main thread: {cause}");
        }
    }

    pub fn post(app: &AppHandle, intent: NotifyIntent, face: Option<PathBuf>) -> Result<(), String> {
        let state = app.state::<Notifier>();
        let manager = state
            .manager
            .lock()
            .map_err(|_| "the notification manager is poisoned".to_string())?
            .clone()
            .ok_or_else(|| "the notification manager is not ready".to_string())?;

        // Taken before the dispatch, so no lock is held across the hop.
        let previous = state
            .handles
            .lock()
            .map_err(|_| "the handle map is poisoned".to_string())?
            .remove(&intent.agent_id);

        // user-notify exposes no sound control on macOS and its categories
        // carry only actions, so the preference cannot be honoured here and
        // the system default plays instead. Dropped knowingly rather than
        // quietly.
        let _ = intent.sound;

        let mut user_info = HashMap::new();
        user_info.insert("id".to_string(), intent.id.clone());
        user_info.insert("route".to_string(), intent.route.clone());
        user_info.insert("agentId".to_string(), intent.agent_id.clone());

        let title = intent.title.clone();
        let subtitle = intent.subtitle.clone();
        let body = body_with_count(&intent.body, intent.updates);
        let thread = thread_id(&intent.agent_id);
        let agent_id = intent.agent_id.clone();
        let for_storage = app.clone();

        let dispatched = app.run_on_main_thread(move || {
            // Close then repost, which is replacement as macOS allows it: the
            // crate assigns its own identifier per request and exposes no way
            // to post against an existing one. The banner alerts again, which
            // is right for a state change and loud for a bare count.
            if let Some(previous) = previous {
                if let Err(cause) = previous.close() {
                    log::warn!("the previous banner would not close: {cause}");
                }
            }

            let mut builder = NotificationBuilder::new()
                .title(&title)
                .body(&body)
                .set_thread_id(&thread)
                .set_user_info(user_info);
            if let Some(subtitle) = subtitle.as_deref().filter(|text| !text.is_empty()) {
                builder = builder.subtitle(subtitle);
            }
            // The leading icon is the app's and cannot be set per
            // notification, so the agent travels as an attachment and lands
            // as the trailing thumbnail.
            if let Some(face) = face {
                builder = builder.set_image(face);
            }

            match tauri::async_runtime::block_on(manager.send_notification(builder)) {
                Ok(handle) => {
                    if let Ok(mut handles) = for_storage.state::<Notifier>().handles.lock() {
                        handles.insert(agent_id, handle);
                    }
                    mark_delivered(&for_storage);
                }
                Err(cause) => log::error!("the banner would not post: {cause}"),
            }
        });
        dispatched.map_err(|cause| format!("the banner never reached the main thread: {cause}"))
    }

    pub fn withdraw(app: &AppHandle, agent_id: &str) {
        let state = app.state::<Notifier>();
        let Ok(mut handles) = state.handles.lock() else {
            return;
        };
        let Some(handle) = handles.remove(agent_id) else {
            return;
        };
        drop(handles);
        let _ = app.run_on_main_thread(move || {
            if let Err(cause) = handle.close() {
                log::warn!("a seen banner would not close: {cause}");
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_expression_says_what_kind_of_call_it_is() {
        assert_eq!(expression_for("needs_you"), "input-needed");
        assert_eq!(expression_for("turn_failed"), "error");
        assert_eq!(expression_for("agent_parked"), "error");
        assert_eq!(expression_for("turn_done"), "idle");
    }

    /// Identity travels as data. A kind nobody taught this module still draws
    /// a face rather than failing, which is what keeps a new kind additive.
    #[test]
    fn an_unknown_kind_still_has_a_face() {
        assert_eq!(expression_for("routine_done"), "idle");
        assert_eq!(expression_for("something-new"), "idle");
    }

    #[test]
    fn a_first_notification_says_nothing_about_history() {
        assert_eq!(body_with_count("Asked you a question", 0), "Asked you a question");
    }

    #[test]
    fn a_replacement_says_how_much_it_swallowed() {
        assert_eq!(
            body_with_count("Asked you a question", 2),
            "Asked you a question\n2 more since you last looked"
        );
    }

    #[test]
    fn banners_are_grouped_by_agent() {
        assert_eq!(thread_id("abc"), "herbie:agent:abc");
        assert_ne!(thread_id("abc"), thread_id("def"));
    }
}
