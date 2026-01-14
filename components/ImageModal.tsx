
import React, { useState } from 'react';
import { X, ZoomIn, Download, ExternalLink } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
  title?: string;
  metadata?: React.ReactNode;
}

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, imageUrl, onClose, title, metadata }) => {
  const [isZoomed, setIsZoomed] = useState(false);

  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button 
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-[110]"
        onClick={onClose}
      >
        <X size={24} />
      </button>

      <div 
        className="w-full h-full flex flex-col p-4 md:p-8" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || metadata) && (
             <div className="absolute top-6 left-6 z-[110] max-w-lg pointer-events-none">
                 {title && <h3 className="text-white font-bold text-lg drop-shadow-md">{title}</h3>}
                 {metadata && <div className="mt-2">{metadata}</div>}
             </div>
        )}

        {/* Image Container */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden group">
            <img 
              src={imageUrl} 
              className={`
                transition-transform duration-300 ease-out cursor-zoom-in 
                ${isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 max-h-[85vh] max-w-full object-contain shadow-2xl'}
              `}
              onClick={() => setIsZoomed(!isZoomed)}
              alt="Fullscreen Preview"
            />
        </div>

        {/* Footer Actions */}
        <div className="h-16 flex items-center justify-center gap-4 mt-4">
            <button 
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
              title={isZoomed ? "Zoom Out" : "Zoom In"}
            >
                <ZoomIn size={20} />
            </button>
            <a 
              href={imageUrl} 
              download 
              className="p-3 rounded-full bg-white text-black hover:bg-gray-200 transition-all shadow-lg font-bold flex items-center gap-2 px-6"
            >
                <Download size={18} /> Download
            </a>
            <a 
              href={imageUrl} 
              target="_blank" 
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
              title="Open Original"
            >
                <ExternalLink size={20} />
            </a>
        </div>
      </div>
    </div>
  );
};
