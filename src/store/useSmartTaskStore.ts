import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── DSL Types (镜像 Rust model.rs v2.1 的数据结构) ─────────────────────────

export interface Region {
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
}

export type SelectorCandidate =
  | { type: 'wda_label'; value: string }
  | { type: 'wda_predicate'; value: string }
  | { type: 'ocr_text'; value: string; region?: Region }
  | { type: 'template_icon'; icon_id: string; region?: Region };

export type Selector =
  | { type: 'wda_label'; value: string }
  | { type: 'wda_predicate'; value: string }
  | { type: 'ocr_text'; value: string; region?: Region }
  | { type: 'template_icon'; icon_id: string; region?: Region }
  | { type: 'multi_match'; candidates: SelectorCandidate[] };

export type Action =
  | { type: 'tap'; offset_x: number; offset_y: number }
  | { type: 'smart_sleep', fallback_secs: number | string, variable?: string, early_wake_secs?: number }
  | { type: 'finish' };

export interface ConditionalBranch {
  text_contains: string; // 必须匹配后端的 text_contains
  goto_step: string;     // 必须匹配后端的 goto_step
}

export type SuccessRoute =
  | { type: 'next'; step_id: string }
  | { type: 'conditional_route'; routes: ConditionalBranch[]; default: string }
  | { type: 'finish' };

export type FailurePolicy =
  | 'retry'
  | { goto_step: string }
  | 'abort';

export interface VariableExtraction {
  regex: string;          // 例如: (\d+)秒
  variable_name: string;   // 例如: wait_time
  target_text?: string;    // 关键：新增目标文本包含过滤
}

export interface Step {
  id: string;
  name: string;
  selector: Selector;
  action: Action;
  variable_extraction?: VariableExtraction; // 新增：从目标节点提取变量
  pre_delay_ms: number;
  post_delay_ms: number;
  timeout_ms: number;
  on_success: SuccessRoute;
  on_failure: FailurePolicy;
}

export interface Task {
  task_id: string;
  name: string;
  retry_limit: number;
  global_timeout_secs: number;
  human_delay_range: [number, number];
  max_loop_count: number;
  steps: Step[];
  entry: string;
}

// ─── Hover 元素检查结果 ────────────────────────────────────────────────────

export interface InspectResult {
  label: string;
  element_type: string;
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
  raw_x: number;
  raw_y: number;
  raw_width: number;
  raw_height: number;
}

// ─── Inspector Types ─────────────────────────────────────────────────────

export interface TreeNode {
  type: string;
  label: string;
  rect: { x: number; y: number; width: number; height: number };
  attributes: Record<string, string>;
  children: TreeNode[];
  elementId?: string; // Appium elementId / GUID
  path: string;       // Unique hierarchy path (e.g. "0.1.2")
}

// ─── Zustand Store ─────────────────────────────────────────────────────────

/** RunnerEvent payload 镜像 Rust RunnerEvent */
export interface RunnerEvent {
  state: 'scanning' | 'executing' | 'sleeping' | 'finished' | 'failed' | 'cancelled';
  step_id?: string;
  step_name?: string;
  action_desc?: string;
  tap_x?: number;
  tap_y?: number;
  remaining_secs?: number;
  total_steps?: number;
  elapsed_secs?: number;
  reason?: string;
}

interface SmartTaskState {
  // 录制状态
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;

  // 当前录制中的任务草稿
  draftTask: Task;
  setDraftName: (name: string) => void;
  setMaxLoopCount: (c: number) => void;
  addStep: (step: Step) => void;
  updateStep: (id: string, partial: Partial<Step>) => void;
  removeStep: (stepId: string) => void;
  reorderSteps: (fromIdx: number, toIdx: number) => void;
  clearDraft: () => void;

  // Inspector 核心数据
  uiTree: TreeNode | null;
  xmlSource: string;
  isFetchingSource: boolean;
  selectedElementId: string | null;
  hoverElementId: string | null;

  // Hover 高亮 (单点结果，兼容旧代码)
  hoverElement: InspectResult | null;
  setHoverElement: (el: InspectResult | null) => void;

  // 框选区域 (拖拽矩形，百分比坐标)
  pendingRegion: Region | null;
  setPendingRegion: (r: Region | null) => void;

  // 已保存任务列表
  savedTasks: Task[];
  setSavedTasks: (tasks: Task[]) => void;

  // 执行引擎状态
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  runnerEvent: RunnerEvent | null;
  setRunnerEvent: (e: RunnerEvent | null) => void;
  activeTab: 'tasks' | 'inspector';
  setActiveTab: (tab: 'tasks' | 'inspector') => void;

  // Calibration State (for re-targeting existing step coordinate)
  calibratingStepId: string | null;
  setCalibratingStepId: (id: string | null) => void;

  setSelectedElementId: (id: string | null) => void;
  setHoverElementId: (id: string | null) => void;
  setInspectorData: (data: { tree: TreeNode | null; xml: string }) => void;
  setNodeElementId: (path: string, elementId: string) => void;

