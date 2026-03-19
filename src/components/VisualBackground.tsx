import React from 'react';
import { useAppStore } from '../store/useAppStore';

const VisualBackground: React.FC = () => {
  const { theme } = useAppStore();
  
  let containerStyle: React.CSSProperties = {
    transition: 'all 1s ease'
  };

  if (theme.backgroundMode === 'solid') {
    containerStyle.backgroundColor = theme.solidColor;
  } else if (theme.backgroundMode === 'gradient') {
    containerStyle.background = `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`;
  } else {
    containerStyle.background = 'radial-gradient(circle at 50% 50%, #1a1a25 0%, #050505 100%)';
  }

  return (
    <>
      {/* Liquid Filter Definition */}
      {theme.backgroundMode === 'liquid' && (
        <svg className="hidden">
          <defs>
            <filter id="liquid">
              <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" result="noise">
                <animate attributeName="baseFrequency" dur="20s" values="0.01;0.015;0.01" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="80" />
            </filter>
          </defs>
        </svg>
      )}

      {/* Background Container */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={containerStyle}>
        {theme.backgroundMode === 'liquid' && (
          <div className="absolute inset-0 opacity-60 mix-blend-screen" style={{ filter: 'url(#liquid)' }}>
            <div 
              className="absolute w-[80vw] h-[80vw] rounded-full -top-[20%] -right-[20%] animate-[blob-movement_12s_infinite_linear] opacity-80" 
              style={{ backgroundColor: theme.blob1Color, filter: `blur(${theme.blurAmount}px)` }}
            />
            <div 
              className="absolute w-[70vw] h-[70vw] rounded-full -bottom-[20%] -left-[20%] animate-[blob-movement-alt_15s_infinite_linear] opacity-80" 
              style={{ backgroundColor: theme.blob2Color, filter: `blur(${theme.blurAmount}px)` }}
            />
            <div 
              className="absolute w-[60vw] h-[60vw] rounded-full top-[10%] left-[10%] animate-[blob-movement-extra_10s_infinite_linear] opacity-80" 
              style={{ backgroundColor: theme.blob3Color, filter: `blur(${theme.blurAmount}px)` }}
            />
          </div>
        )}
        
        {/* Grain Texture Surface (Local Data URL to avoid 403 / remote calls) */}
        <div 
          className="absolute inset-0 opacity-[0.04] pointer-events-none" 
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }}
        />
      </div>
    </>
  );
};

export default VisualBackground;
