import React, { useState, useRef, useEffect } from 'react';
import Toolbar from './Toolbar';
import Phone from './Phone';
import Settings from './Settings';
import { useAppStore } from '../store/useAppStore';
import { DeviceService } from '../services/deviceService';
import { WindowSize } from '../types/global';
import SmartTaskOverlay from './SmartTask/SmartTaskOverlay';
import SmartTaskSidebar from './SmartTask/SmartTaskSidebar';
import { useSmartTaskStore } from '../store/useSmartTaskStore';

/**
 * PhoneWorkbench - The Management Layer
 * Handles layout orientation, toolbar positioning, and coordination.
 */
const PhoneWorkbench: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showSmartTask, setShowSmartTask] = useState(false);
  const {
    toolbarPosition: toolbarPos,
    setToolbarPosition: setToolbarPos,
  } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [fps, setFps] = useState(0);
  const [bitrate, setBitrate] = useState(0);
  const [deviceSize, setDeviceSize] = useState<WindowSize>({ width: 390, height: 844 });
  const phoneRef = useRef<HTMLDivElement>(null);

  // --- SmartTask Global States ---
  const { isRecording, activeTab, calibratingStepId, sidebarWidth, inspectorWidth } = useSmartTaskStore();

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const initDeviceInfo = async () => {
      try {
        if (!(window as any).__TAURI__) return;
        const size = await DeviceService.getWindowSize();
        if (size) {
          setDeviceSize({ width: size.width, height: size.height });
        }
      } catch (err) { }
    };
    initDeviceInfo();
  }, []);

  // 窗口自动伸缩控制 (Discrete Window Redimensioning)
  useEffect(() => {
    const resizeWindow = async () => {
      if (!(window as any).__TAURI__) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let targetW = 500;
        const targetH = 950;

        if (showSmartTask) {
          // 仅在切换模式（流水线/探测器）时，根据当前面板宽度设定窗口目标尺寸
          if (activeTab === 'tasks') targetW = sidebarWidth + 500;
          else if (activeTab === 'inspector') targetW = sidebarWidth + inspectorWidth + 500;
        }

        console.info(`[CONTEXTUAL] Window Transformation: ${targetW}x${targetH} (Tab: ${activeTab})`);
        await invoke('resize_window', { width: targetW, height: targetH });
      } catch (err) { }
    };
    resizeWindow();
  }, [showSmartTask, activeTab]); // 关键点：移除了 sidebarWidth/inspectorWidth 监听，防止手动拉动时窗体抖动

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging || !phoneRef.current) return;
      const rect = phoneRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > absY * 1.2) {
        setToolbarPos(dx > 0 ? 'right' : 'left');
      } else if (absY > absX * 1.2) {
        setToolbarPos(dy > 0 ? 'bottom' : 'top');
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const [isProcessingHardware, setIsProcessingHardware] = useState(false);

  const pressHome = async () => {
    if (isProcessingHardware) return;
    setIsProcessingHardware(true);
    try { await DeviceService.pressHome(); } finally { setIsProcessingHardware(false); }
  };

  const pressVolumeUp = async () => {
    if (isProcessingHardware) return;
    setIsProcessingHardware(true);
    try { await DeviceService.pressVolumeUp(); } finally { setIsProcessingHardware(false); }
  };

  const pressVolumeDown = async () => {
    if (isProcessingHardware) return;
    setIsProcessingHardware(true);
    try { await DeviceService.pressVolumeDown(); } finally { setIsProcessingHardware(false); }
  };

  const pressMute = () => DeviceService.pressMute();

  const pressLock = async () => {
    if (isProcessingHardware) return;
    setIsProcessingHardware(true);
    try { await DeviceService.toggleLock(); } finally { setIsProcessingHardware(false); }
  };

  const getLayoutClasses = () => {
    const base = "flex gap-[15px] items-center justify-center p-0 transition-all duration-500 ease-[cubic-bezier(0.18,0.89,0.32,1.28)]";
    const posDirs: Record<string, string> = {
      top: "flex-col",
      bottom: "flex-col-reverse",
      left: "flex-row",
      right: "flex-row-reverse",
    };
    return `${base} ${posDirs[toolbarPos]}`;
  };

  // 动态内边距计算
  const dynamicPadding = showSmartTask 
    ? {
        paddingLeft: `${sidebarWidth + 40}px`,
        paddingRight: activeTab === 'inspector' ? `${inspectorWidth + 40}px` : '40px'
      }
    : { padding: '40px' };

  return (
    <>
      <div
        className="flex justify-center items-center h-screen w-screen box-border overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.18,0.89,0.32,1.28)]"
        style={{ 
          cursor: isDragging ? 'grabbing' : 'default',
          ...dynamicPadding
        }}
      >
        <div className={getLayoutClasses()}>
          <Toolbar
            onSettingsClick={() => setShowSettings(!showSettings)}
            onSmartTaskClick={() => setShowSmartTask(!showSmartTask)}
            isSmartTaskActive={showSmartTask}
            onDragStart={handleDragStart}
            position={toolbarPos}
            isDragging={isDragging}
            onHomeClick={pressHome}
            onVolumeUpClick={pressVolumeUp}
            onVolumeDownClick={pressVolumeDown}
            onMuteClick={pressMute}
            onLockClick={pressLock}
            isProcessingHardware={isProcessingHardware}
            fps={fps}
            bitrate={bitrate}
          />

          <div className="relative" ref={phoneRef}>
            <Phone
              deviceSize={deviceSize}
              toolbarPosition={toolbarPos}
              setFps={setFps}
              setBitrate={setBitrate}
            >
              {/* SmartTask 浮层：满足任一模式即加载，拦截屏幕点击 */}
              {showSmartTask && (isRecording || activeTab === 'inspector' || !!calibratingStepId) && (
                <SmartTaskOverlay
                  deviceW={deviceSize.width}
                  deviceH={deviceSize.height}
                />
              )}
            </Phone>
          </div>
        </div>

      </div>

      <Settings visible={showSettings} onClose={() => setShowSettings(false)} />

      {showSmartTask && (
        <SmartTaskSidebar
          visible={showSmartTask}
          onClose={() => setShowSmartTask(false)}
          deviceSize={deviceSize}
        />
      )}
    </>
  );
};

export default PhoneWorkbench;
