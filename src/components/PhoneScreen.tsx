import React, { useEffect, useRef, useState } from 'react';
import { usePhoneStream } from '../hooks/usePhoneStream';
import { useTouchController } from '../hooks/useTouchController';
import { WindowSize } from '../types/global';
import { DeviceService } from '../services/deviceService';
import { useAppStore } from '../store/useAppStore';

/**
 * PhoneScreen Component - THE RENDERER
 * Responsibility: Connection, Display, Touch, and internal Content Rotation.
 */
interface PhoneScreenProps {
  position?: 'top' | 'bottom' | 'left' | 'right';
  setFpsState?: (fps: number) => void;
  setBitrateState?: (bitrate: number) => void;
}

const PhoneScreen: React.FC<PhoneScreenProps> = ({
  setFpsState,
  setBitrateState
}) => {
  const renderCanvasRef = useRef<HTMLCanvasElement>(null!);
  const touchCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [deviceSize, setDeviceSize] = useState<WindowSize>({ width: 390, height: 844 });
  const {
    setResolution,
    lowLatencyMode,
    videoFramerate,
    screenOrientation,
    setScreenOrientation
  } = useAppStore();
  const [imgConnected, setImgConnected] = useState(false);

  const { isConnected: wsConnected, fps: wsFps, bitrate: wsBitrate } = usePhoneStream(renderCanvasRef, deviceSize);
  const isConnected = lowLatencyMode ? imgConnected : wsConnected;
  const fps = lowLatencyMode ? videoFramerate : wsFps;
  const bitrate = lowLatencyMode ? 0 : wsBitrate;
  const isLandscape = screenOrientation === 'landscape';

  useEffect(() => { if (setFpsState) setFpsState(fps); }, [fps, setFpsState]);
  useEffect(() => { if (setBitrateState) setBitrateState(bitrate); }, [bitrate, setBitrateState]);

  const activeCanvasRef = (lowLatencyMode ? touchCanvasRef : renderCanvasRef) as React.RefObject<HTMLCanvasElement>;
  
  const {
    tapMarker,
    mousePos,
    isProcessing,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel
  } = useTouchController(activeCanvasRef, deviceSize);

  useEffect(() => {
    if (!lowLatencyMode || !imgRef.current) return;
    const img = imgRef.current;
    
    const checkOrientation = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const isCurrentlyLandscape = img.naturalWidth > img.naturalHeight;
        if (isCurrentlyLandscape && screenOrientation !== 'landscape') {
          setScreenOrientation('landscape');
        } else if (!isCurrentlyLandscape && screenOrientation !== 'portrait') {
          setScreenOrientation('portrait');
        }
      }
    };

    const handleLoad = () => {
      setImgConnected(true);
      checkOrientation();
    };
    
    const handleError = () => setImgConnected(false);
    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);
    
    const intervalId = setInterval(checkOrientation, 500);

    if (img.complete) handleLoad();
    
    return () => { 
      img.removeEventListener('load', handleLoad); 
      img.removeEventListener('error', handleError);
      clearInterval(intervalId);
    };
  }, [lowLatencyMode, screenOrientation, setScreenOrientation]);

  useEffect(() => {
    const initDeviceInfo = async () => {
      try {
        if (!(window as any).__TAURI__) return;
        const size = await DeviceService.getWindowSize();
        if (size) {
          setDeviceSize({ width: size.width, height: size.height });
          setResolution(`${size.width}x${size.height}`);
        }
        const { videoQuality, videoFramerate: vFramerate, videoScale } = useAppStore.getState();
        await DeviceService.updateVideoSettingsWithScale(videoQuality, vFramerate, videoScale);
      } catch (err) { }
    };
    initDeviceInfo();
  }, [setResolution]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !(window as any).__TAURI__) return;
      let key = e.key;
      if (key === "Enter") key = "\n";
      if (key === "Backspace") key = "\b";
      if (key.length === 1 || key === "\n" || key === "\b") {
        try { await DeviceService.sendKeys(key); } catch (err) { }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const portraitWidth = Math.min(deviceSize.width, deviceSize.height);
  const portraitHeight = Math.max(deviceSize.width, deviceSize.height);

  return (
    <div 
      className="absolute z-[5] cursor-crosshair transition-all duration-500 overflow-hidden"
      style={{
        top: '50%',
        left: '50%',
        // 核心修复逻辑：响应式物理镶嵌
        // 1. 我们不再使用固定像素，而是基于手机壳内部槽位的 100% 比例进行换算。
        // 2. 槽位的原始比例是 (portraitHeight - 20) / (portraitWidth - 20) ≈ 824 / 370。
        // 3. 在横屏模式下，我们将逻辑宽度拉伸为比例值，高度缩小为比例值，旋转后即精准满格。
        width: isLandscape ? `calc(100% * (${portraitHeight} - 20) / (${portraitWidth} - 20))` : '100%',
        height: isLandscape ? `calc(100% * (${portraitWidth} - 20) / (${portraitHeight} - 20))` : '100%',
        transform: `translate(-50%, -50%) ${isLandscape ? 'rotate(90deg)' : 'rotate(0deg)'}`,
        transformOrigin: 'center center',
      }}
    >
      {/* Connection Overlay */}
      {!isConnected && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.4)] backdrop-blur-[12px] z-[100] text-white gap-[16px]">
           <div className="w-[30px] h-[30px] border-[3px] border-[rgba(255,255,255,0.1)] border-t-[var(--accent)] rounded-full animate-spin"></div>
           <span className="text-[14px]">连接中...</span>
         </div>
      )}

      {lowLatencyMode ? (
        <>
          <img
            ref={imgRef}
            src="http://localhost:9100"
            alt="iPhone Screen"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            style={{ display: isConnected ? 'block' : 'none' }}
          />
          <canvas
            id="touch-canvas"
            ref={touchCanvasRef}
            width={isLandscape ? deviceSize.height : deviceSize.width}
            height={isLandscape ? deviceSize.width : deviceSize.height}
            className="cursor-none absolute inset-0 w-full h-full opacity-0"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        </>
      ) : (
        <canvas
          id="render-canvas"
          ref={renderCanvasRef}
          width={isLandscape ? deviceSize.height : deviceSize.width}
          height={isLandscape ? deviceSize.width : deviceSize.height}
          className="cursor-none w-full h-full"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      )}

      {/* Assistive Cursor & Markers */}
      <div className="absolute w-[24px] h-[24px] bg-[rgba(255,255,255,0.3)] border-[1.5px] border-[rgba(255,255,255,0.5)] shadow-[0_0_10px_rgba(0,0,0,0.3)] rounded-full pointer-events-none z-[2000] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center
                     after:content-[''] after:w-[6px] after:h-[6px] after:bg-[rgba(255,255,255,0.8)] after:rounded-full"
           style={{ left: mousePos.x, top: mousePos.y, opacity: isConnected ? 1 : 0 }} />

      {tapMarker && (
        <div className="absolute w-[40px] h-[40px] bg-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.6)] rounded-full pointer-events-none z-[1000] animate-[tap-ping_0.3s_ease-out_forwards]"
          style={{ left: tapMarker.x, top: tapMarker.y, transform: 'translate(-50%, -50%)' }} />
      )}

      {isProcessing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm z-[1001] flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          处理中...
        </div>
      )}
    </div>
  );
};

export default PhoneScreen;
