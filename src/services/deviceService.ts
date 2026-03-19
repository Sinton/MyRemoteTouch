import { invoke } from "@tauri-apps/api/core";

let lastInteractionTime = 0;
const markInteraction = () => { lastInteractionTime = Date.now(); };

/**
 * DeviceService - Centralized management of backend communication for device control.
 * This abstracts away the 'invoke' strings and provides typed methods.
 */
export const DeviceService = {
  // Utility
  getLastInteractionTime() { return lastInteractionTime; },

  // Device Info
  async getWindowSize() {
    return await invoke<{ width: number; height: number }>("get_window_size");
  },

  async setOrientation(orientation: string) {
    return await invoke("set_orientation", { orientation });
  },

  async updateVideoSettings(quality: number, framerate: number) {
    return await invoke("update_video_settings", { quality, framerate });
  },

  async updateVideoSettingsWithScale(quality: number, framerate: number, scale: number) {
    return await invoke("update_video_settings_with_scale", { quality, framerate, scale });
  },

  // Diagnostics
  async diagnoseWdaConnection() {
    return await invoke<{
      wda_reachable: boolean;
      session_id: string;
      session_valid: boolean;
      error_message?: string;
    }>("diagnose_wda_connection");
  },

  // Touch Controls
  async sendTap(x: number, y: number) {
    markInteraction();
    return await invoke("send_tap", { x, y });
  },

  async sendTouchActions(actions: { x: number; y: number; time: number }[]) {
    markInteraction();
    return await invoke("send_touch_actions", { actions });
  },

  // Key Events
  async sendKeys(key: string) {
    markInteraction();
    return await invoke("send_keys", { key });
  },

  // Hardware Buttons
  async pressHome() {
    markInteraction();
    return await invoke("press_home_button");
  },

  async pressMute() {
    markInteraction();
    return await invoke("press_mute_button");
  },

  async pressVolumeUp() {
    markInteraction();
    return await invoke("press_volume_up");
  },

  async pressVolumeDown() {
    markInteraction();
    return await invoke("press_volume_down");
  },

  async toggleLock() {
    markInteraction();
    return await invoke("toggle_lock");
  },

  async setVideoActive(active: boolean) {
    return await invoke("set_video_active", { active });
  },

  // UI Elements
  async findElement(strategy: string, selector: string): Promise<string> {
    return await invoke("find_element", { strategy, selector });
  },

  async findElementByLabel(label: string): Promise<string> {
    return await invoke("find_element_by_label", { label });
  },

  async getElementRect(elementId: string): Promise<{ x: number; y: number; width: number; height: number }> {
    return await invoke("get_element_rect", { elementId });
  },

  async getUiSource(): Promise<any> {
    return await invoke("get_ui_source");
  },

  async getUiSourceXml(): Promise<string> {
    return await invoke("get_ui_source_xml");
  },

  // SmartTask — 元素嗅探
  async inspectElement(
    xPct: number,
    yPct: number,
    deviceW: number,
    deviceH: number
  ) {
    return await invoke<{
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
    } | null>("inspect_element", { xPct, yPct, deviceW, deviceH });
  },

  // SmartTask — 任务持久化
  async saveTask(task: object) {
    return await invoke("save_task", { task });
  },

  async loadTasks() {
    return await invoke<object[]>("load_tasks");
  },

  async deleteTask(taskId: string) {
    return await invoke("delete_task", { taskId });
  },

  async getTaskStorageDir(): Promise<{ path: string }> {
    return await invoke("get_task_storage_dir");
  },

  // SmartTask — 执行引擎
  async startTaskRunner(task: object, deviceW: number, deviceH: number) {
    return await invoke("start_task_runner", { task, deviceW, deviceH });
  },

  async stopTaskRunner() {
    return await invoke("stop_task_runner");
  },

  async optimizeWdaPerformance() {
    return await invoke("optimize_wda_performance");
  },
};
