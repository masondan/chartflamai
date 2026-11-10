/**
 * Pictogram animation renderer (Phase 2).
 *
 * Mechanism: reuses the waffle two-layer compositing pattern (not Chart.js —
 * pictogram is custom canvas drawing of SVG icons). Base layer bakes the
 * title/caption/background plus all 10 icon slots at "ghost" (unfilled,
 * faded) opacity, exactly matching the layout math in
 * `PictogramEditor.svelte`'s `calculatePictogramLayout()`. The animated layer
 * reveals icons top-down/row-major (same order as the static fill), using
 * `staggered()` so it reads as a wave. The final (fractional) icon animates
 * its own clip-rect fill fraction growing from 0 to `partialAmount` during
 * its stagger window, instead of popping in binary.
 *
 * Final frame at t=totalMs matches `downloadPictogram()`'s PNG export
 * pixel-for-pixel (same guarantee as waffle/bar).
 */

import { clamp01, easeOutBack, progressAt, staggered } from '../timeline';
import {
  type FontSpec,
  computeVideoSize,
  drawTextBlock,
  loadFonts,
  measureTextBlock,
  wrapText
} from '../layout';

export interface PictogramClipConfig {
  iconSvg: string; // currentIconSvg (sanitized, currentColor placeholders intact)
  filled: number; // pictogramFilled (fractional, e.g. 6.7)
  filledColor: string;
  unfilledColor: string;
  horizontalSpacing: number;
  verticalSpacing: number;
  bgColor: 'white' | 'transparent' | string;

  chartTitle: string;
  titleFont: string;
  titleSize: number;
  titleBold: boolean;
  titleItalic: boolean;
  titleAlign: 'left' | 'center' | 'right';
  titleColor: string;
  titleLineHeight: number;

  chartCaption: string;
  captionFont: string;
  captionSize: number;
  captionAlign: 'left' | 'center' | 'right';
  captionColor: string;
  captionLineHeight: number;
}

export interface PreparedClip {
  width: number;
  height: number;
  drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number): void;
  dispose(): void;
}

const EXPORT_WIDTH = 1080;
const ICONS_PER_ROW = 5;
const TOTAL_ICONS = 10;
const ROWS = 2;

/**
 * Identical math to `PictogramEditor.svelte`'s `calculatePictogramLayout()` —
 * single source of truth duplicated here (per brief: copy, don't import
 * component-local functions) so the animation canvas lays out icons exactly
 * like the live preview / PNG export at any target width.
 */
function calculatePictogramLayout(targetWidth: number, svgString: string, hSpace: number, vSpace: number) {
  const scale = targetWidth / 1080;
  const padding = 40 * scale;
  const hSpacing = (hSpace - 50) * scale;
  const vSpacing = (vSpace - 50) * scale;
  const availableWidth = targetWidth - padding * 2;
  const iconWidth = (availableWidth - hSpacing * (ICONS_PER_ROW - 1)) / ICONS_PER_ROW;
  const aspect = getIconAspectRatio(svgString);
  const iconHeight = iconWidth * aspect;
  const canvasHeight = ROWS * iconHeight + (ROWS - 1) * vSpacing + padding * 2;
  return {
    iconsPerRow: ICONS_PER_ROW,
    totalIcons: TOTAL_ICONS,
    rows: ROWS,
    padding,
    hSpacing,
    vSpacing,
    iconWidth,
    iconHeight,
    canvasHeight
  };
}

function getIconAspectRatio(svgString: string): number {
  if (!svgString) return 1;
  const match = svgString.match(/viewBox=["']([^"']+)["']/);
  if (!match) return 1;
  const parts = match[1].split(/\s+/).map(Number);
  if (parts.length < 4 || parts[2] === 0) return 1;
  return parts[3] / parts[2]; // height / width
}

// ─── SVG → <img> decode (animation-safe copy of PictogramEditor's helper) ───
// Duplicated rather than imported since the live version is tied to a
// component-local cache Map that's fine to reuse here too (module-scoped).
const imageCache = new Map<string, HTMLImageElement>();

