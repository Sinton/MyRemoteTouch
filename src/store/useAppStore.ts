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
  resetSettings: () => void;

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
  blob1Color: '#d1d1d1',
  blob2Color: '#667585',
  blob3Color: '#74706d',
  solidColor: '#292929',
  gradientStart: '#bdbdbd',
  gradientEnd: '#050505',
  blurAmount: 60,
};

const defaultVideoSettings = {
  videoQuality: 60,
  videoFramerate: 30,
  videoScale: 100,
  lowLatencyMode: true,
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
      resetSettings: () => set({
        theme: defaultTheme,
        ...defaultVideoSettings,
        isDeveloperMode: false,
      }),

      // UI/Device Status
      isConnecting: true,
      setIsConnecting: (status) => set({ isConnecting: status }),
      lastConnectedResolution: '390x844',
      setResolution: (res) => set({ lastConnectedResolution: res }),

      // Video Settings
      videoQuality: defaultVideoSettings.videoQuality,
      setVideoQuality: (q) => set({ videoQuality: q }),
      videoFramerate: defaultVideoSettings.videoFramerate,
      setVideoFramerate: (f) => set({ videoFramerate: f }),
      videoScale: defaultVideoSettings.videoScale,
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
      lowLatencyMode: defaultVideoSettings.lowLatencyMode,
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
