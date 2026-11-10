/**
 * Shared layout helpers for chart animation renderers.
 *
 * Each chart type (waffle, pictogram, and later bar/line/pie) has its own
 * bespoke size/positioning maths — copied from the existing `downloadX`
 * functions rather than editing them (see brief §4). This module holds only
 * the handful of truly shared pieces: text wrapping/measuring/drawing, font
 * loading, and the D3 video-size rounding rule.
 */

export interface FontSpec {
  family: string;
  size: number;
  bold?: boolean;
  italic?: boolean;
}

/** Build a canvas `ctx.font` string from a FontSpec. */
export function fontString(spec: FontSpec): string {
  const weight = spec.bold ? 'bold' : 'normal';
  const style = spec.italic ? 'italic' : 'normal';
  return `${style} ${weight} ${spec.size}px ${spec.family}, sans-serif`;
}

/**
 * Word-wrap text to fit within `maxWidth`, honouring explicit newlines.
 * Identical logic to the `wrapText` duplicated across the three editors
 * (see brief §9 adjacent issues) — centralised here for the animation path.
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

/** Resolved text-block metrics: wrapped lines + total block height. */
export interface TextBlock {
  lines: string[];
  lineHeight: number;
  height: number;
}

/**
 * Wrap + measure a block of text. `extraPadding` is added to the computed
 * height (used by callers to match the exact spacing the PNG export uses
 * around titles/captions).
 */
export function measureTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: FontSpec,
  lineHeightMultiplier: number,
  maxWidth: number,
  extraPadding = 0
): TextBlock {
  if (!text) return { lines: [], lineHeight: 0, height: 0 };
  ctx.font = fontString(font);
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = font.size * lineHeightMultiplier;
  return { lines, lineHeight, height: lines.length * lineHeight + extraPadding };
}

/** Draw a pre-wrapped text block, left/center/right aligned, top-down from `startY`. */
export function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  block: TextBlock,
  font: FontSpec,
  color: string,
  align: 'left' | 'center' | 'right',
  canvasWidth: number,
  padding: number,
  startY: number
): void {
  if (block.lines.length === 0) return;
  ctx.fillStyle = color;
  ctx.font = fontString(font);
  ctx.textAlign = align;
  const x = align === 'left' ? padding : align === 'right' ? canvasWidth - padding : canvasWidth / 2;
  block.lines.forEach((line, idx) => {
    ctx.fillText(line, x, startY + idx * block.lineHeight);
  });
}

/**
 * D3: round a video dimension up to the nearest even integer
 * (H.264 requires even width/height).
 */
export function roundUpEven(n: number): number {
  const rounded = Math.ceil(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/**
 * D3: compute the final even-integer video size from a raw (PNG-export-sized)
 * width/height, scaling down proportionally if the longest edge exceeds
 * `maxLongEdge`, then re-rounding to even.
 */
export function computeVideoSize(
  rawWidth: number,
  rawHeight: number,
  maxLongEdge = 1920
): { width: number; height: number } {
  let width = rawWidth;
  let height = rawHeight;
  const longest = Math.max(width, height);
  if (longest > maxLongEdge) {
    const scale = maxLongEdge / longest;
    width *= scale;
    height *= scale;
  }
  return { width: roundUpEven(width), height: roundUpEven(height) };
}

/**
 * Ensure every font used by title/caption text is actually loaded before the
 * first frame is measured or drawn (brief §4 Fonts). Cold page loads can
 * otherwise silently fall back to a system font.
 */
export async function loadFonts(specs: FontSpec[]): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  await Promise.all(
    specs.map((spec) => {
      const weight = spec.bold ? 'bold' : 'normal';
      const style = spec.italic ? 'italic' : 'normal';
      const face = `${style} ${weight} ${spec.size}px ${spec.family}`;
      return document.fonts.load(face).catch(() => {
        /* best-effort — fall through to system font rather than fail the clip */
      });
    })
  );
  await document.fonts.ready;
}
