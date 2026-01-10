import React from 'react';
import { Sparkles } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

interface PlaceholderPageProps {
    titleKey: string;
    descKey: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ titleKey, descKey }) => {
  const { t } = useGlobal();
  
  return (
    <div className="h-full overflow-y-auto p-8 custom-scrollbar">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-24 h-24 bg-white/60 backdrop-blur-xl rounded-[32px] flex items-center justify-center mb-6 shadow-apple-card border border-white/50">
            <Sparkles size={40} className="text-[#007AFF]" />
            </div>
            <h2 className="text-2xl font-bold text-[#1D1D1F] mb-3 tracking-tight">{t(titleKey as any)}</h2>
            <p className="text-[#86868B] max-w-md mx-auto text-base leading-relaxed">{t(descKey as any)}</p>
            <button className="mt-8 px-6 py-2.5 bg-[#F5F5F7] text-[#86868B] rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-[#E5E5EA] transition-all cursor-default">
            {t('comingSoon')}
            </button>
        </div>
    </div>
  );
};