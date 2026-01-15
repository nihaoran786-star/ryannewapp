import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, User, Image as ImageIcon, Box, Video, 
  Search, Grid, List, Download, Trash2, Plus, 
  Sparkles, Loader2, AlertCircle, Maximize2,
  ChevronRight, Filter, MoreVertical, X, Send
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { ImageTask, VideoTask, ImageModel, TaskStatus } from '../types';
import { createNanoBananaPro4KTask, queryImageTask } from '../services/imageService';
import { ImageModal } from '../components/ImageModal';

type CategoryFilter = 'all' | 'character' | 'scene' | 'product' | 'video';

export const AssetsPage = () => {
  const { t, lang, activeChannel } = useGlobal();

  // --- Data States ---
  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  const [videoTasks, setVideoTasks] = useState<VideoTask[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // --- Generation States ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [genCategory, setGenCategory] = useState<'character' | 'scene' | 'product'>('character');
  const [genPrompt, setGenPrompt] = useState('');
  const [showGenPanel, setShowGenPanel] = useState(false);
  
  // --- UI States ---
  const [modalImage, setModalImage] = useState<string | null>(null);

  // Load Data
  useEffect(() => {
    const savedImages = localStorage.getItem('sora_image_tasks');
    const savedVideos = localStorage.getItem('sora_v2_tasks');
    if (savedImages) setImageTasks(JSON.parse(savedImages));
    if (savedVideos) setVideoTasks(JSON.parse(savedVideos));
  }, []);

  // Polling for progress (for tasks created within this page)
  useEffect(() => {
    const timer = setInterval(async () => {
      const pendingImages = imageTasks.filter(t => t.status === 'queued' || t.status === 'processing');
      if (pendingImages.length === 0) return;

      if (!activeChannel?.apiToken) return;

      const updates = await Promise.allSettled(pendingImages.map(async (task) => {
          if (!task.apiId) return null;
          try {
              const data = await queryImageTask(activeChannel.baseUrl, activeChannel.apiToken, task.apiId);
              return { id: task.id, data };
          } catch (e) { return null; }
      }));

      // Added explicit casting to TaskStatus and ImageTask to resolve type widening issues in state updates
      setImageTasks(prev => {
          const next = prev.map(task => {
              const update = updates.find(u => u.status === 'fulfilled' && u.value?.id === task.id);
              if (update && update.status === 'fulfilled' && update.value) {
                  const api = update.value.data;
                  const done = !!(api.result_url || (api.result_urls && api.result_urls.length > 0));
                  return {
                      ...task,
                      status: (done ? 'success' : api.status === 'failed' ? 'failed' : 'processing') as TaskStatus,
                      resultUrl: api.result_url || task.resultUrl,
                      resultUrls: api.result_urls || task.resultUrls
                  } as ImageTask;
              }
              return task;
          });
          localStorage.setItem('sora_image_tasks', JSON.stringify(next));
          return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [imageTasks, activeChannel]);

  // Unified Asset Object for display
  const allAssets = useMemo(() => {
    const images = imageTasks.map(t => ({
      id: t.id,
      type: 'image' as const,
      url: t.resultUrl || t.resultUrls?.[0],
      prompt: t.prompt,
      status: t.status,
      createdAt: t.createdAt,
      // Heuristic classification if missing
      category: t.category || (
        t.prompt.toLowerCase().includes('character') ? 'character' :
        t.prompt.toLowerCase().includes('scene') || t.prompt.toLowerCase().includes('environment') ? 'scene' :
        t.prompt.toLowerCase().includes('product') || t.prompt.toLowerCase().includes('prop') ? 'product' : 'other'
      )
    }));

    const videos = videoTasks.map(t => ({
      id: t.id,
      type: 'video' as const,
      url: t.videoUrl,
      cover: t.coverUrl,
      prompt: t.prompt,
      status: t.status,
      createdAt: t.createdAt,
      category: 'video' as const
    }));

    return [...images, ...videos].sort((a, b) => b.createdAt - a.createdAt);
  }, [imageTasks, videoTasks]);

  const filteredAssets = useMemo(() => {
    return allAssets.filter(a => {
      const matchesSearch = a.prompt.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allAssets, activeCategory, searchQuery]);

  const handleCreateAsset = async () => {
    if (!activeChannel?.apiToken || !genPrompt.trim()) return;
    
    setIsGenerating(true);
    const localId = `asset-${Date.now()}`;
    
    // Inject preset prompts based on category
    const presets = {
      character: "Character concept art, full body design sheet, white background, high quality, cinematic lighting, ",
      scene: "Atmospheric environment design, wide cinematic shot, highly detailed architecture, concept art, ",
      product: "Commercial product photography style, high-end prop design, studio lighting, isolated focus, "
    };

    const finalPrompt = presets[genCategory] + genPrompt;

    const newTask: ImageTask = {
      id: localId,
      prompt: genPrompt,
      model: ImageModel.NANO_BANANA_PRO,
      status: 'queued',
      createdAt: Date.now(),
      category: genCategory,
      type: 'txt2img'
    };

    setImageTasks(prev => {
        const next = [newTask, ...prev];
        localStorage.setItem('sora_image_tasks', JSON.stringify(next));
        return next;
    });

    try {
      const results = await createNanoBananaPro4KTask(
        activeChannel.baseUrl, 
        activeChannel.apiToken, 
        finalPrompt, 
        [], 
        { aspectRatio: genCategory === 'scene' ? '16:9' : '1:1', resolution: '2K' }
      );
      
      // Added explicit casting to TaskStatus and ImageTask to resolve type widening issues in state updates
      setImageTasks(prev => {
          const next = prev.map(t => t.id === localId ? { ...t, status: 'success' as TaskStatus, resultUrl: results[0], resultUrls: results } as ImageTask : t);
          localStorage.setItem('sora_image_tasks', JSON.stringify(next));
          return next;
      });
      setGenPrompt('');
      setShowGenPanel(false);
    } catch (e) {
      // Added explicit casting to TaskStatus and ImageTask to resolve type widening
      setImageTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'failed' as TaskStatus } as ImageTask : t));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (id: string, type: 'image' | 'video') => {
      if (!confirm(lang === 'zh' ? '永久删除此资产？' : 'Permanently delete this asset?')) return;
      if (type === 'image') {
          const next = imageTasks.filter(t => t.id !== id);
          setImageTasks(next);
          localStorage.setItem('sora_image_tasks', JSON.stringify(next));
      } else {
          const next = videoTasks.filter(t => t.id !== id);
          setVideoTasks(next);
          localStorage.setItem('sora_v2_tasks', JSON.stringify(next));
      }
  };

  const stats = useMemo(() => ({
    all: allAssets.length,
    character: allAssets.filter(a => a.category === 'character').length,
    scene: allAssets.filter(a => a.category === 'scene').length,
    product: allAssets.filter(a => a.category === 'product').length,
    video: allAssets.filter(a => a.category === 'video').length,
  }), [allAssets]);

  return (
    <div className="h-full flex bg-[#F5F5F7] overflow-hidden">
      <ImageModal isOpen={!!modalImage} imageUrl={modalImage} onClose={() => setModalImage(null)} />

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-gray-200 bg-white/50 backdrop-blur-xl flex flex-col shrink-0 p-6 z-10">
        <div className="flex items-center gap-3 mb-10 px-2">
            <div className="p-2.5 bg-[#007AFF] rounded-xl shadow-lg shadow-blue-500/20">
                <Database className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-black text-[#1D1D1F] tracking-tight">{lang === 'zh' ? '资产库' : 'Asset Lab'}</h1>
        </div>

        <nav className="space-y-1.5">
            {[
                { id: 'all', label: lang === 'zh' ? '全部资产' : 'Library', icon: <Grid size={18}/> },
                { id: 'character', label: lang === 'zh' ? '角色定妆' : 'Characters', icon: <User size={18}/> },
                { id: 'scene', label: lang === 'zh' ? '场景设定' : 'Scenes', icon: <ImageIcon size={18}/> },
                { id: 'product', label: lang === 'zh' ? '道具产品' : 'Props', icon: <Box size={18}/> },
                { id: 'video', label: lang === 'zh' ? '视频成品' : 'Videos', icon: <Video size={18}/> },
            ].map(item => (
                <button 
                    key={item.id}
                    onClick={() => setActiveCategory(item.id as CategoryFilter)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all
                        ${activeCategory === item.id 
                            ? 'bg-[#007AFF] text-white shadow-md shadow-blue-500/10' 
                            : 'text-gray-500 hover:bg-black/5 hover:text-[#1D1D1F]'}`}
                >
                    <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                    </div>
                    <span className={`text-[10px] opacity-60 font-mono ${activeCategory === item.id ? 'text-white' : 'text-gray-400'}`}>
                        {stats[item.id as keyof typeof stats]}
                    </span>
                </button>
            ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100">
            <button 
                onClick={() => setShowGenPanel(true)}
                className="w-full bg-[#1D1D1F] hover:bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
            >
                <Plus size={16} strokeWidth={3} />
                {lang === 'zh' ? '生成新资产' : 'Create Asset'}
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
          {/* Header Bar */}
          <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-8 shrink-0 z-20">
              <div className="relative w-96 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#007AFF] transition-colors" size={18} />
                  <input 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={lang === 'zh' ? '搜索您的创意资产...' : 'Search your assets...'}
                      className="w-full bg-[#F5F5F7] border-none rounded-full py-2.5 pl-12 pr-6 text-sm font-medium focus:ring-2 focus:ring-[#007AFF]/20 transition-all outline-none"
                  />
              </div>

              <div className="flex items-center gap-3">
                  <div className="h-8 w-[1px] bg-gray-100 mx-2" />
                  <button className="p-2 text-gray-400 hover:text-[#007AFF] hover:bg-blue-50 rounded-lg transition-all"><Filter size={20}/></button>
                  <button className="p-2 text-gray-400 hover:text-[#007AFF] hover:bg-blue-50 rounded-lg transition-all"><List size={20}/></button>
              </div>
          </header>

          {/* Grid Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {filteredAssets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
                      <div className="w-24 h-24 bg-white shadow-apple-card rounded-[32px] flex items-center justify-center mb-6 border border-gray-100">
                          <Database className="text-gray-200 w-10 h-10" />
                      </div>
                      <h2 className="text-xl font-black text-[#1D1D1F] mb-2 uppercase tracking-tight">Empty Workspace</h2>
                      <p className="text-[#86868B] text-sm max-w-xs leading-relaxed">No {activeCategory} assets found. Start generating to build your creative library.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                      {filteredAssets.map(asset => (
                          <div 
                              key={asset.id} 
                              className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-apple-hover transition-all duration-500 overflow-hidden flex flex-col animate-in fade-in"
                          >
                              <div className="aspect-[3/4] relative overflow-hidden bg-gray-50 cursor-pointer" onClick={() => asset.status === 'success' && setModalImage(asset.url!)}>
                                  {asset.status === 'success' ? (
                                      <>
                                          {asset.type === 'video' ? (
                                              <video src={asset.url} poster={asset.cover} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                          ) : (
                                              <img src={asset.url} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                          )}
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-4">
                                              <div className="flex justify-end gap-2">
                                                  <button className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md"><Maximize2 size={14}/></button>
                                                  <button className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md"><Download size={14}/></button>
                                              </div>
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); handleDelete(asset.id, asset.type); }}
                                                  className="p-2 bg-red-500/20 hover:bg-red-500 rounded-full text-white backdrop-blur-md self-start"
                                              >
                                                  <Trash2 size={14}/>
                                              </button>
                                          </div>
                                          {asset.type === 'video' && (
                                              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[8px] font-black px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest flex items-center gap-1">
                                                  <Video size={10} /> Video
                                              </div>
                                          )}
                                      </>
                                  ) : asset.status === 'failed' ? (
                                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-red-400 bg-red-50">
                                          <AlertCircle size={32} className="mb-2 opacity-50" />
                                          <span className="text-[10px] font-bold uppercase tracking-widest">Fail</span>
                                      </div>
                                  ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center bg-white">
                                          <Loader2 className="animate-spin text-[#007AFF] mb-3" size={24} />
                                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Rendering</span>
                                      </div>
                                  )}
                              </div>
                              <div className="p-4">
                                  <div className="flex items-center gap-2 mb-1.5">
                                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border 
                                          ${asset.category === 'character' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                            asset.category === 'scene' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                            asset.category === 'product' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                            'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                          {asset.category}
                                      </span>
                                  </div>
                                  <p className="text-[11px] font-bold text-[#1D1D1F] line-clamp-2 italic leading-relaxed">"{asset.prompt}"</p>
                                  <p className="text-[9px] text-gray-400 mt-2 font-medium uppercase tracking-tighter">{new Date(asset.createdAt).toLocaleDateString()}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </main>

      {/* Slide-over Generation Panel */}
      {showGenPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isGenerating && setShowGenPanel(false)} />
              <div className="relative w-[400px] h-full bg-white shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col border-l border-gray-200">
                  <div className="p-8 flex items-center justify-between border-b border-gray-100">
                      <div>
                          <h2 className="text-xl font-black text-[#1D1D1F] tracking-tight">{lang === 'zh' ? '创意资产工坊' : 'Asset Workshop'}</h2>
                          <p className="text-xs text-gray-400 mt-1 font-medium">{lang === 'zh' ? '一键生成高品质视觉资产' : 'Generate production-ready visual assets'}</p>
                      </div>
                      <button onClick={() => setShowGenPanel(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><X size={20}/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{lang === 'zh' ? '资产类型' : 'Asset Category'}</label>
                          <div className="grid grid-cols-3 gap-3">
                              {(['character', 'scene', 'product'] as const).map(cat => (
                                  <button 
                                      key={cat}
                                      onClick={() => setGenCategory(cat)}
                                      className={`py-6 px-2 rounded-2xl flex flex-col items-center gap-3 border-2 transition-all
                                          ${genCategory === cat 
                                              ? 'border-[#007AFF] bg-blue-50/50 text-[#007AFF] shadow-lg shadow-blue-500/10' 
                                              : 'border-gray-50 bg-[#FAFAFA] text-gray-400 hover:border-gray-200 hover:bg-white'}`}
                                  >
                                      {cat === 'character' ? <User size={24}/> : cat === 'scene' ? <ImageIcon size={24}/> : <Box size={24}/>}
                                      <span className="text-[10px] font-black uppercase">{cat}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{lang === 'zh' ? '描述创意' : 'Creative Brief'}</label>
                          <div className="bg-[#F5F5F7] rounded-[32px] p-6 focus-within:bg-white focus-within:shadow-inner border-2 border-transparent focus-within:border-black/5 transition-all">
                              <textarea 
                                  value={genPrompt}
                                  onChange={e => setGenPrompt(e.target.value)}
                                  rows={4}
                                  placeholder={lang === 'zh' ? '例如：一个身穿银色盔甲的星际猎人...' : 'e.g. A futuristic bounty hunter in silver chrome armor...'}
                                  className="w-full bg-transparent border-none p-0 focus:ring-0 text-base font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none resize-none leading-relaxed"
                              />
                              <div className="mt-4 flex items-center gap-2 text-[10px] text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full w-fit font-bold">
                                  <Sparkles size={12} />
                                  <span>{lang === 'zh' ? '系统将自动补全工业级底座提示词' : 'Will auto-apply professional base prompts'}</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="p-8 bg-[#F5F5F7]/50 border-t border-gray-100">
                      <button 
                          onClick={handleCreateAsset}
                          disabled={isGenerating || !genPrompt.trim()}
                          className={`w-full py-5 rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-2xl
                              ${isGenerating || !genPrompt.trim()
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-[#1D1D1F] text-white hover:bg-black shadow-black/20'}`}
                      >
                          {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                          {isGenerating ? t('submitting') : (lang === 'zh' ? '开始渲染' : 'Start Rendering')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};