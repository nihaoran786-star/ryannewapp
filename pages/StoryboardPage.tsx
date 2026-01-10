

import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  LayoutTemplate, ArrowLeft, RefreshCw, Wand2, Image as ImageIcon, 
  Loader2, AlertCircle, Camera, User, Film, Download, Check
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { ScriptProject, StoryboardData, ImageModel, StoryboardCharacter, StoryboardShot } from '../types';
import { generateStoryboardStructure } from '../services/scriptUtils';
import { createImageGenerationTask, queryImageTask } from '../services/imageService';

const { useParams, useNavigate } = ReactRouterDOM as any;

/**
 * StoryboardPage (V3.0)
 * Visualizes script scenes and characters with AI generation capabilities.
 */
export const StoryboardPage = () => {
  const { t, lang, activeChannel, channels } = useGlobal();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<ScriptProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingItems, setGeneratingItems] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Load project and initialize storyboard if needed
  useEffect(() => {
    if (!projectId) return;

    const loadProject = () => {
        const saved = localStorage.getItem('sora_script_projects');
        if (saved) {
            const projects: ScriptProject[] = JSON.parse(saved);
            const found = projects.find(p => p.id === projectId);
            
            if (found) {
                // Phase 1 Mock: If storyboard data missing, generate it (simulate Deep Script Analysis)
                if (!found.storyboard || !found.storyboard.scenes) {
                    console.log('Phase 1: Deep Script Analysis triggered...');
                    const sbData = generateStoryboardStructure(found.content || '');
                    found.storyboard = sbData;
                    // Save back
                    const updatedList = projects.map(p => p.id === projectId ? found : p);
                    localStorage.setItem('sora_script_projects', JSON.stringify(updatedList));
                }
                setProject(found);
            }
        }
        setLoading(false);
    };

    loadProject();
  }, [projectId]);

  // Polling for image generation status
  useEffect(() => {
      const pollInterval = setInterval(async () => {
          if (!project?.storyboard) return;
          const sb = project.storyboard;
          let hasUpdates = false;

          // Check Characters
          for (const char of sb.characters) {
             if (char.referenceImageId && char.status === 'processing') {
                 const status = await checkTaskStatus(char.referenceImageId);
                 if (status.done) {
                     char.referenceImageUrl = status.url;
                     char.status = status.status as any;
                     setGeneratingItems(prev => ({...prev, [char.id]: false}));
                     hasUpdates = true;
                 } else if (status.failed) {
                     char.status = 'failed';
                     setGeneratingItems(prev => ({...prev, [char.id]: false}));
                     hasUpdates = true;
                 }
             }
          }

          // Check Shots
          for (const scene of sb.scenes) {
              for (const shot of scene.shots) {
                  if (shot.imageId && shot.status === 'processing') {
                      const status = await checkTaskStatus(shot.imageId);
                      if (status.done) {
                          shot.imageUrl = status.url;
                          shot.status = status.status as any;
                          setGeneratingItems(prev => ({...prev, [shot.id]: false}));
                          hasUpdates = true;
                      } else if (status.failed) {
                          shot.status = 'failed';
                          setGeneratingItems(prev => ({...prev, [shot.id]: false}));
                          hasUpdates = true;
                      }
                  }
              }
          }

          if (hasUpdates) {
             saveProject(project);
          }

      }, 3000);
      return () => clearInterval(pollInterval);
  }, [project, activeChannel]);

  const saveProject = (updatedProj: ScriptProject) => {
      const saved = localStorage.getItem('sora_script_projects');
      if (saved) {
          const projects: ScriptProject[] = JSON.parse(saved);
          const updatedList = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
          localStorage.setItem('sora_script_projects', JSON.stringify(updatedList));
          setProject({...updatedProj}); // Force re-render
      }
  };

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
          return { done: false, failed: false }; // Retry next time
      }
  };

  const handleGenerateCharacter = async (char: StoryboardCharacter) => {
      if (!activeChannel?.apiToken) { alert(t('missingToken')); return; }
      if (!project) return;

      setGeneratingItems(prev => ({...prev, [char.id]: true}));
      
      try {
          const apiId = await createImageGenerationTask(
              activeChannel.baseUrl, 
              activeChannel.apiToken, 
              char.visualDescription, 
              ImageModel.NANO_BANANA_2,
              { size: '1:1', resolution: '1K' }
          );
          
          char.referenceImageId = apiId;
          char.status = 'processing';
          saveProject(project);
      } catch (e: any) {
          alert(`Failed: ${e.message}`);
          setGeneratingItems(prev => ({...prev, [char.id]: false}));
      }
  };

  const handleGenerateShot = async (sceneId: string, shot: StoryboardShot) => {
      if (!activeChannel?.apiToken) { alert(t('missingToken')); return; }
      if (!project) return;

      setGeneratingItems(prev => ({...prev, [shot.id]: true}));

      try {
          const apiId = await createImageGenerationTask(
              activeChannel.baseUrl, 
              activeChannel.apiToken, 
              `${shot.promptPreFill}, cinematic, high quality`, 
              ImageModel.NANO_BANANA_2,
              { size: '16:9', resolution: '1K' }
          );
          
          shot.imageId = apiId;
          shot.status = 'processing';
          saveProject(project);
      } catch (e: any) {
          alert(`Failed: ${e.message}`);
          setGeneratingItems(prev => ({...prev, [shot.id]: false}));
      }
  };

  // --- Render Helpers ---

  if (loading) {
      return (
          <div className="h-full flex items-center justify-center bg-[#F5F5F7]">
              <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
      );
  }

  if (!project) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <h2 className="text-xl font-bold mb-4">Select a Project</h2>
            <button onClick={() => navigate('/projects')} className="bg-[#007AFF] text-white px-6 py-2 rounded-full font-bold">
                Go to Projects
            </button>
        </div>
      );
  }

  return (
    <div className="h-full bg-[#F5F5F7] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 flex items-center justify-between bg-white border-b border-gray-200 shrink-0 sticky top-0 z-20">
         <div className="flex items-center gap-4">
            <button onClick={() => navigate('/projects')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="text-xl font-bold text-[#1D1D1F] flex items-center gap-2">
                    <LayoutTemplate size={20} className="text-[#007AFF]" />
                    {project.title} <span className="text-gray-400 font-normal">Storyboard</span>
                </h1>
            </div>
         </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {/* Cast Section */}
          <section className="mb-12">
              <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <User size={14} /> {lang === 'zh' ? '角色定妆 (CAST)' : 'CAST & CHARACTERS'}
              </h2>
              <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar-h">
                  {project.storyboard?.characters.map(char => (
                      <div key={char.id} className="w-48 shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group relative">
                          <div className="aspect-[3/4] bg-gray-50 relative">
                              {char.referenceImageUrl ? (
                                  <img src={char.referenceImageUrl} className="w-full h-full object-cover" />
                              ) : char.status === 'processing' || generatingItems[char.id] ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                      <Loader2 className="animate-spin text-[#007AFF]" />
                                  </div>
                              ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                                      <User size={40} />
                                      <span className="text-[10px] uppercase font-bold">No Visage</span>
                                  </div>
                              )}
                              
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button 
                                    onClick={() => handleGenerateCharacter(char)}
                                    className="bg-white text-black px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                                  >
                                      <Wand2 size={12} /> {char.referenceImageUrl ? (lang === 'zh' ? '重绘' : 'Redo') : (lang === 'zh' ? '生成' : 'Generate')}
                                  </button>
                              </div>
                          </div>
                          <div className="p-3">
                              <h3 className="font-bold text-sm text-[#1D1D1F]">{char.name}</h3>
                              <p className="text-[10px] text-gray-500 line-clamp-2 leading-tight mt-1">{char.visualDescription}</p>
                          </div>
                      </div>
                  ))}
                  {(!project.storyboard?.characters || project.storyboard.characters.length === 0) && (
                      <div className="w-48 h-64 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 text-xs">
                          No characters detected
                      </div>
                  )}
              </div>
          </section>

          {/* Scenes Section */}
          <div className="space-y-12">
              {project.storyboard?.scenes.map(scene => (
                  <section key={scene.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center gap-3 mb-6 sticky top-0 bg-[#F5F5F7]/95 backdrop-blur-sm z-10 py-2">
                          <span className="text-xl font-black text-gray-300">#{scene.number}</span>
                          <h3 className="text-lg font-bold text-[#1D1D1F]">{scene.header}</h3>
                          <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded border border-gray-100">{scene.atmosphere.split(',')[0]}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {scene.shots.map((shot, idx) => (
                              <div key={shot.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                  {/* Shot Image Preview */}
                                  <div className="aspect-video bg-gray-100 relative group">
                                      {shot.imageUrl ? (
                                          <img src={shot.imageUrl} className="w-full h-full object-cover" />
                                      ) : shot.status === 'processing' || generatingItems[shot.id] ? (
                                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                              <Loader2 className="animate-spin text-[#007AFF]" />
                                              <span className="text-[10px] font-bold text-gray-400">RENDERING</span>
                                          </div>
                                      ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                              <Film size={32} />
                                              <span className="text-[10px] font-bold mt-2">SHOT {idx + 1}</span>
                                          </div>
                                      )}

                                      {/* Action Overlay */}
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                          <button 
                                            onClick={() => handleGenerateShot(scene.id, shot)}
                                            className="bg-[#007AFF] text-white p-2.5 rounded-full hover:bg-blue-600 transition-transform active:scale-95"
                                            title="Generate Shot"
                                          >
                                              <Wand2 size={16} />
                                          </button>
                                          {shot.imageUrl && (
                                              <button 
                                                onClick={() => window.open(shot.imageUrl, '_blank')}
                                                className="bg-white/20 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-white/30 transition-transform"
                                              >
                                                  <Download size={16} />
                                              </button>
                                          )}
                                      </div>
                                  </div>

                                  {/* Shot Details */}
                                  <div className="p-4">
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shot {idx + 1}</span>
                                          {shot.status === 'failed' && <AlertCircle size={12} className="text-red-500" />}
                                          {shot.status === 'success' && <Check size={12} className="text-green-500" />}
                                      </div>
                                      <p className="text-xs text-[#1D1D1F] leading-relaxed font-medium line-clamp-3">
                                          {shot.text}
                                      </p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </section>
              ))}
          </div>
      </div>
    </div>
  );
};