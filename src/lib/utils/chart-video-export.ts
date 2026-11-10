/**
 * Chart → MP4 export pipeline (video only, no audio).
 *
 * Ported from AudioFlam's `webcodecs-export.ts` / `video-export.ts` and
 * stripped per the brief (§5):
 *  - No audio of any kind (AudioBuffer, AAC, mono→stereo, playback hooks — all removed).
 *  - New `checkVideoEncodeSupport(width, height)` gates on VideoEncoder only,
 *    and probes H.264 at the REAL output size (not a fixed 640x480 test size).
 *  - No real-time pacing loop — frames are deterministic (`ClipSpec.drawFrame`
 *    is synchronous), so we render as fast as possible and yield to the
 *    event loop periodically so the progress UI can repaint.
 *  - No cloud transcoding tier.
 *
 * Primary path: WebCodecs + Mediabunny (H.264 MP4).
 * Fallback: real-time MediaRecorder on canvas.captureStream(fps).
 */

import type { ClipSpec } from '$lib/animation/createClip';

export interface ExportProgress {
  phase: 'preparing' | 'recording' | 'processing' | 'complete';
  progress: number; // 0–1
  message: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

export interface ExportResult {
  blob: Blob;
  mimeType: string;
}

// Types for Mediabunny (loaded dynamically to keep the initial bundle small).
type MediabunnyModule = typeof import('mediabunny');

let mediabunnyModule: MediabunnyModule | null = null;

async function loadMediabunny(): Promise<MediabunnyModule> {
  if (!mediabunnyModule) {
    mediabunnyModule = await import('mediabunny');
  }
  return mediabunnyModule;
}

/**
 * Check whether this browser can hardware/software-encode H.264 at the
 * actual output size we're about to render. Unlike AudioFlam's original
 * check (which tested a fixed 640x480 and also required AudioEncoder),
 * this is video-only and tests the real dimensions, since some encoders
 * reject sizes they didn't test at a fixed probe resolution.
 */
export async function checkVideoEncodeSupport(
  width: number,
  height: number
): Promise<{ supported: boolean; workingCodec?: string; reason?: string }> {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

  if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
    console.log('[ChartVideo] VideoEncoder not available. UA:', userAgent);
    return { supported: false, reason: 'VideoEncoder API not available' };
  }

  const candidates: VideoEncoderConfig[] = [
    { codec: 'avc1.42001f', width, height, bitrate: 6_000_000, framerate: 30 }, // Baseline 3.1
    { codec: 'avc1.42E01E', width, height, bitrate: 6_000_000, framerate: 30 }, // Baseline 3.0
    { codec: 'avc1.4d001f', width, height, bitrate: 6_000_000, framerate: 30 }, // Main 3.1
    { codec: 'avc1', width, height, bitrate: 6_000_000, framerate: 30 } // Let the browser pick a profile
  ];

  for (const config of candidates) {
    try {
      const result = await VideoEncoder.isConfigSupported(config);
      console.log('[ChartVideo] isConfigSupported', config.codec, result, 'UA:', userAgent);
      if (result.supported) {
        return { supported: true, workingCodec: config.codec };
      }
    } catch (e) {
      console.warn('[ChartVideo] isConfigSupported threw for', config.codec, e);
    }
  }

  return { supported: false, reason: 'No supported H.264 configuration at output size' };
}

export interface WebCodecsExportConfig {
  clip: ClipSpec;
  onProgress?: ProgressCallback;
}

/**
 * Export a ClipSpec to MP4 using WebCodecs + Mediabunny. Frames are rendered
 * deterministically (as fast as possible), not paced to wall-clock time.
 */
export async function exportClipWithWebCodecs(config: WebCodecsExportConfig): Promise<ExportResult> {
  const { clip, onProgress } = config;
  const { width, height, fps, totalMs: clipTotalMs, drawFrame } = clip;

  onProgress?.({ phase: 'preparing', progress: 0, message: 'Loading encoder…' });

  const mb = await loadMediabunny();
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = mb;

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget()
  });

  const totalFrames = Math.ceil((clipTotalMs / 1000) * fps);
  let encodedFrames = 0;

  // Even dimensions are guaranteed by layout.ts (D3); use a plain canvas
  // (OffscreenCanvas not required since drawFrame already targets this size).
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext('2d')!;

  const videoSource = new CanvasSource(exportCanvas, {
    codec: 'avc',
    bitrate: 6_000_000, // ~6 Mbps — charts have thin lines/small text that lower bitrates smear
    keyFrameInterval: 1, // seconds
    onEncodedPacket: () => {
      encodedFrames++;
      const progress = Math.min(encodedFrames / totalFrames, 0.9);
      onProgress?.({
        phase: 'recording',
        progress,
        message: `Rendering ${Math.round(progress * 100)}%`
      });
    }
  });

  output.addVideoTrack(videoSource, { frameRate: fps });

  await output.start();

  onProgress?.({ phase: 'recording', progress: 0, message: 'Rendering…' });

  const frameDurationSec = 1 / fps;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const tMs = (frameIndex / fps) * 1000;
    const timestampSec = frameIndex / fps;

    drawFrame(exportCtx, tMs);
    await videoSource.add(timestampSec, frameDurationSec);

    // Yield to the event loop periodically so the progress UI can repaint;
    // frames are deterministic so there is no wall-clock pacing here.
    if (frameIndex % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  videoSource.close();

  onProgress?.({ phase: 'processing', progress: 0.95, message: 'Finalizing…' });

  await output.finalize();

  const target = output.target as InstanceType<typeof BufferTarget>;
  if (!target.buffer) {
    throw new Error('Export failed: no data produced');
  }
  const blob = new Blob([target.buffer], { type: 'video/mp4' });

  onProgress?.({ phase: 'complete', progress: 1, message: 'Complete' });

  return { blob, mimeType: 'video/mp4' };
}

