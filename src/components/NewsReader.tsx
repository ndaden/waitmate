import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Cpu, TrendingUp, Sparkles, RotateCcw, ExternalLink, Loader2, AlertCircle, Newspaper } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface NewsArticle {
  title: string;
  source: string;
  link: string;
  pub_date: string;
}

type NewsCategory = 'top' | 'world' | 'tech' | 'business';

const CATEGORIES: { id: NewsCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'top', label: 'Top', icon: Sparkles },
  { id: 'world', label: 'World', icon: Globe },
  { id: 'tech', label: 'Tech', icon: Cpu },
  { id: 'business', label: 'Business', icon: TrendingUp },
];

export const NewsReader: React.FC = () => {
  const [category, setCategory] = useState<NewsCategory>('top');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async (cat: NewsCategory) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await invoke<NewsArticle[]>('fetch_latest_news', { category: cat });
      if (data && data.length > 0) {
        setArticles(data);
      } else {
        setError('No news articles found');
      }
    } catch (err) {
      console.warn('fetch_latest_news error:', err);
      setError('Failed to load news');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews(category);
  }, [category, loadNews]);

  const handleOpenArticle = async (url: string) => {
    try {
      await invoke('open_external_url', { url });
    } catch (e) {
      console.warn('open_external_url error:', e);
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex flex-col w-full select-none animate-in fade-in duration-150">
      {/* Category Tabs Bar & Refresh Button */}
      <div className="w-full flex items-center justify-between gap-1 mb-2 pb-1 border-b border-white/5">
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5">
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border transition-all cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-slate-800 border-slate-600 text-white shadow-xs'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => loadNews(category)}
          disabled={isLoading}
          className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
          title="Refresh headlines"
        >
          <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* News List Container */}
      <div className="w-full max-h-[280px] overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
        {isLoading && articles.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-xs">Fetching headlines...</span>
          </div>
        ) : error && articles.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center p-3 space-y-2">
            <AlertCircle className="w-6 h-6 text-amber-400" />
            <span className="text-xs text-slate-300">{error}</span>
            <button
              onClick={() => loadNews(category)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-white cursor-pointer transition-all"
            >
              Try Again
            </button>
          </div>
        ) : (
          articles.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleOpenArticle(item.link)}
              className="group p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer active:scale-98 relative"
            >
              {/* Header: Source Pill + Date */}
              <div className="flex items-center justify-between mb-1">
                <span className="px-1.5 py-0.2 rounded-md bg-slate-800 border border-slate-700/80 text-[9px] font-semibold text-cyan-300 truncate max-w-[170px]">
                  {item.source}
                </span>

                <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                  <span>{item.pub_date}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 group-hover:text-cyan-300" />
                </div>
              </div>

              {/* Title */}
              <h4 className="text-[11px] font-medium leading-snug text-slate-200 group-hover:text-white transition-colors line-clamp-2">
                {item.title}
              </h4>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-2 flex items-center justify-between w-full px-1 text-[10px] text-slate-500">
        <span className="flex items-center space-x-1">
          <Newspaper className="w-2.5 h-2.5" />
          <span>Real-time feeds</span>
        </span>
        <span>Tap to open article</span>
      </div>
    </div>
  );
};
