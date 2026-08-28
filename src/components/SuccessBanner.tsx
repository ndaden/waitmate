import { CheckCircle2, Trophy, X } from 'lucide-react';
import { GameStats, StopPayload } from '../types';

interface SuccessBannerProps {
  stats: GameStats;
  stopPayload: StopPayload | null;
  onClose?: () => void;
}

export const SuccessBanner: React.FC<SuccessBannerProps> = ({ stats, stopPayload, onClose }) => {
  const isNewHighScore = stats.score > 0 && stats.score >= stats.highScore;

  return (
    <div className="w-80 glass-panel rounded-2xl p-3 border border-slate-800 text-white select-none relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="flex items-center space-x-2.5 mb-2 pr-6">
        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-emerald-300">
            Ready
          </h3>
          <p className="text-[11px] text-slate-400 truncate max-w-[190px]">
            {stopPayload?.summary || "AI response is ready."}
          </p>
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Score</span>
          <span className="text-base font-bold text-emerald-300">
            {stats.score} <span className="text-xs font-normal text-slate-500">pts</span>
          </span>
        </div>

        {isNewHighScore ? (
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-400/20 text-amber-300 text-[11px] font-bold">
            <Trophy className="w-3 h-3 text-amber-400" />
            <span>New Best</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 font-mono">
            Best: {stats.highScore}
          </span>
        )}
      </div>
    </div>
  );
};
