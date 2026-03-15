import { invoke } from "@tauri-apps/api/core";

/**
 * 调试工具 - 用于诊断 FPS 问题
 */
export const DebugTools = {
  /**
   * 获取当前 WDA 设置
   */
  async getWdaSettings() {
    try {
      const settings = await invoke("get_wda_settings");
      console.log("=== WDA 当前设置 ===");
      console.log(JSON.stringify(settings, null, 2));
      return settings;
    } catch (err) {
      console.error("获取 WDA 设置失败:", err);
      return null;
    }
  },

  /**
   * 测试不同的视频配置
   */
  async testVideoConfig(quality: number, framerate: number, scale: number = 1.0) {
    try {
      console.log(`测试配置: 质量=${quality}, 帧率=${framerate}, 缩放=${scale}`);
      await invoke("update_video_settings_with_scale", { quality, framerate, scale });
      console.log("配置已应用，请观察 FPS 变化");
    } catch (err) {
      console.error("应用配置失败:", err);
    }
  },

  /**
   * 快速测试预设配置
   */
  async quickTest() {
    console.log("=== 开始快速测试 ===");
    
    const configs = [
      { name: "激进模式", quality: 20, framerate: 60, scale: 0.5 },
      { name: "性能模式", quality: 30, framerate: 60, scale: 0.75 },
      { name: "平衡模式", quality: 40, framerate: 60, scale: 1.0 },
      { name: "质量模式", quality: 60, framerate: 30, scale: 1.0 },
    ];

    for (const config of configs) {
      console.log(`\n测试 ${config.name}...`);
      await this.testVideoConfig(config.quality, config.framerate, config.scale);
      console.log("等待 10 秒观察效果...");
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.log("\n=== 测试完成 ===");
  },

  /**
   * 打印性能统计
   */
  printPerformanceStats() {
    if (typeof performance !== 'undefined' && performance.memory) {
      console.log("=== 浏览器性能统计 ===");
      console.log(`内存使用: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`内存限制: ${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
    }
  }
};

// 将调试工具挂载到全局对象，方便在控制台使用
if (typeof window !== 'undefined') {
  (window as any).debugTools = DebugTools;
  console.log("调试工具已加载，使用 window.debugTools 访问");
  console.log("示例:");
  console.log("  debugTools.getWdaSettings()");
  console.log("  debugTools.testVideoConfig(30, 60, 0.75)");
  console.log("  debugTools.quickTest()");
}
