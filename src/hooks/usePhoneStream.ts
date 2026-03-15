import React, { useEffect, useState, useRef } from 'react';
import { WindowSize } from '../types/global';

/**
 * Hook to manage the video stream via a Web Worker.
 */
export const usePhoneStream = (
  canvasRef: React.RefObject<HTMLCanvasElement>, 
  deviceSize: WindowSize
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const [bitrate, setBitrate] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const terminationRef = useRef<any>(null);

  useEffect(() => {
    if (terminationRef.current) {
      clearTimeout(terminationRef.current);
      terminationRef.current = null;
    }

    if (workerRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let offscreen: OffscreenCanvas;
    try {
      // @ts-ignore
      offscreen = canvas.transferControlToOffscreen();
    } catch (e) {
      return;
    }
    
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

    // Simple performance tracking
    let frameCount = 0;
    let byteCount = 0;
    let lastTime = performance.now();

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'STATUS') {
        setIsConnected(payload.connected);
      }
      if (type === 'FRAME_PROCESSED') {
        frameCount++;
        byteCount += payload.size;
        
        const now = performance.now();
        if (now - lastTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (now - lastTime)));
          setBitrate(Math.round((byteCount * 8 * 1000) / (now - lastTime)));
          frameCount = 0;
          byteCount = 0;
          lastTime = now;
        }
      }
    };

    return () => {
      terminationRef.current = setTimeout(() => {
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'DISCONNECT' });
          workerRef.current.terminate();
          workerRef.current = null;
          setIsConnected(false);
        }
      }, 100);
    };
  }, [canvasRef]); 

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
