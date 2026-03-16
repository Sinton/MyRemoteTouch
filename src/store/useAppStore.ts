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

  // Video Settings
  videoQuality: number;
  setVideoQuality: (q: number) => void;
  videoFramerate: number;
  setVideoFramerate: (f: number) => void;
  videoScale: number;
  setVideoScale: (s: number) => void;
  streamMode: 'proxy' | 'direct';
  setStreamMode: (mode: 'proxy' | 'direct') => void;
  
  // Low Latency Mode (IMG tag)
  lowLatencyMode: boolean;
  setLowLatencyMode: (enabled: boolean) => void;

  // Developer Mode
  isDeveloperMode: boolean;
  setIsDeveloperMode: (enabled: boolean) => void;
  isTouchDebugOpen: boolean;
  setIsTouchDebugOpen: (enabled: boolean) => void;
  toolbarPosition: 'top' | 'bottom' | 'left' | 'right';
  setToolbarPosition: (pos: 'top' | 'bottom' | 'left' | 'right') => void;
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
    (set, get) => ({
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

      // Video Settings
      videoQuality: 100, // 0-100
      setVideoQuality: (q) => set({ videoQuality: q }),
      videoFramerate: 60, // 10-60
      setVideoFramerate: (f) => set({ videoFramerate: f }),
      videoScale: 0.65, // 0.1-1.0 (default 65%)
      setVideoScale: (s) => set({ videoScale: s }),
      streamMode: 'proxy', // Force proxy mode (direct mode has CORS issues)
      setStreamMode: (mode) => {
        // Prevent switching to direct mode
        if (mode === 'direct') {
          console.warn('>>> [Store] Direct mode is disabled due to CORS restrictions');
          return;
        }
        set({ streamMode: mode });
      },
      
      // Low Latency Mode
      lowLatencyMode: false,
      setLowLatencyMode: (enabled) => set({ lowLatencyMode: enabled }),

      // Developer Mode
      isDeveloperMode: false,
      setIsDeveloperMode: (enabled) => set({ isDeveloperMode: enabled }),
      isTouchDebugOpen: false,
      setIsTouchDebugOpen: (enabled) => set({ isTouchDebugOpen: enabled }),
      toolbarPosition: 'bottom',
      setToolbarPosition: (pos) => set({ toolbarPosition: pos }),
    }),
    {
      name: 'my-remote-touch-storage',
      partialize: (state) => ({ 
        theme: state.theme,
        videoQuality: state.videoQuality,
        videoFramerate: state.videoFramerate,
        videoScale: state.videoScale,
        lowLatencyMode: state.lowLatencyMode,
        isDeveloperMode: state.isDeveloperMode,
        toolbarPosition: state.toolbarPosition,
        // Don't persist streamMode to always start with proxy
        // streamMode: state.streamMode
      }),
      // Migration: Force proxy mode on load
      onRehydrateStorage: () => (state) => {
        if (state && state.streamMode === 'direct') {
          console.log('>>> [Store] Migrating from direct to proxy mode');
          state.streamMode = 'proxy';
        }
      },
    }
  )
);
