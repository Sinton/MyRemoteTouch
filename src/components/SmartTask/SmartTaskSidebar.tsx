import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSmartTaskStore, Step } from '../../store/useSmartTaskStore';
import { DeviceService } from '../../services/deviceService';
import { parseXmlSourceToTree, findNodeById } from '../../utils/treeUtils';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import { listen } from '@tauri-apps/api/event';
// --- Imported Components ---
import UIXmlTree from './Inspector/UIXmlTree';
import AttributePanel from './Inspector/AttributePanel';
import { StepEditor } from './StepEditor';

interface SmartTaskSidebarProps {
  visible: boolean;
  onClose: () => void;
  deviceSize: { width: number; height: number };
}

const SmartTaskSidebar: React.FC<SmartTaskSidebarProps> = ({ visible, onClose, deviceSize }) => {
  const {
    draftTask, setDraftName, setMaxLoopCount, removeStep, reorderSteps, clearDraft, isRecording, setIsRecording,
    uiTree, xmlSource, setInspectorData, selectedElementId, setSelectedElementId,
    activeTab, setActiveTab, runnerEvent, isRunning, setNodeElementId, setIsRunning, setRunnerEvent,
    sidebarWidth, setSidebarWidth, inspectorWidth, setInspectorWidth
  } = useSmartTaskStore();

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingInspector, setIsResizingInspector] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        setSidebarWidth(Math.max(280, Math.min(600, e.clientX)));
      } else if (isResizingInspector) {
        const width = Math.max(400, Math.min(1000, window.innerWidth - e.clientX));
        setInspectorWidth(width);
      }
    };
    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingInspector(false);
    };
    if (isResizingSidebar || isResizingInspector) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = 'default';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingInspector]);

  const isInspector = activeTab === 'inspector';
  const [showVisibleOnly, setShowVisibleOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isIdFetching, setIsIdFetching] = useState(false);
  const [finishedToast, setFinishedToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    let unlistenFn: any;
    listen('smart_task:progress', (event: any) => {
      const data = event.payload;
      setRunnerEvent(data);
      if (data.state === 'finished' || data.state === 'failed' || data.state === 'cancelled') {
        setIsRunning(false);
        setFinishedToast({
          msg: data.state === 'finished' ? `执行成功!` : `执行中止: ${data.reason}`,
          type: data.state === 'finished' ? 'success' : 'error'
        });
        setTimeout(() => { setFinishedToast(null); setRunnerEvent(null); }, 4000);
      }
    }).then(unsub => unlistenFn = unsub);
    return () => { if (unlistenFn) unlistenFn(); };
  }, [setRunnerEvent, setIsRunning]);

  const handleRunTask = async () => {
    if (isRunning) {
      setIsRunning(false);
      setRunnerEvent(null);
      await DeviceService.stopTaskRunner();
      return;
    }

    const currentTask = useSmartTaskStore.getState().draftTask;
    if (currentTask.steps.length === 0) return;

    setIsRunning(true);
    setRunnerEvent(null);

    const cleanTask = {
      ...currentTask,
      steps: currentTask.steps.map(s => {
        const cleanStep: any = { ...s };
        
        // --- 核心修复：清理正则索引 Bug ---
        if (s.variable_extraction?.target_text) {
           const target = s.variable_extraction.target_text;
           let regex = s.variable_extraction.regex;
           // 如果用户写了 (\d+)，由于后端 19 会变 1 的 Bug，我们尝试剥离捕获组
           if (regex === '(\\d+)') regex = '\\d+';
           
           cleanStep.variable_extraction = {
             ...s.variable_extraction,
             regex: regex,
             target_text: target
           };
        }
        
        // --- 路由硬关联修复 ---
        if (cleanStep.on_success?.type === 'conditional_route') {
           cleanStep.on_success.routes = (cleanStep.on_success.routes || []).map((r: any) => ({
             ...r,
             goto_step: r.goto_step && r.goto_step !== '' ? r.goto_step : 'finish'
           }));
        }

        if (cleanStep.action.type === 'smart_sleep') {
           // 只有在完全没有值的情况下才给兜底，否则保持原始引用（支持 {{variable}}）
           if (!cleanStep.action.fallback_secs) cleanStep.action.fallback_secs = 5;
        }
        return cleanStep;
      })
    };

    try {
      await DeviceService.startTaskRunner(cleanTask, deviceSize.width, deviceSize.height);
    } catch (e) {
      console.error(e);
      setIsRunning(false);
    }
  };

  const refreshSource = async () => {
    setIsExporting(true);
    try {
      await DeviceService.optimizeWdaPerformance();
      const xml = await DeviceService.getUiSourceXml();
      const tree = parseXmlSourceToTree(xml);
      setInspectorData({ tree, xml });
    } catch (e) { console.error(e); }
    finally { setIsExporting(false); }
  };

  useEffect(() => {
    if (isInspector && !uiTree) refreshSource();
  }, [isInspector, uiTree]);

  const selectedNode = useMemo(() => {
    if (!uiTree || !selectedElementId) return null;
    return findNodeById(uiTree, selectedElementId);
  }, [uiTree, selectedElementId]);

  useEffect(() => {
    if (selectedNode && !selectedNode.elementId && selectedElementId) {
      const xpath = '/*[1]' + selectedElementId.split('.').map(idx => `/*[${parseInt(idx) + 1}]`).join('');
      setIsIdFetching(true);
      DeviceService.findElement('xpath', xpath)
        .then(id => { if (id) setNodeElementId(selectedElementId, id); })
        .catch(err => console.warn(err))
        .finally(() => setIsIdFetching(false));
    }
  }, [selectedNode, selectedElementId]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[45] pointer-events-none">
      <div className={`absolute left-0 top-0 bottom-0 bg-[rgba(20,20,22,0.92)] backdrop-blur-2xl border-r border-white/5 pointer-events-auto flex flex-col items-stretch animate-in slide-in-from-left shadow-2xl`} style={{ width: `${sidebarWidth}px` }}>
        <div onMouseDown={() => setIsResizingSidebar(true)} className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-[60] group" />
        <div className="flex flex-col border-b border-white/5 px-5 py-4 gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col"><span className="text-[11px] font-black text-white/90">智能自动化控制台</span></div>
            <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white/100 text-[10px]">✕</button>
          </div>
          <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/5 h-9">
            <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-1 text-[10px] uppercase ${activeTab === 'tasks' ? 'text-[#0A84FF]' : 'text-white/20'}`}>流水线</button>
            <button onClick={() => setActiveTab('inspector')} className={`flex-1 py-1 text-[10px] uppercase ${activeTab === 'inspector' ? 'text-[#0A84FF]' : 'text-white/20'}`}>探测器</button>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-5 py-5 gap-5">
          <div className="flex items-center gap-2">
            <input value={draftTask.name} onChange={(e) => setDraftName(e.target.value)} className="bg-transparent border-none text-[13px] font-black text-white/70 outline-none w-full" />
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setIsRecording(!isRecording)} className={`flex-1 h-10 rounded-xl text-[10px] border ${isRecording ? 'border-red-500 text-red-500' : 'border-white/10 text-white/30'}`}>{isRecording ? '录制中' : '动作录制'}</button>
            <button onClick={handleRunTask} className={`flex-1 h-10 rounded-xl text-[12px] font-black border ${isRunning ? 'border-red-500 text-red-400' : 'border-[#0A84FF] text-[#0A84FF]'}`}>{isRunning ? '⏹ 停止' : '▶ 启动'}</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            <DragDropContext onDragEnd={(res) => res.destination && reorderSteps(res.source.index, res.destination.index)}>
              <Droppable droppableId="smart-task-steps">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-col gap-2">
                    {draftTask.steps.map((s, i) => (
                      <Draggable key={s.id} draggableId={s.id} index={i}>
                        {(p) => (
                          <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                            <StepEditor step={s} index={i} onRemove={removeStep} isActive={runnerEvent?.step_id === s.id} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
      </div>

      <div className={`absolute right-0 top-0 bottom-0 bg-[rgba(15,15,17,0.95)] backdrop-blur-3xl border-l border-white/5 pointer-events-auto flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.8)] ${isInspector ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`} style={{ width: `${inspectorWidth}px` }}>
        <div onMouseDown={() => setIsResizingInspector(true)} className="absolute -left-1 top-0 bottom-0 w-2 cursor-col-resize z-[60]" />
        <div className="flex-1 flex flex-row min-h-0 divide-x divide-white/5 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-[11px] font-black text-white/50 uppercase">代码树</span>
              <button onClick={refreshSource} className="text-[10px] text-[#0A84FF] font-black uppercase hover:underline">{isExporting ? '...' : '同步'}</button>
            </div>
            <div className="flex-1 overflow-auto p-5 custom-scrollbar">
              {uiTree && <UIXmlTree node={uiTree} selectedId={selectedElementId} onSelect={setSelectedElementId} deviceW={deviceSize.width} deviceH={deviceSize.height} showVisibleOnly={showVisibleOnly} />}
            </div>
          </div>
          <div className="w-[170px] flex-shrink-0 flex flex-col bg-black/30">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <AttributePanel selectedNode={selectedNode} isIdFetching={isIdFetching} deviceW={deviceSize.width} deviceH={deviceSize.height} onRefreshSource={refreshSource} />
            </div>
          </div>
        </div>
      </div>

      {finishedToast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl border bg-black text-white z-[100]`}>
          <span className="text-[12px] font-black">{finishedToast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default SmartTaskSidebar;
