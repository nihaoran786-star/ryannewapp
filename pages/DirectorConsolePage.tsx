
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  Clapperboard, Sparkles, LayoutGrid, ChevronRight, Wand2, 
  Loader2, Play, Video, Image as ImageIcon, Camera, MoreHorizontal,
  RefreshCw, CheckCircle2, Film, AlertCircle, Download, Plus,
  Maximize2, Ratio, Monitor, Settings2, ChevronDown, Clock,
  Layers, ChevronUp, ZoomIn, ZoomOut, Scissors, GripHorizontal,
  ArrowRight, Sparkle
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { ScriptProject, StoryboardShot, ShotVariation, ImageModel, SoraModel, StoryboardScene, IMAGE_MODEL_OPTIONS } from '../types';
import { createImageGenerationTask, queryImageTask } from '../services/imageService';
import { createVideoI2VTask, createVideoTask, queryVideoTask } from '../services/soraService';
import { analyzeShotStorytelling } from '../services/directorService';
import { ImageModal } from '../components/ImageModal';

const { useParams, useNavigate } = ReactRouterDOM as any;

/**
 * Helper: Convert URL to File for I2V API
 */
const urlToFile = async (url: string, filename: string): Promise<File> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new File([blob], filename, { type: 'image/png' });
    } catch (e) {
        throw new Error("Failed to load image for video generation. Cross-origin issue?");
    }
};

