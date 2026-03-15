import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 加载调试工具
import "./utils/debugTools";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    // 暂时移除 StrictMode 以避免 Worker 双重初始化问题
    // <React.StrictMode>
      <App />
    // </React.StrictMode>
  );
}
