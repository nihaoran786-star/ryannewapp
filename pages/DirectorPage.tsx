
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, AlertTriangle, Loader2, Plus, Trash2, Video, X, 
  Send, Sparkles, ImagePlus, Check, Monitor, Smartphone, 
  Film, Wind, Camera, Layers
} from 'lucide-react';
import { 
  VideoTask, SoraModel, MODEL_OPTIONS
} from '../types';
import { 
  createVideoTask, createVideoI2VTask, queryVideoTask 
} from '../services/soraService';
import { TaskCard } from '../components/TaskCard';
import { useGlobal } from '../context/GlobalContext';

interface ReferenceFile {
  id: string;
  file?: File;
  url: string;
  name: string;
}

export const DirectorPage = () => {
  const { t, lang, activeChannel, channels } = useGlobal();

  const [videoTasks, setVideoTasks] = useState<VideoTask[]>([]);
  const [selectedModel, setSelectedModel] = useState<SoraModel>(SoraModel.SORA_V2);
  const [motionIntensity, setMotionIntensity] = useState(5);
  const [cameraMovement, setCameraMovement] = useState('none');
  
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [referenceFile, setReferenceFile] = useState<ReferenceFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  // 预设镜头风格
  const CAMERA_STYLES = [
    { value: 'none', label: lang === 'zh' ? '固定镜头' : 'Static' },
    { value: 'zoom_in', label: lang === 'zh' ? '推镜头' : 'Zoom In' },
    { value: 'pan_left', label: lang === 'zh' ? '左摇' : 'Pan Left' },
    { value: 'orbit', label: lang === 'zh' ? '环绕' : 'Orbit' },
    { value: 'crane_up', label: lang === 'zh' ? '升起' : 'Crane Up' }
  ];

  useEffect(() => {
    const saved = localStorage.getItem('sora_v2_tasks');
    if (saved) setVideoTasks(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('sora_v2_tasks', JSON.stringify(videoTasks));
  }, [videoTasks]);

  // 轮询逻辑
  useEffect(() => {
    const interval = setInterval(async () => {
      const processing = videoTasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (processing.length === 0) return;

      const updates = await Promise.allSettled(processing.map(async task => {
        if (!task.apiId) return null;
        const channel = channels.find(c => c.id === task.channelId) || activeChannel;
        if (!channel?.apiToken) return null;
        return { localId: task.id, data: await queryVideoTask(channel.baseUrl, channel.apiToken, task.apiId) };
      }));

      setVideoTasks(curr => curr.map(task => {
        const update = updates.find(u => u.status === 'fulfilled' && u.value?.localId === task.id);
        if (update && update.status === 'fulfilled' && update.value) {
          const api = update.value.data;
          const isDone = api.status === 'success' || !!api.result_video_url;
          return {
            ...task,
            status: isDone ? 'success' : api.status === 'failed' ? 'failed' : 'processing',
            progress: isDone ? 100 : (api.progress ? parseFloat(api.progress) : task.progress),
            videoUrl: api.result_video_url || task.videoUrl,
            coverUrl: api.cover_url || task.coverUrl,
            errorMessage: api.fail_reason
          };
        }
        return task;
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, [videoTasks, channels, activeChannel]);

  const handleCreate = async () => {
    if (!activeChannel?.apiToken) { setError(t('missingToken')); return; }
    if (!inputPrompt.trim()) return;

    setIsSubmitting(true);
    setError(null);
    const localId = Date.now().toString();

    const newTask: VideoTask = {
      id: localId,
      prompt: inputPrompt,
      model: selectedModel,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      channelId: activeChannel.id,
      motionIntensity,
      cameraMovement
    };

    setVideoTasks(prev => [newTask, ...prev]);

    try {
      let apiId = '';
      if (referenceFile?.file) {
        apiId = await createVideoI2VTask(activeChannel.baseUrl, activeChannel.apiToken, inputPrompt, selectedModel, referenceFile.file);
      } else {
        apiId = await createVideoTask(activeChannel.baseUrl, activeChannel.apiToken, inputPrompt, selectedModel, {
          motion_intensity: motionIntensity,
          camera_movement: cameraMovement
        });
      }
      setVideoTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
      setInputPrompt('');
      setReferenceFile(null);
    } catch (err: any) {
      setError(err.message);
      setVideoTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'failed', errorMessage: err.message } : t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F5F7]">
      {/* 顶部创作状态栏 */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-8 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
            <Film size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#1D1D1F] tracking-tight uppercase">Sora 2.0 Studio</h2>
            <p className="text-[10px] text-blue-600 font-bold tracking-widest uppercase opacity-70">Professional Cinematic Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setSelectedModel(SoraModel.SORA_V2)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedModel === SoraModel.SORA_V2 ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>PRO</button>
              <button onClick={() => setSelectedModel(SoraModel.SORA2_LANDSCAPE)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedModel === SoraModel.SORA2_LANDSCAPE ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>STD</button>
           </div>
        </div>
      </div>

      <div ref={galleryRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {videoTasks.length === 0 ? (
            <div className="h-[40vh] flex flex-col items-center justify-center text-center opacity-30 mt-20">
              <Sparkles className="text-blue-600 mb-6 animate-pulse" size={64} />
              <h2 className="text-3xl font-black text-[#1D1D1F] uppercase tracking-tighter">Ready for Sora 2.0?</h2>
              <p className="text-sm font-medium mt-3">Start your cinematic journey with high-fidelity simulations.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
              {videoTasks.map(task => (
                <TaskCard key={task.id} task={task} lang={lang} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部悬浮控制中心 */}
      <div className="absolute bottom-8 left-0 right-0 px-8 pointer-events-none">
        <div className="max-w-4xl mx-auto bg-white/90 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-white/50 p-3 pointer-events-auto ring-1 ring-black/5">
          <div className="flex flex-col gap-3">
            {/* 专家参数区 */}
            <div className="flex items-center gap-6 px-4 py-2 border-b border-gray-50 overflow-x-auto no-scrollbar">
               <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Wind size={12}/> Motion</span>
                  <input type="range" min="1" max="10" value={motionIntensity} onChange={e => setMotionIntensity(parseInt(e.target.value))} className="w-24 accent-blue-600" />
                  <span className="text-[10px] font-bold text-blue-600 w-4">{motionIntensity}</span>
               </div>
               <div className="w-px h-4 bg-gray-100 shrink-0" />
               <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Camera size={12}/> Camera</span>
                  <div className="flex items-center gap-1">
                    {CAMERA_STYLES.map(style => (
                      <button 
                        key={style.value} 
                        onClick={() => setCameraMovement(style.value)}
                        className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${cameraMovement === style.value ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            {/* 输入区 */}
            <div className="flex items-end gap-3 px-2 pb-2">
              <div className="flex-1 bg-gray-50 rounded-2xl flex flex-col p-1.5 focus-within:bg-white transition-all ring-1 ring-transparent focus-within:ring-blue-100">
                {referenceFile && (
                  <div className="p-2 animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 bg-blue-50/50 p-1.5 rounded-xl border border-blue-100 w-fit">
                      <img src={referenceFile.url} className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                      <div className="pr-2"><span className="block text-[8px] font-black text-blue-400 uppercase">I2V Reference</span><span className="block text-[9px] font-bold text-blue-800 truncate max-w-[100px]">{referenceFile.name}</span></div>
                      <button onClick={() => setReferenceFile(null)} className="p-1 hover:bg-white rounded-full text-blue-400"><X size={14} /></button>
                    </div>
                  </div>
                )}
                <textarea 
                  value={inputPrompt}
                  onChange={e => setInputPrompt(e.target.value)}
                  placeholder={t('promptPlaceholder')}
                  className="bg-transparent border-none p-3 focus:ring-0 w-full text-sm font-medium text-[#1D1D1F] placeholder:text-gray-400 resize-none min-h-[50px] max-h-[150px] outline-none"
                />
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${referenceFile ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                >
                  <ImagePlus size={20} />
                  <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setReferenceFile({ id: Date.now().toString(), file: f, url: URL.createObjectURL(f), name: f.name });
                  }} />
                </button>
                <button 
                  onClick={handleCreate}
                  disabled={isSubmitting || !inputPrompt.trim()}
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all shadow-xl active:scale-95 ${isSubmitting || !inputPrompt.trim() ? 'bg-gray-100 text-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
                >
                  {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        {error && (
          <div className="max-w-4xl mx-auto mt-4 animate-in slide-in-from-bottom-2">
            <div className="bg-red-50 text-red-500 p-3 rounded-2xl flex items-center justify-between border border-red-100 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold"><AlertTriangle size={14} /> {error}</div>
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
