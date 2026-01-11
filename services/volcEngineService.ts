

import { VolcSettings, VolcModel, QueryTaskResponse } from '../types';

/**
 * VolcEngine Service (Text Intelligence & Video Generation)
 * Handles interactions with Volc Engine Ark (方舟) API.
 * Endpoint: https://ark.cn-beijing.volces.com/api/v3/chat/completions
 */

const VOLC_API_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

/**
 * Calls the Volc Engine Chat Completion API.
 */
export const callVolcChatApi = async (
  settings: VolcSettings,
  systemPrompt: string,
  userPrompt: string
): Promise<string> => {
  
  if (!settings.apiKey || !settings.model) {
    throw new Error('Volc Engine API Key or Model is missing. Please configure in Settings.');
  }

  const requestBody = {
    model: settings.model,
    messages: [
        {
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: userPrompt
        }
    ],
    max_tokens: settings.maxTokens || 4096, // Increased for analysis
    stream: false,
    temperature: 0.7
  };

  try {
    const response = await fetch(VOLC_API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Volc API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
    } else {
        throw new Error('Unexpected API response format');
    }
  } catch (error: any) {
    console.error('Volc Engine Call Failed:', error);
    throw new Error(error.message || 'Failed to connect to Volc Engine');
  }
};

// --- Helper Functions for Video API ---

const getEndpoint = (baseUrl: string, path: string) => {
    const cleanBase = baseUrl.replace(/\/$/, '');
    return `${cleanBase}${path}`;
};

const apiRequest = async <T>(
  endpoint: string,
  method: 'GET' | 'POST',
  token: string,
  body?: any
): Promise<T> => {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  try {
    const response = await fetch(endpoint, config);
    const result = await response.json();
    
    if (!response.ok) {
        let errorMsg = response.statusText;
        if (result && result.message) errorMsg = result.message;
        else if (result && result.msg) errorMsg = result.msg;
        throw new Error(`API Error (${response.status}): ${errorMsg}`);
    }
    
    return result as T;
  } catch (error: any) {
    throw new Error(error.message || 'Network request failed');
  }
};

/**
 * Creates a video generation task on Volc Engine (via Relay).
 */
export const createVolcTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: VolcModel
): Promise<string> => {
  const url = getEndpoint(baseUrl, '/v1/videos'); 
  const response = await apiRequest<any>(url, 'POST', token, { prompt, model });
  
  if (response.id) return response.id;
  if (response.data && response.data.id) return response.data.id;
  if (typeof response === 'string') return response;
  
  // Fallback scan
  if (response.task_id) return response.task_id;
  
  throw new Error(`Failed to retrieve Volc Task ID: ${JSON.stringify(response)}`);
};

/**
 * Queries the status of a Volc video task.
 */
export const queryVolcTask = async (
  baseUrl: string,
  token: string,
  apiId: string
): Promise<QueryTaskResponse> => {
  const url = getEndpoint(baseUrl, `/v1/videos/${apiId}`);
  const response = await apiRequest<any>(url, 'GET', token);
  
  let data = response;
  if (response.data && !Array.isArray(response.data)) data = response.data;
  else if (response.task) data = response.task;

  return {
    id: data.id || apiId,
    status: data.status || data.state || 'unknown',
    progress: data.progress,
    result_video_url: data.result_video_url || data.video_url || data.url,
    cover_url: data.cover_url || data.cover || data.image_url,
    fail_reason: data.fail_reason || data.error || data.reason
  } as QueryTaskResponse;
};

// --- Preset Prompts for Script Copilot & Deep Analysis ---

export const PROMPTS = {
    EXPAND: "You are a professional screenwriter. Expand the following scene or dialogue, adding more sensory details, character depth, and atmospheric description without changing the core plot.",
    SHORTEN: "You are a professional editor. Condense the following text to be more punchy and concise, removing redundant dialogue and action lines while keeping the essential meaning.",
    FORMAT: "You are a script formatter. Fix the following text to adhere to standard screenplay format (Fountain syntax). Ensure Scene Headers are uppercase INT./EXT., Character names are uppercase, and dialogue is properly separated.",
    
    // Stage 1: Macro
    ANALYSIS_STAGE_1: `Role: Film Planner.
Task: Analyze script.
Output JSON ONLY:
{
  "title": "Title",
  "genre": ["Genre"],
  "logline": "Summary",
  "synopsis": "Outline"
}`,

    // Stage 2: Structure & Visuals
    ANALYSIS_STAGE_2: `Role: Director.
Task: Breakdown script.
Output JSON ONLY:
{
  "characters": [
    { "name": "Name", "bio": "Bio", "tags": ["Trait"] }
  ],
  "environment_visuals": [
    { "name": "Loc", "description": "Visuals" }
  ],
  "props": [
    { "name": "Item", "description": "Visuals" }
  ],
  "scenes": [
    {
      "scene_id": 1,
      "header": "INT. LOC",
      "summary": "Summary",
      "characters_present": ["Name"],
      "visual_prompt": "Prompt"
    }
  ]
}`,

    // Stage 3: Deep QC
    ANALYSIS_STAGE_3: `Role: Analyst.
Task: Analyze script.
Output JSON ONLY:
{
  "analytics": [
    { "scene_id": 1, "emotion_score": 0.5, "pacing": "Normal" }
  ],
  "logic_issues": [
    { "scene_ref": [1], "issue_description": "Issue", "severity": "Medium" }
  ]
}`
};
