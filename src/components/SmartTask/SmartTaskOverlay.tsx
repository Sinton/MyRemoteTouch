import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceService } from '../../services/deviceService';
import { useSmartTaskStore, InspectResult, TreeNode, Selector } from '../../store/useSmartTaskStore';
import { canvasPxToDevicePct } from '../../utils/coordTransform';
import { findNodeByCoord, findNodeById } from '../../utils/treeUtils';

interface SmartTaskOverlayProps {
  deviceW: number;
  deviceH: number;
}

/**
 * Visual Feedback for Recording: A pulse circle at click location
 */
const TapPulse: React.FC<{ x: number, y: number, onEnd: () => void }> = ({ x, y, onEnd }) => {
  useEffect(() => {
    const timer = setTimeout(onEnd, 600);
    return () => clearTimeout(timer);
  }, [onEnd]);

  return (
    <div 
      className="absolute border-4 border-[#0A84FF] rounded-full pointer-events-none z-[100]"
      style={{ 
        left: x - 20, 
        top: y - 20, 
        width: 40, height: 40, 
        animation: 'click-pulse 0.6s ease-out forwards' 
      }} 
    />
  );
};

const HighlightBox: React.FC<{
  node: TreeNode | null;
  deviceW: number;
  deviceH: number;
  variant: 'hover' | 'selected';
}> = ({ node, deviceW, deviceH, variant }) => {
  if (!node || deviceW === 0 || deviceH === 0) return null;

  const { x, y, width, height } = node.rect;
  const style: React.CSSProperties = {
    position: 'absolute',
    left:   `${(x / deviceW) * 100}%`,
    top:    `${(y / deviceH) * 100}%`,
    width:  `${(width / deviceW) * 100}%`,
    height: `${(height / deviceH) * 100}%`,
    pointerEvents: 'none',
    zIndex: variant === 'selected' ? 100 : 90,
  };

  const isSelected = variant === 'selected';
  const displayType = node.type.replace('XCUIElementType', '');

  return (
    <div style={style} className="transition-all duration-75">
      <div
        className={`absolute inset-0 border-2 ${
          isSelected
            ? 'border-orange-500 bg-orange-500/10 border-dashed'
            : 'border-[#0A84FF] bg-[#0A84FF]/5 shadow-[0_0_12px_rgba(10,132,255,0.3)]'
        }`}
      />
      <div
        className={`absolute left-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter whitespace-nowrap ${
          isSelected
            ? 'bg-orange-600 text-white -bottom-5'
            : 'bg-[#0A84FF] text-white -top-5'
        }`}
      >
        {displayType}{node.label ? ` · ${node.label}` : ''}
      </div>
    </div>
  );
};

