import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';
import { CompanionMood, GameStats, StartPayload, StopPayload } from '../types';

export function useWaitMate() {
  const [mood, setMood] = useState<CompanionMood>('idle');
  const [startPayload, setStartPayload] = useState<StartPayload | null>(null);
  const [stopPayload, setStopPayload] = useState<StopPayload | null>(null);
  
  const [stats, setStats] = useState<GameStats>(() => {
    const savedHighScore = localStorage.getItem('waitmate_highscore');
    return {
      score: 0,
      highScore: savedHighScore ? parseInt(savedHighScore, 10) : 0,
      clicks: 0,
      cps: 0,
      multiplier: 1,
      elapsedSeconds: 0,
    };
  });

  const recentClicksRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [keepOpen, setKeepOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('waitmate_keep_open');
    return saved ? JSON.parse(saved) : false; // Par défaut : fermeture automatique
  });

  const keepOpenRef = useRef(keepOpen);
  useEffect(() => {
    keepOpenRef.current = keepOpen;
    localStorage.setItem('waitmate_keep_open', JSON.stringify(keepOpen));
  }, [keepOpen]);

  const toggleKeepOpen = useCallback(() => {
    setKeepOpen((prev) => !prev);
  }, []);

  // Helper pour ajuster la taille de la fenêtre selon l'état
  const updateWindowMode = useCallback(async (newMood: CompanionMood) => {
    try {
      await invoke('set_window_mode', { mode: newMood });
      console.log(`[WaitMate] Window mode mis à jour : ${newMood}`);
    } catch (err) {
      console.warn('[WaitMate] Non exécuté dans Tauri (mode Web fallback):', err);
    }
  }, []);

  // Déclencher la fin de session et le retour en Idle (sauf si keepOpen est activé)
  const handleStopAi = useCallback((payload?: StopPayload) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setStopPayload(payload || { success: true });

    // Déclencher une pluie de confettis discrète
    try {
      confetti({
        particleCount: 40,
        spread: 45,
        origin: { y: 0.9, x: 0.9 },
        colors: ['#38bdf8', '#818cf8', '#c084fc', '#4ade80'],
      });
    } catch (e) {
      console.error(e);
    }

    // Si l'utilisateur a choisi de garder la fenêtre ouverte, on ne replie pas le panneau
    if (keepOpenRef.current) {
      console.log('[WaitMate] IA terminée mais "Keep Open" est activé -> la fenêtre reste ouverte.');
      return;
    }

    setMood('idle');
    setStartPayload(null);
    updateWindowMode('idle');
  }, [updateWindowMode]);

  // Déclencher le début d'une session IA
  const handleStartAi = useCallback((payload?: StartPayload) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setStartPayload(payload || { prompt: "Generating response...", model: "AI" });
    setStopPayload(null);
    setMood('active');
    updateWindowMode('active');

    // Réinitialiser les stats pour la nouvelle partie
    setStats((prev) => ({
      ...prev,
      score: 0,
      clicks: 0,
      cps: 0,
      multiplier: 1,
      elapsedSeconds: 0,
    }));
    recentClicksRef.current = [];
  }, [updateWindowMode]);

  // Écouteurs d'événements Tauri au montage
  useEffect(() => {
    // Mode compact par défaut
    updateWindowMode('idle');

    let unlistenStart: (() => void) | undefined;
    let unlistenStop: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unlistenStart = await listen<StartPayload>('start-ai', (event) => {
          console.log('[Frontend Event] start-ai reçu:', event.payload);
          handleStartAi(event.payload);
        });

        unlistenStop = await listen<StopPayload>('stop-ai', (event) => {
          console.log('[Frontend Event] stop-ai reçu:', event.payload);
          handleStopAi(event.payload);
        });
      } catch (err) {
        console.warn('[WaitMate] Impossible d’enregistrer les écouteurs Tauri (mode web):', err);
      }
    };

    setupListeners();

    return () => {
      if (unlistenStart) unlistenStart();
      if (unlistenStop) unlistenStop();
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handleStartAi, handleStopAi, updateWindowMode]);

  // Chronomètre de session et calcul du CPS
  useEffect(() => {
    if (mood !== 'active') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      const now = Date.now();
      recentClicksRef.current = recentClicksRef.current.filter((t) => now - t <= 1000);
      const currentCps = recentClicksRef.current.length;

      let mult = 1;
      if (currentCps >= 8) mult = 3;
      else if (currentCps >= 5) mult = 2;
      else if (currentCps >= 3) mult = 1.5;

      setStats((prev) => {
        const newHighScore = Math.max(prev.score, prev.highScore);
        if (newHighScore > prev.highScore) {
          localStorage.setItem('waitmate_highscore', newHighScore.toString());
        }

        return {
          ...prev,
          cps: currentCps,
          multiplier: mult,
          highScore: newHighScore,
          elapsedSeconds: prev.elapsedSeconds + 1,
        };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mood]);

  // Action du joueur : clic sur le jeu
  const registerClick = useCallback(() => {
    const now = Date.now();
    recentClicksRef.current.push(now);

    setStats((prev) => {
      const pointsGained = Math.round(10 * prev.multiplier);
      const newScore = prev.score + pointsGained;
      const newHighScore = Math.max(newScore, prev.highScore);
      if (newHighScore > prev.highScore) {
        localStorage.setItem('waitmate_highscore', newHighScore.toString());
      }

      return {
        ...prev,
        clicks: prev.clicks + 1,
        score: newScore,
        highScore: newHighScore,
      };
    });
  }, []);

  // Déclencheurs de test
  const triggerManualStart = useCallback(async () => {
    try {
      await invoke('trigger_test_start');
    } catch {
      handleStartAi({ prompt: "Simulation locale", model: "Dev Mode", estimated_time: 20 });
    }
  }, [handleStartAi]);

  const triggerManualStop = useCallback(async () => {
    try {
      await invoke('trigger_test_stop');
    } catch {
      handleStopAi({ success: true, summary: "Génération simulée achevée" });
    }
  }, [handleStopAi]);

  // Fermer immédiatement le mode actif et replier la fenêtre
  const dismissActiveMode = useCallback(() => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setMood('idle');
    setStartPayload(null);
    setStopPayload(null);
    updateWindowMode('idle');
  }, [updateWindowMode]);

  return {
    mood,
    stats,
    startPayload,
    stopPayload,
    keepOpen,
    toggleKeepOpen,
    registerClick,
    triggerManualStart,
    triggerManualStop,
    dismissActiveMode,
  };
}
