import React, { useRef, useState, PointerEvent } from 'react';
import { Point, TouchPoint, WindowSize } from '../types/global';

const invoke = (window as any).__TAURI__?.core?.invoke || (() => Promise.resolve());

/**
 * Hook to handle touch inputs, coordinate mapping, and command dispatching.
 */
export const useTouchController = (
  canvasRef: React.RefObject<HTMLCanvasElement>, 
  deviceSize: WindowSize
) => {
  const [tapMarker, setTapMarker] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  
  const isDraggingRef = useRef(false);
  const trajectoryRef = useRef<TouchPoint[]>([]);
  const lastSampleTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const mouseDownPos = useRef<TouchPoint | null>(null);

  /**
   * Maps client (browser) coordinates to original device coordinates.
   */
  const getCoord = (clientX: number, clientY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const containerRatio = rect.width / rect.height;
    const deviceRatio = deviceSize.width / deviceSize.height;
    
    let actualWidth, actualHeight, offsetX, offsetY;
    if (containerRatio > deviceRatio) {
      actualHeight = rect.height;
      actualWidth = actualHeight * deviceRatio;
      offsetX = (rect.width - actualWidth) / 2;
      offsetY = 0;
    } else {
      actualWidth = rect.width;
      actualHeight = actualWidth / deviceRatio;
      offsetX = 0;
      offsetY = (rect.height - actualHeight) / 2;
    }

    const relX = (clientX - rect.left - offsetX) / actualWidth;
    const relY = (clientY - rect.top - offsetY) / actualHeight;

    return {
      x: Math.max(0, Math.min(deviceSize.width, Math.round(relX * deviceSize.width))),
      y: Math.max(0, Math.min(deviceSize.height, Math.round(relY * deviceSize.height)))
    };
  };

  const samplePointer = (clientX: number, clientY: number) => {
    const now = performance.now();
    if (now - lastSampleTimeRef.current < 16) return;
    lastSampleTimeRef.current = now;
    
    const pos = getCoord(clientX, clientY);
    const lastPoint = trajectoryRef.current[trajectoryRef.current.length - 1];
    if (!lastPoint || lastPoint.x !== pos.x || lastPoint.y !== pos.y) {
       trajectoryRef.current.push({ ...pos, time: Date.now() });
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !(window as any).__TAURI__) return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    
    isDraggingRef.current = true;
    trajectoryRef.current = [];
    
    const pos = getCoord(e.clientX, e.clientY);
    mouseDownPos.current = { ...pos, time: Date.now() };
    
    samplePointer(e.clientX, e.clientY);
    
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    setTapMarker({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setTapMarker(null), 300);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (!isDraggingRef.current) return;
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      samplePointer(e.clientX, e.clientY);
    });
  };

  const onPointerUp = async (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !(window as any).__TAURI__) return;
    isDraggingRef.current = false;
    
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    
    samplePointer(e.clientX, e.clientY);
    
    const trajectory = trajectoryRef.current;
    if (trajectory.length === 0 || !mouseDownPos.current) return;
    
    const duration = Date.now() - mouseDownPos.current.time;
    const startPoint = trajectory[0];
    const endPoint = trajectory[trajectory.length - 1];
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    try {
      if (distance < 5 && duration < 300) {
        await invoke("send_tap", { x: startPoint.x, y: startPoint.y });
      } else {
        await invoke("send_touch_actions", { actions: trajectory });
      }
    } catch (err) {
      console.error("Touch action failed:", err);
    }
    
    trajectoryRef.current = [];
    mouseDownPos.current = null;
  };

  return {
    tapMarker,
    mousePos,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp
  };
};
