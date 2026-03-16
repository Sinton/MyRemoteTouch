import React, { useState, useEffect, useRef } from 'react';
import { TouchDebugger } from '../utils/touchDebug';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/useAppStore';

interface WdaDiagnostics {
  wda_reachable: boolean;
  session_id: string;
  session_valid: boolean;
  error_message?: string;
}

export const TouchDebugPanel: React.FC = () => {
  const { isDeveloperMode, isTouchDebugOpen, setIsTouchDebugOpen, toolbarPosition } = useAppStore();
  const [logs, setLogs] = useState<string[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 监控手动滚动，判断是否开启自动滚动
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // 如果距离底部小于 50px，则认为用户希望保持自动滚动
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAutoScrollEnabled(isAtBottom);
    }
  };

  // 自动滚动到底部
  useEffect(() => {
    if (isTouchDebugOpen && isAutoScrollEnabled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isTouchDebugOpen, isAutoScrollEnabled]);

  useEffect(() => {
    if (!isTouchDebugOpen) return;
    
    // 缩短轮询间隔至 200ms 以实现更好的实时感
    const interval = setInterval(() => {
      setLogs(TouchDebugger.getLogs());
    }, 200);

    return () => clearInterval(interval);
  }, [isTouchDebugOpen]);

  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    TouchDebugger.log('开始运行诊断...');
    try {
      const result = await invoke<WdaDiagnostics>('diagnose_wda_connection');
      TouchDebugger.log('诊断结果:', result);
      if (!result.wda_reachable) {
        TouchDebugger.error('WDA 服务不可达', result.error_message);
      } else if (!result.session_valid) {
        TouchDebugger.error('Session 无效', `Session ID: ${result.session_id}`);
      } else {
        TouchDebugger.log(`连接正常 - Session: ${result.session_id}`);
      }
    } catch (err) {
      TouchDebugger.error('诊断失败', err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  if (!isDeveloperMode) return null;

  const getMagnetStyles = () => {
    const base = 'fixed transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] bg-white/5 hover:bg-white/10 backdrop-blur-2xl border-white/10 text-white/40 hover:text-white/80 shadow-2xl group z-[9999] flex items-center gap-3 overflow-hidden';
    
    switch (toolbarPosition) {
      case 'left':
        return `${base} left-0 bottom-8 flex-col px-1.5 py-6 rounded-r-xl border-y border-r`;
      case 'right':
        return `${base} right-0 bottom-8 flex-col px-1.5 py-6 rounded-l-xl border-y border-l`;
      case 'top':
        return `${base} top-0 right-8 flex-row px-6 py-1.5 rounded-b-xl border-x border-b`;
      case 'bottom':
      default:
        return `${base} bottom-0 right-8 flex-row px-6 py-1.5 rounded-t-xl border-x border-t`;
    }
  };

  const isVerticalMagnet = toolbarPosition === 'left' || toolbarPosition === 'right';

  return (
    <>
      {/* 磁吸切换按钮 */}
      {!isTouchDebugOpen && (
        <button
          onClick={() => setIsTouchDebugOpen(true)}
          className={getMagnetStyles()}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.6)]"></span>
          <span className={`${isVerticalMagnet ? '[writing-mode:vertical-lr]' : ''} text-[10px] font-black tracking-[0.25em] uppercase italic`}>
            Debug
          </span>
          <svg className={`w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity ${isVerticalMagnet ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
          </svg>
        </button>
      )}

      {/* 侧滑调试面板 */}
      <div 
        className={`fixed top-0 left-0 w-[450px] h-screen bg-black/40 backdrop-blur-[45px] saturate-[180%] border-r border-white/10 shadow-[30px_0_60px_rgba(0,0,0,0.4)] z-[10000] transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex flex-col overflow-hidden
          ${isTouchDebugOpen ? 'translate-x-0' : 'translate-x-[-450px]'}`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-4 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
            <h3 className="text-[16px] font-black text-white/90 uppercase tracking-widest italic">调试控制台</h3>
          </div>
          
          <button
            onClick={() => setIsTouchDebugOpen(false)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg border border-white/5 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
        </div>
        
        {/* 日志内容区域 - 增加滚动监听和文本选择支持 */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-1.5 custom-scrollbar-wrapper bg-black/10 select-text selection:bg-amber-500/30 selection:text-white"
        >
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/10 gap-8">
              <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <span className="uppercase tracking-[0.4em] font-black opacity-40 text-[10px]">正在等待日志输入...</span>
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`p-2.5 rounded-lg border border-white/5 leading-relaxed break-all animate-[slide-in-left_0.4s_ease-out] select-text
                  ${log.includes('[ERROR]') ? 'bg-red-500/10 text-red-300/80 border-red-500/20' : 
                    log.includes('成功') || log.includes('正常') ? 'bg-emerald-500/10 text-emerald-300/80 border-emerald-500/20' : 
                    'bg-white/5 text-emerald-400/90'}`}
              >
                <div className="flex gap-2">
                  <span className="opacity-20 font-black tabular-nums shrink-0 text-[10px]">{ (index + 1).toString().padStart(3, '0') }</span>
                  <span>{log}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部操作栏 - 三按钮右对齐 */}
        <div className="p-6 border-t border-white/5 bg-black/40 flex justify-end gap-3">
          <button
            onClick={runDiagnostics}
            disabled={isDiagnosing}
            className={`px-5 py-2.5 rounded-lg text-white text-[12px] font-black uppercase tracking-widest transition-all active:scale-95 border
              ${isDiagnosing ? 'bg-white/5 text-white/20 border-white/5' : 'bg-[#0A84FF]/10 text-[#0A84FF] hover:bg-[#0A84FF]/20 border-[#0A84FF]/20'}`}
          >
            {isDiagnosing ? '诊断中' : '运行诊断'}
          </button>
          
          <button 
            onClick={() => TouchDebugger.downloadLogs()}
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[12px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            导出日志
          </button>
          
          <button
            onClick={() => {
              TouchDebugger.clear();
              setLogs([]);
            }}
            className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 rounded-lg text-[12px] font-black uppercase tracking-widest transition-all"
          >
            清空
          </button>
        </div>
      </div>
    </>
  );
};
