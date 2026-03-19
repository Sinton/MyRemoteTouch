import { create } from 'zustand';

// ─── DSL Types (镜像 Rust model.rs 的数据结构) ─────────────────────────────

export interface Region {
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
}

export type Selector =
  | { type: 'wda_label'; value: string }
  | { type: 'wda_predicate'; value: string }
  | { type: 'ocr_text'; value: string; region?: Region }
  | { type: 'template_icon'; icon_id: string; region?: Region };

export type Action =
  | { type: 'tap'; offset_x: number; offset_y: number }
  | { type: 'smart_sleep'; variable: string; fallback_secs: number }
  | { type: 'finish' };

export type FailurePolicy =
  | 'retry'
  | { goto_step: string }
  | 'abort';

export interface Step {
  id: string;
  name: string;
  selector: Selector;
  action: Action;
  pre_delay_ms: number;
  post_delay_ms: number;
  timeout_ms: number;
  on_success: string | null;
  on_failure: FailurePolicy;
}

export interface Task {
  task_id: string;
  name: string;
  retry_limit: number;
  global_timeout_secs: number;
  human_delay_range: [number, number];
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
  addStep: (step: Step) => void;
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

  // Actions
  setSelectedElementId: (id: string | null) => void;
  setHoverElementId: (id: string | null) => void;
  setInspectorData: (data: { tree: TreeNode | null; xml: string }) => void;
  setNodeElementId: (path: string, elementId: string) => void;
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
    steps: [],
    entry: '',
  };
}

export const useSmartTaskStore = create<SmartTaskState>((set) => ({
  isRecording: false,
  setIsRecording: (v) => set({ isRecording: v }),

  draftTask: newDraftTask(),
  setDraftName: (name) =>
    set((s) => ({ draftTask: { ...s.draftTask, name } })),
  addStep: (step) =>
    set((s) => {
      const steps = [...s.draftTask.steps, step];
      return {
        draftTask: {
          ...s.draftTask,
          steps,
          entry: s.draftTask.entry || step.id,
        },
      };
    }),
  removeStep: (stepId) =>
    set((s) => ({
      draftTask: {
        ...s.draftTask,
        steps: s.draftTask.steps.filter((st) => st.id !== stepId),
      },
    })),
  reorderSteps: (fromIdx, toIdx) =>
    set((s) => {
      const steps = [...s.draftTask.steps];
      const [moved] = steps.splice(fromIdx, 1);
      steps.splice(toIdx, 0, moved);
      return { draftTask: { ...s.draftTask, steps } };
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
  setNodeElementId: (path, elementId) => set((s) => {
    if (!s.uiTree) return s;
    const updateRecursively = (node: TreeNode): TreeNode => {
      if (node.path === path) return { ...node, elementId };
      if (!node.children.length) return node;
      return { ...node, children: node.children.map(updateRecursively) };
    };
    return { uiTree: updateRecursively(s.uiTree) };
  }),
}));
