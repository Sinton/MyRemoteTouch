import React from 'react';
import PhoneScreen from './PhoneScreen';
import { useAppStore } from '../store/useAppStore';

/**
 * Phone Component - The Physical Shell
 * Defines the bezel, notch, hardware buttons, and the viewing slot.
 */
interface PhoneProps {
  deviceSize: { width: number, height: number };
  toolbarPosition: 'top' | 'bottom' | 'left' | 'right';
  setFps: (fps: number) => void;
  setBitrate: (bitrate: number) => void;
  children?: React.ReactNode;
}

const Phone: React.FC<PhoneProps> = ({ 
  deviceSize, 
  toolbarPosition,
  setFps,
  setBitrate,
  children
}) => {
  const { screenOrientation } = useAppStore();
  const isLandscape = screenOrientation === 'landscape';
  const isModernFullClient = deviceSize.height / deviceSize.width > 2.0;
  const portraitWidth = Math.min(deviceSize.width, deviceSize.height);
  const portraitHeight = Math.max(deviceSize.width, deviceSize.height);

  return (
    <div
      className={`relative flex flex-col bg-[#1c1c1e] rounded-[48px] p-[10px] box-border shadow-[0_0_0_2px_#3a3a3c,0_10px_40px_rgba(0,0,0,0.6)] z-10 transition-all duration-500 origin-center
        ${isLandscape ? '-rotate-90' : 'rotate-0'}
        ${(toolbarPosition === 'left' || toolbarPosition === 'right') ? 'h-[97vh]' : 'h-[91vh]'}`}
      style={{
        aspectRatio: `${portraitWidth} / ${portraitHeight}`
      }}
    >
      {/* Hardware Buttons Decoration */}
      {isModernFullClient && (
        <>
          <div className="absolute top-[12%] -left-[4px] h-[25px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
          <div className="absolute top-[18%] -left-[4px] h-[50px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
          <div className="absolute top-[25%] -left-[4px] h-[50px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
          <div className="absolute top-[20%] -right-[4px] h-[80px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
        </>
      )}

      {/* Notch - Overlap 2px to close gaps */}
      {isModernFullClient && (
        <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[160px] h-[32px] bg-[#1c1c1e] rounded-b-[18px] z-[30] flex justify-center items-center gap-[10px]
                        before:content-[''] before:absolute before:top-0 before:w-[4px] before:h-[4px] before:bg-[#1c1c1e] before:-left-[4px] before:[mask:radial-gradient(circle_at_0%_100%,transparent_4px,#1c1c1e_4px)]
                        after:content-[''] after:absolute after:top-0 after:w-[4px] after:h-[4px] after:bg-[#1c1c1e] after:-right-[4px] after:[mask:radial-gradient(circle_at_100%_100%,transparent_4px,#1c1c1e_4px)]">
          <div className="w-[40px] h-[4px] bg-[#333] rounded-[2px] -mt-[6px]"></div>
          <div className="w-[10px] h-[10px] bg-[#050505] rounded-full relative shadow-[inset_0_0_3px_rgba(255,255,255,0.1)]
                          after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[4px] after:h-[4px] after:bg-[#0A84FF] after:rounded-full after:opacity-40 after:blur-[0.5px]"></div>
        </div>
      )}

      {/* Screen Viewport Slot */}
      <div className="relative w-full h-full overflow-hidden rounded-[38px] bg-black">
        <PhoneScreen 
          position={toolbarPosition}
          setFpsState={setFps}
          setBitrateState={setBitrate}
        />
        {children}
      </div>
    </div>
  );
};

export default Phone;
