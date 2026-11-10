/**
 * Bar chart animation renderer (Phase 2, Section B).
 *
 * Mechanism: feathered wipe reveal of full-color bars over greyed base layer.
 * Direction varies by orientation:
 *   - Vertical bars: bottom→top
 *   - Horizontal bars: left→right
 *
 * Two-layer compositing pattern (identical to waffle.ts):
 *   1. Base layer: greyed bars + title + caption + axes + legend (static, baked once)
 *   2. Animated layer: full-color bars clipped by wipe rectangle with soft feather
 *
 * Final frame at t=totalMs matches PNG export pixel-for-pixel (same as waffle).
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
  scaleConfigForAnimation,
  ANIMATION_STYLE_SCALE,
  type BarClipConfig
} from './bar-chart-setup';

export type { BarClipConfig };
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
const FEATHER_WIDTH = 80; // soft edge width in export pixels

/**
 * Prepare a bar chart animation clip (full MP4-export quality).
 *
 * @param config BarClipConfig snapshot from ChartEditor at animate-open time
 * @param scale optional DPI scale (default 1)
 * @returns PreparedClip with drawFrame and dispose methods
 */
export async function prepareBarClip(config: BarClipConfig, scale = 1): Promise<PreparedClip> {
  // Extract chart orientation for wipe direction logic
  const barOrientation = config.barOrientation || 'vertical'; // 'vertical' | 'horizontal'

  // Calculate chart height dynamically based on barAspectRatio (0–150, default 100).
  // INVERSE relationship — matches ChartEditor.svelte's canvas-container height
  // formula: `240 * (100 / barAspectRatio)`. Chart.js's aspectRatio option is
  // width/height, so a LARGER barAspectRatio value means a FLATTER (shorter)
  // chart, not a taller one. E.g. 100 → 600px, 150 → 400px, 50 → 1200px.
  const BASE_CHART_HEIGHT = Math.round(600 * (100 / (config.barAspectRatio || 100)));

  // Step 1: Create hidden-data render (greyed bars + axes/legend)
  // ────────────────────────────────────────────────────────────

  const renderResult = await createHiddenDataRender(config, EXPORT_WIDTH, BASE_CHART_HEIGHT);
  const { chartAreaBounds, normalChart: hiddenChart } = renderResult;

  console.log('[BarClip] chartAreaBounds:', chartAreaBounds);

  // Load fonts for title/caption (same pattern as waffle.ts)
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
  rawHeight += 40; // gap after bars
  rawHeight += captionBlock.height;
  rawHeight += 40; // bottom padding

  const { width, height } = computeVideoSize(EXPORT_WIDTH * scale, rawHeight * scale);

  // Step 3: Build static base canvas (greyed bars + title + caption)
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

  // Draw greyed bars from hiddenCanvas (the hidden-data render)
  const barsYOffset = yOffset;
  baseCtx.drawImage(renderResult.hiddenCanvas, 0, 0, EXPORT_WIDTH, BASE_CHART_HEIGHT, 0, barsYOffset, EXPORT_WIDTH, BASE_CHART_HEIGHT);
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

  const normalConfig = buildChartConfig(scaleConfigForAnimation(config));
  normalConfig.options = normalConfig.options || {};
  normalConfig.options.responsive = false;
  normalConfig.options.maintainAspectRatio = false;
  normalConfig.options.animation = { duration: 0 };
  // Force devicePixelRatio: 1 — see bar-chart-setup.ts for full explanation.
  // Without this, Chart.js scales the canvas backing store by
  // window.devicePixelRatio (e.g. 2x), but normalCanvas is composited below
  // using EXPORT_WIDTH/BASE_CHART_HEIGHT as the source rect, which would
  // then only sample a quarter of the real canvas.
  normalConfig.options.devicePixelRatio = 1;

  const normalChart = new Chart(normalCtx, normalConfig);

  // Pre-render to ensure chartArea is populated
  await new Promise((resolve) => setTimeout(resolve, 50));

  console.log('[BarClip] normalChart created; ready for animated reveal.');

  // Step 5: drawFrame implementation with feathered wipe
  // ─────────────────────────────────────────────────────

  function drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number): void {
    // Draw base canvas (greyed bars + title + caption) at full opacity
    ctx.drawImage(baseCanvas, 0, 0, EXPORT_WIDTH, rawHeight, 0, 0, width, height);

    ctx.save();
    ctx.scale(width / EXPORT_WIDTH, height / rawHeight);

    const p = progressAt(tMs, animMs);
    const eased = easeInOutCubic(p);

    // Determine wipe rectangle based on bar orientation
    let wipeRect: { x: number; y: number; w: number; h: number };

    if (barOrientation === 'horizontal') {
      // Left→Right wipe for horizontal bars
      const wipeLeft = chartAreaBounds.left;
      const wipeWidth = chartAreaBounds.width * eased;
      wipeRect = {
        x: wipeLeft,
        y: barsYOffset,
        w: wipeWidth,
        h: BASE_CHART_HEIGHT
      };
    } else {
      // Bottom→Top wipe for vertical bars (default)
      const wipeTop = barsYOffset + chartAreaBounds.top;
      const wipeHeight = chartAreaBounds.height;
      const wipeBottom = wipeTop + wipeHeight;
      const wipeCurrent = wipeBottom - wipeHeight * eased;
      wipeRect = {
        x: 0,
        y: wipeCurrent,
        w: EXPORT_WIDTH,
        h: wipeBottom - wipeCurrent
      };
    }

    // Draw normal (full-color) layer clipped by wipe rectangle
    ctx.save();
    ctx.beginPath();
    ctx.rect(wipeRect.x, wipeRect.y, wipeRect.w, wipeRect.h);
    ctx.clip();

    ctx.drawImage(normalCanvas, 0, 0, EXPORT_WIDTH, BASE_CHART_HEIGHT, 0, barsYOffset, EXPORT_WIDTH, BASE_CHART_HEIGHT);

    ctx.restore();
    ctx.restore();
  }

  // Step 6: Disposal
  // ────────────────

  function dispose() {
    try {
      normalChart.destroy();
    } catch (e) {
      console.warn('[BarClip] Error disposing normalChart:', e);
    }

    try {
      hiddenChart.destroy();
    } catch (e) {
      console.warn('[BarClip] Error disposing hiddenChart:', e);
    }

    console.log('[BarClip] Charts disposed.');
  }

  return { width, height, drawFrame, dispose };
}
