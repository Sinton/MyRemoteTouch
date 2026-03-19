import React from 'react';
import FPSMonitor from './FPSMonitor';
import MoreOptions from './MoreOptions';
import { useAppStore } from '../store/useAppStore';

type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right';

interface ToolbarProps {
  onSettingsClick: () => void;
  onSmartTaskClick: () => void;
  isSmartTaskActive: boolean;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  position: ToolbarPosition;
  isDragging: boolean;
  onHomeClick: () => void;
  onMuteClick: () => void;
  onVolumeUpClick: () => void;
  onVolumeDownClick: () => void;
  onLockClick: () => void;
  isProcessingHardware?: boolean;
  fps: number;
  bitrate: number;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onSettingsClick, 
  onSmartTaskClick,
  isSmartTaskActive,
  onDragStart, 
  position, 
  isDragging, 
  onHomeClick,
  onMuteClick,
  onVolumeUpClick,
  onVolumeDownClick,
  onLockClick,
  isProcessingHardware = false,
  fps,
  bitrate
}) => {
  const { lowLatencyMode } = useAppStore();
  const [showMore, setShowMore] = React.useState(false);
  const isVertical = position === 'left' || position === 'right';

  return (
    <div 
      className={`flex bg-[rgba(40,40,40,0.85)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.1)] shadow-[0_4px_15px_rgba(0,0,0,0.5)] rounded-[12px] items-center z-[100] transition-opacity duration-300
        ${isVertical ? 'flex-col py-[16px] px-[8px]' : 'py-[8px] px-[16px] gap-[12px]'} 
        ${isDragging ? 'opacity-60 cursor-grabbing' : ''}`}
    >
      <div 
        className={`bg-[radial-gradient(circle,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-[length:4px_4px] cursor-grab
          ${isVertical ? 'w-[20px] h-[12px] mb-[8px]' : 'w-[12px] h-[20px] mr-[4px]'}`} 
        onMouseDown={onDragStart}
      ></div>
      
      <div className={`flex items-center gap-[12px] ${isVertical ? 'flex-col' : ''}`}>
        <button 
          className={`bg-transparent border-none text-[#d1d1d6] w-[32px] h-[32px] rounded-[6px] flex justify-center items-center transition-all duration-150 ${isProcessingHardware ? 'cursor-wait opacity-50' : 'cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-white active:scale-95'}`}
          title="Home" 
          onClick={onHomeClick}
          disabled={isProcessingHardware}
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
        </button>
        
        <button 
          className={`bg-transparent border-none text-[#d1d1d6] w-[32px] h-[32px] rounded-[6px] flex justify-center items-center transition-all duration-150 ${isProcessingHardware ? 'cursor-wait opacity-50' : 'cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-white active:scale-95'}`}
          title="Lock" 
          onClick={onLockClick}
          disabled={isProcessingHardware}
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </button>

        <button 
          className="bg-transparent border-none text-[#d1d1d6] w-[32px] h-[32px] rounded-[6px] flex justify-center items-center cursor-not-allowed opacity-50 transition-all duration-150" 
          title="Mute (iOS physical switch - not supported)" 
          disabled
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4l16 16"></path>
          </svg>
        </button>

        <button 
          className={`bg-transparent border-none text-[#d1d1d6] w-[32px] h-[32px] rounded-[6px] flex justify-center items-center transition-all duration-150 ${isProcessingHardware ? 'cursor-wait opacity-50' : 'cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-white active:scale-95'}`}
          title="Volume Up" 
          onClick={onVolumeUpClick}
          disabled={isProcessingHardware}
        >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
        </button>

        <button 
          className={`bg-transparent border-none text-[#d1d1d6] w-[32px] h-[32px] rounded-[6px] flex justify-center items-center transition-all duration-150 ${isProcessingHardware ? 'cursor-wait opacity-50' : 'cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-white active:scale-95'}`}
          title="Volume Down" 
          onClick={onVolumeDownClick}
          disabled={isProcessingHardware}
        >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
        </button>

        {/* Extension Groups (FPS & More) */}
        <div className={`flex items-center gap-[12px] ${isVertical ? 'flex-col' : ''}`}>
          {!lowLatencyMode && (
            <FPSMonitor fps={fps} bitrate={bitrate} position={position} />
          )}

          {/* More Options Section */}
          <div className="relative flex items-center justify-center">
            <button 
              className={`w-[32px] h-[32px] rounded-[6px] flex justify-center items-center transition-all duration-150 cursor-pointer active:scale-95
                ${showMore ? 'bg-[#0A84FF] text-white shadow-[0_0_10px_rgba(10,132,255,0.4)]' : 'bg-transparent text-[#d1d1d6] hover:bg-[rgba(255,255,255,0.1)] hover:text-white'}`}
              title="More Options"
              onClick={() => setShowMore(!showMore)}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path>
              </svg>
            </button>
            
            <MoreOptions 
              position={position} 
              show={showMore} 
              onClose={() => setShowMore(false)} 
            />
          </div>
        </div>

        {/* Permanent System Divider */}
        <div className={`bg-[rgba(255,255,255,0.2)] mx-[4px] ${isVertical ? 'w-[16px] h-[1px] my-[4px]' : 'w-[1px] h-[16px]'}`}></div>

        <button 
          className={`bg-transparent border-none w-[32px] h-[32px] rounded-[6px] flex justify-center items-center cursor-pointer transition-all duration-150 relative active:scale-95
            ${isSmartTaskActive ? 'text-white bg-purple-500/30' : 'text-[#d1d1d6] hover:bg-[rgba(255,255,255,0.1)] hover:text-white'}`} 
          title="SmartTask Automation" 
          onClick={onSmartTaskClick}
        >
          {isSmartTaskActive && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
          </span>}
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>

        <button className="bg-transparent border-none text-[#d1d1d6] w-[32px] h-[32px] rounded-[6px] flex justify-center items-center cursor-pointer transition-all duration-150 hover:bg-[rgba(255,255,255,0.1)] hover:text-white active:scale-95" title="Settings" onClick={onSettingsClick}>
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
