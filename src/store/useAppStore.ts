import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BackgroundMode = 'liquid' | 'solid' | 'gradient';

interface AppTheme {
  backgroundMode: BackgroundMode;
  blob1Color: string;
  blob2Color: string;
  blob3Color: string;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  blurAmount: number;
}

interface AppState {
  // Theme State
  theme: AppTheme;
  setTheme: (theme: Partial<AppTheme>) => void;
  resetTheme: () => void;

  // Connection State
  isConnecting: boolean;
  setIsConnecting: (status: boolean) => void;
  lastConnectedResolution: string;
  setResolution: (res: string) => void;
}

const defaultTheme: AppTheme = {
  backgroundMode: 'liquid',
  blob1Color: '#7000FF',
  blob2Color: '#0070FF',
  blob3Color: '#FF0060',
  solidColor: '#292929',
  gradientStart: '#1a1a25',
  gradientEnd: '#050505',
  blurAmount: 60,
};

/**
 * useAppStore - The single source of truth for the application.
 * Powered by Zustand with persistence.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial Theme
      theme: defaultTheme,
      setTheme: (newTheme) => 
        set((state) => ({ theme: { ...state.theme, ...newTheme } })),
      resetTheme: () => set({ theme: defaultTheme }),

      // UI/Device Status
      isConnecting: true,
      setIsConnecting: (status) => set({ isConnecting: status }),
      lastConnectedResolution: '390x844',
      setResolution: (res) => set({ lastConnectedResolution: res }),
    }),
    {
      name: 'my-remote-touch-storage',
      partialize: (state) => ({ theme: state.theme }), // Only persist theme for now
    }
  )
);
