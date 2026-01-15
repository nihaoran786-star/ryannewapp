import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  Clapperboard, Sparkles, LayoutGrid, ChevronRight, Wand2, 
  Loader2, Play, Video, Image as ImageIcon, Camera, MoreHorizontal,
  RefreshCw, CheckCircle2, Film, AlertCircle, Download, Plus,
  Maximize2, Ratio, Monitor, Settings2, ChevronDown, Clock,
  Layers, ChevronUp, ZoomIn, ZoomOut, Scissors, GripHorizontal,
  ArrowRight, Sparkle, User, Box, Trash2, Send, Type, MousePointer2,
  Undo2, Check, X, MoveHorizontal, Grab, Upload
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { ScriptProject, StoryboardShot, ShotVariation, ImageModel, SoraModel, StoryboardScene, IMAGE_MODEL_OPTIONS } from '../types';
import { createImageGenerationTask, queryImageTask, createNanoBananaPro4KTask, createImageEditTask } from '../services/imageService';
import { createVideoI2VTask, createVideoTask, queryVideoTask } from '../services/soraService';
import { analyzeShotStorytelling } from '../services/directorService';
import { ImageModal } from '../components/ImageModal';

const { useParams, useNavigate } = ReactRouterDOM as any;

/**
 * Helper: Convert URL to File for I2I API
 */
const urlToFile = async (url: string, filename: string): Promise<File> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new File([blob], filename, { type: 'image/png' });
    } catch (e) {
        throw new Error("Failed to load image reference.");
    }
};

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

