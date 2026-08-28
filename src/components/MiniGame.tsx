import { useState, useEffect } from 'react';
import { Clock, GripHorizontal, Gamepad2, X, ChevronRight, ArrowLeft, Video } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { GameStats, StartPayload } from '../types';
import { SnakeGame } from './SnakeGame';
import { YouTubePlayer } from './YouTubePlayer';

interface MiniGameProps {
  stats: GameStats;
  startPayload: StartPayload | null;
  onClose: () => void;
}

type ActiveView = 'hub' | 'snake' | 'youtube';

export const MiniGame: React.FC<MiniGameProps> = ({
  stats,
  startPayload,
  onClose,
}) => {
  const [view, setView] = useState<ActiveView>('hub');
  const [snakeHighScore, setSnakeHighScore] = useState<number>(0);

  useEffect(() => {
    const savedSnake = localStorage.getItem('waitmate_snake_highscore');
    if (savedSnake) setSnakeHighScore(parseInt(savedSnake, 10));
  }, [view]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      try {
        invoke('start_dragging');
      } catch (err) {
        console.warn('start_dragging error:', err);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="w-80 glass-panel rounded-2xl p-3 border border-slate-800 text-white select-none">
      {/* Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="flex items-center justify-between border-b border-white/5 pb-2 mb-2.5 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center space-x-2">
          {view !== 'hub' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setView('hub');
              }}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Menu"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-2 h-2 rounded-full bg-cyan-400 ml-0.5" />
          )}

          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-slate-200">
              {startPayload?.model || "IA"}
            </span>
            <GripHorizontal className="w-3 h-3 text-slate-600" />
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatTime(stats.elapsedSeconds)}</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* VUE 1 : MENU ACTIVITÉS */}
      {view === 'hub' && (
        <div className="animate-in fade-in duration-150 space-y-1.5 py-0.5">
          {/* Option Snake */}
          <button
            onClick={() => setView('snake')}
            className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 flex items-center justify-between transition-all group cursor-pointer active:scale-98"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-medium text-white group-hover:text-emerald-300 transition-colors">
                  Snake
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Record : {snakeHighScore}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
          </button>

          {/* Option YouTube */}
          <button
            onClick={() => setView('youtube')}
            className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 flex items-center justify-between transition-all group cursor-pointer active:scale-98"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-105 transition-transform">
                <Video className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-medium text-white group-hover:text-rose-300 transition-colors">
                  YouTube
                </div>
                <div className="text-[10px] text-slate-500">
                  Clips & vidéos par mot-clé
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-rose-400 transition-colors" />
          </button>

          {/* Bouton Fermer */}
          <button
            onClick={onClose}
            className="w-full mt-1 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-center"
          >
            Fermer
          </button>
        </div>
      )}

      {/* VUE 2 : SNAKE */}
      {view === 'snake' && (
        <div className="animate-in fade-in duration-150">
          <SnakeGame />
        </div>
      )}

      {/* VUE 3 : YOUTUBE */}
      {view === 'youtube' && (
        <div className="animate-in fade-in duration-150">
          <YouTubePlayer />
        </div>
      )}
    </div>
  );
};
