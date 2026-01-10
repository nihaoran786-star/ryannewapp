import React, { useState, useEffect, useRef } from 'react';
import { 
  Image as ImageIcon, Type, Upload, ChevronDown, Zap, 
  AlertTriangle, Loader2, Plus, Trash2, Maximize2, 
  Download, RefreshCw, X, LayoutGrid, ExternalLink, MousePointer2
} from 'lucide-react';
import { 
  ImageModel, IMAGE_MODEL_OPTIONS, TaskStatus, 
  ImageTask 
} from '../types';
import { 
  createImageGenerationTask, createImageEditTask, queryImageTask 
} from '../services/imageService';
import { useGlobal } from '../context/GlobalContext';

/**
 * ImageGenPage
 * Optimized for Banana 2 - Improved viewing and parsing
 * NEW: Support for dragging history items as reference images
 */
export const ImageGenPage = () => {
  const { t, lang, activeChannel, channels } = useGlobal();

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'txt2img' | 'img2img'>('txt2img');
  const [viewerTask, setViewerTask] = useState<ImageTask | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // --- Form States ---
  const [prompt, setPrompt] = useState('');
  const [selectedModel] = useState<ImageModel>(ImageModel.NANO_BANANA_2);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1K');
  
  // --- Task States ---
  const [tasks, setTasks] = useState<ImageTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load/Save Tasks
  useEffect(() => {
    const saved = localStorage.getItem('sora_image_tasks');
    if (saved) setTasks(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('sora_image_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Polling logic
  useEffect(() => {
    const pollInterval = setInterval(async () => {
        const activeTasks = tasks.filter(t => t.status === 'queued' || t.status === 'processing');
        if (activeTasks.length === 0) return;

        const updates = await Promise.allSettled(activeTasks.map(async (task) => {
            if (!task.apiId) return null;
            const targetChannel = channels.find(c => c.id === task.channelId) || activeChannel;
            if (!targetChannel?.apiToken) return null;

            try {
                const data = await queryImageTask(targetChannel.baseUrl, targetChannel.apiToken, task.apiId);
                return { localId: task.id, apiData: data };
            } catch (err) { return null; }
        }));

        setTasks(current => current.map(task => {
            const update = updates.find(u => u.status === 'fulfilled' && u.value?.localId === task.id);
            if (update && update.status === 'fulfilled' && update.value) {
                const { apiData } = update.value;
                const apiStatus = (apiData.status || '').toLowerCase();
                const hasResults = apiData.result_url || (apiData.result_urls && apiData.result_urls.length > 0);
                const isSuccess = hasResults || ['success', 'succeed', 'completed'].includes(apiStatus);
                const isFail = ['failed', 'error', 'fail'].includes(apiStatus) || apiData.fail_reason;

                return {
                    ...task,
                    status: isSuccess ? 'success' : isFail ? 'failed' : 'processing',
                    resultUrl: apiData.result_url || task.resultUrl,
                    resultUrls: apiData.result_urls || task.resultUrls,
                    errorMessage: apiData.fail_reason
                };
            }
            return task;
        }));
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [tasks, channels, activeChannel]);

  /**
   * Helper: Convert URL to File object (for drag-drop support)
   */
  const urlToFile = async (url: string, filename: string, mimeType: string) => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    return new File([buf], filename, { type: mimeType });
  };

  const handleDownload = async (url: string, id: string) => {
      if (!url || isDownloading) return;
      setIsDownloading(id + url);
      try {
          const res = await fetch(url);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `banana_art_${id}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(blobUrl);
      } catch (err) { window.open(url, '_blank'); }
      finally { setIsDownloading(null); }
  };

  const handleSubmit = async () => {
    if (!activeChannel?.apiToken) { setError(t('missingToken')); return; }
    if (!prompt.trim()) { setError(lang === 'zh' ? '请输入提示词' : 'Prompt required'); return; }
    if (activeTab === 'img2img' && !selectedImage) { setError(t('noImageSelected')); return; }

    setIsSubmitting(true);
    setError(null);
    const localId = Date.now().toString();

    const newTask: ImageTask = {
        id: localId,
        prompt,
        model: selectedModel,
        status: 'queued',
        createdAt: Date.now(),
        channelId: activeChannel.id,
        type: activeTab,
        sourceImagePreview: activeTab === 'img2img' ? imagePreview || undefined : undefined
    };

    setTasks(prev => [newTask, ...prev]);

    try {
        let apiId = '';
        if (activeTab === 'txt2img') {
            apiId = await createImageGenerationTask(
                activeChannel.baseUrl, activeChannel.apiToken, 
                prompt, selectedModel, { size: aspectRatio, resolution, n: 1 }
            );
        } else {
            apiId = await createImageEditTask(
                activeChannel.baseUrl, activeChannel.apiToken,
                prompt, selectedModel, selectedImage!, 
                { aspect_ratio: aspectRatio, image_size: resolution }
            );
        }
        setTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
    } catch (err: any) {
        setTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'failed', errorMessage: err.message } : t));
        setError(err.message || 'Request failed');
    } finally { setIsSubmitting(false); }
  };

  const openViewer = (task: ImageTask, index: number = 0) => {
      setViewerTask(task);
      setViewerIndex(index);
  };

  // --- Drag and Drop Handlers ---

  const handleDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData('text/image-url', url);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const url = e.dataTransfer.getData('text/image-url');
    if (url) {
      setActiveTab('img2img');
      setImagePreview(url);
      try {
        const file = await urlToFile(url, `ref_${Date.now()}.png`, 'image/png');
        setSelectedImage(file);
      } catch (err) {
        console.error("Failed to convert dragged URL to file:", err);
        setError("Failed to process dragged image. Please try uploading manually.");
      }
    } else {
      // Handle native file drop
      const files = e.dataTransfer.files;
      if (files && files[0]) {
        setActiveTab('img2img');
        setSelectedImage(files[0]);
        setImagePreview(URL.createObjectURL(files[0]));
      }
    }
  };

  const currentViewerUrl = viewerTask ? (viewerTask.resultUrls?.[viewerIndex] || viewerTask.resultUrl || '') : '';

  return (
    <div className="h-full overflow-y-auto p-8 custom-scrollbar bg-[#F5F5F7] animate-in fade-in duration-500">
       
       {/* Lightbox Viewer */}
       {viewerTask && currentViewerUrl && (
           <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-10" onClick={() => setViewerTask(null)}>
                <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-[110]"><X size={36} /></button>
                <div className="max-w-6xl w-full flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                    <div className="bg-[#1C1C1E] rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col w-full border border-white/10">
                        <div className="flex-1 flex items-center justify-center bg-black min-h-[50vh] relative group/v">
                            <img 
                                src={currentViewerUrl} 
                                className="max-h-[70vh] w-auto object-contain selection:none" 
                                alt="Generated Result"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x600?text=Image+Load+Error';
                                }}
                            />
                            {/* Fallback open link */}
                            <button 
                                onClick={() => window.open(currentViewerUrl, '_blank')}
                                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white backdrop-blur-md opacity-0 group-hover/v:opacity-100 transition-opacity"
                                title="Open Original"
                            >
                                <ExternalLink size={20} />
                            </button>
                        </div>
                        
                        <div className="p-8 bg-white/5 backdrop-blur-md">
                            {/* Thumbnails */}
                            {viewerTask.resultUrls && viewerTask.resultUrls.length > 1 && (
                                <div className="flex gap-3 mb-6 overflow-x-auto pb-4 custom-scrollbar-h justify-center">
                                    {viewerTask.resultUrls.map((url, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => setViewerIndex(i)}
                                            className={`w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 ${viewerIndex === i ? 'border-indigo-500 scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-80'}`}
                                        >
                                            <img src={url} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-start justify-between gap-6">
                                <div className="flex-1">
                                    <p className="text-white text-base font-medium leading-relaxed mb-2">{viewerTask.prompt}</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded">{viewerTask.model}</span>
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{viewerTask.type}</span>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => currentViewerUrl && handleDownload(currentViewerUrl, viewerTask.id)}
                                        className="bg-white text-black px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-gray-100 transition-all active:scale-95 shadow-xl shadow-white/5"
                                    >
                                        {isDownloading === viewerTask.id + currentViewerUrl ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                                        {t('download')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
           </div>
       )}

       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
           {/* Control Panel */}
           <div className="lg:col-span-4">
               <div className="bg-white rounded-[32px] p-8 shadow-apple-card border border-white/50 sticky top-0">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-indigo-200 shadow-xl">
                            <ImageIcon className="text-white w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-black text-[#1D1D1F] tracking-tight">{t('images')}</h2>
                    </div>

                    <div className="flex bg-[#F5F5F7] p-1.5 rounded-2xl mb-8">
                        {(['txt2img', 'img2img'] as const).map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {tab === 'txt2img' ? t('textToImage') : t('imageToImage')}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-8">
                        <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                            <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">{t('model')}</span>
                            <span className="text-sm font-black text-indigo-900">BANANA 2.0</span>
                        </div>

                        {activeTab === 'img2img' && (
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">{t('uploadImage')}</label>
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`group aspect-video border-2 border-dashed rounded-[28px] flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden
                                        ${isDragOver 
                                            ? 'border-indigo-600 bg-indigo-50 scale-[1.02] shadow-lg ring-4 ring-indigo-500/10' 
                                            : 'border-gray-200 bg-[#FBFBFB] hover:border-indigo-400 hover:bg-indigo-50/20'}`}
                                >
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                                        if (e.target.files?.[0]) {
                                            setSelectedImage(e.target.files[0]);
                                            setImagePreview(URL.createObjectURL(e.target.files[0]));
                                        }
                                    }} />
                                    {imagePreview ? (
                                        <>
                                            <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                                                <RefreshCw size={24} className="mb-2" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'zh' ? '更换图片' : 'Change Image'}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center animate-in fade-in zoom-in duration-300">
                                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                                <Upload className="text-gray-300 group-hover:text-indigo-500" size={28} />
                                            </div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{isDragOver ? t('dropFeedback') : t('dragDrop')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">{t('aspectRatio')}</label>
                                <div className="relative">
                                    <select 
                                        value={aspectRatio}
                                        onChange={e => setAspectRatio(e.target.value)}
                                        className="w-full bg-[#F5F5F7] border-none rounded-2xl px-5 py-4 text-xs font-black text-[#1D1D1F] focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                                    >
                                        {['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'].map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">{t('imageSize')}</label>
                                <div className="relative">
                                    <select 
                                        value={resolution}
                                        onChange={e => setResolution(e.target.value)}
                                        className="w-full bg-[#F5F5F7] border-none rounded-2xl px-5 py-4 text-xs font-black text-[#1D1D1F] focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                                    >
                                        {['1K', '2K', '4K'].map(q => <option key={q} value={q}>{q}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">{t('storyPrompt')}</label>
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder={t('imageGenPlaceholder')}
                                className="w-full bg-[#F5F5F7] border-none rounded-[24px] p-5 text-sm font-semibold text-[#1D1D1F] focus:ring-2 focus:ring-indigo-500/20 min-h-[140px] resize-none outline-none leading-relaxed shadow-inner"
                            />
                        </div>

                        {error && <div className="p-4 bg-red-50 rounded-2xl flex gap-3 border border-red-100 animate-in slide-in-from-top-2"><AlertTriangle className="text-red-500 shrink-0" size={18} /><p className="text-xs font-bold text-red-600">{error}</p></div>}

                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !activeChannel?.apiToken}
                            className={`group w-full py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-2xl ${isSubmitting ? 'bg-gray-100 text-gray-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}
                        >
                            {isSubmitting ? <Loader2 size={22} className="animate-spin" /> : <Plus size={22} strokeWidth={3} />}
                            {isSubmitting ? t('submitting') : t('submit')}
                        </button>
                    </div>
               </div>
           </div>

           {/* Gallery Section */}
           <div className="lg:col-span-8 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-8 shrink-0">
                    <h2 className="text-3xl font-black text-[#1D1D1F] flex items-center gap-4">
                        {t('history')}
                        {tasks.length > 0 && <span className="bg-white border border-gray-100 text-indigo-600 text-sm px-4 py-1 rounded-full font-black shadow-sm">{tasks.length}</span>}
                    </h2>
                    {tasks.length > 0 && (
                        <button onClick={() => confirm(t('clearHistoryConfirm')) && setTasks([])} className="px-6 py-3 bg-white border border-gray-100 rounded-full text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm">
                            <Trash2 size={16} /> {t('clearHistory')}
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto pb-12 custom-scrollbar pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {tasks.map(task => (
                            <div key={task.id} className="bg-white rounded-[36px] border border-gray-100 shadow-apple-card hover:shadow-apple-hover transition-all duration-500 overflow-hidden group relative">
                                <div 
                                    className="aspect-square bg-[#F5F5F7] relative cursor-pointer" 
                                    onClick={() => task.status === 'success' && openViewer(task)}
                                    draggable={task.status === 'success' && !!(task.resultUrl || task.resultUrls?.[0])}
                                    onDragStart={(e) => handleDragStart(e, task.resultUrl || task.resultUrls?.[0] || '')}
                                >
                                    {(task.status === 'success' && (task.resultUrl || task.resultUrls?.[0])) ? (
                                        <>
                                            <img 
                                                src={task.resultUrl || task.resultUrls?.[0]} 
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                                alt="Generated thumbnail"
                                                loading="lazy"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=Load+Error';
                                                }}
                                            />
                                            
                                            {task.resultUrls && task.resultUrls.length > 1 && (
                                                <div className="absolute top-5 left-5 bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-xl flex items-center gap-2 text-white text-[10px] font-black z-10 border border-white/10">
                                                    <LayoutGrid size={14} />
                                                    <span>{task.resultUrls.length} ITEMS</span>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4">
                                                <div className="p-4 bg-white/10 backdrop-blur-2xl rounded-full text-white hover:bg-white/30 transition-all" title="View Detail"><Maximize2 size={24} /></div>
                                                <button 
                                                    onClick={e => { 
                                                        e.stopPropagation(); 
                                                        const url = task.resultUrl || task.resultUrls?.[0];
                                                        if (url) handleDownload(url, task.id); 
                                                    }} 
                                                    className="p-4 bg-white/10 backdrop-blur-2xl rounded-full text-white hover:bg-white/30 transition-all"
                                                    title="Download"
                                                >
                                                    {isDownloading === task.id + (task.resultUrl || task.resultUrls?.[0]) ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
                                                </button>
                                                {/* Drag indicator hint on hover */}
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-white/60 flex items-center gap-1 uppercase tracking-widest whitespace-nowrap bg-black/20 px-3 py-1 rounded-full">
                                                    <MousePointer2 size={10} /> {lang === 'zh' ? '拖拽设置为参考图' : 'Drag to use as ref'}
                                                </div>
                                            </div>
                                        </>
                                    ) : task.status === 'failed' ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-red-50/30">
                                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                                                <AlertTriangle size={32} />
                                            </div>
                                            <p className="text-xs font-black text-red-500 line-clamp-3 uppercase tracking-widest leading-relaxed">{task.errorMessage || 'GENERATION FAILED'}</p>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                                            <div className="w-16 h-16 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em]">{t('gen')}</span>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Banana 2 Processing</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{task.type}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-200" />
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{task.model.split('-')[0]}</span>
                                        </div>
                                        {task.status === 'success' && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]" />
                                                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{t('done')}</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm font-bold text-[#1D1D1F] line-clamp-2 leading-relaxed h-[2.8rem]">{task.prompt}</p>
                                </div>
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <div className="col-span-full h-[500px] border-2 border-dashed border-gray-200 rounded-[48px] flex flex-col items-center justify-center bg-white/50 animate-in fade-in zoom-in-95 duration-700">
                                <div className="w-20 h-20 bg-gray-50 rounded-[28px] flex items-center justify-center mb-6 shadow-sm"><ImageIcon className="text-gray-200" size={40} /></div>
                                <p className="text-gray-400 font-black text-base uppercase tracking-widest">{t('historyEmpty')}</p>
                                <p className="text-gray-300 text-xs mt-2 font-medium">{t('historyEmptyDesc')}</p>
                            </div>
                        )}
                    </div>
                </div>
           </div>
       </div>
    </div>
  );
};