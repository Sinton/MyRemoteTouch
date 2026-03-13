/**
 * Global Type Definitions for MyRemoteTouch
 */

export interface Point {
  x: number;
  y: number;
}

export interface TouchPoint extends Point {
  time: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface DeviceConfig {
  wdaUrl: string;
  videoPort: number;
  wsPort: number;
}

export type WdaCommand = 
  | { type: 'TAP'; payload: Point }
  | { type: 'ACTIONS'; payload: TouchPoint[] }
  | { type: 'KEYS'; payload: string }
  | { type: 'VOLUME'; payload: 'UP' | 'DOWN' }
  | { type: 'HOME' }
  | { type: 'LOCK' }
  | { type: 'MUTE' };
