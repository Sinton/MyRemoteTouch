/**
 * Video Worker - Decouples WebSocket streaming and image rendering from the main thread.
 * Supports MJPEG and H.264 (via WebCodecs).
 */

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let socket: WebSocket | null = null;
let decoder: any | null = null; // VideoDecoder
let currentCodec = 'avc1.42E01E'; // Default baseline

const initDecoder = (codecString: string = currentCodec) => {
  if (typeof VideoDecoder === 'undefined') {
    return;
  }

  if (decoder) {
    if (currentCodec === codecString && decoder.state === 'configured') return;
    decoder.close();
  }

  currentCodec = codecString;
  decoder = new VideoDecoder({
    output: (frame: VideoFrame) => {
      if (ctx && canvas) {
        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      }
      frame.close();
      // Notify hook that a frame was rendered
      self.postMessage({ type: 'FRAME_PROCESSED', payload: { size: 0 } });
    },
    error: (e: any) => {
      console.error(">>> [VideoWorker] Decoder error:", e);
      decoder = null;
    }
  });

  decoder.configure({
    codec: codecString,
    optimizeForLatency: true,
    hardwareAcceleration: 'prefer-hardware'
  });
};

/**
 * Extract H.264 profile/level from SPS NALU to construct codec string
 */
function getCodecFromSPS(sps: Uint8Array): string {
  if (sps.length < 4) return 'avc1.42E01E';
  const profile = sps[1].toString(16).padStart(2, '0').toUpperCase();
  const constraints = sps[2].toString(16).padStart(2, '0').toUpperCase();
  const level = sps[3].toString(16).padStart(2, '0').toUpperCase();
  return `avc1.${profile}${constraints}${level}`;
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    canvas = payload.canvas;
    ctx = canvas!.getContext('2d', { alpha: false, desynchronized: true });
    initDecoder();
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
      const data = event.data as ArrayBuffer;
      const view = new Uint8Array(data);

      // Detect H.264 Annex-B start code (00 00 00 01)
      if (view[0] === 0 && view[1] === 0 && view[2] === 0 && view[3] === 1) {
        const naluType = view[4] & 0x1f;
        
        if (naluType === 7) {
          const newCodec = getCodecFromSPS(view.slice(4));
          if (newCodec !== currentCodec) {
            initDecoder(newCodec);
          }
        }

        if (decoder && decoder.state === 'configured') {
          try {
            const chunk = new EncodedVideoChunk({
              timestamp: performance.now(),
              type: (naluType === 7 || naluType === 5) ? 'key' : 'delta',
              data: data
            });
            decoder.decode(chunk);
            // For bitrate calculation
            self.postMessage({ type: 'FRAME_PROCESSED', payload: { size: data.byteLength } });
          } catch (err) {
            console.error(">>> [VideoWorker] Decode fail:", err);
          }
        }
      } else {
        // MJPEG
        try {
          const blob = new Blob([data], { type: 'image/jpeg' });
          const bitmap = await createImageBitmap(blob);
          if (ctx && canvas) {
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          }
          bitmap.close();
          self.postMessage({ type: 'FRAME_PROCESSED', payload: { size: data.byteLength } });
        } catch (err) {}
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
    if (decoder) {
      decoder.close();
      decoder = null;
    }
  }

  if (type === 'RESIZE') {
    if (canvas) {
      canvas.width = payload.width;
      canvas.height = payload.height;
    }
  }
};
