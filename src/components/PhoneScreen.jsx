import React, { useEffect, useRef, useState } from 'react';
import Toolbar from './Toolbar';

const invoke = window.__TAURI__?.core?.invoke || (() => Promise.resolve());

const PhoneScreen = ({ isDragging }) => {
  const screenImgRef = useRef(null);
  const [deviceSize, setDeviceSize] = useState({ width: 390, height: 844 });
  const [imgSrc, setImgSrc] = useState("http://localhost:9100");
  const [isConnected, setIsConnected] = useState(false);
  const [tapMarker, setTapMarker] = useState(null);
  const mouseDownPos = useRef(null);

  useEffect(() => {
    const initDeviceInfo = async () => {
      try {
        if (!window.__TAURI__) return;
        const size = await invoke("get_window_size");
        if (size) {
          setDeviceSize({ width: size.width, height: size.height });
        }
      } catch (err) {
        console.error("无法获取设备分辨率:", err);
      }
    };
    initDeviceInfo();
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !window.__TAURI__) return;
      let key = e.key;
      if (key === "Enter") key = "\n";
      if (key === "Backspace") key = "\b";
      if (key.length === 1 || key === "\n" || key === "\b") {
        try {
          await invoke("send_keys", { key });
        } catch (err) {}
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getCoord = (clientX, clientY) => {
    if (!screenImgRef.current) return { x: 0, y: 0 };
    const rect = screenImgRef.current.getBoundingClientRect();
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

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    const container = document.getElementById("screen-container");
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    mouseDownPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    
    setTapMarker({ x, y });
    setTimeout(() => setTapMarker(null), 300);
  };

  const handlePointerUp = async (e) => {
    if (!mouseDownPos.current || !window.__TAURI__) return;
    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    const duration = Date.now() - mouseDownPos.current.time;
    const distance = Math.sqrt(dx * dx + dy * dy);

    try {
      if (distance < 5 && duration < 300) {
        const pos = getCoord(e.clientX, e.clientY);
        await invoke("send_tap", { x: pos.x, y: pos.y });
      } else if (distance > 10) {
        const from = getCoord(mouseDownPos.current.x, mouseDownPos.current.y);
        const to = getCoord(e.clientX, e.clientY);
        await invoke("send_swipe", { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y });
      }
    } catch (err) {}
    mouseDownPos.current = null;
  };

  return (
    <div className="phone-container">
      <div className="mute-switch"></div>
      <div className="volume-up"></div>
      <div className="volume-down"></div>
      <div className="power-button"></div>
      <div className="notch">
        <div className="speaker"></div>
        <div className="camera"></div>
      </div>
      
      <div id="screen-container">
        {!isConnected && (
          <div className="screen-placeholder">
             <div className="spinner"></div>
             <span>等待连接...</span>
          </div>
        )}
        <img 
          id="screen-img"
          ref={screenImgRef}
          src={imgSrc} 
          alt="" 
          style={{ display: isConnected ? 'block' : 'none', cursor: 'pointer' }}
          onLoad={() => setIsConnected(true)}
          onError={() => {
            setIsConnected(false);
            setTimeout(() => setImgSrc("http://localhost:9100?t=" + Date.now()), 1000);
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          draggable="false"
        />
        {tapMarker && (
          <div className="tap-ripple" style={{ left: tapMarker.x, top: tapMarker.y }} />
        )}
      </div>
    </div>
  );
};

export default PhoneScreen;