export const DirectorConsolePage = () => {
  const { lang, t, activeChannel, volcSettings } = useGlobal();
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  // Data State
  const [project, setProject] = useState<ScriptProject | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  
  // Process State
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [analyzingShotId, setAnalyzingShotId] = useState<string | null>(null);
  const [generatingVariation, setGeneratingVariation] = useState<Record<string, boolean>>({}); 
  const [generatingVideo, setGeneratingVideo] = useState<Record<string, boolean>>({}); 
  
  // UI Configuration
  const [selectedModel, setSelectedModel] = useState<ImageModel>(ImageModel.NANO_BANANA_PRO);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('2K');
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);

  // Computed: Flattened Timeline Shots
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

  // --- Logic ---

  const getEffectivePrompt = (shot: StoryboardShot, modifier: string = ''): string => {
      let prompt = shot.constructedPrompt || shot.text;
      if (project?.storyboard) {
          const sb = project.storyboard;
          const assetDescriptions: string[] = [];
          shot.characterIds?.forEach(id => {
              const char = sb.characters.find(c => c.id === id);
              if (char) assetDescriptions.push(`Character: ${char.visualDescription}`);
          });
          shot.sceneVisualIds?.forEach(id => {
              const sv = sb.sceneVisuals.find(s => s.id === id);
              if (sv) assetDescriptions.push(`Location: ${sv.visualDescription}`);
          });
           shot.propIds?.forEach(id => {
              const p = sb.props.find(s => s.id === id);
              if (p) assetDescriptions.push(`Prop: ${p.visualDescription}`);
          });
          if (assetDescriptions.length > 0) {
              prompt += `. [Assets: ${assetDescriptions.join(' | ')}]`;
          }
      }
      prompt += `, ${modifier}, ${project?.storyboard?.globalStyle || 'Cinematic'}`;
      return prompt;
  };

  const handleBatchGenerateInitial = async () => {
      if (!project?.storyboard || !activeChannel?.apiToken) { alert(t('missingToken')); return; }
      setIsBatchGenerating(true);

      const updatedScenes = [...project.storyboard.scenes];
      let hasUpdates = false;

      for (let sIdx = 0; sIdx < updatedScenes.length; sIdx++) {
          const scene = updatedScenes[sIdx];
          for (let shIdx = 0; shIdx < scene.shots.length; shIdx++) {
              const shot = scene.shots[shIdx];
              if (shot.variations && shot.variations.length > 0) continue;
              if (!shot.variations) shot.variations = [];

              const variationId = `var-${Date.now()}-${sIdx}-${shIdx}`;
              const prompt = getEffectivePrompt(shot, "wide shot, establishing, cinematic lighting");

              const newVariation: ShotVariation = {
                  id: variationId,
                  type: 'initial',
                  angleName: 'Wide Shot (Auto)',
                  prompt: prompt,
                  status: 'processing'
              };
              shot.variations.push(newVariation);
              hasUpdates = true;

              createImageGenerationTask(
                  activeChannel.baseUrl, activeChannel.apiToken,
                  prompt, selectedModel, // Use selected model
                  { aspectRatio, resolution }
              ).then(apiId => {
                  newVariation.apiTaskId = apiId;
                  pollVariationStatus(sIdx, shIdx, variationId, apiId);
              }).catch(err => console.error(err));
          }
      }

      if (hasUpdates) saveProject({...project, storyboard: {...project.storyboard, scenes: updatedScenes}});
      setTimeout(() => setIsBatchGenerating(false), 1000);
  };

  const pollVariationStatus = (sIdx: number, shIdx: number, varId: string, apiId: string) => {
      const interval = setInterval(async () => {
          if (!activeChannel?.apiToken) return;
          try {
              const res = await queryImageTask(activeChannel.baseUrl, activeChannel.apiToken, apiId);
              const isSuccess = res.status === 'success' || (res.result_urls && res.result_urls.length > 0);
              const isFailed = res.status === 'failed';

              if (isSuccess || isFailed) {
                  clearInterval(interval);
                  setProject(prev => {
                      if (!prev?.storyboard) return prev;
                      const newScenes = [...prev.storyboard.scenes];
                      const targetShot = newScenes[sIdx].shots[shIdx];
                      const targetVar = targetShot.variations?.find(v => v.id === varId);
                      
                      if (targetVar) {
                          if (isSuccess) {
                              targetVar.status = 'success';
                              targetVar.imageUrl = res.result_url || res.result_urls?.[0];
                          } else {
                              targetVar.status = 'failed';
                          }
                      }
                      const updatedList = JSON.parse(localStorage.getItem('sora_script_projects') || '[]').map((p:any) => p.id === prev.id ? {...prev, storyboard: {...prev.storyboard, scenes: newScenes}} : p);
                      localStorage.setItem('sora_script_projects', JSON.stringify(updatedList));
                      return {...prev, storyboard: {...prev.storyboard, scenes: newScenes}};
                  });
              }
          } catch (e) { console.error(e); }
      }, 3000);
  };

  const handleAnalyzeShot = async (sceneId: string, shot: StoryboardShot) => {
      if (!volcSettings.apiKey) { alert(t('configureVolcAlert')); return; }
      setAnalyzingShotId(shot.id);
      try {
          const scene = project?.storyboard?.scenes.find(s => s.id === sceneId);
          const context = `Scene: ${scene?.header}. Mood: ${scene?.atmosphere}`;
          const analysis = await analyzeShotStorytelling(volcSettings, shot.text, context);
          
          if (analysis) {
              const updatedScenes = project!.storyboard!.scenes.map(s => {
                  if (s.id !== sceneId) return s;
                  return { ...s, shots: s.shots.map(sh => sh.id === shot.id ? { ...sh, analysis } : sh) };
              });
              saveProject({...project!, storyboard: {...project!.storyboard!, scenes: updatedScenes}});
          }
      } catch (e) { alert((e as any).message); } 
      finally { setAnalyzingShotId(null); }
  };

  const handleGenerateVariation = async (sceneIndex: number, shotIndex: number, angleName: string, modifier: string) => {
      if (!activeChannel?.apiToken || !project?.storyboard) return;
      const shot = project.storyboard.scenes[sceneIndex].shots[shotIndex];
      const tempId = `var-${Date.now()}`;
      setGeneratingVariation(prev => ({...prev, [tempId]: true}));

      const finalPrompt = getEffectivePrompt(shot, modifier);
      const newVariation: ShotVariation = {
          id: tempId,
          type: 'variation',
          angleName, prompt: finalPrompt, status: 'processing'
      };

      const updatedScenes = [...project.storyboard.scenes];
      if (!updatedScenes[sceneIndex].shots[shotIndex].variations) updatedScenes[sceneIndex].shots[shotIndex].variations = [];
      updatedScenes[sceneIndex].shots[shotIndex].variations!.push(newVariation);
      saveProject({...project, storyboard: {...project.storyboard, scenes: updatedScenes}});

      try {
          const apiId = await createImageGenerationTask(
              activeChannel.baseUrl, activeChannel.apiToken,
              finalPrompt, selectedModel, // Use selected model
              { aspectRatio, resolution }
          );
          const latestScenes = [...project.storyboard.scenes]; 
          const v = latestScenes[sceneIndex].shots[shotIndex].variations!.find(x => x.id === tempId);
          if (v) v.apiTaskId = apiId;
          saveProject({...project, storyboard: {...project.storyboard, scenes: latestScenes}});
          pollVariationStatus(sceneIndex, shotIndex, tempId, apiId);
      } catch (e: any) {
          alert(e.message);
          const latestScenes = [...project.storyboard.scenes]; 
          const v = latestScenes[sceneIndex].shots[shotIndex].variations!.find(x => x.id === tempId);
          if (v) v.status = 'failed';
          saveProject({...project, storyboard: {...project.storyboard, scenes: latestScenes}});
      } finally { setGeneratingVariation(prev => ({...prev, [tempId]: false})); }
  };

  const handleGenerateVideo = async (sceneIndex: number, shotIndex: number, variation: ShotVariation) => {
      if (!activeChannel?.apiToken || !variation.imageUrl) return;
      setGeneratingVideo(prev => ({...prev, [variation.id]: true}));
      try {
          const imageFile = await urlToFile(variation.imageUrl, `ref_${variation.id}.png`);
          const apiId = await createVideoI2VTask(
              activeChannel.baseUrl, activeChannel.apiToken,
              variation.prompt, SoraModel.SORA2_LANDSCAPE_15S, imageFile
          );
          const updatedScenes = [...project!.storyboard!.scenes];
          const shot = updatedScenes[sceneIndex].shots[shotIndex];
          const v = shot.variations!.find(x => x.id === variation.id);
          if (v) v.videoTaskId = apiId; 
          saveProject({...project!, storyboard: {...project!.storyboard!, scenes: updatedScenes}});
          pollVideoStatus(sceneIndex, shotIndex, variation.id, apiId);
      } catch (e: any) { alert(e.message); } 
      finally { setGeneratingVideo(prev => ({...prev, [variation.id]: false})); }
  };

  const pollVideoStatus = (sIdx: number, shIdx: number, varId: string, apiId: string) => {
      const interval = setInterval(async () => {
          if (!activeChannel?.apiToken) return;
          try {
              const res = await queryVideoTask(activeChannel.baseUrl, activeChannel.apiToken, apiId);
              const isSuccess = res.status === 'success' || !!res.result_video_url;
              const isFailed = res.status === 'failed';
              if (isSuccess || isFailed) {
                  clearInterval(interval);
                  setProject(prev => {
                      if (!prev?.storyboard) return prev;
                      const newScenes = [...prev.storyboard.scenes];
                      const targetVar = newScenes[sIdx].shots[shIdx].variations?.find(v => v.id === varId);
                      if (targetVar && isSuccess) targetVar.videoUrl = res.result_video_url;
                      return {...prev, storyboard: {...prev.storyboard, scenes: newScenes}};
                  });
              }
          } catch (e) { console.error(e); }
      }, 5000);
  };

  // --- Rendering Helpers ---

  // 1. Loading State
  if (!project) {
     return (
        <div className="h-full flex flex-col items-center justify-center bg-[#F5F5F7] text-gray-400 gap-4">
            <Loader2 className="animate-spin text-[#007AFF]" size={32} />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Loading Workspace...</p>
        </div>
     );
  }

  // 2. Empty State
  if (!project.storyboard) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-[#F5F5F7] text-[#1D1D1F] p-8 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mb-6 border border-[rgba(0,0,0,0.05)] shadow-apple-card">
                  <Clapperboard size={48} className="text-[#007AFF]" />
              </div>
              <h2 className="text-2xl font-bold mb-3 tracking-tight">Director Mode Unavailable</h2>
              <p className="text-gray-500 text-sm mb-8 text-center max-w-md leading-relaxed">
                  The director console requires a generated storyboard and assets. 
                  Please complete the script analysis phase first.
              </p>
              <button 
                onClick={() => navigate(`/project/${projectId}/script`)}
                className="px-8 py-3 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-500/30 hover:-translate-y-1"
              >
                  {t('back')}
              </button>
          </div>
      );
  }

  // 3. Main Director Console UI
  const activeScene = project.storyboard.scenes[activeSceneIndex];
  const activeShotIndex = activeScene?.shots.findIndex(s => s.id === activeShotId) ?? 0;
  const activeShot = activeScene?.shots[activeShotIndex];
  const activeShotVariation = activeShot?.variations?.[0]; 

  return (
    <div className="h-full bg-[#F5F5F7] text-[#1D1D1F] flex flex-col overflow-hidden font-sans selection:bg-[#007AFF]/20">
      <ImageModal isOpen={!!modalImage} imageUrl={modalImage} onClose={() => setModalImage(null)} />

      {/* Top Toolbar */}
      <div className="h-14 shrink-0 bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA] flex items-center justify-between px-6 z-30">
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[#1D1D1F]">
                  <Sparkle size={16} className="text-[#007AFF] fill-current" />
                  <h2 className="font-bold text-sm tracking-tight truncate max-w-[150px]">{project.title}</h2>
              </div>
              <div className="h-4 w-[1px] bg-gray-200" />
              <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-[#F5F5F7] px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                      <Layers size={14} className="text-gray-400" />
                      <select 
                        value={selectedModel} 
                        onChange={e => setSelectedModel(e.target.value as ImageModel)} 
                        className="bg-transparent text-xs font-semibold text-[#1D1D1F] outline-none cursor-pointer max-w-[120px]"
                      >
                          {IMAGE_MODEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center gap-2 bg-[#F5F5F7] px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                      <Ratio size={14} className="text-gray-400" />
                      <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-transparent text-xs font-semibold text-[#1D1D1F] outline-none cursor-pointer">
                          {['16:9', '9:16', '1:1', '4:5', '21:9'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                  </div>
                  <div className="flex items-center gap-2 bg-[#F5F5F7] px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                      <Monitor size={14} className="text-gray-400" />
                      <select value={resolution} onChange={e => setResolution(e.target.value)} className="bg-transparent text-xs font-semibold text-[#1D1D1F] outline-none cursor-pointer">
                          {['1K', '2K', '4K'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                  </div>
              </div>
          </div>
          
          <button 
            onClick={handleBatchGenerateInitial}
            disabled={isBatchGenerating}
            className="group flex items-center gap-2 px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-full font-bold text-xs shadow-lg shadow-black/10 transition-all active:scale-95 disabled:opacity-50"
          >
              {isBatchGenerating ? <Loader2 className="animate-spin text-white" size={14}/> : <Wand2 size={14} />}
              <span>{isBatchGenerating ? t('submitting') : t('autoGenerateAll')}</span>
          </button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left: Sequence List */}
          <div className="w-72 bg-white border-r border-[#E5E5EA] flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
              <div className="p-3 border-b border-[#F5F5F7] bg-[#FAFAFA]">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-2">
                      <LayoutGrid size={12} /> {t('sequence')}
                  </h3>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {project.storyboard.scenes.map((scene, sIdx) => (
                      <div key={scene.id}>
                          <div 
                            className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider flex justify-between cursor-pointer transition-colors group border-b border-[#F5F5F7]
                                ${activeSceneIndex === sIdx ? 'bg-[#F5F5F7] text-[#1D1D1F]' : 'text-gray-500 hover:bg-[#FAFAFA] hover:text-gray-700'}`}
                            onClick={() => setActiveSceneIndex(sIdx)}
                          >
                              <div className="flex items-center gap-2">
                                  {activeSceneIndex === sIdx ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                                  <span>{scene.header}</span>
                              </div>
                              <span className="opacity-40 bg-white px-1.5 rounded border border-gray-100">#{scene.number}</span>
                          </div>
                          
                          {activeSceneIndex === sIdx && (
                              <div className="bg-[#FAFAFA] pb-2 animate-in slide-in-from-left-2 duration-200">
                                  {scene.shots.map((shot, shIdx) => (
                                      <div 
                                        key={shot.id}
                                        onClick={() => setActiveShotId(shot.id)}
                                        className={`pl-8 pr-4 py-2.5 text-xs transition-all cursor-pointer flex items-center justify-between border-l-2
                                            ${activeShotId === shot.id 
                                                ? 'border-[#007AFF] bg-blue-50/50 text-[#007AFF] font-semibold' 
                                                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                                      >
                                          <div className="flex gap-3 min-w-0 items-baseline">
                                              <span className="text-gray-300 font-mono text-[10px]">{(shIdx + 1).toString().padStart(2, '0')}</span>
                                              <span className="truncate leading-snug">{shot.text.slice(0, 30)}</span>
                                          </div>
                                          {shot.variations && shot.variations.length > 0 && (
                                            <div className="flex gap-1.5 items-center">
                                                {shot.variations.some(v => v.videoUrl) && <Film size={10} className="text-purple-500" />}
                                                <div className={`w-1.5 h-1.5 rounded-full ${shot.variations.some(v => v.status==='success') ? 'bg-green-500' : 'bg-yellow-400'}`} />
                                            </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>

          {/* Center: Viewport */}
          <div className="flex-1 bg-[#F5F5F7] flex flex-col relative min-w-0 p-6 gap-4">
              {activeShot ? (
                  <>
                      <div className="flex-1 bg-white rounded-3xl border border-[#E5E5EA] shadow-sm flex flex-col overflow-hidden relative group/stage">
                           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                           
                           <div className="h-12 border-b border-[#F5F5F7] flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm z-10">
                               <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                   <Camera size={14} />
                                   <span>{t('stageView')}</span>
                               </div>
                               {activeShotVariation && (
                                   <div className="flex items-center gap-2">
                                       <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                                           {activeShotVariation.angleName}
                                       </span>
                                       {activeShotVariation.status === 'success' && (
                                           <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                                               <CheckCircle2 size={10} /> {t('done')}
                                           </span>
                                       )}
                                   </div>
                               )}
                           </div>

                           <div className="flex-1 flex items-center justify-center p-8 bg-[#FAFAFA] relative overflow-hidden">
                               {activeShotVariation ? (
                                   <div className="relative max-w-4xl w-full aspect-video bg-white rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100 group animate-in zoom-in-95 duration-300">
                                       {activeShotVariation.imageUrl ? (
                                           <img 
                                             src={activeShotVariation.imageUrl} 
                                             className="w-full h-full object-contain cursor-zoom-in" 
                                             onClick={() => setModalImage(activeShotVariation.imageUrl!)}
                                           />
                                       ) : activeShotVariation.status === 'processing' ? (
                                           <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-400">
                                               <div className="w-12 h-12 border-4 border-gray-100 border-t-[#007AFF] rounded-full animate-spin" />
                                               <span className="text-xs font-bold animate-pulse">{t('renderingScene')}</span>
                                           </div>
                                       ) : (
                                           <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-red-400 bg-red-50/50">
                                               <AlertCircle size={32} />
                                               <span className="text-xs font-bold uppercase tracking-widest">{t('generationFailed')}</span>
                                           </div>
                                       )}
                                       
                                       <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                           <button 
                                             onClick={() => activeShotVariation.imageUrl && setModalImage(activeShotVariation.imageUrl)}
                                             className="p-2.5 bg-white/90 hover:bg-[#007AFF] hover:text-white rounded-xl text-gray-600 shadow-lg border border-gray-100 transition-all"
                                           >
                                               <Maximize2 size={18} />
                                           </button>
                                       </div>
                                   </div>
                               ) : (
                                   <div className="text-center text-gray-300 flex flex-col items-center">
                                       <div className="w-20 h-20 rounded-[28px] bg-gray-100 flex items-center justify-center mb-4">
                                           <ImageIcon size={32} />
                                       </div>
                                       <p className="text-sm font-bold text-gray-400">{t('runAnalysisFirst')}</p>
                                   </div>
                               )}
                           </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm flex items-center justify-center min-h-[80px]">
                          <p className="text-center font-serif text-lg text-[#1D1D1F] leading-snug max-w-3xl">
                              "{activeShot.text}"
                          </p>
                      </div>
                  </>
              ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-300">
                      <div className="flex flex-col items-center gap-4">
                          <Clapperboard size={64} strokeWidth={1} />
                          <span className="text-sm font-medium">{t('pleaseSelectProject')}</span>
                      </div>
                  </div>
              )}
          </div>

          {/* Right: Inspector */}
          <div className="w-80 bg-white border-l border-[#E5E5EA] flex flex-col z-20 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
              {activeShot ? (
                  <>
                      <div className="p-4 border-b border-[#F5F5F7] flex items-center justify-between bg-[#FAFAFA]">
                          <div className="flex items-center gap-2">
                              <Sparkles size={14} className="text-purple-600" />
                              <span className="text-[10px] font-bold text-[#1D1D1F] uppercase tracking-widest">{t('directorAi')}</span>
                          </div>
                          <button 
                            onClick={() => handleAnalyzeShot(activeScene!.id, activeShot)}
                            disabled={analyzingShotId === activeShot.id}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border
                                ${analyzingShotId === activeShot.id 
                                    ? 'bg-purple-50 text-purple-600 border-purple-100 cursor-wait' 
                                    : 'bg-white hover:bg-purple-50 text-gray-600 hover:text-purple-600 border-gray-200 hover:border-purple-200 shadow-sm'}`}
                          >
                              {analyzingShotId === activeShot.id ? <Loader2 size={12} className="animate-spin"/> : t('analyzeShot')}
                          </button>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
                          {activeShot.analysis ? (
                              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                      <Camera size={12} /> {lang === 'zh' ? '推荐镜号' : 'Camera Angles'}
                                  </h4>
                                  {activeShot.analysis.recommended_angles.map((rec, i) => {
                                      const existingVar = activeShot.variations?.find(v => v.angleName === rec.name);
                                      return (
                                          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-[#007AFF]/30 transition-all group">
                                              <div className="flex justify-between items-start mb-2">
                                                  <span className="text-[11px] font-bold text-[#007AFF] uppercase tracking-wide">{rec.name}</span>
                                                  {existingVar ? (
                                                      <div className="flex gap-1">
                                                          {existingVar.status === 'success' && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />}
                                                      </div>
                                                  ) : (
                                                      <button 
                                                        onClick={() => handleGenerateVariation(activeSceneIndex, activeShotIndex, rec.name, rec.prompt_modifier)}
                                                        className="p-1.5 bg-gray-50 hover:bg-[#007AFF] hover:text-white rounded-md text-gray-400 transition-colors"
                                                        title="Generate This Angle"
                                                      >
                                                          <Plus size={14} />
                                                      </button>
                                                  )}
                                              </div>
                                              <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">{rec.reason}</p>
                                              
                                              {existingVar && existingVar.imageUrl && (
                                                  <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 relative group/img cursor-pointer" onClick={() => setModalImage(existingVar.imageUrl!)}>
                                                      <img src={existingVar.imageUrl} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" />
                                                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                          <button 
                                                            onClick={(e) => { e.stopPropagation(); handleGenerateVideo(activeSceneIndex, activeShotIndex, existingVar); }}
                                                            disabled={generatingVideo[existingVar.id]}
                                                            className="p-2 bg-white/90 hover:bg-[#007AFF] hover:text-white rounded-full text-gray-700 shadow-lg transition-transform hover:scale-110"
                                                          >
                                                              {generatingVideo[existingVar.id] ? <Loader2 size={14} className="animate-spin"/> : <Video size={14}/>}
                                                          </button>
                                                      </div>
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                          ) : (
                              <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-2 shadow-sm">
                                      <Sparkles size={18} className="text-gray-300" />
                                  </div>
                                  <p className="text-[10px] uppercase font-bold text-gray-400">{t('runAnalysisFirst')}</p>
                              </div>
                          )}

                          {activeShot.variations && activeShot.variations.length > 0 && (
                             <div>
                                 <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                     <Layers size={12} /> {t('assetLibrary')}
                                 </h4>
                                 <div className="grid grid-cols-2 gap-3">
                                     {activeShot.variations.map(v => (
                                         <div 
                                            key={v.id} 
                                            onClick={() => v.imageUrl && setModalImage(v.imageUrl)} 
                                            className="aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-100 hover:border-[#007AFF] cursor-pointer relative group shadow-sm hover:shadow-md transition-all"
                                         >
                                             {v.imageUrl && <img src={v.imageUrl} className="w-full h-full object-cover" />}
                                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                 <span className="text-[9px] font-bold text-white truncate">{v.angleName}</span>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                          )}
                      </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                      <LayoutGrid size={40} className="mb-4 opacity-20" />
                      <span className="text-xs font-bold uppercase tracking-widest">{lang === 'zh' ? '请选择分镜' : 'Select a Shot'}</span>
                  </div>
              )}
          </div>
      </div>

      {/* Bottom: Timeline */}
      <div className="h-52 bg-white border-t border-[#E5E5EA] flex flex-col shrink-0 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
          <div className="h-10 bg-white border-b border-[#F5F5F7] flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock size={12} /> {t('timeline')}
                  </span>
                  <div className="h-4 w-[1px] bg-gray-200" />
                  <span className="text-[10px] font-mono font-medium text-gray-500">00:00:00:00</span>
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={() => setTimelineZoom(Math.max(0.5, timelineZoom - 0.2))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><ZoomOut size={14} /></button>
                  <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-300 rounded-full transition-all" style={{width: `${timelineZoom * 50}%`}} />
                  </div>
                  <button onClick={() => setTimelineZoom(Math.min(2, timelineZoom + 0.2))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><ZoomIn size={14} /></button>
              </div>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar-h relative bg-[#F9F9FB] p-6">
             <div className="absolute top-0 left-0 right-0 h-6 border-b border-gray-200 flex items-end px-6 pointer-events-none bg-[#FAFAFA]">
                 {Array.from({length: 20}).map((_, i) => (
                     <div key={i} className="flex-1 border-l border-gray-300 h-2 text-[9px] text-gray-400 pl-1 font-mono">{i}s</div>
                 ))}
             </div>

             <div className="flex gap-2 mt-4 min-w-max pb-2">
                 {timelineShots.map((tShot, idx) => {
                     const isActive = activeShotId === tShot.id;
                     return (
                         <div 
                             key={tShot.id}
                             onClick={() => {
                                 setActiveSceneIndex(tShot.sceneIndex);
                                 setActiveShotId(tShot.id);
                             }}
                             className={`
                                relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200 shrink-0 bg-white
                                ${isActive 
                                    ? 'ring-2 ring-[#007AFF] shadow-lg shadow-blue-500/10 z-10 scale-105' 
                                    : 'border border-gray-200 hover:border-[#007AFF]/50 hover:shadow-md'}
                             `}
                             style={{
                                 width: `${140 * timelineZoom}px`,
                                 height: '100px'
                             }}
                         >
                             {tShot.bestThumb ? (
                                 <img src={tShot.bestThumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                             ) : (
                                 <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-white">
                                     <span className="text-[9px] font-bold text-gray-300 text-center line-clamp-2 uppercase leading-tight">{tShot.text}</span>
                                 </div>
                             )}

                             <div className="absolute top-1.5 left-1.5 bg-white/90 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-gray-600 shadow-sm backdrop-blur-sm border border-gray-100">
                                 {tShot.sceneNumber}-{tShot.shotIndex + 1}
                             </div>

                             {tShot.variations?.some(v => v.videoUrl) && (
                                 <div className="absolute bottom-1.5 right-1.5 bg-green-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5 shadow-sm">
                                     <Film size={8} />
                                 </div>
                             )}
                         </div>
                     );
                 })}
             </div>
          </div>
      </div>
    </div>
  );
};
