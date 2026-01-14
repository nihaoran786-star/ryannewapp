
import { SoraModel, QueryTaskResponse } from '../types';

/**
 * Sora 2.0 Service Adapter
 * 根据用户提供的 Axios 示例优化
 */

const findTaskIdInResponse = (response: any): string | null => {
  if (!response) return null;
  if (response.id) return response.id;
  if (response.task_id) return response.task_id;
  if (response.data?.id) return response.data.id;
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
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.message || result.error || 'API Request Failed');
  }
  return result as T;
};

export const createVideoTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: SoraModel,
  options?: {
    motion_intensity?: number;
    camera_movement?: string;
  }
): Promise<string> => {
  // 构建与 Sora 2 接口一致的 JSON 负载
  const payload = { 
    prompt, 
    model,
    // 如果 API 支持，传递额外的 Sora 2 控制参数
    options: {
      motion_intensity: options?.motion_intensity || 5,
      camera_movement: options?.camera_movement || 'static'
    }
  };

  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/videos`;
  const response = await apiRequest<any>(endpoint, 'POST', token, payload);
  const taskId = findTaskIdInResponse(response);
  if (!taskId) throw new Error("API 未返回有效的任务 ID");
  return taskId;
};

export const createVideoI2VTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: SoraModel,
  imageFile: File
): Promise<string> => {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/videos`;
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('model', model);
  formData.append('input_reference', imageFile);

  const response = await apiRequest<any>(endpoint, 'POST', token, formData);
  const taskId = findTaskIdInResponse(response);
  if (!taskId) throw new Error("API 未返回有效的任务 ID");
  return taskId;
};

export const queryVideoTask = async (
  baseUrl: string,
  token: string,
  apiId: string
): Promise<QueryTaskResponse> => {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/videos/${apiId}`;
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
