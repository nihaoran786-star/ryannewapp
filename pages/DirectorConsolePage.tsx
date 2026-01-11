
import React from 'react';
import { Clapperboard, Sparkles } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

export const DirectorConsolePage = () => {
  const { lang } = useGlobal();
  
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[#F5F5F7] animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-white shadow-apple-card rounded-[32px] flex items-center justify-center mb-6">
            <Clapperboard size={48} className="text-[#007AFF]" />
        </div>
        <h2 className="text-3xl font-black text-[#1D1D1F] mb-4 uppercase tracking-tight">
            {lang === 'zh' ? '导演操作台' : 'Director Console'}
        </h2>
        <p className="text-[#86868B] max-w-md text-center leading-relaxed">
            {lang === 'zh' 
                ? '在此模块中，您将批量生成分镜图像，进行镜头筛选、重绘与最终剪辑合成。功能即将上线。' 
                : 'In this module, you will batch generate storyboard images, review shots, in-paint, and assemble the final cut. Coming soon.'}
        </p>
        
        <div className="mt-8 flex gap-4">
            <button disabled className="px-6 py-3 bg-[#E5E5EA] text-[#86868B] rounded-full text-xs font-bold uppercase tracking-wider cursor-not-allowed">
                Batch Generation
            </button>
            <button disabled className="px-6 py-3 bg-[#E5E5EA] text-[#86868B] rounded-full text-xs font-bold uppercase tracking-wider cursor-not-allowed">
                Timeline Editor
            </button>
        </div>
    </div>
  );
};
