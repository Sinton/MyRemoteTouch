import React, { useEffect, useRef, useState } from 'react';
import { usePhoneStream } from '../hooks/usePhoneStream';
import { useTouchController } from '../hooks/useTouchController';
import { WindowSize } from '../types/global';
import { DeviceService } from '../services/deviceService';
import { useAppStore } from '../store/useAppStore';

/**
 * PhoneScreen Component - Migrated to Tailwind CSS.
 */
interface PhoneScreenProps {
  position?: 'top' | 'bottom' | 'left' | 'right';
  setFpsState?: (fps: number) => void;
  setBitrateState?: (bitrate: number) => void;
}

const PhoneScreen: React.FC<PhoneScreenProps> = ({ 
  position = 'bottom',
  setFpsState,
  setBitrateState
}) => {
  // Canvas refs with clear naming
  const renderCanvasRef = useRef<HTMLCanvasElement>(null!);  // Standard mode: Worker renders here
  const touchCanvasRef = useRef<HTMLCanvasElement>(null);    // Low latency mode: Touch overlay only
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [deviceSize, setDeviceSize] = useState<WindowSize>({ width: 390, height: 844 });
  const { setResolution, lowLatencyMode, videoFramerate } = useAppStore();
  const [imgConnected, setImgConnected] = useState(false);
  
  // Logic: Video Streaming (Standard mode uses renderCanvasRef)
  const { isConnected: wsConnected, fps: wsFps, bitrate: wsBitrate } = usePhoneStream(renderCanvasRef, deviceSize);
  
  // Determine actual connection status and metrics based on mode
  const isConnected = lowLatencyMode ? imgConnected : wsConnected;
  const fps = lowLatencyMode ? videoFramerate : wsFps; // Use configured framerate in low-latency mode
  const bitrate = lowLatencyMode ? 0 : wsBitrate; // IMG mode can't measure bitrate

  // Sync performance data to parent/toolbar
  useEffect(() => {
    if (setFpsState) setFpsState(fps);
  }, [fps, setFpsState]);

  useEffect(() => {
    if (setBitrateState) setBitrateState(bitrate);
  }, [bitrate, setBitrateState]);
  
  // Logic: Touch/Input Control
  // Low latency mode: use touchCanvasRef (transparent overlay)
  // Standard mode: use renderCanvasRef (same canvas for render and touch)
  const activeCanvasRef = lowLatencyMode ? touchCanvasRef : renderCanvasRef;
  const { 
    tapMarker, 
    mousePos,
    isProcessing,  // 获取处理状态
    onPointerDown, 
    onPointerMove, 
    onPointerUp, 
    onPointerCancel 
  } = useTouchController(activeCanvasRef, deviceSize);
  
  // IMG tag connection monitoring
  useEffect(() => {
    if (!lowLatencyMode || !imgRef.current) return;
    
    const img = imgRef.current;
    
    const handleLoad = () => {
      console.log(">>> [PhoneScreen] IMG tag loaded successfully");
      setImgConnected(true);
    };
    
    const handleError = () => {
      console.error(">>> [PhoneScreen] IMG tag failed to load");
      setImgConnected(false);
    };
    
    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);
    
    // Check if already loaded
    if (img.complete) {
      setImgConnected(true);
    }
    
    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [lowLatencyMode]);

  // Initialize Device Resolution & Settings
  useEffect(() => {
    const initDeviceInfo = async () => {
      try {
        if (!(window as any).__TAURI__) return;
        const size = await DeviceService.getWindowSize();
        if (size) {
          setDeviceSize({ width: size.width, height: size.height });
          setResolution(`${size.width}x${size.height}`);
        }
        
        // Sync persisted video settings to the backend
        const { videoQuality, videoFramerate, videoScale } = useAppStore.getState();
        await DeviceService.updateVideoSettingsWithScale(videoQuality, videoFramerate, videoScale);
      } catch (err) {
        console.error("Failed to fetch device info or update settings:", err);
      }
    };
    initDeviceInfo();
  }, [setResolution]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !(window as any).__TAURI__) return;
      let key = e.key;
      if (key === "Enter") key = "\n";
      if (key === "Backspace") key = "\b";
      if (key.length === 1 || key === "\n" || key === "\b") {
        try {
          await DeviceService.sendKeys(key);
        } catch (err) {}
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Determine if it's a modern "Notch" device (usually height/width > 2.0)
  const isModernFullClient = deviceSize.height / deviceSize.width > 2.0;

  return (
    <div 
      className={`relative flex flex-col bg-[#1c1c1e] rounded-[48px] p-[10px] box-border shadow-[0_0_0_2px_#3a3a3c,0_10px_40px_rgba(0,0,0,0.6)] z-10 transition-all duration-400
        ${(position === 'left' || position === 'right') ? 'h-[97vh]' : 'h-[91vh]'}`}
      style={{ aspectRatio: `${deviceSize.width} / ${deviceSize.height}` }}
    >
      {/* Hardware Buttons Decoration - Only for modern tall screens */}
      {isModernFullClient && (
        <>
          <div className="absolute top-[12%] -left-[4px] h-[25px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
          <div className="absolute top-[18%] -left-[4px] h-[50px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
          <div className="absolute top-[25%] -left-[4px] h-[50px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
          <div className="absolute top-[20%] -right-[4px] h-[80px] w-[2px] bg-[#3a3a3c] rounded-[2px] z-[5]"></div>
        </>
      )}
      
      {/* Notch - Only for modern tall screens */}
      {isModernFullClient && (
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[160px] h-[30px] bg-[#1c1c1e] rounded-b-[18px] z-[30] flex justify-center items-center gap-[10px]
                        before:content-[''] before:absolute before:top-0 before:w-[4px] before:h-[4px] before:bg-[#1c1c1e] before:-left-[4px] before:[mask:radial-gradient(circle_at_0%_100%,transparent_4px,#1c1c1e_4px)]
                        after:content-[''] after:absolute after:top-0 after:w-[4px] after:h-[4px] after:bg-[#1c1c1e] after:-right-[4px] after:[mask:radial-gradient(circle_at_100%_100%,transparent_4px,#1c1c1e_4px)]">
          <div className="w-[40px] h-[4px] bg-[#333] rounded-[2px] -mt-[6px]"></div>
          <div className="w-[10px] h-[10px] bg-[#050505] rounded-full relative shadow-[inset_0_0_3px_rgba(255,255,255,0.1)]
                          after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[4px] after:h-[4px] after:bg-[#0A84FF] after:rounded-full after:opacity-40 after:blur-[0.5px]"></div>
        </div>
      )}
      
      {/* Screen Container */}
      <div className="absolute inset-[10px] rounded-[38px] overflow-hidden bg-black z-[5] cursor-crosshair">
        {/* Connection Overlay */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.4)] backdrop-blur-[12px] contrast-[80%] z-[100] text-white gap-[16px] animate-[fade-in_0.4s_ease-out]">
             <div className="w-[30px] h-[30px] border-[3px] border-[rgba(255,255,255,0.1)] border-t-[var(--accent)] rounded-full animate-spin"></div>
             <span className="text-[14px] font-medium tracking-[0.5px] opacity-90">
               {lowLatencyMode ? '低延迟模式连接中...' : '加密连接重连中...'}
             </span>
             {lowLatencyMode && (
               <p className="text-[10px] text-white/40 px-8 text-center">正在建立与 WDA 的直接连接...</p>
             )}
          </div>
        )}

        {/* Low Latency Mode: IMG tag + Touch Canvas overlay */}
        {lowLatencyMode ? (
          <>
            {/* Display Layer: IMG tag directly shows MJPEG stream from WDA */}
            <img 
              ref={imgRef}
              src="http://localhost:9100"
              alt="iPhone Screen"
              className="w-full h-full object-fill"
              style={{ 
                display: isConnected ? 'block' : 'none',
                pointerEvents: 'none'
              }}
            />
            
            {/* Touch Layer: Transparent canvas for touch interaction only */}
            <canvas 
              id="touch-canvas"
              ref={touchCanvasRef}
              width={deviceSize.width}
              height={deviceSize.height}
              className="cursor-none absolute inset-0"
              style={{ 
                display: isConnected ? 'block' : 'none',
                touchAction: 'none',
                opacity: 0,  // Transparent - only for touch events
                width: '100%', 
                height: '100%' 
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            />
          </>
        ) : (
          /* Standard Mode: Render Canvas (Worker renders + handles touch) */
          <canvas 
            id="render-canvas"
            ref={renderCanvasRef}
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
        )}
        
        {/* Custom iOS Style Assistive Cursor */}
        <div 
          className="absolute w-[24px] h-[24px] bg-[rgba(255,255,255,0.3)] border-[1.5px] border-[rgba(255,255,255,0.5)] shadow-[0_0_10px_rgba(0,0,0,0.3)] rounded-full pointer-events-none z-[2000] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center
                     after:content-[''] after:w-[6px] after:h-[6px] after:bg-[rgba(255,255,255,0.8)] after:rounded-full" 
          style={{ left: mousePos.x, top: mousePos.y, opacity: isConnected ? 1 : 0 }} 
        />

        {/* Visual feedback for taps */}
        {tapMarker && (
          <div className="absolute w-[40px] h-[40px] bg-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.6)] rounded-full pointer-events-none z-[1000] animate-[tap-ping_0.3s_ease-out_forwards]" 
               style={{ 
                 left: tapMarker.x, 
                 top: tapMarker.y,
                 transform: 'translate(-50%, -50%)' // Force centering regardless of keyframes
               }} />
        )}
        
        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm pointer-events-none z-[1001] flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>处理中...</span>
          </div>
        )}
      </div>

    </div>
  );
};

export default PhoneScreen;
