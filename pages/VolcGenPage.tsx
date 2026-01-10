import React, { useState, useEffect } from 'react';
import { 
  Flame, Layers, ChevronDown, Zap, AlertTriangle, 
  Loader2, Plus, Trash2, Video 
} from 'lucide-react';
import { VideoTask, VolcModel, VOLC_MODEL_OPTIONS, TaskStatus } from '../types';
import { createVolcTask, queryVolcTask } from '../services/volcEngineService';
import { TaskCard } from '../components/TaskCard';
import { useGlobal } from '../context/GlobalContext';

/**
 * VolcGenPage
 * Dedicated interface for Volc Engine video generation.
 * Separated from DirectorPage to adhere to feature freeze protocols.
 */
export const VolcGenPage = () => {
  const { t, lang, activeChannel, channels } = useGlobal();

  const [prompt, setPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<VolcModel>(VolcModel.PIXEL_DANCE_V1);
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling Logic for Volc Tasks
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const activeTasks = tasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (activeTasks.length === 0) return;

      const updates = await Promise.allSettled(activeTasks.map(async (task) => {
        if (!task.apiId) return null;
        
        const targetChannel = channels.find(c => c.id === task.channelId) || activeChannel;
        if (!targetChannel || !targetChannel.apiToken) return null;

        try {
          const data = await queryVolcTask(targetChannel.baseUrl, targetChannel.apiToken, task.apiId);
          return { localId: task.id, apiData: data };
        } catch (err) {
          console.error(`Volc Polling failed for ${task.id}`, err);
          return null;
        }
      }));

      setTasks(currentTasks => {
        return currentTasks.map(task => {
          const updateResult = updates.find(
            u => u.status === 'fulfilled' && u.value && u.value.localId === task.id
          );
          
          if (updateResult && updateResult.status === 'fulfilled' && updateResult.value) {
            const { apiData } = updateResult.value;
            let newStatus: TaskStatus = task.status;
            let newProgress = task.progress;

            if (apiData.progress) {
                const pVal = typeof apiData.progress === 'string' 
                  ? parseFloat(apiData.progress.replace('%', '')) 
                  : apiData.progress;
                if (!isNaN(pVal)) {
                    if (pVal <= 1 && pVal > 0) newProgress = pVal * 100;
                    else newProgress = pVal;
                }
            }

            const apiStatusRaw = (String(apiData.status || '')).toLowerCase();
            const hasVideoUrl = !!apiData.result_video_url;
            const isSuccess = ['success', 'succeed', 'finished'].includes(apiStatusRaw) || (newProgress >= 100 && hasVideoUrl);
            const isFailed = ['failed', 'error'].includes(apiStatusRaw);

            if (hasVideoUrl || isSuccess) {
              newStatus = 'success';
              newProgress = 100;
            } else if (isFailed) {
              newStatus = 'failed';
            } else {
              newStatus = 'processing';
            }

            if (newStatus !== task.status || newProgress !== task.progress || apiData.result_video_url !== task.videoUrl) {
              return {
                ...task,
                status: newStatus,
                progress: newProgress,
                videoUrl: apiData.result_video_url || task.videoUrl,
                coverUrl: apiData.cover_url || task.coverUrl,
                errorMessage: apiData.fail_reason
              };
            }
          }
          return task;
        });
      });
    }, 5000); 
    
    return () => clearInterval(pollInterval);
  }, [tasks, channels, activeChannel]);

  const handleCreateTask = async () => {
    if (!activeChannel?.apiToken) {
      setError(`${t('missingToken')}`);
      return;
    }
    if (!prompt.trim()) {
      setError(lang === 'zh' ? '请输入提示词' : 'Please enter a prompt.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const localId = Date.now().toString();

    const newTask: VideoTask = {
      id: localId,
      prompt: prompt,
      model: selectedModel,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      channelId: activeChannel?.id
    };
    setTasks(prev => [newTask, ...prev]);

    try {
      const apiId = await createVolcTask(activeChannel.baseUrl, activeChannel.apiToken, prompt, selectedModel);
      setTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
      setPrompt(''); 
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'failed', errorMessage: err.message } : t));
      setError(err.message || 'Task creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 custom-scrollbar animate-in fade-in duration-500 bg-[#F5F5F7]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Panel: Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[24px] p-6 shadow-apple-card border border-white/50 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-orange-500/10 rounded-xl">
                <Flame className="text-orange-500 w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-[#1D1D1F]">{t('volcEngine')}</h2>
            </div>
            
            <div className="space-y-4 mb-6">
              <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
                <Layers size={12} /> {t('model')}
              </label>
              <div className="relative">
                  <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value as VolcModel)}
                      className="w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3.5 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none cursor-pointer transition-all hover:bg-[#E5E5EA]"
                  >
                      {VOLC_MODEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                          {opt.label}
                      </option>
                      ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <ChevronDown size={16} />
                  </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
                <Zap size={12} /> {t('storyPrompt')}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('promptPlaceholder')}
                className="w-full bg-[#F5F5F7] border-none rounded-2xl p-4 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-orange-500/20 min-h-[180px] resize-none outline-none placeholder:text-gray-400 transition-all hover:bg-[#E5E5EA]"
              />
            </div>
            {error && (
              <div className="mb-6 bg-red-50 text-red-600 rounded-xl p-4 flex items-start gap-3 border border-red-100">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">{error}</p>
              </div>
            )}
            <button
              onClick={handleCreateTask}
              disabled={isSubmitting || !activeChannel?.apiToken}
              className={`w-full py-4 px-4 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-orange-500/20
                ${isSubmitting || !activeChannel?.apiToken
                  ? 'bg-[#E5E5EA] text-[#86868B] cursor-not-allowed shadow-none' 
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" /> {t('submitting')}</>
              ) : (
                <><Plus size={18} strokeWidth={2.5} /> {t('submit')}</>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: Task History */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-[#1D1D1F] flex items-center gap-3 tracking-tight">
              {t('history')}
              {tasks.length > 0 && <span className="bg-[#E5E5EA] text-[#86868B] text-[11px] px-2.5 py-0.5 rounded-full font-semibold">{tasks.length}</span>}
            </h2>
            {tasks.length > 0 && (
              <button 
                onClick={() => confirm(t('clearHistoryConfirm')) && setTasks([])}
                className="px-4 py-2 bg-white hover:bg-red-50 hover:text-red-600 rounded-full text-xs font-semibold flex items-center gap-2 text-[#86868B] transition-all shadow-sm border border-gray-100"
              >
                <Trash2 size={14} /> {t('clearHistory')}
              </button>
            )}
          </div>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[500px] border border-dashed border-gray-200 rounded-[32px] bg-white/50 backdrop-blur-sm">
              <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center mb-6">
                  <Video className="text-gray-300 w-8 h-8" />
              </div>
              <h3 className="text-[#1D1D1F] font-semibold text-lg">{t('historyEmpty')}</h3>
              <p className="text-[#86868B] text-sm mt-2">{t('historyEmptyDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} lang={lang} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};