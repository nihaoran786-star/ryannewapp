
import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  ArrowLeft, RefreshCw, Wand2, Loader2, AlertCircle, User, 
  Download, Check, Sparkles, ChevronDown, Palette, Copy, 
  Maximize2, X, Clapperboard, Edit3, ArrowRight, FileText, Plus,
  Image as ImageIcon, Box, Trash2, Zap
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { ScriptProject, StoryboardData, ImageModel, StoryboardCharacter, StoryboardShot, StoryboardScene, StoryboardSceneVisual, StoryboardProp } from '../types';
import { performDeepScriptAnalysis } from '../services/scriptUtils';
import { createImageGenerationTask, queryImageTask, createNanoBananaPro4KTask } from '../services/imageService';

const { useParams, useNavigate } = ReactRouterDOM as any;

const ARCHETYPES = [
  { label: 'Hero', desc: 'heroic stance, determined expression, charismatic, strong lighting' },
  { label: 'Villain', desc: 'menacing, sharp features, dark atmosphere, mysterious aura' },
  { label: 'Sidekick', desc: 'friendly, loyal, approachable, soft lighting' },
  { label: 'Mentor', desc: 'wise, aged, calm, authoritative, dramatic lighting' },
  { label: 'Rebel', desc: 'rugged, intense, worn clothing, rebellious vibe' },
  { label: 'Femme Fatale', desc: 'mysterious, alluring, dramatic lighting, elegant' },
];

/**
 * StoryboardPage (V3.4) - Scene & Prop Management
 * Updated: Removed Global Style controls (Moved to ScriptEditor).
 */
