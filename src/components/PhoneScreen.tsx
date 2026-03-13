import React, { useEffect, useRef, useState } from 'react';
import { usePhoneStream } from '../hooks/usePhoneStream';
import { useTouchController } from '../hooks/useTouchController';
import { WindowSize } from '../types/global';

const invoke = (window as any).__TAURI__?.core?.invoke || (() => Promise.resolve());

/**
 * PhoneScreen Component - Migrated to Tailwind CSS.
 */
const PhoneScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const [deviceSize, setDeviceSize] = useState<WindowSize>({ width: 390, height: 844 });
  
  // Logic: Video Streaming
  const { isConnected } = usePhoneStream(canvasRef, deviceSize);
  
  // Logic: Touch/Input Control
  const { 
    tapMarker, 
    mousePos,
    onPointerDown, 
    onPointerMove, 
    onPointerUp, 
    onPointerCancel 
  } = useTouchController(canvasRef, deviceSize);

  // Initialize Device Resolution
  useEffect(() => {
    const initDeviceInfo = async () => {
      try {
        if (!(window as any).__TAURI__) return;
        const size = await invoke("get_window_size");
        if (size) {
          setDeviceSize({ width: size.width, height: size.height });
        }
      } catch (err) {
        console.error("Failed to fetch device resolution:", err);
      }
    };
    initDeviceInfo();
  }, []);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !(window as any).__TAURI__) return;
      let key = e.key;
      if (key === "Enter") key = "\n";
      if (key === "Backspace") key = "\b";
      if (key.length === 1 || key === "\n" || key === "\b") {
        try {
          await invoke("send_keys", { key });
        } catch (err) {}
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative flex flex-col h-[85vh] aspect-[1170/2532] bg-[#1c1c1e] rounded-[48px] p-[10px] box-border shadow-[0_0_0_2px_#3a3a3c,0_10px_40px_rgba(0,0,0,0.6)] z-10">
      {/* Hardware Buttons Decoration */}
      <div className="absolute top-[12%] -left-[4px] h-[25px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
      <div className="absolute top-[18%] -left-[4px] h-[50px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
      <div className="absolute top-[25%] -left-[4px] h-[50px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
      <div className="absolute top-[20%] -right-[4px] h-[80px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
      
      {/* Notch */}
      <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[160px] h-[30px] bg-[#1c1c1e] rounded-b-[18px] z-[30] flex justify-center items-center gap-[10px]
                      before:content-[''] before:absolute before:top-0 before:w-[4px] before:h-[4px] before:bg-[#1c1c1e] before:-left-[4px] before:[mask:radial-gradient(circle_at_0%_100%,transparent_4px,#1c1c1e_4px)]
                      after:content-[''] after:absolute after:top-0 after:w-[4px] after:h-[4px] after:bg-[#1c1c1e] after:-right-[4px] after:[mask:radial-gradient(circle_at_100%_100%,transparent_4px,#1c1c1e_4px)]">
        <div className="w-[40px] h-[4px] bg-[#333] rounded-[2px] -mt-[6px]"></div>
        <div className="w-[10px] h-[10px] bg-[#050505] rounded-full relative shadow-[inset_0_0_3px_rgba(255,255,255,0.1)]
                        after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[4px] after:h-[4px] after:bg-[#0A84FF] after:rounded-full after:opacity-40 after:blur-[0.5px]"></div>
      </div>
      
      {/* Screen Container */}
      <div className="absolute inset-[10px] rounded-[38px] overflow-hidden bg-black z-[5] cursor-crosshair">
        {/* Connection Overlay */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.4)] backdrop-blur-[12px] contrast-[80%] z-[100] text-white gap-[16px] animate-[fade-in_0.4s_ease-out]">
             <div className="w-[30px] h-[30px] border-[3px] border-[rgba(255,255,255,0.1)] border-t-[var(--accent)] rounded-full animate-spin"></div>
             <span className="text-[14px] font-medium tracking-[0.5px] opacity-90">加密连接重连中...</span>
          </div>
        )}
        
        {/* Custom iOS Style Assistive Cursor */}
        <div 
          className="absolute w-[24px] h-[24px] bg-[rgba(255,255,255,0.3)] border-[1.5px] border-[rgba(255,255,255,0.5)] shadow-[0_0_10px_rgba(0,0,0,0.3)] rounded-full pointer-events-none z-[2000] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-[transform,opacity] duration-[0.05s,0.2s] ease-[linear,ease]
                     after:content-[''] after:w-[6px] after:h-[6px] after:bg-[rgba(255,255,255,0.8)] after:rounded-full" 
          style={{ left: mousePos.x, top: mousePos.y, opacity: isConnected ? 1 : 0 }} 
        />
        
        <canvas 
          id="screen-canvas"
          ref={canvasRef}
          width={deviceSize.width}
          height={deviceSize.height}
          className="cursor-none"
          style={{ 
            display: isConnected ? 'block' : 'none', 
            touchAction: 'none', 
            width: '100%', 
            height: '100%' 
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />

        {/* Visual feedback for taps */}
        {tapMarker && (
          <div className="absolute w-[40px] h-[40px] -translate-x-1/2 -translate-y-1/2 bg-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.6)] rounded-full pointer-events-none z-[1000] animate-[tap-ping_0.3s_ease-out_forwards]" 
               style={{ left: tapMarker.x, top: tapMarker.y }} />
        )}
      </div>
    </div>
  );
};

export default PhoneScreen;