const SmartTaskOverlay: React.FC<SmartTaskOverlayProps> = ({ deviceW, deviceH }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const {
    setHoverElement, hoverElement, isRecording, isRunning, activeTab, uiTree,
    hoverElementId, setHoverElementId, selectedElementId, setSelectedElementId,
    runnerEvent, draftTask, calibratingStepId, updateStep, setCalibratingStepId
  } = useSmartTaskStore();

  const [pulses, setPulses] = useState<{ id: number, x: number, y: number }[]>([]);
  const isInspectorMode = activeTab === 'inspector';

  // Mouse Follow State for Calibration
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const hoverNode = useMemo(
    () => (uiTree && hoverElementId ? findNodeById(uiTree, hoverElementId) : null),
    [uiTree, hoverElementId],
  );
  const selectedNode = useMemo(
    () => (uiTree && selectedElementId ? findNodeById(uiTree, selectedElementId) : null),
    [uiTree, selectedElementId],
  );

  const runningStepName = useMemo(() => {
    if (!isRunning || !runnerEvent?.step_id) return null;
    return draftTask.steps.find(s => s.id === runnerEvent.step_id)?.name || '执行中...';
  }, [isRunning, runnerEvent, draftTask.steps]);


  const getRelativePos = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const posToPt = useCallback((pos: { x: number; y: number }) => {
    const el = containerRef.current;
    if (!el) return { ptX: 0, ptY: 0 };
    const rect = el.getBoundingClientRect();
    return { ptX: (pos.x / rect.width) * deviceW, ptY: (pos.y / rect.height) * deviceH };
  }, [deviceW, deviceH]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const pos = getRelativePos(e);
    if (calibratingStepId) setMousePos(pos);
    
    if (dragStartRef.current) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

    hoverTimerRef.current = setTimeout(async () => {
      if (deviceW <= 0 || deviceH <= 0) return;
      if ((isInspectorMode || isRecording) && uiTree) {
        const { ptX, ptY } = posToPt(pos);
        const matchNode = findNodeByCoord(uiTree, ptX, ptY, deviceW, deviceH);
        setHoverElementId(matchNode?.path || null);
        return;
      }
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { xPct, yPct } = canvasPxToDevicePct(pos.x, pos.y, rect.width, rect.height);
      try {
        const result = await DeviceService.inspectElement(xPct, yPct, deviceW, deviceH);
        setHoverElement(result ?? null);
      } catch { setHoverElement(null); }
    }, 16);
  }, [deviceW, deviceH, setHoverElement, isInspectorMode, uiTree, setHoverElementId, posToPt, isRecording, calibratingStepId]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartRef.current = getRelativePos(e);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const pos = getRelativePos(e);
    const start = dragStartRef.current;
    dragStartRef.current = null;

    if (start && Math.abs(pos.x - start.x) < 5 && Math.abs(pos.y - start.y) < 5) {
      const { addStep } = useSmartTaskStore.getState();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { xPct, yPct } = canvasPxToDevicePct(pos.x, pos.y, rect.width, rect.height);
      
      setPulses(prev => [...prev, { id: Date.now(), x: pos.x, y: pos.y }]);

      // --- Mode A: Calibration (Re-targeting) ---
      if (calibratingStepId) {
        updateStep(calibratingStepId, {
          action: { type: 'tap', offset_x: xPct, offset_y: yPct }
        });
        setCalibratingStepId(null); 
        return;
      }

      // --- Mode B: Recording ---
      if (isRecording) {
        const bestLabel = hoverNode?.label || (hoverNode as any)?.value || (hoverNode as any)?.name;
        const typeFriendly = hoverNode?.type?.replace('XCUIElementType', '') || '';
        const stepName = bestLabel 
          ? `点击「${bestLabel}${typeFriendly ? ' ' + typeFriendly : ''}」`
          : `屏幕点击 (${(xPct*100).toFixed(0)}%, ${(yPct*100).toFixed(0)}%)`;

        addStep({
          id: `step-${Date.now().toString(36)}`,
          name: stepName,
          selector: { type: 'wda_predicate', value: "type == 'XCUIElementTypeWindow'" }, 
          action: { type: 'tap', offset_x: xPct, offset_y: yPct },
          pre_delay_ms: 0, post_delay_ms: 800, timeout_ms: 5000,
          on_success: { type: 'next', step_id: '' }, on_failure: 'retry',
        });
      } else if (isInspectorMode) {
        if (hoverElementId) setSelectedElementId(hoverElementId);
        else {
          const { ptX, ptY } = posToPt(pos);
          DeviceService.sendTap(ptX, ptY).catch(console.error);
        }
      }
    }
  }, [hoverElement, isRecording, isInspectorMode, hoverElementId, setSelectedElementId, posToPt, hoverNode, calibratingStepId, updateStep, setCalibratingStepId]);

  const handlePointerLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoverElement(null);
    setHoverElementId(null);
  }, [setHoverElement, setHoverElementId]);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-[50] cursor-crosshair"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />

      {/* --- Calibration Professional Overlay (Minimalist) --- */}
      {calibratingStepId && (
        <div className="absolute inset-0 z-[120] pointer-events-none overflow-hidden">
           {/* Horizontal Crosshair */}
           <div className="absolute left-0 right-0 h-[1px] bg-[#0A84FF]/40 shadow-[0_0_8px_rgba(10,132,255,0.8)]" style={{ top: mousePos.y }} />
           {/* Vertical Crosshair */}
           <div className="absolute top-0 bottom-0 w-[1px] bg-[#0A84FF]/40 shadow-[0_0_8px_rgba(10,132,255,0.8)]" style={{ left: mousePos.x }} />
           
           {/* Precision Info Box with Structural Integrity */}
           <div 
             className="absolute px-3 py-1.5 bg-black/80 backdrop-blur-md rounded border border-[#0A84FF]/40 text-white flex flex-col items-center gap-1 shadow-2xl transition-transform duration-75 min-w-[100px] z-[130]"
             style={{ 
               left: mousePos.x, 
               top: mousePos.y,
               transform: `translate(${mousePos.x > (containerRef.current?.offsetWidth || 0) * 0.7 ? '-110%' : '20px'}, ${mousePos.y > (containerRef.current?.offsetHeight || 0) * 0.8 ? '-110%' : '20px'})`
             }}
           >
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0A84FF] whitespace-nowrap">位置捕获中</span>
              <span className="text-[12px] font-mono font-black whitespace-nowrap">X: {(mousePos.x / (containerRef.current?.offsetWidth || 1) * 100).toFixed(1)}%</span>
              <span className="text-[12px] font-mono font-black whitespace-nowrap">Y: {(mousePos.y / (containerRef.current?.offsetHeight || 1) * 100).toFixed(1)}%</span>
           </div>

           <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#0A84FF] text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-2xl animate-pulse">
              点击目标位置以校准锚点
           </div>
        </div>
      )}

      {pulses.map(p => (
        <TapPulse key={p.id} x={p.x} y={p.y} onEnd={() => setPulses(prev => prev.filter(i => i.id !== p.id))} />
      ))}

      <div className="absolute inset-0 pointer-events-none z-[80]">
        {!calibratingStepId && (
           isInspectorMode ? (
            <>
              {hoverNode && <HighlightBox node={hoverNode} deviceW={deviceW} deviceH={deviceH} variant="hover" />}
              {selectedNode && <HighlightBox node={selectedNode} deviceW={deviceW} deviceH={deviceH} variant="selected" />}
            </>
          ) : (
            hoverElement && (
              <div
                className="absolute border-[1.5px] border-[#0A84FF] bg-[#0A84FF]/5 rounded shadow-[0_0_15px_rgba(10,132,255,0.4)] animate-in fade-in duration-100"
                style={{
                  left: `${hoverElement.x_pct * 100}%`, top: `${hoverElement.y_pct * 100}%`,
                  width: `${hoverElement.w_pct * 100}%`, height: `${hoverElement.h_pct * 100}%`,
                }}
              >
                <div className="absolute left-0 -top-5 px-1.5 py-0.5 bg-[#0A84FF] rounded text-[8px] font-black text-white uppercase tracking-widest whitespace-nowrap shadow-lg">
                  {hoverElement.type?.replace('XCUIElementType', '') || 'TARGET'}
                  {hoverElement.label ? ` · ${hoverElement.label}` : ''}
                </div>
              </div>
            )
          )
        )}
      </div>

      {isRunning && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[999] px-4 py-2 bg-black/90 border border-[#0A84FF]/30 rounded-full shadow-2xl flex items-center gap-3 animate-[status-slide-up_0.5s_ease-out]">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0A84FF] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0A84FF]"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-white/40 uppercase font-black tracking-tighter leading-none mb-0.5">Automation Sync</span>
            <span className="text-[11px] text-[#0A84FF] font-black tracking-tight tracking-tighter">
              {['executing', 'scanning', 'sleeping'].includes(String(runnerEvent?.state)) ? `正在步骤: ${runningStepName}` : '任务启动中...'}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default SmartTaskOverlay;
