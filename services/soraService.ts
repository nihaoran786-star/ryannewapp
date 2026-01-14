
import { SoraModel, QueryTaskResponse } from '../types';

/**
 * Sora 2.0 Service Adapter
 */

const findTaskIdInResponse = (response: any): string | null => {
  if (!response) return null;
  if (response.id) return response.id;
  if (response.task_id) return response.task_id;
  if (response.data?.id) return response.data.id;
  if (typeof response === 'string' && response.length > 5 && !response.startsWith('{')) return response;
  return null;
};

const apiRequest = async <T>(
  endpoint: string,
  method: 'GET' | 'POST',
  token: string,
  body?: any
): Promise<T> => {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers,
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
  };

  const response = await fetch(endpoint, config);
  let result;
  
  try {
    result = await response.json();
  } catch (e) {
    if (!response.ok) throw new Error(`API Error (${response.status}): ${response.statusText}`);
    throw new Error('Invalid JSON response from server');
  }
  
  if (result && typeof result === 'object') {
      if (result.code && result.message && ![0, 200, 'success'].includes(result.code)) {
          throw new Error(result.message);
      }
      if (result.error && typeof result.error === 'object' && result.error.message) {
          throw new Error(result.error.message);
      }
  }
  
  if (!response.ok) {
    throw new Error(result?.message || result?.error || `API Request Failed: ${response.status}`);
  }
  
  return result as T;
};

export const createVideoTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: SoraModel,
  options?: {
    aspectRatio?: string;
  }
): Promise<string> => {
  // Defensive check: Ensure model is defined string, fallback to base if not
  const safeModel = model || SoraModel.SORA_V2;
  
  // Safety check for includes method to prevent Uncaught TypeError
  const modelStr = String(safeModel);
  const isPro = modelStr.includes && modelStr.includes('pro');
  const resolution = isPro ? '1080p' : '720p';
  
  // 强制限定比例，防止 UI 传递非法值
  let ratio = options?.aspectRatio || '16:9';
  if (!['16:9', '9:16'].includes(ratio)) {
    ratio = modelStr.includes && modelStr.includes('portrait') ? '9:16' : '16:9';
  }

  const payload = { 
    prompt, 
    model: "sora-2", // API always expects base model name, specific behavior governed by params
    aspect_ratio: ratio,
    resolution: resolution
  };

  const endpoint = `${baseUrl.trim().replace(/\/$/, '')}/v1/videos`;
  console.log("🚀 [Sora Video Task Initiated]", { endpoint, payload });
  
  const response = await apiRequest<any>(endpoint, 'POST', token, payload);
  const taskId = findTaskIdInResponse(response);
  
  if (!taskId) throw new Error("API 返回成功但未包含任务 ID。");
  return taskId;
};

export const createVideoI2VTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: SoraModel,
  imageFile: File
): Promise<string> => {
  const endpoint = `${baseUrl.trim().replace(/\/$/, '')}/v1/videos`;
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('model', "sora-2");
  formData.append('input_reference', imageFile);

  const response = await apiRequest<any>(endpoint, 'POST', token, formData);
  const taskId = findTaskIdInResponse(response);
  if (!taskId) throw new Error("I2V API 返回成功但未包含任务 ID。");
  return taskId;
};

export const queryVideoTask = async (
  baseUrl: string,
  token: string,
  apiId: string
): Promise<QueryTaskResponse> => {
  const endpoint = `${baseUrl.trim().replace(/\/$/, '')}/v1/videos/${apiId}`;
  const data = await apiRequest<any>(endpoint, 'GET', token);
  const apiData = data.data || data.task || data;

  return {
    id: apiData.id || apiId,
    status: apiData.status || apiData.state || 'unknown',
    progress: apiData.progress,
    result_video_url: apiData.result_video_url || apiData.video_url || apiData.url,
    cover_url: apiData.cover_url || apiData.cover || apiData.thumbnail,
    fail_reason: apiData.fail_reason || apiData.error
  };
};
