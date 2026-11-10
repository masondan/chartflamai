/**
 * Pie / Donut chart animation renderer (Phase 2).
 *
 * Mechanism: angular clip-path wipe (Option B from the handoff) — NOT a
 * rectangular clip like bar/line, since pie/donut has no Cartesian data area.
 * Base layer: greyed pie/donut (reuses the same `createHiddenDataRender()`
 * two-render pattern as bar/line — `buildChartConfig()` already handles
 * pie/donut, and `modifyConfigForHiddenData()` greys `backgroundColor`
 * arrays the same way it greys bar colors). Animated layer: full-color
 * pie/donut, revealed by an expanding annular/wedge sector clip path that
 * sweeps clockwise starting from Chart.js's actual default start angle
 * (12 o'clock — verified from Chart.js source: `DoughnutController
 * ._getRotation()` returns `toRadians(options.rotation - 90)`, and
 * `options.rotation` defaults to `0`, so the default start angle is -90°,
 * i.e. the top of the circle. Canvas 2D's `ctx.arc()` sweeps in the
 * increasing-angle direction, which is clockwise since the y-axis points
 * down — matching the brief's "clockwise from the chart's start angle").
 *
 * Chosen over Option A (Chart.js circumference-interpolation, recreating/
 * updating a live Chart.js instance every frame) to keep perfect parity with
 * bar/line's two-layer compositing architecture and avoid the performance
 * risk of 60-90 Chart.js re-renders per clip noted in the handoff — the
 * clip-path approach reuses the SAME pre-rendered normalCanvas bitmap
 * (rendered once) for every frame, just like bar/line's rectangular wipe.
 *
 * Final frame at t=totalMs matches PNG export pixel-for-pixel (same
 * guarantee as waffle/bar/line/pictogram) since at p=1 the clip covers the
 * full circle and the untouched pre-rendered normalCanvas is revealed
 * exactly as Chart.js drew it.
 */

import { easeInOutCubic, progressAt } from '../timeline';
import {
  type FontSpec,
  computeVideoSize,
  drawTextBlock,
  loadFonts,
  measureTextBlock
} from '../layout';
import {
  createHiddenDataRender,
  scaleConfigForAnimation,
  ANIMATION_STYLE_SCALE,
  type BarClipConfig
} from './bar-chart-setup';

export type { BarClipConfig as PieClipConfig };
import { Chart } from 'chart.js/auto';
import { buildChartConfig } from '$lib/utils/chart-config';

export interface PreparedClip {
  width: number;
  height: number;
  drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number): void;
  dispose(): void;
}

const EXPORT_WIDTH = 1080;
const PADDING = 40;

/** Chart.js's default pie/donut start angle: rotation(0) - 90deg = top (12 o'clock). */
const START_ANGLE = -Math.PI / 2;

/**
 * Prepare a pie/donut chart animation clip (full MP4-export quality).
 *
 * @param config BarClipConfig snapshot from ChartEditor at animate-open time
 *   (shared shape — see BarChartConfigParams, covers pie/donut fields too)
 * @param scale optional DPI scale (default 1)
 * @returns PreparedClip with drawFrame and dispose methods
 */
