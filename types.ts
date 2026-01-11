

// 🛑 DO NOT MODIFY EXISTING ENUM VALUES OR INTERFACE STRUCTURES - SEE ARCHITECTURE GUIDE
/**
 * Supported Sora Models
 */
export enum SoraModel {
  SORA2_LANDSCAPE = 'sora2-landscape', 
  SORA2_PORTRAIT = 'sora2-portrait', 
  SORA2_LANDSCAPE_15S = 'sora2-landscape-15s',
  SORA2_PORTRAIT_15S = 'sora2-portrait-15s',
  SORA2_PRO_LANDSCAPE_25S = 'sora2-pro-landscape-25s',
  SORA2_PRO_PORTRAIT_25S = 'sora2-pro-portrait-25s',
  SORA2_PRO_LANDSCAPE_HD_15S = 'sora2-pro-landscape-hd-15s',
  SORA2_PRO_PORTRAIT_HD_15S = 'sora2-pro-portrait-hd-15s',
  SORA2_CHARACTERS = 'sora2-characters',
}

export interface SoraModelOption {
  value: SoraModel;
  label: string;
  badge: string;
}

export const MODEL_OPTIONS: SoraModelOption[] = [
  { value: SoraModel.SORA2_LANDSCAPE, label: '横屏 (10秒)', badge: '快速' },
  { value: SoraModel.SORA2_PORTRAIT, label: '竖屏 (10秒)', badge: '移动端' },
  { value: SoraModel.SORA2_LANDSCAPE_15S, label: '横屏 (15秒)', badge: '标准' },
  { value: SoraModel.SORA2_PORTRAIT_15S, label: '竖屏 (15秒)', badge: '移动端' },
  { value: SoraModel.SORA2_PRO_LANDSCAPE_25S, label: '横屏 Pro (25秒)', badge: '长视频' },
  { value: SoraModel.SORA2_PRO_PORTRAIT_25S, label: '竖屏 Pro (25秒)', badge: '长视频' },
  { value: SoraModel.SORA2_PRO_LANDSCAPE_HD_15S, label: '横屏 Pro HD (15秒)', badge: '高清' },
  { value: SoraModel.SORA2_PRO_PORTRAIT_HD_15S, label: '竖屏 Pro HD (15秒)', badge: '高清' },
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
}

export interface ImageModelOption {
  value: ImageModel;
  label: string;
  badge: string;
}

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { value: ImageModel.NANO_BANANA_2, label: 'Banana 2', badge: '最新' },
];

/**
 * Volc Engine Configuration
 */
export interface VolcSettings {
  apiKey: string;
  model: string; 
  maxTokens: number;
}

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
  characterName?: string; 
  isCharacterAsset?: boolean; 
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
  sourceImagePreview?: string; 
}

export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface CreateTaskResponse {
  id: string; 
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

// --- ScriptMinds Types ---
export interface ScriptProject {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'short';
  lastModified: number;
  content: string; 
  scenes?: ScriptScene[]; 
  characters?: ScriptCharacter[]; 
  
  // V3.1 Analysis Metadata
  synopsis?: string;
  genre?: string[];
  logline?: string;
  logicIssues?: LogicIssue[];

  // V3.0 Storyboard Data
  storyboard?: StoryboardData;
}

export interface LogicIssue {
  scene_refs: number[];
  issue_description: string;
  severity: 'Low' | 'Medium' | 'High';
}

export interface StoryboardData {
  characters: StoryboardCharacter[];
  // V3.2 New Assets
  sceneVisuals?: StoryboardSceneVisual[];
  props?: StoryboardProp[];
  
  scenes: StoryboardScene[];
  lastUpdated: number;
  globalStyle?: string; 
}

export interface StoryboardCharacter {
  id: string;
  name: string;
  visualDescription: string;
  referenceImageId?: string; 
  referenceImageUrl?: string;
  status?: TaskStatus;
}

// Environment/Location Visuals (Distinct from Script Scenes)
export interface StoryboardSceneVisual {
  id: string;
  name: string; // e.g., "Main Bedroom", "Coffee Shop Interior"
  visualDescription: string;
  referenceImageId?: string;
  referenceImageUrl?: string;
  status?: TaskStatus;
}

// Product/Prop Visuals
export interface StoryboardProp {
  id: string;
  name: string; // e.g., "The Magical Sword", "Coke Can"
  visualDescription: string;
  referenceImageId?: string;
  referenceImageUrl?: string;
  status?: TaskStatus;
}

export interface StoryboardScene {
  id: string;
  number: number;
  header: string;
  atmosphere: string;
  shots: StoryboardShot[];
}

export interface StoryboardShot {
  id: string;
  text: string;
  promptPreFill: string;
  imageId?: string; 
  imageUrl?: string;
  status?: TaskStatus;
  
  // Reference IDs for Director Console
  // Legacy fields kept for compatibility, prefer new fields below
  characterIds: string[];
  sceneVisualIds?: string[];
  propIds?: string[];
  
  // V3.3 Engineering Update: Strict Refs
  constructedPrompt?: string; // User-editable full prompt override
  characterRefs: string[];    // Array of Character IDs
  sceneRef?: string;          // Single Scene Visual ID
  productRef?: string;        // Single Prop ID
  
  // Legacy alias (Deprecated)
  customFullPrompt?: string; 
}

export interface ScriptScene {
  id: string;
  number: number;
  header: string;
  logline: string; 
  sentiment: number; 
  lineIndex: number; 
  
  // V3.1 New Fields
  pacing?: 'Fast' | 'Normal' | 'Slow';
}

export interface ScriptCharacter {
  id: string;
  name: string;
  motivation: string;
  tags: string[];
  dialogueCount: number;
  bio: string;
  color: string;
}

export type ScriptLineType = 'scene' | 'character' | 'dialogue' | 'parenthetical' | 'action' | 'transition' | 'empty';

export interface ScriptLine {
  id: string;
  type: ScriptLineType;
  text: string;
  characterId?: string;
}