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
 * Reusable Glass Dropdown for modal contexts
 */
const GlassSelect = ({ label, value, options, onChange, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selected = options.find((o: any) => o.value === value);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`bg-[#F5F5F7] hover:bg-[#EBEBEF] rounded-xl px-4 py-3 border border-black/5 transition-all flex flex-col cursor-pointer group ${isOpen ? 'ring-2 ring-[#007AFF]/20 bg-white' : ''}`}
            >
                <span className="text-[7px] font-black text-gray-400 uppercase block mb-1 tracking-widest">{label}</span>
                <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black uppercase truncate ${selected ? 'text-[#1D1D1F]' : 'text-gray-400'}`}>
                        {selected?.label || placeholder}
                    </span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#007AFF]' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-2xl border border-black/5 rounded-2xl shadow-2xl z-[100] overflow-hidden py-1 animate-in slide-in-from-top-2">
                    {options.map((opt: any) => (
                        <div 
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`px-4 py-2.5 text-[10px] font-black uppercase transition-colors cursor-pointer flex items-center justify-between
                                ${value === opt.value ? 'bg-[#007AFF] text-white' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                        >
                            {opt.label}
                            {value === opt.value && <Check size={12} strokeWidth={4} />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const StoryboardPage = () => {
  const { t, lang, activeChannel, volcSettings } = useGlobal();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<ScriptProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingItems, setGeneratingItems] = useState<Record<string, boolean>>({});
  const [editingItem, setEditingItem] = useState<{type: 'char' | 'scene' | 'prop', data: any} | null>(null);
  
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
                    localStorage.setItem('sora_script_projects', JSON.stringify(projects.map(p => p.id === projectId ? found : p)));
                }
                setProject(found);
            }
        }
        setLoading(false);
    };
    loadProject();
  }, [projectId, volcSettings]);

  const updateProject = (updater: (prev: ScriptProject) => ScriptProject) => {
      setProject(prev => {
          if (!prev) return null;
          const next = updater(prev);
          const list = JSON.parse(localStorage.getItem('sora_script_projects') || '[]');
          localStorage.setItem('sora_script_projects', JSON.stringify(list.map((p: any) => p.id === next.id ? next : p)));
          return next;
      });
  };

  const handleAddNewAsset = (type: 'char' | 'scene' | 'prop') => {
      const newId = `${type}-${Date.now()}`;
      const newItem = { id: newId, name: type === 'char' ? 'New Cast' : type === 'scene' ? 'New Scene' : 'New Prop', visualDescription: '', status: 'queued' };
      updateProject(prev => {
          const sb = { ...prev.storyboard! };
          if (type === 'char') sb.characters = [...(sb.characters || []), newItem as any];
          else if (type === 'scene') sb.sceneVisuals = [...(sb.sceneVisuals || []), newItem as any];
          else if (type === 'prop') sb.props = [...(sb.props || []), newItem as any];
          return { ...prev, storyboard: sb };
      });
      setEditingItem({ type, data: newItem });
  };

  const handleGenerateAsset = async (item: any, type: 'char' | 'scene' | 'prop') => {
      if (!activeChannel?.apiToken) return;
      setGeneratingItems(prev => ({...prev, [item.id]: true}));
      let promptPrefix = type === 'char' ? "Full body character concept, white background" : type === 'scene' ? "Environment wide shot, cinematic" : "Object product shot, studio lighting";
      const finalPrompt = `${promptPrefix}, ${item.visualDescription}, ${project?.storyboard?.globalStyle}`;

      try {
          const results = await createNanoBananaPro4KTask(activeChannel.baseUrl, activeChannel.apiToken, finalPrompt, [], { aspectRatio: '1:1', resolution: '1K' });
          updateProject(cp => {
              const sb = { ...cp.storyboard! };
              const update = (l: any[]) => l.map(c => c.id === item.id ? { ...c, status: 'success', referenceImageUrl: results[0] } : c);
              if (type === 'char') sb.characters = update(sb.characters);
              else if (type === 'scene') sb.sceneVisuals = update(sb.sceneVisuals);
              else sb.props = update(sb.props);
              return { ...cp, storyboard: sb };
          });
      } catch (e) {
          updateProject(cp => {
              const sb = { ...cp.storyboard! };
              const update = (l: any[]) => l.map(c => c.id === item.id ? { ...c, status: 'failed' } : c);
              if (type === 'char') sb.characters = update(sb.characters);
              else if (type === 'scene') sb.sceneVisuals = update(sb.sceneVisuals);
              else sb.props = update(sb.props);
              return { ...cp, storyboard: sb };
          });
      } finally { setGeneratingItems(prev => ({...prev, [item.id]: false})); }
  };

  if (loading) return <div className="p-8 space-y-4"><div className="h-10 w-full bg-gray-100 rounded animate-pulse" /><div className="flex gap-4"><div className="w-40 h-60 bg-gray-100 rounded animate-pulse" /></div></div>;
  if (!project) return null;

  return (
    <div className="h-full bg-[#F5F5F7] flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <section className="mb-10 space-y-8">
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                     <h2 className="text-xs font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-2"><User size={14} /> CAST</h2>
                     <button onClick={() => handleAddNewAsset('char')} className="p-1.5 bg-[#F5F5F7] hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Plus size={14} /></button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-h min-h-[180px]">
                      {project.storyboard?.characters.map(item => (
                          <div key={item.id} onClick={() => setEditingItem({ type: 'char', data: item })} className="w-40 shrink-0 bg-white rounded-xl overflow-hidden border border-gray-200 cursor-pointer transition-all hover:shadow-md">
                              <div className="aspect-[3/4] bg-gray-50">{item.referenceImageUrl ? <img src={item.referenceImageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-200"><User size={32}/></div>}</div>
                              <div className="p-3"><h3 className="font-bold text-xs truncate">{item.name}</h3></div>
                          </div>
                      ))}
                  </div>
              </div>
          </section>
      </div>

      {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[80vh]">
                  <div className="w-full md:w-1/2 bg-gray-100 relative group">
                      {editingItem.data.referenceImageUrl ? <img src={editingItem.data.referenceImageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={64} /></div>}
                  </div>
                  <div className="w-full md:w-1/2 p-8 flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                          <input value={editingItem.data.name} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, name: e.target.value}})} className="text-xl font-black text-[#1D1D1F] bg-transparent outline-none flex-1" />
                          <button onClick={() => setEditingItem(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                      </div>
                      <div className="flex-1 space-y-6 overflow-y-auto">
                          {editingItem.type === 'char' && (
                              <GlassSelect 
                                  label="Archetype Template" 
                                  value={editingItem.data.archetype} 
                                  placeholder="Select Archetype..."
                                  options={ARCHETYPES.map(a => ({ label: a.label, value: a.desc }))} 
                                  onChange={(val: string) => setEditingItem({...editingItem, data: {...editingItem.data, visualDescription: `${editingItem.data.name}, ${val}, cinematic`}})}
                              />
                          )}
                          <div className="space-y-2">
                              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Visual Directive</label>
                              <textarea 
                                  value={editingItem.data.visualDescription} 
                                  onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, visualDescription: e.target.value}})}
                                  className="w-full bg-[#F5F5F7] border-none rounded-2xl p-4 text-xs font-medium text-[#1D1D1F] min-h-[120px] resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/20 shadow-inner"
                              />
                          </div>
                      </div>
                      <div className="mt-6">
                          <button onClick={() => handleGenerateAsset(editingItem.data, editingItem.type)} disabled={generatingItems[editingItem.data.id]} className="w-full bg-[#007AFF] text-white py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50">
                             {generatingItems[editingItem.data.id] ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                             GENERATE ASSET
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};