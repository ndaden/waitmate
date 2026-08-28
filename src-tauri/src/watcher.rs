use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};

use crate::server::{StartPayload, StopPayload};

#[derive(serde::Deserialize, Debug)]
struct TranscriptStep {
    step_index: Option<u64>,
    source: Option<String>,
    #[serde(rename = "type")]
    step_type: Option<String>,
    content: Option<String>,
    tool_calls: Option<serde_json::Value>,
}

pub struct WatcherState {
    pub auto_detect_enabled: Arc<AtomicBool>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            auto_detect_enabled: Arc::new(AtomicBool::new(true)),
        }
    }
}

/// Surveillance ultra-rapide (120ms) de TOUTES les instances Antigravity (CLI 'agy', IDE, Desktop)
pub async fn start_antigravity_watcher(app_handle: AppHandle, auto_detect_enabled: Arc<AtomicBool>) {
    println!("[WaitMate Watcher] 🔍 Démarrage de la détection universelle Antigravity (CLI agy + IDE)...");

    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => {
            eprintln!("[WaitMate Watcher] Impossible de déterminer le répertoire $HOME");
            return;
        }
    };

    let gemini_dir = PathBuf::from(home).join(".gemini");

    let mut is_ai_active = false;
    let mut last_detected_step_index: Option<u64> = None;
    let mut active_conversation_id: Option<String> = None;

    loop {
        tokio::time::sleep(Duration::from_millis(120)).await;

        if !auto_detect_enabled.load(Ordering::Relaxed) {
            continue;
        }

        if !gemini_dir.exists() {
            continue;
        }

        // Trouver le transcript le plus récemment modifié parmi TOUTES les racines (.gemini/antigravity, .gemini/antigravity-cli, etc.)
        if let Some((latest_file, conv_id, source_app, modified_time)) = find_latest_transcript_universal(&gemini_dir) {
            let elapsed_since_mod = SystemTime::now()
                .duration_since(modified_time)
                .unwrap_or(Duration::from_secs(9999));

            // Si le fichier a été modifié il y a moins de 15 secondes
            if elapsed_since_mod < Duration::from_secs(15) {
                if let Some(steps) = read_last_steps(&latest_file, 4) {
                    if let Some(last_step) = steps.last() {
                        let step_idx = last_step.step_index.unwrap_or(0);
                        let source = last_step.source.as_deref().unwrap_or("");
                        let step_type = last_step.step_type.as_deref().unwrap_or("");
                        let has_tool_calls = match &last_step.tool_calls {
                            Some(serde_json::Value::Array(arr)) => !arr.is_empty(),
                            _ => false,
                        };

                        // Détecter si l'IA est en train de réfléchir ou d'exécuter des outils
                        let is_thinking_now = (source == "USER_EXPLICIT" && step_type == "USER_INPUT")
                            || (source == "MODEL" && has_tool_calls)
                            || (source == "MODEL" && step_type == "GENERIC")
                            || (source == "MODEL" && step_type == "PLANNER_RESPONSE" && has_tool_calls);

                        // Détecter si la réponse finale est terminée (LLM a fini de réfléchir)
                        let is_turn_finished = source == "MODEL"
                            && step_type == "PLANNER_RESPONSE"
                            && !has_tool_calls
                            && last_step.content.is_some();

                        if is_thinking_now && !is_ai_active {
                            // Extraire le prompt utilisateur
                            let mut prompt_preview = "Réflexion IA en cours...".to_string();
                            for s in steps.iter().rev() {
                                if s.step_type.as_deref() == Some("USER_INPUT") {
                                    if let Some(c) = &s.content {
                                        let clean_text = c
                                            .replace("<USER_REQUEST>", "")
                                            .replace("</USER_REQUEST>", "")
                                            .trim()
                                            .to_string();
                                        prompt_preview = if clean_text.len() > 60 {
                                            format!("{}...", &clean_text[..60])
                                        } else {
                                            clean_text
                                        };
                                        break;
                                    }
                                }
                            }

                            let model_name = if source_app.contains("cli") {
                                "AGY Terminal"
                            } else {
                                "Antigravity"
                            };

                            println!(
                                "[WaitMate Auto-Detect] ⚡ Début réflexion [{}] dans {} (step {}) : {}",
                                model_name, conv_id, step_idx, prompt_preview
                            );

                            is_ai_active = true;
                            last_detected_step_index = Some(step_idx);
                            active_conversation_id = Some(conv_id.clone());

                            let _ = app_handle.emit(
                                "start-ai",
                                &StartPayload {
                                    prompt: Some(prompt_preview),
                                    model: Some(model_name.to_string()),
                                    estimated_time: Some(45),
                                },
                            );
                        } else if is_turn_finished && is_ai_active {
                            if active_conversation_id.as_deref() == Some(&conv_id)
                                && last_detected_step_index != Some(step_idx)
                            {
                                println!(
                                    "[WaitMate Auto-Detect] 🛑 Fin de réflexion [{}] dans {} (step {}) -> Retour immédiat en Idle",
                                    source_app, conv_id, step_idx
                                );

                                is_ai_active = false;
                                last_detected_step_index = Some(step_idx);

                                let _ = app_handle.emit(
                                    "stop-ai",
                                    &StopPayload {
                                        success: Some(true),
                                        summary: Some("Réponse prête !".to_string()),
                                        auto_timeout: Some(false),
                                    },
                                );
                            }
                        }
                    }
                }
            } else if is_ai_active && elapsed_since_mod > Duration::from_secs(18) {
                // Timeout de sécurité si aucune nouvelle écriture depuis 18s
                is_ai_active = false;
                let _ = app_handle.emit(
                    "stop-ai",
                    &StopPayload {
                        success: Some(true),
                        summary: Some("Session terminée".to_string()),
                        auto_timeout: Some(true),
                    },
                );
            }
        }
    }
}