export const StoryboardPage = () => {
  const { t, lang, activeChannel, channels, volcSettings } = useGlobal();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<ScriptProject | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Generating items lock map to prevent duplicate requests
  const [generatingItems, setGeneratingItems] = useState<Record<string, boolean>>({});
  
  // UI State for Editing
  const [editingItem, setEditingItem] = useState<{type: 'char' | 'scene' | 'prop', data: any} | null>(null);
  
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
            }
        }
        setLoading(false);
    };

    loadProject();
  }, [projectId, volcSettings]);

  /**
   * Core State Updater
   * Uses functional updates to prevent stale closures (overwriting data with old snapshots).
   */
  const updateProject = (updater: (prev: ScriptProject) => ScriptProject) => {
      setProject(prev => {
          if (!prev) return null;
          const next = updater(prev);
          
          // Sync to localStorage
          const saved = localStorage.getItem('sora_script_projects');
          if (saved) {
              const list = JSON.parse(saved);
              const newList = list.map((p: any) => p.id === next.id ? next : p);
              localStorage.setItem('sora_script_projects', JSON.stringify(newList));
          }
          return next;
      });
  };

  // Wrapper for simple updates (Legacy compatibility)
  const saveProject = (updatedProj: ScriptProject) => {
      updateProject(() => updatedProj);
  };

  // Add New Asset Handler
  const handleAddNewAsset = (type: 'char' | 'scene' | 'prop') => {
      const newId = `${type}-${Date.now()}`;
      const newItem = {
          id: newId,
          name: type === 'char' ? (lang === 'zh' ? '新角色' : 'New Character') : (type === 'scene' ? (lang === 'zh' ? '新场景' : 'New Location') : (lang === 'zh' ? '新道具' : 'New Prop')),
          visualDescription: '',
          status: 'queued'
      };

      updateProject(prev => {
          const sb = { ...prev.storyboard! };
          if (type === 'char') sb.characters = [...(sb.characters || []), newItem as any];
          else if (type === 'scene') sb.sceneVisuals = [...(sb.sceneVisuals || []), newItem as any];
          else if (type === 'prop') sb.props = [...(sb.props || []), newItem as any];
          return { ...prev, storyboard: sb };
      });

      setEditingItem({ type, data: newItem });
  };

  // Delete Asset Handler
  const handleDeleteAsset = (itemId: string, type: 'char' | 'scene' | 'prop') => {
      if (!confirm(lang === 'zh' ? '确定删除此资产吗？' : 'Delete this asset?')) return;
      
      updateProject(prev => {
          const sb = { ...prev.storyboard! };
          if (type === 'char') sb.characters = sb.characters.filter(c => c.id !== itemId);
          else if (type === 'scene') sb.sceneVisuals = (sb.sceneVisuals || []).filter(c => c.id !== itemId);
          else if (type === 'prop') sb.props = (sb.props || []).filter(c => c.id !== itemId);
          return { ...prev, storyboard: sb };
      });

      if (editingItem?.data.id === itemId) setEditingItem(null);
  };

  // Delete Shot Handler
  const handleDeleteShot = (sceneId: string, shotId: string) => {
      if (!confirm(lang === 'zh' ? '确定删除此分镜镜头吗？' : 'Delete this shot?')) return;

      updateProject(prev => {
          const updatedScenes = prev.storyboard!.scenes.map(scene => {
              if (scene.id !== sceneId) return scene;
              return {
                  ...scene,
                  shots: scene.shots.filter(s => s.id !== shotId)
              };
          });
          return { ...prev, storyboard: { ...prev.storyboard!, scenes: updatedScenes } };
      });
  };

  // Update Name Handler
  const handleUpdateName = (itemId: string, newName: string) => {
      if (!editingItem) return;
      const type = editingItem.type;

      updateProject(prev => {
          const sb = { ...prev.storyboard! };
          let targetList = type === 'char' ? sb.characters : (type === 'scene' ? sb.sceneVisuals : sb.props);
          if (!targetList) return prev;

          const updatedList = targetList.map((c: any) => c.id === itemId ? { ...c, name: newName } : c);
          
          if (type === 'char') sb.characters = updatedList;
          else if (type === 'scene') sb.sceneVisuals = updatedList;
          else sb.props = updatedList;
          
          return { ...prev, storyboard: sb };
      });

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
             // Only poll if we have a Task ID (Async mode)
             if (item.referenceImageId && item.status === 'processing') {
                 const status = await checkTaskStatus(item.referenceImageId);
                 if (status.done) {
                     updateProject(prev => {
                         const s = { ...prev.storyboard! };
                         const updateList = (list: any[]) => list.map(i => i.id === item.id ? { 
                             ...i, 
                             referenceImageUrl: status.url, 
                             status: status.status 
                         } : i);
                         
                         s.characters = updateList(s.characters);
                         s.sceneVisuals = updateList(s.sceneVisuals);
                         s.props = updateList(s.props);
                         return { ...prev, storyboard: s };
                     });
                     setGeneratingItems(prev => ({...prev, [item.id]: false}));
                     if (editingItem?.data.id === item.id) {
                         setEditingItem(prev => prev ? { ...prev, data: {...item, referenceImageUrl: status.url, status: status.status} } : null);
                     }
                 } else if (status.failed) {
                     updateProject(prev => {
                         const s = { ...prev.storyboard! };
                         const updateList = (list: any[]) => list.map(i => i.id === item.id ? { ...i, status: 'failed' } : i);
                         s.characters = updateList(s.characters);
                         s.sceneVisuals = updateList(s.sceneVisuals);
                         s.props = updateList(s.props);
                         return { ...prev, storyboard: s };
                     });
                     setGeneratingItems(prev => ({...prev, [item.id]: false}));
                 }
             }
          }
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

  /**
   * Generic Generation Handler
   * Updated to use `updateProject` (functional update) to prevent stale closures during async operations.
   */
  const handleGenerateAsset = async (item: any, type: 'char' | 'scene' | 'prop') => {
      if (!activeChannel?.apiToken) { 
          console.warn('API Token missing during generation.'); 
          return; 
      }

      setGeneratingItems(prev => ({...prev, [item.id]: true}));
      
      let promptPrefix = '';
      if (type === 'char') promptPrefix = "Character Design Sheet, full body, white background";
      if (type === 'scene') promptPrefix = "Environment Concept Art, wide shot, no people";
      if (type === 'prop') promptPrefix = "Product Photography, isolated object, white background, studio lighting";

      // Gemini 3 Pro (Image) is now the default
      const targetModel = ImageModel.NANO_BANANA_PRO; 
      // Read global style from project structure
      const currentGlobalStyle = project?.storyboard?.globalStyle || '';
      const finalPrompt = `${promptPrefix}, ${item.visualDescription}, ${currentGlobalStyle}`;

      try {
          let resultUrl: string | undefined;
          let apiId: string | undefined;

          if (targetModel === ImageModel.NANO_BANANA_PRO) {
              const results = await createNanoBananaPro4KTask(
                  activeChannel.baseUrl, 
                  activeChannel.apiToken, 
                  finalPrompt, 
                  [], // No reference images for text-to-image
                  { aspectRatio: '1:1', resolution: '1K' }
              );
              
              if (results && results.length > 0) {
                  resultUrl = results[0];
              } else {
                  throw new Error("No image generated.");
              }
          } else {
              apiId = await createImageGenerationTask(
                  activeChannel.baseUrl, 
                  activeChannel.apiToken, 
                  finalPrompt, 
                  targetModel,
                  { aspectRatio: '1:1', resolution: '1K' }
              );
          }
          
          // Critical Fix: Use functional update to ensure we are modifying the latest state
          updateProject(currentProject => {
              if (!currentProject.storyboard) return currentProject;
              
              const sb = { ...currentProject.storyboard };
              const updateList = (list: any[]) => list.map(c => 
                  c.id === item.id ? { 
                      ...c, 
                      status: resultUrl ? 'success' : 'processing',
                      referenceImageUrl: resultUrl,
                      referenceImageId: apiId 
                  } : c
              );

              if (type === 'char') sb.characters = updateList(sb.characters || []);
              else if (type === 'scene') sb.sceneVisuals = updateList(sb.sceneVisuals || []);
              else if (type === 'prop') sb.props = updateList(sb.props || []);

              return { ...currentProject, storyboard: sb };
          });

      } catch (e: any) {
          console.error(`Generation Failed for ${item.name}: ${e.message}`);
          
          updateProject(currentProject => {
              if (!currentProject.storyboard) return currentProject;
              const sb = { ...currentProject.storyboard };
              const updateList = (list: any[]) => list.map(c => c.id === item.id ? { ...c, status: 'failed' } : c);
              
              if (type === 'char') sb.characters = updateList(sb.characters || []);
              else if (type === 'scene') sb.sceneVisuals = updateList(sb.sceneVisuals || []);
              else if (type === 'prop') sb.props = updateList(sb.props || []);
              
              return { ...currentProject, storyboard: sb };
          });
      } finally {
          setGeneratingItems(prev => ({...prev, [item.id]: false}));
      }
  };

  // --- Auto-Generation Effect ---
  // Automatically triggers generation for any asset marked as 'queued'
  useEffect(() => {
      if (!project?.storyboard || !activeChannel?.apiToken) return;
      
      const sb = project.storyboard;
      const queue: Array<{ item: any, type: 'char' | 'scene' | 'prop' }> = [];

      // Collect all queued items that aren't already generating
      sb.characters?.forEach(c => { if (c.status === 'queued' && !generatingItems[c.id]) queue.push({ item: c, type: 'char' }); });
      sb.sceneVisuals?.forEach(s => { if (s.status === 'queued' && !generatingItems[s.id]) queue.push({ item: s, type: 'scene' }); });
      sb.props?.forEach(p => { if (p.status === 'queued' && !generatingItems[p.id]) queue.push({ item: p, type: 'prop' }); });

      if (queue.length > 0) {
          console.log(`[Auto-Gen] Found ${queue.length} items to generate.`);
          
          // 1. Mark all as generating locally to block re-entry immediately
          setGeneratingItems(prev => {
              const next = { ...prev };
              queue.forEach(q => next[q.item.id] = true);
              return next;
          });

          // 2. Fire requests sequentially to avoid rate limits
          queue.forEach((q, idx) => {
              setTimeout(() => {
                  handleGenerateAsset(q.item, q.type);
              }, idx * 500); // 500ms stagger
          });
      }
  }, [project, activeChannel]); // Important: Effect re-runs when project changes, enabling the next batch if any logic was missed

  // Update Visual Description Generic Handler
  const handleUpdateDescription = (itemId: string, newDesc: string) => {
      if (!editingItem) return;
      const type = editingItem.type;

      updateProject(prev => {
          const sb = { ...prev.storyboard! };
          let targetList = type === 'char' ? sb.characters : (type === 'scene' ? sb.sceneVisuals : sb.props);
          if (!targetList) return prev;

          const updatedList = targetList.map((c: any) => c.id === itemId ? { ...c, visualDescription: newDesc } : c);
          
          if (type === 'char') sb.characters = updatedList;
          else if (type === 'scene') sb.sceneVisuals = updatedList;
          else sb.props = updatedList;

          return { ...prev, storyboard: sb };
      });

      setEditingItem(prev => prev ? { ...prev, data: { ...prev.data, visualDescription: newDesc } } : null);
  };

  // Smart Prompt Assembly Engine (Display Only)
  const buildShotPrompt = (shot: StoryboardShot, scene: StoryboardScene): string => {
     let parts = [];
     const currentStyle = project?.storyboard?.globalStyle;
     if (currentStyle) parts.push(`[Style: ${currentStyle}]`);
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
      updateProject(prev => {
          const updatedScenes = prev.storyboard!.scenes.map(scene => {
              if (scene.id !== sceneId) return scene;
              return {
                  ...scene,
                  shots: scene.shots.map(s => s.id === shotId ? { ...s, constructedPrompt: newPrompt } : s)
              };
          });
          return { ...prev, storyboard: { ...prev.storyboard!, scenes: updatedScenes } };
      });
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
                      {/* Queued indicator */}
                      {item.status === 'queued' && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full text-[8px] font-bold border border-yellow-200">
                              <Zap size={8} fill="currentColor" /> Auto
                          </div>
                      )}
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
      
      {/* Top Bar: Replaced old Style Settings with a cleaner info bar if needed, or remove completely to let ScriptEditor handle it.
          For now, we remove the Style UI completely as requested. */}
      
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