export const DirectorConsolePage = () => {
  const { lang, t, activeChannel, volcSettings } = useGlobal();
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  // --- Data States ---
  const [project, setProject] = useState<ScriptProject | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  
  // --- AI Fission States ---
  const [fissionSource, setFissionSource] = useState<StoryboardShot | null>(null);
  const [fissionResults, setFissionResults] = useState<Array<{angle: string, prompt: string, status: 'idle' | 'gen' | 'done', url?: string}>>([]);
  const [isFissionAnalyzing, setIsFissionAnalyzing] = useState(false);

  // --- Process States ---
  const [generatingVariation, setGeneratingVariation] = useState<Record<string, boolean>>({}); 
  
  // --- UI Configurations ---
  const [selectedModel, setSelectedModel] = useState<ImageModel>(ImageModel.NANO_BANANA_PRO);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('2K');
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);

  // --- Drag & Drop States ---
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const timelineFileInputRef = useRef<HTMLInputElement>(null);

  // Load Project
  useEffect(() => {
    if (!projectId) return;
    const saved = localStorage.getItem('sora_script_projects');
    if (saved) {
      const projects: ScriptProject[] = JSON.parse(saved);
      const found = projects.find(p => p.id === projectId);
      if (found) {
          setProject(found);
          if (found.storyboard?.scenes?.[0]?.shots?.[0] && !activeShotId) {
              setActiveShotId(found.storyboard.scenes[0].shots[0].id);
          }
      }
    }
  }, [projectId]);

  const saveProject = (updatedProj: ScriptProject) => {
      const saved = localStorage.getItem('sora_script_projects');
      if (saved) {
          const projects: ScriptProject[] = JSON.parse(saved);
          const updatedList = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
          localStorage.setItem('sora_script_projects', JSON.stringify(updatedList));
          setProject({...updatedProj});
      }
  };

  const isChatModel = (model: ImageModel) => 
      model === ImageModel.NANO_BANANA_PRO || model === ImageModel.NANO_BANANA_PRO_CHAT;

  // --- Computed Data ---
  const timelineShots = useMemo(() => {
      if (!project?.storyboard?.scenes) return [];
      return project.storyboard.scenes.flatMap((scene, sIdx) => 
          scene.shots.map((shot, shIdx) => ({
              ...shot,
              sceneNumber: scene.number,
              sceneHeader: scene.header,
              sceneIndex: sIdx,
              shotIndex: shIdx,
              globalIndex: `${sIdx}-${shIdx}`,
              bestThumb: shot.variations?.find(v => v.status === 'success')?.imageUrl
          }))
      );
  }, [project]);

  const activeScene = useMemo(() => project?.storyboard?.scenes[activeSceneIndex], [project, activeSceneIndex]);
  const activeShot = useMemo(() => activeScene?.shots.find(s => s.id === activeShotId), [activeScene, activeShotId]);
  const activeShotIndex = useMemo(() => activeScene?.shots.findIndex(s => s.id === activeShotId) ?? 0, [activeScene, activeShotId]);

  // Derived: Current viewed variation
  const activeVariation = useMemo(() => {
    return activeShot?.variations?.find(v => v.status === 'success');
  }, [activeShot]);

  // Handle Dynamic Prompt Sync
  const handleUpdateShotPrompt = (newPrompt: string) => {
      if (!project?.storyboard || !activeShot) return;
      const updatedScenes = [...project.storyboard.scenes];
      updatedScenes[activeSceneIndex].shots[activeShotIndex].constructedPrompt = newPrompt;
      saveProject({...project, storyboard: {...project.storyboard, scenes: updatedScenes}});
  };

  // --- Actions ---

  const handleTimelineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !project?.storyboard) return;
      const dataUrl = await fileToDataURL(file);
      const newShotId = `shot-up-${Date.now()}`;
      const newShot: StoryboardShot = {
          id: newShotId,
          text: `Upload: ${file.name}`,
          constructedPrompt: `Manual Ingest: ${file.name}`,
          variations: [{ id: `v-${Date.now()}`, type: 'initial', angleName: 'User Upload', prompt: 'Imported Media', status: 'success', imageUrl: dataUrl }],
          characterIds: [], sceneVisualIds: [], propIds: []
      };
      const updatedScenes = [...project.storyboard.scenes];
      updatedScenes[activeSceneIndex].shots.splice(activeShotIndex + 1, 0, newShot);
      saveProject({...project, storyboard: {...project.storyboard, scenes: updatedScenes}});
      setActiveShotId(newShotId);
  };

  const handleGenerateCurrentShot = async () => {
      if (!activeShot || !activeChannel?.apiToken || !project?.storyboard) return;
      const tempId = `var-${Date.now()}`;
      setGeneratingVariation(prev => ({...prev, [activeShot.id]: true}));

      const promptToAnchor = activeShot.constructedPrompt || activeShot.text;
      const newVar: ShotVariation = { 
        id: tempId, 
        type: 'initial', 
        angleName: 'Render V1', 
        prompt: promptToAnchor, 
        status: 'processing' 
      };
      
      const updatedScenes = [...project.storyboard.scenes];
      const shot = updatedScenes[activeSceneIndex].shots[activeShotIndex];
      if (!shot.variations) shot.variations = [];
      shot.variations = [newVar, ...shot.variations]; 
      saveProject({...project, storyboard: {...project.storyboard, scenes: updatedScenes}});

      try {
          if (isChatModel(selectedModel)) {
              const res = await createNanoBananaPro4KTask(activeChannel.baseUrl, activeChannel.apiToken, promptToAnchor, [], { aspectRatio, resolution }, selectedModel);
              updateVarStatus(activeSceneIndex, activeShotIndex, tempId, 'success', res[0]);
          } else {
              const apiId = await createImageGenerationTask(activeChannel.baseUrl, activeChannel.apiToken, promptToAnchor, selectedModel, { aspectRatio, resolution });
              pollVar(activeSceneIndex, activeShotIndex, tempId, apiId);
          }
      } catch (e) { updateVarStatus(activeSceneIndex, activeShotIndex, tempId, 'failed'); }
      finally { setGeneratingVariation(prev => ({...prev, [activeShot.id]: false})); }
  };

  const updateVarStatus = (sIdx: number, shIdx: number, varId: string, status: 'success'|'failed', url?: string) => {
    setProject(prev => {
        if (!prev?.storyboard) return prev;
        const newScenes = [...prev.storyboard.scenes];
        const v = newScenes[sIdx].shots[shIdx].variations?.find(x => x.id === varId);
        if (v) { v.status = status; v.imageUrl = url; }
        const updatedList = JSON.parse(localStorage.getItem('sora_script_projects') || '[]').map((p:any) => p.id === prev.id ? {...prev, storyboard: {...prev.storyboard, scenes: newScenes}} : p);
        localStorage.setItem('sora_script_projects', JSON.stringify(updatedList));
        return {...prev, storyboard: {...prev.storyboard, scenes: newScenes}};
    });
  };

  const pollVar = (sIdx: number, shIdx: number, varId: string, apiId: string) => {
      const interval = setInterval(async () => {
          if (!activeChannel?.apiToken) return;
          try {
              const res = await queryImageTask(activeChannel.baseUrl, activeChannel.apiToken, apiId);
              if (res.status === 'success' || res.status === 'failed') {
                  clearInterval(interval);
                  updateVarStatus(sIdx, shIdx, varId, res.status === 'success' ? 'success' : 'failed', res.result_url || res.result_urls?.[0]);
              }
          } catch (e) { clearInterval(interval); }
      }, 3000);
  };

  const handleRemoveRef = (type: 'char' | 'scene' | 'prop', refId: string) => {
      if (!project?.storyboard || !activeShot) return;
      const updatedScenes = [...project.storyboard.scenes];
      const shot = updatedScenes[activeSceneIndex].shots[activeShotIndex];
      if (type === 'char') shot.characterIds = shot.characterIds?.filter(id => id !== refId);
      if (type === 'scene') shot.sceneVisualIds = shot.sceneVisualIds?.filter(id => id !== refId);
      if (type === 'prop') shot.propIds = shot.propIds?.filter(id => id !== refId);
      saveProject({...project, storyboard: {...project.storyboard, scenes: updatedScenes}});
  };

  // --- AI Fission ---
  const handleOpenFission = async (shot: StoryboardShot) => {
      setFissionSource(shot); setIsFissionAnalyzing(true); setFissionResults([]);
      try {
          const analysis = await analyzeShotStorytelling(volcSettings, shot.text, `Scene: ${activeScene?.header}`);
          if (analysis) {
              const items = analysis.recommended_angles.map(ang => ({ angle: ang.name, prompt: ang.prompt_modifier, status: 'idle' as const }));
              setFissionResults(items);
              const sourceImgUrl = shot.variations?.find(v => v.status === 'success')?.imageUrl;
              if (sourceImgUrl && activeChannel?.apiToken) {
                  const imageFile = await urlToFile(sourceImgUrl, 'reference.png');
                  items.forEach((item, idx) => generateFissionRender(idx, item.prompt, imageFile));
              }
          }
      } catch (e) { alert("AI Fission Analysis failed"); }
      finally { setIsFissionAnalyzing(false); }
  };

  const generateFissionRender = async (index: number, anglePrompt: string, refFile: File) => {
    if (!activeChannel?.apiToken) return;
    setFissionResults(prev => prev.map((it, i) => i === index ? {...it, status: 'gen'} : it));
    const fullPrompt = `${anglePrompt}, ${fissionSource?.constructedPrompt || fissionSource?.text}, ${project?.storyboard?.globalStyle}`;
    try {
        const apiId = await createImageEditTask(activeChannel.baseUrl, activeChannel.apiToken, fullPrompt, selectedModel, refFile, { aspect_ratio: aspectRatio, image_size: resolution });
        const interval = setInterval(async () => {
            const res = await queryImageTask(activeChannel.baseUrl, activeChannel.apiToken, apiId);
            if (res.status === 'success' || res.status === 'failed') {
                clearInterval(interval);
                setFissionResults(prev => prev.map((it, i) => i === index ? { ...it, status: res.status === 'success' ? 'done' : 'idle', url: res.result_url || res.result_urls?.[0] } : it));
            }
        }, 3000);
    } catch (e) { setFissionResults(prev => prev.map((it, i) => i === index ? {...it, status: 'idle'} : it)); }
  };

  const handleApplyFissionResult = (item: any) => {
    if (!project?.storyboard || !activeShot) return;
    const newShotId = `shot-fission-${Date.now()}`;
    const newShot: StoryboardShot = {
        id: newShotId,
        text: `[${item.angle}] ${activeShot.text}`,
        constructedPrompt: item.prompt,
        variations: [{ id: `var-${Date.now()}`, type: 'initial', angleName: item.angle, prompt: item.prompt, status: 'success', imageUrl: item.url }],
        characterIds: [...(activeShot.characterIds || [])], sceneVisualIds: [...(activeShot.sceneVisualIds || [])], propIds: [...(activeShot.propIds || [])]
    };
    const updatedScenes = [...project.storyboard.scenes];
    updatedScenes[activeSceneIndex].shots.splice(activeShotIndex + 1, 0, newShot);
    saveProject({...project, storyboard: {...project.storyboard, scenes: updatedScenes}});
    setFissionSource(null); setActiveShotId(newShotId);
  };

  // --- Optimized Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedShotId(id);
      e.dataTransfer.setData('text/shot-id', id);
      // macOS fluid drag style
      const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
      ghost.style.position = "absolute";
      ghost.style.top = "-1000px";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 100, 60);
      setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
      e.preventDefault();
      if (draggedShotId !== id) setDropTargetId(id);
  };
  
  const handleDropOnShot = (targetId: string) => {
    if (!draggedShotId || draggedShotId === targetId || !project?.storyboard) {
        setDropTargetId(null);
        setDraggedShotId(null);
        return;
    }
    const updatedScenes = [...project.storyboard.scenes];
    const scene = updatedScenes[activeSceneIndex];
    const draggedIdx = scene.shots.findIndex(s => s.id === draggedShotId);
    const targetIdx = scene.shots.findIndex(s => s.id === targetId);
    if (draggedIdx !== -1 && targetIdx !== -1) {
        const [draggedShot] = scene.shots.splice(draggedIdx, 1);
        scene.shots.splice(targetIdx, 0, draggedShot);
        saveProject({...project, storyboard: {...project.storyboard, scenes: updatedScenes}});
    }
    setDropTargetId(null);
    setDraggedShotId(null);
  };

  if (!project) return <div className="h-full flex items-center justify-center bg-[#F5F5F7]"><Loader2 className="animate-spin text-[#007AFF]" /></div>;

  return (
    <div className="h-full bg-[#F5F5F7] text-[#1D1D1F] flex flex-col overflow-hidden font-sans relative">
      <ImageModal isOpen={!!modalImage} imageUrl={modalImage} onClose={() => setModalImage(null)} />

      {/* AI Fission Mode */}
      {fissionSource && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-3xl flex flex-col animate-in fade-in duration-500">
              <div className="h-20 shrink-0 flex items-center justify-between px-10 border-b border-white/5 bg-black/20">
                  <div className="flex items-center gap-5">
                      <div className="p-3.5 bg-indigo-500 rounded-[22px] text-white shadow-2xl shadow-indigo-500/30"><Sparkles size={24} /></div>
                      <div>
                          <h2 className="text-xl font-black text-white tracking-tight uppercase">AI Shot Fission</h2>
                          <p className="text-white/40 text-[9px] uppercase font-black tracking-[0.2em] mt-0.5">Automated Cinematic Expansion</p>
                      </div>
                  </div>
                  <button onClick={() => setFissionSource(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                  {isFissionAnalyzing ? (
                      <div className="h-full flex flex-col items-center justify-center gap-6">
                          <Loader2 size={56} className="animate-spin text-indigo-400" />
                          <p className="text-indigo-200/50 font-black animate-pulse tracking-[0.3em] uppercase text-[10px]">Analyzing Shot Dynamics...</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 max-w-[1400px] mx-auto">
                          {fissionResults.map((item, i) => (
                              <div key={i} className="bg-white/5 rounded-[40px] border border-white/10 overflow-hidden flex flex-col shadow-2xl group animate-in slide-in-from-bottom-8 duration-700" style={{animationDelay: `${i*150}ms`}}>
                                  <div className="aspect-square relative bg-black/40">
                                      {item.url ? <img src={item.url} className="w-full h-full object-cover" /> : (
                                          <div className="w-full h-full flex flex-col items-center justify-center gap-5">
                                              <Loader2 className={`animate-spin ${item.status === 'gen' ? 'text-indigo-400' : 'text-white/5'}`} size={40} />
                                              <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">{item.status === 'gen' ? 'Rendering' : 'Ready'}</span>
                                          </div>
                                      )}
                                      {item.url && (
                                          <div className="absolute inset-0 bg-indigo-600/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-5 backdrop-blur-md">
                                              <button onClick={() => handleApplyFissionResult(item)} className="bg-white text-indigo-600 px-8 py-3.5 rounded-full font-black text-[10px] uppercase shadow-2xl hover:scale-105 transition-all flex items-center gap-2"><Check size={18} strokeWidth={4} /> Add to Sequence</button>
                                              <button onClick={() => setModalImage(item.url!)} className="text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Maximize2 size={14}/> Preview Detail</button>
                                          </div>
                                      )}
                                  </div>
                                  <div className="p-8">
                                      <div className="flex items-center gap-2 mb-4">
                                          <div className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]" />
                                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{item.angle}</span>
                                      </div>
                                      <p className="text-xs text-white/70 font-bold line-clamp-3 leading-relaxed italic">"{item.prompt}"</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Header */}
      <div className="h-14 shrink-0 bg-white border-b border-[#E5E5EA] flex items-center justify-between px-6 z-30 shadow-sm">
          <div className="flex items-center gap-4">
              <Sparkle size={16} className="text-[#007AFF] fill-current" />
              <h2 className="font-bold text-sm tracking-tight truncate max-w-[200px] uppercase">{project.title}</h2>
          </div>
          <button className="group flex items-center gap-2 px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95">
              <Wand2 size={14} strokeWidth={3} />
              <span>Global Render</span>
          </button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Sidebar */}
          <div className="w-60 bg-white border-r border-[#E5E5EA] flex flex-col z-20 shrink-0">
              <div className="p-5 border-b border-[#F5F5F7] bg-[#FAFAFA]"><h3 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2"><LayoutGrid size={12} /> Narrative Tree</h3></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {project.storyboard?.scenes.map((scene, sIdx) => (
                      <div key={scene.id}>
                          <div className={`px-5 py-3 text-[10px] font-black uppercase flex justify-between cursor-pointer transition-colors border-b border-[#F5F5F7] ${activeSceneIndex === sIdx ? 'bg-[#F5F5F7] text-[#1D1D1F]' : 'text-gray-400 hover:bg-[#FAFAFA]'}`} onClick={() => setActiveSceneIndex(sIdx)}>
                              <div className="flex items-center gap-3">{activeSceneIndex === sIdx ? <ChevronDown size={12} strokeWidth={3}/> : <ChevronRight size={12} strokeWidth={3}/>}<span>{scene.header}</span></div>
                          </div>
                          {activeSceneIndex === sIdx && (
                              <div className="bg-[#FAFAFA] pb-2 animate-in slide-in-from-left-2 duration-200">
                                  {scene.shots.map((shot, shIdx) => (
                                      <div key={shot.id} onClick={() => setActiveShotId(shot.id)} className={`pl-10 pr-5 py-2.5 text-[11px] transition-all cursor-pointer flex items-center justify-between border-l-4 ${activeShotId === shot.id ? 'border-[#007AFF] bg-blue-50/50 text-[#007AFF] font-black' : 'border-transparent text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
                                          <span className="truncate">{shIdx + 1}. {shot.text}</span>
                                          {shot.variations?.some(v => v.status==='success') && <CheckCircle2 size={10} className="text-green-500" />}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>

          {/* Viewport */}
          <div className="flex-1 bg-[#F5F5F7] flex flex-col relative min-w-0 p-6 gap-6">
              {activeShot ? (
                  <>
                      <div className="flex-1 bg-white rounded-[40px] border border-[#E5E5EA] shadow-sm flex flex-col overflow-hidden relative group/stage">
                           <div className="h-12 border-b border-[#F5F5F7] flex items-center justify-between px-8 bg-white/50 backdrop-blur-sm z-10 shrink-0">
                               <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-[0.2em]"><Camera size={14} /> Master Stage</div>
                               <div className="flex items-center gap-2">
                                   <div className={`w-1.5 h-1.5 rounded-full ${activeShot.variations?.some(v => v.status === 'success') ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-400'}`} />
                                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{activeShot.variations?.some(v => v.status === 'success') ? 'Online' : 'Pending'}</span>
                               </div>
                           </div>
                           <div className="flex-1 flex items-center justify-center p-12 bg-[#F9F9FB] relative overflow-hidden">
                               {activeShot.variations?.some(v => v.status === 'success') ? (
                                   <div className="relative max-w-5xl w-full aspect-video bg-white rounded-3xl overflow-hidden shadow-2xl border border-black/5 group/img animate-in zoom-in-95 duration-500">
                                       <img src={activeShot.variations.find(v => v.status === 'success')?.imageUrl} className="w-full h-full object-contain cursor-zoom-in" onClick={() => setModalImage(activeShot.variations?.find(v => v.status === 'success')?.imageUrl!)} />
                                       <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center backdrop-blur-md">
                                            <button onClick={() => handleOpenFission(activeShot)} className="bg-white text-[#1D1D1F] px-8 py-4 rounded-full font-black text-[10px] uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 border border-black/5 tracking-[0.2em]"><Sparkles size={18} className="text-indigo-500" /> AI Director Fission</button>
                                       </div>
                                   </div>
                               ) : (
                                   <div className="text-center text-gray-300 flex flex-col items-center gap-5">
                                       <div className="w-24 h-24 rounded-[42px] bg-white shadow-apple card flex items-center justify-center mb-2 border border-gray-100"><ImageIcon size={40} strokeWidth={1.5} /></div>
                                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Rendering Engine Idle</p>
                                   </div>
                               )}
                           </div>
                      </div>
                      
                      <div className="bg-white rounded-[32px] border border-[#E5E5EA] p-8 shadow-sm flex flex-col items-center justify-center min-h-[140px] relative shrink-0">
                          <div className="absolute -top-3 left-10 bg-[#1D1D1F] px-4 py-1.5 rounded-full text-[9px] font-black text-white uppercase tracking-[0.2em] shadow-lg flex items-center gap-2">
                             {activeVariation ? <CheckCircle2 size={10} className="text-green-400" /> : <RefreshCw size={10} className="text-blue-400 animate-spin-slow" />}
                             {activeVariation ? 'Locked Sequence Data' : 'Draft Instruction'}
                          </div>
                          <p className="text-center font-serif text-2xl text-[#1D1D1F] leading-snug max-w-4xl italic font-medium">
                            "{activeShot.constructedPrompt || activeShot.text}"
                          </p>
                          {activeVariation && (
                            <div className="mt-3 flex items-center gap-2 opacity-30">
                              <div className="h-[1px] w-4 bg-gray-400" />
                              <span className="text-[8px] font-black uppercase tracking-widest">Anchored to rendered image</span>
                              <div className="h-[1px] w-4 bg-gray-400" />
                            </div>
                          )}
                      </div>
                  </>
              ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-200 opacity-20"><Clapperboard size={150} strokeWidth={1} /></div>
              )}
          </div>

          {/* Inspector */}
          <div className="w-80 bg-white border-l border-[#E5E5EA] flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] shrink-0">
              {activeShot ? (
                  <>
                      <div className="p-5 border-b border-[#F5F5F7] flex items-center justify-between bg-[#FAFAFA] shrink-0">
                          <div className="flex items-center gap-3"><Settings2 size={16} className="text-[#007AFF]" /><span className="text-[10px] font-black text-[#1D1D1F] uppercase tracking-[0.2em]">Cinematography Inspector</span></div>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
                          
                          {/* Visual Anchors Matrix */}
                          <div className="space-y-4">
                              <div className="flex items-center justify-between px-1"><label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">Project Assets</label><Layers size={10} className="text-gray-300" /></div>
                              <div className="bg-[#F5F5F7] rounded-3xl p-3 border border-black/5 shadow-inner">
                                  <div className="grid grid-cols-1 gap-3.5">
                                      {[
                                        { icon: <User size={10} />, ids: activeShot.characterIds, store: project.storyboard?.characters, type: 'char' },
                                        { icon: <ImageIcon size={10} />, ids: activeShot.sceneVisualIds, store: project.storyboard?.sceneVisuals, type: 'scene' },
                                        { icon: <Box size={10} />, ids: activeShot.propIds, store: project.storyboard?.props, type: 'prop' }
                                      ].map((cat, idx) => (
                                          <div key={idx} className="flex items-center gap-2">
                                              <div className="w-6 h-6 flex items-center justify-center bg-white rounded-lg text-gray-400 shrink-0 shadow-sm border border-black/5">{cat.icon}</div>
                                              <div className="flex flex-wrap gap-1">
                                                  {cat.ids?.map(id => {
                                                      const item = (cat.store as any[])?.find(c => c.id === id);
                                                      return item && (
                                                          <div key={id} className="relative group/ref w-7 h-7 rounded-lg overflow-hidden bg-white shadow-sm border border-white transition-all hover:scale-110 cursor-pointer">
                                                              {item.referenceImageUrl ? <img src={item.referenceImageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">{cat.icon}</div>}
                                                              <button onClick={() => handleRemoveRef(cat.type as any, id)} className="absolute inset-0 bg-red-500/90 text-white opacity-0 group-hover/ref:opacity-100 flex items-center justify-center transition-all"><Trash2 size={10}/></button>
                                                          </div>
                                                      );
                                                  })}
                                                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-[#007AFF] hover:bg-white transition-all border border-dashed border-gray-200 hover:border-blue-200"><Plus size={14}/></button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          {/* Visual Descriptor */}
                          <div className="space-y-4">
                              <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2"><Type size={12} /> Descriptive Directive</label>
                              <div className="bg-[#F5F5F7] rounded-3xl p-5 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 transition-all border-2 border-transparent focus-within:border-blue-100 shadow-inner">
                                  <textarea 
                                      value={activeShot.constructedPrompt || activeShot.text}
                                      onChange={(e) => handleUpdateShotPrompt(e.target.value)}
                                      placeholder="Refine the visual brief..."
                                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-[11px] font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none resize-none leading-relaxed min-h-[110px]"
                                  />
                              </div>
                          </div>

                          {/* Configuration & Action */}
                          <div className="pt-6 border-t border-gray-100 space-y-6">
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="relative group overflow-hidden">
                                      <div className="bg-[#F5F5F7] hover:bg-[#EBEBEF] rounded-2xl px-4 py-3 border border-black/5 transition-all flex flex-col group-active:scale-95 cursor-pointer">
                                          <span className="text-[7px] font-black text-gray-400 uppercase block mb-1">Model</span>
                                          <select value={selectedModel} onChange={e => setSelectedModel(e.target.value as ImageModel)} className="w-full bg-transparent text-[10px] font-black outline-none cursor-pointer p-0 appearance-none text-[#1D1D1F] uppercase z-10 border-none focus:ring-0">
                                              {IMAGE_MODEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                          </select>
                                          <ChevronDown size={10} className="absolute right-3 bottom-4 text-gray-400 pointer-events-none group-hover:text-[#007AFF] transition-colors" />
                                      </div>
                                  </div>
                                  <div className="relative group overflow-hidden">
                                      <div className="bg-[#F5F5F7] hover:bg-[#EBEBEF] rounded-2xl px-4 py-3 border border-black/5 transition-all flex flex-col group-active:scale-95 cursor-pointer">
                                          <span className="text-[7px] font-black text-gray-400 uppercase block mb-1">Ratio</span>
                                          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-transparent text-[10px] font-black outline-none cursor-pointer p-0 appearance-none text-[#1D1D1F] uppercase z-10 border-none focus:ring-0">
                                              {['16:9', '9:16', '1:1', '21:9', '4:5'].map(r => <option key={r} value={r}>{r}</option>)}
                                          </select>
                                          <ChevronDown size={10} className="absolute right-3 bottom-4 text-gray-400 pointer-events-none group-hover:text-[#007AFF] transition-colors" />
                                      </div>
                                  </div>
                              </div>
                              <button 
                                onClick={handleGenerateCurrentShot}
                                disabled={generatingVariation[activeShot.id]}
                                className="w-full bg-[#007AFF] hover:bg-blue-600 text-white py-5 rounded-[28px] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
                              >
                                  {generatingVariation[activeShot.id] ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={3} />}
                                  Execute Rendering
                              </button>
                          </div>
                      </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-200 opacity-20"><Settings2 size={50} /></div>
              )}
          </div>
      </div>

      {/* Narrative Timeline */}
      <div className="h-56 bg-white border-t border-[#E5E5EA] flex flex-col shrink-0 z-40">
          <div className="h-10 bg-white border-b border-[#F5F5F7] flex items-center justify-between px-10 shrink-0">
              <div className="flex items-center gap-8">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2"><Clock size={12} /> Professional Timeline</span>
                  <div className="hidden sm:flex items-center gap-2 text-[8px] font-black text-indigo-400 uppercase tracking-[0.1em] bg-indigo-50 px-2.5 py-1 rounded-full"><Grab size={10}/> Drag to Reorder Sequence</div>
              </div>
              <div className="flex items-center gap-4">
                  <button onClick={() => setTimelineZoom(Math.max(0.6, timelineZoom - 0.2))} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-all"><ZoomOut size={14} /></button>
                  <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#007AFF] transition-all" style={{width: `${(timelineZoom/2)*100}%`}} /></div>
                  <button onClick={() => setTimelineZoom(Math.min(2, timelineZoom + 0.2))} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-all"><ZoomIn size={14} /></button>
              </div>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar-h bg-[#F9F9FB] p-6 relative">
             <div className="flex gap-4 min-w-max">
                 {timelineShots.map((tShot, idx) => (
                         <div 
                             key={tShot.id} 
                             draggable 
                             onDragStart={(e) => handleDragStart(e, tShot.id)} 
                             onDragOver={(e) => handleDragOver(e, tShot.id)} 
                             onDrop={() => handleDropOnShot(tShot.id)} 
                             onClick={() => { setActiveSceneIndex(tShot.sceneIndex); setActiveShotId(tShot.id); }} 
                             className={`relative group cursor-grab active:cursor-grabbing rounded-2xl overflow-hidden transition-all duration-500 shrink-0 bg-[#2C2C2E] border 
                                ${draggedShotId === tShot.id ? 'opacity-30 scale-90 blur-sm rotate-2' : 'opacity-100'} 
                                ${dropTargetId === tShot.id ? 'border-[#007AFF] ring-4 ring-blue-500/20 scale-[0.98]' : 'border-white/5'}
                                ${activeShotId === tShot.id ? 'ring-2 ring-[#007AFF] shadow-[0_20px_40px_rgba(0,122,255,0.2)] scale-105 z-10' : 'hover:scale-[1.02] shadow-xl shadow-black/5 hover:shadow-black/10'}`} 
                             style={{ width: `${200 * timelineZoom}px`, height: `${120 * timelineZoom}px` }}
                         >
                             {tShot.bestThumb ? (
                                 <img src={tShot.bestThumb} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                             ) : (
                                 <div className="w-full h-full flex items-center justify-center p-6 text-center bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E]">
                                     <span className="text-[9px] font-bold text-gray-500 line-clamp-2 uppercase tracking-tighter italic opacity-60">"{tShot.text}"</span>
                                 </div>
                             )}
                             
                             {/* Glossy Overlay Tags */}
                             <div className="absolute top-2.5 left-2.5 bg-black/40 backdrop-blur-xl px-2.5 py-0.5 rounded-lg text-[8px] font-black text-white/90 border border-white/10 uppercase z-20 tracking-tighter">
                                S{tShot.sceneNumber} <span className="mx-1 opacity-20">|</span> SH{tShot.shotIndex + 1}
                             </div>

                             {/* Drag Indicator Overlay */}
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3 pointer-events-none z-20">
                                <GripHorizontal size={20} className="text-white drop-shadow-lg" />
                             </div>
                         </div>
                 ))}
                 
                 {/* Asset Import Terminal */}
                 <div className="relative h-full flex items-center px-2">
                    <input ref={timelineFileInputRef} type="file" className="hidden" accept="image/*" onChange={handleTimelineUpload} />
                    <button 
                        onClick={() => timelineFileInputRef.current?.click()} 
                        className="w-16 h-full rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 hover:text-[#007AFF] hover:border-[#007AFF]/40 hover:bg-blue-50/50 transition-all group active:scale-95 shrink-0"
                        title="Import Local Reference"
                    >
                        <Upload size={24} className="group-hover:-translate-y-1 transition-transform" />
                        <div className="mt-2 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Import</div>
                        <div className="absolute -bottom-2 -right-2 bg-white rounded-full shadow-md p-1 border border-gray-100 group-hover:bg-[#007AFF] group-hover:text-white transition-colors"><Plus size={12} strokeWidth={3} /></div>
                    </button>
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
};