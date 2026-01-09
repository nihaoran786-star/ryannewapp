import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { VideoTask, SoraModel, MODEL_OPTIONS, TaskStatus, Channel } from './types';
import { createVideoTask, queryVideoTask } from './services/soraService';
import { TaskCard } from './components/TaskCard';
import { 
  Sparkles, Key, Video, Layers, Plus, AlertTriangle, Trash2, 
  LayoutGrid, Zap, Users, User, X, UserPlus, Globe, Settings,
  Server, Check, ChevronDown, PlusCircle, FolderKanban, 
  FileText, MonitorPlay, Database, Film, UserRoundSearch, LogOut, Command, Loader2
} from 'lucide-react';

type ViewType = 'projects' | 'script' | 'director' | 'assets' | 'movie-recreation' | 'digital-human';
type Lang = 'zh' | 'en';

const locales = {
  zh: {
    title: 'SORA2 STUDIO',
    enterprise: 'PRO',
    mainNav: '主要功能',
    postProd: '后期与特效',
    projects: '项目管理',
    script: '剧本分析',
    director: '导演工作台',
    assets: '资产库',
    movieRec: '风格化重绘',
    digitalHuman: '数字人合成',
    noChannel: '选择节点',
    logout: '登出',
    workspace: '工作区',
    guest: '访客',
    channelSettings: '节点设置',
    genConsole: '创意中心',
    model: '模型',
    storyPrompt: '创意描述',
    promptPlaceholder: '描述一个富有电影感的画面，包含光影、运镜和氛围...',
    submit: '开始生成',
    submitting: '处理中...',
    castLib: '演员表',
    castEmpty: '暂无角色资产',
    history: '创作记录',
    clearHistory: '清除',
    historyEmpty: '准备创作',
    historyEmptyDesc: '您的创意将在此呈现',
    comingSoon: '即将推出',
    channelModalTitle: '服务节点配置',
    channelModalDesc: '管理 API 连接以获得最佳生成体验。',
    activeChannels: '可用节点',
    addChannel: '添加新节点',
    label: '名称',
    endpoint: '接口地址 (Base URL)',
    apiKey: '密钥 (API Key)',
    saveChannel: '保存配置',
    current: '当前使用',
    select: '切换',
    verified: '已连接',
    projectsDesc: '集中管理您的创意项目与资源。',
    scriptDesc: 'AI 驱动的剧本拆解与分镜工具。',
    assetsDesc: '管理生成的高清视频与图像素材。',
    movieRecDesc: '专业的风格迁移与画面重构工具。',
    digitalHumanDesc: '高保真数字人驱动与合成系统。',
    charCreatePrompt: '角色提取',
    wait: '排队中',
    done: '完成',
    fail: '失败',
    gen: '生成中',
    progress: '进度',
    clearHistoryConfirm: '确定要清除所有记录吗？',
    missingToken: '未配置 API 密钥'
  },
  en: {
    title: 'SORA2 STUDIO',
    enterprise: 'PRO',
    mainNav: 'MAIN',
    postProd: 'TOOLS',
    projects: 'Projects',
    script: 'Script AI',
    director: 'Director',
    assets: 'Assets',
    movieRec: 'Remix',
    digitalHuman: 'Digital Human',
    noChannel: 'Select Node',
    logout: 'Log Out',
    workspace: 'Workspace',
    guest: 'Guest',
    channelSettings: 'Settings',
    genConsole: 'Creative Hub',
    model: 'Model',
    storyPrompt: 'Prompt',
    promptPlaceholder: 'Describe a cinematic scene with lighting and camera movement...',
    submit: 'Generate',
    submitting: 'Processing...',
    castLib: 'Cast',
    castEmpty: 'No characters yet',
    history: 'Timeline',
    clearHistory: 'Clear',
    historyEmpty: 'Ready to Create',
    historyEmptyDesc: 'Your masterpieces will appear here',
    comingSoon: 'Coming Soon',
    channelModalTitle: 'Service Nodes',
    channelModalDesc: 'Configure API endpoints for generation.',
    activeChannels: 'Active Nodes',
    addChannel: 'Add Node',
    label: 'Label',
    endpoint: 'Endpoint',
    apiKey: 'API Key',
    saveChannel: 'Save Node',
    current: 'Active',
    select: 'Use',
    verified: 'Connected',
    projectsDesc: 'Centralized hub for movie scenes and storylines.',
    scriptDesc: 'AI breakdown scenes and suggest prompts.',
    assetsDesc: 'Manage your generated video assets.',
    movieRecDesc: 'Advanced cinematic style analysis.',
    digitalHumanDesc: 'High-fidelity digital human synthesis.',
    charCreatePrompt: 'Character Extraction',
    wait: 'Queued',
    done: 'Ready',
    fail: 'Failed',
    gen: 'Generating',
    progress: 'Progress',
    clearHistoryConfirm: 'Clear history?',
    missingToken: 'Missing API Token'
  }
};

