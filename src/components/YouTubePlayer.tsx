import { useState, useEffect, useRef } from 'react';
import { Search, Video, Play, RotateCcw, X, Flame, Music, Sparkles, Loader2, Volume2, VolumeX } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface YouTubePlayerProps {
  onBack?: () => void;
}

const PRESET_TOPICS = [
  { label: 'Lo-Fi', query: 'lofi hip hop radio beats to relax study', icon: Music },
  { label: 'Shorts Fun', query: 'funny viral shorts compilation', icon: Flame },
  { label: 'Cats', query: 'funny cats compilation', icon: Sparkles },
  { label: 'Synthwave', query: 'synthwave chill mix', icon: Music },
  { label: 'Gaming', query: 'satisfying gaming moments highlights', icon: Play },
];

export const YouTubePlayer: React.FC<YouTubePlayerProps> = () => {
  const [query, setQuery] = useState(() => {
    return localStorage.getItem('waitmate_yt_query') || 'lofi beats';
  });
  const [activeQuery, setActiveQuery] = useState(() => {
    return localStorage.getItem('waitmate_yt_query') || 'lofi beats';
  });
  const [videoId, setVideoId] = useState<string>('jfKfPfyJRdk');
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [seenIds, setSeenIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('waitmate_yt_seen');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchRandomVideo = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    try {
      const id = await invoke<string>('search_random_youtube_video', {
        query: searchQuery.trim(),
        excludedIds: seenIds.slice(-40),
      });
      if (id) {
        setVideoId(id);
        setSeenIds((prev) => {
          const next = [...prev.filter((item) => item !== id), id].slice(-50);
          localStorage.setItem('waitmate_yt_seen', JSON.stringify(next));
          return next;
        });
      }
    } catch (err) {
      console.warn('Erreur de recherche YouTube:', err);
      setVideoId('jfKfPfyJRdk');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeQuery) {
      localStorage.setItem('waitmate_yt_query', activeQuery);
      fetchRandomVideo(activeQuery);
    }
  }, [activeQuery]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      setActiveQuery(query.trim());
      if (query.trim() === activeQuery) {
        fetchRandomVideo(query.trim());
      }
    }
  };

  const handleSelectPreset = (presetQuery: string) => {
    setQuery(presetQuery);
    setActiveQuery(presetQuery);
    if (presetQuery === activeQuery) {
      fetchRandomVideo(presetQuery);
    }
  };

  const handleNextVideo = () => {
    fetchRandomVideo(activeQuery);
  };

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: 'command',
          func: nextMuted ? 'mute' : 'unMute',
          args: '',
        }),
        '*'
      );
    } catch (e) {
      console.warn('postMessage mute error:', e);
    }
  };

  return (
    <div className="flex flex-col items-center w-full select-none animate-in fade-in duration-150">
      {/* Barre de recherche */}
      <form onSubmit={handleSearch} className="w-full mb-2">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mot-clé vidéo (ex: lofi, chat, gaming)..."
            className="w-full py-1.5 pl-8 pr-14 rounded-xl bg-slate-900 border border-slate-700/80 focus:border-slate-500 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />

          <div className="absolute right-1.5 flex items-center space-x-1">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="submit"
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition-all cursor-pointer active:scale-95 flex items-center space-x-1"
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Go</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Raccourcis / Tags rapides */}
      <div className="w-full flex items-center space-x-1.5 mb-2 overflow-x-auto no-scrollbar py-0.5">
        {PRESET_TOPICS.map((preset) => {
          const isSelected = activeQuery === preset.query;
          const Icon = preset.icon;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleSelectPreset(preset.query)}
              className={`flex-shrink-0 flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all cursor-pointer active:scale-95 ${
                isSelected
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-2.5 h-2.5" />
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>

      {/* Lecteur Iframe YouTube (Muet par défaut) */}
      <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-800 relative flex items-center justify-center">
        {videoId ? (
          <iframe
            ref={iframeRef}
            key={videoId}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&enablejsapi=1&controls=0&disablekb=1&modestbranding=1&fs=0&iv_load_policy=3&rel=0&playsinline=1`}
            title="YouTube Player"
            className="w-full h-full border-0 pointer-events-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-1">
            <Video className="w-8 h-8 text-slate-600" />
            <span className="text-xs">Tape un mot-clé</span>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        )}

        {/* Bouton Muet / Activer le son discret en bas à droite du lecteur */}
        <button
          onClick={toggleSound}
          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md active:scale-90 flex items-center space-x-1 text-[10px]"
          title={isMuted ? "Activer le son" : "Couper le son"}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[9px] text-slate-400">Muet</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[9px] text-emerald-300">Son actif</span>
            </>
          )}
        </button>
      </div>

      {/* Contrôle rapide sous le lecteur */}
      <div className="w-full mt-2 flex items-center justify-between px-1 text-[10px] text-slate-500">
        <span className="truncate max-w-[190px] text-slate-400 font-mono">
          {activeQuery}
        </span>

        <button
          onClick={handleNextVideo}
          disabled={isLoading}
          className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          title="Tirer une autre vidéo au sort"
        >
          <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Suivant</span>
        </button>
      </div>
    </div>
  );
};
