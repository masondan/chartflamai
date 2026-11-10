/**
 * Bar Chart animation setup (Phase 2, Section A).
 *
 * Two-render strategy: one Chart.js instance with hidden/greyed data (base layer),
 * one with full colors (animated reveal via wipe). Establishes chartArea bounds
 * for wipe geometry math.
 *
 * Key unknowns Section A solves:
 * 1. Does chart.chartArea populate reliably? What are its bounds?
 * 2. Does greyed backgroundColor hide bars while keeping axes/gridlines/legend visible?
 * 3. Do horizontal bars and stacked mode render correctly with transparent/grey datasets?
 */

import type { ChartConfiguration } from 'chart.js/auto';
import { Chart } from 'chart.js/auto';
import { buildChartConfig, type BarChartConfigParams } from '$lib/utils/chart-config';

/** Snapshot of editor state at animate-open time (one per chart export). */
export interface BarClipConfig extends BarChartConfigParams {
  // Inherited from BarChartConfigParams:
  // - Chart type: activeType, isPieVariant, barOrientation, barMode
  // - Data: labels, values, seriesNames
  // - Styling: bar/line/pie colors, sizing, axis props, legend props
  // - Basic text: chartTitle, chartCaption, bgColor

  // NEW: Title styling (required for base layer rendering)
  titleFont: string;
  titleSize: number;
  titleBold: boolean;
  titleItalic: boolean;
  titleAlign: 'left' | 'center' | 'right';
  titleColor: string;

  // NEW: Caption styling (required for base layer rendering)
  captionFont: string;
  captionSize: number;
  captionAlign: 'left' | 'center' | 'right';
  captionColor: string;
}

/** Result of createHiddenDataRender: both renders + bounds. */
export interface BarChartRenderResult {
  /** Chart.js instance with normal (full-color) data — ready to render. */
  normalChart: Chart;
  /** Canvas context for the hidden-data render. Call chart.toCanvas() to capture. */
  hiddenCanvas: HTMLCanvasElement;
  /** Pixel bounds of the data area (axes/gridlines region), used for wipe math. */
  chartAreaBounds: { left: number; top: number; width: number; height: number };
}

const GREY_COLOR = 'rgba(128, 128, 128, 0.3)'; // Muted grey for base layer bars; legend swatches stay visible

/**
 * The animation canvas renders at EXPORT_WIDTH (1080px) while the live
 * ChartEditor preview canvas tops out at ~416px wide — derived from
 * ChartEditor.svelte's layout: .editor-panel max-width 480px, minus
 * .chart-preview's 1rem (16px) horizontal margin on each side (448px),
 * minus .chart-preview's own 1rem (16px) padding on each side (416px).
 * Chart.js style properties specified in absolute pixels (axis tick font
 * size, bar corner radius, legend font size, line width, marker size, pie
 * slice gap/smoothing) don't scale with canvas size the way layout-relative
 * things do — so without compensation they render far too small/sharp
 * compared to the editor. This same ratio is also used for title/caption
 * text sizing (see bar.ts / waffle.ts), so all text and style elements stay
 * visually proportional between editor and animation.
 */
const EDITOR_CANVAS_WIDTH = 416;
const EXPORT_WIDTH_REF = 1080;
export const ANIMATION_STYLE_SCALE = EXPORT_WIDTH_REF / EDITOR_CANVAS_WIDTH;

/**
 * Return a shallow copy of the config with pixel-based Chart.js style
 * properties scaled up for the larger animation export canvas. Keeps the
 * *visual proportions* (relative to canvas size) identical to the editor
 * preview, rather than rendering at editor-preview pixel values on a much
 * wider canvas.
 */
export function scaleConfigForAnimation(config: BarClipConfig): BarClipConfig {
  return {
    ...config,
    axisSize: config.axisSize * ANIMATION_STYLE_SCALE,
    legendSize: config.legendSize * ANIMATION_STYLE_SCALE,
    barRounding: config.barRounding * ANIMATION_STYLE_SCALE,
    lineWidth: config.lineWidth * ANIMATION_STYLE_SCALE,
    markerSize: config.markerSize * ANIMATION_STYLE_SCALE,
    sliceGap: config.sliceGap * ANIMATION_STYLE_SCALE,
    smoothing: config.smoothing * ANIMATION_STYLE_SCALE
  };
}

/**
 * Build Chart.js config for animation (offscreen canvas, responsive:false).
 * Wrapper around the shared buildChartConfig, with animation-specific overrides.
 */
