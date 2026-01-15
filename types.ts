
// 🛑 DO NOT MODIFY EXISTING ENUM VALUES OR INTERFACE STRUCTURES

/**
 * Supported Sora Models (Expanded for specific duration and quality)
 */
export enum SoraModel {
  SORA2_LANDSCAPE = 'sora2-landscape', 
  SORA2_PORTRAIT = 'sora2-portrait', 
  SORA2_LANDSCAPE_15S = 'sora2-landscape-15s',
  SORA2_PORTRAIT_15S = 'sora2-portrait-15s',
  SORA2_PRO_LANDSCAPE_HD_15S = 'sora2-pro-landscape-hd-15s',
  SORA2_PRO_PORTRAIT_HD_15S = 'sora2-pro-portrait-hd-15s',
  SORA2_PRO_LANDSCAPE_25S = 'sora2-pro-landscape-25s',
  SORA2_PRO_PORTRAIT_25S = 'sora2-pro-portrait-25s',
  SORA_V2 = 'sora-2', // 通用
}

/**
 * Image Models
 */
export enum ImageModel {
  NANO_BANANA_2 = 'nano-banana-2',
  NANO_BANANA_PRO = 'gemini-3-pro-image-preview',
  NANO_BANANA_PRO_CHAT = 'nano-banana-pro',
}

export interface ImageModelOption {
  value: ImageModel;
  label: string;
  badge: string;
  maxRefs: number;
}

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { value: ImageModel.NANO_BANANA_2, label: 'Banana 2', badge: 'Standard', maxRefs: 1 },
  { value: ImageModel.NANO_BANANA_PRO, label: 'Gemini 3 Pro', badge: '14-Refs', maxRefs: 14 },
  { value: ImageModel.NANO_BANANA_PRO_CHAT, label: 'Nano Banana Pro', badge: 'Chat', maxRefs: 14 },
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

export interface VideoTask {
  id: string; 
  apiId?: string; 
  prompt: string;
  model: string; // Use string for dynamic mapping
  status: TaskStatus;
  progress: number; 
  videoUrl?: string;
  coverUrl?: string;
  errorMessage?: string;
  createdAt: number;
  channelId?: string; 
  // Added missing properties for TaskCard component
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
  coverIndex?: number; // 用户选择的展示封面索引
  errorMessage?: string;
  createdAt: number;
  channelId?: string;
  type: 'txt2img' | 'img2img';
  sourceImagePreview?: string;
  category?: 'character' | 'scene' | 'product' | 'other';
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

export interface VolcSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
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
  // Added missing analysis and structural properties
  scenes?: ScriptScene[];
  logicIssues?: LogicIssue[];
  storyboard?: StoryboardData;
}

/**
 * Volc Engine Specific Models
 */
export enum VolcModel {
  PIXEL_DANCE_V1 = 'pixel-dance-v1',
  PIXEL_DANCE_V2 = 'pixel-dance-v2',
}

export const VOLC_MODEL_OPTIONS = [
  { value: VolcModel.PIXEL_DANCE_V1, label: 'Pixel Dance V1' },
  { value: VolcModel.PIXEL_DANCE_V2, label: 'Pixel Dance V2' },
];

/**
 * Script Parsing and Analysis Types
 */
export type ScriptLineType = 'scene' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'action' | 'empty';

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
  scene_refs?: (number | string)[];
  issue_description: string;
  severity: 'High' | 'Medium' | 'Low';
}

/**
 * Storyboard and Visual Asset Types
 */
export interface StoryboardCharacter {
  id: string;
  name: string;
  visualDescription: string;
  status?: 'queued' | 'processing' | 'success' | 'failed';
  referenceImageId?: string;
  referenceImageUrl?: string;
}

export interface StoryboardProp {
  id: string;
  name: string;
  visualDescription: string;
  status?: 'queued' | 'processing' | 'success' | 'failed';
  referenceImageId?: string;
  referenceImageUrl?: string;
}

export interface StoryboardSceneVisual {
  id: string;
  name: string;
  visualDescription: string;
  status?: 'queued' | 'processing' | 'success' | 'failed';
  referenceImageId?: string;
  referenceImageUrl?: string;
}

// AI Analysis Result for a Shot
export interface RecommendedAngle {
  name: string; // "Wide Shot", "Medium Shot", "Close Up", "Dynamic"
  prompt_modifier: string;
  reason: string;
}

export interface ShotAnalysis {
  narrative_description: string;
  emotion_keywords: string[];
  lighting_suggestion: string;
  recommended_angles: RecommendedAngle[]; // Fixed to exactly 4 in service logic
}

// A variation (Fission) of a shot
export interface ShotVariation {
  id: string;
  type: 'initial' | 'variation';
  angleName: string; // "Wide", "Close-up" etc.
  prompt: string;
  status: TaskStatus;
  imageUrl?: string;
  videoTaskId?: string; // If upgraded to video
  videoUrl?: string;
  apiTaskId?: string; // For polling
}

export interface StoryboardShot {
  id: string;
  text: string;
  promptPreFill?: string;
  constructedPrompt?: string;
  customFullPrompt?: string;
  characterIds?: string[];
  characterRefs?: string[];
  sceneVisualIds?: string[];
  propIds?: string[];
  
  // Phase 2 Director Console Extensions
  analysis?: ShotAnalysis;
  variations?: ShotVariation[]; // Stores the images (Initial + Fissions)
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