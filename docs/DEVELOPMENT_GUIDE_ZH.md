# 🛠️ MyRemoteTouch 开发指南与规范手册

欢迎加入 MyRemoteTouch 的开发！本项目是一个结合了低延迟系统编程与现代化 Web 交互的项目。为了保持代码的高质量和可维护性，请在开发前仔细阅读本手册。

---

## 🏗️ 1. 项目架构概览

MyRemoteTouch 采用经典的 **Tauri** 架构：

- **Frontend (UI 层)**: 运行在 WebView 中的 React 应用。负责渲染设备镜像、处理用户交互逻辑以及展示状态。
- **Backend (系统层)**: Rust 编写的核心逻辑。负责与 `usbmuxd` 守护进程通信、建立端口转发协议桥 (`Proxy`)、管理视频流采集以及健康检查服务。

### 核心流转逻辑
1. **设备发现**: 后端通过 `idevice` 持续监听 `usbmuxd` 事件。
2. **链路建立**: 发现设备后，后端启动多个 TCP 代理，将本地端口（如 8100）桥接到 iOS 设备的对应端口。
3. **控制指令**: 前端通过 `invoke` 调用 Rust Command，后端将指令封装为 WDA 标准的 JSON 并发送。
4. **视频回传**: (根据项目当前实现) 通常通过特定的私有流协议或 WDA 帧采集回传。

---

## 📂 2. 项目目录结构

### 后端核心 (`src-tauri/src/`)
- `main.rs`: 应用入口与 Tauri 初始化配置。
- `commands/`: 后端指令实现（触控、设备信息、硬件按键）。
- `services/`: 核心服务逻辑（代理转发、健康检查、设备发现）。
- `clients/`: WDA 交互客户端实现。
- `video/`: 视频采集与流处理逻辑。
- `error.rs`: 全局错误定义。

### 前端 UI (`src/`)
- `components/`: UI 组件库（工具栏、调试面板、设备视图）。
- `hooks/`: 自定义 React Hooks（触控控制、事件监听）。
- `store/`: 基于 Zustand 的全局状态管理。
- `services/`: API 调用与前端服务封装。
- `layouts/`: 页面布局组件。
- `assets/`: 静态资源（Logo、图标）。

---

## 💻 3. 代码规范

### 2.1 Rust 后端规范
- **禁止 `unwrap()`**: 严禁在生产代码中使用 `unwrap()` 或 `expect()`。请使用项目中定义的 `AppResult` 和 `AppError` 进行错误冒泡。
- **异步安全**: 所有的长时任务（如消息轮询、代理转发）必须在 `tokio` 协程中运行，并持有 `CancellationToken`。
- **并发控制**: 共享状态必须使用 `Arc<Mutex<T>>` 或 `Arc<RwLock<T>>`，优先使用异步版本的锁。
- **日志记录**: 使用 `tracing` 宏（`info!`, `warn!`, `error!`）。**注意：** 禁止在日志中使用 Emoji 表情，保持日志的专业与跨终端兼容性。

### 2.2 React 前端规范
- **函数式编程**: 全面使用函数式组件 (Functional Components) 与 Hooks。
- **TypeScript 严格模式**: 严禁使用 `any`，所有组件 Props 和 Store 状态必须有明确的接口定义。
- **样式方案**: 统一使用 **Tailwind CSS**。
  - 遵循**视觉优先**原则：使用 `backdrop-blur-xl`、`bg-white/5`、`border-white/10` 等工具类营造高端的“玻璃拟态”感。
  - 避免创建多余的 CSS 文件。
- **状态管理**: 使用 `Zustand`。
  - UI 相关的简单状态可使用 `useState`。
  - 全局配置、设备状态、开关控制必须存入 `useAppStore` 并按需启用持久化。

---

## 🎨 3. UI/UX 设计准则

MyRemoteTouch 追求的是 **“Premium & Productive”** 的感官体验：
- **圆角**: 界面主圆角固定为 `rounded-xl` (12px) 或 `rounded-2xl`，操作按钮视精细度可调小为 `rounded-lg`。
- **动画**: 所有的显示/隐藏动作必须配备 `transition` 或物理动效。推荐使用 `cubic-bezier(0.2, 0.8, 0.2, 1)` 实现柔顺的滑入效果。
- **交互反馈**: 按钮点击必须有 `active:scale-95` 或背景色变白/变暗的物理反馈。
- **开发者面板**: 保持磁吸、半透明的设计，确保它即便在打开状态下也不会完全遮挡用户对设备镜像的观察。

---

## 🚀 4. 开发工作流

### 4.1 添加一个新功能
1. **定义后端指令**: 在 `src-tauri/src/commands/` 下创建逻辑，并在 `main.rs` 中注册。
2. **错误处理**: 在 `error.rs` 中添加对应的错误枚举。
3. **前端调用**: 使用 `@tauri-apps/api/core` 的 `invoke` 方法。
4. **日志追踪**: 在关键节点添加 `TouchDebugger.log`，方便在调试磁贴中观察。

### 4.2 环境调试
- **查看后端日志**: 在终端观察 `pnpm tauri dev` 的输出。
- **查看前端日志**: 开启应用内的“开发者模式”，利用侧滑出来的“调试控制台”查看实时数据流。

---

## 🧪 5. 坐标映射参考

这是本项目最核心的逻辑之一：
- **Canvas 尺寸**: 用户在电脑上看到的画面大小（受窗口缩放影响）。
- **设备分辨率**: iPhone 的真实物理像素（如 1170x2532）。
- **映射公式**: 
  `Device_X = (Mouse_X - Offset_X) / Render_Width * Native_Width`
  *详细代码请参考 `useTouchController.ts`。*

---

希望这份规范能带给你愉快的开发体验。如果有任何疑问，请随时发起 Issue 讨论！
