import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceService } from '../../services/deviceService';
import { useSmartTaskStore, InspectResult, TreeNode } from '../../store/useSmartTaskStore';
import { canvasPxToDevicePct } from '../../utils/coordTransform';
import { findNodeByCoord, findNodeById } from '../../utils/treeUtils';
import RadialMenu from './RadialMenu';

interface SmartTaskOverlayProps {
  deviceW: number;
  deviceH: number;
}

interface RadialMenuState {
  x: number;
  y: number;
  element: InspectResult | null;
}

/**
 * HighlightBox — 纯 DOM 高亮框 (替代 Canvas 绘制)
 * 对标 Appium Inspector 的实现方式：直接用 div + 百分比定位覆盖在截图上。
 * 优势：无 Canvas 分辨率/时序问题，React 驱动自动刷新。
 */
const HighlightBox: React.FC<{
  node: TreeNode | null;
  deviceW: number;
  deviceH: number;
  variant: 'hover' | 'selected';
}> = ({ node, deviceW, deviceH, variant }) => {
  if (!node || deviceW === 0 || deviceH === 0) return null;

  const { x, y, width, height } = node.rect;
  // 使用百分比定位 —— 自动适配任何容器尺寸，零偏移
  const style: React.CSSProperties = {
    position: 'absolute',
    left:   `${(x / deviceW) * 100}%`,
    top:    `${(y / deviceH) * 100}%`,
    width:  `${(width / deviceW) * 100}%`,
    height: `${(height / deviceH) * 100}%`,
    pointerEvents: 'none',
    zIndex: variant === 'selected' ? 42 : 41,
    transition: 'all 60ms ease-out',
  };

  const isSelected = variant === 'selected';
  const displayType = node.type.replace('XCUIElementType', '');

  return (
    <div style={style}>
      {/* 边框 */}
      <div
        className={`absolute inset-0 border-2 ${
          isSelected
            ? 'border-orange-400 bg-orange-400/10 border-dashed'
            : 'border-sky-400 bg-sky-400/10 shadow-[0_0_12px_rgba(14,165,233,0.3)]'
        }`}
      />
      {/* 标签 Tooltip */}
      <div
        className={`absolute left-0 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${
          isSelected
            ? 'bg-orange-500 text-white -bottom-5'
            : 'bg-sky-500 text-white -top-5'
        }`}
        style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {displayType}
        {node.label ? ` · ${node.label}` : ''}
      </div>
    </div>
  );
};

const SmartTaskOverlay: React.FC<SmartTaskOverlayProps> = ({ deviceW, deviceH }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const {
    setHoverElement,
    hoverElement,
    setPendingRegion,
    isRecording,
    isRunning,
    activeTab,
    uiTree,
    hoverElementId,
    setHoverElementId,
    selectedElementId,
    setSelectedElementId,
  } = useSmartTaskStore();

  const [radialMenu, setRadialMenu] = useState<RadialMenuState | null>(null);

  const isInspectorMode = activeTab === 'inspector';

  // ─── 从 store 里查找当前 hover / selected 节点 ──────────────────────────────
  const hoverNode = useMemo(
    () => (uiTree && hoverElementId ? findNodeById(uiTree, hoverElementId) : null),
    [uiTree, hoverElementId],
  );
  const selectedNode = useMemo(
    () => (uiTree && selectedElementId ? findNodeById(uiTree, selectedElementId) : null),
    [uiTree, selectedElementId],
  );

  // ─── 坐标转换辅助 ─────────────────────────────────────────────────────────────

  const getRelativePos = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const posToPt = useCallback(
    (pos: { x: number; y: number }) => {
      const el = containerRef.current;
      if (!el) return { ptX: 0, ptY: 0 };
      const rect = el.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      if (cw === 0 || ch === 0) return { ptX: 0, ptY: 0 };
      return {
        ptX: (pos.x / cw) * deviceW,
        ptY: (pos.y / ch) * deviceH,
      };
    },
    [deviceW, deviceH],
  );

  // ─── 鼠标 Hover 处理 ────────────────────────────────────────────────────────

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartRef.current) return;

      const pos = getRelativePos(e);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      hoverTimerRef.current = setTimeout(async () => {
        if (deviceW <= 0 || deviceH <= 0) return;

        // 探测模式 + 有 UI 树 → 纯本地搜索 (0 网络延迟)
        if (isInspectorMode && uiTree) {
          const { ptX, ptY } = posToPt(pos);
          const matchNode = findNodeByCoord(uiTree, ptX, ptY, deviceW, deviceH);
          setHoverElementId(matchNode?.path || null);
          return;
        }

        // 录制模式 → 后端嗅探
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const { xPct, yPct } = canvasPxToDevicePct(pos.x, pos.y, rect.width, rect.height);
        try {
          const result = await DeviceService.inspectElement(xPct, yPct, deviceW, deviceH);
          setHoverElement(result ?? null);
        } catch {
          setHoverElement(null);
        }
      }, 16);
    },
    [deviceW, deviceH, setHoverElement, isInspectorMode, uiTree, setHoverElementId, posToPt],
  );

  // ─── 点击处理 ──────────────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setRadialMenu(null);
    dragStartRef.current = getRelativePos(e);
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const pos = getRelativePos(e);
      const start = dragStartRef.current;
      dragStartRef.current = null;

      // 判断是否为点击 (非拖拽)
      if (start && Math.abs(pos.x - start.x) < 5 && Math.abs(pos.y - start.y) < 5) {
        if (isRecording) {
          setRadialMenu({ x: pos.x, y: pos.y, element: hoverElement });
        } else if (isInspectorMode) {
          if (hoverElementId) {
            // 选中当前 hover 的节点
            setSelectedElementId(hoverElementId);
          } else {
            // 没有探测到节点 → 透传 Tap
            const { ptX, ptY } = posToPt(pos);
            DeviceService.sendTap(ptX, ptY).catch(console.error);
          }
        }
      }
    },
    [hoverElement, isRecording, isInspectorMode, hoverElementId, setSelectedElementId, posToPt],
  );

  const handlePointerLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoverElement(null);
    setHoverElementId(null);
  }, [setHoverElement, setHoverElementId]);

  return (
    <>
      {/* 事件捕获层 (透明 div, 覆盖整个屏幕) */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-[50] cursor-crosshair"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />

      {/* Hover 高亮框 (天蓝色) */}
      {isInspectorMode && hoverNode && (
        <HighlightBox node={hoverNode} deviceW={deviceW} deviceH={deviceH} variant="hover" />
      )}

      {/* Selected 高亮框 (橙色虚线) */}
      {isInspectorMode && selectedNode && (
        <HighlightBox node={selectedNode} deviceW={deviceW} deviceH={deviceH} variant="selected" />
      )}

      {/* 录制模式 Hover (旧逻辑兼容) */}
      {!isInspectorMode && hoverElement && (
        <div
          className="absolute border-2 border-purple-400 bg-purple-400/10 pointer-events-none z-[41]"
          style={{
            left:   `${hoverElement.x_pct * 100}%`,
            top:    `${hoverElement.y_pct * 100}%`,
            width:  `${hoverElement.w_pct * 100}%`,
            height: `${hoverElement.h_pct * 100}%`,
          }}
        />
      )}

      {/* 径向操作菜单 */}
      {radialMenu && (
        <RadialMenu
          x={radialMenu.x}
          y={radialMenu.y}
          element={radialMenu.element}
          onClose={() => setRadialMenu(null)}
        />
      )}
    </>
  );
};

export default SmartTaskOverlay;
