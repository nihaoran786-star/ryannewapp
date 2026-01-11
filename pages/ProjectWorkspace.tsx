
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  FileText, LayoutTemplate, Clapperboard, ChevronRight
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

const { NavLink, Outlet, useParams, Link } = ReactRouterDOM as any;

export const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const { lang } = useGlobal();

  const navItems = [
    { path: 'script', label: lang === 'zh' ? '剧本分析' : 'Script Analysis', icon: <FileText size={16} /> },
    { path: 'storyboard', label: lang === 'zh' ? '分镜管理' : 'Storyboard', icon: <LayoutTemplate size={16} /> },
    { path: 'director', label: lang === 'zh' ? '导演操作台' : 'Director Console', icon: <Clapperboard size={16} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F5F5F7]">
      {/* Project Level Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between shrink-0 h-14 z-20">
         <div className="flex items-center gap-2 text-sm text-gray-500">
             <Link to="/projects" className="hover:text-[#007AFF] font-medium transition-colors">
                 {lang === 'zh' ? '项目' : 'Projects'}
             </Link>
             <ChevronRight size={14} />
             <span className="text-[#1D1D1F] font-bold">Workspace</span>
         </div>

         {/* Navigation Tabs */}
         <div className="flex bg-[#F5F5F7] p-1 rounded-xl">
             {navItems.map(item => (
                 <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }: { isActive: boolean }) => `
                        flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200
                        ${isActive 
                            ? 'bg-white text-[#007AFF] shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                    `}
                 >
                    {item.icon}
                    {item.label}
                 </NavLink>
             ))}
         </div>

         <div className="w-20" /> {/* Spacer for balance */}
      </div>

      {/* Workspace Content */}
      <div className="flex-1 overflow-hidden relative">
          <Outlet />
      </div>
    </div>
  );
};
