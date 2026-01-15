import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AlertTriangle, Loader2, Plus, Trash2, Video, X, 
  Image as ImageIcon, Maximize2, Send, Sparkles,
  Smartphone, Monitor, Star, LayoutGrid, Check, Copy,
  MousePointer2, AlertCircle, Layers, Crop, Scaling
} from 'lucide-react';
import { 
  VideoTask, SoraModel, ImageTask, ImageModel, IMAGE_MODEL_OPTIONS
} from '../types';
import { createVideoTask, queryVideoTask } from '../services/soraService';
import { createImageGenerationTask, queryImageTask, createNanoBananaPro4KTask, createImageEditTask } from '../services/imageService';
import { TaskCard } from '../components/TaskCard';
import { useGlobal } from '../context/GlobalContext';

interface ReferenceFile {
  id: string;
  file?: File;
  url: string;
  name: string;
}

// Sora Model Mapping Table
const SORA_CONFIGS: Record<string, {label: string, isHD: boolean}[]> = {
  portrait: [
    { label: '10s', isHD: false },
    { label: '15s', isHD: false },
    { label: '15s', isHD: true },
    { label: '25s', isHD: false }
  ],
  landscape: [
    { label: '10s', isHD: false },
    { label: '15s', isHD: false },
    { label: '15s', isHD: true },
    { label: '25s', isHD: false }
  ]
};

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '4:5', '5:4', '21:9'];
const RESOLUTIONS = ['1K', '2K', '4K'];

const mapToSoraId = (orientation: 'portrait' | 'landscape', duration: string, isHD: boolean): SoraModel => {
  const prefix = orientation === 'portrait' ? 'SORA2_PORTRAIT' : 'SORA2_LANDSCAPE';
  // Specific overrides for PRO models
  if (duration === '15s' && isHD) {
      return orientation === 'portrait' ? SoraModel.SORA2_PRO_PORTRAIT_HD_15S : SoraModel.SORA2_PRO_LANDSCAPE_HD_15S;
  }
  if (duration === '25s') {
      return orientation === 'portrait' ? SoraModel.SORA2_PRO_PORTRAIT_25S : SoraModel.SORA2_PRO_LANDSCAPE_25S;
  }
  if (duration === '15s') {
      return orientation === 'portrait' ? SoraModel.SORA2_PORTRAIT_15S : SoraModel.SORA2_LANDSCAPE_15S;
  }
  
  // Default fallback (10s or others)
  return orientation === 'portrait' ? SoraModel.SORA2_PORTRAIT : SoraModel.SORA2_LANDSCAPE;
};

