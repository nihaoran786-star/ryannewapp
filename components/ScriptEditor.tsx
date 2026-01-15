
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Plus, Save, Upload, PenTool, Layout, 
  BarChart, Mic, ChevronRight, ChevronLeft, Search, 
  Sparkles, MoreHorizontal, User, BookOpen, Loader2,
  X, Wand2, AlignLeft, Scissors, Minimize2, BrainCircuit, ArrowRight,
  AlertTriangle, CheckCircle2, Film, Lightbulb, LayoutTemplate, Zap,
  Palette, ChevronDown, Trash2
} from 'lucide-react';
import { ScriptProject, ScriptScene, ScriptCharacter, ScriptLine, LogicIssue } from '../types';
import { parseScript, extractScenes, extractCharacters } from '../services/scriptUtils';
import { useGlobal } from '../context/GlobalContext';
import { callVolcChatApi, PROMPTS } from '../services/volcEngineService';
import * as ReactRouterDOM from 'react-router-dom';

const { useNavigate } = ReactRouterDOM as any;

interface ScriptEditorProps {
  lang?: 'zh' | 'en'; 
  projectId?: string;
  onBack?: () => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ projectId, onBack }) => {
  const { volcSettings, t, lang, analysisState, triggerBackgroundAnalysis, stylePresets, addStylePreset, deleteStylePreset } = useGlobal();
  const navigate = useNavigate();
  
  // States
  const [editorContent, setEditorContent] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [globalStyle, setGlobalStyle] = useState('');
  
  // UI States
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [isNewStyleMode, setIsNewStyleMode] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStylePrompt, setNewStylePrompt] = useState('');

  // Floating Toolbar State
  const [toolbarPosition, setToolbarPosition] = useState<{top: number, left: number} | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);

  // Refs for data to avoid loop crash
  const projectsRef = useRef<ScriptProject[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial Load
  useEffect(() => {
    const saved = localStorage.getItem('sora_script_projects');
    if (saved) {
        const list = JSON.parse(saved);
        projectsRef.current = list;
        const found = list.find((p: any) => p.id === projectId);
        if (found) {
            setEditorContent(found.content || '');
            setProjectTitle(found.title || '');
            const existingStyle = found.storyboard?.globalStyle;
            if (existingStyle) {
                setGlobalStyle(existingStyle);
            } else {
                // Show modal if project has no style set
                setShowStyleModal(true);
            }
        }
    }
  }, [projectId]);

  // Derived State
  const parsedLines = useMemo(() => parseScript(editorContent), [editorContent]);
  const scenes = useMemo(() => extractScenes(parsedLines), [parsedLines]);
  const characters = useMemo(() => extractCharacters(parsedLines), [parsedLines]);
  const isThisProjectAnalyzing = analysisState.isAnalyzing && analysisState.projectId === projectId;
  const hasAnalyzed = useMemo(() => {
      const p = projectsRef.current.find(p => p.id === projectId);
      return !!(p?.genre && p.genre.length > 0);
  }, [analysisState.isAnalyzing, projectId]);

  // Robust Auto-save
  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(() => {
        const list = projectsRef.current;
        const updated = list.map(p => {
            if (p.id === projectId) {
                const sb = p.storyboard ? { ...p.storyboard, globalStyle } : { globalStyle } as any;
                return { ...p, content: editorContent, title: projectTitle, lastModified: Date.now(), storyboard: sb };
            }
            return p;
        });
        projectsRef.current = updated;
        localStorage.setItem('sora_script_projects', JSON.stringify(updated));
    }, 1500);
    return () => clearTimeout(timer);
  }, [editorContent, projectTitle, globalStyle, projectId]);

  const handleSelectStyle = (prompt: string) => {
      setGlobalStyle(prompt);
      setShowStyleModal(false);
  };

  const handleAddNewStyle = () => {
      if (!newStyleName || !newStylePrompt) return;
      addStylePreset(newStyleName, newStylePrompt);
      setNewStyleName('');
      setNewStylePrompt('');
      setIsNewStyleMode(false);
  };

  const handleDeepAnalysis = async () => {
    if (!projectId || isThisProjectAnalyzing) return;
    if (!globalStyle) { setShowStyleModal(true); return; }
    triggerBackgroundAnalysis(projectId, editorContent, globalStyle);
    setShowRightPanel(true);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setTimeout(() => {
        if (textarea.selectionStart !== textarea.selectionEnd) {
            setToolbarPosition({ top: e.clientY - 60, left: e.clientX });
            setShowToolbar(true);
        } else {
            setShowToolbar(false);
        }
    }, 10);
  };

  const handleAIAction = async (action: 'EXPAND' | 'SHORTEN' | 'FORMAT') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editorContent.substring(start, end);
    if (!selectedText.trim()) return;
    if (!volcSettings.apiKey) { alert(t('configureVolcAlert')); return; }

    setIsAiProcessing(true);
    try {
        const result = await callVolcChatApi(volcSettings, PROMPTS[action], selectedText);
        setEditorContent(editorContent.substring(0, start) + result + editorContent.substring(end));
        setShowToolbar(false);
    } catch (error: any) {
        alert(`${t('aiError')}: ${error.message}`);
    } finally {
        setIsAiProcessing(false);
    }
  };

  return (
    <div className="flex h-full bg-[#F5F5F7] relative">
      {/* Style Setup Modal (Onboarding) */}
      {showStyleModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-white/40 backdrop-blur-3xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl border border-white flex flex-col max-h-[85vh] overflow-hidden">
                  <div className="p-8 pb-4 text-center">
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Palette className="text-[#007AFF] w-8 h-8" />
                      </div>
                      <h2 className="text-2xl font-black text-[#1D1D1F] tracking-tight">
                          {t('styleOnboardingTitle')}
                      </h2>
                      <p className="text-gray-400 text-sm mt-2 font-medium">{t('styleOnboardingDesc')}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                          {stylePresets.map(style => (
                              <div 
                                key={style.id}
                                onClick={() => handleSelectStyle(style.prompt)}
                                className={`group relative p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col gap-3
                                    ${globalStyle === style.prompt ? 'border-[#007AFF] bg-blue-50/30' : 'border-gray-100 hover:border-blue-200 bg-white hover:shadow-md'}`}
                              >
                                  <div className="flex justify-between items-start">
                                      <h3 className="font-bold text-sm text-[#1D1D1F]">
                                          {style.isCustom ? style.customName : t(style.nameKey)}
                                      </h3>
                                      {style.isCustom && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); deleteStylePreset(style.id); }}
                                            className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                          ><Trash2 size={14} /></button>
                                      )}
                                  </div>
                                  <p className="text-[10px] text-gray-400 font-mono leading-relaxed line-clamp-3 italic">"{style.prompt}"</p>
                                  {globalStyle === style.prompt && (
                                      <div className="absolute bottom-4 right-4 text-[#007AFF]"><CheckCircle2 size={20} fill="currentColor" className="text-white" /></div>
                                  )}
                              </div>
                          ))}
                          
                          <div 
                            onClick={() => setIsNewStyleMode(true)}
                            className="p-5 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#007AFF] hover:text-[#007AFF] transition-all text-gray-400"
                          >
                              <Plus size={24} />
                              <span className="text-xs font-bold">{t('styleCustom')}</span>
                          </div>
                      </div>

                      {isNewStyleMode && (
                          <div className="bg-gray-50 rounded-3xl p-6 space-y-4 animate-in slide-in-from-bottom-2">
                              <div className="flex justify-between items-center">
                                  <h4 className="text-xs font-black uppercase text-gray-500 tracking-widest">{t('styleNewPreset')}</h4>
                                  <button onClick={() => setIsNewStyleMode(false)}><X size={16} /></button>
                              </div>
                              <input 
                                value={newStyleName}
                                onChange={e => setNewStyleName(e.target.value)}
                                placeholder={t('styleNamePlaceholder')}
                                className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold shadow-sm outline-none"
                              />
                              <textarea 
                                value={newStylePrompt}
                                onChange={e => setNewStylePrompt(e.target.value)}
                                placeholder={t('stylePromptPlaceholder')}
                                className="w-full bg-white border-none rounded-xl p-4 text-sm font-medium shadow-sm outline-none min-h-[80px]"
                              />
                              <button 
                                onClick={handleAddNewStyle}
                                className="w-full bg-[#1D1D1F] text-white py-3 rounded-xl font-bold text-xs hover:bg-black transition-colors"
                              >{t('styleSave')}</button>
                          </div>
                      )}
                  </div>

                  <div className="p-8 border-t border-gray-100 flex gap-4">
                      <button 
                        onClick={() => setShowStyleModal(false)}
                        className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-500 font-bold text-sm hover:bg-gray-200 transition-all"
                      >{t('styleSkip')}</button>
                      <button 
                        onClick={() => globalStyle && setShowStyleModal(false)}
                        disabled={!globalStyle}
                        className="flex-[2] py-4 rounded-2xl bg-[#007AFF] text-white font-bold text-sm hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                      >{t('styleApply')}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Floating Toolbar */}
      {showToolbar && toolbarPosition && (
        <div 
            className="fixed z-[150] flex flex-col items-center animate-in zoom-in-95 duration-200"
            style={{ top: Math.max(10, toolbarPosition.top), left: Math.min(window.innerWidth - 300, toolbarPosition.left - 100) }}
        >
            <div className="bg-[#1D1D1F] text-white rounded-xl shadow-2xl p-1.5 flex items-center gap-1 border border-white/10 backdrop-blur-xl">
                {isAiProcessing ? (
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-gray-300"><Loader2 size={14} className="animate-spin" />Processing...</div>
                ) : (
                    <>
                        <button onClick={() => handleAIAction('EXPAND')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 text-xs font-medium"><Wand2 size={14} />{t('expand')}</button>
                        <button onClick={() => handleAIAction('SHORTEN')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 text-xs font-medium"><Scissors size={14} />{t('shorten')}</button>
                        <button onClick={() => handleAIAction('FORMAT')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 text-xs font-medium"><AlignLeft size={14} />{t('fixFormat')}</button>
                    </>
                )}
                <button onClick={() => setShowToolbar(false)} className="p-1.5 rounded-full hover:bg-white/20 text-gray-400 hover:text-white"><X size={12} /></button>
            </div>
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#1D1D1F] mt-[-1px]"></div>
        </div>
      )}

      {/* Left Scenes */}
      <div className={`transition-all duration-300 ease-in-out border-r border-[#E5E5EA] bg-white flex flex-col ${showLeftPanel ? 'w-64' : 'w-0 overflow-hidden opacity-0'}`}>
          <div className="p-4 border-b border-[#E5E5EA] flex justify-between items-center">
              <h3 className="text-xs font-bold text-[#86868B] uppercase tracking-wider">{t('scenes')} ({scenes.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {scenes.map(scene => (
                  <div key={scene.id} onClick={() => document.getElementById(`script-line-${scene.lineIndex}`)?.scrollIntoView({behavior:'smooth', block:'center'})} className="p-3 rounded-lg border border-[#F5F5F7] hover:border-[#007AFF]/30 bg-white hover:shadow-sm cursor-pointer transition-all group mb-2">
                      <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-bold bg-[#F5F5F7] text-[#86868B] px-1.5 rounded">{scene.number}</span><span className="text-xs font-bold text-[#1D1D1F] truncate">{scene.header}</span></div>
                      <p className="text-[10px] text-[#86868B] line-clamp-2 leading-tight group-hover:text-[#1D1D1F]">{scene.logline}</p>
                  </div>
              ))}
          </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="h-14 border-b border-[#E5E5EA] bg-white/80 backdrop-blur-md flex items-center justify-between px-4 z-10 sticky top-0">
              <div className="flex items-center gap-2">
                  {onBack && <button onClick={onBack} className="p-1.5 mr-2 text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100 rounded-lg"><ChevronLeft size={16} /></button>}
                  <button onClick={() => setShowLeftPanel(!showLeftPanel)} className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-md"><Layout size={16}/></button>
                  <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} className="bg-transparent font-bold text-[#1D1D1F] outline-none text-sm w-48 hover:bg-black/5 rounded px-2 transition-colors" placeholder={t('projectTitlePlaceholder')} />
              </div>

              {/* Style Selector Indicator */}
              <div className="flex-1 max-w-sm px-6">
                  <button 
                    onClick={() => setShowStyleModal(true)}
                    className="w-full flex items-center justify-between gap-2 bg-[#F5F5F7] hover:bg-gray-200 px-4 py-1.5 rounded-full transition-all border border-transparent hover:border-gray-300"
                  >
                      <div className="flex items-center gap-2 overflow-hidden">
                          <Palette size={14} className="text-[#007AFF] shrink-0" />
                          <span className="text-[10px] font-black text-[#1D1D1F] uppercase truncate">
                              {globalStyle ? (stylePresets.find(s => s.prompt === globalStyle)?.isCustom ? (stylePresets.find(s => s.prompt === globalStyle)?.customName) : t(stylePresets.find(s => s.prompt === globalStyle)?.nameKey as any)) : t('chooseVisualStyle')}
                          </span>
                      </div>
                      <ChevronDown size={14} className="text-gray-400" />
                  </button>
              </div>

              <div className="flex items-center gap-2">
                  {isThisProjectAnalyzing ? (
                      <div className="flex items-center gap-2 text-purple-600 font-bold text-xs animate-pulse"><BrainCircuit size={14}/> {analysisState.message}</div>
                  ) : (
                      <button onClick={handleDeepAnalysis} className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm bg-white hover:bg-purple-50 text-[#1D1D1F] hover:text-purple-600 border border-gray-200 hover:border-purple-200"><BrainCircuit size={14} className="text-purple-600" />{lang === 'zh' ? '深度分析' : 'Deep Analysis'}</button>
                  )}
                  <button onClick={() => navigate(`/project/${projectId}/storyboard`)} disabled={!hasAnalyzed} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${!hasAnalyzed ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-[#007AFF] to-blue-600 text-white'}`}><LayoutTemplate size={14} />{lang === 'zh' ? '分镜' : 'Storyboard'}</button>
                  <button onClick={() => setShowRightPanel(!showRightPanel)} className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-md"><Layout size={16}/></button>
              </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 bg-[#F5F5F7] p-8 overflow-y-auto custom-scrollbar">
                  <div className="max-w-3xl mx-auto h-full shadow-lg rounded-sm overflow-hidden bg-white">
                     <textarea ref={textareaRef} value={editorContent} onChange={e => setEditorContent(e.target.value)} onMouseUp={handleMouseUp} className="w-full h-full p-12 text-[#1D1D1F] font-mono text-base outline-none resize-none leading-relaxed" placeholder={t('scriptPlaceholder')} spellCheck={false} />
                  </div>
              </div>
              <div className={`flex-1 bg-white border-l border-[#E5E5EA] overflow-y-auto custom-scrollbar transition-all ${showRightPanel ? 'max-w-[50%]' : 'max-w-0 p-0 opacity-0 overflow-hidden'}`}>
                  <div className="p-8">
                      {isThisProjectAnalyzing ? <div className="flex flex-col items-center justify-center h-full py-20 gap-4"><Loader2 size={32} className="animate-spin text-purple-600" /><p className="text-sm font-bold text-gray-500">{analysisState.message}</p></div> : <div className="space-y-4">{parsedLines.map((line, idx) => <div key={line.id} id={`script-line-${idx}`} className={`mb-1 font-mono ${line.type === 'scene' ? 'font-bold mt-6 text-black' : line.type === 'character' ? 'text-center font-bold uppercase mt-4' : line.type === 'dialogue' ? 'text-center max-w-sm mx-auto' : ''}`}>{line.text}</div>)}</div>}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
