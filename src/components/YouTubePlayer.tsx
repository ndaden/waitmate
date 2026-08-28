import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Video, Play, RotateCcw, X, Flame, Music, Sparkles, Loader2, Volume2, VolumeX, AlertCircle } from 'lucide-react';
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
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stocker seenIds dans une ref pour éviter les re-renders en boucle
  const seenIdsRef = useRef<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('waitmate_yt_seen');
      if (saved) {
        seenIdsRef.current = JSON.parse(saved);
      }
    } catch {
      seenIdsRef.current = [];
    }
  }, []);

  const fetchRandomVideo = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setHasError(false);

    // Timeout de sécurité : si le chargement prend plus de 3.5s, on retire le spinner
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 3500);

    try {
      const id = await invoke<string>('search_random_youtube_video', {
        query: searchQuery.trim(),
        excludedIds: seenIdsRef.current.slice(-40),
      });
      if (id) {
        setVideoId(id);
        const next = [...seenIdsRef.current.filter((item) => item !== id), id].slice(-50);
        seenIdsRef.current = next;
        localStorage.setItem('waitmate_yt_seen', JSON.stringify(next));
      }
    } catch (err) {
      console.warn('Erreur recherche YouTube:', err);
      setVideoId('jfKfPfyJRdk');
    } finally {
      setIsLoading(false);
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    }
  }, []);

  // Déclencher la recherche uniquement lorsque activeQuery change
  useEffect(() => {
    if (activeQuery) {
      localStorage.setItem('waitmate_yt_query', activeQuery);
      fetchRandomVideo(activeQuery);
    }
  }, [activeQuery, fetchRandomVideo]);

  // Écouter les erreurs renvoyées par l'API YouTube iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'onError' || (data?.event === 'infoDelivery' && data?.info?.errorCode)) {
          console.warn('[WaitMate YouTube] Erreur détectée dans le lecteur, passage à la vidéo suivante...', data);
          setHasError(true);
          setTimeout(() => {
            fetchRandomVideo(activeQuery);
          }, 800);
        }
      } catch {
        // Ignorer les messages non JSON
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeQuery, fetchRandomVideo]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      if (query.trim() === activeQuery) {
        fetchRandomVideo(query.trim());
      } else {
        setActiveQuery(query.trim());
      }
    }
  };

  const handleSelectPreset = (presetQuery: string) => {
    setQuery(presetQuery);
    if (presetQuery === activeQuery) {
      fetchRandomVideo(presetQuery);
    } else {
      setActiveQuery(presetQuery);
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

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&enablejsapi=1&playsinline=1&rel=0`;

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
            placeholder="Search keyword (e.g. lofi, cats, gaming)..."
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

      {/* Preset Topics */}
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

      {/* YouTube Iframe Player */}
      <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-800 relative flex items-center justify-center">
        {videoId ? (
          <iframe
            ref={iframeRef}
            key={videoId}
            src={embedUrl}
            title="YouTube Player"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-1">
            <Video className="w-8 h-8 text-slate-600" />
            <span className="text-xs">Type a keyword</span>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center pointer-events-none">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        )}

        {hasError && !isLoading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center text-slate-400 p-2 text-center space-y-1.5 z-10">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <span className="text-[11px] text-slate-300">Video restricted on embed</span>
            <button
              onClick={handleNextVideo}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium transition-colors cursor-pointer"
            >
              Play another video
            </button>
          </div>
        )}

        {/* Mute / Unmute Button */}
        <button
          onClick={toggleSound}
          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md active:scale-90 flex items-center space-x-1 text-[10px] z-20"
          title={isMuted ? "Unmute sound" : "Mute sound"}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[9px] text-slate-400">Muted</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[9px] text-emerald-300">Sound on</span>
            </>
          )}
        </button>
      </div>

      {/* Controls below player */}
      <div className="w-full mt-2 flex items-center justify-between px-1 text-[10px] text-slate-500">
        <span className="truncate max-w-[190px] text-slate-400 font-mono">
          {activeQuery}
        </span>

        <button
          onClick={handleNextVideo}
          disabled={isLoading}
          className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          title="Pick another random video"
        >
          <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Random video</span>
        </button>
      </div>
    </div>
  );
};