export const DirectorPage = () => {
  const { t, lang, activeChannel, channels } = useGlobal();

  // --- App States ---
  const [hubMode, setHubMode] = useState<'video' | 'image'>('video');
  const [videoTasks, setVideoTasks] = useState<VideoTask[]>([]);
  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  
  // --- Sora Selector States ---
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [selectedDuration, setSelectedDuration] = useState('15s');
  const [selectedHD, setSelectedHD] = useState(true);

  // --- Image Selector States ---
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModel>(ImageModel.NANO_BANANA_2);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1');
  const [selectedResolution, setSelectedResolution] = useState('1K');
  
  // --- Prompt & Refs ---
  const [inputPrompt, setInputPrompt] = useState('');
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- Viewer ---
  const [viewerTask, setViewerTask] = useState<ImageTask | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    try {
      const v = localStorage.getItem('sora_v2_tasks');
      const i = localStorage.getItem('sora_image_tasks');
      if (v) setVideoTasks(JSON.parse(v).slice(0, 30));
      if (i) setImageTasks(JSON.parse(i).slice(0, 30));
    } catch (e) {
      console.error("Failed to load tasks from local storage", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sora_v2_tasks', JSON.stringify(videoTasks));
    localStorage.setItem('sora_image_tasks', JSON.stringify(imageTasks));
  }, [videoTasks, imageTasks]);

  // Polling
  useEffect(() => {
    const timer = setInterval(async () => {
      // Polling Logic...
      const activeV = videoTasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (activeV.length > 0) {
        const results = await Promise.allSettled(activeV.map(async (task) => {
          const c = channels.find(ch => ch.id === task.channelId) || activeChannel;
          if (!c?.apiToken) return null;
          return { id: task.id, data: await queryVideoTask(c.baseUrl, c.apiToken, task.apiId!) };
        }));
        setVideoTasks(prev => prev.map(t => {
          const update = results.find(r => r.status === 'fulfilled' && r.value?.id === t.id);
          if (update && update.status === 'fulfilled' && update.value) {
            const api = update.value.data;
            const done = api.status === 'success' || !!api.result_video_url;
            return {
              ...t,
              status: done ? 'success' : api.status === 'failed' ? 'failed' : 'processing',
              progress: done ? 100 : (api.progress ? parseFloat(api.progress) : t.progress),
              videoUrl: api.result_video_url || t.videoUrl,
              coverUrl: api.cover_url || t.coverUrl,
              errorMessage: api.fail_reason
            };
          }
          return t;
        }));
      }

      const activeI = imageTasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (activeI.length > 0) {
        const results = await Promise.allSettled(activeI.map(async (task) => {
          const c = channels.find(ch => ch.id === task.channelId) || activeChannel;
          if (!c?.apiToken) return null;
          return { id: task.id, data: await queryImageTask(c.baseUrl, c.apiToken, task.apiId!) };
        }));
        setImageTasks(prev => prev.map(t => {
          const update = results.find(r => r.status === 'fulfilled' && r.value?.id === t.id);
          if (update && update.status === 'fulfilled' && update.value) {
            const api = update.value.data;
            const done = !!(api.result_url || (api.result_urls && api.result_urls.length > 0));
            return {
              ...t,
              status: done ? 'success' : api.status === 'failed' ? 'failed' : 'processing',
              resultUrl: api.result_url || t.resultUrl,
              resultUrls: api.result_urls || t.resultUrls,
              errorMessage: api.fail_reason
            };
          }
          return t;
        }));
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [videoTasks, imageTasks, activeChannel, channels]);

  const handleCreate = async () => {
    if (!activeChannel?.apiToken) { setError(t('missingToken')); return; }
    if (!inputPrompt.trim()) return;

    setError(null);
    const localId = Date.now().toString();
    
    // Capture values before clearing state
    const currentPrompt = inputPrompt;
    const currentRefs = [...referenceFiles];
    const currentHubMode = hubMode;
    const currentOrientation = orientation;
    const currentDuration = selectedDuration;
    const currentHD = selectedHD;
    const currentImageModel = selectedImageModel;
    const currentAspectRatio = selectedAspectRatio;
    const currentResolution = selectedResolution;
    const currentChannel = activeChannel;

    // Optimistic UI update: Clear inputs immediately
    setInputPrompt('');
    setReferenceFiles([]);

    // Logic: Fire and forget (Handle async in background)
    (async () => {
      try {
        if (currentHubMode === 'video') {
          const modelId = mapToSoraId(currentOrientation, currentDuration, currentHD);
          const newTask: VideoTask = { 
              id: localId, 
              prompt: currentPrompt, 
              model: modelId, 
              status: 'queued', 
              progress: 0, 
              createdAt: Date.now(), 
              channelId: currentChannel.id 
          };
          setVideoTasks(p => [newTask, ...p]);
          
          const apiId = await createVideoTask(
              currentChannel.baseUrl, 
              currentChannel.apiToken, 
              currentPrompt, 
              modelId
          );
          setVideoTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
        } else {
          const newTask: ImageTask = { 
              id: localId, 
              prompt: currentPrompt, 
              model: currentImageModel, 
              status: 'queued', 
              createdAt: Date.now(), 
              channelId: currentChannel.id, 
              type: currentRefs.length > 0 ? 'img2img' : 'txt2img' 
          };
          setImageTasks(p => [newTask, ...p]);

          const imageOptions = { aspectRatio: currentAspectRatio, resolution: currentResolution };

          if (currentImageModel === ImageModel.NANO_BANANA_PRO) {
            const res = await createNanoBananaPro4KTask(
                currentChannel.baseUrl, 
                currentChannel.apiToken, 
                currentPrompt, 
                currentRefs.map(r => r.file).filter(f => !!f) as File[],
                imageOptions
            );
            setImageTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'success', resultUrl: res[0], resultUrls: res } : t));
          } else {
            const apiId = currentRefs.length === 0 
              ? await createImageGenerationTask(currentChannel.baseUrl, currentChannel.apiToken, currentPrompt, currentImageModel, imageOptions)
              : await createImageEditTask(currentChannel.baseUrl, currentChannel.apiToken, currentPrompt, currentImageModel, currentRefs[0].file!, { aspect_ratio: currentAspectRatio, image_size: currentResolution });
            setImageTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
          }
        }
      } catch (e: any) {
        console.error("Task creation failed:", e);
        const errMsg = e.message || 'Unknown error';
        if (currentHubMode === 'video') setVideoTasks(p => p.map(t => t.id === localId ? {...t, status: 'failed', errorMessage: errMsg} : t));
        else setImageTasks(p => p.map(t => t.id === localId ? {...t, status: 'failed', errorMessage: errMsg} : t));
      }
    })();
  };

  const handleUrlDrop = async (url: string) => {
    setHubMode('image');
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], `ref_${Date.now()}.png`, { type: 'image/png' });
    const limit = IMAGE_MODEL_OPTIONS.find(o => o.value === selectedImageModel)?.maxRefs || 1;
    setReferenceFiles(prev => [...prev, { id: Date.now().toString(), file, url, name: file.name }].slice(-limit));
  };

  const handleSetCover = (index: number) => {
    if (!viewerTask) return;
    // Update the task in the main list
    const updatedTasks = imageTasks.map(t => t.id === viewerTask.id ? { ...t, coverIndex: index } : t);
    setImageTasks(updatedTasks);
    // Don't change viewerIndex, just update the cover state to allow user to see it reflected immediately if they close/reopen or check list
  };

  const sortedTasks = useMemo(() => [
    ...videoTasks.map(t => ({...t, hubType: 'video' as const})),
    ...imageTasks.map(t => ({...t, hubType: 'image' as const}))
  ].sort((a, b) => b.createdAt - a.createdAt), [videoTasks, imageTasks]);

  return (
    <div className="h-full relative bg-[#F5F5F7] overflow-hidden flex flex-col">
      {/* 沉浸式查看器 (Mac 风格渐变背景) */}
      {viewerTask && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-b from-gray-900 via-black to-gray-900 flex flex-col animate-in fade-in duration-300" onClick={() => setViewerTask(null)}>
            <div className="flex-1 flex items-center justify-center p-4 min-h-0 relative">
                <button className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all"><X size={28}/></button>
                <img 
                    src={viewerTask.resultUrls?.[viewerIndex] || viewerTask.resultUrl} 
                    className="max-w-full max-h-[85vh] object-contain shadow-[0_0_80px_rgba(0,0,0,0.5)] transition-transform" 
                    onClick={e => e.stopPropagation()}
                />
            </div>
            {/* 查看器详情栏 */}
            <div className="bg-white/5 backdrop-blur-3xl border-t border-white/10 p-8 flex flex-col md:flex-row gap-8 shrink-0 animate-in slide-in-from-bottom-8" onClick={e => e.stopPropagation()}>
                <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] bg-indigo-500/10 px-2 py-1 rounded">{viewerTask.model}</span>
                             <span className="text-[10px] text-white/30 font-bold">{new Date(viewerTask.createdAt).toLocaleString()}</span>
                        </div>
                        <button 
                            onClick={() => { navigator.clipboard.writeText(viewerTask.prompt); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }}
                            className="flex items-center gap-2 text-[12px] font-bold text-white/60 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-full"
                        >
                            {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            {isCopied ? 'Copied' : 'Copy Prompt'}
                        </button>
                    </div>
                    <div className="bg-black/30 p-4 rounded-2xl overflow-y-auto max-h-24 custom-scrollbar">
                        <p className="text-sm font-medium text-white/80 leading-relaxed italic">"{viewerTask.prompt}"</p>
                    </div>
                </div>
                {/* Horizontal Scrolling Gallery with Cover Selection */}
                {viewerTask.resultUrls && viewerTask.resultUrls.length > 1 && (
                    <div className="w-full md:w-auto md:max-w-2xl flex flex-col gap-4 shrink-0 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
                        <div className="flex items-center justify-between px-1">
                             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                <LayoutGrid size={12} />
                                Variations ({viewerTask.resultUrls.length})
                             </span>
                             <span className="text-[10px] text-indigo-400 font-bold opacity-60 hidden sm:inline-block">Click to View • Star to Cover</span>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar p-1">
                            {viewerTask.resultUrls.map((url, i) => {
                                // Find current cover index from the source of truth (imageTasks state)
                                const currentTask = imageTasks.find(t => t.id === viewerTask.id);
                                const isCover = (currentTask?.coverIndex || 0) === i;
                                const isSelected = viewerIndex === i;
                                
                                return (
                                <div key={i} className="relative group/thumb shrink-0">
                                    <div 
                                        onClick={() => setViewerIndex(i)}
                                        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-300 ${isSelected ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-100' : 'border-transparent opacity-50 hover:opacity-100 scale-95 hover:scale-100'}`} 
                                    >
                                        <img src={url} className="w-full h-full object-cover" />
                                    </div>
                                    
                                    {/* Set Cover Button */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleSetCover(i); }}
                                        className={`absolute -top-2 -right-2 w-7 h-7 flex items-center justify-center rounded-full shadow-lg border border-white/10 transition-all z-20 ${isCover ? 'bg-green-500 text-white scale-100' : 'bg-gray-800/80 backdrop-blur-md text-gray-400 hover:bg-indigo-500 hover:text-white opacity-0 group-hover/thumb:opacity-100 scale-75 hover:scale-100'}`}
                                        title={isCover ? "Current Cover" : "Set as Cover"}
                                    >
                                        <Star size={12} fill={isCover ? "currentColor" : "none"} strokeWidth={3} />
                                    </button>
                                </div>
                            )})}
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* 瀑布流内容区 */}
      <div className="flex-1 overflow-y-auto p-8 pb-80 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
            {sortedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] opacity-20 mt-12">
                    <Sparkles size={64} className="text-[#007AFF] mb-6" />
                    <h2 className="text-3xl font-black uppercase tracking-tighter">New Masterpiece Awaits</h2>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sortedTasks.map(task => (
                        task.hubType === 'video' ? (
                            <TaskCard key={task.id} task={task as VideoTask} lang={lang} />
                        ) : (
                            <div 
                                key={task.id} 
                                draggable 
                                onDragStart={e => e.dataTransfer.setData('text/plain', task.resultUrls?.[task.coverIndex || 0] || task.resultUrl || '')}
                                className="bg-white rounded-[32px] border border-black/5 shadow-apple-card hover:shadow-apple-hover transition-all duration-500 overflow-hidden group flex flex-col"
                            >
                                <div className="aspect-square bg-[#F5F5F7] relative cursor-pointer overflow-hidden" onClick={() => task.status === 'success' && (setViewerTask(task as ImageTask), setViewerIndex(task.coverIndex || 0))}>
                                    {task.status === 'success' ? (
                                        <>
                                            {/* 叠层效果: 如果有多张图，显示底层装饰 */}
                                            {task.resultUrls && task.resultUrls.length > 1 && (
                                                <>
                                                    <div className="absolute top-2 left-2 right-2 bottom-0 bg-gray-200 rounded-[28px] transform rotate-2 z-0"></div>
                                                    <div className="absolute top-1 left-1 right-1 bottom-1 bg-gray-100 rounded-[28px] transform -rotate-1 z-0"></div>
                                                </>
                                            )}
                                            
                                            <img src={task.resultUrls?.[task.coverIndex || 0] || task.resultUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700 relative z-10" />
                                            
                                            {task.resultUrls && task.resultUrls.length > 1 && (
                                                <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-2 py-1 rounded-xl text-[10px] text-white font-black flex items-center gap-1.5 border border-white/10 shadow-xl">
                                                    <Layers size={12} /> {task.resultUrls.length}
                                                </div>
                                            )}
                                            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white gap-3">
                                                <div className="p-4 bg-white/20 backdrop-blur-xl rounded-full"><Maximize2 size={32} /></div>
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/20">
                                                    <MousePointer2 size={10} /> Drag to Reuse
                                                </div>
                                            </div>
                                        </>
                                    ) : task.status === 'failed' ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-8 text-center animate-in zoom-in-95 duration-300 bg-[#FFF5F5] w-full h-full justify-center">
                                            <AlertCircle size={40} className="mb-4 opacity-50" />
                                            <span className="text-sm font-bold text-red-500 leading-relaxed max-w-[240px]">{task.errorMessage || t.failedGen}</span>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 relative">
                                               {task.coverUrl && <img src={task.coverUrl} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md scale-110" />}
                                               <div className="z-10 flex flex-col items-center gap-5">
                                                  <div className="relative"><Loader2 size={40} className="text-[#007AFF] animate-spin" /></div>
                                                  <div className="flex flex-col items-center">
                                                    <span className="text-xs text-[#007AFF] font-bold tracking-[0.2em] animate-pulse uppercase mb-2">{task.status === 'queued' ? t.wait : t.gen}</span>
                                                    <span className="text-[10px] font-mono text-[#86868B] bg-white/50 px-2 py-0.5 rounded-full">{Math.round(task.progress)}%</span>
                                                  </div>
                                               </div>
                                            </div>
                                    )}
                                </div>
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">{task.model}</span>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(task.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-xs font-bold text-[#1D1D1F] line-clamp-2 leading-relaxed h-[2.8rem] italic">"{task.prompt}"</p>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* 现代导演控制台 */}
      <div className="absolute bottom-0 left-0 right-0 p-8 pt-0 bg-gradient-to-t from-[#F5F5F7] via-[#F5F5F7]/95 to-transparent z-40">
        <div className="max-w-4xl mx-auto">
            <div className="bg-white/90 backdrop-blur-2xl rounded-[40px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.1)] border border-white p-3 flex flex-col gap-3">
                <div className="flex items-center gap-4 px-2">
                    {/* 模式切换 (Glassy Tabs) */}
                    <div className="bg-black/5 p-1 rounded-2xl flex shrink-0">
                        <button onClick={() => setHubMode('video')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${hubMode === 'video' ? 'bg-white text-[#007AFF] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}><Video size={14} /> Video</button>
                        <button onClick={() => setHubMode('image')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${hubMode === 'image' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}><ImageIcon size={14} /> Image</button>
                    </div>
                    
                    {/* 动态配置按钮组 */}
                    <div className="flex-1 flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
                        {hubMode === 'video' ? (
                            <>
                                {/* 方向组 */}
                                <div className="flex bg-black/5 p-1 rounded-2xl shrink-0 border border-black/5">
                                    <button 
                                        onClick={() => setOrientation('portrait')}
                                        className={`p-2.5 rounded-xl transition-all ${orientation === 'portrait' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-gray-400 hover:bg-white/50'}`}
                                    >
                                        <Smartphone size={20} />
                                    </button>
                                    <button 
                                        onClick={() => setOrientation('landscape')}
                                        className={`p-2.5 rounded-xl transition-all ${orientation === 'landscape' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-gray-400 hover:bg-white/50'}`}
                                    >
                                        <Monitor size={20} />
                                    </button>
                                </div>
                                {/* 时长与高清组 */}
                                <div className="flex gap-2 shrink-0">
                                    {SORA_CONFIGS[orientation].map((cfg, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => { setSelectedDuration(cfg.label); setSelectedHD(cfg.isHD); }}
                                            className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center gap-2 border-2 ${selectedDuration === cfg.label && selectedHD === cfg.isHD ? 'bg-white border-[#007AFF] text-[#007AFF] shadow-xl shadow-blue-500/10' : 'bg-black/5 border-transparent text-gray-500 hover:bg-black/10'}`}
                                        >
                                            {cfg.label}
                                            {cfg.isHD && <span className="flex items-center gap-0.5 bg-[#007AFF] text-white px-1.5 py-0.5 rounded-lg text-[8px] animate-pulse"><Star size={8} fill="currentColor" /> HD</span>}
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex gap-2 items-center">
                                {/* Model Selector */}
                                <div className="flex gap-2">
                                    {IMAGE_MODEL_OPTIONS.map(opt => (
                                        <button 
                                            key={opt.value}
                                            onClick={() => setSelectedImageModel(opt.value)}
                                            className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-2 ${selectedImageModel === opt.value ? 'bg-white border-indigo-500 text-indigo-600 shadow-xl shadow-indigo-500/10' : 'bg-black/5 border-transparent text-gray-500 hover:bg-black/10'}`}
                                        >
                                            {opt.label}
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${selectedImageModel === opt.value ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>{opt.badge}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="w-[1px] h-6 bg-black/5 mx-2" />
                                {/* Aspect Ratio */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <Crop size={14} />
                                        <select 
                                            value={selectedAspectRatio} 
                                            onChange={e => setSelectedAspectRatio(e.target.value)}
                                            className="bg-transparent text-[10px] font-bold outline-none cursor-pointer hover:text-indigo-600"
                                        >
                                            {ASPECT_RATIOS.map(ar => <option key={ar} value={ar}>{ar}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <Scaling size={14} />
                                        <select 
                                            value={selectedResolution} 
                                            onChange={e => setSelectedResolution(e.target.value)}
                                            className="bg-transparent text-[10px] font-bold outline-none cursor-pointer hover:text-indigo-600"
                                        >
                                            {RESOLUTIONS.map(res => <option key={res} value={res}>{res}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 输入区 & 参考图槽位 */}
                <div 
                    className="flex flex-col gap-3 p-1"
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50/50'); }}
                    onDragLeave={e => e.currentTarget.classList.remove('bg-blue-50/50')}
                    onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('bg-blue-50/50');
                        const url = e.dataTransfer.getData('text/plain');
                        if (url) handleUrlDrop(url);
                        else if (e.dataTransfer.files.length > 0) {
                            // Fixed: Explicitly type 'f' as 'File' to resolve 'unknown' type error in Array.from().map()
                            const files = Array.from(e.dataTransfer.files).map((f: File) => ({ id: Math.random().toString(), file: f, url: URL.createObjectURL(f), name: f.name }));
                            const limit = IMAGE_MODEL_OPTIONS.find(o => o.value === selectedImageModel)?.maxRefs || 1;
                            setReferenceFiles(prev => [...prev, ...files].slice(-limit));
                        }
                    }}
                >
                    {referenceFiles.length > 0 && (
                        <div className="flex gap-2 px-2 flex-wrap max-h-32 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-4">
                            {referenceFiles.map(rf => (
                                <div key={rf.id} className="relative group/slot shrink-0 w-14 h-14 rounded-2xl border-4 border-white shadow-lg overflow-hidden transition-transform hover:scale-110">
                                    <img src={rf.url} className="w-full h-full object-cover" />
                                    <button onClick={() => setReferenceFiles(p => p.filter(f => f.id !== rf.id))} className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-2xl bg-black/5 border-4 border-white shadow-lg flex items-center justify-center text-gray-400 hover:text-[#007AFF] hover:bg-white transition-all"><Plus size={20}/></button>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
                        if (e.target.files) {
                            // Fixed: Explicitly type 'f' as 'File' to resolve 'unknown' type error in Array.from().map()
                            const files = Array.from(e.target.files).map((f: File) => ({ id: Math.random().toString(), file: f, url: URL.createObjectURL(f), name: f.name }));
                            const limit = IMAGE_MODEL_OPTIONS.find(o => o.value === selectedImageModel)?.maxRefs || 1;
                            setReferenceFiles(prev => [...prev, ...files].slice(-limit));
                        }
                    }} />
                    
                    <div className="flex items-end gap-3 px-2">
                        <div className="flex-1 bg-black/5 rounded-[30px] px-6 py-4 focus-within:bg-white focus-within:shadow-inner transition-all border border-transparent focus-within:border-black/5">
                            <textarea 
                                rows={1}
                                value={inputPrompt}
                                onChange={e => setInputPrompt(e.target.value)}
                                className="w-full bg-transparent border-none p-0 focus:ring-0 text-base font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none resize-none"
                                placeholder="What's your next visual masterpiece?"
                            />
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                            <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 flex items-center justify-center rounded-full bg-white border border-black/5 text-gray-400 hover:text-[#007AFF] shadow-sm transition-all hover:shadow-md active:scale-95"><ImageIcon size={20}/></button>
                            <button 
                                onClick={handleCreate}
                                disabled={!inputPrompt.trim()}
                                className="w-14 h-14 flex items-center justify-center rounded-full bg-[#1D1D1F] text-white shadow-2xl hover:bg-black transition-all hover:scale-105 active:scale-90 disabled:opacity-20 disabled:scale-100"
                            >
                                <Send size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {error && <div className="text-[10px] font-black text-red-500 flex items-center gap-1.5 px-8 pt-2 animate-in slide-in-from-top-1"><AlertTriangle size={12}/> {error}</div>}
        </div>
      </div>
    </div>
  );
};