
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Plus, Save, Upload, PenTool, Layout, 
  BarChart, Mic, ChevronRight, ChevronLeft, Search, 
  Sparkles, MoreHorizontal, User, BookOpen, Loader2,
  X, Wand2, AlignLeft, Scissors, Minimize2, BrainCircuit, ArrowRight,
  AlertTriangle, CheckCircle2, Film, Lightbulb, LayoutTemplate, Zap
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
  const { volcSettings, t, lang, analysisState, triggerBackgroundAnalysis } = useGlobal();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [editorContent, setEditorContent] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  
  // UI States
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [analyzeMode, setAnalyzeMode] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Floating Toolbar State
  const [toolbarPosition, setToolbarPosition] = useState<{top: number, left: number} | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);

  // Derived State
  const activeProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
  const parsedLines = useMemo(() => parseScript(editorContent), [editorContent]);
  const scenes = useMemo(() => extractScenes(parsedLines), [parsedLines]);
  const characters = useMemo(() => extractCharacters(parsedLines), [parsedLines]);

  // Check if *this* project is currently analyzing in the background
  const isThisProjectAnalyzing = analysisState.isAnalyzing && analysisState.projectId === projectId;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialization
  useEffect(() => {
    const loadProjects = () => {
        const saved = localStorage.getItem('sora_script_projects');
        if (saved) {
            setProjects(JSON.parse(saved));
        }
    };
    
    loadProjects();
    
    // If analysis finished while we were looking, reload to get new data
    if (analysisState.step === 4 && !analysisState.isAnalyzing) {
        loadProjects();
    }
  }, [analysisState.isAnalyzing, analysisState.step]);

  useEffect(() => {
      if (activeProject) {
          if (!editorContent) setEditorContent(activeProject.content); // Only set if empty to avoid overwriting typing
          setProjectTitle(activeProject.title);
          // Check if analysis data exists to enable the storyboard button
          if (activeProject.genre && activeProject.genre.length > 0) {
              setHasAnalyzed(true);
          }
      }
  }, [activeProject]);

  // Auto-save
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const updatedProjects = projects.map(p => 
        p.id === projectId ? { ...p, content: editorContent, title: projectTitle, lastModified: Date.now() } : p
      );
      const timeout = setTimeout(() => {
         localStorage.setItem('sora_script_projects', JSON.stringify(updatedProjects));
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [editorContent, projectTitle, projectId, projects.length]);

  // Handle Text Selection for Floating Toolbar
  const handleMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    setTimeout(() => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start !== end) {
            const x = e.clientX;
            const y = e.clientY;
            setToolbarPosition({ top: y - 60, left: x });
            setShowToolbar(true);
        } else {
            setShowToolbar(false);
        }
    }, 10);
  };

  const handleKeyDown = () => {
    if (showToolbar) setShowToolbar(false);
  };

  const scrollToLine = (index: number) => {
      const el = document.getElementById(`script-line-${index}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (textareaRef.current) textareaRef.current.scrollTop = index * 24; 
  };

  // Phase 1: Deep Analysis Only (Stays on Page)
  const handleDeepAnalysis = async () => {
    if (!projectId || isThisProjectAnalyzing) return;
    
    // Force save before analysis
    const updatedProjects = projects.map(p => 
        p.id === projectId ? { ...p, content: editorContent, title: projectTitle } : p
    );
    localStorage.setItem('sora_script_projects', JSON.stringify(updatedProjects));
    setProjects(updatedProjects);

    // Trigger Global Background Analysis
    triggerBackgroundAnalysis(projectId, editorContent);
    setShowRightPanel(true);
  };

  // Navigation to Storyboard
  const handleGoToStoryboard = () => {
      navigate(`/project/${projectId}/storyboard`);
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
        const newContent = editorContent.substring(0, start) + result + editorContent.substring(end);
        setEditorContent(newContent);
        setShowToolbar(false);
    } catch (error: any) {
        alert(`${t('aiError')}: ${error.message}`);
    } finally {
        setIsAiProcessing(false);
    }
  };

  const renderAnalysisPanel = () => {
      if (!activeProject) return null;
      return (
          <div className="space-y-6">
              {/* Report Header */}
              {activeProject.genre && activeProject.genre.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-white p-4 rounded-xl border border-purple-100 animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 mb-2">
                          <Film size={14} className="text-purple-600" />
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">{lang === 'zh' ? '类型与题材' : 'GENRE'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          {activeProject.genre.map((g, i) => (
                              <span key={i} className="bg-white px-2 py-1 rounded-md text-xs font-bold text-[#1D1D1F] shadow-sm border border-purple-100">{g}</span>
                          ))}
                      </div>
                      {activeProject.logline && (
                          <p className="mt-3 text-xs text-gray-600 italic leading-relaxed">
                              "{activeProject.logline}"
                          </p>
                      )}
                  </div>
              )}

              {/* Logic Issues */}
              {activeProject.logicIssues && activeProject.logicIssues.length > 0 && (
                  <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 animate-in slide-in-from-top-4">
                       <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={14} className="text-red-500" />
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{lang === 'zh' ? '逻辑与一致性' : 'LOGIC ISSUES'}</span>
                      </div>
                      <div className="space-y-3">
                          {activeProject.logicIssues.map((issue, idx) => (
                              <div key={idx} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex gap-3">
                                  <div className={`w-1.5 h-full rounded-full shrink-0 ${issue.severity === 'High' ? 'bg-red-500' : 'bg-orange-400'}`} />
                                  <div>
                                      <p className="text-xs font-medium text-[#1D1D1F] leading-snug">{issue.issue_description}</p>
                                      {issue.scene_refs && (
                                          <div className="mt-1.5 flex gap-1">
                                              {issue.scene_refs.map(r => (
                                                  <span key={r} className="text-[9px] font-mono bg-red-50 text-red-600 px-1.5 rounded">Sc.{r}</span>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Sentiment Chart */}
              {(activeProject.scenes && activeProject.scenes.length > 1) && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-in slide-in-from-top-6">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-1">
                            <BarChart size={12} /> {t('emotionalArc')}
                        </h4>
                    </div>
                    {/* Simple SVG Chart */}
                    <svg width="100%" height="60" className="overflow-visible">
                        <path d={`M 0 30 L 100% 30`} stroke="#E5E5EA" strokeWidth="1" strokeDasharray="4 2" />
                        <polyline 
                            points={activeProject.scenes.map((s, i) => {
                                const x = (i / (activeProject.scenes!.length - 1)) * 240; 
                                const y = 30 - ((s.sentiment || 0) * 25); 
                                return `${x},${y}`;
                            }).join(' ')} 
                            fill="none" 
                            stroke="#007AFF" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            vectorEffect="non-scaling-stroke"
                        />
                    </svg>
                    <div className="flex justify-between text-[9px] text-gray-400 mt-1 font-mono">
                        <span>Start</span>
                        <span>End</span>
                    </div>
                </div>
              )}
          </div>
      );
  };

  const renderScriptLine = (line: ScriptLine, idx: number) => {
      let className = "text-base mb-1 font-mono text-[#1D1D1F] transition-colors duration-200 ";
      let style: React.CSSProperties = {};

      switch (line.type) {
          case 'scene': className += "font-bold mt-8 mb-4 text-black"; break;
          case 'character':
              className += "font-bold mt-4 mb-0 text-center uppercase tracking-wide";
              if (analyzeMode) {
                  const char = characters.find(c => line.text.includes(c.name));
                  if (char) style.color = char.color;
              }
              break;
          case 'dialogue': className += "text-center max-w-[350px] mx-auto"; break;
          case 'parenthetical': className += "text-center text-sm italic text-[#86868B] -mt-1 mb-0"; break;
          case 'transition': className += "text-right font-bold uppercase mt-4 mb-4 text-[#86868B] text-xs"; break;
          case 'action': default: className += "text-left max-w-2xl mx-auto"; break;
      }
      return (
          <div key={line.id} id={`script-line-${idx}`} className={className} style={style}>
              {line.text}
          </div>
      );
  };

  // --- Neural Pulse Animation Component ---
  const NeuralPulse = ({ message }: { message: string }) => (
      <div className="flex items-center gap-3 px-4 py-1.5 bg-black/5 rounded-full border border-black/5 shadow-inner">
          <div className="relative w-4 h-4 flex items-center justify-center">
              <div className="absolute inset-0 bg-purple-500/30 rounded-full animate-ping" />
              <div className="relative bg-purple-600 rounded-full w-2.5 h-2.5 shadow-[0_0_10px_rgba(147,51,234,0.5)] animate-pulse" />
          </div>
          <span className="text-xs font-bold text-purple-700 animate-pulse bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
              {message}
          </span>
      </div>
  );

  if (!projectId) return <div className="flex items-center justify-center h-full text-gray-400"><p>{t('pleaseSelectProject')}</p></div>;

  return (
    <div className="flex h-full bg-[#F5F5F7] relative">
      {/* Floating Toolbar */}
      {showToolbar && toolbarPosition && (
        <div 
            className="fixed z-50 flex flex-col items-center animate-in zoom-in-95 duration-200"
            style={{ top: Math.max(10, toolbarPosition.top), left: Math.min(window.innerWidth - 300, toolbarPosition.left - 100) }}
        >
            <div className="bg-[#1D1D1F] text-white rounded-xl shadow-2xl p-1.5 flex items-center gap-1 border border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-1 px-2 border-r border-white/20 mr-1">
                    <Sparkles size={14} className="text-[#0A84FF]" />
                    <span className="text-xs font-bold text-[#0A84FF]">Volc AI</span>
                </div>
                
                {isAiProcessing ? (
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-gray-300">
                        <Loader2 size={14} className="animate-spin" />
                        Processing...
                    </div>
                ) : (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); handleAIAction('EXPAND'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-xs font-medium"><Wand2 size={14} />{t('expand')}</button>
                        <button onClick={(e) => { e.stopPropagation(); handleAIAction('SHORTEN'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-xs font-medium"><Scissors size={14} />{t('shorten')}</button>
                        <button onClick={(e) => { e.stopPropagation(); handleAIAction('FORMAT'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-xs font-medium"><AlignLeft size={14} />{t('fixFormat')}</button>
                    </>
                )}
                <div className="w-[1px] h-4 bg-white/20 mx-1" />
                <button onClick={() => setShowToolbar(false)} className="p-1.5 rounded-full hover:bg-white/20 text-gray-400 hover:text-white transition-colors"><X size={12} /></button>
            </div>
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#1D1D1F] mt-[-1px]"></div>
        </div>
      )}

      {/* Left Panel: Scene Navigator */}
      <div className={`transition-all duration-300 ease-in-out border-r border-[#E5E5EA] bg-white flex flex-col ${showLeftPanel ? 'w-64' : 'w-0 overflow-hidden opacity-0'}`}>
          <div className="p-4 border-b border-[#E5E5EA]">
              <h3 className="text-xs font-bold text-[#86868B] uppercase tracking-wider mb-2">{t('scenes')} ({scenes.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              <div className="space-y-2">
                  {scenes.map(scene => (
                      <div 
                        key={scene.id} 
                        onClick={() => scrollToLine(scene.lineIndex)}
                        className="p-3 rounded-lg border border-[#F5F5F7] hover:border-[#007AFF]/30 bg-white hover:shadow-sm cursor-pointer transition-all group"
                      >
                          <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold bg-[#F5F5F7] text-[#86868B] px-1.5 rounded">{scene.number}</span>
                              <span className="text-xs font-bold text-[#1D1D1F] truncate">{scene.header}</span>
                          </div>
                          <p className="text-[10px] text-[#86868B] line-clamp-2 leading-tight group-hover:text-[#1D1D1F] transition-colors">
                              {activeProject?.scenes?.find(s => s.number === scene.number)?.pacing && (
                                  <span className="mr-1 text-[#007AFF] font-mono">
                                      [{activeProject.scenes.find(s => s.number === scene.number)?.pacing}]
                                  </span>
                              )}
                              {scene.logline}
                          </p>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="h-12 border-b border-[#E5E5EA] bg-white/80 backdrop-blur-md flex items-center justify-between px-4 z-10 sticky top-0">
              <div className="flex items-center gap-2">
                  {onBack && (
                      <button onClick={onBack} className="p-1.5 mr-2 text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1">
                          <ChevronLeft size={16} />
                          <span className="text-xs font-bold">{t('back')}</span>
                      </button>
                  )}
                  <button onClick={() => setShowLeftPanel(!showLeftPanel)} className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-md hover:bg-[#F5F5F7]">
                      {showLeftPanel ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  <div className="h-4 w-[1px] bg-[#E5E5EA] mx-1" />
                  <input 
                      value={projectTitle} 
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className="bg-transparent font-bold text-[#1D1D1F] outline-none text-sm w-48 hover:bg-black/5 rounded px-2 transition-colors"
                      placeholder={t('projectTitlePlaceholder')}
                  />
              </div>
              <div className="flex items-center gap-2">
                  
                  {/* Dynamic Analysis Status / Button */}
                  {isThisProjectAnalyzing ? (
                      <NeuralPulse message={analysisState.message} />
                  ) : (
                      <button 
                         onClick={handleDeepAnalysis}
                         className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm bg-white hover:bg-purple-50 text-[#1D1D1F] hover:text-purple-600 border border-gray-200 hover:border-purple-200"
                      >
                         <BrainCircuit size={14} className="text-purple-600" />
                         {lang === 'zh' ? '深度分析' : 'Deep Analysis'}
                      </button>
                  )}

                  {/* Generate Storyboard (Navigates) */}
                  <button 
                    onClick={handleGoToStoryboard}
                    disabled={isThisProjectAnalyzing}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm 
                        ${!hasAnalyzed || isThisProjectAnalyzing
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-[#007AFF] to-blue-600 text-white hover:shadow-blue-500/30 active:scale-95'}`}
                  >
                      <LayoutTemplate size={14} />
                      {lang === 'zh' ? '生成分镜' : 'Storyboard'}
                      <ArrowRight size={14} className="opacity-60" />
                  </button>
                  
                  <div className="h-4 w-[1px] bg-[#E5E5EA] mx-2" />
                  
                  <button onClick={() => setShowRightPanel(!showRightPanel)} className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-md hover:bg-[#F5F5F7]">
                      <Layout size={16}/>
                  </button>
              </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 bg-[#F5F5F7] p-8 overflow-y-auto relative custom-scrollbar">
                  <div className="max-w-3xl mx-auto h-full shadow-lg rounded-sm overflow-hidden relative">
                     <textarea
                        ref={textareaRef}
                        value={editorContent}
                        onChange={(e) => setEditorContent(e.target.value)}
                        onMouseUp={handleMouseUp}
                        onKeyDown={handleKeyDown}
                        className="w-full h-full p-12 bg-white text-[#1D1D1F] font-mono text-base outline-none resize-none leading-relaxed selection:bg-[#007AFF]/20"
                        placeholder={t('scriptPlaceholder')}
                        spellCheck={false}
                     />
                  </div>
              </div>

              {/* Right Panel: Analysis & Preview */}
              <div className={`flex-1 bg-white border-l border-[#E5E5EA] overflow-y-auto p-8 custom-scrollbar transition-all ${showRightPanel ? 'max-w-[50%]' : 'max-w-0 p-0 opacity-0 overflow-hidden'}`}>
                  {activeProject && (activeProject.genre || activeProject.logicIssues) ? (
                      <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-4">
                          <h3 className="text-lg font-black text-[#1D1D1F] flex items-center gap-2">
                              <Lightbulb className="text-yellow-500" size={20} />
                              Analysis Report
                          </h3>
                          {renderAnalysisPanel()}
                          <div className="h-px bg-gray-100 my-8" />
                          <h3 className="text-lg font-black text-[#1D1D1F] mb-6">Preview</h3>
                          <div className="max-w-2xl mx-auto bg-white min-h-[400px] shadow-apple-card border border-gray-100 p-12">
                              {parsedLines.map((line, idx) => renderScriptLine(line, idx))}
                          </div>
                      </div>
                  ) : (
                      <div className="max-w-2xl mx-auto bg-white min-h-[800px] shadow-apple-card border border-gray-100 p-16 relative">
                          {isThisProjectAnalyzing ? (
                               <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 gap-6">
                                   <div className="relative">
                                       <div className="w-20 h-20 rounded-full border-4 border-purple-100 animate-[spin_3s_linear_infinite]" />
                                       <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin" />
                                       <div className="absolute inset-4 bg-purple-50 rounded-full flex items-center justify-center animate-pulse">
                                           <BrainCircuit className="text-purple-500 w-8 h-8" />
                                       </div>
                                   </div>
                                   <div className="text-center">
                                       <p className="text-sm font-bold text-[#1D1D1F]">{analysisState.message}</p>
                                       <p className="text-xs text-gray-400 mt-1">Reading script structure...</p>
                                   </div>
                               </div>
                          ) : (
                              <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none"><FileText size={48} /></div>
                          )}
                          {parsedLines.map((line, idx) => renderScriptLine(line, idx))}
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
