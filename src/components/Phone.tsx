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

      // Magnetic snapping logic
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

  // Command Handlers
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

  return (
    <div className="app-container" style={{ cursor: isDragging ? 'grabbing' : 'default' }}>
      <div className={`simulator-layout pos-${toolbarPos}`}>
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
        <div className="phone-wrapper" ref={phoneRef}>
          <PhoneScreen />
        </div>
      </div>
      
      <Settings visible={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Phone;
