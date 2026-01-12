
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MonitorPlay, Layers, ChevronDown, Zap, AlertTriangle, 
  Loader2, Plus, Users, User, Trash2, Video, Upload, X, 
  Image as ImageIcon, LayoutGrid, Maximize2, Download, 
  RefreshCw, ExternalLink, Send, Sparkles,
  Type, Frame, Minimize2, ImagePlus, Square, Smartphone, Monitor,
  Clock, ShieldCheck, ZapOff, Highlighter, Check, MousePointer2,
  FileImage, Link2, Ghost, Files
} from 'lucide-react';
import { 
  VideoTask, SoraModel, MODEL_OPTIONS, TaskStatus, 
  ImageTask, ImageModel 
} from '../types';
import { 
  createVideoTask, createVideoI2VTask, queryVideoTask 
} from '../services/soraService';
import { 
  createImageGenerationTask, createImageEditTask, queryImageTask 
} from '../services/imageService';
import { TaskCard } from '../components/TaskCard';
import { useGlobal } from '../context/GlobalContext';

interface ReferenceFile {
  id: string;
  file?: File;
  url: string;
  name: string;
  isLoading?: boolean;
}

/**
 * Sora 2.0 Director Hub
 * High-performance UI for multi-reference creation.
 */
export const DirectorPage = () => {
  const { t, lang, activeChannel, channels } = useGlobal();

  // --- Hub Mode ---
  const [hubMode, setHubMode] = useState<'video' | 'image'>('image'); 
  const [videoTasks, setVideoTasks] = useState<VideoTask[]>([]);
  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  const [viewerTask, setViewerTask] = useState<ImageTask | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  // --- Video Configuration ---
  const [vOrientation, setVOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [vDuration, setVDuration] = useState<'10s' | '15s' | '25s'>('10s');
  const [vIsPro, setVIsPro] = useState(false);
  const [vIsHD, setVIsHD] = useState(true); 

  // --- Image Configuration ---
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1K');
  
  // --- Input States ---
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Drag State Logic
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const galleryContainerRef = useRef<HTMLDivElement>(null);

  const getMappedVideoModel = (): SoraModel => {
    const isLandscape = vOrientation === 'landscape';
    if (vDuration === '10s') return isLandscape ? SoraModel.SORA2_LANDSCAPE : SoraModel.SORA2_PORTRAIT;
    if (vDuration === '15s') {
      if (vIsPro) {
        return vIsHD 
          ? (isLandscape ? SoraModel.SORA2_PRO_LANDSCAPE_HD_15S : SoraModel.SORA2_PRO_PORTRAIT_HD_15S)
          : (isLandscape ? SoraModel.SORA2_LANDSCAPE_15S : SoraModel.SORA2_PORTRAIT_15S);
      }
      return isLandscape ? SoraModel.SORA2_LANDSCAPE_15S : SoraModel.SORA2_PORTRAIT_15S;
    }
    if (vDuration === '25s') return isLandscape ? SoraModel.SORA2_PRO_LANDSCAPE_25S : SoraModel.SORA2_PRO_PORTRAIT_25S;
    return SoraModel.SORA2_LANDSCAPE;
  };

  useEffect(() => {
    if (vDuration === '10s') setVIsPro(false);
    if (vDuration === '25s') setVIsPro(true);
  }, [vDuration]);

  useEffect(() => {
    const savedVideos = localStorage.getItem('sora_video_tasks');
    const savedImages = localStorage.getItem('sora_image_tasks');
    if (savedVideos) setVideoTasks(JSON.parse(savedVideos));
    if (savedImages) setImageTasks(JSON.parse(savedImages));
  }, []);

  useEffect(() => {
    localStorage.setItem('sora_video_tasks', JSON.stringify(videoTasks));
    localStorage.setItem('sora_image_tasks', JSON.stringify(imageTasks));
  }, [videoTasks, imageTasks]);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      // Poll Videos
      const activeVideos = videoTasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (activeVideos.length > 0) {
        const updates = await Promise.allSettled(activeVideos.map(async (task) => {
          if (!task.apiId) return null;
          const targetChannel = channels.find(c => c.id === task.channelId) || activeChannel;
          if (!targetChannel?.apiToken) return null;
          try { return { localId: task.id, apiData: await queryVideoTask(targetChannel.baseUrl, targetChannel.apiToken, task.apiId) }; } 
          catch (err) { return null; }
        }));
        setVideoTasks(curr => curr.map(task => {
          const update = updates.find(u => u.status === 'fulfilled' && u.value?.localId === task.id);
          if (update && update.status === 'fulfilled' && update.value) {
            const { apiData } = update.value;
            const apiStatus = (String(apiData.status || '')).toLowerCase();
            const isSuccess = ['success', 'completed', 'succeed', 'finished'].includes(apiStatus) || !!apiData.result_video_url;
            return { 
              ...task, 
              status: isSuccess ? 'success' : ['failed', 'error'].includes(apiStatus) ? 'failed' : 'processing', 
              progress: isSuccess ? 100 : task.progress,
              videoUrl: apiData.result_video_url || task.videoUrl, 
              coverUrl: apiData.cover_url || task.coverUrl, 
              errorMessage: apiData.fail_reason 
            };
          }
          return task;
        }));
      }

      // Poll Images
      const activeImages = imageTasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (activeImages.length > 0) {
        const updates = await Promise.allSettled(activeImages.map(async (task) => {
          if (!task.apiId) return null;
          const targetChannel = channels.find(c => c.id === task.channelId) || activeChannel;
          if (!targetChannel?.apiToken) return null;
          try { return { localId: task.id, apiData: await queryImageTask(targetChannel.baseUrl, targetChannel.apiToken, task.apiId) }; }
          catch (err) { return null; }
        }));
        setImageTasks(curr => curr.map(task => {
          const update = updates.find(u => u.status === 'fulfilled' && u.value?.localId === task.id);
          if (update && update.status === 'fulfilled' && update.value) {
            const { apiData } = update.value;
            const isSuccess = apiData.result_url || (apiData.result_urls && apiData.result_urls.length > 0);
            return { 
                ...task, 
                status: isSuccess ? 'success' : ['failed', 'error'].includes((apiData.status || '').toLowerCase()) ? 'failed' : 'processing',
                resultUrl: apiData.result_url || task.resultUrl,
                resultUrls: apiData.result_urls || task.resultUrls,
                errorMessage: apiData.fail_reason
            };
          }
          return task;
        }));
      }
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [videoTasks, imageTasks, channels, activeChannel]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [inputPrompt]);

  const addFiles = async (files: FileList | File[]) => {
    const newRefs: ReferenceFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newRefs.push({
          id: Date.now().toString() + i,
          file,
          url: URL.createObjectURL(file),
          name: file.name
        });
      }
    }
    setReferenceFiles(prev => [...prev, ...newRefs]);
  };

  const removeReference = (index: number) => {
    setReferenceFiles(prev => {
      const updated = [...prev];
      if (updated[index].file) URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Improved Drag Handler using counter
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
        setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
        setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);

    const url = e.dataTransfer.getData('text/image-url');
    if (url) {
        // Optimistic UI Update: Show URL immediately without blocking
        const tempId = Date.now().toString();
        const newRef: ReferenceFile = {
            id: tempId,
            url: url,
            name: 'Loading...',
            isLoading: true
        };
        setReferenceFiles(prev => [...prev, newRef]);

        // Background fetch for File object
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const filename = `ref_${Date.now()}.png`;
            const file = new File([blob], filename, { type: blob.type || 'image/png' });

            setReferenceFiles(prev => prev.map(item => 
                item.id === tempId 
                ? { ...item, file, name: filename, isLoading: false } 
                : item
            ));
        } catch (err) {
            console.error("Failed to load dropped image:", err);
            // Remove the failed placeholder or set error state
            setReferenceFiles(prev => prev.filter(item => item.id !== tempId));
        }
    } else if (e.dataTransfer.files?.length > 0) {
        addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleCreate = async () => {
    if (!activeChannel?.apiToken) { setError(t('missingToken')); return; }
    if (!inputPrompt.trim()) return;
    
    // Check if any reference is still loading
    const pendingRef = referenceFiles.find(r => r.isLoading);
    if (pendingRef) {
        setError(lang === 'zh' ? '请等待参考图加载完成' : 'Please wait for images to load');
        return;
    }

    setIsSubmitting(true);
    setError(null);
    const localId = Date.now().toString();

    try {
      if (hubMode === 'video') {
        const mappedModel = getMappedVideoModel();
        const newTask: VideoTask = { id: localId, prompt: inputPrompt, model: mappedModel, status: 'queued', progress: 0, createdAt: Date.now(), channelId: activeChannel?.id };
        setVideoTasks(prev => [newTask, ...prev]);
        
        // Use primary reference for current API compatibility
        const apiId = referenceFiles.length > 0 
          ? await createVideoI2VTask(activeChannel.baseUrl, activeChannel.apiToken, inputPrompt, mappedModel, referenceFiles[0].file!)
          : await createVideoTask(activeChannel.baseUrl, activeChannel.apiToken, inputPrompt, mappedModel);
        
        setVideoTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
      } else {
        const newTask: ImageTask = { id: localId, prompt: inputPrompt, model: ImageModel.NANO_BANANA_2, status: 'queued', createdAt: Date.now(), channelId: activeChannel.id, type: referenceFiles.length > 0 ? 'img2img' : 'txt2img' };
        setImageTasks(prev => [newTask, ...prev]);
        
        const apiId = referenceFiles.length === 0
          ? await createImageGenerationTask(activeChannel.baseUrl, activeChannel.apiToken, inputPrompt, ImageModel.NANO_BANANA_2, { size: aspectRatio, resolution })
          : await createImageEditTask(activeChannel.baseUrl, activeChannel.apiToken, inputPrompt, ImageModel.NANO_BANANA_2, referenceFiles[0].file!, { aspect_ratio: aspectRatio, image_size: resolution });
        
        setImageTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
      }
      setInputPrompt(''); 
      setReferenceFiles([]);
      galleryContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message);
    } finally { setIsSubmitting(false); }
  };

  const allTasksSorted = useMemo(() => [
    ...videoTasks.map(t => ({ ...t, hubType: 'video' as const })),
    ...imageTasks.map(t => ({ ...t, hubType: 'image' as const }))
  ].sort((a, b) => b.createdAt - a.createdAt), [videoTasks, imageTasks]);

  return (
    <div 
        className="h-full relative bg-white overflow-hidden flex flex-col selection:bg-blue-500/10"
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Lightbox Viewer */}
      {viewerTask && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300" onClick={() => setViewerTask(null)}>
            <div className="max-w-5xl w-full h-full max-h-[90vh] flex flex-col bg-[#1C1C1E] rounded-[32px] overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
                {/* Header / Close */}
                <div className="absolute top-6 right-6 z-50">
                    <button onClick={() => setViewerTask(null)} className="p-2 bg-black/50 hover:bg-white/20 text-white rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Image Area - Flexible */}
                <div className="flex-1 min-h-0 w-full bg-black flex items-center justify-center p-4 relative group/image">
                     <img 
                        src={viewerTask.resultUrls?.[viewerIndex] || viewerTask.resultUrl} 
                        className="w-full h-full object-contain" 
                        alt={viewerTask.prompt}
                     />
                </div>

                {/* Footer Area - Fixed/Constrained */}
                <div className="shrink-0 p-6 md:p-8 bg-white/5 backdrop-blur-xl border-t border-white/5 flex flex-col gap-4">
                     {/* Thumbnails */}
                     {viewerTask.resultUrls && viewerTask.resultUrls.length > 1 && (
                         <div className="flex justify-center gap-2 mb-2 overflow-x-auto py-2 custom-scrollbar-h">
                             {viewerTask.resultUrls.map((url, i) => (
                                 <button key={i} onClick={() => setViewerIndex(i)} className={`w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${i === viewerIndex ? 'border-blue-500 scale-110' : 'border-transparent opacity-50'}`}>
                                     <img src={url} className="w-full h-full object-cover" />
                                 </button>
                             ))}
                         </div>
                     )}

                     <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
                         <div className="flex-1 min-w-0 text-center md:text-left w-full">
                             <div className="max-h-[100px] overflow-y-auto custom-scrollbar pr-2">
                                <p className="text-white/90 text-sm font-medium leading-relaxed whitespace-pre-wrap">{viewerTask.prompt}</p>
                             </div>
                         </div>
                         <div className="shrink-0">
                             <button 
                                onClick={() => {
                                   const url = viewerTask.resultUrls?.[viewerIndex] || viewerTask.resultUrl;
                                   if(url) {
                                       const a = document.createElement('a');
                                       a.href = url;
                                       a.download = `sora_creation_${viewerTask.id}.png`;
                                       document.body.appendChild(a);
                                       a.click();
                                       document.body.removeChild(a);
                                   }
                                }} 
                                className="bg-white text-black px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-200 transition-all text-xs uppercase tracking-wider"
                             >
                                <Download size={16} /> {t('download')}
                             </button>
                         </div>
                     </div>
                </div>
            </div>
        </div>
      )}

      {/* Main Gallery */}
      <div ref={galleryContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-60">
        <div className="max-w-6xl mx-auto">
            {allTasksSorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-30 animate-in zoom-in-95 duration-700 mt-20">
                    <Sparkles className="text-blue-600 mb-6" size={64} />
                    <h2 className="text-3xl font-black text-[#1D1D1F] uppercase tracking-tighter">{t('historyEmpty')}</h2>
                    <p className="text-sm font-medium mt-3">{t('historyEmptyDesc')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {allTasksSorted.map(task => (
                        task.hubType === 'video' ? (
                            <TaskCard key={task.id} task={task as VideoTask} lang={lang} />
                        ) : (
                            <div key={task.id} className="bg-white rounded-[24px] border border-[rgba(0,0,0,0.06)] shadow-apple-card hover:shadow-apple-hover transition-all duration-500 overflow-hidden group">
                                <div 
                                    className="aspect-square bg-[#F5F5F7] relative cursor-pointer overflow-hidden" 
                                    onClick={() => task.status === 'success' && (setViewerTask(task as ImageTask), setViewerIndex(0))}
                                    draggable={task.status === 'success'}
                                    onDragStart={e => e.dataTransfer.setData('text/image-url', (task as ImageTask).resultUrl || (task as ImageTask).resultUrls?.[0] || '')}
                                >
                                    {task.status === 'success' ? (
                                        <>
                                            <img src={(task as ImageTask).resultUrl || (task as ImageTask).resultUrls?.[0]} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"><Maximize2 size={32} className="text-white" /></div>
                                        </>
                                    ) : task.status === 'failed' ? (
                                        <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-400 p-8"><AlertTriangle size={32} /></div>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-600" /></div>
                                    )}
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-2"><span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">IMAGE</span></div>
                                    <p className="text-xs font-bold text-[#1D1D1F] line-clamp-2 leading-relaxed">{task.prompt}</p>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Input Composer - Optimized for Multi-Ref */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-white via-white/95 to-transparent z-40">
        <div className="max-w-3xl mx-auto relative">
            
            {/* Multi-Ref Thumbnail Strip */}
            {referenceFiles.length > 0 && (
                <div className="absolute -top-[64px] left-0 right-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 z-50 animate-in slide-in-from-bottom-2 duration-200 px-2 transform-gpu">
                    {referenceFiles.map((ref, idx) => (
                        <div key={ref.id} className="flex items-center gap-1.5 bg-white/90 backdrop-blur-3xl p-1 rounded-xl shadow-lg border border-white ring-1 ring-black/5 shrink-0 group transform-gpu transition-all hover:bg-white active:scale-95">
                            <div className="relative">
                                {ref.isLoading ? (
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shadow-sm border border-gray-200">
                                        <Loader2 size={12} className="animate-spin text-[#007AFF]" />
                                    </div>
                                ) : (
                                    <img src={ref.url} className="w-8 h-8 rounded-lg object-cover shadow-sm ring-1 ring-black/5" />
                                )}
                                {!ref.isLoading && (
                                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-md">
                                        <Check size={8} strokeWidth={5} />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col pr-1.5 max-w-[80px]">
                                <span className="text-[7px] font-black text-blue-500/60 tracking-tighter uppercase leading-none mb-0.5">
                                    REF
                                </span>
                                <span className="text-[8px] font-bold text-gray-500 truncate leading-none">
                                    {ref.name}
                                </span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeReference(idx); }} 
                                className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all flex items-center justify-center"
                            >
                                <X size={12} strokeWidth={3} />
                            </button>
                        </div>
                    ))}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-10 h-10 shrink-0 bg-white/60 backdrop-blur-2xl rounded-xl border border-white ring-1 ring-black/5 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-white transition-all shadow-md active:scale-90"
                    >
                      <Plus size={16} />
                    </button>
                </div>
            )}

            {/* Main Input Container */}
            <div 
                className={`bg-white rounded-[26px] shadow-2xl transition-all overflow-hidden relative flex flex-col gap-1 transform-gpu
                    ${isDragOver 
                        ? 'ring-4 ring-[#007AFF]/20 border-2 border-dashed border-[#007AFF] bg-blue-50/30 scale-[1.01]' 
                        : 'border border-[rgba(0,0,0,0.08)]'}`}
            >
                {isDragOver && (
                    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-none">
                        <div className="flex flex-col items-center animate-pulse">
                            <div className="bg-blue-600/10 p-4 rounded-full mb-3">
                                <Files size={40} className="text-[#007AFF]" />
                            </div>
                            <span className="text-xs font-black text-[#007AFF] uppercase tracking-[0.2em]">{t('dropFeedback')}</span>
                        </div>
                    </div>
                )}

                {/* Top Bar: Mode Switcher & Params */}
                <div className="flex items-center gap-2 px-2 pt-2 overflow-x-auto no-scrollbar">
                    <div className="flex bg-[#F5F5F7] p-1 rounded-xl shrink-0">
                        <button onClick={() => setHubMode('image')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${hubMode === 'image' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                            <ImageIcon size={11} /> {lang === 'zh' ? '图像' : 'IMG'}
                        </button>
                        <button onClick={() => setHubMode('video')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${hubMode === 'video' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                            <Video size={11} /> {lang === 'zh' ? '视频' : 'VID'}
                        </button>
                    </div>

                    <div className="w-[1px] h-4 bg-gray-100 shrink-0" />

                    <div className="flex items-center gap-2 shrink-0">
                        {hubMode === 'video' ? (
                            <>
                                <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl">
                                    <button onClick={() => setVOrientation('portrait')} className={`p-1.5 rounded-lg text-[10px] transition-all ${vOrientation === 'portrait' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`} title="Portrait"><Smartphone size={11} /></button>
                                    <button onClick={() => setVOrientation('landscape')} className={`p-1.5 rounded-lg text-[10px] transition-all ${vOrientation === 'landscape' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`} title="Landscape"><Monitor size={11} /></button>
                                </div>
                                <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl">
                                    {(['10s', '15s', '25s'] as const).map(d => (
                                        <button key={d} onClick={() => setVDuration(d)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${vDuration === d ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>{d}</button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl">
                                    <button disabled={vDuration === '10s' || vDuration === '25s'} onClick={() => setVIsPro(false)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${!vIsPro ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'} ${vDuration === '25s' ? 'opacity-30' : ''}`}>Std</button>
                                    <button disabled={vDuration === '10s' || vDuration === '25s'} onClick={() => setVIsPro(true)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${vIsPro ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400'} ${vDuration === '10s' ? 'opacity-30' : ''}`}>Pro</button>
                                </div>
                                {vDuration === '15s' && vIsPro && (
                                    <button onClick={() => setVIsHD(!vIsHD)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all bg-[#F5F5F7] ${vIsHD ? 'text-indigo-600' : 'text-gray-400'}`}>{vIsHD ? 'HD' : 'SD'}</button>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="relative group">
                                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-[#F5F5F7] px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase text-gray-500 border-none ring-0 appearance-none pr-6 outline-none cursor-pointer hover:bg-gray-100">
                                        {['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '4:5', '5:4', '21:9'].map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                </div>
                                <div className="relative group">
                                    <select value={resolution} onChange={e => setResolution(e.target.value)} className="bg-[#F5F5F7] px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase text-gray-500 border-none ring-0 appearance-none pr-6 outline-none cursor-pointer hover:bg-gray-100">
                                        {['1K', '2K', '4K'].map(res => <option key={res} value={res}>{res}</option>)}
                                    </select>
                                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="flex items-end gap-2 p-2">
                    <div className="flex-1 bg-[#F5F5F7] rounded-[20px] px-4 py-3 transition-all focus-within:bg-gray-50 hover:bg-gray-100/80">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={inputPrompt}
                            onChange={e => setInputPrompt(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate(); } }}
                            placeholder={hubMode === 'video' ? t('promptPlaceholder') : t('imageGenPlaceholder')}
                            className="bg-transparent border-none p-0 focus:ring-0 w-full text-sm font-medium text-[#1D1D1F] placeholder:text-gray-400/80 resize-none min-h-[24px] max-h-[100px] leading-relaxed outline-none shadow-none ring-0"
                            style={{ boxShadow: 'none', border: 'none' }}
                            spellCheck={false}
                        />
                    </div>
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-11 h-11 flex shrink-0 items-center justify-center rounded-full transition-all active:scale-95 transform-gpu
                            ${referenceFiles.length > 0 ? 'bg-blue-100 text-blue-600' : 'bg-[#F5F5F7] hover:bg-[#E5E5EA] text-gray-500'}`}
                        title={t('uploadImage')}
                    >
                        <ImagePlus size={18} />
                        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); }} />
                    </button>
                    
                    <button 
                        onClick={handleCreate}
                        disabled={isSubmitting || !inputPrompt.trim()}
                        className={`w-11 h-11 flex shrink-0 items-center justify-center rounded-full transition-all shadow-md active:scale-90 transform-gpu
                            ${isSubmitting || !inputPrompt.trim() 
                                ? 'bg-gray-100 text-gray-300 shadow-none' 
                                : 'bg-[#1D1D1F] text-white hover:bg-black shadow-black/20'}`}
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
                    </button>
                </div>

                {error && (
                    <div className="absolute top-2 left-2 right-2 p-2 px-3 bg-red-50/95 backdrop-blur-sm text-red-500 rounded-xl flex items-center gap-2 text-[10px] font-bold border border-red-100 animate-in slide-in-from-top-2 z-20">
                        <AlertTriangle size={12} /> {error}
                        <button onClick={() => setError(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={12} /></button>
                    </div>
                )}
            </div>
            
            <p className="mt-3 text-center text-[9px] font-black text-[#86868B] uppercase tracking-[0.4em] opacity-30 select-none">
                SORA 2.0 • STUDIO HUB 
            </p>
        </div>
      </div>
    </div>
  );
};
