import React, { useState, useRef, useEffect } from 'react';
import Toolbar from './Toolbar';
import PhoneScreen from './PhoneScreen';
import Settings from './Settings';
import { useAppStore } from '../store/useAppStore';
import { DeviceService } from '../services/deviceService';

type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right';

const Phone: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const { toolbarPosition: toolbarPos, setToolbarPosition: setToolbarPos } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [fps, setFps] = useState(0);
  const [bitrate, setBitrate] = useState(0);
  const phoneRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

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

  const pressHome = () => DeviceService.pressHome();
  const pressVolumeUp = () => DeviceService.pressVolumeUp();
  const pressVolumeDown = () => DeviceService.pressVolumeDown();
  const pressMute = () => DeviceService.pressMute();
  const pressLock = () => DeviceService.toggleLock();

  // Helper for layout orientation classes
  const getLayoutClasses = () => {
    const base = "flex gap-[15px] items-center justify-center p-0 transition-all duration-400 ease-[cubic-bezier(0.18,0.89,0.32,1.28)]";
    const posDirs: Record<ToolbarPosition, string> = {
      top: "flex-col",
      bottom: "flex-col-reverse",
      left: "flex-row",
      right: "flex-row-reverse"
    };
    return `${base} ${posDirs[toolbarPos]}`;
  };

  return (
    <div 
      className="flex justify-center items-center h-screen w-screen p-[10px] box-border" 
      style={{ cursor: isDragging ? 'grabbing' : 'default' }}
    >
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
          fps={fps}
          bitrate={bitrate}
        />
        <div className="relative" ref={phoneRef}>
          <PhoneScreen 
            position={toolbarPos} 
            setFpsState={setFps} 
            setBitrateState={setBitrate} 
          />
        </div>
      </div>
      
      <Settings visible={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Phone;
