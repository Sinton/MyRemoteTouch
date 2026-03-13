import React, { useState, useRef, useEffect } from 'react';
import Toolbar from './Toolbar';
import PhoneScreen from './PhoneScreen';
import Settings from './Settings';

const invoke = (window as any).__TAURI__?.core?.invoke || (() => Promise.resolve());

type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right';

const Phone: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<ToolbarPosition>('bottom');
  const [isDragging, setIsDragging] = useState(false);
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

  const pressHome = async () => {
    if (!(window as any).__TAURI__) return;
    try { await invoke("press_home_button"); } catch (err) {}
  };

  const pressVolumeUp = async () => {
    if (!(window as any).__TAURI__) return;
    try { await invoke("press_volume_up"); } catch (err) {}
  };

  const pressVolumeDown = async () => {
    if (!(window as any).__TAURI__) return;
    try { await invoke("press_volume_down"); } catch (err) {}
  };

  const pressMute = async () => {
    if (!(window as any).__TAURI__) return;
    try { await invoke("press_mute_button"); } catch (err) {}
  };

  const pressLock = async () => {
    if (!(window as any).__TAURI__) return;
    try { await invoke("toggle_lock"); } catch (err) {}
  };

  // Helper for layout orientation classes
  const getLayoutClasses = () => {
    const base = "flex gap-[15px] items-center justify-center p-0 transition-all duration-400 ease-[cubic-bezier(0.18,0.89,0.32,1.28)]";
    const posDirs: Record<ToolbarPosition, string> = {
      top: "flex-col-reverse",
      bottom: "flex-col",
      left: "flex-row-reverse",
      right: "flex-row"
    };
    return `${base} ${posDirs[toolbarPos]}`;
  };

  return (
    <div 
      className="flex justify-center items-center h-full w-full p-[10px] box-border" 
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
        />
        <div className="relative" ref={phoneRef}>
          <PhoneScreen />
        </div>
      </div>
      
      <Settings visible={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Phone;
