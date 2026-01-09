import React from 'react';

interface ProgressBarProps {
  progress: number;
  status: 'queued' | 'processing' | 'success' | 'failed';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, status }) => {
  let colorClass = 'bg-[#007AFF]';
  if (status === 'success') colorClass = 'bg-green-500';
  if (status === 'failed') colorClass = 'bg-red-500';
  if (status === 'queued') colorClass = 'bg-yellow-500';

  return (
    <div className="w-full bg-[#E5E5EA] rounded-full h-2 overflow-hidden">
      <div
        className={`${colorClass} h-2 rounded-full transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative`}
        style={{ width: `${progress}%` }}
      >
        {status === 'processing' && (
          <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite] w-full" 
               style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} 
          />
        )}
      </div>
    </div>
  );
};