export function buildChartConfigForAnimation(config: BarClipConfig): ChartConfiguration {
  const scaled = scaleConfigForAnimation(config);
  const baseConfig = buildChartConfig(scaled);

  // Override responsive/animation for offscreen rendering
  baseConfig.options = baseConfig.options || {};
  baseConfig.options.responsive = false;
  baseConfig.options.maintainAspectRatio = false;
  baseConfig.options.animation = { duration: 0 }; // Instant render, no animations
  // Force devicePixelRatio: 1 — otherwise Chart.js scales the canvas backing
  // store by window.devicePixelRatio (e.g. 2x on Retina), so a canvas
  // created at 1080x600 actually gets a 2160x1200 pixel buffer. Downstream
  // compositing code (bar.ts) draws using 1080x600 as the source rect,
  // which then only samples the top-left quarter of the real canvas —
  // causing the cropped/zoomed preview with a grey strip at the bottom.
  baseConfig.options.devicePixelRatio = 1;

  // Line-specific: give the y-axis extra tick padding so the first point's
  // marker — scaled up ~ANIMATION_STYLE_SCALE for the bigger animation
  // canvas — doesn't overlap the y-axis tick labels. Line charts have no
  // x-edge offset by default, so the first/last points sit exactly at
  // chartArea.left/right; a marker radius big enough to read clearly on a
  // 1080px canvas bleeds left into the axis label column that was sized for
  // a much smaller marker on the 416px editor canvas. Padding pushes
  // chartArea.left further right, giving the marker clearance. Scoped to
  // this animation-only render path — buildChartConfig() itself (used by
  // the live editor preview) and the PNG download are untouched.
  if (config.activeType === 'line') {
    const yScale: any = baseConfig.options.scales?.y;
    if (yScale) {
      yScale.ticks = yScale.ticks || {};
      const markerPad = config.markerVisible ? scaled.markerSize || 0 : 0;
      yScale.ticks.padding = markerPad + 10;
    }
  }

  return baseConfig;
}

/**
 * Modify config in-place to hide data for the base layer.
 *
 * Bar/pie: replace backgroundColor with grey ("ghost" convention — keeps
 * axes/gridlines/legend visible, shapes faintly visible pre-wipe).
 *
 * Line: make the line + markers fully transparent instead of greying them —
 * per owner's explicit request, the pre-wipe base layer for line charts
 * shows only axes/gridlines/legend (a "blank track"), and the color wipe
 * reveals the line + markers from nothing rather than color-shifting an
 * already-visible grey line. Scoped to line datasets only — bar/pie keep the
 * grey-ghost convention used by the rest of the animation system.
 */
function modifyConfigForHiddenData(config: ChartConfiguration): void {
  if (!config.data || !config.data.datasets) return;

  const isLine = config.type === 'line';

  config.data.datasets.forEach((ds: any) => {
    if (isLine) {
      ds.borderColor = 'transparent';
      ds.backgroundColor = 'transparent';
      ds.pointBackgroundColor = 'transparent';
      ds.pointBorderColor = 'transparent';
      return;
    }

    // Bars
    if (Array.isArray(ds.backgroundColor)) {
      ds.backgroundColor = ds.backgroundColor.map(() => GREY_COLOR);
    } else if (typeof ds.backgroundColor === 'string') {
      ds.backgroundColor = GREY_COLOR;
    }

    // Line fill (if any)
    if (ds.fill && typeof ds.fill === 'boolean') {
      ds.backgroundColor = GREY_COLOR + '33'; // Very faint for line fills
    }

    // Keep borderColor but also grey (optional; can be omitted for less visual noise)
    if (Array.isArray(ds.borderColor)) {
      ds.borderColor = ds.borderColor.map(() => GREY_COLOR);
    } else if (typeof ds.borderColor === 'string') {
      ds.borderColor = GREY_COLOR;
    }
  });

  console.log('[BarChartSetup] Config modified for hidden data.');
}

/**
 * Create two disposable Chart.js instances: one with hidden data (greyed),
 * one normal. Both are offscreen (never touch the DOM).
 *
 * Returns both + chartArea bounds for subsequent wipe geometry.
 */
