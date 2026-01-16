
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AlertTriangle, Loader2, Plus, Trash2, Video, X, 
  Image as ImageIcon, Maximize2, Send, Sparkles,
  Smartphone, Monitor, Star, LayoutGrid, Check, Copy,
  MousePointer2, AlertCircle, Layers, Crop, Scaling,
  ChevronDown, MonitorPlay, Tablet, Hash, Ratio, Settings2
} from 'lucide-react';
import { 
  VideoTask, SoraModel, ImageTask, ImageModel, IMAGE_MODEL_OPTIONS
} from '../types';
import { createVideoTask, queryVideoTask } from '../services/soraService';
import { createImageGenerationTask, queryImageTask, createNanoBananaPro4KTask, createImageEditTask } from '../services/imageService';
import { TaskCard } from '../components/TaskCard';
import { useGlobal } from '../context/GlobalContext';

/**
 * [Context]: 高级玻璃拟态下拉选择器 (移植自导演操作台)
 * [Logic]: 
 * 1. 使用 bottom-full 确保在底部工具栏中向上弹出。
 * 2. 移除父级 overflow-hidden 约束，确保菜单 z-index 穿透。
 * [Note for future AI]: 菜单位置由 position 属性控制，默认为 'top' 以适应底部固定栏。
 */
