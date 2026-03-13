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
              <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="50" />
            </filter>
          </defs>
        </svg>
      )}

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={containerStyle}>
        {theme.backgroundMode === 'liquid' && (
          <div className="absolute inset-0 opacity-40 mix-blend-screen" style={{ filter: 'url(#liquid)' }}>
            <div 
              className="absolute w-[60vw] h-[60vw] rounded-full -top-[10%] -right-[10%] animate-[blob-movement_25s_infinite_ease-in-out] transition-all duration-1000" 
              style={{ backgroundColor: theme.blob1Color }}
            />
            <div 
              className="absolute w-[55vw] h-[55vw] rounded-full -bottom-[5%] -left-[5%] animate-[blob-movement-alt_30s_infinite_ease-in-out] transition-all duration-1000" 
              style={{ backgroundColor: theme.blob2Color }}
            />
            <div 
              className="absolute w-[50vw] h-[50vw] rounded-full top-[20%] left-[20%] animate-[blob-movement_22s_infinite_ease-in-out_reverse] transition-all duration-1000" 
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
