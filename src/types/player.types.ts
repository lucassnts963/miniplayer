export type QueueItemStatus = 'pending' | 'playing' | 'played' | 'error';

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  status: QueueItemStatus;
  addedAt: number;
  duration?: number;
  currentTime?: number;
  errorMessage?: string;
}

export interface Playlist {
  id: string;
  name: string;
  items: QueueItem[];
  currentIndex: number;
  createdAt: number;
}

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

export type WindowPreset = 'small' | 'medium' | 'large' | 'xlarge';

export interface PlayerSettings {
  alwaysOnTop: boolean;
  autoPlayNext: boolean;
  avoidDuplicates: boolean;
  volume: number;
  isMuted: boolean;
  preset: WindowPreset;
  showCaptions: boolean;
}

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  author?: string;
  thumbnail: string;
}

export interface QuickAddPayload {
  url: string;
  playNow: boolean;
}