export async function preparePieClip(config: BarClipConfig, scale = 1): Promise<PreparedClip> {
  // Pie/donut is always square in the editor (ChartEditor.svelte's
  // `.pie-square` class forces `aspect-ratio: 1` — there's no pie-specific
  // aspect-ratio control in the UI, unlike bar/line). Match that here.
  const BASE_CHART_HEIGHT = EXPORT_WIDTH;

  const isDonut = config.isPieVariant === 'donut';

  // Step 1: Create hidden-data render (greyed pie/donut + legend)
  // ────────────────────────────────────────────────────────────

  const renderResult = await createHiddenDataRender(config, EXPORT_WIDTH, BASE_CHART_HEIGHT);
  const { chartAreaBounds, normalChart: hiddenChart } = renderResult;

  console.log('[PieClip] chartAreaBounds:', chartAreaBounds);

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

  let rawHeight = 40; // top padding
  rawHeight += titleBlock.height;
  rawHeight += BASE_CHART_HEIGHT;
  rawHeight += 40; // gap after chart
  rawHeight += captionBlock.height;
  rawHeight += 40; // bottom padding

  const { width, height } = computeVideoSize(EXPORT_WIDTH * scale, rawHeight * scale);

  // Step 3: Build static base canvas (greyed pie/donut + title + caption)
  // ──────────────────────────────────────────────────────────────────

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = EXPORT_WIDTH;
  baseCanvas.height = rawHeight;
  const baseCtx = baseCanvas.getContext('2d')!;

  if (config.bgColor !== 'transparent') {
    baseCtx.fillStyle = config.bgColor === 'white' ? '#FFFFFF' : (config.bgColor || '#FFFFFF');
    baseCtx.fillRect(0, 0, EXPORT_WIDTH, rawHeight);
  }

  let yOffset = 40;

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

  const chartYOffset = yOffset;
  baseCtx.drawImage(renderResult.hiddenCanvas, 0, 0, EXPORT_WIDTH, BASE_CHART_HEIGHT, 0, chartYOffset, EXPORT_WIDTH, BASE_CHART_HEIGHT);
  yOffset += BASE_CHART_HEIGHT + 40;

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

  const scaledConfig = scaleConfigForAnimation(config);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = EXPORT_WIDTH;
  normalCanvas.height = BASE_CHART_HEIGHT;
  const normalCtx = normalCanvas.getContext('2d')!;

  const normalConfig = buildChartConfig(scaledConfig);
  normalConfig.options = normalConfig.options || {};
  normalConfig.options.responsive = false;
  normalConfig.options.maintainAspectRatio = false;
  normalConfig.options.animation = { duration: 0 };
  normalConfig.options.devicePixelRatio = 1;

  const normalChart = new Chart(normalCtx, normalConfig);

  await new Promise((resolve) => setTimeout(resolve, 50));

  console.log('[PieClip] normalChart created; ready for animated reveal.');

  // Center + radius for the angular clip — read Chart.js's OWN computed
  // geometry directly off the rendered controller rather than approximating
  // from chartArea bounds. Chart.js's inner/outer radius already accounts
  // for legend/title reserved space, offsetX/offsetY, and multi-dataset
  // ring weighting — approximating this from chartAreaBounds produced a
  // mismatch (clip inner radius too large relative to the actually-drawn
  // ring), leaving a visible grey ring at the donut's inner edge.
  const arcMeta: any = normalChart.getDatasetMeta(0);
  const arcController = arcMeta.controller;
  const chartArea = normalChart.chartArea;
  const cx = (chartArea.left + chartArea.right) / 2 + (arcController.offsetX || 0);
  const cy = (chartArea.top + chartArea.bottom) / 2 + (arcController.offsetY || 0);

  // The slice-gap border is a centered stroke (half extends beyond
  // outerRadius, half extends inward past innerRadius) — pad the clip by
  // half the (already-scaled) border width plus a small safety pixel so the
  // stroke itself is never clipped off at p=1.
  const borderPad = (scaledConfig.sliceGap || 0) / 2 + 1;
  const clipOuterRadius = (arcController.outerRadius || 0) + borderPad;
  const clipInnerRadius = isDonut ? Math.max((arcController.innerRadius || 0) - borderPad, 0) : 0;

  // ─── Composite the full-color legend onto the base layer ───
  // The angular wipe clip only covers the circular arc region — it never
  // touches the legend, which Chart.js draws as a separate rectangular
  // plugin area (e.g. below the arc). `modifyConfigForHiddenData()` greys
  // the legend swatches too (they inherit dataset colors), so without this
  // the legend would stay permanently grey throughout the whole animation
  // and in the final frame. Fix: read Chart.js's own legend bounding box
  // off the rendered normalChart and composite that rectangle at full
  // color onto baseCanvas (same "always visible, not wiped" treatment as
  // title/caption) — this runs once, so no per-frame cost.
  const legend: any = (normalChart as any).legend;
  if (legend && legend.width > 0 && legend.height > 0) {
    const lx = Math.max(0, Math.floor(legend.left));
    const ly = Math.max(0, Math.floor(legend.top));
    const lw = Math.min(EXPORT_WIDTH, Math.ceil(legend.right)) - lx;
    const lh = Math.min(BASE_CHART_HEIGHT, Math.ceil(legend.bottom)) - ly;
    if (lw > 0 && lh > 0) {
      baseCtx.drawImage(normalCanvas, lx, ly, lw, lh, lx, chartYOffset + ly, lw, lh);
    }
  }

  // Step 5: drawFrame implementation — angular sweep clip
  // ─────────────────────────────────────────────────────

  function drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number): void {
    // Draw base canvas (greyed arc + full-color legend + title + caption)
    ctx.drawImage(baseCanvas, 0, 0, EXPORT_WIDTH, rawHeight, 0, 0, width, height);

    ctx.save();
    ctx.scale(width / EXPORT_WIDTH, height / rawHeight);

    const p = progressAt(tMs, animMs);
    const eased = easeInOutCubic(p);

    if (eased > 0) {
      const endAngle = START_ANGLE + Math.PI * 2 * eased;

      ctx.save();
      ctx.translate(0, chartYOffset);
      ctx.beginPath();

      if (isDonut && clipInnerRadius > 0) {
        // Annular sector: outer arc forward, then inner arc backward, closed.
        ctx.arc(cx, cy, clipOuterRadius, START_ANGLE, endAngle);
        ctx.arc(cx, cy, clipInnerRadius, endAngle, START_ANGLE, true);
        ctx.closePath();
      } else {
        // Solid wedge from center.
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, clipOuterRadius, START_ANGLE, endAngle);
        ctx.closePath();
      }

      ctx.clip();
      ctx.drawImage(normalCanvas, 0, 0, EXPORT_WIDTH, BASE_CHART_HEIGHT, 0, 0, EXPORT_WIDTH, BASE_CHART_HEIGHT);
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
      console.warn('[PieClip] Error disposing normalChart:', e);
    }

    try {
      hiddenChart.destroy();
    } catch (e) {
      console.warn('[PieClip] Error disposing hiddenChart:', e);
    }

    console.log('[PieClip] Charts disposed.');
  }

  return { width, height, drawFrame, dispose };
}
