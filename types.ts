export enum SoraModel {
  SORA2_LANDSCAPE = 'sora2-landscape', // 10s
  SORA2_PORTRAIT = 'sora2-portrait', // 10s
  SORA2_LANDSCAPE_15S = 'sora2-landscape-15s',
  SORA2_PORTRAIT_15S = 'sora2-portrait-15s',
  SORA2_PRO_LANDSCAPE_25S = 'sora2-pro-landscape-25s',
  SORA2_PRO_PORTRAIT_25S = 'sora2-pro-portrait-25s',
  SORA2_PRO_PORTRAIT_HD_15S = 'sora2-pro-portrait-hd-15s',
  SORA2_PRO_LANDSCAPE_HD_15S = 'sora2-pro-landscape-hd-15s',
  SORA2_CHARACTERS = 'sora2-characters', // Special model for character creation
}

export interface SoraModelOption {
  value: SoraModel;
  label: string;
  badge: string;
}

export const MODEL_OPTIONS: SoraModelOption[] = [
  { value: SoraModel.SORA2_LANDSCAPE, label: 'Landscape (10s)', badge: 'Fast' },
  { value: SoraModel.SORA2_PORTRAIT, label: 'Portrait (10s)', badge: 'Mobile' },
  { value: SoraModel.SORA2_LANDSCAPE_15S, label: 'Landscape (15s)', badge: 'Standard' },
  { value: SoraModel.SORA2_PORTRAIT_15S, label: 'Portrait (15s)', badge: 'Mobile' },
  { value: SoraModel.SORA2_PRO_LANDSCAPE_25S, label: 'Pro Landscape (25s)', badge: 'Long' },
  { value: SoraModel.SORA2_PRO_PORTRAIT_25S, label: 'Pro Portrait (25s)', badge: 'Long' },
  { value: SoraModel.SORA2_PRO_PORTRAIT_HD_15S, label: 'Pro Portrait HD (15s)', badge: 'HD' },
  { value: SoraModel.SORA2_PRO_LANDSCAPE_HD_15S, label: 'Pro Landscape HD (15s)', badge: 'HD' },
];

export interface Channel {
  id: string;
  name: string;
  baseUrl: string;
  apiToken: string;
}

export type TaskStatus = 'queued' | 'processing' | 'success' | 'failed';

export interface VideoTask {
  id: string; // Local ID for React keys
  apiId?: string; // The ID returned from the API (char_...)
  prompt: string;
  model: SoraModel;
  status: TaskStatus;
  progress: number; // 0 to 100
  videoUrl?: string;
  coverUrl?: string;
  errorMessage?: string;
  createdAt: number;
  channelId?: string; // Track which channel created this task
  // Character specific fields
  characterName?: string; // User defined name for characters
  isCharacterAsset?: boolean; // Flag to identify if this task resulted in a reusable character
}

export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface CreateTaskResponse {
  id: string; // The query ID, e.g., char_...
}

export interface QueryTaskResponse {
  id: string;
  status: string; // The raw status string from API
  progress?: string; // Sometimes APIs return "50%"
  result_video_url?: string;
  cover_url?: string;
  fail_reason?: string;
}