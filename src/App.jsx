import React, { useState, useRef, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import PhoneScreen from './components/PhoneScreen';
import Settings from './components/Settings';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [toolbarPos, setToolbarPos] = useState('bottom'); // top, bottom, left, right
  const [isDragging, setIsDragging] = useState(false);
  const phoneRef = useRef(null);

  const handleDragStart = (e) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
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

  return (
    <>
      <div className="background">
        <div className="blob shape1"></div>
        <div className="blob shape2"></div>
        <div className="blob shape3"></div>
      </div>
      
      <div className="app-container" style={{ cursor: isDragging ? 'grabbing' : 'default' }}>
        <div className={`simulator-layout pos-${toolbarPos}`}>
          <div className="phone-wrapper" ref={phoneRef}>
            <PhoneScreen />
            {/* Toolbar must be inside wrapper to snap to phone edges */}
            <Toolbar 
              position={toolbarPos}
              isDragging={isDragging}
              onDragStart={handleDragStart}
              onSettingsClick={() => setShowSettings(!showSettings)} 
            />
          </div>
        </div>
      </div>

      <Settings visible={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}

export default App;
