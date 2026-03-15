/**
 * Video Worker - Handles MJPEG rendering via WebSocket or Direct HTTP Fetch.
 */

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let socket: WebSocket | null = null;
let fetchAbortController: AbortController | null = null;
let msgCount = 0;

// Shared frame processing logic
let frameQueue: ArrayBuffer[] = [];
let isProcessing = false;

const processNextFrame = async () => {
  if (isProcessing || frameQueue.length === 0) return;
  isProcessing = true;
  if (frameQueue.length > 1) {
    frameQueue.splice(0, frameQueue.length - 1);
  }
  const data = frameQueue.shift()!;
  await processFrame(data);
  isProcessing = false;
  if (frameQueue.length > 0) {
    processNextFrame();
  }
};

const processFrame = async (data: ArrayBuffer) => {
  const view = new Uint8Array(data);
  msgCount++;

  // Log first few frames for debugging
  if (msgCount <= 5) {
    const header = Array.from(view.slice(0, Math.min(8, view.length)))
      .map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`>>> [VideoWorker] Processing frame #${msgCount}, size=${data.byteLength}, header=[${header}]`);
  }

  // JPEG marker: FF D8 ... FF D9
  const isJpeg = view.length >= 2 && view[0] === 0xFF && view[1] === 0xD8;

  if (isJpeg) {
    try {
      const blob = new Blob([data], { type: 'image/jpeg' });
      const bitmap = await createImageBitmap(blob);
      if (ctx && canvas) {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      }
      bitmap.close();
      self.postMessage({ type: 'FRAME_PROCESSED', payload: { size: data.byteLength } });
    } catch (err) {
      console.error('>>> [VideoWorker] MJPEG decode fail:', err);
    }
  } else {
    if (msgCount <= 10) {
      console.warn('>>> [VideoWorker] Not a JPEG frame, first 8 bytes:',
        Array.from(view.slice(0, Math.min(8, view.length))).map(b => b.toString(16).padStart(2,'0')).join(' '));
    }
  }
};

const connectWebSocket = (url: string) => {
  console.log('>>> [VideoWorker] Connecting via WebSocket:', url);
  
  if (socket) {
    console.log('>>> [VideoWorker] Closing existing WebSocket');
    socket.close();
    socket = null;
  }
  
  socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";
  msgCount = 0;

  socket.onopen = () => {
    console.log('>>> [VideoWorker] WebSocket connected');
    self.postMessage({ type: 'STATUS', payload: { connected: true } });
  };

  socket.onmessage = (event: MessageEvent) => {
    const data = event.data as ArrayBuffer;
    
    // Log first few frames for debugging
    if (msgCount < 5) {
      console.log(`>>> [VideoWorker] Received frame #${msgCount + 1}, size: ${data.byteLength} bytes`);
    }
    
    if (frameQueue.length > 0) {
      frameQueue[0] = data;
    } else {
      frameQueue.push(data);
    }
    processNextFrame();
  };

  socket.onclose = (ev) => {
    console.log('>>> [VideoWorker] WebSocket closed, code:', ev.code, 'reason:', ev.reason);
    self.postMessage({ type: 'STATUS', payload: { connected: false } });
  };

  socket.onerror = (ev) => {
    console.error('>>> [VideoWorker] WebSocket error:', ev);
  };
};

const connectFetchStream = async (url: string) => {
  console.log('>>> [VideoWorker] Connecting via Direct Fetch:', url);
  fetchAbortController = new AbortController();
  msgCount = 0;

  try {
    // Try to fetch. Note: This might fail due to CORS if WDA doesn't allow it.
    const response = await fetch(url + '/', { // Added / just in case
        signal: fetchAbortController.signal,
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    console.log('>>> [VideoWorker] Direct Fetch connected');
    self.postMessage({ type: 'STATUS', payload: { connected: true } });
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No body');

    let buffer = new Uint8Array(0);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;

      // Find all JPEG frames in the buffer
      while (true) {
        let start = -1;
        for (let i = 0; i < buffer.length - 1; i++) {
          if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8) {
            start = i;
            break;
          }
        }
        if (start === -1) {
            // No marker? Keep only a bit of data just in case it's split
            if (buffer.length > 10) buffer = buffer.slice(buffer.length - 10);
            break;
        }

        let end = -1;
        for (let i = start; i < buffer.length - 1; i++) {
          if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
            end = i + 2;
            break;
          }
        }

        if (end !== -1) {
          const frame = buffer.slice(start, end);
          buffer = buffer.slice(end);
          
          if (frameQueue.length > 0) frameQueue[0] = frame.buffer;
          else frameQueue.push(frame.buffer);
          processNextFrame();
        } else {
          // Found start but not end. If buffer is huge, something is wrong
          if (buffer.length > 1024 * 1024 * 3) buffer = buffer.slice(start + 2);
          break;
        }
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error('>>> [VideoWorker] Direct Fetch error:', err);
      // Fallback message to frontend that direct fetch failed (likely CORS)
      self.postMessage({ type: 'STATUS', payload: { connected: false, error: 'CORS' } });
    }
  }
};

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    canvas = payload.canvas;
    ctx = canvas!.getContext('2d', { alpha: false, desynchronized: true });
  }

  if (type === 'CONNECT') {
    const { url } = payload;
    if (socket) socket.close();
    if (fetchAbortController) fetchAbortController.abort();
    
    if (url.startsWith('ws')) {
      connectWebSocket(url);
    } else {
      connectFetchStream(url);
    }
  }

  if (type === 'DISCONNECT') {
    if (socket) socket.close();
    if (fetchAbortController) fetchAbortController.abort();
    self.postMessage({ type: 'STATUS', payload: { connected: false } });
  }

  if (type === 'RESIZE') {
    if (canvas) {
      canvas.width = payload.width;
      canvas.height = payload.height;
    }
  }
};
