import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TreeNode } from '../../../store/useSmartTaskStore';
import { isNodeOffScreen } from '../../../utils/treeUtils';

interface UIXmlTreeProps {
  node: TreeNode;
  depth?: number;
  onSelect: (id: string | null) => void;
  selectedId?: string | null;
  deviceW: number;
  deviceH: number;
  showVisibleOnly: boolean;
}

const UIXmlTree: React.FC<UIXmlTreeProps> = ({ 
  node, depth = 0, onSelect, selectedId, deviceW, deviceH, showVisibleOnly 
}) => {
  const isSelected = selectedId === node.path || (!!node.elementId && selectedId === node.elementId);
  const [isOpen, setIsOpen] = useState(depth < 2 || isSelected);
  const nodeRef = useRef<HTMLDivElement>(null);
  
  // 检查当前节点是否是“不可见”或在“屏幕外”
  const isOffScreen = useMemo(() => isNodeOffScreen(node, deviceW, deviceH), [node, deviceW, deviceH]);

  const hasChildren = node.children.length > 0;

  useEffect(() => {
    if (selectedId) {
      // 如果当前节点是选中节点的父级，自动展开
      const isParentOfSelected = selectedId === node.path || (selectedId.startsWith(node.path + '.'));
      if (isParentOfSelected) {
        setIsOpen(true);
      }
    }
  }, [selectedId, node.path]);

  // 核心功能：选中时自动滚动至视口中心
  useEffect(() => {
    if (isSelected && nodeRef.current) {
      // 这里的 150ms 延迟是为了等待父级节点展开动画/渲染完成，确保滚动位置准确
      const timer = setTimeout(() => {
        nodeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isSelected]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleLineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.path);
  };

  const attrPriority: Record<string, number> = { 
    'value': 1, 
    'name': 2, 
    'label': 3, 
    'AXIdentifier': 4 
  };

  const displayAttrs = Object.entries(node.attributes)
    .filter(([k]) => attrPriority.hasOwnProperty(k) && node.attributes[k])
    .sort(([a], [b]) => (attrPriority[a] || 99) - (attrPriority[b] || 99));

  // --- 纯净模式拦截：如果开启纯净模式且当前元素不可见，直接不渲染该树枝 ---
  if (showVisibleOnly && isOffScreen) {
    return null;
  }

  // --- 视觉降噪样式 ---
  const noiseClasses = isOffScreen && !isSelected ? 'opacity-50 grayscale' : '';

  return (
    <div className={`flex flex-col font-mono text-[10px] leading-5 ${noiseClasses}`}>
      <div 
        ref={nodeRef}
        onClick={handleLineClick}
        className={`group flex items-center whitespace-nowrap cursor-pointer transition-colors px-2 rounded-sm
                   ${isSelected ? 'bg-blue-500/15 ring-1 ring-blue-500/20' : 'hover:bg-white/5'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren && (
          <button 
            onClick={handleToggle}
            className={`w-3 h-3 flex items-center justify-center mr-1 text-white/30 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2 h-2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        <span className="text-zinc-500">&lt;</span>
        <span className="text-sky-400">{node.type.replace('XCUIElementType', '')}</span>
        {displayAttrs.map(([k, v]) => {
          const displayVal = String(v).length > 30 ? String(v).substring(0, 30) + '...' : String(v);
          return (
            <React.Fragment key={k}>
              <span className="text-white/20">&nbsp;</span>
              <span className="text-blue-300/80">{k}</span>
              <span className="text-zinc-500">=</span>
              <span className="text-emerald-400/80">"{displayVal}"</span>
            </React.Fragment>
          );
        })}
        <span className="text-zinc-500">{hasChildren ? '>' : ' />'}</span>
        
        {/* 不可见元素的特殊标记 */}
        {isOffScreen && (
          <span className="ml-2 text-[10px] border border-white/10 text-white/40 bg-white/5 px-1 rounded-sm leading-tight flex items-center gap-1">
            <span>👁️‍🗨️</span> 屏幕外
          </span>
        )}
        
        {!isOpen && hasChildren && <span className="text-white/10 italic ml-2">...</span>}
      </div>

      {hasChildren && isOpen && (
        <>
          <div className="flex flex-col">
            {node.children.map((child, i) => (
              <UIXmlTree 
                key={(child.elementId || 'node') + '-' + i} 
                node={child} 
                depth={depth + 1} 
                selectedId={selectedId} 
                onSelect={onSelect} 
                deviceW={deviceW}
                deviceH={deviceH}
                showVisibleOnly={showVisibleOnly}
              />
            ))}
          </div>
          <div className="flex items-center text-zinc-500 px-2 pointer-events-none" style={{ paddingLeft: `${depth * 16 + 8 + 16}px` }}>
            &lt;/{node.type.replace('XCUIElementType', '')}&gt;
          </div>
        </>
      )}
    </div>
  );
};

export default UIXmlTree;
