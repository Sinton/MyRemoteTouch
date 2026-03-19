import React, { useState, useEffect } from 'react';
import { TreeNode } from '../../../store/useSmartTaskStore';

const TypeIcon = ({ type }: { type: string }) => {
  const isButton = type.toLowerCase().includes('button');
  const isText = type.toLowerCase().includes('text') || type.toLowerCase().includes('statictext');
  const isImage = type.toLowerCase().includes('image');
  const isInput = type.toLowerCase().includes('textfield') || type.toLowerCase().includes('secure');
  
  if (isButton) return <span className="text-[10px] text-purple-400">🔘</span>;
  if (isText) return <span className="text-[10px] text-sky-400">📝</span>;
  if (isImage) return <span className="text-[10px] text-emerald-400">🖼️</span>;
  if (isInput) return <span className="text-[10px] text-amber-400">⌨️</span>;
  return <span className="text-[10px] text-white/20">📦</span>;
};

interface UIHierarchyProps {
  node: TreeNode;
  depth?: number;
  onSelect: (id: string) => void;
  selectedId?: string | null;
}

const UIHierarchy: React.FC<UIHierarchyProps> = ({ node, depth = 0, onSelect, selectedId }) => {
  const id = node.elementId || node.attributes.elementId;
  const isSelected = selectedId === id;
  const [isExpanded, setIsExpanded] = useState(depth < 2 || isSelected);
  const hasChildren = node.children.length > 0;

  useEffect(() => {
    if (selectedId && node.children.some(c => (c.elementId || c.attributes.elementId) === selectedId)) {
      setIsExpanded(true);
    }
  }, [selectedId, node.children]);

  // Priority identifiers (Label > Name > ID)
  const name = node.attributes.name || node.attributes.AXIdentifier;
  const label = node.attributes.label;
  const value = node.attributes.value;

  return (
    <div className="flex flex-col">
      <div 
        onClick={() => id && onSelect(id)}
        className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer group hover:bg-white/5 rounded-md transition-all
                   ${isSelected ? 'bg-purple-500/20 ring-1 ring-purple-500/30' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className={`w-4 h-4 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            <svg className="w-2.5 h-2.5 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
               <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : (
          <div className="w-4" />
        )}
        
        <TypeIcon type={node.type} />
        
        <div className="flex items-center gap-2 overflow-hidden flex-1 select-none">
          <span className={`text-[11px] font-mono shrink-0 ${isSelected ? 'text-purple-300 font-bold' : 'text-zinc-400'}`}>
            {node.type}
          </span>
          
          {label && (
            <span className="text-[10px] text-white/40 truncate italic group-hover:text-white/60 shrink-0 max-w-[120px]">
              "{label}"
            </span>
          )}

          {value && (
            <span className="text-[9px] font-bold text-emerald-400/60 bg-emerald-500/5 px-1 rounded border border-emerald-500/10 shrink-0">
              [{value}]
            </span>
          )}

          {name && (
            <span className="text-[9px] text-sky-400/40 truncate font-mono ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              #{name}
            </span>
          )}
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {node.children.map((child, i) => (
            <UIHierarchy 
              key={(child.elementId || 'node') + '-' + i} 
              node={child} 
              depth={depth + 1} 
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default UIHierarchy;