function decodeSvgImage(svgString: string, color: string): Promise<HTMLImageElement> {
  const key = `${svgString}::${color}`;
  const cached = imageCache.get(key);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const coloredSvg = svgString.replace(/currentColor/g, color);
    const img = new Image();
    const blob = new Blob([coloredSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      imageCache.set(key, img);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('[PictogramClip] Failed to decode icon SVG'));
    };
    img.src = url;
  });
}

export async function preparePictogramClip(config: PictogramClipConfig, scale = 1): Promise<PreparedClip> {
  const layout = calculatePictogramLayout(EXPORT_WIDTH, config.iconSvg, config.horizontalSpacing, config.verticalSpacing);

  // Pre-decode both icon images (filled + unfilled color variants)
  const [filledImg, unfilledImg] = await Promise.all([
    decodeSvgImage(config.iconSvg, config.filledColor),
    decodeSvgImage(config.iconSvg, config.unfilledColor)
  ]);

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
  const textMaxWidth = EXPORT_WIDTH - layout.padding * 2;

  // Match downloadPictogram()'s exact block-height formulas (60 + lines*lineSpacing + 20
  // for title; 20 + lines*lineSpacing + 20 for caption), expressed via the
  // shared measureTextBlock extraPadding param.
  const titleLineSpacing = titleFontSpec.size * config.titleLineHeight;
  let titleLines: string[] = [];
  let titleBlockHeight = 0;
  if (config.chartTitle) {
    measureCtx.font = `${config.titleBold ? 'bold' : 'normal'} ${config.titleItalic ? 'italic' : 'normal'} ${titleFontSpec.size}px ${config.titleFont}, sans-serif`;
    titleLines = wrapText(measureCtx, config.chartTitle, textMaxWidth);
    titleBlockHeight = 60 + titleLines.length * titleLineSpacing + 20;
  }

  const captionLineSpacing = captionFontSpec.size * config.captionLineHeight;
  let captionLines: string[] = [];
  let captionBlockHeight = 0;
  if (config.chartCaption) {
    // Caption is always normal weight/style in PictogramClipConfig (matches
    // waffle.ts's captionFontSpec which hardcodes bold:false/italic:false —
    // bold/italic only affect the live-DOM preview styling, not canvas renders).
    measureCtx.font = `normal normal ${captionFontSpec.size}px ${config.captionFont}, sans-serif`;
    captionLines = wrapText(measureCtx, config.chartCaption, textMaxWidth);
    captionBlockHeight = 20 + captionLines.length * captionLineSpacing + 20;
  }

  const rawHeight = layout.canvasHeight + titleBlockHeight + captionBlockHeight;
  const { width, height } = computeVideoSize(EXPORT_WIDTH * scale, rawHeight * scale);

  // ─── Static base layer: background + title + caption + ghost grid ───
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = EXPORT_WIDTH;
  baseCanvas.height = rawHeight;
  const baseCtx = baseCanvas.getContext('2d')!;

  if (config.bgColor !== 'transparent') {
    baseCtx.fillStyle = config.bgColor === 'white' ? '#FFFFFF' : config.bgColor;
    baseCtx.fillRect(0, 0, EXPORT_WIDTH, rawHeight);
  }

  let gridY = 0;
  if (config.chartTitle) {
    baseCtx.fillStyle = config.titleColor;
    baseCtx.font = `${config.titleBold ? 'bold' : 'normal'} ${config.titleItalic ? 'italic' : 'normal'} ${titleFontSpec.size}px ${config.titleFont}, sans-serif`;
    baseCtx.textAlign = config.titleAlign;
    const titleX =
      config.titleAlign === 'left' ? layout.padding : config.titleAlign === 'right' ? EXPORT_WIDTH - layout.padding : EXPORT_WIDTH / 2;
    titleLines.forEach((line, idx) => {
      baseCtx.fillText(line, titleX, 60 + idx * titleLineSpacing);
    });
    gridY = titleBlockHeight;
  }

  // Compute icon slot positions (row-major, same order as static render)
  const iconPositions: { x: number; y: number }[] = [];
  for (let i = 0; i < layout.totalIcons; i++) {
    const row = Math.floor(i / layout.iconsPerRow);
    const col = i % layout.iconsPerRow;
    const x = layout.padding + col * (layout.iconWidth + layout.hSpacing);
    const y = gridY + layout.padding + row * (layout.iconHeight + layout.vSpacing);
    iconPositions.push({ x, y });
  }

  const filled = config.filled;
  const fullIcons = Math.floor(filled);
  const partialAmount = filled % 1;

  // Draw all 10 icons at "ghost" (unfilled, faded) state onto base layer.
  const GHOST_ALPHA = 0.25;
  baseCtx.save();
  baseCtx.globalAlpha = GHOST_ALPHA;
  for (const pos of iconPositions) {
    baseCtx.drawImage(unfilledImg, pos.x, pos.y, layout.iconWidth, layout.iconHeight);
  }
  baseCtx.restore();

  if (config.chartCaption) {
    baseCtx.fillStyle = config.captionColor;
    baseCtx.font = `normal normal ${captionFontSpec.size}px ${config.captionFont}, sans-serif`;
    baseCtx.textAlign = config.captionAlign;
    const captionX =
      config.captionAlign === 'left' ? layout.padding : config.captionAlign === 'right' ? EXPORT_WIDTH - layout.padding : EXPORT_WIDTH / 2;
    const captionStartY = gridY + layout.canvasHeight + 20;
    captionLines.forEach((line, idx) => {
      baseCtx.fillText(line, captionX, captionStartY + idx * captionLineSpacing);
    });
  }

  const n = iconPositions.length;

  function drawFrame(ctx: CanvasRenderingContext2D, tMs: number, animMs: number) {
    // Base layer: background + title + caption + ghost grid, always visible.
    ctx.drawImage(baseCanvas, 0, 0, EXPORT_WIDTH, rawHeight, 0, 0, width, height);

    ctx.save();
    ctx.scale(width / EXPORT_WIDTH, height / rawHeight);

    const p = progressAt(tMs, animMs);

    for (let i = 0; i < n; i++) {
      const pos = iconPositions[i];
      const localP = staggered(p, i, n, 0.12);
      if (localP <= 0) continue; // not yet reached — ghost only (already baked in base layer)

      if (i < fullIcons) {
        // Fully-filled icon slot: pop in (scale 0.5→1, alpha 0→1, slight overshoot)
        const eased = clamp01(localP) >= 1 ? 1 : easeOutBack(clamp01(localP));
        const alpha = clamp01(localP * 1.5); // alpha reaches 1 slightly before the pop settles
        const cx = pos.x + layout.iconWidth / 2;
        const cy = pos.y + layout.iconHeight / 2;
        const s = 0.5 + 0.5 * eased;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.translate(-cx, -cy);
        ctx.drawImage(filledImg, pos.x, pos.y, layout.iconWidth, layout.iconHeight);
        ctx.restore();
      } else if (i === fullIcons && partialAmount > 0) {
        // Fractional icon: animate the clip-rect fill fraction growing from
        // 0 to partialAmount over this slot's stagger window (not a binary pop).
        const currentFraction = partialAmount * clamp01(localP);

        if (currentFraction > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(pos.x, pos.y, layout.iconWidth * currentFraction, layout.iconHeight);
          ctx.clip();
          ctx.drawImage(filledImg, pos.x, pos.y, layout.iconWidth, layout.iconHeight);
          ctx.restore();
        }

        if (currentFraction < 1) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(pos.x + layout.iconWidth * currentFraction, pos.y, layout.iconWidth * (1 - currentFraction), layout.iconHeight);
          ctx.clip();
          ctx.drawImage(unfilledImg, pos.x, pos.y, layout.iconWidth, layout.iconHeight);
          ctx.restore();
        }
      }
      // i > fullIcons (and not the partial slot): stays ghost — already in base layer, nothing more to draw.
    }

    ctx.restore();
  }

  function dispose() {
    // Nothing persistent to free — base canvas + decoded images are GC'd
    // with this closure (imageCache is module-scoped and intentionally
    // reused across clips for performance, same pattern as the live editor).
  }

  return { width, height, drawFrame, dispose };
}
