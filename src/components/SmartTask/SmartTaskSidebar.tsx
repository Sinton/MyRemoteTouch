import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSmartTaskStore, Step } from '../../store/useSmartTaskStore';
import { DeviceService } from '../../services/deviceService';
import { parseXmlSourceToTree, findNodeById } from '../../utils/treeUtils';

// --- Imported Components ---
import UIXmlTree from './Inspector/UIXmlTree';
import AttributePanel from './Inspector/AttributePanel';

// --- Step Card Logic (Keeping here for now as it belongs to the Tasks tab) ---

const actionColors: Record<string, string> = {
  tap: 'text-sky-400 border-sky-500/10 bg-sky-500/5',
  smart_sleep: 'text-amber-400 border-amber-500/10 bg-amber-500/5',
  finish: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5',
};

const ActionIcon = ({ type }: { type: string }) => {
  if (type === 'tap') return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
  if (type === 'smart_sleep') return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  );
};

const StepCard: React.FC<{
  step: Step;
  index: number;
  onRemove: (id: string) => void;
  isActive: boolean;
}> = ({ step, index, onRemove, isActive }) => {
  const actionType = step.action.type;
  const colorCls = actionColors[actionType] ?? 'text-zinc-500 border-white/5 bg-white/5';

  return (
    <div
      className={`relative flex items-start gap-3 rounded-xl border p-3 group transition-all duration-200
        ${colorCls} ${isActive ? 'ring-1 ring-purple-500/30 border-purple-500/30 bg-white/[0.04]' : 'hover:bg-white/[0.02]'}
      `}
    >
      <div className={`flex-shrink-0 w-6 h-6 rounded-lg bg-white/5 border border-white/10
                      flex items-center justify-center text-[10px] font-bold transition-colors
                      ${isActive ? 'text-purple-400 border-purple-500/30' : 'text-white/20'}`}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[12px] font-medium text-white/80 truncate tracking-tight">{step.name}</p>
        <div className="flex items-center gap-1.5 mt-1 opacity-50">
          <ActionIcon type={actionType} />
          <span className="text-[10px] uppercase font-bold tracking-tighter">
            {actionType === 'tap' ? '交互点击' : actionType === 'smart_sleep' ? '智能休眠' : '流程结束'}
          </span>
        </div>
      </div>
      <button onClick={() => onRemove(step.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-white/60 text-[10px]">✕</button>
    </div>
  );
};

// --- Sidebar Main ---

interface SmartTaskSidebarProps {
  visible: boolean;
  onClose: () => void;
  deviceSize: { width: number; height: number };
}

const SmartTaskSidebar: React.FC<SmartTaskSidebarProps> = ({ visible, onClose, deviceSize }) => {
  const {
    draftTask, setDraftName, removeStep, clearDraft, isRecording, setIsRecording,
    uiTree, xmlSource, isFetchingSource, setInspectorData, selectedElementId, setSelectedElementId,
    activeTab, setActiveTab, runnerEvent, isRunning, setNodeElementId
  } = useSmartTaskStore();

  const isInspector = activeTab === 'inspector';
  const sourceRef = useRef<HTMLDivElement>(null);
  const [showVisibleOnly, setShowVisibleOnly] = useState(false);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isIdFetching, setIsIdFetching] = useState(false);

  // 后台预加载状态
  const lastFetchTimeRef = useRef<number>(Date.now());
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // Helper: Convert path (0.1.2) to absolute XPath
  const pathToXpath = (path: string) => {
    if (path === '') return '/*[1]';
    return '/*[1]' + path.split('.').map(idx => `/*[${parseInt(idx) + 1}]`).join('');
  };

  const refreshSource = async () => {
    setIsExporting(true);
    lastFetchTimeRef.current = Date.now();
    try {
      await DeviceService.optimizeWdaPerformance();
      const xml = await DeviceService.getUiSourceXml();
      const tree = parseXmlSourceToTree(xml);
      setInspectorData({ tree, xml });
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (isInspector && !uiTree) refreshSource();
  }, [isInspector, uiTree]);

  const selectedNode = useMemo(() => {
    if (!uiTree || !selectedElementId) return null;
    return findNodeById(uiTree, selectedElementId);
  }, [uiTree, selectedElementId]);

  // 当选中节点且没 ID 时，自动去后台拿真实的 elementId
  useEffect(() => {
    if (selectedNode && !selectedNode.elementId && selectedElementId) {
      const xpath = pathToXpath(selectedElementId);
      if (xpath) {
        setIsIdFetching(true);
        DeviceService.findElement('xpath', xpath)
          .then(id => {
            if (id) setNodeElementId(selectedElementId, id);
          })
          .catch(err => console.warn('Fetch elementId failed (xpath):', err))
          .finally(() => setIsIdFetching(false));
      }
    } else {
      setIsIdFetching(false);
    }
  }, [selectedNode, selectedElementId]);

  // --- 方案 1: 后台静默预加载 (Background Pre-fetching) ---
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      // 若当前正在导出或正在获取 ID，则不添乱
      if (isExporting || isIdFetching || isAutoSyncing) return;

      const lastInteraction = DeviceService.getLastInteractionTime();
      if (lastInteraction === 0) return; // 还没有过任何点击交互

      const now = Date.now();
      const timeSinceInteraction = now - lastInteraction;

      // 距离上一次真机交互过了 1.5 秒 ~ 4 秒（屏幕通常处于静止等待状态）
      if (timeSinceInteraction >= 1500 && timeSinceInteraction < 4000) {
        // 如果我们记录的 lastFetchTime 小于 用户点击屏幕的那一刻，说明画面可能变了
        if (lastFetchTimeRef.current < lastInteraction) {
          lastFetchTimeRef.current = now; // 马上占坑，避免接下来的轮询重复触发
          setIsAutoSyncing(true);
          DeviceService.getUiSourceXml()
            .then(xml => {
              const tree = parseXmlSourceToTree(xml);
              setInspectorData({ tree, xml });
            })
            .catch(err => console.warn('[Auto-Fetch] 预加载失败:', err))
            .finally(() => setIsAutoSyncing(false));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, isExporting, isIdFetching, isAutoSyncing, setInspectorData]);

  if (!visible) return null;

  return (
    <>
      {/* Tab: Tasks (Left Strip) */}
      <div className={`fixed left-0 top-0 h-full w-[280px] z-[60] bg-[#09090b]/60 backdrop-blur-2xl border-r border-white/10 flex flex-col shadow-2xl transition-transform animate-in slide-in-from-left`}>
        <div className="flex flex-col border-b border-white/5 px-5 py-4 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-white/90">智能自动化</span>
            <button onClick={onClose} className="w-6 h-6 text-white/20 hover:text-white/60">✕</button>
          </div>
          <div className="flex items-center gap-4">
            {['tasks', 'inspector'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)}
                className={`pb-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === t ? 'text-white border-blue-500' : 'text-white/20 border-transparent'}`}>
                {t === 'tasks' ? '任务编排' : '元素探测'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-5 py-4 gap-4">
          <input type="text" value={draftTask.name} onChange={(e) => setDraftName(e.target.value)} placeholder="未命名任务" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none" />
          <div className="flex gap-2">
            <button onClick={() => setIsRecording(!isRecording)} className={`flex-1 h-9 rounded-lg text-[12px] font-bold border transition-all ${isRecording ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-white/40'}`}>录制</button>
            <button onClick={() => isRunning ? DeviceService.stopTaskRunner() : refreshSource()} className="flex-1 h-9 rounded-lg text-[12px] font-bold border border-white/10 text-white/60">执行/刷新</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {draftTask.steps.map((s, i) => <StepCard key={s.id} step={s} index={i} onRemove={removeStep} isActive={runnerEvent?.step_id === s.id} />)}
          </div>
        </div>
      </div>

      {/* Tab: Inspector (Focused 2-Column Panel) */}
      {isInspector && (
        <div className={`fixed right-0 top-0 h-full w-[820px] z-[60] bg-[#09090b]/60 backdrop-blur-3xl border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right`}>
          <div className="flex-1 flex flex-row min-h-0 divide-x divide-white/5 overflow-hidden">
            {/* Main Pane: Pseudo-XML Source (Navigation) */}
            <div className="flex-1 flex flex-col min-w-0 bg-black/20">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-white/40 uppercase tracking-widest">元素探测</span>
                    <label className="flex items-center gap-1.5 cursor-pointer ml-3 group">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={showVisibleOnly} onChange={(e) => setShowVisibleOnly(e.target.checked)} />
                        <div className={`block w-6 h-3.5 rounded-full transition-colors ${showVisibleOnly ? 'bg-blue-500' : 'bg-white/10 group-hover:bg-white/20'}`}></div>
                        <div className={`absolute left-0.5 top-0.5 bg-white w-2.5 h-2.5 rounded-full transition-transform ${showVisibleOnly ? 'translate-x-2.5' : ''}`}></div>
                      </div>
                      <span className={`text-[10px] font-medium transition-colors ${showVisibleOnly ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-400'}`}>仅看可见</span>
                    </label>
                  </div>
                  <span className="text-[9px] text-white/15">点击元素节点进行交互与观测</span>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={refreshSource} disabled={isExporting || isAutoSyncing} className="text-[10px] text-blue-400 font-bold hover:underline transition-all">
                    {isExporting ? '刷新中...' : isAutoSyncing ? '后台同步中...' : '刷新代码树'}
                  </button>
                  <div className="w-px h-3 bg-white/10" />
                  <button onClick={() => xmlSource && navigator.clipboard.writeText(xmlSource)} className="text-[9px] text-white/20 hover:text-white/60 font-bold uppercase underline">复制源码</button>
                </div>
              </div>
              <div ref={sourceRef} className="flex-1 overflow-auto p-4 custom-scrollbar">
                {uiTree ? (
                  <div className="min-w-fit">
                    <UIXmlTree
                      node={uiTree}
                      selectedId={selectedElementId}
                      onSelect={setSelectedElementId}
                      deviceW={deviceSize.width}
                      deviceH={deviceSize.height}
                      showVisibleOnly={showVisibleOnly}
                    />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-white/5 border-t-blue-500 animate-spin" />
                      <p className="text-white/20 text-[11px]">正在解析 iOS 界面层级...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: Attributes (Detailed List) */}
            <div className="w-[230px] shrink-0 flex flex-col bg-black/10 overflow-y-auto custom-scrollbar">
              <div className="px-5 py-3 border-b border-white/5 sticky top-0 z-10 bg-[#0c0c0e] backdrop-blur-md">
                <span className="text-[12px] font-bold text-white/60 uppercase tracking-widest">属性详情</span>
              </div>
              <AttributePanel
                selectedNode={selectedNode}
                isIdFetching={isIdFetching}
                deviceW={deviceSize.width}
                deviceH={deviceSize.height}
                onRefreshSource={refreshSource}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SmartTaskSidebar;
