import React, { useState, useRef, useEffect } from 'react';
import Toolbar from './Toolbar';
import Phone from './Phone';
import Settings from './Settings';
import { useAppStore } from '../store/useAppStore';
import { DeviceService } from '../services/deviceService';
import { WindowSize } from '../types/global';

/**
 * PhoneWorkbench - The Management Layer
 * Handles layout orientation, toolbar positioning, and coordination.
 */
const PhoneWorkbench: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const { 
    toolbarPosition: toolbarPos, 
    setToolbarPosition: setToolbarPos,
  } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [fps, setFps] = useState(0);
  const [bitrate, setBitrate] = useState(0);
  const [deviceSize, setDeviceSize] = useState<WindowSize>({ width: 390, height: 844 });
  const phoneRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const initDeviceInfo = async () => {
      try {
        if (!(window as any).__TAURI__) return;
        const size = await DeviceService.getWindowSize();
        if (size) {
          setDeviceSize({ width: size.width, height: size.height });
        }
      } catch (err) { }
    };
    initDeviceInfo();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging || !phoneRef.current) return;
      const rect = phoneRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > absY * 1.2) {
        setToolbarPos(dx > 0 ? 'right' : 'left');
      } else if (absY > absX * 1.2) {
        setToolbarPos(dy > 0 ? 'bottom' : 'top');
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const [isProcessingHardware, setIsProcessingHardware] = useState(false);

  // Hardware control functions
  const pressHome = async () => {
    if (isProcessingHardware) return;
    setIsProcessingHardware(true);
    try { await DeviceService.pressHome(); } finally { setIsProcessingHardware(false); }
  };
  
  const pressVolumeUp = async () => {
    if (isProcessingHardware) return;
    setIsProcessingHardware(true);
    try { await DeviceService.pressVolumeUp(); } finally { setIsProcessingHardware(false); }
  };
  
  const pressVolumeDown = async () => {
    if (isProcessingHardware) return;
    setIsProcessingHardware(true);
    try { await DeviceService.pressVolumeDown(); } finally { setIsProcessingHardware(false); }
  };
  
  const pressMute = () => DeviceService.pressMute();
  
  const pressLock = async () => {
    if (isProcessingHardware) return;
    setIsProcessingHardware(true);
    try { await DeviceService.toggleLock(); } finally { setIsProcessingHardware(false); }
  };

  const getLayoutClasses = () => {
    const base = "flex gap-[15px] items-center justify-center p-0 transition-all duration-500 ease-[cubic-bezier(0.18,0.89,0.32,1.28)]";
    const posDirs: Record<string, string> = {
      top: "flex-col",
      bottom: "flex-col-reverse",
      left: "flex-row",
      right: "flex-row-reverse"
    };
    return `${base} ${posDirs[toolbarPos]}`;
  };

  return (
    <div className="flex justify-center items-center h-screen w-screen p-[10px] box-border overflow-hidden" 
         style={{ cursor: isDragging ? 'grabbing' : 'default' }}>
      <div className={getLayoutClasses()}>
        <Toolbar 
          onSettingsClick={() => setShowSettings(!showSettings)} 
          onDragStart={handleDragStart} 
          position={toolbarPos} 
          isDragging={isDragging}
          onHomeClick={pressHome}
          onVolumeUpClick={pressVolumeUp}
          onVolumeDownClick={pressVolumeDown}
          onMuteClick={pressMute}
          onLockClick={pressLock}
          isProcessingHardware={isProcessingHardware}
          fps={fps}
          bitrate={bitrate}
        />
        <div className="relative" ref={phoneRef}>
          <Phone 
            deviceSize={deviceSize}
            toolbarPosition={toolbarPos}
            setFps={setFps}
            setBitrate={setBitrate}
          />
        </div>
      </div>
      <Settings visible={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default PhoneWorkbench;
