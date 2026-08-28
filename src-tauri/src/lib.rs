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

    // Calculate candidate new position keeping bottom-right corner anchored
    let mut new_x = log_pos.x + log_size.width - target_w;
    let mut new_y = log_pos.y + log_size.height - target_h;

    // Determine current monitor bounds accurately in multi-monitor setups
    let (mon_min_x, mon_max_x, mon_min_y, mon_max_y) = {
        // Find monitor containing the center point of the window in physical coordinates
        let center_x = phys_pos.x + (phys_size.width as i32) / 2;
        let center_y = phys_pos.y + (phys_size.height as i32) / 2;

        let mut target_monitor = None;
        if let Ok(monitors) = window.available_monitors() {
            for m in monitors {
                let p = m.position();
                let s = m.size();
                if center_x >= p.x
                    && center_x < p.x + (s.width as i32)
                    && center_y >= p.y
                    && center_y < p.y + (s.height as i32)
                {
                    target_monitor = Some(m);
                    break;
                }
            }
        }

        if target_monitor.is_none() {
            target_monitor = window.current_monitor().ok().flatten().or_else(|| window.primary_monitor().ok().flatten());
        }

        if let Some(m) = target_monitor {
            let m_scale = m.scale_factor();
            let m_pos = m.position().to_logical::<f64>(m_scale);
            let m_size = m.size().to_logical::<f64>(m_scale);

            let min_x = m_pos.x + 12.0;
            let max_x = (m_pos.x + m_size.width - target_w - 12.0).max(min_x);
            let min_y = m_pos.y + 12.0;
            let max_y = (m_pos.y + m_size.height - target_h - 36.0).max(min_y);
            (min_x, max_x, min_y, max_y)
        } else {
            (12.0, 1920.0 - target_w - 12.0, 12.0, 1080.0 - target_h - 36.0)
        }
    };

    // Clamp coordinates strictly within the current monitor bounds
    new_x = new_x.clamp(mon_min_x, mon_max_x);
    new_y = new_y.clamp(mon_min_y, mon_max_y);

    println!(
        "[WaitMate] set_window_mode: '{}' -> ({:.0}x{:.0}) at ({:.0}, {:.0}) [Monitor Bounds: X[{:.0}..{:.0}], Y[{:.0}..{:.0}]]",
        mode, target_w, target_h, new_x, new_y, mon_min_x, mon_max_x, mon_min_y, mon_max_y
    );

    let _ = window.set_size(tauri::Size::Logical(LogicalSize::new(target_w, target_h)));
    let _ = window.set_position(tauri::Position::Logical(LogicalPosition::new(new_x, new_y)));
    let _ = window.show();
    let _ = window.set_always_on_top(true);

    if mode == "active" {
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
        .arg("--max-time")
        .arg("3")
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
            vec!["7cTTzvLpoyM", "mcGa4SDTeyc", "rGNlsFrEReo", "tKZb8vg-Qfg", "XPUw4uC772A", "4IP_E7efGWE"]
        } else if query_lower.contains("synth") {
            vec!["4xDzrJKXOOY", "rDBbaGCCIhk", "UedTcufyrHc", "21X5lGlDOfg"]
        } else if query_lower.contains("game") || query_lower.contains("gaming") {
            vec!["8X2kIfS6fb8", "21X5lGlDOfg", "q76bMs-NwRk", "k2qgadSvNyU"]
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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct NewsArticle {
    pub title: String,
    pub source: String,
    pub link: String,
    pub pub_date: String,
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/C", "start", &url]).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(())
}

#[tauri::command]
async fn fetch_latest_news(category: Option<String>) -> Result<Vec<NewsArticle>, String> {
    let cat = category.unwrap_or_else(|| "top".to_string()).to_lowercase();
    let url = match cat.as_str() {
        "world" => "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en",
        "tech" => "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en",
        "business" => "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en",
        _ => "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
    };

    println!("[WaitMate News] Fetching category '{}' from {}", cat, url);

    let output = std::process::Command::new("curl")
        .args([
            "-s",
            "-L",
            "--max-time", "5",
            "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            url,
        ])
        .output()
        .map_err(|e| format!("Curl error: {}", e))?;

    if !output.status.success() {
        return Err("Failed to fetch RSS feed".to_string());
    }

    let xml = String::from_utf8_lossy(&output.stdout).to_string();
    let mut articles = Vec::new();

    let item_splits: Vec<&str> = xml.split("<item>").collect();
    for item in item_splits.into_iter().skip(1) {
        if let Some(end_item) = item.find("</item>") {
            let item_content = &item[..end_item];

            let mut title = "";
            if let Some(t_start) = item_content.find("<title>") {
                if let Some(t_end) = item_content[t_start + 7..].find("</title>") {
                    title = &item_content[t_start + 7..t_start + 7 + t_end];
                }
            }

            let mut link = "";
            if let Some(l_start) = item_content.find("<link>") {
                if let Some(l_end) = item_content[l_start + 6..].find("</link>") {
                    link = &item_content[l_start + 6..l_start + 6 + l_end];
                }
            }

            let mut pub_date = "";
            if let Some(p_start) = item_content.find("<pubDate>") {
                if let Some(p_end) = item_content[p_start + 9..].find("</pubDate>") {
                    pub_date = &item_content[p_start + 9..p_start + 9 + p_end];
                }
            }

            let mut source = "";
            if let Some(s_start) = item_content.find("<source") {
                if let Some(tag_close) = item_content[s_start..].find(">") {
                    let text_start = s_start + tag_close + 1;
                    if let Some(s_end) = item_content[text_start..].find("</source>") {
                        source = &item_content[text_start..text_start + s_end];
                    }
                }
            }

            let mut clean_title = title.trim().to_string();
            let mut clean_source = source.trim().to_string();

            if clean_source.is_empty() {
                if let Some(idx) = clean_title.rfind(" - ") {
                    clean_source = clean_title[idx + 3..].trim().to_string();
                    clean_title = clean_title[..idx].trim().to_string();
                } else {
                    clean_source = "News".to_string();
                }
            } else if let Some(idx) = clean_title.rfind(" - ") {
                clean_title = clean_title[..idx].trim().to_string();
            }

            let formatted_date = if pub_date.len() >= 22 {
                pub_date[17..22].to_string()
            } else {
                "Recent".to_string()
            };

            if !clean_title.is_empty() && !link.is_empty() {
                articles.push(NewsArticle {
                    title: clean_title,
                    source: clean_source,
                    link: link.trim().to_string(),
                    pub_date: formatted_date,
                });
            }

            if articles.len() >= 20 {
                break;
            }
        }
    }

    Ok(articles)
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

            // 1. Démarrer le serveur HTTP de webhook local (127.0.0.1:9999)
            let server_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                server::start_server(server_handle).await;
            });

            // 2. Démarrer le Watcher universel Antigravity (logs CLI + IDE)
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
                tray_builder = tray_builder.icon_as_template(false);
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
            search_random_youtube_video,
            fetch_latest_news,
            open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
