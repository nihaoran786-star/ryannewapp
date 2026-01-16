import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, User, Image as ImageIcon, Box, Video, 
  Search, Grid, Download, Trash2, Plus, 
  Loader2, Maximize2, X, Send, Globe, Info
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { ImageTask, VideoTask, ImageModel, TaskStatus } from '../types';
import { createNanoBananaPro4KTask, queryImageTask } from '../services/imageService';
import { ImageModal } from '../components/ImageModal';
import { SceneReferenceViewer } from '../components/SceneReferenceViewer';

type CategoryFilter = 'all' | 'character' | 'scene' | 'product' | 'video';

export const AssetsPage = () => {
  const { t, lang, activeChannel } = useGlobal();

  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  const [videoTasks, setVideoTasks] = useState<VideoTask[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [genCategory, setGenCategory] = useState<'character' | 'scene' | 'product'>('character');
  const [genPrompt, setGenPrompt] = useState('');
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [is360Enabled, setIs360Enabled] = useState(false);
  
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [viewer3D, setViewer3D] = useState<{ image: string, title: string } | null>(null);

  useEffect(() => {
    const savedImages = localStorage.getItem('sora_image_tasks');
    const savedVideos = localStorage.getItem('sora_v2_tasks');
    if (savedImages) setImageTasks(JSON.parse(savedImages));
    if (savedVideos) setVideoTasks(JSON.parse(savedVideos));
  }, []);

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

  const allAssets = useMemo(() => {
    const images = imageTasks.map(t => ({
      id: t.id,
      type: 'image' as const,
      url: t.resultUrl || t.resultUrls?.[0],
      prompt: t.prompt,
      status: t.status,
      createdAt: t.createdAt,
      is360: t.is360,
      category: t.category || (t.prompt.toLowerCase().includes('scene') ? 'scene' : 'other')
    }));
    return [...images].sort((a, b) => b.createdAt - a.createdAt);
  }, [imageTasks]);

  const filteredAssets = allAssets.filter(a => {
    const matchesSearch = a.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateAsset = async () => {
    if (!activeChannel?.apiToken || !genPrompt.trim()) return;
    setIsGenerating(true);
    const localId = `asset-${Date.now()}`;
    const isActually360 = (genCategory === 'scene' && is360Enabled);
    const finalPrompt = (isActually360 ? "equirectangular panorama, 360 immersive view, " : "") + genPrompt;
    
    const newTask: ImageTask = {
      id: localId, prompt: genPrompt, model: ImageModel.NANO_BANANA_PRO, 
      status: 'queued', createdAt: Date.now(), category: genCategory, 
      type: 'txt2img', is360: isActually360
    };

    setImageTasks(prev => [newTask, ...prev]);

    try {
      const results = await createNanoBananaPro4KTask(activeChannel.baseUrl, activeChannel.apiToken, finalPrompt, [], { aspectRatio: isActually360 ? '16:9' : '1:1', resolution: '2K' });
      setImageTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'success' as TaskStatus, resultUrl: results[0] } : t));
    } catch (e) {
      setImageTasks(prev => prev.map(t => t.id === localId ? { ...t, status: 'failed' as TaskStatus } : t));
    } finally { setIsGenerating(false); setShowGenPanel(false); }
  };

  return (
    <div className="h-full flex bg-[#F5F5F7] overflow-hidden">
      <ImageModal isOpen={!!modalImage} imageUrl={modalImage} onClose={() => setModalImage(null)} />
      {viewer3D && <SceneReferenceViewer image={viewer3D.image} title={viewer3D.title} onClose={() => setViewer3D(null)} />}

      <aside className="w-64 border-r border-gray-200 bg-white/60 backdrop-blur-xl flex flex-col p-6 z-10">
        <div className="flex items-center gap-3 mb-10"><div className="p-2 bg-[#007AFF] rounded-xl"><Database className="text-white w-5 h-5" /></div><h1 className="text-lg font-black">资产工坊</h1></div>
        <nav className="space-y-1 flex-1">
            {[{ id: 'all', label: '全部资产', icon: <Grid size={18}/> }, { id: 'scene', label: '场景库', icon: <ImageIcon size={18}/> }].map(item => (
                <button key={item.id} onClick={() => setActiveCategory(item.id as CategoryFilter)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeCategory === item.id ? 'bg-[#007AFF] text-white' : 'text-gray-500 hover:bg-black/5'}`}>{item.icon}<span>{item.label}</span></button>
            ))}
        </nav>
        <button onClick={() => setShowGenPanel(true)} className="w-full bg-[#1D1D1F] text-white py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 mt-auto"><Plus size={16}/>生成资产</button>
      </aside>

      <main className="flex-1 flex flex-col">
          <header className="h-20 bg-white/80 backdrop-blur-md border-b flex items-center px-8">
              <div className="relative w-96"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索资产..." className="w-full bg-[#F5F5F7] rounded-full py-2.5 pl-12 pr-6 text-sm focus:ring-2 focus:ring-[#007AFF]/20 outline-none" /></div>
          </header>
          <div className="flex-1 overflow-y-auto p-8"><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {filteredAssets.map(asset => (
                  <div key={asset.id} className="group bg-white rounded-3xl border shadow-sm hover:shadow-apple-card transition-all overflow-hidden">
                      <div className="aspect-[3/4] relative bg-gray-100">
                          {asset.status === 'success' ? (
                              <><img src={asset.url} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-4">
                                  <div className="flex justify-end gap-2">
                                      {asset.is360 && <button onClick={() => setViewer3D({ image: asset.url!, title: asset.prompt })} className="p-2 bg-indigo-600 rounded-full text-white shadow-lg flex items-center gap-2 px-3"><Globe size={14}/><span className="text-[10px] font-black uppercase">进入空间</span></button>}
                                      <button onClick={() => setModalImage(asset.url!)} className="p-2 bg-white/20 rounded-full text-white backdrop-blur-md"><Maximize2 size={14}/></button>
                                  </div>
                              </div></>
                          ) : <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-[#007AFF]"/></div>}
                      </div>
                      <div className="p-4"><p className="text-[11px] font-bold line-clamp-2">"{asset.prompt}"</p></div>
                  </div>
              ))}
          </div></div>
      </main>

      {showGenPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => !isGenerating && setShowGenPanel(false)} />
              <div className="relative w-[400px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
                  <div className="p-8 border-b flex items-center justify-between"><h2 className="text-xl font-black">新资产生成</h2><button onClick={() => setShowGenPanel(false)}><X size={20}/></button></div>
                  <div className="flex-1 p-8 space-y-8">
                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">资产分类</label>
                          <div className="grid grid-cols-3 gap-2">
                              {['character', 'scene', 'product'].map(cat => (
                                  <button key={cat} onClick={() => setGenCategory(cat as any)} className={`py-4 rounded-xl text-[10px] font-black uppercase border ${genCategory === cat ? 'bg-blue-50 border-[#007AFF] text-[#007AFF]' : 'border-gray-100'}`}>{cat}</button>
                              ))}
                          </div>
                      </div>
                      {genCategory === 'scene' && (
                          <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                              <div className="flex items-center gap-3"><Globe className="text-indigo-600" size={18}/><div><h4 className="text-xs font-black">360 漫游模式</h4><p className="text-[9px] text-gray-400">生成可进入的 3D 参考空间</p></div></div>
                              <input type="checkbox" checked={is360Enabled} onChange={e => setIs360Enabled(e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                          </div>
                      )}
                      <textarea value={genPrompt} onChange={e => setGenPrompt(e.target.value)} placeholder="描述资产视觉构想..." className="w-full bg-[#F5F5F7] rounded-3xl p-6 text-sm font-bold min-h-[150px] outline-none" />
                  </div>
                  <div className="p-8 border-t"><button onClick={handleCreateAsset} disabled={isGenerating} className="w-full bg-[#1D1D1F] text-white py-4 rounded-2xl font-black">{isGenerating ? '生成中...' : '提交生成'}</button></div>
              </div>
          </div>
      )}
    </div>
  );
};