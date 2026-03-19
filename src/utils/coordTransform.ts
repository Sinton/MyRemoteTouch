/**
 * coordTransform.ts
 * Canvas 像素坐标 <-> 设备 PT 坐标 互换工具
 * 所有中间存储均使用百分比坐标（0.0 ~ 1.0），以兼容不同设备分辨率。
 */

/**
 * 从 Canvas 上的像素坐标，转换为设备百分比坐标
 * @param cx Canvas 像素 X
 * @param cy Canvas 像素 Y
 * @param canvasW Canvas 元素实际宽度（px）
 * @param canvasH Canvas 元素实际高度（px）
 * @returns { xPct, yPct } 0~1 的百分比坐标
 */
export function canvasPxToDevicePct(
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number
): { xPct: number; yPct: number } {
  return {
    xPct: Math.min(1, Math.max(0, cx / canvasW)),
    yPct: Math.min(1, Math.max(0, cy / canvasH)),
  };
}

/**
 * 从设备 PT 坐标（WDA 返回）转换为 Canvas 像素坐标
 * @param ptX WDA 的 PT 坐标 X
 * @param ptY WDA 的 PT 坐标 Y
 * @param deviceW 设备逻辑宽（PT）
 * @param deviceH 设备逻辑高（PT）
 * @param canvasW Canvas 当前渲染宽度（px）
 * @param canvasH Canvas 当前渲染高度（px）
 */
export function devicePtToCanvasPx(
  ptX: number,
  ptY: number,
  deviceW: number,
  deviceH: number,
  canvasW: number,
  canvasH: number
): { cx: number; cy: number } {
  return {
    cx: (ptX / deviceW) * canvasW,
    cy: (ptY / deviceH) * canvasH,
  };
}

/**
 * 从百分比坐标 + 设备尺寸，还原为 WDA PT 坐标（后端使用）
 */
export function pctToDevicePt(
  xPct: number,
  yPct: number,
  deviceW: number,
  deviceH: number
): { ptX: number; ptY: number } {
  return {
    ptX: xPct * deviceW,
    ptY: yPct * deviceH,
  };
}

/**
 * 将 InspectResult 的百分比矩形转换为 Canvas 绘制所需的像素矩形
 */
export function pctRectToCanvasPx(
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  canvasW: number,
  canvasH: number
): { x: number; y: number; w: number; h: number } {
  return {
    x: xPct * canvasW,
    y: yPct * canvasH,
    w: wPct * canvasW,
    h: hPct * canvasH,
  };
}
