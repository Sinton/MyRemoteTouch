import React, { createContext, useContext, useState, useEffect } from 'react';

export type BackgroundMode = 'liquid' | 'solid' | 'gradient';

export interface AppTheme {
  backgroundMode: BackgroundMode;
  blob1Color: string;
  blob2Color: string;
  blob3Color: string;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  blurAmount: number;
}

interface ThemeContextType {
  theme: AppTheme;
  setTheme: React.Dispatch<React.SetStateAction<AppTheme>>;
}

const defaultTheme: AppTheme = {
  backgroundMode: 'liquid',
  blob1Color: '#7000FF',
  blob2Color: '#0070FF',
  blob3Color: '#FF0060',
  solidColor: '#0f0f13',
  gradientStart: '#1a1a25',
  gradientEnd: '#050505',
  blurAmount: 60,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('app-theme-v2');
    return saved ? JSON.parse(saved) : defaultTheme;
  });

  useEffect(() => {
    localStorage.setItem('app-theme-v2', JSON.stringify(theme));
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
