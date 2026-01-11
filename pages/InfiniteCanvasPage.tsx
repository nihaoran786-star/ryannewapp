
import React from 'react';
import { Palette, BoxSelect } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

export const InfiniteCanvasPage = () => {
  const { lang, t } = useGlobal();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[#F5F5F7] animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-white shadow-apple-card rounded-[32px] flex items-center justify-center mb-6 border border-white/50">
            <Palette size={48} className="text-[#007AFF]" />
        </div>
        <h2 className="text-3xl font-black text-[#1D1D1F] mb-4 uppercase tracking-tight">
            {t('infiniteCanvas')}
        </h2>
        <p className="text-[#86868B] max-w-md text-center leading-relaxed">
            {t('infiniteCanvasDesc')}
        </p>
        
        <div className="mt-8 flex gap-4">
            <div className="px-6 py-3 bg-[#E5E5EA] text-[#86868B] rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-not-allowed">
                <BoxSelect size={14} /> Node Editor (Coming Soon)
            </div>
        </div>
    </div>
  );
};
