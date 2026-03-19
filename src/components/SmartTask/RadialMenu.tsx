import React, { useEffect, useRef } from 'react';
import { useSmartTaskStore, InspectResult, Step, Selector, Action } from '../../store/useSmartTaskStore';

interface RadialMenuProps {
  x: number;
  y: number;
  element: InspectResult | null;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  makeStep: () => Step;
}

function generateId(): string {
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

const RadialMenu: React.FC<RadialMenuProps> = ({ x, y, element, onClose }) => {
  const { addStep, pendingRegion } = useSmartTaskStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击菜单外区域关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // 构建针对当前 element 的选择器
  const buildSelector = (): Selector => {
    if (element?.label) {
      return { type: 'wda_label', value: element.label };
    }
    if (pendingRegion) {
      return { type: 'ocr_text', value: '', region: pendingRegion };
    }
    return { type: 'wda_predicate', value: '' };
  };

  const menuItems: MenuItem[] = [
    {
      id: 'tap',
      label: '点击动作',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
        </svg>
      ),
      color: 'bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/40',
      makeStep: () => ({
        id: generateId(),
        name: element?.label ? `点击「${element.label}」` : '快速点击',
        selector: buildSelector(),
        action: { type: 'tap', offset_x: 0, offset_y: 0 },
        pre_delay_ms: 0,
        post_delay_ms: 800,
        timeout_ms: 10000,
        on_success: null,
        on_failure: 'retry',
      }),
    },
    {
      id: 'wait',
      label: '断言可见',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/40',
      makeStep: () => ({
        id: generateId(),
        name: element?.label ? `确认「${element.label}」在屏幕` : '检查元素',
        selector: buildSelector(),
        action: { type: 'finish' },
        pre_delay_ms: 0,
        post_delay_ms: 500,
        timeout_ms: 30000,
        on_success: null,
        on_failure: 'retry',
      }),
    },
    {
      id: 'timer',
      label: '提取倒计时',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40',
      makeStep: () => ({
        id: generateId(),
        name: element?.label ? `从「${element.label}」提取时间` : '提取倒计时',
        selector: buildSelector(),
        action: { type: 'smart_sleep', variable: '$1', fallback_secs: 15 },
        pre_delay_ms: 0,
        post_delay_ms: 1000,
        timeout_ms: 60000,
        on_success: null,
        on_failure: 'abort',
      }),
    },
    {
      id: 'branch',
      label: '跳转逻辑',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40',
      makeStep: () => ({
        id: generateId(),
        name: element?.label ? `若「${element.label}」则跳转` : '条件分支',
        selector: buildSelector(),
        action: { type: 'finish' },
        pre_delay_ms: 0,
        post_delay_ms: 300,
        timeout_ms: 5000,
        on_success: null,
        on_failure: 'goto_step' as unknown as 'retry',
      }),
    },
  ];

  // 径向布局：以点击坐标为中心，四个方向展开
  const RADIUS = 64;
  const positions = [
    { top: -RADIUS, left: 0 },       // 上
    { top: 0, left: RADIUS },        // 右
    { top: RADIUS, left: 0 },        // 下
    { top: 0, left: -RADIUS },       // 左
  ];

  const handleSelect = (item: MenuItem) => {
    addStep(item.makeStep());
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-[200] pointer-events-auto"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      {/* 核心锚点 */}
      <div className="relative flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10" />
      </div>

      {/* 菜单项 */}
      {menuItems.map((item, i) => (
        <button
          key={item.id}
          onClick={() => handleSelect(item)}
          className={`
            absolute flex flex-col items-center justify-center gap-1
            w-[72px] h-[72px] rounded-2xl border text-white text-center
            transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            shadow-2xl shadow-black/60 backdrop-blur-2xl
            animate-in zoom-in-50 slide-in-from-bottom-2
            hover:scale-105 active:scale-95 group
            ${item.color}
          `}
          style={{
            left: positions[i].left - 36,
            top: positions[i].top - 36,
            animationDelay: `${i * 40}ms`,
          }}
          title={item.label}
        >
          <div className="group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
          <span className="text-[10px] font-bold tracking-tight opacity-70 group-hover:opacity-100 transition-opacity">{item.label}</span>
        </button>
      ))}

      {/* 元素标识 */}
      {element?.label && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-white text-zinc-950 font-bold
                     text-[9px] tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shadow-2xl animate-in fade-in slide-in-from-top-2 duration-500"
          style={{ top: -RADIUS - 50 }}
        >
          {element.label.toUpperCase()}
        </div>
      )}
    </div>
  );
};

export default RadialMenu;
