
// 🛑 DO NOT MODIFY EXISTING ENUM VALUES OR INTERFACE STRUCTURES
/**
 * Supported Sora Models
 */
export enum SoraModel {
  SORA2_LANDSCAPE = 'sora2-landscape', 
  SORA2_PORTRAIT = 'sora2-portrait', 
  SORA2_PRO_LANDSCAPE = 'sora2-pro-landscape',
  SORA2_PRO_PORTRAIT = 'sora2-pro-portrait',
  SORA_V2 = 'sora-2', // 通用 Sora 2.0 模型标识
  SORA2_CHARACTERS = 'sora2-characters',
}

export interface SoraModelOption {
  value: SoraModel;
  label: string;
  badge: string;
  desc: string;
}

export const MODEL_OPTIONS: SoraModelOption[] = [
  { value: SoraModel.SORA_V2, label: 'Sora 2.0 Pro', badge: 'Next-Gen', desc: '新一代高保真模型，支持复杂物理模拟' },
  { value: SoraModel.SORA2_PRO_LANDSCAPE, label: 'Sora 2 HD (16:9)', badge: '电影感', desc: '高清横屏，适合电影和横向叙事' },
  { value: SoraModel.SORA2_PRO_PORTRAIT, label: 'Sora 2 HD (9:16)', badge: '短视频', desc: '沉浸式竖屏，适配移动端社交媒体' },
  { value: SoraModel.SORA2_LANDSCAPE, label: 'Sora 2 Std (16:9)', badge: '快速', desc: '标准画质，生成速度极快' },
];

/**
 * Supported Volc Engine Models
 */
export enum VolcModel {
  PIXEL_DANCE_V1 = 'pixel_dance_v1',
}

export interface VolcModelOption {
  value: VolcModel;
  label: string;
  badge: string;
}

export const VOLC_MODEL_OPTIONS: VolcModelOption[] = [
  { value: VolcModel.PIXEL_DANCE_V1, label: 'Pixel Dance V1', badge: 'ByteDance' },
];

/**
 * Supported Image Generation Models
 */
export enum ImageModel {
  NANO_BANANA_2 = 'nano-banana-2',
  NANO_BANANA_PRO_4K = 'nano-banana-pro-4k',
}

export interface ImageModelOption {
  value: ImageModel;
  label: string;
  badge: string;
}

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { value: ImageModel.NANO_BANANA_2, label: 'Banana 2', badge: '标准' },
  { value: ImageModel.NANO_BANANA_PRO_4K, label: 'Banana Pro 4K', badge: '多图融合' },
];

/**
 * API Channel Configuration
 */
export interface Channel {
  id: string;
  name: string;
  baseUrl: string;
  apiToken: string;
}

export type TaskStatus = 'queued' | 'processing' | 'success' | 'failed';

/**
 * Volc Engine Settings
 */
export interface VolcSettings {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

/**
 * Script & Storyboard Types
 */
export type ScriptLineType = 'empty' | 'scene' | 'character' | 'parenthetical' | 'dialogue' | 'transition' | 'action';

export interface ScriptLine {
  id: string;
  type: ScriptLineType;
  text: string;
}

export interface ScriptScene {
  id: string;
  number: number;
  header: string;
  lineIndex: number;
  logline: string;
  sentiment: number;
  pacing?: string;
}

export interface ScriptCharacter {
  id: string;
  name: string;
  dialogueCount: number;
  color: string;
  motivation: string;
  tags: string[];
  bio: string;
}

export interface LogicIssue {
  scene_refs: number[];
  issue_description: string;
  severity: 'High' | 'Medium' | 'Low';
}

export interface StoryboardCharacter {
  id: string;
  name: string;
  visualDescription: string;
  status?: TaskStatus;
  referenceImageId?: string;
  referenceImageUrl?: string;
}

export interface StoryboardProp {
  id: string;
  name: string;
  visualDescription: string;
  status: TaskStatus;
  referenceImageId?: string;
  referenceImageUrl?: string;
}

export interface StoryboardSceneVisual {
  id: string;
  name: string;
  visualDescription: string;
  status: TaskStatus;
  referenceImageId?: string;
  referenceImageUrl?: string;
}

export interface StoryboardShot {
  id: string;
  text: string;
  promptPreFill: string;
  characterIds: string[];
  characterRefs: string[];
  constructedPrompt: string;
  customFullPrompt?: string;
  sceneVisualIds?: string[];
  propIds?: string[];
}

export interface StoryboardScene {
  id: string;
  number: number;
  header: string;
  atmosphere: string;
  shots: StoryboardShot[];
}

export interface StoryboardData {
  characters: StoryboardCharacter[];
  sceneVisuals: StoryboardSceneVisual[];
  props: StoryboardProp[];
  scenes: StoryboardScene[];
  lastUpdated: number;
  globalStyle: string;
}

export interface ScriptProject {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'short';
  lastModified: number;
  content: string;
  genre?: string[];
  logline?: string;
  synopsis?: string;
  scenes?: ScriptScene[];
  logicIssues?: LogicIssue[];
  storyboard?: StoryboardData;
}

export interface VideoTask {
  id: string; 
  apiId?: string; 
  prompt: string;
  model: SoraModel | VolcModel;
  status: TaskStatus;
  progress: number; 
  videoUrl?: string;
  coverUrl?: string;
  errorMessage?: string;
  createdAt: number;
  channelId?: string; 
  motionIntensity?: number;
  cameraMovement?: string;
  // Added for character extraction compatibility
  isCharacterAsset?: boolean;
  characterName?: string;
}

export interface ImageTask {
  id: string; 
  apiId?: string; 
  prompt: string;
  model: ImageModel;
  status: TaskStatus;
  resultUrl?: string;
  resultUrls?: string[];
  errorMessage?: string;
  createdAt: number;
  channelId?: string;
  type: 'txt2img' | 'img2img';
  // Added for preview compatibility
  sourceImagePreview?: string;
}

export interface QueryTaskResponse {
  id: string;
  status: string; 
  progress?: string; 
  result_video_url?: string;
  cover_url?: string;
  fail_reason?: string;
}

export interface QueryImageResponse {
  id: string;
  status: string;
  result_url?: string;
  result_urls?: string[];
  fail_reason?: string;
}
