import React, { useEffect, useRef, useState } from 'react';
import { usePhoneStream } from '../hooks/usePhoneStream';
import { useTouchController } from '../hooks/useTouchController';
import { WindowSize } from '../types/global';

const invoke = (window as any).__TAURI__?.core?.invoke || (() => Promise.resolve());

/**
 * PhoneScreen Component - Refactored to use modular hooks for logic separation.
 */
const PhoneScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    <div className="phone-container">
      {/* Hardware Buttons Decoration */}
      <div className="mute-switch"></div>
      <div className="volume-up"></div>
      <div className="volume-down"></div>
      <div className="power-button"></div>
      
      <div className="notch">
        <div className="speaker"></div>
        <div className="camera"></div>
      </div>
      
      <div id="screen-container">
        {/* Advanced Connection Overlay */}
        {!isConnected && (
          <div className="connection-overlay">
             <div className="spinner"></div>
             <span>加密连接重连中...</span>
          </div>
        )}
        
        {/* Custom iOS Style Assistive Cursor */}
        <div 
          className="custom-cursor" 
          style={{ left: mousePos.x, top: mousePos.y, opacity: isConnected ? 1 : 0 }} 
        />
        
        <canvas 
          id="screen-canvas"
          ref={canvasRef}
          width={deviceSize.width}
          height={deviceSize.height}
          className="hide-native-cursor"
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
          <div className="tap-ripple" style={{ left: tapMarker.x, top: tapMarker.y }} />
        )}
      </div>
    </div>
  );
};

export default PhoneScreen;
