/**
 * Waffle animation renderer (Phase 1).
 *
 * Mechanism: sequenced cells (brief §3). All cell positions are shown as
 * faint ghosts from frame 0 (`rgba(128,128,128,0.15)`). Real cells pop in
 * one by one in reading order (top-down, left→right — the existing static
 * fill order), with overlapping windows so it reads as a wave. Pop = scale
 * 0.5→1 plus alpha 0→1.
 *
 * Per the owner's explicit decision, the static waffle layout is NOT
 * changed: cell positions and fill order are identical to the current PNG
 * export. Only the *reveal timing* is animated — the end state at t=totalMs
 * matches `WaffleChartEditor.downloadWaffle` pixel-for-pixel.
 *
 * `calculateWaffleLayout` is the single source of truth for cell size/gap/
 * padding, shared by the live static canvas (`WaffleChartEditor.renderWaffle`),
 * the PNG export (`WaffleChartEditor.downloadWaffle`), the full baked clip
 * used for MP4 export (`prepareWaffleClip`), and the grid-only Play-preview
 * clip (`prepareWaffleGridOnlyClip`) — this is what keeps cell/gap
 * proportions identical across the static canvas, Play, and both downloads.
 */

import { clamp01, easeOutBack, progressAt, staggered } from '../timeline';
import {
  type FontSpec,
  computeVideoSize,
  drawTextBlock,
  loadFonts,
  measureTextBlock
} from '../layout';
import { measureWaffleLegend, drawWaffleLegend, type WaffleLegendItem } from '$lib/utils/waffle-legend';

export interface WaffleCellDatum {
  color: string;
}

export interface WaffleClipConfig {
  cells: WaffleCellDatum[]; // flattened cell list in fill order (one entry per unit value)
  gridCols: number;
  cellGap: number;
  cellShape: 'square' | 'square-outline' | 'circle' | 'circle-outline';
  cellRounding: number;
  bgColor: 'white' | 'transparent' | string;

  chartTitle: string;
  titleFont: string;
  titleAlign: 'left' | 'center' | 'right';
  titleBold: boolean;
  titleItalic: boolean;
  titleSize: number;
  titleLineHeight: number;
  titleColor: string;

  chartCaption: string;
  captionFont: string;
  captionAlign: 'left' | 'center' | 'right';
  captionSize: number;
  captionLineHeight: number;
  captionColor: string;

  legendItems: WaffleLegendItem[];
  legendVisible: boolean;
  legendPosition: 'top' | 'bottom';
  legendSize: number;
  legendColor: string;
}

export interface PreparedClip {
  width: number;
  height: number;
  drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number): void;
  dispose(): void;
}

const EXPORT_WIDTH = 1080;
const PADDING = 40;
const GHOST_COLOR = 'rgba(128,128,128,0.15)';

/**
 * Single source of truth for waffle cell/gap/padding sizing, scaled
 * proportionally to whatever width it's given. Used identically by the live
 * static canvas, the PNG export, the full baked MP4 clip, and the grid-only
 * Play-preview clip — this is what keeps cell/gap proportions consistent
 * across all four render paths.
 */
export function calculateWaffleLayout(
  targetWidth: number,
  totalUnits: number,
  gridCols: number,
  cellGap: number
) {
  const scale = targetWidth / EXPORT_WIDTH;
  const padding = PADDING * scale;
  const gap = cellGap * scale;
  const rows = Math.ceil(totalUnits / gridCols) || 1;
  const availableWidth = targetWidth - padding * 2;
  const cellSize = (availableWidth - gap * (gridCols - 1)) / gridCols;
  const gridHeight = rows * cellSize + gap * (rows - 1);
  return { rows, padding, gap, cellSize, gridHeight };
}

function drawCellShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  shape: WaffleClipConfig['cellShape'],
  rounding: number
) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'circle-outline':
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - 2.5, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'square':
    default: {
      const r = Math.min(rounding, size / 2 - 1);
      ctx.beginPath();
      if (r > 0) {
        ctx.roundRect(x + 1, y + 1, size - 2, size - 2, r);
      } else {
        ctx.rect(x + 1, y + 1, size - 2, size - 2);
      }
      ctx.fill();
      break;
    }

    case 'square-outline': {
      const r = Math.min(rounding, size / 2 - 1);
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      if (r > 0) {
        ctx.roundRect(x + 2, y + 2, size - 4, size - 4, r);
      } else {
        ctx.rect(x + 2, y + 2, size - 4, size - 4);
      }
      ctx.stroke();
      break;
    }
  }
}

/** Draw a faint ghost in the same shape/position as the real cell. */
function drawGhostCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: WaffleClipConfig['cellShape'],
  rounding: number
) {
  drawCellShape(ctx, x, y, size, GHOST_COLOR, shape, rounding);
}