const App = () => {
  // Localization State
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('sora_lang') as Lang) || 'en');
  const t = (key: keyof typeof locales['zh']) => locales[lang][key] || key;

  // Navigation State
  const [currentView, setCurrentView] = useState<ViewType>('director');

  // Channel State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Creation States
  const [prompt, setPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<SoraModel>(SoraModel.SORA2_LANDSCAPE);
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Channel Form State
  const [newChannel, setNewChannel] = useState({ name: '', baseUrl: '', apiToken: '' });

  const activeChannel = useMemo(() => 
    channels.find(c => c.id === activeChannelId), 
    [channels, activeChannelId]
  );

  const characters = tasks.filter(t => t.isCharacterAsset && t.status === 'success');

  // Initialization
  useEffect(() => {
    localStorage.setItem('sora_lang', lang);
  }, [lang]);

  useEffect(() => {
    const savedChannels = localStorage.getItem('sora_channels');
    const savedActiveId = localStorage.getItem('sora_active_channel_id');
    
    if (savedChannels) {
      const parsed = JSON.parse(savedChannels);
      setChannels(parsed);
      if (savedActiveId && parsed.find((p: Channel) => p.id === savedActiveId)) {
        setActiveChannelId(savedActiveId);
      } else if (parsed.length > 0) {
        setActiveChannelId(parsed[0].id);
      }
    } else {
      const defaultChannel: Channel = {
        id: 'default',
        name: 'Relay Alpha',
        baseUrl: 'https://newapi.dkyx.cc',
        apiToken: ''
      };
      setChannels([defaultChannel]);
      setActiveChannelId(defaultChannel.id);
    }
  }, []);

  // Persistence
  useEffect(() => {
    if (channels.length > 0) {
      localStorage.setItem('sora_channels', JSON.stringify(channels));
    }
    if (activeChannelId) {
      localStorage.setItem('sora_active_channel_id', activeChannelId);
    }
  }, [channels, activeChannelId]);

  // Polling Logic
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const activeTasks = tasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (activeTasks.length === 0) return;

      const updates = await Promise.allSettled(activeTasks.map(async (task) => {
        if (!task.apiId) return null;
        const targetChannel = channels.find(c => c.id === task.channelId) || activeChannel;
        if (!targetChannel || !targetChannel.apiToken) return null;
        try {
          const data = await queryVideoTask(targetChannel.baseUrl, targetChannel.apiToken, task.apiId);
          return { localId: task.id, apiData: data };
        } catch (err) {
          console.error(`Polling failed for ${task.id}`, err);
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
            let errorMessage = task.errorMessage;
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
            const isSuccess = ['success', 'completed', 'succeed', 'finished'].includes(apiStatusRaw) || (newProgress >= 100 && hasVideoUrl);
            const isFailed = ['failed', 'error', 'fail'].includes(apiStatusRaw) || !!apiData.fail_reason;
            if (hasVideoUrl || isSuccess) {
              newStatus = 'success';
              newProgress = 100;
            } else if (isFailed) {
              newStatus = 'failed';
              errorMessage = apiData.fail_reason || 'Channel reported an error';
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
                errorMessage,
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
      setError(`${t('missingToken')} "${activeChannel?.name || '???'}"`);
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
      isCharacterAsset: false,
      channelId: activeChannelId
    };
    setTasks(prev => [newTask, ...prev]);
    try {
      const apiId = await createVideoTask(activeChannel.baseUrl, activeChannel.apiToken, prompt, selectedModel);
      setTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
      setPrompt(''); 
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'failed', errorMessage: err.message } : t));
      setError(err.message || 'Task creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddChannel = () => {
    if (!newChannel.name || !newChannel.baseUrl || !newChannel.apiToken) return;
    const channel: Channel = {
      ...newChannel,
      id: Date.now().toString()
    };
    setChannels(prev => [...prev, channel]);
    setActiveChannelId(channel.id);
    setNewChannel({ name: '', baseUrl: '', apiToken: '' });
  };

  const updateChannel = (id: string, updates: Partial<Channel>) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteChannel = (id: string) => {
    if (channels.length <= 1) return;
    const updated = channels.filter(c => c.id !== id);
    setChannels(updated);
    if (activeChannelId === id) setActiveChannelId(updated[0].id);
  };

  const handleCreateCharacter = async (sourceTaskId: string, startTime: number, endTime: number) => {
    if (!activeChannel?.apiToken) return;
    setIsSubmitting(true);
    const localId = Date.now().toString();
    const newTask: VideoTask = {
      id: localId,
      prompt: t('charCreatePrompt'),
      model: SoraModel.SORA2_CHARACTERS,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      isCharacterAsset: true,
      channelId: activeChannelId,
      characterName: `${lang === 'zh' ? '新角色' : 'New Character'} ${characters.length + 1}`
    };
    setTasks(prev => [newTask, ...prev]);
    try {
        const apiId = await createVideoTask(activeChannel.baseUrl, activeChannel.apiToken, "角色创建", SoraModel.SORA2_CHARACTERS, {
            characterSourceId: sourceTaskId,
            timestamps: `${startTime},${endTime}`
        });
        setTasks(prev => prev.map(t => t.id === localId ? { ...t, apiId, status: 'processing' } : t));
    } catch (err: any) {
        setTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'failed', errorMessage: err.message } : t));
        setError("Character creation failed: " + err.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderSidebarItem = (view: ViewType, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        currentView === view 
          ? 'bg-[#007AFF]/10 text-[#007AFF] font-semibold' 
          : 'text-gray-500 hover:text-[#1D1D1F] hover:bg-black/5'
      }`}
    >
      <div className={`${currentView === view ? 'text-[#007AFF]' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}>
        {icon}
      </div>
      <span className="text-[13px] tracking-wide">{label}</span>
    </button>
  );

  const renderPlaceholder = (titleKey: keyof typeof locales['zh'], descKey: keyof typeof locales['zh']) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-24 h-24 bg-white/60 backdrop-blur-xl rounded-[32px] flex items-center justify-center mb-6 shadow-apple-card border border-white/50">
        <Sparkles size={40} className="text-[#007AFF]" />
      </div>
      <h2 className="text-2xl font-bold text-[#1D1D1F] mb-3 tracking-tight">{t(titleKey)}</h2>
      <p className="text-[#86868B] max-w-md mx-auto text-base leading-relaxed">{t(descKey)}</p>
      <button className="mt-8 px-6 py-2.5 bg-[#F5F5F7] text-[#86868B] rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-[#E5E5EA] transition-all cursor-default">
        {t('comingSoon')}
      </button>
    </div>
  );

  const renderDirectorConsole = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white rounded-[24px] p-6 shadow-apple-card border border-white/50 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-[#007AFF]/10 rounded-xl">
               <MonitorPlay className="text-[#007AFF] w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-[#1D1D1F]">{t('genConsole')}</h2>
          </div>
          <div className="space-y-4 mb-6">
            <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
              <Layers size={12} /> {t('model')}
            </label>
            <div className="relative">
                <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as SoraModel)}
                    className="w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3.5 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/20 outline-none appearance-none cursor-pointer transition-all hover:bg-[#E5E5EA]"
                >
                    {MODEL_OPTIONS.map((opt) => (
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
              className="w-full bg-[#F5F5F7] border-none rounded-2xl p-4 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/20 min-h-[180px] resize-none outline-none placeholder:text-gray-400 transition-all hover:bg-[#E5E5EA]"
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
            className={`w-full py-4 px-4 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-blue-500/20
              ${isSubmitting || !activeChannel?.apiToken
                ? 'bg-[#E5E5EA] text-[#86868B] cursor-not-allowed shadow-none' 
                : 'bg-[#007AFF] hover:bg-[#0066CC] text-white'
              }`}
          >
            {isSubmitting ? (
              <><Loader2 size={18} className="animate-spin" /> {t('submitting')}</>
            ) : (
              <><Plus size={18} strokeWidth={2.5} /> {t('submit')}</>
            )}
          </button>
        </div>
        
        <div className="bg-white rounded-[24px] p-6 shadow-apple-card border border-white/50">
           <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                 <Users className="text-purple-600 w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-[#1D1D1F]">{t('castLib')}</h2>
           </div>
           {characters.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-gray-200 rounded-2xl bg-[#F5F5F7]/50">
                  <User size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-xs text-[#86868B] font-medium">{t('castEmpty')}</p>
              </div>
           ) : (
              <div className="grid grid-cols-4 gap-3">
                 {characters.map((char) => (
                    <div 
                        key={char.id} 
                        className="group relative flex flex-col items-center cursor-pointer"
                        onClick={() => char.apiId && setPrompt(p => p.includes(char.apiId!) ? p : `${p} ${char.apiId}`)}
                    >
                        <div className={`w-14 h-14 rounded-2xl overflow-hidden border transition-all duration-300 shadow-sm ${prompt.includes(char.apiId || '') ? 'border-[#007AFF] ring-2 ring-[#007AFF]/20 scale-105' : 'border-gray-100 hover:border-gray-300'}`}>
                            <img src={char.coverUrl} className="w-full h-full object-cover" />
                        </div>
                        <span className="mt-2 text-[10px] font-medium text-center w-full text-[#86868B] truncate group-hover:text-[#1D1D1F]">{char.characterName}</span>
                    </div>
                 ))}
              </div>
           )}
        </div>
      </div>
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
              <TaskCard key={task.id} task={task} onCreateCharacter={handleCreateCharacter} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans overflow-hidden selection:bg-[#007AFF]/20">
      {/* Sidebar - Glassmorphism */}
      <aside className="w-[280px] bg-white/80 backdrop-blur-2xl border-r border-[rgba(0,0,0,0.05)] flex flex-col shrink-0 z-50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10 pl-2">
            <div className="bg-gradient-to-tr from-[#007AFF] to-[#5856D6] p-2 rounded-[14px] shadow-lg shadow-blue-500/20">
              <Video className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1D1D1F] leading-tight tracking-tight">
                {t('title')}
              </h1>
              <span className="text-[10px] text-[#007AFF] font-bold tracking-wider uppercase bg-[#007AFF]/10 px-1.5 py-0.5 rounded">{t('enterprise')}</span>
            </div>
          </div>

          <nav className="space-y-1">
            <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-3 mb-2">{t('mainNav')}</div>
            {renderSidebarItem('projects', <FolderKanban size={18} strokeWidth={2} />, t('projects'))}
            {renderSidebarItem('script', <FileText size={18} strokeWidth={2} />, t('script'))}
            {renderSidebarItem('director', <MonitorPlay size={18} strokeWidth={2} />, t('director'))}
            {renderSidebarItem('assets', <Database size={18} strokeWidth={2} />, t('assets'))}
            
            <div className="pt-6">
              <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-3 mb-2">{t('postProd')}</div>
              {renderSidebarItem('movie-recreation', <Film size={18} strokeWidth={2} />, t('movieRec'))}
              {renderSidebarItem('digital-human', <UserRoundSearch size={18} strokeWidth={2} />, t('digitalHuman'))}
            </div>
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4">
           {/* Active Channel Status Bar */}
           <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-[rgba(0,0,0,0.04)] shadow-sm">
              <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${activeChannel?.apiToken ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-yellow-500'}`} />
                    <span className="text-xs font-semibold text-[#1D1D1F] truncate max-w-[120px]">{activeChannel?.name || t('noChannel')}</span>
                 </div>
                 <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-black/5 rounded-lg text-[#86868B] hover:text-[#1D1D1F] transition-colors">
                    <Settings size={14} />
                 </button>
              </div>
              <div className="h-1 w-full bg-[#E5E5EA] rounded-full overflow-hidden">
                 <div className={`h-full transition-all duration-500 ${activeChannel?.apiToken ? 'w-full bg-green-500' : 'w-1/3 bg-yellow-500'}`} />
              </div>
           </div>
           
           <button className="w-full flex items-center gap-3 px-3 py-2 text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 rounded-lg transition-all text-[13px] font-medium">
              <LogOut size={16} />
              <span>{t('logout')}</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header - Glassmorphism */}
        <header className="h-16 border-b border-[rgba(0,0,0,0.05)] bg-white/70 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-40 sticky top-0">
          <div>
            <h2 className="text-base font-bold text-[#1D1D1F] tracking-tight">
              {t(currentView as any) || currentView}
            </h2>
          </div>
          <div className="flex items-center gap-4">
             {/* Language Toggle */}
             <div className="flex items-center bg-[#E5E5EA] p-1 rounded-lg">
                <button 
                   onClick={() => setLang('zh')}
                   className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all shadow-sm ${lang === 'zh' ? 'bg-white text-[#1D1D1F]' : 'text-[#86868B] shadow-none hover:text-[#1D1D1F]'}`}
                >
                   CN
                </button>
                <button 
                   onClick={() => setLang('en')}
                   className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all shadow-sm ${lang === 'en' ? 'bg-white text-[#1D1D1F]' : 'text-[#86868B] shadow-none hover:text-[#1D1D1F]'}`}
                >
                   EN
                </button>
             </div>

             <div className="h-6 w-[1px] bg-[#E5E5EA] mx-2" />

             <button onClick={() => setShowSettings(true)} className="bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] px-4 py-2 rounded-full text-xs font-semibold shadow-sm border border-[rgba(0,0,0,0.04)] transition-all active:scale-95 flex items-center gap-2">
                <Server size={14} className="text-[#007AFF]" />
                {t('channelSettings')}
             </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {currentView === 'director' ? renderDirectorConsole() : (
            currentView === 'projects' ? renderPlaceholder('projects', 'projectsDesc') :
            currentView === 'script' ? renderPlaceholder('script', 'scriptDesc') :
            currentView === 'assets' ? renderPlaceholder('assets', 'assetsDesc') :
            currentView === 'movie-recreation' ? renderPlaceholder('movieRec', 'movieRecDesc') :
            renderPlaceholder('digitalHuman', 'digitalHumanDesc')
          )}
        </div>
      </main>

      {/* Settings Modal - Glassmorphism */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#F5F5F7]/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowSettings(false)} />
          <div className="relative bg-white/90 backdrop-blur-2xl border border-white/50 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 ring-1 ring-black/5">
            <div className="p-6 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between bg-white/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#007AFF]/10 rounded-xl">
                    <Server className="text-[#007AFF] w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-[#1D1D1F]">{t('channelModalTitle')}</h2>
                    <p className="text-xs text-[#86868B]">{t('channelModalDesc')}</p>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center bg-[#E5E5EA] hover:bg-[#D1D1D6] rounded-full text-[#86868B] hover:text-[#1D1D1F] transition-all"><X size={16} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">{t('activeChannels')}</h3>
                <div className="grid gap-4">
                  {channels.map(c => (
                    <div 
                        key={c.id} 
                        className={`p-5 rounded-[20px] border transition-all flex flex-col gap-4 ${c.id === activeChannelId ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300 shadow-sm'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-3 mb-2">
                             <input 
                               value={c.name}
                               onChange={(e) => updateChannel(c.id, { name: e.target.value })}
                               className="bg-transparent border-none text-[#1D1D1F] font-bold p-0 focus:ring-0 w-full outline-none text-base"
                               placeholder="Channel Name"
                             />
                           </div>
                           <div className="flex items-center gap-2 text-[11px] text-[#86868B] font-mono bg-[#F5F5F7] w-fit px-2 py-1 rounded-md">
                             <Globe size={12} className="text-[#007AFF]" />
                             <input 
                               value={c.baseUrl}
                               onChange={(e) => updateChannel(c.id, { baseUrl: e.target.value })}
                               className="bg-transparent border-none p-0 focus:ring-0 w-full outline-none text-[#86868B]"
                               placeholder="Endpoint URL"
                             />
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => setActiveChannelId(c.id)}
                             disabled={c.id === activeChannelId}
                             className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${c.id === activeChannelId ? 'bg-[#007AFF] text-white shadow-md' : 'bg-[#E5E5EA] text-[#86868B] hover:bg-[#D1D1D6]'}`}
                           >
                             {c.id === activeChannelId ? t('current') : t('select')}
                           </button>
                           <button onClick={() => deleteChannel(c.id)} className="p-2 text-[#86868B] hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>

                      <div className="space-y-2">
                         <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase font-bold text-[#86868B] flex items-center gap-1.5 tracking-wider">
                               <Key size={12} /> {t('apiKey')}
                            </label>
                            {c.apiToken && <span className="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">{t('verified')}</span>}
                         </div>
                         <input 
                            type="password"
                            value={c.apiToken}
                            onChange={(e) => updateChannel(c.id, { apiToken: e.target.value })}
                            placeholder="sk-..."
                            className="w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/20 outline-none transition-all"
                         />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#F5F5F7]/50 rounded-[24px] p-6 border border-dashed border-gray-200">
                 <h3 className="text-sm font-bold text-[#1D1D1F] mb-6 flex items-center gap-3">
                    <div className="p-1.5 bg-[#007AFF]/10 rounded-lg"><PlusCircle size={16} className="text-[#007AFF]" /></div>
                    {t('addChannel')}
                 </h3>
                 <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-[#86868B] ml-1">{t('label')}</label>
                            <input 
                                value={newChannel.name}
                                onChange={e => setNewChannel({...newChannel, name: e.target.value})}
                                placeholder="Relay Station Omega" 
                                className="w-full bg-white border border-[rgba(0,0,0,0.05)] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/20 outline-none shadow-sm" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-[#86868B] ml-1">{t('endpoint')}</label>
                            <input 
                                value={newChannel.baseUrl}
                                onChange={e => setNewChannel({...newChannel, baseUrl: e.target.value})}
                                placeholder="https://api..." 
                                className="w-full bg-white border border-[rgba(0,0,0,0.05)] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/20 outline-none shadow-sm" 
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#86868B] ml-1">{t('apiKey')}</label>
                        <input 
                            type="password"
                            value={newChannel.apiToken}
                            onChange={e => setNewChannel({...newChannel, apiToken: e.target.value})}
                            placeholder="Enter your secret token" 
                            className="w-full bg-white border border-[rgba(0,0,0,0.05)] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/20 outline-none shadow-sm" 
                        />
                    </div>
                    <button 
                        onClick={handleAddChannel}
                        className="w-full bg-[#1D1D1F] hover:bg-black text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-black/10 active:scale-95"
                    >
                        {t('saveChannel')}
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);