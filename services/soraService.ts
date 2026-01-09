import { SoraModel, ApiResponse, CreateTaskResponse, QueryTaskResponse } from '../types';

// Helper to simulate axios behavior using fetch
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
    // Note: Some APIs return 200 even for logical errors, so we parse JSON first
    const result = await response.json();
    
    if (!response.ok) {
        let errorMsg = response.statusText;
        
        if (result) {
            // Priority 1: Nested error object with message (Common in standard APIs)
            if (result.error && typeof result.error === 'object' && result.error.message) {
                errorMsg = result.error.message;
            } 
            // Priority 2: Direct message fields
            else if (result.message) {
                errorMsg = result.message;
            }
            else if (result.msg) {
                errorMsg = result.msg;
            }
            // Priority 3: Error field is a string
            else if (result.error && typeof result.error === 'string') {
                errorMsg = result.error;
            }
            // Fallback: Dump the object if it's not too large, otherwise default to status text
            else {
                errorMsg = JSON.stringify(result);
            }
        }
        
        throw new Error(`API Error (${response.status}): ${errorMsg}`);
    }
    
    return result as T;
  } catch (error: any) {
    throw new Error(error.message || 'Network request failed');
  }
};

const getEndpoint = (baseUrl: string, path: string) => {
    // Remove trailing slash from baseUrl if present
    const cleanBase = baseUrl.replace(/\/$/, '');
    return `${cleanBase}${path}`;
};

export const createVideoTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: SoraModel,
  options?: {
    characterSourceId?: string; // The video ID to generate character from
    timestamps?: string;        // "start,end" string
  }
): Promise<string> => {
  
  let payload: any = { prompt, model };

  // Logic for Character Creation specific payload
  if (model === SoraModel.SORA2_CHARACTERS && options?.characterSourceId && options?.timestamps) {
    payload = {
      character: options.characterSourceId, // The source video ID
      prompt: "角色创建",                  // Fixed prompt required by API
      model: SoraModel.SORA2_CHARACTERS,
      timestamps: options.timestamps
    };
  }

  // Using 'any' here to inspect the raw response structure because it varies
  const url = getEndpoint(baseUrl, '/v1/videos');
  const response = await apiRequest<any>(
    url,
    'POST',
    token,
    payload
  );

  console.log('Create Task Raw Response:', response);

  // Robust ID Extraction Strategy
  
  // 1. Direct String Match (if response is just the ID or data is the ID)
  if (typeof response === 'string' && response.startsWith('char_')) return response;
  if (response.data && typeof response.data === 'string' && response.data.startsWith('char_')) return response.data;

  // 2. Standard Property Access
  if (response.id) return response.id;
  if (response.task_id) return response.task_id;
  
  // 3. Nested Data Object Access
  if (response.data && typeof response.data === 'object') {
    if (response.data.id) return response.data.id;
    if (response.data.task_id) return response.data.task_id;
    // Some APIs put the ID in 'task' object
    if (response.data.task && response.data.task.id) return response.data.task.id;
  }

  // 4. 'Result' Property Access (Common in some frameworks)
  if (response.result) {
      if (typeof response.result === 'string') return response.result;
      if (typeof response.result === 'object' && response.result.id) return response.result.id;
  }

  // 5. Deep Scan for 'char_' string if all else fails (Last Resort)
  const findCharId = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    
    // Check immediate keys first
    if (obj.id && typeof obj.id === 'string' && obj.id.startsWith('char_')) return obj.id;
    if (obj.task_id && typeof obj.task_id === 'string' && obj.task_id.startsWith('char_')) return obj.task_id;

    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'string' && val.startsWith('char_')) return val;
        if (typeof val === 'object' && val !== null) {
            const found = findCharId(val);
            if (found) return found;
        }
    }
    return null;
  };

  const deepFoundId = findCharId(response);
  if (deepFoundId) return deepFoundId;

  throw new Error(`Failed to retrieve Task ID from response. Raw: ${JSON.stringify(response)}`);
};

export const queryVideoTask = async (
  baseUrl: string,
  token: string,
  apiId: string
): Promise<QueryTaskResponse> => {
  const url = getEndpoint(baseUrl, `/v1/videos/${apiId}`);
  const response = await apiRequest<any>(
    url,
    'GET',
    token
  );

  // Normalize the response structure
  let data: any = response;

  // If the useful data is nested in 'data' or 'task'
  if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    data = response.data;
  } else if (response.task && typeof response.task === 'object') {
    data = response.task;
  }

  let failReason = data.fail_reason || data.error || data.error_message || data.reason || data.msg;
  // Ensure failReason is a string, as APIs sometimes return objects like { message: "..." }
  if (typeof failReason === 'object' && failReason !== null) {
      failReason = failReason.message || failReason.msg || JSON.stringify(failReason);
  }

  // Normalize fields to the standard QueryTaskResponse interface
  // checking all common variations found in these APIs
  return {
    id: data.id || data.task_id || apiId,
    status: data.status || data.state || data.task_status || 'unknown',
    progress: data.progress, // might be string "50%" or number
    // Aggressively search for the video URL
    result_video_url: data.result_video_url || data.video_url || data.url || data.video || data.file_url,
    // Aggressively search for the cover URL
    cover_url: data.cover_url || data.cover || data.image_url || data.thumbnail_url || data.thumbnail,
    fail_reason: failReason
  } as QueryTaskResponse;
};