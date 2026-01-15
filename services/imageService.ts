
import { ImageModel, QueryImageResponse } from '../types';

/**
 * Image Generation Service
 */

const getEndpoint = (baseUrl: string, path: string) => {
    const base = baseUrl.trim().replace(/\/+$/, '');
    const p = path.trim().replace(/^\/+/, '');
    
    // 如果 baseUrl 已经以 /v1 结尾
    if (base.endsWith('/v1')) {
        // 去掉 path 开头的 v1/
        const subPath = p.startsWith('v1/') ? p.substring(3) : p;
        return `${base}/${subPath}`;
    }
    
    // 如果 path 不带 v1/，则补上
    if (!p.startsWith('v1/')) {
        return `${base}/v1/${p}`;
    }

    return `${base}/${p}`;
};

const isLikelyBase64 = (str: string): boolean => {
    if (!str || str.length < 100) return false;
    return /^[A-Za-z0-9+/=\s]+$/.test(str.substring(0, 100));
};

const normalizeImageUrl = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
    if (isLikelyBase64(trimmed)) return `data:image/png;base64,${trimmed}`;
    return trimmed; 
};

const findTaskId = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    return obj.id || obj.task_id || (obj.data && typeof obj.data === 'string' ? obj.data : null);
};

const handleResponse = async (response: Response) => {
    let result;
    try {
        result = await response.json();
    } catch (e) {
        if (!response.ok) throw new Error(`API Error (${response.status}): ${response.statusText}`);
        throw new Error('Server returned non-JSON. Possible incorrect Endpoint.');
    }

    if (result && typeof result === 'object') {
        if (result.code && result.message && ![0, 200, 'success'].includes(result.code)) {
            throw new Error(result.message);
        }
        if (result.error) {
            const msg = typeof result.error === 'string' ? result.error : result.error.message;
            if (msg) throw new Error(msg);
        }
    }

    if (!response.ok) throw new Error(result?.message || result?.error || `HTTP ${response.status}`);
    return result;
};

const collectImageUrls = (obj: any): string[] => {
    let urls: string[] = [];
    if (!obj) return urls;

    if (typeof obj === 'string') {
        if (obj.startsWith('http') || isLikelyBase64(obj)) {
            urls.push(normalizeImageUrl(obj));
        }
    } else if (Array.isArray(obj)) {
        obj.forEach(item => {
            urls = [...urls, ...collectImageUrls(item)];
        });
    } else if (typeof obj === 'object') {
        const priorityFields = ['url', 'result_url', 'image', 'b64_json', 'content'];
        for (const field of priorityFields) {
            if (obj[field]) urls = [...urls, ...collectImageUrls(obj[field])];
        }
        for (const key in obj) {
            if (!priorityFields.includes(key) && typeof obj[key] === 'object') {
                urls = [...urls, ...collectImageUrls(obj[key])];
            }
        }
    }
    return [...new Set(urls)].filter(u => u.length > 20);
};

export const createImageGenerationTask = async (
    baseUrl: string,
    token: string,
    prompt: string,
    model: ImageModel,
    options?: { aspectRatio?: string; resolution?: string; n?: number; }
): Promise<string> => {
    const url = getEndpoint(baseUrl, '/v1/images/generations?async=true');
    
    // Banana 2 API Spec: aspect_ratio enum, image_size enum
    const body: any = {
        model,
        prompt,
        aspect_ratio: options?.aspectRatio || "1:1",
        image_size: options?.resolution || "1K",
        response_format: "url"
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const result = await handleResponse(response);
    const taskId = findTaskId(result);
    if (!taskId) throw new Error("No Task ID found in Response.");
    return taskId;
};

export const createImageEditTask = async (
    baseUrl: string,
    token: string,
    prompt: string,
    model: ImageModel,
    imageFile: File,
    options?: { aspect_ratio?: string; image_size?: string; }
): Promise<string> => {
    const url = getEndpoint(baseUrl, '/v1/images/edits?async=true');
    const formData = new FormData();
    formData.append('model', model);
    formData.append('prompt', prompt);
    formData.append('image', imageFile);
    if (options?.aspect_ratio) formData.append('aspect_ratio', options.aspect_ratio);
    if (options?.image_size) formData.append('image_size', options.image_size);

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        body: formData
    });
    
    const result = await handleResponse(response);
    return findTaskId(result) || "edit-task-queued";
};

export const queryImageTask = async (
    baseUrl: string,
    token: string,
    taskId: string
): Promise<QueryImageResponse> => {
    const url = getEndpoint(baseUrl, `/v1/images/tasks/${taskId}`);
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });

    const result = await handleResponse(response);
    const data = result.data || result.task || result;
    const statusRaw = (data.status || data.state || 'unknown').toLowerCase();
    const allUrls = collectImageUrls(data);
    
    const isSuccess = ['success', 'succeeded', 'completed'].includes(statusRaw) || allUrls.length > 0;

    return {
        id: taskId,
        status: isSuccess ? 'success' : statusRaw,
        result_url: allUrls[0],
        result_urls: allUrls,
        fail_reason: data.fail_reason || data.error
    };
};

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

export const createNanoBananaPro4KTask = async (
    baseUrl: string,
    apiToken: string,
    prompt: string,
    files: File[],
    options?: { aspectRatio?: string; resolution?: string; },
    model: string = "gemini-3-pro-image-preview"
): Promise<string[]> => {
    const imageParts = await Promise.all(
        files.map(async (file) => ({
            type: "image_url",
            image_url: { url: await fileToDataURL(file) }
        }))
    );

    // Gemini 3 Pro Prompt Modification Rule: append parameters
    let finalPrompt = prompt;
    if (options?.aspectRatio) finalPrompt += `, ar-${options.aspectRatio}`;
    if (options?.resolution) finalPrompt += `, ${options.resolution}`;

    const payload = {
        model: model, 
        messages: [{ 
            role: "user", 
            content: [{ type: "text", text: finalPrompt }, ...imageParts] 
        }],
        max_tokens: 4096,
        stream: false
    };

    const endpoint = getEndpoint(baseUrl, '/v1/chat/completions');
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const result = await handleResponse(response);
    const contentText = result?.choices?.[0]?.message?.content;

    if (!contentText) throw new Error("API content is empty.");

    const collected = collectImageUrls(result);
    if (collected.length > 0) return collected;

    const mdMatches = [...contentText.matchAll(/!\[.*?\]\((.*?)\)/g)].map(m => m[1]);
    const urlMatches = contentText.match(/(https?:\/\/[^\s"'\)\]]+)/g) || [];
    const final = [...new Set([...mdMatches, ...urlMatches])].filter(u => u.length > 20);
    
    if (final.length === 0) throw new Error("No image URLs extracted from Chat response.");
    return final.map(normalizeImageUrl);
};