import { SoraModel, ApiResponse, CreateTaskResponse, QueryTaskResponse } from '../types';

/**
 * ARCHITECTURE NOTE:
 * This service acts as an Adapter Layer for various Sora API providers.
 */

// Robust ID Extraction Helper
const findTaskIdInResponse = (response: any): string | null => {
  if (!response) return null;
  if (typeof response === 'string' && (response.startsWith('char_') || response.startsWith('task_') || response.length > 10)) return response;
  
  if (response.id) return response.id;
  if (response.task_id) return response.task_id;
  if (response.data) {
    if (typeof response.data === 'string') return response.data;
    if (response.data.id) return response.data.id;
    if (response.data.task_id) return response.data.task_id;
    if (response.data.task && response.data.task.id) return response.data.task.id;
  }
  if (response.result) {
    if (typeof response.result === 'string') return response.result;
    if (typeof response.result === 'object' && response.result.id) return response.result.id;
  }

  // Deep scan
  const findId = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string' && (val.startsWith('char_') || val.startsWith('task_') || val.startsWith('v_'))) return val;
      if (typeof val === 'object' && val !== null) {
        const found = findId(val);
        if (found) return found;
      }
    }
    return null;
  };
  return findId(response);
};

const apiRequest = async <T>(
  endpoint: string,
  method: 'GET' | 'POST',
  token: string,
  body?: any
): Promise<T> => {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
  };

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers,
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
  };

  try {
    const response = await fetch(endpoint, config);
    const result = await response.json();
    
    if (!response.ok) {
        let errorMsg = response.statusText;
        if (result) {
            if (result.error && typeof result.error === 'object' && result.error.message) errorMsg = result.error.message;
            else if (result.message) errorMsg = result.message;
            else if (result.msg) errorMsg = result.msg;
        }
        throw new Error(`API Error (${response.status}): ${errorMsg}`);
    }
    return result as T;
  } catch (error: any) {
    throw new Error(error.message || 'Network request failed');
  }
};

const getEndpoint = (baseUrl: string, path: string) => {
    const cleanBase = baseUrl.replace(/\/$/, '');
    return `${cleanBase}${path}`;
};

/**
 * Creates a standard video generation task (Text-to-Video).
 */
export const createVideoTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: SoraModel,
  options?: {
    characterSourceId?: string;
    timestamps?: string;
  }
): Promise<string> => {
  let payload: any = { prompt, model };
  if (model === SoraModel.SORA2_CHARACTERS && options?.characterSourceId && options?.timestamps) {
    payload = {
      character: options.characterSourceId,
      prompt: "角色创建",
      model: SoraModel.SORA2_CHARACTERS,
      timestamps: options.timestamps
    };
  }

  const url = getEndpoint(baseUrl, '/v1/videos');
  const response = await apiRequest<any>(url, 'POST', token, payload);
  const taskId = findTaskIdInResponse(response);
  if (!taskId) throw new Error("Failed to retrieve Task ID");
  return taskId;
};

/**
 * Creates an Image-to-Video (I2V) task.
 */
export const createVideoI2VTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: SoraModel,
  imageFile: File
): Promise<string> => {
  const url = getEndpoint(baseUrl, '/v1/videos');
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('model', model);
  formData.append('input_reference', imageFile);

  const response = await apiRequest<any>(url, 'POST', token, formData);
  const taskId = findTaskIdInResponse(response);
  if (!taskId) throw new Error("Failed to retrieve Task ID");
  return taskId;
};

/**
 * Queries the status of a video task.
 */
export const queryVideoTask = async (
  baseUrl: string,
  token: string,
  apiId: string
): Promise<QueryTaskResponse> => {
  const url = getEndpoint(baseUrl, `/v1/videos/${apiId}`);
  const response = await apiRequest<any>(url, 'GET', token);
  let data: any = response;
  if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) data = response.data;
  else if (response.task && typeof response.task === 'object') data = response.task;

  let failReason = data.fail_reason || data.error || data.error_message || data.reason || data.msg;
  if (typeof failReason === 'object' && failReason !== null) failReason = failReason.message || failReason.msg;

  return {
    id: data.id || data.task_id || apiId,
    status: data.status || data.state || data.task_status || 'unknown',
    progress: data.progress,
    result_video_url: data.result_video_url || data.video_url || data.url || data.video || data.file_url,
    cover_url: data.cover_url || data.cover || data.image_url || data.thumbnail_url || data.thumbnail,
    fail_reason: failReason
  } as QueryTaskResponse;
};