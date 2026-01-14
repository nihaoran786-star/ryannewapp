
import React, { useRef, useState, useEffect } from 'react';
import { VideoTask } from '../types';
import { ProgressBar } from './ProgressBar';
import { 
  AlertCircle, Clock, Loader2, Download, Maximize2, Minimize2, 
  UserPlus, Scissors
} from 'lucide-react';

interface TaskCardProps {
  task: VideoTask;
  onCreateCharacter?: (taskId: string, startTime: number, endTime: number) => void;
  lang?: 'zh' | 'en';
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onCreateCharacter, lang = 'en' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Clip mode state
  const [isClipMode, setIsClipMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0);

  // Helper to determine if model is portrait, though grid container remains 16:9
  // Fixed: Added check for task.model existence
  const isPortrait = task.model && typeof task.model === 'string' && task.model.toUpperCase().includes('PORTRAIT');

  const t = {
    zh: {
      char: '角色',
      extract: '提取 3秒 从:',
      cancel: '取消',
      create: '创建',
      createChar: '创建角色',
      wait: '等待',
      done: '完成',
      fail: '失败',
      gen: '生成',
      progress: '进度',
      failedGen: '生成失败'
    },
    en: {
      char: 'CHARACTER',
      extract: 'Extracting 3s from:',
      cancel: 'Cancel',
      create: 'Create',
      createChar: 'Create Character',
      wait: 'WAIT',
      done: 'DONE',
      fail: 'FAIL',
      gen: 'GEN',
      progress: 'Progress',
      failedGen: 'Generation Failed'
    }
  }[lang];

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCreateCharClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsClipMode(!isClipMode);
    if (!isClipMode && videoRef.current) {
        videoRef.current.pause();
    }
  };

  const confirmCharacterCreation = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onCreateCharacter && task.apiId) {
          const start = Math.floor(currentTime);
          let end = start + 3;
          if (end > duration) {
              end = Math.floor(duration);
              if (end - start < 1) {
                  const newStart = Math.max(0, end - 3);
                  onCreateCharacter(task.apiId, newStart, end);
                  setIsClipMode(false);
                  return;
              }
          }
          onCreateCharacter(task.apiId, start, end);
          setIsClipMode(false);
      }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [task.videoUrl, isExpanded]); 

  // Safe model string display
  const modelDisplay = task.model && typeof task.model === 'string' 
    ? task.model.replace('sora2-', '').toUpperCase() 
    : 'VIDEO';

  return (
    <>
      {isExpanded && <div className="bg-white/50 backdrop-blur-sm fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />}
      <div 
        className={`
          bg-white border transition-all duration-500 flex flex-col overflow-hidden
          ${isExpanded 
            ? 'fixed inset-4 z-50 h-auto w-auto rounded-[32px] border-none shadow-2xl ring-1 ring-black/5' 
            : 'rounded-[24px] h-full relative border-[rgba(0,0,0,0.05)] shadow-apple-card hover:shadow-apple-hover hover:-translate-y-1'
          }
          ${isClipMode ? 'ring-2 ring-[#007AFF] border-[#007AFF]' : ''}
        `}
      >
        {!isExpanded && (
          <div className="p-5 border-b border-[rgba(0,0,0,0.05)] bg-[#F5F5F7]/30 flex justify-between items-start shrink-0">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full border 
                    ${task.isCharacterAsset 
                        ? 'text-purple-600 bg-purple-100 border-purple-200' 
                        : 'text-[#007AFF] bg-blue-50 border-blue-100'}`}>
                  {task.isCharacterAsset ? t.char : modelDisplay}
                </span>
                <span className="text-[10px] text-[#86868B] flex items-center gap-1 font-medium">
                  <Clock size={10} /> {formatDate(task.createdAt)}
                </span>
              </div>
              <p className="text-sm text-[#1D1D1F] line-clamp-2 leading-relaxed font-semibold" title={task.prompt}>
                {task.characterName ? <span className="text-purple-600">{task.characterName}</span> : task.prompt}
              </p>
            </div>
            <div className="shrink-0">
              {task.status === 'success' && <span className="text-green-700 bg-green-100 border border-green-200 text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide">{t.done}</span>}
              {task.status === 'processing' && <span className="text-blue-700 bg-blue-100 border border-blue-200 text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> {t.gen}</span>}
              {task.status === 'queued' && <span className="text-yellow-700 bg-yellow-100 border border-yellow-200 text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide">{t.wait}</span>}
              {task.status === 'failed' && <span className="text-red-700 bg-red-100 border border-red-200 text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide">{t.fail}</span>}
            </div>
          </div>
        )}

        {/* Container: Uniform 16:9 Aspect Ratio in Grid to prevent layout deformation. Fills screen when expanded. */}
        <div className={`relative flex items-center justify-center group overflow-hidden bg-black ${isExpanded ? 'h-full w-full rounded-[24px]' : 'aspect-video'}`}>
          {task.status === 'success' && (task.videoUrl || task.coverUrl) ? (
            <>
              <video 
                ref={videoRef}
                src={task.videoUrl} 
                poster={task.coverUrl}
                className={`w-full h-full object-contain`}
                controls
                playsInline
                preload="metadata"
              />
              
              {isClipMode && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto">
                      <div className="bg-white p-6 rounded-[24px] shadow-2xl flex flex-col items-center gap-4 max-w-[280px]">
                          <div className="flex items-center gap-3 text-[#007AFF] font-black tracking-widest text-sm">
                              <Scissors size={20} />
                              <span>{t.createChar}</span>
                          </div>
                          <p className="text-xs text-[#86868B] text-center leading-relaxed font-medium">
                              {t.extract} <span className="text-[#1D1D1F] font-mono bg-[#F5F5F7] px-2 py-0.5 rounded ml-1 border border-gray-200">{formatTime(currentTime)}</span>
                          </p>
                          <div className="flex gap-3 w-full">
                              <button onClick={() => setIsClipMode(false)} className="flex-1 py-2.5 px-4 rounded-xl bg-[#F5F5F7] text-xs text-[#86868B] hover:bg-[#E5E5EA] transition-all font-bold">{t.cancel}</button>
                              <button onClick={confirmCharacterCreation} className="flex-1 py-2.5 px-4 rounded-xl bg-[#007AFF] text-white text-xs hover:bg-[#0066CC] transition-all font-bold shadow-lg shadow-blue-500/20">{t.create}</button>
                          </div>
                      </div>
                  </div>
              )}

              <div className="absolute top-4 right-4 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {!task.isCharacterAsset && onCreateCharacter && task.apiId && (
                     <button onClick={handleCreateCharClick} className={`p-2 rounded-full backdrop-blur-md transition-all ${isClipMode ? 'bg-[#007AFF] text-white shadow-lg' : 'bg-white/20 hover:bg-[#007AFF] text-white'}`} title={t.createChar}>
                       <UserPlus size={16} />
                     </button>
                  )}
                  <a href={task.videoUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md transition-all" title="Download"><Download size={16} /></a>
                  <button onClick={toggleExpand} className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md transition-all" title={isExpanded ? "Minimize" : "Maximize"}>
                      {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
              </div>
            </>
          ) : task.status === 'failed' ? (
            <div className="flex flex-col items-center text-red-400 p-8 text-center animate-in zoom-in-95 duration-300 bg-[#FFF5F5] w-full h-full justify-center">
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

        {!isExpanded && (
          <div className="p-5 bg-white mt-auto shrink-0 border-t border-[rgba(0,0,0,0.05)]">
            <div className="flex justify-between text-[10px] text-[#86868B] mb-2 font-bold tracking-widest uppercase">
                <span>{t.progress}</span>
                <span>{Math.round(task.progress)}%</span>
            </div>
            <ProgressBar progress={task.progress} status={task.status} />
          </div>
        )}
      </div>
    </>
  );
};
