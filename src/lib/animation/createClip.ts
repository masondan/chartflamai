/**
 * `createClip` — shared async factory producing a `ClipSpec` for any
 * animatable chart (Phase 1: pictogram + waffle).
 *
 * Preview (Play) and export (Download MP4) both call this function and then
 * drive the returned `drawFrame` — this is what guarantees "what you preview
 * is what you download" (brief §4).
 */

import { FPS, totalMs } from './timeline';
import { preparePictogramClip, type PictogramClipConfig } from './renderers/pictogram';
import { prepareWaffleClip, type WaffleClipConfig } from './renderers/waffle';
import { prepareBarClip, type BarClipConfig } from './renderers/bar';

export interface ClipSpec {
  width: number; // final video size, even integers
  height: number;
  fps: number; // 30
  totalMs: number; // LEAD_IN + anim + HOLD
  animMs: number;
  /** Synchronous — Mediabunny's CanvasSource.add() captures the canvas at call time. */
  drawFrame(ctx: CanvasRenderingContext2D, tMs: number): void;
  /** Destroy any offscreen resources (Chart.js instances, DOM canvases, etc). */
  dispose(): void;
}

export type EditorKind = 'pictogram' | 'waffle' | 'bar';

export interface CreateClipOptions {
  kind: EditorKind;
  animMs: number;
  /** 1 = export resolution; <1 = lower-res preview for smooth playback on weak devices. */
  scale?: number;
  pictogram?: PictogramClipConfig;
  waffle?: WaffleClipConfig;
  bar?: BarClipConfig;
}

export async function createClip(options: CreateClipOptions): Promise<ClipSpec> {
  const { kind, animMs, scale = 1 } = options;

  let prepared: { width: number; height: number; drawFrame: (ctx: CanvasRenderingContext2D, tMs: number, animMs: number) => void; dispose: () => void };

  if (kind === 'pictogram') {
    if (!options.pictogram) throw new Error('createClip: pictogram config required for kind="pictogram"');
    prepared = await preparePictogramClip(options.pictogram, scale);
  } else if (kind === 'waffle') {
    if (!options.waffle) throw new Error('createClip: waffle config required for kind="waffle"');
    prepared = await prepareWaffleClip(options.waffle, scale);
  } else if (kind === 'bar') {
    if (!options.bar) throw new Error('createClip: bar config required for kind="bar"');
    prepared = await prepareBarClip(options.bar, scale);
  } else {
    throw new Error(`createClip: unsupported kind "${kind}"`);
  }

  return {
    width: prepared.width,
    height: prepared.height,
    fps: FPS,
    totalMs: totalMs(animMs),
    animMs,
    drawFrame: (ctx, tMs) => prepared.drawFrame(ctx, tMs, animMs),
    dispose: () => prepared.dispose()
  };
}
