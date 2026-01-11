

import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  ArrowLeft, RefreshCw, Wand2, Loader2, AlertCircle, User, 
  Download, Check, Sparkles, ChevronDown, Palette, Copy, 
  Maximize2, X, Clapperboard, Edit3, ArrowRight, FileText, Plus,
  Image as ImageIcon, Box, Trash2
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { ScriptProject, StoryboardData, ImageModel, StoryboardCharacter, StoryboardShot, StoryboardScene, StoryboardSceneVisual, StoryboardProp } from '../types';
import { performDeepScriptAnalysis } from '../services/scriptUtils';
import { createImageGenerationTask, queryImageTask } from '../services/imageService';

const { useParams, useNavigate } = ReactRouterDOM as any;

const ARCHETYPES = [
  { label: 'Hero', desc: 'heroic stance, determined expression, charismatic, strong lighting' },
  { label: 'Villain', desc: 'menacing, sharp features, dark atmosphere, mysterious aura' },
  { label: 'Sidekick', desc: 'friendly, loyal, approachable, soft lighting' },
  { label: 'Mentor', desc: 'wise, aged, calm, authoritative, dramatic lighting' },
  { label: 'Rebel', desc: 'rugged, intense, worn clothing, rebellious vibe' },
  { label: 'Femme Fatale', desc: 'mysterious, alluring, dramatic lighting, elegant' },
];

const DEFAULT_GLOBAL_STYLES = [
  'Cinematic, Photorealistic, 8k, Film Grain',
  'Cyberpunk, Neon, High Tech, Dark Atmosphere',
  'Studio Ghibli, Anime Style, Vivid Colors, Hand Drawn',
  'Film Noir, Black and White, High Contrast, Shadowy',
  'Watercolor, Artistic, Soft Edges, Dreamy',
  'Documentary, Handheld Camera, Raw, Realistic'
];

/**
 * StoryboardPage (V3.2) - Scene & Prop Management
 */
