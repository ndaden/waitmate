import React from 'react';
import { Sparkles, Bot, Gamepad2, Pin, ArrowRight } from 'lucide-react';

interface WelcomeCardProps {
  onDismiss: () => void;
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({ onDismiss }) => {
  return (
    <div className="w-80 glass-panel rounded-2xl p-4 border border-slate-800 text-white select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Header with Icon */}
      <div className="flex items-center space-x-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white flex items-center space-x-1.5">
            <span>Welcome to WaitMate</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </h2>
          <p className="text-[11px] text-slate-400">Your companion while AI thinks</p>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="space-y-2 mb-3.5 text-xs text-slate-300">
        <div className="flex items-start space-x-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <div className="mt-0.5 p-1 rounded-md bg-cyan-500/10 text-cyan-400">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-slate-100 block text-[11px]">Auto AI Detection</span>
            <span className="text-[10px] text-slate-400 leading-tight block">
              Opens automatically when your AI (Antigravity, Claude, Aider...) is thinking.
            </span>
          </div>
        </div>

        <div className="flex items-start space-x-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <div className="mt-0.5 p-1 rounded-md bg-emerald-500/10 text-emerald-400">
            <Gamepad2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-slate-100 block text-[11px]">Chill While You Wait</span>
            <span className="text-[10px] text-slate-400 leading-tight block">
              Play classic Snake or enjoy ambient Lo-Fi music and video clips.
            </span>
          </div>
        </div>

        <div className="flex items-start space-x-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <div className="mt-0.5 p-1 rounded-md bg-indigo-500/10 text-indigo-400">
            <Pin className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-slate-100 block text-[11px]">Auto-close or Pin</span>
            <span className="text-[10px] text-slate-400 leading-tight block">
              Closes when AI finishes, or toggle Pinned to keep watching or playing.
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onDismiss}
        className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-all cursor-pointer active:scale-98 flex items-center justify-center space-x-1.5 shadow-lg shadow-cyan-500/20"
      >
        <span>Got it, open WaitMate</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
