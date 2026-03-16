import React, { useRef, useState, PointerEvent } from 'react';
import { Point, TouchPoint, WindowSize } from '../types/global';
import { DeviceService } from '../services/deviceService';
import { TouchDebugger } from '../utils/touchDebug';

/**
 * Hook to handle touch inputs, coordinate mapping, and command dispatching.
 */
export const useTouchController = (
  canvasRef: React.RefObject<HTMLCanvasElement>, 
  deviceSize: WindowSize
) => {
  const [tapMarker, setTapMarker] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);  // 添加处理状态
  
  const isDraggingRef = useRef(false);
  const trajectoryRef = useRef<TouchPoint[]>([]);
  const lastSampleTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const mouseDownPos = useRef<TouchPoint | null>(null);
  const lastTapTimeRef = useRef(0);  // 添加防抖
  const pendingRequestRef = useRef(false);  // 防止并发请求

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
    // 提高采样频率到 30fps (33ms)，更好地捕捉快速滑动
    if (now - lastSampleTimeRef.current < 33) return;
    lastSampleTimeRef.current = now;
    
    const pos = getCoord(clientX, clientY);
    const lastPoint = trajectoryRef.current[trajectoryRef.current.length - 1];
    // 只有当坐标真正变化时才添加新点，避免重复点
    if (!lastPoint || lastPoint.x !== pos.x || lastPoint.y !== pos.y) {
       trajectoryRef.current.push({ ...pos, time: Date.now() });
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !(window as any).__TAURI__) {
      TouchDebugger.log('PointerDown ignored', { button: e.button, hasTauri: !!(window as any).__TAURI__ });
      return;
    }
    
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    
    isDraggingRef.current = true;
    trajectoryRef.current = [];
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    // Scale mapping between rendered size and actual CSS pixels
    const scaleX = canvas.offsetWidth / rect.width;
    const scaleY = canvas.offsetHeight / rect.height;
    
    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;
    
    const pos = getCoord(e.clientX, e.clientY);
    mouseDownPos.current = { ...pos, time: Date.now() };
    
    TouchDebugger.log('PointerDown', { 
      device: pos, 
      client: { x: e.clientX, y: e.clientY },
      deviceSize 
    });
    
    samplePointer(e.clientX, e.clientY);
    
    setTapMarker({ x: localX, y: localY });
    
    setTimeout(() => setTapMarker(null), 300);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.offsetWidth / rect.width;
    const scaleY = canvas.offsetHeight / rect.height;

    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;

    setMousePos({ x: localX, y: localY });

    if (!isDraggingRef.current) return;
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      samplePointer(e.clientX, e.clientY);
    });
  };

  const onPointerUp = async (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !(window as any).__TAURI__) {
      TouchDebugger.log('PointerUp ignored', { isDragging: isDraggingRef.current, hasTauri: !!(window as any).__TAURI__ });
      return;
    }
    isDraggingRef.current = false;
    
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    
    samplePointer(e.clientX, e.clientY);
    
    const trajectory = trajectoryRef.current;
    if (trajectory.length === 0 || !mouseDownPos.current) {
      TouchDebugger.error('No trajectory data', { trajectoryLength: trajectory.length, hasMouseDown: !!mouseDownPos.current });
      return;
    }
    
    const duration = Date.now() - mouseDownPos.current.time;
    const startPoint = trajectory[0];
    const endPoint = trajectory[trajectory.length - 1];
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    TouchDebugger.log('PointerUp', { 
      duration, 
      distance, 
      trajectoryLength: trajectory.length,
      start: startPoint,
      end: endPoint
    });

    try {
      // 如果有请求正在处理，忽略新请求
      if (pendingRequestRef.current) {
        TouchDebugger.log('请求正在处理中，忽略本次操作');
        return;
      }
      
      setIsProcessing(true);  // 显示处理状态
      
      if (distance < 5 && duration < 300) {
        // 防抖：如果距离上次点击不到 300ms，忽略
        const now = Date.now();
        if (now - lastTapTimeRef.current < 300) {
          TouchDebugger.log('TAP 被防抖忽略', { timeSinceLastTap: now - lastTapTimeRef.current });
          setIsProcessing(false);
          return;
        }
        lastTapTimeRef.current = now;
        
        TouchDebugger.log('Sending TAP', { x: startPoint.x, y: startPoint.y });
        pendingRequestRef.current = true;
        await DeviceService.sendTap(startPoint.x, startPoint.y);
        pendingRequestRef.current = false;
        setIsProcessing(false);
        TouchDebugger.log('TAP sent successfully');
      } else {
        TouchDebugger.log('Sending SWIPE', { points: trajectory.length });
        pendingRequestRef.current = true;
        await DeviceService.sendTouchActions(trajectory);
        pendingRequestRef.current = false;
        setIsProcessing(false);
        TouchDebugger.log('SWIPE sent successfully');
      }
    } catch (err) {
      pendingRequestRef.current = false;
      setIsProcessing(false);
      TouchDebugger.error("Touch action failed", err);
      console.error("Touch action failed:", err);
    }
    
    trajectoryRef.current = [];
    mouseDownPos.current = null;
  };

  return {
    tapMarker,
    mousePos,
    isProcessing,  // 导出处理状态
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp
  };
};
