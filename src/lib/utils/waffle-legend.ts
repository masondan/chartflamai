/**
 * Shared waffle legend measurement + drawing.
 *
 * Single source of truth for laying out the waffle legend onto a canvas
 * (flex-row, wrap, centered — mirrors the HTML `.waffle-legend-row` preview
 * exactly). Used by `WaffleChartEditor.downloadWaffle` (PNG export) and,
 * later, the animation renderer's base-frame builder — both call the same
 * measure/draw pair so the legend is pixel-identical in both outputs.
 */

export interface WaffleLegendItem {
  label: string;
  color: string;
}

export interface WaffleLegendRow {
  items: WaffleLegendItem[];
  itemWidths: number[];
  rowWidth: number;
}

export interface WaffleLegendMetrics {
  rows: WaffleLegendRow[];
  fontSize: number;
  swatchSize: number;
  itemGap: number; // horizontal gap between items in a row
  itemInnerGap: number; // gap between swatch and label within an item
  rowGap: number; // vertical gap between wrapped rows
  rowHeight: number;
  /** Total height of all rows + inter-row gaps (no outer padding). */
  totalHeight: number;
}

/**
 * Measure legend rows, wrapping items (like CSS flex-wrap) to fit within
 * `maxWidth`, centered. Font/spacing are scaled 2x from the preview's rem
 * values, matching the title/caption export scaling convention already
 * used in `downloadWaffle`.
 */
export function measureWaffleLegend(
  ctx: CanvasRenderingContext2D,
  data: WaffleLegendItem[],
  legendSize: number,
  maxWidth: number
): WaffleLegendMetrics {
  const fontSize = Math.round(legendSize * 2);
  const swatchSize = fontSize;
  const itemInnerGap = 16; // 0.5rem * 2
  const itemGap = 48; // 1.5rem * 2
  const rowGap = 16;
  const rowHeight = Math.max(fontSize, swatchSize);

  ctx.font = `500 ${fontSize}px Inter, sans-serif`;

  const rows: WaffleLegendRow[] = [];
  let currentItems: WaffleLegendItem[] = [];
  let currentWidths: number[] = [];
  let currentWidth = 0;

  for (const item of data) {
    const textWidth = ctx.measureText(item.label).width;
    const itemWidth = swatchSize + itemInnerGap + textWidth;
    const addedWidth = currentItems.length > 0 ? itemGap + itemWidth : itemWidth;

    if (currentItems.length > 0 && currentWidth + addedWidth > maxWidth) {
      rows.push({ items: currentItems, itemWidths: currentWidths, rowWidth: currentWidth });
      currentItems = [item];
      currentWidths = [itemWidth];
      currentWidth = itemWidth;
    } else {
      currentItems.push(item);
      currentWidths.push(itemWidth);
      currentWidth += addedWidth;
    }
  }
  if (currentItems.length > 0) {
    rows.push({ items: currentItems, itemWidths: currentWidths, rowWidth: currentWidth });
  }

  const totalHeight = rows.length > 0 ? rows.length * rowHeight + (rows.length - 1) * rowGap : 0;

  return { rows, fontSize, swatchSize, itemGap, itemInnerGap, rowGap, rowHeight, totalHeight };
}

/** Draw a previously-measured legend, centered row by row, starting at `startY`. */
export function drawWaffleLegend(
  ctx: CanvasRenderingContext2D,
  metrics: WaffleLegendMetrics,
  legendColor: string,
  canvasWidth: number,
  startY: number
): void {
  if (metrics.rows.length === 0) return;

  ctx.font = `500 ${metrics.fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let y = startY + metrics.rowHeight / 2;

  for (const row of metrics.rows) {
    let x = (canvasWidth - row.rowWidth) / 2;

    row.items.forEach((item, idx) => {
      const itemWidth = row.itemWidths[idx];
      const swatchY = y - metrics.swatchSize / 2;
      const r = Math.min(4, metrics.swatchSize / 2);

      ctx.fillStyle = item.color;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, swatchY, metrics.swatchSize, metrics.swatchSize, r);
      } else {
        ctx.rect(x, swatchY, metrics.swatchSize, metrics.swatchSize);
      }
      ctx.fill();

      ctx.fillStyle = legendColor;
      ctx.fillText(item.label, x + metrics.swatchSize + metrics.itemInnerGap, y);

      x += itemWidth + metrics.itemGap;
    });

    y += metrics.rowHeight + metrics.rowGap;
  }

  // Reset to defaults other draw calls expect.
  ctx.textBaseline = 'alphabetic';
}
