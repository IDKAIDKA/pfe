
import React from 'react';

interface HumanMeterProps {
  score: number;
  label: string;
}

export const HumanMeter: React.FC<HumanMeterProps> = ({ score, label }) => {
  const getGradient = () => {
    if (score > 80) return 'from-green-400 to-green-600 shadow-green-200';
    if (score > 60) return 'from-yellow-400 to-yellow-600 shadow-yellow-200';
    return 'from-red-400 to-red-600 shadow-red-200';
  };

  return (
    <div className="flex flex-col gap-1 w-full max-w-[120px]">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider opacity-70">
        <span>{label}</span>
        <span>{Math.round(score)}%</span>
      </div>
      <div className="h-2 w-full bg-black/10 rounded-full overflow-hidden shadow-inner">
        <div 
          className={`h-full bg-gradient-to-r transition-all duration-700 ease-out rounded-full shadow-lg ${getGradient()}`} 
          style={{ width: `${score}%` }} 
        />
      </div>
    </div>
  );
};
