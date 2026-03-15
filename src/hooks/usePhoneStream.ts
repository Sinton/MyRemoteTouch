import React, { useEffect, useState, useRef } from 'react';
import { WindowSize } from '../types/global';
import { useAppStore } from '../store/useAppStore';

/**
 * Hook to manage the video stream via a Web Worker.
 * 
 * Standard Mode (WebSocket):
 * - Uses renderCanvasRef (transferred to Worker via OffscreenCanvas)
 * - Worker renders frames on OffscreenCanvas
 * - Canvas also handles touch events
 * 
 * Low Latency Mode (IMG Direct):
 * - Does not use Worker or Canvas for rendering
 * - IMG tag displays stream directly from WDA
 * - Separate touchCanvasRef handles touch events only
 */
export const usePhoneStream = (
  renderCanvasRef: React.RefObject<HTMLCanvasElement>, 
  deviceSize: WindowSize
) => {
  const streamMode = useAppStore(state => state.streamMode);
  const lowLatencyMode = useAppStore(state => state.lowLatencyMode);
  const [isConnected, setIsConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const [bitrate, setBitrate] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const offscreenRef = useRef<OffscreenCanvas | null>(null);
  const isInitializedRef = useRef(false);

  // Performance tracking refs
  const frameCountRef = useRef(0);
  const byteCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // 1. Worker Initialization (Reinitialize when switching modes)
  useEffect(() => {
    // Skip worker initialization in low latency mode
    if (lowLatencyMode) {
      console.log(">>> [usePhoneStream] Low latency mode: IMG renders directly, no Worker needed");
      // Clean up existing worker if switching from standard mode
      if (workerRef.current) {
        console.log(">>> [usePhoneStream] Cleaning up Worker when switching to low latency");
        workerRef.current.postMessage({ type: 'DISCONNECT' });
        workerRef.current.terminate();
        workerRef.current = null;
        offscreenRef.current = null;
        isInitializedRef.current = false;
      }
      return;
    }
    
    // If already initialized and worker exists, reuse it
    if (isInitializedRef.current && workerRef.current && offscreenRef.current) {
      console.log(">>> [usePhoneStream] Worker already initialized, reusing");
      return;
    }

    const canvas = renderCanvasRef.current;
    if (!canvas) {
      console.warn(">>> [usePhoneStream] No render canvas element");
      return;
    }

    // Clean up before reinitializing
    if (workerRef.current) {
      console.log(">>> [usePhoneStream] Cleaning up old Worker before reinit");
      workerRef.current.postMessage({ type: 'DISCONNECT' });
      workerRef.current.terminate();
      workerRef.current = null;
      offscreenRef.current = null;
      isInitializedRef.current = false;
    }

    let offscreen: OffscreenCanvas;
    try {
      // Transfer canvas control to Worker (OffscreenCanvas)
      // After this, canvas cannot be used for normal rendering
      // @ts-ignore
      offscreen = canvas.transferControlToOffscreen();
      offscreenRef.current = offscreen;
      isInitializedRef.current = true;
      console.log(">>> [usePhoneStream] Render canvas transferred to Worker successfully");
    } catch (e) {
      console.error(">>> [usePhoneStream] Canvas transfer failed:", e);
      console.error(">>> [usePhoneStream] This usually happens when canvas is already in use");
      console.error(">>> [usePhoneStream] Try refreshing the page");
      return;
    }
    
    const worker = new Worker(new URL('../workers/videoWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.postMessage({ 
      type: 'INIT', 
      payload: { canvas: offscreen } 
    }, [offscreen]);

    // Global message handler for the worker
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      
      if (type === 'STATUS') {
        console.log(">>> [usePhoneStream] Status update:", payload);
        setIsConnected(payload.connected);
        
        // If there's a CORS error, show warning
        if (payload.error === 'CORS') {
          console.error(">>> [usePhoneStream] CORS error - direct mode not supported");
        }
      }
      
      if (type === 'FRAME_PROCESSED') {
        // Update metrics
        frameCountRef.current++;
        byteCountRef.current += payload.size;
        
        const now = performance.now();
        if (now - lastTimeRef.current >= 1000) {
          const elapsed = now - lastTimeRef.current;
          setFps(Math.round((frameCountRef.current * 1000) / elapsed));
          setBitrate(Math.round((byteCountRef.current * 8 * 1000) / elapsed));
          frameCountRef.current = 0;
          byteCountRef.current = 0;
          lastTimeRef.current = now;
        }
      }
    };

    return () => {
      console.log(">>> [usePhoneStream] Cleaning up worker on unmount");
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'DISCONNECT' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      offscreenRef.current = null;
      isInitializedRef.current = false;
    };
  }, [renderCanvasRef, lowLatencyMode]); // Reinitialize when lowLatencyMode changes

  // 2. Connection Management (Reacts to streamMode changes)
  useEffect(() => {
    // Skip connection in low latency mode
    if (lowLatencyMode) {
      console.log(">>> [usePhoneStream] Low latency mode, no worker connection needed");
      return;
    }
    
    if (!workerRef.current) {
      console.warn(">>> [usePhoneStream] Worker not ready, skipping connection");
      return;
    }

    const url = streamMode === 'proxy' ? "ws://localhost:9999" : "http://localhost:9100";
    console.log(`>>> [usePhoneStream] Mode changed to ${streamMode}, connecting to: ${url}`);

    workerRef.current.postMessage({ 
      type: 'CONNECT', 
      payload: { url } 
    });
  }, [streamMode, lowLatencyMode]); // React to streamMode and lowLatencyMode changes

  // 3. Resize Handling
  useEffect(() => {
    if (workerRef.current && isConnected) {
      workerRef.current.postMessage({
        type: 'RESIZE',
        payload: { width: deviceSize.width, height: deviceSize.height }
      });
    }
  }, [deviceSize, isConnected]);

  return { isConnected, fps, bitrate };
};
