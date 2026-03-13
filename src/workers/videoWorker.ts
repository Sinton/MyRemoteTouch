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

    socket.onmessage = async (event: MessageEvent) => {
      if (!ctx || !canvas) return;
      try {
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const bitmap = await createImageBitmap(blob);
        
        // Parallel rendering via OffscreenCanvas
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
      } catch (err) {
        // Drop malformed frames
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