export const StoryboardPage = () => {
  const { t, lang, activeChannel, channels, volcSettings } = useGlobal();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<ScriptProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingItems, setGeneratingItems] = useState<Record<string, boolean>>({});
  
  // UI State for Editing
  const [editingItem, setEditingItem] = useState<{type: 'char' | 'scene' | 'prop', data: any} | null>(null);
  const [globalStyle, setGlobalStyle] = useState('');
  const [isStyleCustom, setIsStyleCustom] = useState(false);
  const [savedStyles, setSavedStyles] = useState<string[]>([]);

  // Load Saved Styles
  useEffect(() => {
    const saved = localStorage.getItem('sora_custom_styles');
    if (saved) setSavedStyles(JSON.parse(saved));
  }, []);

  // Data Hydration
  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
        const saved = localStorage.getItem('sora_script_projects');
        if (saved) {
            const projects: ScriptProject[] = JSON.parse(saved);
            const found = projects.find(p => p.id === projectId);
            
            if (found) {
                if (!found.storyboard || !found.storyboard.scenes) {
                    const analysisResult = await performDeepScriptAnalysis(found.content || '', volcSettings);
                    Object.assign(found, analysisResult.projectUpdates);
                    found.storyboard = analysisResult.storyboard;
                    const updatedList = projects.map(p => p.id === projectId ? found : p);
                    localStorage.setItem('sora_script_projects', JSON.stringify(updatedList));
                }
                setProject(found);
                setGlobalStyle(found.storyboard?.globalStyle || DEFAULT_GLOBAL_STYLES[0]);
            }
        }
        setLoading(false);
    };

    loadProject();
  }, [projectId, volcSettings]);

  // Save changes to local storage
  const saveProject = (updatedProj: ScriptProject) => {
      const saved = localStorage.getItem('sora_script_projects');
      if (saved) {
          const projects: ScriptProject[] = JSON.parse(saved);
          const updatedList = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
          localStorage.setItem('sora_script_projects', JSON.stringify(updatedList));
          setProject({...updatedProj}); 
      }
  };

  // Update Global Style
  useEffect(() => {
      if (project && project.storyboard && globalStyle !== project.storyboard.globalStyle) {
          const updatedProj = {
              ...project,
              storyboard: { ...project.storyboard, globalStyle }
          };
          saveProject(updatedProj);
      }
  }, [globalStyle]);

  // Add Custom Style
  const handleSaveStyle = () => {
      if (globalStyle && !savedStyles.includes(globalStyle) && !DEFAULT_GLOBAL_STYLES.includes(globalStyle)) {
          const newStyles = [...savedStyles, globalStyle];
          setSavedStyles(newStyles);
          localStorage.setItem('sora_custom_styles', JSON.stringify(newStyles));
          alert(lang === 'zh' ? '风格已保存' : 'Style Saved');
      }
  };

  // Add New Asset Handler
  const handleAddNewAsset = (type: 'char' | 'scene' | 'prop') => {
      if (!project || !project.storyboard) return;
      
      const newId = `${type}-${Date.now()}`;
      const newItem = {
          id: newId,
          name: type === 'char' ? (lang === 'zh' ? '新角色' : 'New Character') : (type === 'scene' ? (lang === 'zh' ? '新场景' : 'New Location') : (lang === 'zh' ? '新道具' : 'New Prop')),
          visualDescription: '',
          status: 'queued'
      };

      const sb = { ...project.storyboard };
      if (type === 'char') sb.characters = [...(sb.characters || []), newItem as any];
      else if (type === 'scene') sb.sceneVisuals = [...(sb.sceneVisuals || []), newItem as any];
      else if (type === 'prop') sb.props = [...(sb.props || []), newItem as any];

      saveProject({ ...project, storyboard: sb });
      setEditingItem({ type, data: newItem });
  };

  // Delete Asset Handler
  const handleDeleteAsset = (itemId: string, type: 'char' | 'scene' | 'prop') => {
      if (!project || !project.storyboard) return;
      if (!confirm(lang === 'zh' ? '确定删除此资产吗？' : 'Delete this asset?')) return;
      
      const sb = { ...project.storyboard };
      if (type === 'char') sb.characters = sb.characters.filter(c => c.id !== itemId);
      else if (type === 'scene') sb.sceneVisuals = (sb.sceneVisuals || []).filter(c => c.id !== itemId);
      else if (type === 'prop') sb.props = (sb.props || []).filter(c => c.id !== itemId);
      
      saveProject({ ...project, storyboard: sb });
      if (editingItem?.data.id === itemId) setEditingItem(null);
  };

  // Delete Shot Handler
  const handleDeleteShot = (sceneId: string, shotId: string) => {
      if (!project || !project.storyboard) return;
      if (!confirm(lang === 'zh' ? '确定删除此分镜镜头吗？' : 'Delete this shot?')) return;

      const updatedScenes = project.storyboard.scenes.map(scene => {
          if (scene.id !== sceneId) return scene;
          return {
              ...scene,
              shots: scene.shots.filter(s => s.id !== shotId)
          };
      });
      saveProject({ ...project, storyboard: { ...project.storyboard, scenes: updatedScenes } });
  };

  // Update Name Handler
  const handleUpdateName = (itemId: string, newName: string) => {
      if (!project || !project.storyboard || !editingItem) return;
      const sb = project.storyboard;
      const type = editingItem.type;

      let targetList = type === 'char' ? sb.characters : (type === 'scene' ? sb.sceneVisuals : sb.props);
      if (!targetList) return;

      const updatedList = targetList.map((c: any) => c.id === itemId ? { ...c, name: newName } : c);
      
      const newSb = { ...sb };
      if (type === 'char') newSb.characters = updatedList;
      else if (type === 'scene') newSb.sceneVisuals = updatedList;
      else newSb.props = updatedList;

      saveProject({ ...project, storyboard: newSb });
      setEditingItem(prev => prev ? { ...prev, data: { ...prev.data, name: newName } } : null);
  };

  // Polling for generated images (Generic for all asset types)
  useEffect(() => {
      const pollInterval = setInterval(async () => {
          if (!project?.storyboard) return;
          const sb = project.storyboard;
          let hasUpdates = false;

          const checkList = [
              ...(sb.characters || []),
              ...(sb.sceneVisuals || []),
              ...(sb.props || [])
          ];

          for (const item of checkList) {
             if (item.referenceImageId && item.status === 'processing') {
                 const status = await checkTaskStatus(item.referenceImageId);
                 if (status.done) {
                     item.referenceImageUrl = status.url;
                     item.status = status.status as any;
                     setGeneratingItems(prev => ({...prev, [item.id]: false}));
                     hasUpdates = true;
                     if (editingItem?.data.id === item.id) {
                         setEditingItem(prev => prev ? { ...prev, data: {...item} } : null);
                     }
                 } else if (status.failed) {
                     item.status = 'failed';
                     setGeneratingItems(prev => ({...prev, [item.id]: false}));
                     hasUpdates = true;
                 }
             }
          }

          if (hasUpdates) saveProject(project);
      }, 3000);
      return () => clearInterval(pollInterval);
  }, [project, activeChannel, editingItem]);

  const checkTaskStatus = async (apiId: string) => {
      if (!activeChannel?.apiToken) return { done: false, failed: true };
      try {
          const res = await queryImageTask(activeChannel.baseUrl, activeChannel.apiToken, apiId);
          const isDone = res.status === 'success' || !!res.result_url || (res.result_urls && res.result_urls.length > 0);
          const isFailed = res.status === 'failed' || res.status === 'error';
          return { 
              done: isDone, 
              failed: isFailed, 
              url: res.result_url || (res.result_urls ? res.result_urls[0] : undefined),
              status: isDone ? 'success' : isFailed ? 'failed' : 'processing'
          };
      } catch (e) {
          return { done: false, failed: false }; 
      }
  };

  // Generic Generation Handler
  const handleGenerateAsset = async (item: any, type: 'char' | 'scene' | 'prop') => {
      if (!activeChannel?.apiToken) { alert(t('missingToken')); return; }
      if (!project) return;

      setGeneratingItems(prev => ({...prev, [item.id]: true}));
      
      let promptPrefix = '';
      if (type === 'char') promptPrefix = "Character Design Sheet, full body, white background";
      if (type === 'scene') promptPrefix = "Environment Concept Art, wide shot, no people";
      if (type === 'prop') promptPrefix = "Product Photography, isolated object, white background, studio lighting";

      try {
          const apiId = await createImageGenerationTask(
              activeChannel.baseUrl, 
              activeChannel.apiToken, 
              `${promptPrefix}, ${item.visualDescription}, ${globalStyle}`, 
              ImageModel.NANO_BANANA_2,
              { size: '1:1', resolution: '1K' }
          );
          
          const sb = project.storyboard!;
          let targetList = type === 'char' ? sb.characters : (type === 'scene' ? sb.sceneVisuals : sb.props);
          if (!targetList) targetList = [];
          
          const updatedList = targetList.map((c: any) => 
              c.id === item.id ? { ...c, referenceImageId: apiId, status: 'processing' as const } : c
          );

          const newSb = { ...sb };
          if (type === 'char') newSb.characters = updatedList;
          else if (type === 'scene') newSb.sceneVisuals = updatedList;
          else newSb.props = updatedList;

          saveProject({ ...project, storyboard: newSb });
      } catch (e: any) {
          alert(`Failed: ${e.message}`);
          setGeneratingItems(prev => ({...prev, [item.id]: false}));
      }
  };

  // Update Visual Description Generic Handler
  const handleUpdateDescription = (itemId: string, newDesc: string) => {
      if (!project || !project.storyboard || !editingItem) return;
      const sb = project.storyboard;
      const type = editingItem.type;

      let targetList = type === 'char' ? sb.characters : (type === 'scene' ? sb.sceneVisuals : sb.props);
      if (!targetList) return;

      const updatedList = targetList.map((c: any) => c.id === itemId ? { ...c, visualDescription: newDesc } : c);
      
      const newSb = { ...sb };
      if (type === 'char') newSb.characters = updatedList;
      else if (type === 'scene') newSb.sceneVisuals = updatedList;
      else newSb.props = updatedList;

      saveProject({ ...project, storyboard: newSb });
      setEditingItem(prev => prev ? { ...prev, data: { ...prev.data, visualDescription: newDesc } } : null);
  };

  // Smart Prompt Assembly Engine (Display Only)
  const buildShotPrompt = (shot: StoryboardShot, scene: StoryboardScene): string => {
     let parts = [];
     if (globalStyle) parts.push(`[Style: ${globalStyle}]`);
     if (scene.atmosphere) parts.push(`[Atmosphere: ${scene.atmosphere}]`);
     
     // Auto-link logic (Mocking the @Ref behavior)
     const shotTextLower = shot.text.toLowerCase();
     
     if (project?.storyboard?.characters) {
        project.storyboard.characters.forEach(char => {
            if (shotTextLower.includes(char.name.toLowerCase())) {
                parts.push(`[Ref: ${char.id}]`); // Link Character
            }
        });
     }
     if (project?.storyboard?.sceneVisuals) {
        project.storyboard.sceneVisuals.forEach(sv => {
            if (shotTextLower.includes(sv.name.toLowerCase()) || scene.header.toLowerCase().includes(sv.name.toLowerCase())) {
                parts.push(`[Ref: ${sv.id}]`); // Link Scene
            }
        });
     }
     if (project?.storyboard?.props) {
        project.storyboard.props.forEach(p => {
            if (shotTextLower.includes(p.name.toLowerCase())) {
                parts.push(`[Ref: ${p.id}]`); // Link Prop
            }
        });
     }

     parts.push(shot.text);
     return parts.join(', ');
  };

  const getEffectivePrompt = (shot: StoryboardShot, scene: StoryboardScene): string => {
      // Use constructedPrompt if available (user edited), otherwise fallback to customFullPrompt (legacy) or auto-build
      return shot.constructedPrompt || shot.customFullPrompt || buildShotPrompt(shot, scene);
  };

  const updateConstructedPrompt = (sceneId: string, shotId: string, newPrompt: string) => {
      if (!project || !project.storyboard) return;
      const updatedScenes = project.storyboard.scenes.map(scene => {
          if (scene.id !== sceneId) return scene;
          return {
              ...scene,
              shots: scene.shots.map(s => s.id === shotId ? { ...s, constructedPrompt: newPrompt } : s)
          };
      });
      saveProject({ ...project, storyboard: { ...project.storyboard, scenes: updatedScenes } });
  };

  const AssetSkeleton = () => (
      <div className="w-40 shrink-0 bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="aspect-[3/4] bg-gray-100 animate-pulse" />
        <div className="p-3 space-y-2">
           <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse" />
           <div className="h-2 bg-gray-100 rounded w-1/2 animate-pulse" />
        </div>
      </div>
  );

  const renderAssetCard = (item: any, type: 'char' | 'scene' | 'prop') => (
      <div 
        key={item.id} 
        onClick={() => setEditingItem({ type, data: item })}
        className={`w-40 shrink-0 bg-white rounded-xl overflow-hidden flex flex-col group relative border cursor-pointer transition-all hover:shadow-md
            ${item.status === 'failed' ? 'border-red-200' : 'border-gray-200 hover:border-[#007AFF]'}`}
      >
          <div className="aspect-[3/4] bg-gray-50 relative">
              {item.referenceImageUrl ? (
                  <img src={item.referenceImageUrl} className="w-full h-full object-cover" />
              ) : item.status === 'processing' || generatingItems[item.id] ? (
                  <div className="w-full h-full flex items-center justify-center bg-white flex-col gap-2">
                      <Loader2 className="animate-spin text-[#007AFF]" size={24} />
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{t('gen')}</span>
                  </div>
              ) : item.status === 'failed' ? (
                   <div className="w-full h-full flex flex-col items-center justify-center text-red-400 gap-2 bg-red-50">
                      <AlertCircle size={24} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">{t('fail')}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleGenerateAsset(item, type); }}
                        className="text-[9px] underline hover:text-red-600 mt-1"
                      >
                          Retry
                      </button>
                   </div>
              ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2 bg-gray-50">
                      {type === 'char' && <User size={32} />}
                      {type === 'scene' && <ImageIcon size={32} />}
                      {type === 'prop' && <Box size={32} />}
                  </div>
              )}
              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                 {/* Only show edit icon if not processing or failed */}
                 {item.status !== 'processing' && item.status !== 'failed' && (
                     <div className="bg-white/90 p-2 rounded-full shadow-sm text-[#007AFF]"><Edit3 size={16} /></div>
                 )}
              </div>
              
              {/* Delete Button */}
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteAsset(item.id, type); }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20 hover:scale-110 pointer-events-auto"
                title="Delete Asset"
              >
                  <Trash2 size={12} />
              </button>
          </div>
          <div className="p-3">
              <h3 className={`font-bold text-xs truncate ${item.status === 'failed' ? 'text-red-500' : 'text-[#1D1D1F]'}`}>{item.name}</h3>
              <p className="text-[9px] text-gray-400 truncate mt-0.5">{item.visualDescription}</p>
          </div>
      </div>
  );

  if (loading) return (
      <div className="h-full flex flex-col gap-6 p-8">
          <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
          <div className="flex gap-4">
               {[1,2,3].map(i => <AssetSkeleton key={i} />)}
          </div>
      </div>
  );
  
  if (!project) return null;

  return (
    <div className="h-full bg-[#F5F5F7] flex flex-col overflow-hidden">
      
      {/* Top Bar: Style Settings */}
      <div className="px-8 py-4 bg-white border-b border-gray-200 shrink-0 flex items-center gap-6 z-10">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-500 uppercase tracking-wider">
              <Palette size={16} />
              {lang === 'zh' ? '全局风格' : 'Visual Style'}
          </div>
          <div className="flex-1 flex items-center gap-2">
              <div className="relative group min-w-[240px]">
                  <select 
                      value={isStyleCustom ? 'custom' : globalStyle}
                      onChange={(e) => {
                          if (e.target.value === 'custom') {
                              setIsStyleCustom(true);
                          } else {
                              setIsStyleCustom(false);
                              setGlobalStyle(e.target.value);
                          }
                      }}
                      className="w-full bg-[#F5F5F7] border-none rounded-lg px-3 py-2 text-xs font-bold text-[#1D1D1F] outline-none cursor-pointer hover:bg-gray-100 appearance-none pr-8"
                  >
                      <optgroup label="Presets">
                        {DEFAULT_GLOBAL_STYLES.map(s => <option key={s} value={s}>{s.split(',')[0]}</option>)}
                      </optgroup>
                      {savedStyles.length > 0 && (
                          <optgroup label="My Presets">
                              {savedStyles.map(s => <option key={s} value={s}>{s.slice(0, 30)}...</option>)}
                          </optgroup>
                      )}
                      <option value="custom">Custom...</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <input 
                  value={globalStyle}
                  onChange={(e) => { setIsStyleCustom(true); setGlobalStyle(e.target.value); }}
                  placeholder="Custom global prompts (e.g. 8k, cyberpunk)..."
                  className={`flex-1 bg-[#F5F5F7] border-none rounded-lg px-4 py-2 text-xs font-medium outline-none transition-all ${isStyleCustom ? 'ring-2 ring-[#007AFF]/20 bg-white' : 'text-gray-500'}`}
              />
              <button 
                onClick={handleSaveStyle}
                className="p-2 bg-[#F5F5F7] hover:bg-[#007AFF] hover:text-white rounded-lg text-gray-400 transition-colors"
                title="Save as Preset"
              >
                  <Plus size={16} />
              </button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          
          {/* Script Summary Section (New) */}
          {(project.synopsis || project.logline) && (
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center gap-2 mb-3">
                      <FileText size={16} className="text-[#007AFF]" />
                      <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider">
                          {lang === 'zh' ? '剧情简介 (SYNOPSIS)' : 'SCRIPT SYNOPSIS'}
                      </h2>
                  </div>
                  <p className="text-sm font-medium text-[#1D1D1F] leading-relaxed max-w-4xl">
                      {project.synopsis || project.logline}
                  </p>
                  {project.genre && (
                      <div className="flex gap-2 mt-4">
                          {project.genre.map((g, i) => (
                              <span key={i} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-md text-[10px] font-bold text-gray-500 uppercase tracking-wide">{g}</span>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {/* Asset Management Section */}
          <section className="mb-10 space-y-8">
              {/* Characters */}
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                     <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
                        <User size={14} /> {lang === 'zh' ? '角色定妆 (CAST)' : 'CAST & CHARACTERS'}
                     </h2>
                     <button 
                        onClick={() => handleAddNewAsset('char')}
                        className="p-1.5 bg-[#F5F5F7] hover:bg-[#007AFF] hover:text-white rounded-lg text-gray-400 transition-colors"
                        title="Add Character"
                     >
                        <Plus size={14} />
                     </button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-h min-h-[180px]">
                      {project.storyboard?.characters.map(item => renderAssetCard(item, 'char'))}
                      {(!project.storyboard?.characters || project.storyboard.characters.length === 0) && (
                          <div className="text-gray-300 text-xs italic p-4 flex flex-col items-center justify-center w-full">
                              <span>No characters detected.</span>
                              <span className="text-[10px] mt-1">Run "Deep Analysis" in Script Editor first.</span>
                          </div>
                      )}
                  </div>
              </div>

              {/* Scenes & Props Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Environment Visuals */}
                  <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6">
                         <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
                            <ImageIcon size={14} /> {lang === 'zh' ? '场景生图 (SCENES)' : 'ENVIRONMENTS'}
                         </h2>
                         <button 
                            onClick={() => handleAddNewAsset('scene')}
                            className="p-1.5 bg-[#F5F5F7] hover:bg-[#007AFF] hover:text-white rounded-lg text-gray-400 transition-colors"
                            title="Add Scene"
                         >
                            <Plus size={14} />
                         </button>
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-h flex-1 min-h-[180px] items-start">
                          {project.storyboard?.sceneVisuals?.map(item => renderAssetCard(item, 'scene'))}
                          {(!project.storyboard?.sceneVisuals || project.storyboard.sceneVisuals.length === 0) && (
                              <div className="text-gray-300 text-xs italic p-4 w-full text-center">No distinct scenes detected.</div>
                          )}
                      </div>
                  </div>

                  {/* Props */}
                  <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6">
                         <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
                            <Box size={14} /> {lang === 'zh' ? '产品/道具生图 (PROPS)' : 'PROPS & PRODUCTS'}
                         </h2>
                         <button 
                            onClick={() => handleAddNewAsset('prop')}
                            className="p-1.5 bg-[#F5F5F7] hover:bg-[#007AFF] hover:text-white rounded-lg text-gray-400 transition-colors"
                            title="Add Prop"
                         >
                            <Plus size={14} />
                         </button>
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-h flex-1 min-h-[180px] items-start">
                          {project.storyboard?.props?.map(item => renderAssetCard(item, 'prop'))}
                          {(!project.storyboard?.props || project.storyboard.props.length === 0) && (
                              <div className="text-gray-300 text-xs italic p-4 w-full text-center">No key props detected.</div>
                          )}
                      </div>
                  </div>
              </div>
          </section>

          {/* Scenes List Section */}
          <div className="space-y-8">
              {project.storyboard?.scenes.map(scene => (
                  <section key={scene.id} className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
                      <div className="bg-[#F9F9FB] px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-gray-300">#{scene.number}</span>
                            <div>
                                <h3 className="text-sm font-bold text-[#1D1D1F]">{scene.header}</h3>
                                {scene.atmosphere && <p className="text-[10px] text-gray-400 font-medium">{scene.atmosphere}</p>}
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-white rounded-full border border-gray-200 text-[10px] font-bold text-gray-500">
                              {scene.shots.length} SHOTS
                          </div>
                      </div>
                      
                      <div className="divide-y divide-gray-50">
                          {scene.shots.map((shot, idx) => (
                              <div key={shot.id} className="p-5 flex gap-5 hover:bg-gray-50/50 transition-colors group relative">
                                  <div className="w-16 pt-1 text-center shrink-0">
                                      <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Shot</span>
                                      <span className="text-xl font-black text-[#007AFF] block leading-none">{idx + 1}</span>
                                  </div>
                                  
                                  <div className="flex-1 space-y-3">
                                      {/* Read-only Action Display (use Textarea for auto-height but readonly) */}
                                      <p className="text-sm font-medium text-[#1D1D1F]">{shot.text}</p>
                                      
                                      <div className="bg-[#F5F5F7] rounded-xl p-3 relative group focus-within:ring-2 focus-within:ring-[#007AFF]/20 transition-all">
                                          <div className="flex items-center justify-between mb-1.5">
                                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                                  <Sparkles size={10} /> Constructed Prompt (@Linked)
                                              </span>
                                              <button 
                                                onClick={() => navigator.clipboard.writeText(getEffectivePrompt(shot, scene))}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#007AFF]"
                                              >
                                                  <Copy size={12} />
                                              </button>
                                          </div>
                                          <textarea 
                                              className="w-full bg-transparent text-[10px] text-gray-600 font-mono leading-relaxed outline-none resize-none"
                                              value={getEffectivePrompt(shot, scene)}
                                              onChange={(e) => updateConstructedPrompt(scene.id, shot.id, e.target.value)}
                                              rows={3}
                                          />
                                      </div>
                                  </div>

                                  {/* Delete Shot Button */}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteShot(scene.id, shot.id); }}
                                    className="absolute top-4 right-4 p-2 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                                    title={lang === 'zh' ? '删除镜头' : 'Delete Shot'}
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </section>
              ))}
          </div>
      </div>

      {/* Asset Edit Modal */}
      {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-[24px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[80vh]">
                  <div className="w-full md:w-1/2 bg-gray-100 relative group min-h-[300px]">
                      {editingItem.data.referenceImageUrl ? (
                          <img src={editingItem.data.referenceImageUrl} className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <User size={64} />
                          </div>
                      )}
                      <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="bg-white/90 p-2 rounded-full shadow-sm text-xs font-bold flex items-center gap-1 hover:scale-105 transition-transform"><Maximize2 size={14} /> View</button>
                      </div>
                  </div>
                  
                  <div className="w-full md:w-1/2 p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-4 gap-4">
                          <input 
                              value={editingItem.data.name}
                              onChange={(e) => handleUpdateName(editingItem.data.id, e.target.value)}
                              className="text-xl font-bold text-[#1D1D1F] bg-transparent border-b border-transparent hover:border-gray-200 focus:border-[#007AFF] outline-none flex-1 py-1 transition-all"
                          />
                          <button onClick={() => setEditingItem(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                      </div>
                      
                      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
                          {editingItem.type === 'char' && (
                              <div>
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Archetype Preset</label>
                                  <div className="relative">
                                      <select 
                                          className="w-full bg-[#F5F5F7] border-none rounded-lg px-3 py-2 text-xs font-bold text-[#1D1D1F] outline-none cursor-pointer appearance-none"
                                          onChange={(e) => handleUpdateDescription(editingItem.data.id, `${editingItem.data.name}, ${e.target.value}, cinematic`)}
                                      >
                                          <option value="">Select an archetype...</option>
                                          {ARCHETYPES.map(a => <option key={a.label} value={a.desc}>{a.label}</option>)}
                                      </select>
                                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                  </div>
                              </div>
                          )}

                          <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Visual Description</label>
                              <textarea 
                                  value={editingItem.data.visualDescription}
                                  onChange={(e) => handleUpdateDescription(editingItem.data.id, e.target.value)}
                                  className="w-full bg-[#F5F5F7] border-none rounded-xl p-4 text-xs font-medium text-[#1D1D1F] min-h-[120px] resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                              />
                          </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-gray-100">
                          <button 
                            onClick={() => handleGenerateAsset(editingItem.data, editingItem.type)}
                            disabled={generatingItems[editingItem.data.id]}
                            className="w-full bg-[#007AFF] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#0066CC] transition-colors shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                          >
                             {generatingItems[editingItem.data.id] ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                             {lang === 'zh' ? '生成 / 重新生成' : 'Generate Asset'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};