export async function createHiddenDataRender(
  config: BarClipConfig,
  canvasWidth: number,
  canvasHeight: number
): Promise<BarChartRenderResult> {
  // 1. Create offscreen canvas with fixed pixel size (responsive:false requires this)
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = canvasWidth;
  normalCanvas.height = canvasHeight;
  const normalCtx = normalCanvas.getContext('2d')!;

  // 2. Build Chart.js config from editor snapshot, but with responsive:false
  const chartConfig = buildChartConfigForAnimation(config);

  // 3. Create normal-data Chart.js instance
  const normalChart = new Chart(normalCtx, chartConfig);

  // 4. Verify chartArea populated
  const chartArea = normalChart.chartArea;
  console.log('[BarChartSetup] normalChart.chartArea:', chartArea);

  if (!chartArea || chartArea.width === 0 || chartArea.height === 0) {
    throw new Error(
      `[BarChartSetup] chart.chartArea not available or zero after render: ${JSON.stringify(chartArea)}`
    );
  }

  // 5. Create hidden-data render: build config with greyed bars, create separate chart instance
  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = canvasWidth;
  hiddenCanvas.height = canvasHeight;
  const hiddenCtx = hiddenCanvas.getContext('2d')!;

  const hiddenConfig = buildChartConfigForAnimation(config);
  modifyConfigForHiddenData(hiddenConfig);
  const hiddenChart = new Chart(hiddenCtx, hiddenConfig);

  console.log('[BarChartSetup] Hidden-data chart created; greyed bars should be visible on base layer.');

  // 6. Return both charts + bounds (dispose them later to avoid memory leaks)
  return {
    normalChart,
    hiddenCanvas,
    chartAreaBounds: {
      left: chartArea.left,
      top: chartArea.top,
      width: chartArea.width,
      height: chartArea.height
    }
  };
}

/**
 * Dispose both chart instances and release canvas references.
 * Call this after you've extracted the base-layer canvas image.
 */
export function disposeBarCharts(normalChart: Chart, hiddenChart: Chart): void {
  try {
    normalChart.destroy();
  } catch (e) {
    console.warn('[BarChartSetup] Error destroying normalChart:', e);
  }

  try {
    hiddenChart.destroy();
  } catch (e) {
    console.warn('[BarChartSetup] Error destroying hiddenChart:', e);
  }

  console.log('[BarChartSetup] Both charts disposed.');
}

/**
 * Capture full ChartEditor state as BarClipConfig snapshot.
 * Call at animate-open time (before rendering preview/export).
 * Ensures animation matches editor state at that moment.
 *
 * @param editorState ChartEditor reactive state (all fields)
 * @returns BarClipConfig snapshot ready for prepareBarClip()
 */
export function captureBarClipConfig(editorState: any): BarClipConfig {
  return {
    // Chart type
    activeType: editorState.activeType,
    isPieVariant: editorState.isPieVariant,

    // Data
    labels: [...editorState.labels],
    values: editorState.values.map((row: number[]) => [...row]),
    seriesNames: [...editorState.seriesNames],

    // Pie/Donut styling
    sliceColors: [...editorState.sliceColors],
    sliceGap: editorState.sliceGap,
    donutCutout: editorState.donutCutout,
    smoothing: editorState.smoothing,

    // Bar styling
    barRounding: editorState.barRounding,
    barSpacing: editorState.barSpacing,
    barAspectRatio: editorState.barAspectRatio,
    barOrientation: editorState.barOrientation,
    barMode: editorState.barMode,
    baseBarColor: editorState.baseBarColor,
    barBarColors: { ...editorState.barBarColors },

    // Line styling
    lineTension: editorState.lineTension,
    lineWidth: editorState.lineWidth,
    lineAspectRatio: editorState.lineAspectRatio,
    markerStyle: editorState.markerStyle,
    markerSize: editorState.markerSize,
    markerVisible: editorState.markerVisible,
    lineColors: [...editorState.lineColors],
    markerColors: [...editorState.markerColors],

    // Text & appearance (from BarChartConfigParams)
    chartTitle: editorState.chartTitle,
    chartCaption: editorState.chartCaption,
    bgColor: editorState.bgColor,
    legendVisible: editorState.legendVisible,
    legendPosition: editorState.legendPosition,
    legendSize: editorState.legendSize,
    legendColor: editorState.legendColor,
    axisVisible: editorState.axisVisible,
    axisSize: editorState.axisSize,
    axisBold: editorState.axisBold,
    axisColor: editorState.axisColor,

    // Title styling (NEW)
    titleFont: editorState.titleFont,
    titleSize: editorState.titleSize,
    titleBold: editorState.titleBold,
    titleItalic: editorState.titleItalic,
    titleAlign: editorState.titleAlign,
    titleColor: editorState.titleColor,

    // Caption styling (NEW)
    captionFont: editorState.captionFont,
    captionSize: editorState.captionSize,
    captionAlign: editorState.captionAlign,
    captionColor: editorState.captionColor
  };
}

