/**
 * Video Worker - Decouples WebSocket streaming and image rendering from the main thread.
 * Uses OffscreenCanvas for ultra-smooth performance.
 */

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let socket: WebSocket | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    canvas = payload.canvas;
    ctx = canvas!.getContext('2d');
    console.log(">>> [VideoWorker] Canvas Initialized");
  }

  if (type === 'CONNECT') {
    const { url } = payload;
    if (socket) socket.close();

    socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      self.postMessage({ type: 'STATUS', payload: { connected: true } });
    };

    let latestFrameData: ArrayBuffer | null = null;
    let isRendering = false;

    const renderLatestFrame = async () => {
      if (!ctx || !canvas || !latestFrameData) return;
      isRendering = true;
      
      try {
        const data = latestFrameData;
        latestFrameData = null; // Clear so we know if a new frame arrives

        const blob = new Blob([data], { type: 'image/jpeg' });
        const bitmap = await createImageBitmap(blob);
        
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
      } catch (err) {
        // Drop malformed frames implicitly
      } finally {
        isRendering = false;
        // If a new frame arrived during the render, fire again immediately
        if (latestFrameData) {
          renderLatestFrame();
        }
      }
    };

    socket.onmessage = (event: MessageEvent) => {
      latestFrameData = event.data;
      if (!isRendering) {
        renderLatestFrame();
      }
    };

    socket.onclose = () => {
      self.postMessage({ type: 'STATUS', payload: { connected: false } });
    };
  }

  if (type === 'DISCONNECT') {
    if (socket) {
      socket.close();
      socket = null;
    }
  }

  if (type === 'RESIZE') {
    if (canvas) {
      canvas.width = payload.width;
      canvas.height = payload.height;
    }
  }
};
