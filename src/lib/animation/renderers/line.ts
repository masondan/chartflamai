/**
 * Line chart animation renderer (Phase 2).
 *
 * Mechanism: feathered wipe reveal of full-color line/points over a greyed
 * base layer, left→right only (brief v2: "line left→right" — simpler than
 * bar's orientation branching, since line charts have no horizontal/vertical
 * toggle).
 *
 * Reuses ~90% of the bar Chart.js pipeline: `buildChartConfig()` in
 * chart-config.ts already fully handles `activeType === 'line'`, and the
 * two-render hidden/normal pattern + devicePixelRatio fix + style scaling in
 * `bar-chart-setup.ts` are generic (not bar-specific) — they operate on
 * whatever BarClipConfig-shaped object is passed in, which already includes
 * all line fields. This is a parallel file (not an edit to bar.ts) per the
 * handoff's "small edits only" rule, to avoid risking regressions in the
 * now-stable bar path.
 *
 * Final frame at t=totalMs matches PNG export pixel-for-pixel (same
 * guarantee as waffle/bar/pictogram).
 */

import { clamp01, easeInOutCubic, progressAt } from '../timeline';
import {
  type FontSpec,
  computeVideoSize,
  drawTextBlock,
  loadFonts,
  measureTextBlock
} from '../layout';
import {
  createHiddenDataRender,
  buildChartConfigForAnimation,
  ANIMATION_STYLE_SCALE,
  type BarClipConfig
} from './bar-chart-setup';

export type { BarClipConfig as LineClipConfig };
import { Chart } from 'chart.js/auto';

export interface PreparedClip {
  width: number;
  height: number;
  drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number): void;
  dispose(): void;
}

const EXPORT_WIDTH = 1080;
const PADDING = 40;

/**
 * Prepare a line chart animation clip (full MP4-export quality).
 *
 * @param config BarClipConfig snapshot from ChartEditor at animate-open time
 *   (shared shape with bar — see BarChartConfigParams, already covers line)
 * @param scale optional DPI scale (default 1)
 * @returns PreparedClip with drawFrame and dispose methods
 */