  // Layout Widths (Dynamic Resizing)
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  inspectorWidth: number;
  setInspectorWidth: (w: number) => void;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function newDraftTask(): Task {
  return {
    task_id: generateId(),
    name: '新任务',
    retry_limit: 3,
    global_timeout_secs: 120,
    human_delay_range: [200, 800],
    max_loop_count: 0,
    steps: [],
    entry: '',
  };
}

export const useSmartTaskStore = create<SmartTaskState>()(
  persist(
    (set) => ({
      isRecording: false,
  setIsRecording: (v) => set({ isRecording: v }),

  draftTask: newDraftTask(),
  setDraftName: (name) =>
    set((s) => ({ draftTask: { ...s.draftTask, name } })),
  addStep: (step) =>
    set((s) => {
      const steps = [...s.draftTask.steps, step];
      // 如果之前没有任何步骤，新的步骤自动成为入口
      const entry = steps.length === 1 ? step.id : s.draftTask.entry;
      return {
        draftTask: {
          ...s.draftTask,
          steps,
          entry,
        },
      };
    }),
  updateStep: (id, partial) => set(state => ({
    draftTask: {
      ...state.draftTask,
      steps: state.draftTask.steps.map(s => {
        if (s.id !== id) return s;
        
        // --- 工业级深层合并逻辑 ---
        const newStep = { ...s, ...partial };
        
        // 1. 如果 partial 中包含 variable_extraction，由于它是对象，需要手动合并子字段
        if (partial.variable_extraction) {
          newStep.variable_extraction = {
            ...s.variable_extraction!,
            ...partial.variable_extraction
          };
        }
        
        // 2. 对于 action 也要特殊处理，防止 type 切换时属性丢失
        if (partial.action) {
          newStep.action = {
            ...s.action,
            ...partial.action
          };
        }

        // 3. 对于 on_success 也要特殊处理
        if (partial.on_success) {
          newStep.on_success = {
            ...s.on_success,
            ...partial.on_success
          } as SuccessRoute;
        }
        
        return newStep;
      })
    }
  })),
  setMaxLoopCount: (c) =>
    set((s) => ({ draftTask: { ...s.draftTask, max_loop_count: c } })),
  removeStep: (stepId) =>
    set((s) => {
      const steps = s.draftTask.steps.filter((st) => st.id !== stepId);
      // 如果删掉的是当前入口，自动切换到剩下的第一个步骤
      let entry = s.draftTask.entry;
      if (entry === stepId) {
        entry = steps.length > 0 ? steps[0].id : '';
      }
      return {
        draftTask: {
          ...s.draftTask,
          steps,
          entry,
        },
      };
    }),
  reorderSteps: (fromIdx, toIdx) =>
    set((s) => {
      const steps = [...s.draftTask.steps];
      const [moved] = steps.splice(fromIdx, 1);
      steps.splice(toIdx, 0, moved);
      // 排序改变后，默认将第一个步骤作为入口（除非用户以后有显式设置入口的 UI）
      return { 
        draftTask: { 
          ...s.draftTask, 
          steps,
          entry: steps.length > 0 ? steps[0].id : ''
        } 
      };
    }),
  clearDraft: () => set({ draftTask: newDraftTask() }),

  // Inspector States
  uiTree: null,
  xmlSource: '',
  isFetchingSource: false,
  selectedElementId: null,
  hoverElementId: null,

  hoverElement: null,
  setHoverElement: (el) => set({ hoverElement: el }),

  pendingRegion: null,
  setPendingRegion: (r) => set({ pendingRegion: r }),

  savedTasks: [],
  setSavedTasks: (tasks) => set({ savedTasks: tasks }),

  isRunning: false,
  setIsRunning: (v) => set({ isRunning: v }),
  runnerEvent: null,
  setRunnerEvent: (e) => set({ runnerEvent: e }),

  activeTab: 'tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // New Actions
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setHoverElementId: (id) => set({ hoverElementId: id }),
  setInspectorData: ({ tree, xml }) => set({ 
    uiTree: tree, 
    xmlSource: xml, 
    isFetchingSource: false 
  }),
  
  // Layout Widths
  sidebarWidth: 380,
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(280, Math.min(600, w)) }),
  inspectorWidth: 820,
  setInspectorWidth: (w) => set({ inspectorWidth: Math.max(400, Math.min(1200, w)) }),

  // Calibration
  calibratingStepId: null,
  setCalibratingStepId: (id) => set({ calibratingStepId: id }),

  setNodeElementId: (path, elementId) => set((s) => {
    if (!s.uiTree) return s;
    const updateRecursively = (node: TreeNode): TreeNode => {
      if (node.path === path) return { ...node, elementId };
      if (!node.children.length) return node;
      return { ...node, children: node.children.map(updateRecursively) };
    };
    return { uiTree: updateRecursively(s.uiTree) };
  }),
    }),
    {
      name: 'smart-task-storage',
      partialize: (state) => ({ 
        draftTask: state.draftTask, 
        savedTasks: state.savedTasks,
        activeTab: state.activeTab,
        sidebarWidth: state.sidebarWidth,
        inspectorWidth: state.inspectorWidth
      }),
    }
  )
);
