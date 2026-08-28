export interface StartPayload {
  prompt?: string;
  model?: string;
  estimated_time?: number;
}

export interface StopPayload {
  success?: boolean;
  summary?: string;
  auto_timeout?: boolean;
}

export type CompanionMood = 'idle' | 'active' | 'success' | 'sleeping';

export interface GameStats {
  score: number;
  highScore: number;
  clicks: number;
  cps: number;
  multiplier: number;
  elapsedSeconds: number;
}

export type GameType = 'snake' | 'youtube';