export async function prepareLineClip(config: BarClipConfig, scale = 1): Promise<PreparedClip> {
  // Calculate chart height dynamically based on lineAspectRatio (0–150, default 100).
  // INVERSE relationship — matches ChartEditor.svelte's canvas-container height
  // formula: `240 * (100 / lineAspectRatio)` (verified directly in
  // ChartEditor.svelte, NOT assumed from bar's constant — see handoff §3).
  // Same base-height constant (600) as bar.ts, so editor-to-animation scale
  // stays consistent between chart types.
  const BASE_CHART_HEIGHT = Math.round(600 * (100 / (config.lineAspectRatio || 100)));

  // Step 1: Create hidden-data render (greyed line + axes/legend)
  // ────────────────────────────────────────────────────────────

  const renderResult = await createHiddenDataRender(config, EXPORT_WIDTH, BASE_CHART_HEIGHT);
  const { chartAreaBounds, normalChart: hiddenChart } = renderResult;

  console.log('[LineClip] chartAreaBounds:', chartAreaBounds);

  // Load fonts for title/caption (same pattern as bar.ts/waffle.ts)
  const titleFontSpec: FontSpec = {
    family: config.titleFont || 'Inter',
    size: Math.round((config.titleSize || 24) * ANIMATION_STYLE_SCALE),
    bold: config.titleBold || false,
    italic: config.titleItalic || false
  };
  const captionFontSpec: FontSpec = {
    family: config.captionFont || 'Inter',
    size: Math.round((config.captionSize || 14) * ANIMATION_STYLE_SCALE),
    bold: false,
    italic: false
  };

  await loadFonts([titleFontSpec, captionFontSpec]);

  // Step 2: Measure title and caption blocks
  // ──────────────────────────────────────────

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  const textMaxWidth = EXPORT_WIDTH - PADDING * 2;

  const titleBlock = measureTextBlock(
    measureCtx,
    config.chartTitle || '',
    titleFontSpec,
    1.3,
    textMaxWidth,
    config.chartTitle ? 30 : 0
  );
  const captionBlock = measureTextBlock(
    measureCtx,
    config.chartCaption || '',
    captionFontSpec,
    1.3,
    textMaxWidth,
    config.chartCaption ? 40 : 0
  );

  // Compute final dimensions (raw in export-space, then scaled)
  let rawHeight = 40; // top padding
  rawHeight += titleBlock.height;
  rawHeight += BASE_CHART_HEIGHT;
  rawHeight += 40; // gap after chart
  rawHeight += captionBlock.height;
  rawHeight += 40; // bottom padding

  const { width, height } = computeVideoSize(EXPORT_WIDTH * scale, rawHeight * scale);

  // Step 3: Build static base canvas (greyed line + title + caption)
  // ──────────────────────────────────────────────────────────────────

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = EXPORT_WIDTH;
  baseCanvas.height = rawHeight;
  const baseCtx = baseCanvas.getContext('2d')!;

  // Fill background
  if (config.bgColor !== 'transparent') {
    baseCtx.fillStyle = config.bgColor === 'white' ? '#FFFFFF' : (config.bgColor || '#FFFFFF');
    baseCtx.fillRect(0, 0, EXPORT_WIDTH, rawHeight);
  }

  let yOffset = 40;

  // Draw title
  if (config.chartTitle) {
    drawTextBlock(
      baseCtx,
      titleBlock,
      titleFontSpec,
      config.titleColor || '#000000',
      (config.titleAlign as 'left' | 'center' | 'right') || 'left',
      EXPORT_WIDTH,
      PADDING,
      yOffset + 50
    );
    yOffset += titleBlock.height;
  }

  // Draw greyed line chart from hiddenCanvas (the hidden-data render)
  const chartYOffset = yOffset;
  baseCtx.drawImage(renderResult.hiddenCanvas, 0, 0, EXPORT_WIDTH, BASE_CHART_HEIGHT, 0, chartYOffset, EXPORT_WIDTH, BASE_CHART_HEIGHT);
  yOffset += BASE_CHART_HEIGHT + 40;

  // Draw caption
  if (config.chartCaption) {
    drawTextBlock(
      baseCtx,
      captionBlock,
      captionFontSpec,
      config.captionColor || '#000000',
      (config.captionAlign as 'left' | 'center' | 'right') || 'left',
      EXPORT_WIDTH,
      PADDING,
      yOffset
    );
  }

  // Step 4: Create normalChart (full-color) for animated reveal
  // ────────────────────────────────────────────────────────────

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = EXPORT_WIDTH;
  normalCanvas.height = BASE_CHART_HEIGHT;
  const normalCtx = normalCanvas.getContext('2d')!;

  // Use the shared buildChartConfigForAnimation() (not a manual rebuild) so
  // this normalChart's chartArea (incl. the line-specific y-axis tick
  // padding fix) is IDENTICAL to the one createHiddenDataRender() measured
  // chartAreaBounds from above — otherwise the wipe rectangle (computed from
  // chartAreaBounds) and the actual line pixels (drawn in this canvas) would
  // be misaligned by the padding amount.
  const normalConfig = buildChartConfigForAnimation(config);

  const normalChart = new Chart(normalCtx, normalConfig);

  // Pre-render to ensure chartArea is populated
  await new Promise((resolve) => setTimeout(resolve, 50));

  console.log('[LineClip] normalChart created; ready for animated reveal.');

  // Step 5: drawFrame implementation — left→right wipe only
  // ─────────────────────────────────────────────────────────
  // Simple clip-rect approach first (matches brief's wipe mechanism); no
  // marker-specific pop logic unless the simple clip looks wrong in testing
  // (per handoff guidance).

  // Markers/line are centered exactly at chartAreaBounds.left/right (first
  // and last data points), so a wipe clip that ends precisely at those x
  // values cuts the outer half of the first/last marker off — Chart.js's
  // normal (unclipped) rendering doesn't crop them at all, so this would
  // break the "final frame = PNG pixel-for-pixel" guarantee. Pad the clip
  // rect by the marker radius (plus half the line's stroke width as a
  // floor, for when markers are hidden) on both edges so the full
  // first/last marker — and the line's end caps — are never clipped once
  // the wipe reaches them.
  const scaledMarkerRadius = config.markerVisible ? (config.markerSize || 0) * ANIMATION_STYLE_SCALE : 0;
  const scaledLineHalfWidth = ((config.lineWidth || 0) * ANIMATION_STYLE_SCALE) / 2;
  // A touch more than the raw marker radius — accounts for the marker's
  // own border width plus anti-aliasing at the clip edge (confirmed by
  // testing: the raw radius alone still clipped a sliver off the outer
  // edge of the first/last marker).
  const edgePad = Math.max(scaledMarkerRadius, scaledLineHalfWidth) * 1.25 + 4;

  function drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number): void {
    // Draw base canvas (blank track + title + caption) at full opacity
    ctx.drawImage(baseCanvas, 0, 0, EXPORT_WIDTH, rawHeight, 0, 0, width, height);

    ctx.save();
    ctx.scale(width / EXPORT_WIDTH, height / rawHeight);

    const p = progressAt(tMs, animMs);
    const eased = easeInOutCubic(p);

    // Gate on eased > 0 so the padded rect (nonzero width even at eased=0)
    // never reveals anything during lead-in — only once the wipe has
    // actually started does the edge padding apply.
    if (eased > 0) {
      // Left→Right wipe: full chart-row height (matches bar.ts's horizontal
      // orientation geometry — x starts at chartArea.left, full canvas height
      // so axis ticks/labels under that column reveal together with the line).
      const wipeRect = {
        x: chartAreaBounds.left - edgePad,
        y: chartYOffset,
        w: chartAreaBounds.width * eased + edgePad * 2,
        h: BASE_CHART_HEIGHT
      };

      // Draw normal (full-color) layer clipped by wipe rectangle
      ctx.save();
      ctx.beginPath();
      ctx.rect(wipeRect.x, wipeRect.y, wipeRect.w, wipeRect.h);
      ctx.clip();

      ctx.drawImage(normalCanvas, 0, 0, EXPORT_WIDTH, BASE_CHART_HEIGHT, 0, chartYOffset, EXPORT_WIDTH, BASE_CHART_HEIGHT);

      ctx.restore();
    }

    ctx.restore();
  }

  // Step 6: Disposal
  // ────────────────

  function dispose() {
    try {
      normalChart.destroy();
    } catch (e) {
      console.warn('[LineClip] Error disposing normalChart:', e);
    }

    try {
      hiddenChart.destroy();
    } catch (e) {
      console.warn('[LineClip] Error disposing hiddenChart:', e);
    }

    console.log('[LineClip] Charts disposed.');
  }

  return { width, height, drawFrame, dispose };
}