const CustomSelect = ({ label, value, options, onChange, icon: Icon = ChevronDown, colorClass = "text-[#007AFF]", position = "top" }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find((o: any) => o.value === value)?.label || value;

    return (
        <div className="relative shrink-0" ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`bg-black/5 hover:bg-black/10 rounded-2xl px-5 py-3.5 transition-all flex flex-col min-w-[140px] group cursor-pointer ${isOpen ? 'bg-white shadow-xl ring-2 ring-black/5' : ''}`}
            >
                <span className="text-[7px] font-black text-gray-400 uppercase block mb-0.5 tracking-widest">{label}</span>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#1D1D1F] uppercase truncate mr-2">{selectedLabel}</span>
                    <Icon size={12} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 ' + colorClass : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className={`absolute ${position === 'top' ? 'bottom-full mb-3' : 'top-full mt-2'} left-0 right-0 bg-white/90 backdrop-blur-2xl border border-black/5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[110] overflow-hidden py-1 animate-in ${position === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-300`}>
                    {options.map((opt: any) => (
                        <div 
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`px-5 py-3 text-[10px] font-black uppercase transition-colors cursor-pointer flex items-center justify-between
                                ${value === opt.value ? colorClass + ' bg-black/5' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                        >
                            {opt.label}
                            {value === opt.value && <Check size={12} strokeWidth={4} />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface ReferenceFile {
  id: string;
  file?: File;
  url: string;
  name: string;
}

const SORA_CONFIG_OPTIONS = [
  { label: '10秒 标准', value: '10s-normal', duration: '10s', isHD: false },
  { label: '15秒 标准', value: '15s-normal', duration: '15s', isHD: false },
  { label: '15秒 高清 Pro', value: '15s-hd', duration: '15s', isHD: true },
  { label: '25秒 电影级', value: '25s-normal', duration: '25s', isHD: false },
];

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '4:5', '5:4', '21:9'].map(r => ({ label: r, value: r }));
const RESOLUTIONS = ['1K', '2K', '4K'].map(r => ({ label: r, value: r }));

const mapToSoraId = (orientation: 'portrait' | 'landscape', duration: string, isHD: boolean): SoraModel => {
  const prefix = orientation === 'portrait' ? 'SORA2_PORTRAIT' : 'SORA2_LANDSCAPE';
  if (duration === '15s' && isHD) return orientation === 'portrait' ? SoraModel.SORA2_PRO_PORTRAIT_HD_15S : SoraModel.SORA2_PRO_LANDSCAPE_HD_15S;
  if (duration === '25s') return orientation === 'portrait' ? SoraModel.SORA2_PRO_PORTRAIT_25S : SoraModel.SORA2_PRO_LANDSCAPE_25S;
  if (duration === '15s') return orientation === 'portrait' ? SoraModel.SORA2_PORTRAIT_15S : SoraModel.SORA2_LANDSCAPE_15S;
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
  const [selectedConfigKey, setSelectedConfigKey] = useState('15s-hd');

  // --- Image Selector States ---
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModel>(ImageModel.NANO_BANANA_2);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1');
  const [selectedResolution, setSelectedResolution] = useState('1K');
  
  const [inputPrompt, setInputPrompt] = useState('');
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [viewerTask, setViewerTask] = useState<ImageTask | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem('sora_v2_tasks');
      const i = localStorage.getItem('sora_image_tasks');
      if (v) setVideoTasks(JSON.parse(v).slice(0, 30));
      if (i) setImageTasks(JSON.parse(i).slice(0, 30));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    localStorage.setItem('sora_v2_tasks', JSON.stringify(videoTasks));
    localStorage.setItem('sora_image_tasks', JSON.stringify(imageTasks));
  }, [videoTasks, imageTasks]);

  useEffect(() => {
    const timer = setInterval(async () => {
      const activeV = videoTasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (activeV.length > 0) {
        const results = await Promise.allSettled(activeV.map(async (task) => {
          const c = channels.find(ch => ch.id === task.channelId) || activeChannel;
          if (!c?.apiToken || !task.apiId) return null;
          return { id: task.id, data: await queryVideoTask(c.baseUrl, c.apiToken, task.apiId) };
        }));
        setVideoTasks(prev => prev.map(t => {
          const update = results.find(r => r.status === 'fulfilled' && r.value?.id === t.id);
          if (update && update.status === 'fulfilled' && update.value) {
            const api = update.value.data;
            const done = api.status === 'success' || !!api.result_video_url;
            return { ...t, status: done ? 'success' : api.status === 'failed' ? 'failed' : 'processing', progress: done ? 100 : (api.progress ? parseFloat(api.progress) : t.progress), videoUrl: api.result_video_url || t.videoUrl, coverUrl: api.cover_url || t.coverUrl, errorMessage: api.fail_reason };
          }
          return t;
        }));
      }

      const activeI = imageTasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (activeI.length > 0) {
        const results = await Promise.allSettled(activeI.map(async (task) => {
          const c = channels.find(ch => ch.id === task.channelId) || activeChannel;
          if (!c?.apiToken || !task.apiId) return null;
          return { id: task.id, data: await queryImageTask(c.baseUrl, c.apiToken, task.apiId) };
        }));
        setImageTasks(prev => prev.map(t => {
          const update = results.find(r => r.status === 'fulfilled' && r.value?.id === t.id);
          if (update && update.status === 'fulfilled' && update.value) {
            const api = update.value.data;
            const done = !!(api.result_url || (api.result_urls && api.result_urls.length > 0));
            return { ...t, status: done ? 'success' : api.status === 'failed' ? 'failed' : 'processing', resultUrl: api.result_url || t.resultUrl, resultUrls: api.result_urls || t.resultUrls, errorMessage: api.fail_reason };
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
    const currentPrompt = inputPrompt;
    const currentRefs = [...referenceFiles];
    const currentHubMode = hubMode;
    const currentOrientation = orientation;
    
    // Get config from key
    const config = SORA_CONFIG_OPTIONS.find(o => o.value === selectedConfigKey) || SORA_CONFIG_OPTIONS[2];
    const currentDuration = config.duration;
    const currentHD = config.isHD;
    
    const currentImageModel = selectedImageModel;
    const currentAspectRatio = selectedAspectRatio;
    const currentResolution = selectedResolution;
    const currentChannel = activeChannel;
    setInputPrompt(''); setReferenceFiles([]);

    (async () => {
      try {
        if (currentHubMode === 'video') {
          const modelId = mapToSoraId(currentOrientation, currentDuration, currentHD);
          const newTask: VideoTask = { id: localId, prompt: currentPrompt, model: modelId, status: 'queued', progress: 0, createdAt: Date.now(), channelId: currentChannel.id };
          setVideoTasks(p => [newTask, ...p]);
          const apiId = await createVideoTask(currentChannel.baseUrl, currentChannel.apiToken, currentPrompt, modelId);
          setVideoTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
        } else {
          const newTask: ImageTask = { id: localId, prompt: currentPrompt, model: currentImageModel, status: 'queued', createdAt: Date.now(), channelId: currentChannel.id, type: currentRefs.length > 0 ? 'img2img' : 'txt2img', sourceImagePreview: currentRefs.length > 0 ? currentRefs[0].url : undefined };
          setImageTasks(p => [newTask, ...p]);
          if (currentImageModel === ImageModel.NANO_BANANA_PRO || currentImageModel === ImageModel.NANO_BANANA_PRO_CHAT) {
            const res = await createNanoBananaPro4KTask(currentChannel.baseUrl, currentChannel.apiToken, currentPrompt, currentRefs.map(r => r.file).filter(f => !!f) as File[], { aspectRatio: currentAspectRatio, resolution: currentResolution }, currentImageModel);
            setImageTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'success', resultUrl: res[0], resultUrls: res } : t));
          } else {
            const apiId = currentRefs.length === 0 ? await createImageGenerationTask(currentChannel.baseUrl, currentChannel.apiToken, currentPrompt, currentImageModel, { aspectRatio: currentAspectRatio, resolution: currentResolution }) : await createImageEditTask(currentChannel.baseUrl, currentChannel.apiToken, currentPrompt, currentImageModel, currentRefs[0].file!, { aspect_ratio: currentAspectRatio, image_size: currentResolution });
            setImageTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
          }
        }
      } catch (e: any) {
        if (currentHubMode === 'video') setVideoTasks(p => p.map(t => t.id === localId ? {...t, status: 'failed', errorMessage: e.message} : t));
        else setImageTasks(p => p.map(t => t.id === localId ? {...t, status: 'failed', errorMessage: e.message} : t));
      }
    })();
  };

  const sortedTasks = useMemo(() => [...videoTasks.map(t => ({...t, hubType: 'video' as const})), ...imageTasks.map(t => ({...t, hubType: 'image' as const}))].sort((a, b) => b.createdAt - a.createdAt), [videoTasks, imageTasks]);

  return (
    <div className="h-full relative bg-[#F5F5F7] overflow-hidden flex flex-col font-sans">
      {viewerTask && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-300" onClick={() => setViewerTask(null)}>
            <div className="flex-1 flex items-center justify-center p-4 relative">
                <button className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all"><X size={28}/></button>
                <img src={viewerTask.resultUrls?.[viewerIndex] || viewerTask.resultUrl} className="max-w-full max-h-[85vh] object-contain shadow-2xl" onClick={e => e.stopPropagation()}/>
            </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 pb-80 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
            {sortedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] opacity-20 mt-12">
                  <Sparkles size={64} className="text-[#007AFF] mb-6" />
                  <h2 className="text-3xl font-black uppercase tracking-tighter">{lang === 'zh' ? '开启您的视觉之旅' : 'Start Your Creation'}</h2>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sortedTasks.map(task => (
                        task.hubType === 'video' ? ( <TaskCard key={task.id} task={task as VideoTask} lang={lang} /> ) : (
                            <div key={task.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', task.resultUrls?.[task.coverIndex || 0] || task.resultUrl || '')} className="bg-white rounded-[32px] border border-black/5 shadow-apple-card hover:shadow-apple-hover transition-all duration-500 overflow-hidden group flex flex-col">
                                <div className="aspect-square bg-[#F5F5F7] relative cursor-pointer overflow-hidden" onClick={() => task.status === 'success' && (setViewerTask(task as ImageTask), setViewerIndex(task.coverIndex || 0))}>
                                    {task.status === 'success' ? <img src={task.resultUrls?.[task.coverIndex || 0] || task.resultUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" /> : task.status === 'failed' ? <div className="w-full h-full flex flex-col items-center justify-center text-red-400 bg-red-50"><AlertCircle size={40} className="mb-4 opacity-50" /><span className="text-sm font-bold">{t('generationFailed')}</span></div> : <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50"><Loader2 size={40} className="text-[#007AFF] animate-spin" /></div>}
                                </div>
                                <div className="p-6"><div className="flex items-center justify-between mb-2"><span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">{task.model}</span><span className="text-[9px] font-bold text-gray-400">{new Date(task.createdAt).toLocaleTimeString()}</span></div><p className="text-xs font-bold text-[#1D1D1F] line-clamp-2 italic">"{task.prompt}"</p></div>
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* 底部创作栏 - 注意 z-index 和 overflow 属性，确保上拉框正常显示 */}
      <div className="absolute bottom-0 left-0 right-0 p-8 pt-0 bg-gradient-to-t from-[#F5F5F7] via-[#F5F5F7]/95 to-transparent z-[50]">
        <div className="max-w-4xl mx-auto">
            <div className="bg-white/90 backdrop-blur-2xl rounded-[40px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.1)] border border-white p-3 flex flex-col gap-3">
                <div className="flex items-center gap-4 px-2">
                    <div className="bg-black/5 p-1 rounded-2xl flex shrink-0">
                        <button onClick={() => setHubMode('video')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${hubMode === 'video' ? 'bg-white text-[#007AFF] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}><Video size={14} /> {lang === 'zh' ? '视频' : 'Video'}</button>
                        <button onClick={() => setHubMode('image')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${hubMode === 'image' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}><ImageIcon size={14} /> {lang === 'zh' ? '图像' : 'Image'}</button>
                    </div>
                    <div className="flex-1 flex items-center gap-2 overflow-visible py-1">
                        {hubMode === 'video' ? (
                            <>
                                <div className="flex bg-black/5 p-1 rounded-2xl shrink-0 mr-2">
                                    <button onClick={() => setOrientation('portrait')} className={`p-2.5 rounded-xl transition-all ${orientation === 'portrait' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-gray-400 hover:bg-white/50'}`} title={lang === 'zh' ? '竖屏' : 'Portrait'}><Smartphone size={20} /></button>
                                    <button onClick={() => setOrientation('landscape')} className={`p-2.5 rounded-xl transition-all ${orientation === 'landscape' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-gray-400 hover:bg-white/50'}`} title={lang === 'zh' ? '横屏' : 'Landscape'}><Monitor size={20} /></button>
                                </div>
                                <CustomSelect 
                                    label={lang === 'zh' ? '生成档位' : 'Video Gear'} 
                                    value={selectedConfigKey} 
                                    options={SORA_CONFIG_OPTIONS} 
                                    onChange={setSelectedConfigKey}
                                    icon={MonitorPlay}
                                />
                            </>
                        ) : (
                            <div className="flex gap-2 items-center">
                                <CustomSelect 
                                    label={lang === 'zh' ? '渲染引擎' : 'Render Engine'} 
                                    value={selectedImageModel} 
                                    options={IMAGE_MODEL_OPTIONS} 
                                    onChange={setSelectedImageModel} 
                                    colorClass="text-indigo-600"
                                    icon={Settings2}
                                />
                                <div className="w-[1px] h-8 bg-black/5 mx-1" />
                                <CustomSelect 
                                    label={lang === 'zh' ? '画面比例' : 'Aspect Ratio'} 
                                    value={selectedAspectRatio} 
                                    options={ASPECT_RATIOS} 
                                    onChange={setSelectedAspectRatio} 
                                    colorClass="text-indigo-600"
                                    icon={Ratio}
                                />
                                <CustomSelect 
                                    label={lang === 'zh' ? '分辨率' : 'Resolution'} 
                                    value={selectedResolution} 
                                    options={RESOLUTIONS} 
                                    onChange={setSelectedResolution} 
                                    colorClass="text-indigo-600"
                                    icon={Maximize2}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3 p-1">
                    <div className="flex items-end gap-3 px-2">
                        <div className="flex-1 bg-black/5 rounded-[30px] px-6 py-4 focus-within:bg-white focus-within:shadow-inner transition-all border border-transparent focus-within:border-black/5">
                            <textarea 
                              rows={1} 
                              value={inputPrompt} 
                              onChange={e => setInputPrompt(e.target.value)} 
                              className="w-full bg-transparent border-none p-0 focus:ring-0 text-base font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none resize-none" 
                              placeholder={lang === 'zh' ? '描述您脑海中的视觉画面...' : "What's your visual idea?"} 
                            />
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                             <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 flex items-center justify-center rounded-full bg-white border border-black/5 text-gray-400 hover:text-[#007AFF] shadow-sm transition-all" title={lang === 'zh' ? '上传参考图' : 'Upload Ref'}><ImageIcon size={20}/></button>
                             <button onClick={handleCreate} disabled={!inputPrompt.trim()} className="w-14 h-14 flex items-center justify-center rounded-full bg-[#1D1D1F] text-white shadow-2xl hover:bg-black transition-all hover:scale-105 active:scale-90 disabled:opacity-20"> <Send size={24} /> </button>
                        </div>
                    </div>
                </div>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) { const files = Array.from(e.target.files).map((f: any) => ({ id: Math.random().toString(), file: f, url: URL.createObjectURL(f), name: f.name })); setReferenceFiles(prev => [...prev, ...files]); } }} />
        </div>
      </div>
    </div>
  );
};
