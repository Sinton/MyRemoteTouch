import React from 'react';
import { useAppStore } from '../store/useAppStore';

interface MoreOptionsProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  show: boolean;
  onClose: () => void;
}

const MoreOptions: React.FC<MoreOptionsProps> = ({ position, show, onClose }) => {
  const {
    screenOrientation, setScreenOrientation,
    isRecording, setIsRecording
  } = useAppStore();

  if (!show) return null;

  const toggleRotation = () => {
    setScreenOrientation(screenOrientation === 'portrait' ? 'landscape' : 'portrait');
    onClose();
  };

  const handleScreenshot = () => {
    console.log("Screenshot requested");
    onClose();
  };

  const handlePhone = () => {
    console.log("Phone requested");
    onClose();
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    onClose();
  };

  return (
    <div
      className={`absolute flex gap-2 p-[8px] bg-[rgba(35,35,35,0.95)] backdrop-blur-3xl border border-white/10 rounded-[12px] shadow-2xl z-[110] animate-in fade-in zoom-in duration-200
        ${position === 'top' ? 'top-12 left-1/2 -translate-x-1/2 flex-row' :
          position === 'bottom' ? 'bottom-12 left-1/2 -translate-x-1/2 flex-row' :
            position === 'left' ? 'left-12 top-1/2 -translate-y-1/2 flex-col' :
              'right-12 top-1/2 -translate-y-1/2 flex-col'}`}
    >
      {/* 标准循环图标 (Standard Refresh/Rotate Icon) */}
      <button
        onClick={toggleRotation}
        className="w-8 h-8 rounded-[6px] flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all active:scale-90"
        title="Rotate Screen"
      >
        <svg className={`w-[18px] h-[18px] transition-transform duration-500 ${screenOrientation === 'landscape' ? 'rotate-90 text-[#0A84FF]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
      </button>

      {/* Screenshot */}
      <button
        onClick={handleScreenshot}
        className="w-8 h-8 rounded-[6px] flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all active:scale-90"
        title="Screenshot"
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
      </button>

      {/* Phone Action */}
      <button
        onClick={handlePhone}
        className="w-8 h-8 rounded-[6px] flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all active:scale-90"
        title="Phone Actions"
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </button>

      {/* Recording */}
      <button
        onClick={toggleRecording}
        className={`w-8 h-8 rounded-[6px] flex items-center justify-center transition-all active:scale-90 ${isRecording ? 'text-red-500 bg-red-500/10' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      >
        {isRecording ? (
          <div className="relative flex items-center justify-center">
            <div className="absolute w-5 h-5 bg-red-500/20 rounded-full animate-ping" />
            <div className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
          </div>
        ) : (
          <div className="w-3 h-3 rounded-full border-2 border-current shadow-[0_0_8px_currentColor]" />
        )}
      </button>
    </div>
  );
};

export default MoreOptions;
