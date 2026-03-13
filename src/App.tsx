import React from 'react';
import Phone from './components/Phone';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import './index.css';

/**
 * VisualBackground - Renders based on selection: Liquid, Solid, or Gradient.
 */
const VisualBackground: React.FC = () => {
  const { theme } = useTheme();
  
  // Style for the base container
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

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={containerStyle}>
        {theme.backgroundMode === 'liquid' && (
          <div className="absolute inset-0 opacity-60 mix-blend-screen" style={{ filter: 'url(#liquid)' }}>
            <div 
              className="absolute w-[80vw] h-[80vw] rounded-full -top-[20%] -right-[20%] animate-[blob-movement_30s_infinite_linear] opacity-80 blur-[80px]" 
              style={{ backgroundColor: theme.blob1Color }}
            />
            <div 
              className="absolute w-[70vw] h-[70vw] rounded-full -bottom-[20%] -left-[20%] animate-[blob-movement-alt_40s_infinite_linear] opacity-80 blur-[80px]" 
              style={{ backgroundColor: theme.blob2Color }}
            />
            <div 
              className="absolute w-[60vw] h-[60vw] rounded-full top-[10%] left-[10%] animate-[blob-movement_25s_infinite_linear_reverse] opacity-80 blur-[80px]" 
              style={{ backgroundColor: theme.blob3Color }}
            />
          </div>
        )}
        
        {/* Grain Texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>
    </>
  );
};

const AppContent: React.FC = () => {

  return (
    <>
      <VisualBackground />
      <Phone />
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
