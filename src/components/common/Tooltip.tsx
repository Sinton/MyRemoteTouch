import React, { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Reusable Tooltip Component
 */
const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const getPositionClasses = () => {
    switch (position) {
      case 'left': return 'left-[calc(0%-12px)] top-1/2 -translate-x-full -translate-y-1/2';
      case 'right': return 'left-[calc(100%+12px)] top-1/2 -translate-y-1/2';
      case 'top': return 'bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2';
      case 'bottom': return 'top-[calc(100%+12px)] left-1/2 -translate-x-1/2';
      default: return '';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'left': return '-right-1 top-1/2 -translate-y-1/2 border-r border-b rotate-[-45deg]';
      case 'right': return '-left-1 top-1/2 -translate-y-1/2 border-l border-t rotate-[-45deg]';
      case 'top': return '-bottom-1 left-1/2 -translate-x-1/2 border-r border-b rotate-[45deg]';
      case 'bottom': return '-top-1 left-1/2 -translate-x-1/2 border-l border-t rotate-[45deg]';
      default: return '';
    }
  };

  return (
    <div className="relative group/tooltip">
      {children}
      <div className={`absolute opacity-0 scale-95 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-200 z-[500] ${getPositionClasses()}`}>
        <div className="bg-[#1c1c1e] border border-white/10 rounded-lg p-2.5 shadow-2xl min-w-[110px]">
          {content}
        </div>
        <div className={`absolute w-2 h-2 bg-[#1c1c1e] border-white/10 ${getArrowClasses()}`} />
      </div>
    </div>
  );
};

export default Tooltip;
