import React from 'react';
import Tooltip from './common/Tooltip';

interface FPSMonitorProps {
  fps: number;
  bitrate: number; // in bits per second
  position: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Business Component: FPS & Performance Monitor
 * Displays real-time FPS and Bitrate (formatted in KB/s or MB/s)
 */
const FPSMonitor: React.FC<FPSMonitorProps> = ({ fps, bitrate, position }) => {
  // Convert bits/s to bytes/s
  const bytesPerSec = bitrate / 8;
  
  const formatSpeed = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`;
    }
    return `${(bytes / 1024).toFixed(1)} KB/s`;
  };

  const tooltipContent = (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col">
        <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest whitespace-nowrap">实时帧率</span>
        <span className="text-[12px] font-black text-white tabular-nums leading-none mt-1">{fps} FPS</span>
      </div>
      <div className="w-full h-px bg-white/5" />
      <div className="flex flex-col">
        <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest whitespace-nowrap">实时速率</span>
        <span className="text-[12px] font-black text-white tabular-nums leading-none mt-1">
          {formatSpeed(bytesPerSec)}
        </span>
      </div>
    </div>
  );

  // Map toolbar position to tooltip direction (pop towards the screen)
  const getTooltipDirection = () => {
    switch (position) {
      case 'top': return 'bottom';
      case 'bottom': return 'top';
      case 'left': return 'right';
      case 'right': return 'left';
      default: return 'top';
    }
  };

  return (
    <Tooltip content={tooltipContent} position={getTooltipDirection()}>
      <div className="w-[32px] h-[32px] rounded-[6px] flex flex-col justify-center items-center cursor-default transition-all duration-150 hover:bg-[rgba(255,255,255,0.1)]">
        <div className={`w-1.5 h-1.5 rounded-full mb-0.5 ${fps > 25 ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-yellow-500 animate-pulse'}`} />
        <span className="text-[9px] font-black text-white/70 tabular-nums leading-none">{fps}</span>
      </div>
    </Tooltip>
  );
};

export default FPSMonitor;
