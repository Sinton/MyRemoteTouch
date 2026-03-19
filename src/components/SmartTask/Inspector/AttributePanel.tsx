import React, { useState, useMemo } from 'react';
import { TreeNode } from '../../../store/useSmartTaskStore';
import { DeviceService } from '../../../services/deviceService';
import { isNodeOffScreen } from '../../../utils/treeUtils';

interface AttributeBlockProps {
  label: string;
  value: string | number | undefined;
  mono?: boolean;
  loading?: boolean;
}

// 辅助函数：首字母大写，保留后续的驼峰 (例如 elementId -> ElementId, type -> Type)
const capitalizeLabel = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const AttributeBlock: React.FC<AttributeBlockProps> = ({ label, value, mono, loading }) => {
  let displayValue = value === undefined || value === null || value === '' ? undefined : String(value);

  const isBoolTrue = displayValue === 'true' || displayValue === '1';
  const isBoolFalse = displayValue === 'false' || displayValue === '0';

  if (isBoolTrue) displayValue = 'true';
  if (isBoolFalse) displayValue = 'false';

  return (
    <div className="flex flex-col gap-0.5 py-1.5 px-3 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01] transition-colors">
      <span className="text-[10px] font-medium text-white/30 tracking-tight">{capitalizeLabel(label)}</span>
      <span className={`text-[11px] leading-snug min-h-[14px] flex items-center break-all ${mono ? 'font-mono' : ''} ${isBoolTrue ? 'text-emerald-400/80' : isBoolFalse ? 'text-red-400/40' : 'text-white/70'}`}>
        {loading ? (
          <span className="flex items-center gap-1.5 text-blue-400 animate-pulse">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
            </svg>
            <span className="text-[9px] font-bold tracking-widest">获取中...</span>
          </span>
        ) : (
          displayValue ?? <span className="italic text-white/10">—</span>
        )}
      </span>
    </div>
  );
};

interface AttributePanelProps {
  selectedNode: TreeNode | null;
  isIdFetching?: boolean;
  deviceW?: number;
  deviceH?: number;
  onRefreshSource?: () => Promise<void>;
}

const CORE_ATTR_KEYS = [
  'type', 'label', 'name', 'value',
  'enabled', 'visible', 'accessible',
  'index', 'x', 'y', 'width', 'height',
];

const AttributePanel: React.FC<AttributePanelProps> = ({ 
  selectedNode, isIdFetching, deviceW = 0, deviceH = 0, onRefreshSource 
}) => {
  const [isScrolling, setIsScrolling] = useState(false);

  const isOffScreen = useMemo(() => {
    if (!selectedNode || !deviceW || !deviceH) return false;
    return isNodeOffScreen(selectedNode, deviceW, deviceH);
  }, [selectedNode, deviceW, deviceH]);

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-3 p-8 text-center">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5 animate-pulse">
          <svg className="w-4 h-4 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
          </svg>
        </div>
        <p className="text-white/20 text-[11px] font-medium leading-relaxed">在探测视图任意位置点击元素<br />解锁完整的属性矩阵</p>
      </div>
    );
  }

  const handleScrollToVisible = async () => {
    if (!selectedNode || !onRefreshSource || !deviceW || !deviceH) return;
    setIsScrolling(true);
    try {
      const targetY = selectedNode.rect.y + selectedNode.rect.height / 2;
      const centerY = deviceH / 2;
      const trajectory = [];
      const startTime = Date.now();
      const dy = targetY - centerY;
      const maxSwipe = deviceH * 0.6;
      const actualDy = Math.max(-maxSwipe, Math.min(maxSwipe, dy));
      
      for (let i = 0; i <= 10; i++) {
        const progress = i / 10;
        trajectory.push({
          x: Math.round(deviceW / 2),
          y: Math.round(centerY - actualDy * progress),
          time: startTime + progress * 500,
        });
      }

      await DeviceService.sendTouchActions(trajectory);
      await new Promise(r => setTimeout(r, 1500));
      await onRefreshSource();
    } catch (e) {
      console.error('Failed to swipe to element', e);
    } finally {
      setIsScrolling(false);
    }
  };

  const a = selectedNode.attributes;
  const extraAttrs = Object.entries(a)
    .filter(([k]) => !CORE_ATTR_KEYS.includes(k))
    .sort(([a], [b]) => a.localeCompare(b));

  // 将 XML 标签前缀弱化显示，极大地节约横向宽度与视觉压力
  const typeParts = selectedNode.type.startsWith('XCUIElementType') 
    ? { prefix: 'XCUIElementType', base: selectedNode.type.substring(15) }
    : { prefix: '', base: selectedNode.type };

  return (
    <div className="flex flex-col relative pb-6">
      {isScrolling && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 animate-in fade-in">
          <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" />
        </div>
      )}

      {/* Identity Section — 紧凑化 */}
      <div className="p-3 bg-blue-500/5 border-b border-white/5 flex flex-col gap-1 relative overflow-hidden">
        <span className="text-[10px] font-bold text-blue-400/60 tracking-wider">身份标识</span>
        <h3 className="text-[13px] font-mono text-blue-400 leading-tight py-1 break-all select-all flex flex-wrap items-baseline gap-x-0.5">
          {typeParts.prefix && <span className="opacity-40 font-normal">{typeParts.prefix}</span>}
          <span className="font-bold">{typeParts.base}</span>
        </h3>
        
        {isOffScreen && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-red-400 text-[10px]">⚠️</span>
              <span className="text-[10px] font-bold text-red-400/90 leading-tight">当前不可见 / 位于边缘外</span>
            </div>
            <button 
              onClick={handleScrollToVisible}
              className="mt-1 w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 text-white py-1.5 rounded-md text-[10px] font-bold shadow-sm active:scale-95 transition-all"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
              </svg>
              滚动到当前节点
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <AttributeBlock label="elementId" value={selectedNode.elementId || a.elementId} mono loading={isIdFetching && !selectedNode.elementId} />
        {/* Type 已经在身份标识中呈现了最核心形态，这里可以精简或者去掉，但为了和 XML Map 统一，保留 */}
        <AttributeBlock label="type" value={selectedNode.type} />
        <AttributeBlock label="label" value={a.label} />
        <AttributeBlock label="name" value={a.name} />
        <AttributeBlock label="value" value={a.value} />
      </div>

      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-white/30">状态与访问性</div>
      <div className="flex flex-col">
        <AttributeBlock label="enabled" value={a.enabled} />
        <AttributeBlock label="visible" value={a.visible} />
        <AttributeBlock label="accessible" value={a.accessible} />
        <AttributeBlock label="index" value={a.index} />
      </div>

      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-white/30">布局与位置</div>
      <div className="grid grid-cols-2">
        <AttributeBlock label="x" value={selectedNode.rect.x} />
        <AttributeBlock label="y" value={selectedNode.rect.y} />
        <AttributeBlock label="width" value={selectedNode.rect.width} />
        <AttributeBlock label="height" value={selectedNode.rect.height} />
      </div>

      {extraAttrs.length > 0 && (
        <>
          <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-white/30">常规属性</div>
          <div className="flex flex-col">
            {extraAttrs.map(([k, v]) => (
              <AttributeBlock key={k} label={k} value={v} />
            ))}
          </div>
        </>
      )}

      <div className="px-4 mt-5">
        <button className="w-full h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 4v16m8-8H4" />
          </svg>
          添加到任务
        </button>
      </div>
    </div>
  );
};

export default AttributePanel;
