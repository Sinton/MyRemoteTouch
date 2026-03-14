import { invoke } from "@tauri-apps/api/core";

/**
 * DeviceService - Centralized management of backend communication for device control.
 * This abstracts away the 'invoke' strings and provides typed methods.
 */
export const DeviceService = {
  // Device Info
  async getWindowSize() {
    return await invoke<{ width: number; height: number }>("get_window_size");
  },

  async updateVideoSettings(quality: number, framerate: number) {
    return await invoke("update_video_settings", { quality, framerate });
  },

  // Touch Controls
  async sendTap(x: number, y: number) {
    return await invoke("send_tap", { x, y });
  },

  async sendTouchActions(actions: { x: number; y: number; time: number }[]) {
    return await invoke("send_touch_actions", { actions });
  },

  // Key Events
  async sendKeys(key: string) {
    return await invoke("send_keys", { key });
  },

  // Hardware Buttons
  async pressHome() {
    return await invoke("press_home_button");
  },

  async pressMute() {
    return await invoke("press_mute_button");
  },

  async pressVolumeUp() {
    return await invoke("press_volume_up");
  },

  async pressVolumeDown() {
    return await invoke("press_volume_down");
  },

  async toggleLock() {
    return await invoke("toggle_lock");
  }
};