/**
 * Restore BarClipConfig snapshot back into ChartEditor state.
 * Used for replay/undo after exporting animation (or initialization from archive).
 *
 * @param config BarClipConfig snapshot
 * @param editorState ChartEditor reactive state (mutated in place)
 */
export function restoreBarClipConfig(config: BarClipConfig, editorState: any): void {
  // Chart type
  editorState.activeType = config.activeType;
  editorState.isPieVariant = config.isPieVariant;

  // Data
  editorState.labels = [...config.labels];
  editorState.values = config.values.map((row: number[]) => [...row]);
  editorState.seriesNames = [...config.seriesNames];

  // Pie/Donut styling
  editorState.sliceColors = [...config.sliceColors];
  editorState.sliceGap = config.sliceGap;
  editorState.donutCutout = config.donutCutout;
  editorState.smoothing = config.smoothing;

  // Bar styling
  editorState.barRounding = config.barRounding;
  editorState.barSpacing = config.barSpacing;
  editorState.barAspectRatio = config.barAspectRatio;
  editorState.barOrientation = config.barOrientation;
  editorState.barMode = config.barMode;
  editorState.baseBarColor = config.baseBarColor;
  editorState.barBarColors = { ...config.barBarColors };

  // Line styling
  editorState.lineTension = config.lineTension;
  editorState.lineWidth = config.lineWidth;
  editorState.lineAspectRatio = config.lineAspectRatio;
  editorState.markerStyle = config.markerStyle;
  editorState.markerSize = config.markerSize;
  editorState.markerVisible = config.markerVisible;
  editorState.lineColors = [...config.lineColors];
  editorState.markerColors = [...config.markerColors];

  // Text & appearance
  editorState.chartTitle = config.chartTitle;
  editorState.chartCaption = config.chartCaption;
  editorState.bgColor = config.bgColor;
  editorState.legendVisible = config.legendVisible;
  editorState.legendPosition = config.legendPosition;
  editorState.legendSize = config.legendSize;
  editorState.legendColor = config.legendColor;
  editorState.axisVisible = config.axisVisible;
  editorState.axisSize = config.axisSize;
  editorState.axisBold = config.axisBold;
  editorState.axisColor = config.axisColor;

  // Title styling
  editorState.titleFont = config.titleFont;
  editorState.titleSize = config.titleSize;
  editorState.titleBold = config.titleBold;
  editorState.titleItalic = config.titleItalic;
  editorState.titleAlign = config.titleAlign;
  editorState.titleColor = config.titleColor;

  // Caption styling
  editorState.captionFont = config.captionFont;
  editorState.captionSize = config.captionSize;
  editorState.captionAlign = config.captionAlign;
  editorState.captionColor = config.captionColor;

  console.log('[BarChartSetup] Config restored into editor state.');
}

/**
 * Testing helper: create and test a bar chart render in all three variants.
 * Logs results for manual inspection. Not used in production.
 */
export async function testBarChartRender(
  config: BarClipConfig,
  canvasWidth: number = 1080,
  canvasHeight: number = 600
): Promise<void> {
  try {
    console.log('[BarChartSetup] Starting test render...');
    const result = await createHiddenDataRender(config, canvasWidth, canvasHeight);

    console.log(`[BarChartSetup] ✓ Normal chart created. chartArea: ${JSON.stringify(result.chartAreaBounds)}`);

    // Capture both renders to inspect visually
    const normalImage = result.normalChart.toBase64Image();
    const hiddenImage = result.hiddenCanvas.toDataURL('image/png');

    console.log('[BarChartSetup] ✓ Both renders captured.');
    console.log('[BarChartSetup] Normal render (base64):', normalImage.substring(0, 50) + '...');
    console.log('[BarChartSetup] Hidden render:', hiddenImage.substring(0, 50) + '...');

    // Clean up (hiddenChart was already destroyed above, create a dummy for disposal)
    const hiddenCtx = result.hiddenCanvas.getContext('2d')!;
    const hiddenChart = new Chart(hiddenCtx, { type: 'bar', data: { labels: [], datasets: [] } });
    disposeBarCharts(result.normalChart, hiddenChart);
    console.log('[BarChartSetup] ✓ Test complete.');
  } catch (err) {
    console.error('[BarChartSetup] Test failed:', err);
    throw err;
  }
}
