
import { ImageModel, QueryImageResponse } from '../types';

/**
 * Image Generation Service
 * Optimized for Nano Banana 2 and robust result parsing.
 */

const getEndpoint = (baseUrl: string, path: string) => {
    const cleanBase = baseUrl.replace(/\/$/, '');
    return `${cleanBase}${path}`;
};

/**
 * Normalizes image strings. Adds Base64 prefix if missing.
 */
const normalizeImageUrl = (url: string): string => {
    if (!url) return '';
    // If it's a long string without protocol, assume it's base64
    if (url.length > 500 && !url.startsWith('http') && !url.startsWith('data:')) {
        return `data:image/png;base64,${url}`;
    }
    return url;
};

/**
 * Robust ID Extraction
 */
const findTaskId = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.id && typeof obj.id === 'string') return obj.id;
    if (obj.task_id && typeof obj.task_id === 'string') return obj.task_id;
    if (obj.data && typeof obj.data === 'string' && obj.data.length > 5) return obj.data;
    return null;
};

/**
 * Deep scan for image URLs or Base64 data in API response
 */
const collectImageUrls = (obj: any): string[] => {
    let urls: string[] = [];
    if (!obj) return urls;

    // Check common locations
    if (typeof obj === 'string' && (obj.startsWith('http') || obj.length > 500)) {
        urls.push(normalizeImageUrl(obj));
    } else if (Array.isArray(obj)) {
        obj.forEach(item => {
            urls = [...urls, ...collectImageUrls(item)];
        });
    } else if (typeof obj === 'object') {
        // Specific fields to check
        const fields = ['url', 'result_url', 'image', 'b64_json', 'content'];
        for (const field of fields) {
            if (obj[field]) {
                urls = [...urls, ...collectImageUrls(obj[field])];
            }
        }
        // Recursively check other objects but avoid too deep recursion
        for (const key in obj) {
            if (!fields.includes(key) && typeof obj[key] === 'object') {
                urls = [...urls, ...collectImageUrls(obj[key])];
            }
        }
    }
    return [...new Set(urls)].filter(u => u.length > 10);
};

export const createImageGenerationTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: ImageModel,
  options?: {
    size?: string;
    resolution?: string;
    n?: number;
  }
): Promise<string> => {
  const url = getEndpoint(baseUrl, '/v1/images/generations?async=true');
  const payload = {
      model,
      prompt,
      n: options?.n || 1,
      size: options?.size || "1:1",
      response_format: "url",
      image_size: options?.resolution || "1K"
  };

  const response = await fetch(url, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'API Error');
  const taskId = findTaskId(result);
  if (!taskId) throw new Error("No Task ID found");
  return taskId;
};

export const createImageEditTask = async (
  baseUrl: string,
  token: string,
  prompt: string,
  model: ImageModel,
  imageFile: File,
  options?: {
    aspect_ratio?: string; 
    image_size?: string;   
  }
): Promise<string> => {
  const url = getEndpoint(baseUrl, '/v1/images/edits?async=true');
  const formData = new FormData();
  formData.append('model', model);
  formData.append('prompt', prompt);
  formData.append('image', imageFile);
  formData.append('response_format', 'url');
  if (options?.aspect_ratio) formData.append('aspect_ratio', options.aspect_ratio);
  if (options?.image_size) formData.append('image_size', options.image_size);

  const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Edit failed');
  const taskId = findTaskId(result);
  if (!taskId) throw new Error("No Task ID found");
  return taskId;
};

export const queryImageTask = async (
    baseUrl: string,
    token: string,
    taskId: string
): Promise<QueryImageResponse> => {
    const url = getEndpoint(baseUrl, `/v1/images/tasks/${taskId}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (!response.ok) throw new Error(`Query failed: ${result.message}`);

        // Handle inconsistent nesting
        const data = result.data || result.task || result;
        const statusRaw = (data.status || data.state || 'unknown').toLowerCase();
        
        // Use deep scanning to find all images
        const allUrls = collectImageUrls(data);

        return {
            id: taskId,
            status: allUrls.length > 0 ? 'success' : statusRaw,
            result_url: allUrls[0],
            result_urls: allUrls,
            fail_reason: data.fail_reason || data.error
        };
    } catch (error: any) {
        throw new Error(error.message || 'Query error');
    }
};

/**
 * Conversion helper
 */
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * 调用 nano-banana-pro-4k 模型，支持多图融合，返回 4 张 4K 图片 URL 或 base64
 */
export const createNanoBananaPro4KTask = async (
  baseUrl: string,
  apiToken: string,
  prompt: string,
  files: File[]
): Promise<string[]> => {
  const imageParts = await Promise.all(
    files.map(async (file) => ({
      type: "image_url" as const,
      image_url: { url: await fileToDataURL(file) }
    }))
  );

  const content = [
    { type: "text" as const, text: prompt },
    ...imageParts
  ];

  const payload = {
    model: "nano-banana-pro-4k",
    messages: [{ role: "user" as const, content }],
    max_tokens: 2000 
  };

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBase.endsWith('/v1')
    ? `${cleanBase}/chat/completions`
    : `${cleanBase}/v1/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const contentText = result?.choices?.[0]?.message?.content;

  if (!contentText) {
    throw new Error("API returned no content.");
  }

  // Support multiple formats: lines, JSON array, Markdown images
  const lines = contentText.trim().split('\n').filter((line: string) => line.trim());
  if (lines.length >= 4) {
    return lines.slice(0, 4).map((l: string) => normalizeImageUrl(l.trim()));
  }

  try {
    const parsed = JSON.parse(contentText);
    if (Array.isArray(parsed) && parsed.length >= 4) {
      return parsed.slice(0, 4).map(normalizeImageUrl);
    }
  } catch (e) {}

  const markdownRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const matches = [...contentText.matchAll(markdownRegex)].map(m => m[1]);
  if (matches.length >= 4) {
    return matches.slice(0, 4).map(normalizeImageUrl);
  }

  // One more attempt at finding long base64 strings or URLs if they aren't explicitly split
  const urls = collectImageUrls({ content: contentText });
  if (urls.length >= 4) return urls.slice(0, 4);

  throw new Error("无法解析 API 返回的 4 张图片，请检查响应格式。");
};
