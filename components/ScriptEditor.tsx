import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Plus, Save, Upload, PenTool, Layout, 
  BarChart, Mic, ChevronRight, ChevronLeft, Search, 
  Sparkles, MoreHorizontal, User, BookOpen, Loader2,
  X, Wand2, AlignLeft, Scissors, Minimize2
} from 'lucide-react';
import { ScriptProject, ScriptScene, ScriptCharacter, ScriptLine } from '../types';
import { parseScript, extractScenes, extractCharacters } from '../services/scriptUtils';
import { useGlobal } from '../context/GlobalContext';
import { callVolcChatApi, PROMPTS } from '../services/volcEngineService';

interface ScriptEditorProps {
  lang?: 'zh' | 'en'; 
  projectId?: string;
  onBack?: () => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ projectId, onBack }) => {
  const { volcSettings, t, lang } = useGlobal();
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [editorContent, setEditorContent] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  
  // UI States
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [analyzeMode, setAnalyzeMode] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Floating Toolbar State
  const [toolbarPosition, setToolbarPosition] = useState<{top: number, left: number} | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);

  // Derived State
  const activeProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
  const parsedLines = useMemo(() => parseScript(editorContent), [editorContent]);
  const scenes = useMemo(() => extractScenes(parsedLines), [parsedLines]);
  const characters = useMemo(() => extractCharacters(parsedLines), [parsedLines]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialization
  useEffect(() => {
    const saved = localStorage.getItem('sora_script_projects');
    if (saved) {
      setProjects(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
      if (activeProject) {
          setEditorContent(activeProject.content);
          setProjectTitle(activeProject.title);
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

    // Use a small timeout to allow selection to update
    setTimeout(() => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start !== end) {
            // Text is selected
            // Calculate position based on mouse event to keep it simple and near the cursor
            // Adjusting offset to appear above the cursor
            const x = e.clientX;
            const y = e.clientY;
            
            setToolbarPosition({ top: y - 60, left: x });
            setShowToolbar(true);
        } else {
            setShowToolbar(false);
        }
    }, 10);
  };

  // Hide toolbar when typing
  const handleKeyDown = () => {
    if (showToolbar) setShowToolbar(false);
  };

  const scrollToLine = (index: number) => {
      const el = document.getElementById(`script-line-${index}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (textareaRef.current) textareaRef.current.scrollTop = index * 24; 
  };

  // AI Copilot Logic
  const handleAIAction = async (action: 'EXPAND' | 'SHORTEN' | 'FORMAT') => {
    // Get selected text from textarea
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editorContent.substring(start, end);

    if (!selectedText.trim()) {
        // Should ideally not happen if toolbar is only shown on selection
        return;
    }

    if (!volcSettings.apiKey || !volcSettings.model) {
        alert(t('configureVolcAlert'));
        return;
    }

    setIsAiProcessing(true);
    try {
        const result = await callVolcChatApi(volcSettings, PROMPTS[action], selectedText);
        
        // Insert result back into editor
        const newContent = editorContent.substring(0, start) + result + editorContent.substring(end);
        setEditorContent(newContent);
        setShowToolbar(false);
    } catch (error: any) {
        alert(`${t('aiError')}: ${error.message}`);
    } finally {
        setIsAiProcessing(false);
    }
  };

  const renderSentimentChart = () => {
      if (scenes.length < 2) return null;
      const height = 60;
      const width = 240;
      const points = scenes.map((s, i) => {
          const x = (i / (scenes.length - 1)) * width;
          const y = (height / 2) - (s.sentiment * (height / 2)); 
          return `${x},${y}`;
      }).join(' ');

      return (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-1">
                      <BarChart size={12} /> {t('emotionalArc')}
                  </h4>
              </div>
              <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                  <defs>
                      <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#007AFF" stopOpacity="0.5"/>
                          <stop offset="100%" stopColor="#007AFF" stopOpacity="0"/>
                      </linearGradient>
                  </defs>
                  <path d={`M 0 ${height/2} L ${width} ${height/2}`} stroke="#E5E5EA" strokeWidth="1" strokeDasharray="4 2" />
                  <polyline points={points} fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={`M 0 ${height} L ${points} L ${width} ${height} Z`} fill="url(#gradient)" opacity="0.2" />
              </svg>
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

  if (!projectId) return <div className="flex items-center justify-center h-full text-gray-400"><p>{t('pleaseSelectProject')}</p></div>;

  return (
    <div className="flex h-full bg-[#F5F5F7] relative">
      {/* Floating Toolbar (Portal-like absolute positioning) */}
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
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleAIAction('EXPAND'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-xs font-medium"
                            title={t('expand')}
                        >
                            <Wand2 size={14} />
                            {lang === 'zh' ? '扩写' : 'Expand'}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleAIAction('SHORTEN'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-xs font-medium"
                            title={t('shorten')}
                        >
                            <Scissors size={14} />
                            {lang === 'zh' ? '缩写' : 'Shorten'}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleAIAction('FORMAT'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-xs font-medium"
                            title={t('fixFormat')}
                        >
                            <AlignLeft size={14} />
                            {lang === 'zh' ? '格式' : 'Format'}
                        </button>
                    </>
                )}
                <div className="w-[1px] h-4 bg-white/20 mx-1" />
                <button 
                    onClick={() => setShowToolbar(false)}
                    className="p-1.5 rounded-full hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={12} />
                </button>
            </div>
            {/* Arrow */}
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#1D1D1F] mt-[-1px]"></div>
        </div>
      )}

      {/* Left Panel: Navigation & Scenes */}
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
                              {scene.logline}
                          </p>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* Main Editor Area */}
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
                  <div className="text-[10px] text-[#86868B] font-mono mr-2 hidden md:block">
                      {activeProject?.lastModified ? `${t('saved')} ${new Date(activeProject.lastModified).toLocaleTimeString()}` : ''}
                  </div>
                  <button 
                    onClick={() => setAnalyzeMode(!analyzeMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${analyzeMode ? 'bg-purple-100 text-purple-600' : 'text-[#86868B] hover:bg-[#F5F5F7]'}`}
                  >
                      <Sparkles size={14} /> {t('aiAnalysis')}
                  </button>
                  <button onClick={() => setShowRightPanel(!showRightPanel)} className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-md hover:bg-[#F5F5F7]">
                      <Layout size={16}/>
                  </button>
              </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
              {/* Raw Input (Left) */}
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

              {/* Formatted Preview (Right) */}
              <div className={`flex-1 bg-white border-l border-[#E5E5EA] overflow-y-auto p-8 custom-scrollbar ${showRightPanel ? 'block' : 'hidden'}`}>
                  <div className="max-w-2xl mx-auto bg-white min-h-[800px] shadow-apple-card border border-gray-100 p-16 relative">
                      <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none"><FileText size={48} /></div>
                      {parsedLines.map((line, idx) => renderScriptLine(line, idx))}
                      {parsedLines.length === 0 && (
                          <div className="text-center text-[#86868B] mt-20">
                              <p>{t('formatPreviewHint')}</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* Right Panel: Analysis & Characters */}
      <div className={`w-72 bg-white border-l border-[#E5E5EA] flex flex-col transition-all duration-300 ${analyzeMode ? 'mr-0' : '-mr-72'}`}>
          <div className="p-4 border-b border-[#E5E5EA]">
              <h3 className="text-xs font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-500" /> {t('scriptMindsTitle')}
              </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {renderSentimentChart()}

              <h4 className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider mb-3 flex items-center gap-1">
                 <User size={12} /> {t('charactersTitle')} ({characters.length})
              </h4>
              <div className="space-y-3">
                  {characters.map(char => (
                      <div key={char.id} className="p-3 bg-[#F5F5F7] rounded-xl border border-transparent hover:border-purple-200 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-[#1D1D1F]" style={{ color: char.color }}>{char.name}</span>
                              <span className="text-[10px] bg-white px-1.5 rounded text-[#86868B]">{char.dialogueCount} {t('lines')}</span>
                          </div>
                          <p className="text-[10px] text-[#86868B] italic leading-tight">"{char.motivation}"</p>
                      </div>
                  ))}
              </div>

              {/* Removed the static Volc Copilot box from here */}
              <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <Minimize2 size={20} />
                  </div>
                  <p className="text-[11px] text-[#86868B]">
                    {lang === 'zh' 
                        ? '选中编辑器中的文本以唤起 AI 助手' 
                        : 'Highlight text in editor to summon AI tools'}
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
};