/// Scanner de processus pour CLI IA interactifs (Claude Code, Ollama run, Aider...)
pub async fn start_terminal_cli_watcher(app_handle: AppHandle, auto_detect_enabled: Arc<AtomicBool>) {
    println!("[WaitMate Watcher] 🖥️ Démarrage du scanner CLI (claude, ollama run, aider...)...");

    let mut sys = sysinfo::System::new();
    let mut active_pid: Option<sysinfo::Pid> = None;
    let mut active_process_name = String::new();

    let my_pid = sysinfo::get_current_pid().ok();

    loop {
        tokio::time::sleep(Duration::from_millis(400)).await;

        if !auto_detect_enabled.load(Ordering::Relaxed) {
            continue;
        }

        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        // Si nous suivons déjà un processus CLI actif
        if let Some(pid) = active_pid {
            if sys.process(pid).is_some() {
                continue;
            } else {
                println!(
                    "[WaitMate CLI Watcher] 🛑 Processus CLI terminé (PID {:?} : {})",
                    pid, active_process_name
                );
                active_pid = None;
                let _ = app_handle.emit(
                    "stop-ai",
                    &StopPayload {
                        success: Some(true),
                        summary: Some(format!("Commande {} terminée !", active_process_name)),
                        auto_timeout: Some(false),
                    },
                );
            }
        } else {
            // Scanner les processus interactifs (exclure 'agy' qui est géré directement par le watcher de transcript)
            for (pid, process) in sys.processes() {
                if Some(*pid) == my_pid {
                    continue;
                }

                let proc_name = process.name().to_string_lossy().to_lowercase();
                let cmd_args = process
                    .cmd()
                    .iter()
                    .map(|s| s.to_string_lossy().into_owned())
                    .collect::<Vec<String>>()
                    .join(" ");
                let cmd_lower = cmd_args.to_lowercase();

                let is_ai_cli = (proc_name == "claude" || cmd_lower.starts_with("claude "))
                    || (cmd_lower.contains("ollama run"))
                    || (proc_name == "aider" || cmd_lower.contains("aider"))
                    || (cmd_lower.contains("llm prompt") || cmd_lower.starts_with("llm "))
                    || (proc_name == "sgpt" || cmd_lower.contains("sgpt"));

                if is_ai_cli && !cmd_lower.contains("grep") && !cmd_lower.contains("waitmate") && !cmd_lower.contains("agy") {
                    let label = if proc_name.contains("claude") || cmd_lower.contains("claude") {
                        "Claude CLI"
                    } else if cmd_lower.contains("ollama") {
                        "Ollama"
                    } else if cmd_lower.contains("aider") {
                        "Aider"
                    } else {
                        "Terminal AI"
                    };

                    let prompt_text = if cmd_args.len() > 60 {
                        format!("{}...", &cmd_args[..60])
                    } else if !cmd_args.is_empty() {
                        cmd_args.clone()
                    } else {
                        format!("Exécution {}", label)
                    };

                    println!(
                        "[WaitMate CLI Watcher] ⚡ Détection commande CLI : {} (PID {:?}) -> {}",
                        label, pid, prompt_text
                    );

                    active_pid = Some(*pid);
                    active_process_name = label.to_string();

                    let _ = app_handle.emit(
                        "start-ai",
                        &StartPayload {
                            prompt: Some(prompt_text),
                            model: Some(label.to_string()),
                            estimated_time: Some(60),
                        },
                    );
                    break;
                }
            }
        }
    }
}

/// Cherche le transcript le plus récent dans TOUS les sous-dossiers de ~/.gemini (antigravity, antigravity-cli, antigravity-ide)
fn find_latest_transcript_universal(gemini_dir: &Path) -> Option<(PathBuf, String, String, SystemTime)> {
    let target_apps = ["antigravity-cli", "antigravity", "antigravity-ide"];
    let mut newest_entry: Option<(PathBuf, String, String, SystemTime)> = None;

    for app in &target_apps {
        let brain_dir = gemini_dir.join(app).join("brain");
        if brain_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&brain_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let conv_id = match path.file_name() {
                            Some(name) => name.to_string_lossy().to_string(),
                            None => continue,
                        };
                        let transcript = path.join(".system_generated").join("logs").join("transcript.jsonl");

                        if transcript.exists() {
                            if let Ok(meta) = std::fs::metadata(&transcript) {
                                if let Ok(modified) = meta.modified() {
                                    if let Some((_, _, _, best_mod)) = &newest_entry {
                                        if modified > *best_mod {
                                            newest_entry = Some((transcript, conv_id, app.to_string(), modified));
                                        }
                                    } else {
                                        newest_entry = Some((transcript, conv_id, app.to_string(), modified));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    newest_entry
}

fn read_last_steps(file_path: &Path, count: usize) -> Option<Vec<TranscriptStep>> {
    let file = File::open(file_path).ok()?;
    let reader = BufReader::new(file);

    let mut lines = Vec::new();
    for line in reader.lines().flatten() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            lines.push(trimmed.to_string());
        }
    }

    let start_idx = if lines.len() > count {
        lines.len() - count
    } else {
        0
    };

    let mut steps = Vec::new();
    for line in &lines[start_idx..] {
        if let Ok(step) = serde_json::from_str::<TranscriptStep>(line) {
            steps.push(step);
        }
    }

    Some(steps)
}