/**
 * Fallback real-time export via MediaRecorder + canvas.captureStream.
 * Used when checkVideoEncodeSupport fails, or when the WebCodecs path throws.
 */
export async function exportClipWithMediaRecorder(config: WebCodecsExportConfig): Promise<ExportResult> {
  const { clip, onProgress } = config;
  const { width, height, fps, totalMs: clipTotalMs, drawFrame } = clip;

  return new Promise((resolve, reject) => {
    onProgress?.({ phase: 'preparing', progress: 0, message: 'Preparing export…' });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // Safari sometimes requires the canvas to be in the DOM for captureStream to work reliably.
    canvas.style.position = 'fixed';
    canvas.style.left = '-99999px';
    canvas.style.top = '0';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;

    let stream: MediaStream;
    try {
      stream = canvas.captureStream(fps);
    } catch (err) {
      document.body.removeChild(canvas);
      reject(new Error(`Failed to capture canvas: ${err}`));
      return;
    }

    // Chrome's native MediaRecorder MP4 support (avc1) is experimental and can
    // produce corrupted/undecodable files when resolution isn't static
    // throughout recording (observed bug: "codec description is not supposed
    // to change during the entire recording"). WebM/VP9 is mature and
    // reliable, so it's preferred here even though it means this fallback
    // path yields .webm rather than .mp4 (per brief §"Export").
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=avc1',
      'video/mp4'
    ];
    let mimeType = '';
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    if (!mimeType) {
      document.body.removeChild(canvas);
      reject(new Error('No supported video format found on this device'));
      return;
    }

    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      document.body.removeChild(canvas);
      reject(new Error(`Failed to create recorder: ${err}`));
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let resolved = false;
    let rafId: number | null = null;

    function finalize() {
      if (resolved) return;
      resolved = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.body.removeChild(canvas);
      onProgress?.({ phase: 'processing', progress: 0.95, message: 'Finalizing…' });
      const blob = new Blob(chunks, { type: mimeType });
      onProgress?.({ phase: 'complete', progress: 1, message: 'Complete' });
      resolve({ blob, mimeType });
    }

    recorder.onstop = finalize;
    recorder.onerror = (e) => {
      if (resolved) return;
      resolved = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.body.removeChild(canvas);
      reject(new Error(`Recording failed: ${(e as any).message || e}`));
    };

    drawFrame(ctx, 0);

    setTimeout(() => {
      try {
        recorder.start(100);
      } catch (err) {
        reject(new Error(`Failed to start recorder: ${err}`));
        return;
      }

      onProgress?.({ phase: 'recording', progress: 0, message: 'Recording…' });

      const startTime = performance.now();
      function renderLoop() {
        const elapsedMs = performance.now() - startTime;
        if (elapsedMs < clipTotalMs) {
          drawFrame(ctx, elapsedMs);
          onProgress?.({
            phase: 'recording',
            progress: Math.min(elapsedMs / clipTotalMs, 0.9),
            message: `Recording ${Math.round(elapsedMs / 1000)}s / ${Math.round(clipTotalMs / 1000)}s`
          });
          rafId = requestAnimationFrame(renderLoop);
        }
      }
      rafId = requestAnimationFrame(renderLoop);

      setTimeout(() => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch {
          /* ignore */
        }
        stream.getTracks().forEach((t) => t.stop());
        setTimeout(() => {
          if (!resolved && chunks.length > 0) finalize();
        }, 2000);
      }, clipTotalMs + 300);
    }, 50);
  });
}

/**
 * Smart export: always tries WebCodecs first, falls back to MediaRecorder
 * if WebCodecs throws. Avoids false-positive support checks that can give
 * inconsistent results across exports (false positive on first export, then
 * fails on second). Actual exception during encoding is more reliable.
 */
export async function smartExportClip(config: WebCodecsExportConfig): Promise<ExportResult> {
  const { clip, onProgress } = config;
  
  try {
    console.log('[ChartVideo] Attempting WebCodecs export...', 'UA:', navigator.userAgent);
    const result = await exportClipWithWebCodecs({ clip, onProgress });
    console.log('[ChartVideo] WebCodecs export succeeded, format: MP4');
    return result;
  } catch (err) {
    console.warn('[ChartVideo] WebCodecs export failed, falling back to MediaRecorder:', err);
    const result = await exportClipWithMediaRecorder({ clip, onProgress });
    console.log('[ChartVideo] MediaRecorder export complete, format:', result.mimeType.includes('mp4') ? 'MP4' : 'WebM');
    return result;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function extensionFromMimeType(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

/** Build a filename matching the existing PNG naming convention. */
export function generateVideoFilename(baseName: string, mimeType: string): string {
  const ext = extensionFromMimeType(mimeType);
  return `${baseName}.${ext}`;
}
