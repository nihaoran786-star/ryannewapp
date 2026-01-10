

import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  Plus, Search, Film, Tv, MonitorPlay, Calendar, 
  ArrowRight, FileText, Clapperboard, PlusCircle, X,
  FolderOpen, LayoutTemplate
} from 'lucide-react';
import { ScriptProject } from '../types';
import { MOCK_INITIAL_SCRIPT } from '../services/scriptUtils';
import { useGlobal } from '../context/GlobalContext';

const { useNavigate } = ReactRouterDOM as any;

export const ProjectsPage = () => {
  const { lang, t } = useGlobal();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Project Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ScriptProject['type']>('movie');

  // Load Projects
  useEffect(() => {
    const saved = localStorage.getItem('sora_script_projects');
    if (saved) {
      setProjects(JSON.parse(saved));
    } else {
      // Initialize with seed data if empty
      const defaultProj: ScriptProject = {
        id: 'proj-1',
        title: 'Untitled Masterpiece',
        type: 'movie',
        lastModified: Date.now(),
        content: MOCK_INITIAL_SCRIPT
      };
      setProjects([defaultProj]);
      localStorage.setItem('sora_script_projects', JSON.stringify([defaultProj]));
    }
  }, []);

  // Handle modal open
  useEffect(() => {
    if (isCreateModalOpen) {
      setNewTitle('');
      setNewType('movie');
    }
  }, [isCreateModalOpen]);

  const handleCreateProject = () => {
    if (!newTitle.trim()) return;

    const newProj: ScriptProject = {
      id: `proj-${Date.now()}`,
      title: newTitle,
      type: newType,
      lastModified: Date.now(),
      content: ''
    };

    const updatedProjects = [newProj, ...projects];
    setProjects(updatedProjects);
    localStorage.setItem('sora_script_projects', JSON.stringify(updatedProjects));
    
    setIsCreateModalOpen(false);
    // Navigate immediately to the new project
    navigate(`/script/${newProj.id}`);
  };

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIconForType = (type: string) => {
    switch (type) {
      case 'movie': return <Film size={16} />;
      case 'series': return <Tv size={16} />;
      case 'short': return <MonitorPlay size={16} />;
      default: return <FileText size={16} />;
    }
  };

  // Helper for the main card icon
  const getLargeIconForType = (type: string) => {
    switch (type) {
        case 'movie': return <Clapperboard size={24} />;
        case 'series': return <Tv size={24} />;
        default: return <MonitorPlay size={24} />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'movie': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'series': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'short': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="h-full bg-[#F5F5F7] overflow-hidden flex flex-col relative">
      
      {/* Top Header / Toolbar */}
      <div className="px-8 py-6 flex items-center justify-between shrink-0">
         <div>
            <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">{t('projects')}</h1>
            <p className="text-[#86868B] text-sm mt-1">{lang === 'zh' ? '管理您的所有创意剧本' : 'Manage your creative screenplays'}</p>
         </div>
         <div className="flex items-center gap-4">
             {/* Search Bar */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#007AFF] transition-colors" size={16} />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'zh' ? '搜索项目...' : 'Search projects...'}
                className="pl-10 pr-4 py-2.5 bg-white border border-[rgba(0,0,0,0.05)] rounded-full text-sm w-64 focus:ring-2 focus:ring-[#007AFF]/20 outline-none transition-all shadow-sm focus:w-80"
              />
            </div>
         </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          {filteredProjects.length > 0 || searchQuery ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Create New Card (Visual Shortcut) - Only show if not searching */}
                {!searchQuery && (
                    <div 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="group border border-dashed border-gray-300 rounded-[24px] p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 hover:border-[#007AFF] transition-all duration-300 min-h-[220px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-[#F5F5F7] group-hover:bg-[#007AFF]/10 flex items-center justify-center mb-4 transition-colors">
                            <Plus size={32} className="text-[#86868B] group-hover:text-[#007AFF] transition-colors" />
                        </div>
                        <span className="font-bold text-[#86868B] group-hover:text-[#007AFF] transition-colors">
                            {lang === 'zh' ? '创建新项目' : 'Create New Project'}
                        </span>
                    </div>
                )}

                {/* Project Cards */}
                {filteredProjects.map(project => (
                <div 
                    key={project.id}
                    onClick={() => navigate(`/script/${project.id}`)}
                    className="group bg-white rounded-[24px] p-6 shadow-apple-card hover:shadow-apple-hover border border-[rgba(0,0,0,0.05)] cursor-pointer transition-all duration-300 relative overflow-hidden hover:-translate-y-1 min-h-[220px] flex flex-col"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5F5F7] to-[#E5E5EA] flex items-center justify-center text-[#86868B] group-hover:text-[#007AFF] transition-colors shadow-inner shrink-0">
                            {getLargeIconForType(project.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-bold text-[#1D1D1F] line-clamp-1 group-hover:text-[#007AFF] transition-colors">
                            {project.title}
                            </h3>
                            <span className="text-[10px] text-[#86868B] flex items-center gap-1 mt-1">
                                <Calendar size={10} />
                                {formatDate(project.lastModified)}
                            </span>
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 uppercase tracking-wide ${getBadgeColor(project.type)}`}>
                            {getIconForType(project.type)}
                            {project.type}
                        </span>
                    </div>

                    <p className="text-xs text-[#86868B] line-clamp-2 leading-relaxed bg-[#F5F5F7]/50 p-3 rounded-xl border border-dashed border-gray-200 flex-1 mb-4">
                      {project.content ? project.content.slice(0, 100) : (lang === 'zh' ? '暂无内容...' : 'No content...')}
                    </p>

                    <div className="flex gap-2 mt-auto">
                        <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/script/${project.id}`); }}
                            className="flex-1 py-2 rounded-lg bg-[#F5F5F7] text-xs font-bold text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#E5E5EA] transition-all"
                        >
                            {lang === 'zh' ? '编辑剧本' : 'Edit Script'}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/storyboard`); }}
                            className="flex-1 py-2 rounded-lg bg-[#007AFF]/10 text-xs font-bold text-[#007AFF] hover:bg-[#007AFF] hover:text-white transition-all flex items-center justify-center gap-1"
                        >
                            <LayoutTemplate size={12} />
                            {lang === 'zh' ? '分镜台' : 'Storyboard'}
                        </button>
                    </div>
                </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-60 h-full">
               <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                 <FolderOpen size={48} className="text-gray-300" />
               </div>
               <h3 className="text-xl font-bold text-[#1D1D1F] mb-2">{lang === 'zh' ? '暂无剧本' : 'No Projects Yet'}</h3>
               <p className="text-[#86868B] font-medium mb-6">{lang === 'zh' ? '开始您的第一个创意创作' : 'Start your first masterpiece'}</p>
               <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-[#007AFF] hover:bg-[#0066CC] text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95"
               >
                  {lang === 'zh' ? '立即创建' : 'Create Now'}
               </button>
            </div>
          )}
      </div>

      {/* Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-[#F5F5F7]/60 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={() => setIsCreateModalOpen(false)} 
            />
            
            {/* Modal Window */}
            <div className="relative bg-white/90 backdrop-blur-2xl border border-white/50 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 ring-1 ring-black/5">
                <div className="p-6 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between bg-white/50">
                    <h2 className="text-lg font-bold text-[#1D1D1F] flex items-center gap-2">
                        <PlusCircle className="text-[#007AFF]" size={20} />
                        {lang === 'zh' ? '新建剧本' : 'New Project'}
                    </h2>
                    <button 
                        onClick={() => setIsCreateModalOpen(false)}
                        className="w-8 h-8 flex items-center justify-center bg-[#E5E5EA] hover:bg-[#D1D1D6] rounded-full text-[#86868B] hover:text-[#1D1D1F] transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                     <div className="space-y-3">
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider ml-1">{lang === 'zh' ? '剧本名称' : 'Project Title'}</label>
                        <input 
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder={lang === 'zh' ? '例如：黑客帝国前传...' : 'e.g. The Matrix Zero...'}
                            className="w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-4 text-base text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/20 outline-none transition-all shadow-inner"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider ml-1">{lang === 'zh' ? '类型' : 'Format'}</label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['movie', 'series', 'short'] as const).map(type => (
                                <button
                                key={type}
                                onClick={() => setNewType(type)}
                                className={`py-4 px-2 rounded-2xl text-xs font-bold uppercase transition-all flex flex-col items-center gap-2 border
                                    ${newType === type 
                                        ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-lg shadow-blue-500/20' 
                                        : 'bg-white text-[#86868B] border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                                >
                                {getIconForType(type)}
                                {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4">
                        <button 
                            onClick={handleCreateProject}
                            disabled={!newTitle.trim()}
                            className={`w-full py-4 rounded-xl font-bold text-sm transition-all transform active:scale-95 shadow-xl 
                            ${!newTitle.trim() 
                                ? 'bg-[#E5E5EA] text-[#86868B] cursor-not-allowed shadow-none' 
                                : 'bg-[#1D1D1F] hover:bg-black text-white shadow-black/20'}`}
                        >
                            {lang === 'zh' ? '创建并开始创作' : 'Create & Open Editor'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};