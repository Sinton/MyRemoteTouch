import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSmartTaskStore, Step, Action, SuccessRoute } from '../../store/useSmartTaskStore';
import { Select } from '../common/Select';

const Icons = {
  Tap: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" strokeWidth="2.5" /><rect x="13" y="13" width="8" height="8" rx="2" strokeWidth="2.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 7h4v4" /></svg>
  ),
  Timer: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth="2.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 7v5l3 3" /></svg>
  ),
  Finish: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
  ),
  Branch: ({ active }: { active?: boolean }) => (
    <svg className={`w-3.5 h-3.5 ${active ? 'text-[#0A84FF] drop-shadow-[0_0_5px_rgba(10,132,255,0.8)]' : 'text-white/20'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21v-4m0-10V3m0 14a4 4 0 0110-4m-10 4a4 4 0 0010 4m-10-12a4 4 0 0110-4m-10 4a4 4 0 0010-4" /></svg>
  )
};

export const StepEditor: React.FC<{
  step: Step;
  index: number;
  onRemove: (id: string) => void;
  isActive: boolean;
}> = ({ step, index, onRemove, isActive }) => {
  const { updateStep, draftTask } = useSmartTaskStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTargetHighlighted, setIsTargetHighlighted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHighlight = () => {
      if ((window as any).__hover_target_id === step.id) {
        setIsTargetHighlighted(true);
        setTimeout(() => setIsTargetHighlighted(false), 800);
      }
    };
    window.addEventListener('step-hover-sync', handleHighlight);
    return () => window.removeEventListener('step-hover-sync', handleHighlight);
  }, [step.id]);

  useEffect(() => {
    if (isActive && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  const handleUpdate = (partial: Partial<Step>) => updateStep(step.id, partial);

  const handleActionTypeChange = (newType: string) => {
    let newAction: Action;
    if (newType === 'tap') newAction = { type: 'tap', offset_x: 0, offset_y: 0 };
    else if (newType === 'smart_sleep') newAction = { type: 'smart_sleep', variable: 'Time', fallback_secs: 15 };
    else newAction = { type: 'finish' };
    handleUpdate({ action: newAction });
  };

  const handleRouteTypeChange = (newType: string) => {
    let newRoute: SuccessRoute;
    if (newType === 'next') newRoute = { type: 'next', step_id: '' };
    else if (newType === 'conditional_route') newRoute = { type: 'conditional_route', routes: [], default: 'finish' };
    else newRoute = { type: 'finish' };
    handleUpdate({ on_success: newRoute });
  };

  const isBranchActive = step.on_success.type === 'conditional_route' && (step.on_success as any).routes.length > 0;
  const allSteps = draftTask.steps;

  const [isDeleting, setIsDeleting] = useState(false);
  const deleteTimerRef = useRef<any>(null);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDeleting) {
      setIsDeleting(true);
      deleteTimerRef.current = setTimeout(() => setIsDeleting(false), 3000);
    } else {
      onRemove(step.id);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
      ${isActive
          ? 'bg-black/40 border-y border-white/10 z-10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] translate-x-1.5'
          : 'bg-transparent border-white/5 opacity-60 hover:opacity-100 hover:translate-x-1 hover:bg-white/[0.02]'} 
      ${isTargetHighlighted ? 'ring-2 ring-[#0A84FF] scale-[1.03] bg-[#0A84FF]/20 z-20 shadow-[0_0_30px_rgba(10,132,255,0.4)]' : ''}`}
    >
      {isActive && <div className="absolute top-0 bottom-0 left-0 w-[4px] bg-[#0A84FF] shadow-[2px_0_15px_rgba(10,132,255,1)]" />}

      <div className="flex items-center gap-4 p-4 cursor-pointer group/header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all duration-500 ${isActive ? 'bg-[#0A84FF] border-[#0A84FF] text-white shadow-[0_0_10px_rgba(10,132,255,0.5)]' : 'border-white/10 text-white/20'}`}>{index + 1}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-black tracking-tight leading-tight transition-colors duration-500 ${isActive ? 'text-white' : 'text-white/60 font-medium'}`}>{step.name || '未命名步骤'}</p>
          <div className="flex items-center gap-4 mt-2 h-4">
            <div className={`flex items-center gap-1.5 px-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-[#0A84FF]' : 'text-white/20'}`}>
              {step.action.type === 'tap' && <Icons.Tap />}
              {step.action.type === 'smart_sleep' && <Icons.Timer />}
              {step.action.type === 'finish' && <Icons.Finish />}
              <span>{step.action.type === 'tap' ? '点击交互' : step.action.type === 'smart_sleep' ? '计时休眠' : '流程结束'}</span>
            </div>
            {isBranchActive && <div className="flex items-center gap-1.5 text-[8px] font-black text-[#0A84FF]/60 uppercase tracking-widest"><Icons.Branch active /> 逻辑分支锁定</div>}
          </div>
        </div>
        <svg className={`w-4 h-4 text-white/20 transition-transform duration-500 ${isExpanded ? 'rotate-180 text-[#0A84FF]/60' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      </div>

      {isExpanded && (
        <div className="px-5 pb-6 pt-2 flex flex-col gap-6 border-t border-white/5 bg-black/30">
          <div className="flex flex-col gap-2.5">
            <label className="text-[10px] font-black text-white/20 uppercase tracking-widest pl-1">修改名称</label>
            <input value={step.name} onChange={(e) => handleUpdate({ name: e.target.value })} className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:bg-white/[0.08] focus:border-[#0A84FF]/40 transition-all font-black" />
          </div>

          <div className="p-4 bg-[#0A84FF]/5 border border-[#0A84FF]/10 rounded-xl flex flex-col gap-3">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-[#0A84FF] uppercase tracking-widest">智选变量提取 (TEXT CAPTURE)</span>
                <button onClick={() => handleUpdate({ variable_extraction: step.variable_extraction ? undefined : { regex: '(\\d+)', variable_name: 'wait_time' } })} className={`w-8 h-4 rounded-full relative transition-all ${step.variable_extraction ? 'bg-[#0A84FF]' : 'bg-white/10'}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${step.variable_extraction ? 'right-0.5' : 'left-0.5'}`} /></button>
             </div>
             {step.variable_extraction && (
               <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-[#0A84FF] uppercase tracking-widest pl-1">提取目标关键词 (用于物理定位)</span>
                    <input defaultValue={(step.variable_extraction as any).target_text || ''} onBlur={(e) => handleUpdate({ variable_extraction: { ...step.variable_extraction!, target_text: e.target.value } })} className="w-full bg-black/40 border border-[#0A84FF]/30 rounded px-3 py-1.5 text-[11px] text-white" placeholder="例如: 秒后可领" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest pl-1">正则表达式</span>
                      <input defaultValue={step.variable_extraction.regex} onBlur={(e) => handleUpdate({ variable_extraction: { ...step.variable_extraction!, regex: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-[11px] text-[#0A84FF] font-mono" placeholder="(\\d+)" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest pl-1">变量名</span>
                      <input defaultValue={step.variable_extraction.variable_name} onBlur={(e) => handleUpdate({ variable_extraction: { ...step.variable_extraction!, variable_name: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-[11px] text-white font-mono" placeholder="wait_time" />
                    </div>
                  </div>
               </div>
             )}
          </div>

          <div className="flex flex-col gap-3">
             <label className="text-[10px] font-black text-white/20 uppercase tracking-widest pl-1">配置执行动作</label>
             <Select value={step.action.type} options={[{ value: 'tap', label: '屏幕点击' },{ value: 'smart_sleep', label: '智能休眠' },{ value: 'finish', label: '强行停止' }]} onChange={handleActionTypeChange} />
             {step.action.type === 'smart_sleep' && (
               <div className="p-4 bg-[#0A84FF]/5 border border-[#0A84FF]/10 rounded-xl space-y-3">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5"><span className="text-[9px] font-bold text-[#0A84FF]/60 block uppercase">判定变量</span><input value={(step.action as any).variable} onChange={e => handleUpdate({ action: { ...step.action, variable: e.target.value } as any })} className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-[11px] text-white text-center font-mono" /></div>
                   <div className="space-y-1.5"><span className="text-[9px] font-bold text-amber-500/60 block uppercase tracking-widest">休眠时长</span><input value={(step.action as any).fallback_secs} onChange={e => handleUpdate({ action: { ...step.action, fallback_secs: e.target.value } as any })} className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-[11px] text-[#0A84FF] text-center font-mono" /></div>
                 </div>
                 
                 {/* 提取前刷新选项 */}
                 <div className="flex items-center justify-between pt-2 border-t border-white/10">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-[8px] font-black text-white/40 uppercase">提取前刷新页面</span>
                     <span className="text-[7px] text-white/20">前序步骤可能改变页面，开启可获取最新文本</span>
                   </div>
                   <button 
                     onClick={() => handleUpdate({ 
                       action: { 
                         ...step.action, 
                         refresh_before_extract: !(step.action as any).refresh_before_extract 
                       } as any 
                     })} 
                     className={`w-10 h-5 rounded-full relative transition-all ${(step.action as any).refresh_before_extract ? 'bg-[#0A84FF]' : 'bg-white/10'}`}
                   >
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${(step.action as any).refresh_before_extract ? 'right-0.5' : 'left-0.5'}`} />
                   </button>
                 </div>
               </div>
             )}
          </div>

          <div className="flex flex-col gap-3">
             <div className="flex items-center justify-between px-1">
               <label className="text-[10px] font-black text-white/20 uppercase tracking-widest">配置路由跳转</label>
               <Select value={step.on_success.type} options={[{ value: 'next', label: '顺序执行' },{ value: 'conditional_route', label: '逻辑分支' },{ value: 'finish', label: '结束' }]} onChange={handleRouteTypeChange} />
             </div>

             {step.on_success.type === 'conditional_route' && (
               <div className="space-y-3 pt-1">
                 {/* 全局配置：判定前刷新 */}
                 <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-[9px] font-black text-blue-400/80 uppercase">判定前刷新页面</span>
                     <span className="text-[7px] text-white/30">等待后页面可能变化，开启可获取最新文本</span>
                   </div>
                   <button 
                     onClick={() => handleUpdate({ 
                       on_success: { 
                         ...step.on_success, 
                         refresh_before_check: !(step.on_success as any).refresh_before_check 
                       } as any 
                     })} 
                     className={`w-10 h-5 rounded-full relative transition-all ${(step.on_success as any).refresh_before_check ? 'bg-[#0A84FF]' : 'bg-white/10'}`}
                   >
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${(step.on_success as any).refresh_before_check ? 'right-0.5' : 'left-0.5'}`} />
                   </button>
                 </div>
                 
                 {(step.on_success.routes || []).map((route: any, rIdx: number) => (
                   <div key={rIdx} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                     <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5">
                       <span className="text-[9px] font-black text-amber-500/60 uppercase">判定 #{rIdx+1}</span>
                       <button onClick={() => { const rs = [...(step.on_success as any).routes].filter((_, i) => i !== rIdx); handleUpdate({ on_success: { ...step.on_success, routes: rs } as any }); }} className="text-[9px] text-red-500/30 hover:text-red-500">删除</button>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-white/20">包含文本</span>
                          <input 
                            defaultValue={route.text_contains} 
                            onBlur={(e) => { 
                              const rs = [...(step.on_success as any).routes]; 
                              rs[rIdx] = { ...rs[rIdx], text_contains: e.target.value }; 
                              handleUpdate({ on_success: { ...step.on_success, routes: rs } as any }); 
                            }} 
                            className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-[11px] text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-white/20">则跳转至</span>
                            {(!route.goto_step || route.goto_step === '') && (
                              <span className="text-[8px] text-red-500 font-black animate-pulse">未指定 ID !</span>
                            )}
                          </div>
                          <Select 
                            value={route.goto_step || 'finish'} 
                            options={[
                              { value: 'finish', label: '🛑 结束执行' }, 
                              ...allSteps.filter(s => s.id !== step.id).map(s => ({ value: s.id, label: `环节: ${s.name}` }))
                            ]} 
                            onChange={(val) => { 
                              const rs = [...(step.on_success as any).routes]; 
                              rs[rIdx] = { ...rs[rIdx], goto_step: val }; 
                              handleUpdate({ on_success: { ...step.on_success, routes: rs } as any }); 
                            }} 
                          />
                        </div>
                     </div>
                   </div>
                 ))}
                 
                 {/* 兜底跳转配置 */}
                 <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-[9px] font-black text-amber-500/80 uppercase">兜底跳转 (Default)</span>
                     {(!(step.on_success as any).default || (step.on_success as any).default === '') && (
                       <span className="text-[8px] text-red-500 font-black animate-pulse">必须配置!</span>
                     )}
                   </div>
                   <Select 
                     value={(step.on_success as any).default || 'finish'} 
                     options={[
                       { value: 'finish', label: '🛑 结束执行' }, 
                       ...allSteps.filter(s => s.id !== step.id).map(s => ({ value: s.id, label: `环节: ${s.name}` }))
                     ]} 
                     onChange={(val) => handleUpdate({ on_success: { ...step.on_success, default: val } as any })} 
                   />
                   <p className="text-[8px] text-white/30 mt-1.5">当所有条件都不满足时的跳转目标</p>
                 </div>
                 
                 <button onClick={() => { const rs = [...(step.on_success as any).routes || [], { text_contains: '', goto_step: 'finish' }]; handleUpdate({ on_success: { ...step.on_success, routes: rs } as any }); }} className="w-full h-8 border border-dashed border-white/10 rounded-lg text-[9px] font-black text-white/20 hover:text-amber-500 hover:border-amber-500/40 transition-all uppercase">+ 新增逻辑规则</button>
               </div>
             )}
          </div>

          <button onClick={handleDeleteClick} className={`w-full py-2 rounded-xl border transition-all text-[11px] font-black uppercase tracking-widest ${isDeleting ? 'bg-red-500 text-white border-transparent' : 'border-red-500/10 text-red-500/40'}`}>{isDeleting ? '确定删除？' : '剔除此步骤'}</button>
        </div>
      )}
    </div>
  );
};
