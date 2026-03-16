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
        {/* Header - Ultra-compressed */}
        <div className="flex justify-between items-center px-5 py-2.5 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-2">
            <div className="w-[2.5px] h-3.5 bg-amber-500 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
            <h3 className="text-[14px] font-black text-white/90 uppercase tracking-widest italic">调试控制台</h3>
          </div>
          
          <button
            onClick={() => setIsTouchDebugOpen(false)}
            className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg border border-white/5 transition-all active:scale-90 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            logs.map((log, index) => {
              const isError = log.includes('[ERROR]');
              const isSuccess = log.includes('成功') || log.includes('正常');
              const isWda = log.includes('WDA');
              
              // 尝试提取时间戳和内容 (假设格式为 ISO 字符串开头或特定分隔符)
              // 这里我们直接根据字符串特征进行更精细的渲染
              return (
                <div
                  key={index}
                  className={`group relative mt-3 flex items-start gap-3 px-4 py-3 rounded-xl border border-white/5 transition-all duration-300 hover:bg-white/[0.03] animate-[slide-in-left:0.3s_ease-out]
                    ${isError ? 'bg-red-500/[0.08] border-red-500/20 shadow-[0_4px_20px_rgba(239,68,68,0.05)]' : 
                      isSuccess ? 'bg-emerald-500/[0.08] border-emerald-500/20 shadow-[0_4px_20px_rgba(16,185,129,0.05)]' : 
                      isWda ? 'bg-blue-500/[0.08] border-blue-500/20' : 'bg-white/[0.02]'}`}
                >
                  {/* 第一类“数字标签”：悬浮于上边框正中间，完全不影响选择 */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none z-10 px-1 bg-[#1a1a1c]">
                    <span className="text-[10px] font-black text-white/10 tabular-nums leading-none tracking-tight">
                      { (index + 1).toString().padStart(3, '0') }
                    </span>
                  </div>

                  {/* 主内容区域 */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* 头部：Level 标签 */}
                    <div className="flex items-center gap-2 select-none pointer-events-none">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.15em] leading-none
                        ${isError ? 'bg-red-500 text-white' : 
                          isSuccess ? 'bg-emerald-500 text-white' : 
                          isWda ? 'bg-[#0A84FF] text-white' : 'bg-white/10 text-white/40'}`}>
                        {isError ? 'ERR' : isSuccess ? 'OK' : isWda ? 'WDA' : 'LOG'}
                      </span>
                    </div>

                    {/* 正文：内容占满全宽 */}
                    <div className={`text-[11px] leading-relaxed break-all select-text
                      ${isError ? 'text-red-300/90' : isSuccess ? 'text-emerald-300/90' : 'text-white/80'}`}>
                      {log}
                    </div>
                  </div>

                  {/* 状态装饰装饰：放在最左边作为点缀 */}
                  <div className={`absolute left-0 top-[30%] bottom-[30%] w-[1.5px] rounded-full transition-all duration-500
                    ${isError ? 'bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.5)]' : 
                      isSuccess ? 'bg-emerald-500 opacity-60' : 
                      'bg-white/10 opacity-40'}`} />
                </div>
              );
            })
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
