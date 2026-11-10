/**
 * Pictogram animation renderer (Phase 1 — stub).
 * Full implementation coming in Phase 2.
 */

export interface PictogramClipConfig {
  // TBD in Phase 2
}

export async function preparePictogramClip(config: PictogramClipConfig, scale = 1) {
  return {
    width: 1080,
    height: 720,
    drawFrame: (_ctx: CanvasRenderingContext2D, _tMs: number, _animMs: number) => {
      // TBD
    },
    dispose: () => {
      // TBD
    }
  };
}