export async function prepareWaffleClip(config: WaffleClipConfig, scale = 1): Promise<PreparedClip> {
  const { rows, padding, gap, cellSize, gridHeight: baseGridHeight } = calculateWaffleLayout(
    EXPORT_WIDTH,
    config.cells.length,
    config.gridCols,
    config.cellGap
  );
  // +20: breathing room before the 40px bottom gap/caption, matches the
  // pre-existing downloadWaffle()/this-module behaviour.
  const gridHeight = baseGridHeight + 20;

  const titleFontSpec: FontSpec = {
    family: config.titleFont,
    size: Math.round(config.titleSize * 2),
    bold: config.titleBold,
    italic: config.titleItalic
  };
  const captionFontSpec: FontSpec = {
    family: config.captionFont,
    size: Math.round(config.captionSize * 2),
    bold: false,
    italic: false
  };

  await loadFonts([titleFontSpec, captionFontSpec]);

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  const textMaxWidth = EXPORT_WIDTH - PADDING * 2;

  const titleBlock = measureTextBlock(
    measureCtx,
    config.chartTitle,
    titleFontSpec,
    1.3,
    textMaxWidth,
    config.chartTitle ? 30 : 0
  );
  const captionBlock = measureTextBlock(
    measureCtx,
    config.chartCaption,
    captionFontSpec,
    1.3,
    textMaxWidth,
    config.chartCaption ? 40 : 0
  );

  // Legend: measured/drawn via the shared helper so it's pixel-identical to
  // downloadWaffle()'s PNG export (brief §"Shared legend helper").
  const legendGap = 30;
  const legendMetrics =
    config.legendVisible && config.legendItems.length > 0
      ? measureWaffleLegend(measureCtx, config.legendItems, config.legendSize, textMaxWidth)
      : null;
  const legendBlockHeight = legendMetrics ? legendGap + legendMetrics.totalHeight : 0;

  let rawHeight = 40; // top padding, matches downloadWaffle
  rawHeight += titleBlock.height;
  if (legendMetrics && config.legendPosition === 'top') rawHeight += legendBlockHeight;
  rawHeight += gridHeight + 40;
  if (legendMetrics && config.legendPosition === 'bottom') rawHeight += legendBlockHeight;
  rawHeight += captionBlock.height;

  const { width, height } = computeVideoSize(EXPORT_WIDTH * scale, rawHeight * scale);

  // ─── Static base layer (background + title + caption) in export-space ───
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = EXPORT_WIDTH;
  baseCanvas.height = rawHeight;
  const baseCtx = baseCanvas.getContext('2d')!;

  if (config.bgColor !== 'transparent') {
    baseCtx.fillStyle = config.bgColor === 'white' ? '#FFFFFF' : config.bgColor;
    baseCtx.fillRect(0, 0, EXPORT_WIDTH, rawHeight);
  }

  let yOffset = 40;
  if (config.chartTitle) {
    drawTextBlock(baseCtx, titleBlock, titleFontSpec, config.titleColor, config.titleAlign, EXPORT_WIDTH, PADDING, yOffset + 50);
    yOffset += titleBlock.height;
  }

  if (legendMetrics && config.legendPosition === 'top') {
    drawWaffleLegend(baseCtx, legendMetrics, config.legendColor, EXPORT_WIDTH, yOffset);
    yOffset += legendBlockHeight;
  }

  const gridTop = yOffset;
  yOffset += gridHeight + 40;

  if (legendMetrics && config.legendPosition === 'bottom') {
    drawWaffleLegend(baseCtx, legendMetrics, config.legendColor, EXPORT_WIDTH, yOffset);
    yOffset += legendBlockHeight;
  }

  if (config.chartCaption) {
    drawTextBlock(baseCtx, captionBlock, captionFontSpec, config.captionColor, config.captionAlign, EXPORT_WIDTH, PADDING, yOffset + 40);
  }

  const cellPositions: { x: number; y: number; color: string }[] = [];
  let cellIdx = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < config.gridCols; col++) {
      if (cellIdx < config.cells.length) {
        const x = padding + col * (cellSize + gap);
        const y = gridTop + row * (cellSize + gap);
        cellPositions.push({ x, y, color: config.cells[cellIdx].color });
        cellIdx++;
      }
    }
  }
  const n = cellPositions.length;

  function drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number) {
    // Draw full base canvas (desaturated background + title + caption + ghost grid)
    ctx.drawImage(baseCanvas, 0, 0, EXPORT_WIDTH, rawHeight, 0, 0, width, height);

    ctx.save();
    ctx.scale(width / EXPORT_WIDTH, height / rawHeight);

    const p = progressAt(tMs, animMs);

    // Feathered wipe: top→bottom with soft edge.
    // Wipe occupies the grid region only; title/caption/legend stay visible
    // throughout (they're baked into baseCanvas, drawn above).
    const wipeTop = gridTop;
    const wipeBottom = gridTop + gridHeight;
    const wipeHeight = wipeBottom - wipeTop;

    // wipePosition sweeps top→bottom as p goes 0→1. Cells whose center is
    // above this line (smaller y) have already been "passed" by the wipe
    // and should be fully revealed; cells below are still ghosts.
    const wipePosition = wipeTop + wipeHeight * p;
    const featherWidth = 60; // soft edge width in export pixels

    for (let i = 0; i < n; i++) {
      const cell = cellPositions[i];
      const cellCenterY = cell.y + cellSize / 2;

      // distance > 0 means the wipe has moved past this cell (reveal it);
      // distance < 0 means the wipe hasn't reached it yet (stays ghost).
      const distance = wipePosition - cellCenterY;

      if (distance <= -featherWidth / 2) continue; // not yet reached — ghost only

      const fadeAlpha = clamp01(distance / featherWidth + 0.5);

      if (fadeAlpha >= 1) {
        drawCellShape(ctx, cell.x, cell.y, cellSize, cell.color, config.cellShape, config.cellRounding);
      } else {
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        drawCellShape(ctx, cell.x, cell.y, cellSize, cell.color, config.cellShape, config.cellRounding);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function dispose() {
    // Nothing persistent to free — base canvas is GC'd with this closure.
  }

  return { width, height, drawFrame, dispose };
}
