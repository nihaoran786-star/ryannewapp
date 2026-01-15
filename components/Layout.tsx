
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  FolderKanban, Database, Film, UserRoundSearch, LogOut, Settings, 
  Server, X, Globe, Key, PlusCircle, Trash2, LayoutTemplate, 
  Flame, BrainCircuit, Sparkle, Clapperboard, Check, Palette,
  PanelLeftClose, PanelLeftOpen, Languages
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { Channel } from '../types';

const { NavLink, Outlet, useLocation } = ReactRouterDOM as any;

export const Layout = () => {
  const { 
    t, lang, setLang, activeChannel, showSettings, setShowSettings, 
    channels, activeChannelId, setActiveChannelId, 
    updateChannel, deleteChannel, addChannel,
    volcSettings, setVolcSettings
  } = useGlobal();
  
  const location = useLocation();
  const currentPath = location.pathname.split('/')[1] || 'director';
  const isProjectActive = currentPath === 'projects' || currentPath === 'script' || currentPath === 'project';

  const [newChannel, setNewChannel] = useState({ name: '', baseUrl: '', apiToken: '' });
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleAddChannel = () => {
    if (!newChannel.name || !newChannel.baseUrl || !newChannel.apiToken) return;
    const channel: Channel = {
      ...newChannel,
      id: Date.now().toString()
    };
    addChannel(channel);
    setNewChannel({ name: '', baseUrl: '', apiToken: '' });
    setIsAddingChannel(false);
  };

  const renderSidebarItem = (path: string, icon: React.ReactNode, label: string, forceActive: boolean = false) => (
    <NavLink
      to={`/${path}`}
      className={({ isActive }: { isActive: boolean }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        isActive || forceActive
          ? 'bg-[#007AFF]/10 text-[#007AFF] font-semibold' 
          : 'text-gray-500 hover:text-[#1D1D1F] hover:bg-black/5'
      } ${isCollapsed ? 'justify-center' : ''}`}
      title={isCollapsed ? label : ''}
    >
      <div className={`${forceActive || location.pathname.startsWith(`/${path}`) ? 'text-[#007AFF]' : 'text-gray-400 group-hover:text-gray-600'} transition-colors shrink-0`}>
        {icon}
      </div>
      {!isCollapsed && <span className="text-[13px] tracking-wide whitespace-nowrap overflow-hidden">{label}</span>}
    </NavLink>
  );

  return (
    <div className="flex h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans overflow-hidden selection:bg-[#007AFF]/20">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? 'w-[80px]' : 'w-[280px]'} bg-white/80 backdrop-blur-2xl border-r border-[rgba(0,0,0,0.05)] flex flex-col shrink-0 z-50 transition-[width] duration-300 ease-in-out`}>
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className={`flex items-center mb-10 ${isCollapsed ? 'justify-center flex-col gap-2' : 'gap-3 pl-2'}`}>
            <div className="bg-gradient-to-tr from-[#007AFF] to-[#5856D6] p-2 rounded-[14px] shadow-lg shadow-blue-500/20 shrink-0 cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
              <Sparkle className="text-white w-5 h-5" />
            </div>
            {!isCollapsed && (
                <div className="animate-in fade-in duration-300 overflow-hidden whitespace-nowrap">
                  <h1 className="text-base font-bold text-[#1D1D1F] leading-tight tracking-tight">
                    {t('title')}
                  </h1>
                  <span className="text-[10px] text-[#007AFF] font-bold tracking-wider uppercase bg-[#007AFF]/10 px-1.5 py-0.5 rounded">{t('enterprise')}</span>
                </div>
            )}
          </div>

          <nav className="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {!isCollapsed && <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-3 mb-2 animate-in fade-in">{t('mainNav')}</div>}
            {isCollapsed && <div className="h-4" />} {/* Spacer for collapsed mode */}
            {renderSidebarItem('projects', <FolderKanban size={18} strokeWidth={2} />, t('projects'), isProjectActive)}
            {renderSidebarItem('assets', <Database size={18} strokeWidth={2} />, t('assets'))}
            
            <div className={`${isCollapsed ? 'pt-4 border-t border-gray-100 mt-4' : 'pt-6'}`}>
              {!isCollapsed && <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-3 mb-2 animate-in fade-in">{t('postProd')}</div>}
              {renderSidebarItem('movie-recreation', <Film size={18} strokeWidth={2} />, t('movieRec'))}
              {renderSidebarItem('digital-human', <UserRoundSearch size={18} strokeWidth={2} />, t('digitalHuman'))}
            </div>

            <div className={`${isCollapsed ? 'pt-4 border-t border-gray-100 mt-4' : 'pt-6 mt-auto'}`}>
              {!isCollapsed && <div className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider px-3 mb-2 animate-in fade-in">{t('creationTools')}</div>}
              {renderSidebarItem('director', <Clapperboard size={18} strokeWidth={2} />, lang === 'zh' ? '创作中心' : 'Studio Hub')}
              {renderSidebarItem('infinite-canvas', <Palette size={18} strokeWidth={2} />, t('infiniteCanvas'))}
            </div>
          </nav>
        </div>

        <div className="p-6 space-y-4">
           {!isCollapsed ? (
               <>
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-[rgba(0,0,0,0.04)] shadow-sm animate-in fade-in">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${activeChannel?.apiToken ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-yellow-500'}`} />
                            <span className="text-xs font-semibold text-[#1D1D1F] truncate max-w-[120px]">{activeChannel?.name || t('noChannel')}</span>
                        </div>
                        <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-black/5 rounded-lg text-[#86868B] hover:text-[#1D1D1F] transition-colors">
                            <Settings size={14} />
                        </button>
                    </div>
                    <div className="h-1 w-full bg-[#E5E5EA] rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${activeChannel?.apiToken ? 'w-full bg-green-500' : 'w-1/3 bg-yellow-500'}`} />
                    </div>
                </div>
                
                <button className="w-full flex items-center gap-3 px-3 py-2 text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 rounded-lg transition-all text-[13px] font-medium">
                    <LogOut size={16} />
                    <span>{t('logout')}</span>
                </button>
               </>
           ) : (
               <div className="flex flex-col gap-4 items-center animate-in fade-in">
                    <button onClick={() => setShowSettings(true)} className="p-2.5 bg-white shadow-sm border border-gray-100 hover:bg-black/5 rounded-xl text-[#86868B] hover:text-[#1D1D1F] transition-colors relative">
                        <Settings size={18} />
                        {activeChannel?.apiToken && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />}
                    </button>
                    <button className="p-2 text-[#86868B] hover:text-[#1D1D1F] transition-colors">
                        <LogOut size={18} />
                    </button>
               </div>
           )}
           
           {/* Collapse Toggle at bottom */}
           <button 
             onClick={() => setIsCollapsed(!isCollapsed)} 
             className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-[#007AFF] hover:bg-blue-50 rounded-lg transition-all mt-2"
             title={isCollapsed ? "Expand" : "Collapse"}
           >
               {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Outlet />
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#F5F5F7]/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowSettings(false)} />
          <div className="relative bg-white/90 backdrop-blur-2xl border border-white/50 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 ring-1 ring-black/5">
            <div className="p-6 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between bg-white/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#007AFF]/10 rounded-xl"><Settings className="text-[#007AFF] w-5 h-5" /></div>
                <div><h2 className="text-lg font-bold text-[#1D1D1F]">{t('channelModalTitle')}</h2><p className="text-xs text-[#86868B]">{t('channelModalDesc')}</p></div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center bg-[#E5E5EA] hover:bg-[#D1D1D6] rounded-full text-[#86868B] hover:text-[#1D1D1F] transition-all"><X size={16} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

              <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-gray-100 rounded-lg"><Languages className="text-gray-500 w-4 h-4" /></div>
                      <span className="text-sm font-bold text-[#1D1D1F]">{lang === 'zh' ? '系统语言' : 'System Language'}</span>
                  </div>
                  <div className="flex items-center bg-[#F5F5F7] p-1 rounded-lg">
                    <button onClick={() => setLang('zh')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${lang === 'zh' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}>中文</button>
                    <button onClick={() => setLang('en')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${lang === 'en' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}>English</button>
                  </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-white rounded-[24px] p-6 border border-orange-100/50 shadow-sm">
                 <div className="flex items-center gap-3 mb-5"><div className="p-1.5 bg-orange-100 rounded-lg"><Flame className="text-orange-600 w-4 h-4" /></div><h3 className="text-sm font-bold text-[#1D1D1F]">{t('volcSettingsTitle')}</h3></div>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2"><label className="text-[10px] uppercase font-bold text-[#86868B] ml-1">{t('model')}</label><input value={volcSettings.model} onChange={e => setVolcSettings({...volcSettings, model: e.target.value})} placeholder={t('volcModelPlaceholder')} className="w-full bg-white border border-orange-100 rounded-xl px-4 py-3 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-orange-500/20 outline-none shadow-sm" /></div>
                     <div className="space-y-2"><label className="text-[10px] uppercase font-bold text-[#86868B] ml-1">{t('apiKey')}</label><input type="password" value={volcSettings.apiKey} onChange={e => setVolcSettings({...volcSettings, apiKey: e.target.value})} placeholder={t('volcApiKeyPlaceholder')} className="w-full bg-white border border-orange-100 rounded-xl px-4 py-3 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-orange-500/20 outline-none shadow-sm" /></div>
                 </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">{t('activeChannels')}</h3>
                    <button onClick={() => setIsAddingChannel(!isAddingChannel)} className="text-[11px] text-[#007AFF] font-bold hover:underline flex items-center gap-1">
                        <PlusCircle size={12} /> {t('addChannel')}
                    </button>
                </div>

                {isAddingChannel && (
                    <div className="p-5 rounded-[20px] border border-[#007AFF] bg-blue-50/50 shadow-sm animate-in slide-in-from-top-2">
                         <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold text-[#007AFF] uppercase">{lang === 'zh' ? '新节点配置' : 'New Node Config'}</h4>
                            <button onClick={() => setIsAddingChannel(false)} className="text-[#86868B] hover:text-red-500"><X size={14} /></button>
                         </div>
                         <div className="grid gap-3">
                             <input value={newChannel.name} onChange={e => setNewChannel({...newChannel, name: e.target.value})} placeholder={t('label')} className="bg-white border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#007AFF]/20 outline-none" />
                             <input value={newChannel.baseUrl} onChange={e => setNewChannel({...newChannel, baseUrl: e.target.value})} placeholder={t('endpoint')} className="bg-white border-none rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-[#007AFF]/20 outline-none" />
                             <input value={newChannel.apiToken} onChange={e => setNewChannel({...newChannel, apiToken: e.target.value})} placeholder={t('apiKey')} className="bg-white border-none rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-[#007AFF]/20 outline-none" type="password" />
                             <button onClick={handleAddChannel} disabled={!newChannel.name || !newChannel.baseUrl || !newChannel.apiToken} className="w-full bg-[#007AFF] text-white rounded-xl py-2.5 text-sm font-bold shadow-md hover:bg-[#0066CC] disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2">
                                {t('saveChannel')}
                             </button>
                         </div>
                    </div>
                )}

                <div className="grid gap-4">
                  {channels.map(c => (
                    <div key={c.id} className={`p-5 rounded-[20px] border transition-all flex flex-col gap-4 ${c.id === activeChannelId ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-3 mb-2"><input value={c.name} onChange={(e) => updateChannel(c.id, { name: e.target.value })} className="bg-transparent border-none text-[#1D1D1F] font-bold p-0 focus:ring-0 w-full outline-none text-base" /></div><div className="flex items-center gap-2 text-[11px] text-[#86868B] font-mono bg-[#F5F5F7] w-fit px-2 py-1 rounded-md"><Globe size={12} className="text-[#007AFF]" /><input value={c.baseUrl} onChange={(e) => updateChannel(c.id, { baseUrl: e.target.value })} className="bg-transparent border-none p-0 focus:ring-0 w-full outline-none text-[#86868B]" /></div></div>
                        <div className="flex items-center gap-2"><button onClick={() => setActiveChannelId(c.id)} disabled={c.id === activeChannelId} className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${c.id === activeChannelId ? 'bg-[#007AFF] text-white shadow-md' : 'bg-[#E5E5EA] text-[#86868B] hover:bg-[#D1D1D6]'}`}>{c.id === activeChannelId ? t('current') : t('select')}</button><button onClick={() => deleteChannel(c.id)} className="p-2 text-[#86868B] hover:text-red-500 transition-colors"><Trash2 size={16} /></button></div>
                      </div>
                      <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-[10px] uppercase font-bold text-[#86868B] flex items-center gap-1.5 tracking-wider"><Key size={12} /> {t('apiKey')}</label></div><input type="password" value={c.apiToken} onChange={(e) => updateChannel(c.id, { apiToken: e.target.value })} placeholder="sk-..." className="w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/20 outline-none transition-all" /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
