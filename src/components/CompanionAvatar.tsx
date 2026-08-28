import { useRef } from 'react';
import { Bot, GripVertical } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { CompanionMood } from '../types';

interface CompanionAvatarProps {
  mood: CompanionMood;
  onClick?: () => void;
  onTestClick?: () => void;
}

export const CompanionAvatar: React.FC<CompanionAvatarProps> = ({
  mood,
  onClick,
}) => {
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

    try {
      invoke('start_dragging');
    } catch (err) {
      console.warn('start_dragging error:', err);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragStartRef.current) return;
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    const dt = Date.now() - dragStartRef.current.time;

    if (dx < 6 && dy < 6 && dt < 400) {
      if (onClick) onClick();
    }
    dragStartRef.current = null;
  };

  const isLit = mood === 'active' || mood === 'success';

  return (
    <div className="relative flex flex-col items-center select-none group">
      {/* Avatar Draggable */}
      <div
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="relative flex items-center justify-center cursor-grab active:cursor-grabbing p-1"
        title="Drag to move • Click to open"
      >
        {/* Corps du compagnon (sans halo, sans bounce) */}
        <div
          className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 border ${
            mood === 'active'
              ? 'bg-slate-900 border-cyan-400'
              : mood === 'success'
              ? 'bg-slate-900 border-emerald-400'
              : 'bg-slate-900 border-slate-700 hover:border-slate-500'
          }`}
        >
          {/* Même icône Bot avec effet allumé / éteint */}
          <div className="relative flex items-center justify-center">
            <Bot
              className={`w-8 h-8 transition-colors duration-200 ${
                mood === 'active'
                  ? 'text-cyan-300'
                  : mood === 'success'
                  ? 'text-emerald-300'
                  : 'text-slate-400 group-hover:text-slate-200'
              }`}
            />

            {/* Témoin lumineux quand c'est allumé */}
            {isLit && (
              <span
                className={`absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full border border-slate-900 transition-colors ${
                  mood === 'active' ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
            )}
          </div>

          {/* Poignée de drag discrète */}
          <div className="absolute -left-1 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none text-slate-400">
            <GripVertical className="w-3 h-3" />
          </div>
        </div>

        {/* Badge sobre sous l'avatar en veille */}
        {mood === 'idle' && (
          <div className="absolute -bottom-2 z-20 px-2 py-0.5 rounded-full text-[9px] font-medium tracking-wide border bg-slate-900 text-slate-400 border-slate-700">
            WaitMate
          </div>
        )}
      </div>
    </div>
  );
};
