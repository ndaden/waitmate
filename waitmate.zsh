# ==============================================================================
# WaitMate - Shell Integration (Zsh Hook)
# ==============================================================================
# Cette intégration permet à WaitMate d'activer instantanément le mini-jeu
# dès qu'une commande CLI IA (agy, claude, ollama, aider, gemini, llm, sgpt...)
# est exécutée dans le terminal, et de le fermer dès que la commande s'achève.
#
# Pour l'activer dans votre terminal, ajoutez simplement cette ligne à ~/.zshrc :
#   source ~/.config/waitmate/waitmate.zsh
# ==============================================================================

typeset -g _WAITMATE_RUNNING=0
typeset -g _WAITMATE_CMD=""

waitmate_preexec() {
  local cmd="$1"
  local first_word="${cmd%% *}"

  # Détecter les CLI IA cibles
  if [[ "$cmd" =~ (^|[[:space:]])(agy|claude|ollama[[:space:]]+run|aider|gemini|llm[[:space:]]+prompt|llm[[:space:]]+chat|sgpt|copilot) ]]; then
    _WAITMATE_RUNNING=1
    _WAITMATE_CMD="$cmd"

    local model="Terminal IA"
    if [[ "$cmd" =~ (^|[[:space:]])agy ]]; then
      model="AGY CLI"
    elif [[ "$cmd" =~ (^|[[:space:]])claude ]]; then
      model="Claude CLI"
    elif [[ "$cmd" =~ ollama ]]; then
      model="Ollama"
    elif [[ "$cmd" =~ aider ]]; then
      model="Aider"
    elif [[ "$cmd" =~ gemini ]]; then
      model="Gemini CLI"
    fi

    # Extraire les 60 premiers caractères du prompt
    local prompt_preview
    prompt_preview=$(echo "$cmd" | tr -d '\n' | head -c 60 | sed 's/"/\\"/g')

    # Envoyer le webhook de démarrage en arrière-plan sans bloquer le shell
    (curl -s -m 1 -X POST http://127.0.0.1:9999/start \
      -H "Content-Type: application/json" \
      -d "{\"model\": \"$model\", \"prompt\": \"$prompt_preview\"}" &>/dev/null &)
  fi
}

waitmate_precmd() {
  if [[ $_WAITMATE_RUNNING -eq 1 ]]; then
    _WAITMATE_RUNNING=0
    # Envoyer le webhook de fin dès que le prompt revient
    (curl -s -m 1 -X POST http://127.0.0.1:9999/stop \
      -H "Content-Type: application/json" \
      -d '{"success": true, "summary": "Commande terminal terminée !"}' &>/dev/null &)
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook preexec waitmate_preexec
add-zsh-hook precmd waitmate_precmd
