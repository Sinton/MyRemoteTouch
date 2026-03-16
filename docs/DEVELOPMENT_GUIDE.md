# 🛠️ MyRemoteTouch Development Guide & Specification

Welcome to the development of MyRemoteTouch! This project combines low-latency system programming with a modern web interface. To maintain high code quality and maintainability, please read this manual carefully before you start contributing.

---

## 🏗️ 1. Architectural Overview

MyRemoteTouch follows the classic **Tauri** architecture:

- **Frontend (UI Layer)**: A React application running in a WebView. It handles rendering of the device mirror, user interaction logic, and state presentation.
- **Backend (System Layer)**: Core logic written in Rust. It communicates with the `usbmuxd` daemon, manages the TCP proxy bridge through `idevice`, controls video stream capturing, and handles health check services.

### Core Data Flow
1. **Device Discovery**: The backend continuously listens for `usbmuxd` events using the `idevice` library.
2. **Link Establishment**: Upon device discovery, the backend starts multiple TCP proxies to bridge local ports (e.g., 8100) to corresponding ports on the iOS device.
3. **Control Commands**: The frontend invokes Rust Commands via `invoke`. The backend then wraps these into WDA-standard JSON commands and sends them to the device.
4. **Video Feedback**: Mirroring is typically achieved via private streaming protocols or frame capture through WDA.

---

## 📂 2. Project Structure

### Backend (`src-tauri/src/`)
- `main.rs`: Application entry point and Tauri setup.
- `commands/`: Implementation of backend commands (touch, device, hardware).
- `services/`: Core logic services (proxy, health check, device discovery).
- `clients/`: Client implementations for interacting with WDA.
- `video/`: Logic for video stream processing and capture.
- `error.rs`: Global error handling definitions.

### Frontend (`src/`)
- `components/`: UI components (Toolbar, Debug Panel, Device View).
- `hooks/`: Custom React hooks (Touch Controller, Event Listeners).
- `store/`: Global state management with Zustand.
- `services/`: API and frontend service wrappers.
- `layouts/`: Page layout components.
- `assets/`: Static assets (Logos, Icons).

---

## 💻 3. Coding Standards

### 2.1 Rust Backend Standards
- **No `unwrap()`**: Using `unwrap()` or `expect()` in production code is strictly forbidden. Use the project-defined `AppResult` and `AppError` for proper error propagation.
- **Async Safety**: All long-running tasks (e.g., message polling, proxying) must run within a `tokio` task and respect the `CancellationToken`.
- **Concurrency Control**: Shared state must be managed via `Arc<Mutex<T>>` or `Arc<RwLock<T>>`, with a preference for async-aware locks.
- **Logging**: Use `tracing` macros (`info!`, `warn!`, `error!`). **Note:** Do not use Emojis in log messages to ensure professional formatting and cross-terminal compatibility.

### 2.2 React Frontend Standards
- **Functional Programming**: Exclusively use Functional Components and Hooks.
- **Strict TypeScript**: The use of `any` is strictly prohibited. All component props and store states must have explicit interface definitions.
- **Styling**: Unified use of **Tailwind CSS**.
  - Follow a **Visual-First** principle: Use utilities like `backdrop-blur-xl`, `bg-white/5`, and `border-white/10` to maintain a high-end "glassmorphic" aesthetic.
  - Avoid creating redundant external CSS files.
- **State Management**: Use `Zustand`.
  - Simple UI states can use `useState`.
  - Global configurations, device statuses, and toggles must be in `useAppStore` with persistence enabled where necessary.

---

## 🎨 3. UI/UX Design Principles

MyRemoteTouch aims for a **"Premium & Productive"** sensory experience:
- **Corner Radius**: The primary corner radius is fixed at `rounded-xl` (12px) or `rounded-2xl`. Action buttons may use `rounded-lg` for finer detail.
- **Animations**: Every visibility change must be accompanied by a `transition` or physics-based animation. A `cubic-bezier(0.2, 0.8, 0.2, 1)` curve is recommended for smooth transitions.
- **Interactive Feedback**: Button clicks must provide physical feedback via `active:scale-95` or subtle brightness changes.
- **Developer Panel**: Keep the design magnetic and semi-transparent. Ensure it doesn't completely obstruct the user's view of the mirrored device.

---

## 🚀 4. Development Workflow

### 4.1 Adding a New Feature
1. **Define Backend Command**: Create logic under `src-tauri/src/commands/` and register it in `main.rs`.
2. **Error Handling**: Add corresponding error enums in `error.rs`.
3. **Frontend Invocation**: Call the backend using the `invoke` method from `@tauri-apps/api/core`.
4. **Log Tracing**: Add `TouchDebugger.log` at key nodes for observation within the debug console.

### 4.2 Debugging Environment
- **Backend Logs**: Monitor the output of `pnpm tauri dev` in your terminal.
- **Frontend Logs**: Enable "Developer Mode" in the app and use the slide-out "Debug Console" to view real-time data flows.

---

## 🧪 5. Coordinate Mapping Reference

One of the project's most critical logics:
- **Canvas Size**: The dimensions the user sees on the computer (subject to window scaling).
- **Device Resolution**: The actual physical pixels of the iPhone (e.g., 1170x2532).
- **Mapping Formula**: 
  `Device_X = (Mouse_X - Offset_X) / Render_Width * Native_Width`
  *Refer to `useTouchController.ts` for the detailed implementation.*

---

We hope this guide provides a pleasant development experience. If you have any questions, feel free to open an Issue for discussion!
