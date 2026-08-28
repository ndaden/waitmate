mod server;
mod watcher;

use std::sync::atomic::Ordering;
use watcher::WatcherState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    LogicalPosition, LogicalSize, Manager, State, WebviewWindow,
};

#[tauri::command]
fn start_dragging(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_mode(window: WebviewWindow, mode: String) -> Result<(), String> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let phys_pos = window.outer_position().unwrap_or_default();
    let phys_size = window.outer_size().unwrap_or_default();
    let log_pos = phys_pos.to_logical::<f64>(scale);
    let log_size = phys_size.to_logical::<f64>(scale);

    let (target_w, target_h) = match mode.as_str() {
        "active" | "success" => (360.0, 460.0),
        _ => (160.0, 160.0), // "idle"
    };

    // Calculate new position keeping bottom-right fixed
    let mut new_x = log_pos.x + log_size.width - target_w;
    let mut new_y = log_pos.y + log_size.height - target_h;

    // Safety bounds
    if new_x < 10.0 {
        new_x = 10.0;
    }
    if new_y < 10.0 {
        new_y = 10.0;
    }

    println!(
        "[WaitMate] set_window_mode: '{}' -> ({}x{}) at ({:.0}, {:.0})",
        mode, target_w, target_h, new_x, new_y
    );

    let _ = window.set_size(tauri::Size::Logical(LogicalSize::new(target_w, target_h)));
    let _ = window.set_position(tauri::Position::Logical(LogicalPosition::new(new_x, new_y)));

    if mode == "active" {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    Ok(())
}

#[tauri::command]
fn toggle_auto_detect(state: State<'_, WatcherState>) -> Result<bool, String> {
    let current = state.auto_detect_enabled.load(Ordering::Relaxed);
    let new_val = !current;
    state.auto_detect_enabled.store(new_val, Ordering::Relaxed);
    println!("[WaitMate] Auto-détection IA basculée : {}", new_val);
    Ok(new_val)
}

#[tauri::command]
async fn search_random_youtube_video(query: String, excluded_ids: Option<Vec<String>>) -> Result<String, String> {
    let clean_query = query.trim().to_string();
    if clean_query.is_empty() {
        return Ok("jfKfPfyJRdk".to_string());
    }

    // Direct YouTube video ID or URL
    if clean_query.len() == 11 && clean_query.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Ok(clean_query);
    }
    if let Some(pos) = clean_query.find("v=") {
        if pos + 2 + 11 <= clean_query.len() {
            let id = &clean_query[pos + 2..pos + 2 + 11];
            return Ok(id.to_string());
        }
    }
    if let Some(pos) = clean_query.find("youtu.be/") {
        if pos + 9 + 11 <= clean_query.len() {
            let id = &clean_query[pos + 9..pos + 9 + 11];
            return Ok(id.to_string());
        }
    }

    use std::time::SystemTime;
    let now_nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as usize;

    // Variantes de mots-clés pour explorer un catalogue beaucoup plus large
    let modifiers = [
        "",
        " viral",
        " compilation",
        " highlights",
        " clips",
        " best moments",
        " funny",
        " shorts",
        " trending",
    ];
    let mod_idx = now_nanos % modifiers.len();
    let expanded_query = format!("{}{}", clean_query, modifiers[mod_idx]);

    // Encoder la requête
    let mut encoded_query = String::new();
    for b in expanded_query.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded_query.push(b as char);
            }
            b' ' => encoded_query.push('+'),
            _ => {
                encoded_query.push_str(&format!("%{:02X}", b));
            }
        }
    }

    // Filtres YouTube variés (vidéos, shorts, populaires, récents)
    let search_filters = ["", "&sp=EgIQAQ%253D%253D", "&sp=EgQQARgB", "&sp=CAM%253D", "&sp=CAI%253D"];
    let filter_idx = (now_nanos / 7) % search_filters.len();
    let url = format!(
        "https://www.youtube.com/results?search_query={}{}",
        encoded_query, search_filters[filter_idx]
    );

    let output_res = tokio::process::Command::new("curl")
        .arg("-s")
        .arg("-L")
        .arg("-H")
        .arg("User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .arg(&url)
        .output()
        .await;

    let mut ids = Vec::new();
    let excluded = excluded_ids.unwrap_or_default();

    if let Ok(output) = output_res {
        let html = String::from_utf8_lossy(&output.stdout);
        
        // 1. Extraire les liens watch?v=
        let pattern1 = "watch?v=";
        let mut pos = 0;
        while let Some(idx) = html[pos..].find(pattern1) {
            let start = pos + idx + pattern1.len();
            if start + 11 <= html.len() {
                let candidate = &html[start..start + 11];
                if candidate.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
                    let candidate_str = candidate.to_string();
                    if !ids.contains(&candidate_str) && !excluded.contains(&candidate_str) {
                        ids.push(candidate_str);
                    }
                }
            }
            pos = start + 11;
        }

        // 2. Extraire les videoId JSON
        let pattern2 = "\"videoId\":\"";
        pos = 0;
        while let Some(idx) = html[pos..].find(pattern2) {
            let start = pos + idx + pattern2.len();
            if start + 11 <= html.len() {
                let candidate = &html[start..start + 11];
                if candidate.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
                    let candidate_str = candidate.to_string();
                    if !ids.contains(&candidate_str) && !excluded.contains(&candidate_str) {
                        ids.push(candidate_str);
                    }
                }
            }
            pos = start + 11;
        }
    }

    // Fallbacks variés si aucun résultat direct
    if ids.is_empty() {
        let query_lower = clean_query.to_lowercase();
        let fallback_list = if query_lower.contains("cat") || query_lower.contains("chat") {
            vec!["7cTTzvLpoyM", "mcGa4SDTeyc", "rGNlsFrEReo", "tKZb8vg-Qfg", "XPUw4uC772A", "mX2q-r2Hh98", "4IP_E7efGWE", "ByH9LuRMDnA"]
        } else if query_lower.contains("synth") {
            vec!["4xDzrJKXOOY", "MVPTGNGiIUU", "rDBbaGCCIhk", "UedTcufyrHc", "21X5lGlDOfg", "ERf23d0vP08"]
        } else if query_lower.contains("game") || query_lower.contains("gaming") {
            vec!["MvA5t23zH28", "8X2kIfS6fb8", "21X5lGlDOfg", "q76bMs-NwRk", "k2qgadSvNyU"]
        } else {
            vec!["jfKfPfyJRdk", "5yx6BWlEVcY", "lTRiuFIWV54", "TURbeWK2wwg", "7NOSDKb0HlU", "rUxyKA_-grg", "5qap5aO4i9A"]
        };
        ids = fallback_list
            .into_iter()
            .map(|s| s.to_string())
            .filter(|id| !excluded.contains(id))
            .collect();
    }

    if ids.is_empty() {
        return Ok("jfKfPfyJRdk".to_string());
    }

    let seed = (now_nanos ^ (std::process::id() as usize)) + (now_nanos / 13);
    let random_idx = seed % ids.len();

    let chosen_id = ids[random_idx].clone();
    println!(
        "[WaitMate YouTube] Query: '{}' ({}) -> Pool: {} vidéos -> Choisi: {}",
        clean_query, expanded_query, ids.len(), chosen_id
    );
    Ok(chosen_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let watcher_state = WatcherState::new();
    let auto_detect_flag = watcher_state.auto_detect_enabled.clone();

    tauri::Builder::default()
        .manage(watcher_state)
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let handle = app.handle().clone();

            // 1. Démarrer le serveur HTTP Webhook (Port 9999) en tâche de fond
            let server_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                server::start_server(server_handle).await;
            });

            // 2. Démarrer le Watcher de logs Antigravity (Auto-détection IA)
            let watcher_handle = handle.clone();
            let auto_detect_flag_anti = auto_detect_flag.clone();
            tauri::async_runtime::spawn(async move {
                watcher::start_antigravity_watcher(watcher_handle, auto_detect_flag_anti).await;
            });

            // 3. Démarrer le Scanner de processus CLI (agy, claude, ollama, aider, etc.)
            let cli_watcher_handle = handle.clone();
            let auto_detect_flag_cli = auto_detect_flag.clone();
            tauri::async_runtime::spawn(async move {
                watcher::start_terminal_cli_watcher(cli_watcher_handle, auto_detect_flag_cli).await;
            });

            // 3. Positionner la fenêtre en bas à droite de l'écran principal
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);
                let _ = window.set_shadow(false);
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let monitor_size = monitor.size();
                    let scale = monitor.scale_factor();
                    let monitor_log_size = monitor_size.to_logical::<f64>(scale);
                    let x = monitor_log_size.width - 160.0 - 24.0;
                    let y = monitor_log_size.height - 160.0 - 48.0;
                    let _ = window.set_position(tauri::Position::Logical(LogicalPosition::new(x, y)));
                }
            }

            // 4. Hide from macOS Dock (Accessory Menu Bar companion)
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // 5. Create clean Tray menu with only Quit WaitMate
            let quit_i = MenuItem::with_id(app, "quit", "Quit WaitMate", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .tooltip("WaitMate - AI Waiting Companion")
                .icon(tauri::include_image!("icons/tray-icon.png"));

            #[cfg(target_os = "macos")]
            {
                tray_builder = tray_builder.icon_as_template(true);
            }

            let _tray = tray_builder
                .on_menu_event(move |_app, event| match event.id.as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_dragging,
            set_window_mode,
            toggle_auto_detect,
            search_random_youtube_video
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
