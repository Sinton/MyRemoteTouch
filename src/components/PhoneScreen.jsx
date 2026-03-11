import React, { useEffect, useRef, useState } from 'react';

const invoke = window.__TAURI__?.core?.invoke || (() => Promise.resolve());

const PhoneScreen = () => {
  const screenImgRef = useRef(null);
  const [deviceSize, setDeviceSize] = useState({ width: 390, height: 844 });
  const [imgSrc, setImgSrc] = useState("http://localhost:9100");
  const [isConnected, setIsConnected] = useState(false);
  const mouseDownPos = useRef(null);

  useEffect(() => {
    // 1. 初始化：获取真实的手机分辨率
    const initDeviceInfo = async () => {
      try {
        if (!window.__TAURI__) return;
        const size = await invoke("get_window_size");
        if (size) {
          setDeviceSize({ width: size.width, height: size.height });
          console.log(`设备分辨率已同步: ${size.width}x${size.height}`);
        }
      } catch (err) {
        console.error("无法获取设备分辨率:", err);
      }
    };
    initDeviceInfo();
  }, []);

  useEffect(() => {
    // 4. 键盘交互：同步输入
    const handleKeyDown = async (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !window.__TAURI__) return;
      
      let key = e.key;
      if (key === "Enter") key = "\n";
      if (key === "Backspace") key = "\b";

      if (key.length === 1 || key === "\n" || key === "\b") {
        try {
          await invoke("send_keys", { key });
        } catch (err) {
          console.error("按键发送失败:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMouseDown = (e) => {
    // 阻止拉拽图片
    e.preventDefault();
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = async (e) => {
    if (!mouseDownPos.current || !screenImgRef.current || !window.__TAURI__) return;

    const rect = screenImgRef.current.getBoundingClientRect();
    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const getCoord = (clientX, clientY) => ({
      x: Math.round(((clientX - rect.left) / rect.width) * deviceSize.width),
      y: Math.round(((clientY - rect.top) / rect.height) * deviceSize.height)
    });

    try {
      if (distance < 10) {
        // 点击
        const pos = getCoord(e.clientX, e.clientY);
        await invoke("send_tap", { x: pos.x, y: pos.y });
      } else {
        // 滑动
        const from = getCoord(mouseDownPos.current.x, mouseDownPos.current.y);
        const to = getCoord(e.clientX, e.clientY);
        await invoke("send_swipe", { 
          fromX: from.x, fromY: from.y, 
          toX: to.x, toY: to.y 
        });
      }
    } catch (err) {
      console.error("操作执行失败:", err);
    }
    mouseDownPos.current = null;
  };

  const handleImageLoad = () => {
    setIsConnected(true);
  };

  const handleImageError = () => {
    setIsConnected(false);
    setTimeout(() => {
      setImgSrc("http://localhost:9100?t=" + Date.now());
    }, 1000);
  };

  return (
    <div className="phone-container">
      {/* Hardware Buttons */}
      <div className="volume-up"></div>
      <div className="volume-down"></div>
      <div className="power-button"></div>
      
      {/* Notch */}
      <div className="notch">
        <div className="speaker"></div>
        <div className="camera"></div>
      </div>
      
      <div className="status-bar">
        <div className="status-left">
           <span className="status-dot"></span>
           MyRemoteTouch
        </div>
        <div className="status-right">
          <svg className="signal-icon" fill="currentColor" viewBox="0 0 24 24" width="14" height="14">
            <path d="M2 22h20V2z"/>
          </svg>
          <div className="battery"></div>
        </div>
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
          style={{ display: isConnected ? 'block' : 'none' }}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onPointerDown={handleMouseDown}
          onPointerUp={handleMouseUp}
          draggable="false"
        />
      </div>
    </div>
  );
};

export default PhoneScreen;
