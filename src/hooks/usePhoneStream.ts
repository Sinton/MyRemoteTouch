import React, { useEffect, useState, useRef } from 'react';
import { WindowSize } from '../types/global';

/**
 * Hook to manage the video stream via a Web Worker.
 * Uses OffscreenCanvas for better performance by offloading rendering.
 */
export const usePhoneStream = (
  canvasRef: React.RefObject<HTMLCanvasElement>, 
  deviceSize: WindowSize
) => {
  const [isConnected, setIsConnected] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const terminationRef = useRef<any>(null);

  useEffect(() => {
    // 1. If we are re-mounting (e.g. StrictMode), cancel the pending termination
    if (terminationRef.current) {
      clearTimeout(terminationRef.current);
      terminationRef.current = null;
    }

    // 2. If the worker is already active and healthy, don't re-initialize
    if (workerRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 3. Setup OffscreenCanvas
    let offscreen: OffscreenCanvas;
    try {
      // @ts-ignore
      offscreen = canvas.transferControlToOffscreen();
    } catch (e) {
      console.warn("Canvas already transferred, attempting to recover connection...");
      // If it fails here, it's likely already transferred but the worker 
      // might have been lost. In a real app we'd need a more robust 
      // worker-relinking strategy, but for now we skip to avoid crashing.
      return;
    }
    
    // 4. Initialize Worker
    const worker = new Worker(new URL('../workers/videoWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.postMessage({ 
      type: 'INIT', 
      payload: { canvas: offscreen } 
    }, [offscreen]);

    worker.postMessage({ 
      type: 'CONNECT', 
      payload: { url: "ws://localhost:9999" } 
    });

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'STATUS') {
        setIsConnected(payload.connected);
      }
    };

    return () => {
      // 5. Use debounced termination to survive StrictMode's immediate remount
      terminationRef.current = setTimeout(() => {
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'DISCONNECT' });
          workerRef.current.terminate();
          workerRef.current = null;
          console.log(">>> [VideoWorker] Terminated (Clean Exit)");
        }
      }, 100);
    };
  }, [canvasRef]); 

  // Sync resolution changes to worker
  useEffect(() => {
    if (workerRef.current && isConnected) {
      workerRef.current.postMessage({
        type: 'RESIZE',
        payload: { width: deviceSize.width, height: deviceSize.height }
      });
    }
  }, [deviceSize, isConnected]);

  return { isConnected };
};
