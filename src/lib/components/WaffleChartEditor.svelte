<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { chartArchive } from '$lib/stores/chartArchive.svelte';

  interface Props {
    archiveId?: string;
    onclose: () => void;
  }

  let { archiveId: initArchiveId, onclose }: Props = $props();

  // ─── Waffle state ───
  let waffleData = $state<Array<{ label: string; value: number; color: string }>>([
    { label: 'Category A', value: 40, color: '#6A5ACD' },
    { label: 'Category B', value: 35, color: '#FFDAB9' },
    { label: 'Category C', value: 25, color: '#66C0B4' }
  ]);

  let gridCols = $state(10);
  let cellGap = $state(4);
  let cellShape = $state<'square' | 'circle' | 'diamond' | 'heart'>('square');
  let cellRounding = $state(0);
  let bgColor = $state<'white' | 'transparent' | string>('white');

  // ─── Data tracking (for disable state) ───
  let hasUserData = $state(false);

  // ─── Title / Caption state ───
  let chartTitle = $state('');
  let chartCaption = $state('');
  let titleFont = $state('Inter');
  let titleSize = $state(24);
  let titleLineHeight = $state(1.2);
  let titleBold = $state(true);
  let titleItalic = $state(false);
  let titleColor = $state('#555555');
  let titleSizeControl = $state<'size' | 'lineheight'>('size');
  let captionFont = $state('Inter');
  let captionSize = $state(14);
  let captionLineHeight = $state(1.4);
  let captionBold = $state(false);
  let captionItalic = $state(false);
  let captionColor = $state('#555555');
  let captionSizeControl = $state<'size' | 'lineheight'>('size');
  let titleAlign = $state<'left' | 'center' | 'right'>('center');
  let captionAlign = $state<'left' | 'center' | 'right'>('center');
  let legendVisible = $state(true);
  let legendPosition = $state<'bottom' | 'top'>('bottom');
  let legendSize = $state(12);
  let legendColor = $state('#555555');

  // ─── UI state ───
  let openSection = $state<string>('data');
  let canvasEl: HTMLCanvasElement;
  let csvInput = $state('');
  let currentArchiveId = $state<string | undefined>(initArchiveId);

  const defaultColors = ['#6A5ACD', '#FFDAB9', '#66C0B4', '#E6E6FA'];

  const fontOptions = [
    { value: 'Inter', label: 'Inter (Default)' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Roboto Slab', label: 'Roboto Slab' }
  ];

  const alignIcons: Record<string, string> = {
    left: '/icons/icon-align-left.svg',
    center: '/icons/icon-align-center.svg',
    right: '/icons/icon-align-right.svg'
  };

  function cycleAlign(align: 'left' | 'center' | 'right'): 'left' | 'center' | 'right' {
    return align === 'left' ? 'center' : align === 'center' ? 'right' : 'left';
  }

  function getTitleSliderValue() {
    return titleSizeControl === 'size' ? titleSize : Math.round(titleLineHeight * 10);
  }

  function setTitleSlider(value: number) {
    if (titleSizeControl === 'size') {
      titleSize = value;
    } else {
      titleLineHeight = value / 10;
    }
  }

  function getCaptionSliderValue() {
    return captionSizeControl === 'size' ? captionSize : Math.round(captionLineHeight * 10);
  }

  function setCaptionSlider(value: number) {
    if (captionSizeControl === 'size') {
      captionSize = value;
    } else {
      captionLineHeight = value / 10;
    }
  }

  // ─── CSV parsing ───
  function parseCSV(raw: string) {
    const lines = raw
      .trim()
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const parsed: typeof waffleData = [];

    lines.forEach((line, i) => {
      const parts = line.split(',').map(s => s.trim());
      const label = parts[0];
      const value = parseInt(parts[1]) || 0;
      const color = parts[2] || defaultColors[i % defaultColors.length];

      if (label && value > 0) {
        parsed.push({ label, value, color });
      }
    });

    if (parsed.length > 0 && parsed.length <= 4) {
      waffleData = parsed;
      updateDataCSV();
    }
  }

  function updateDataCSV() {
    csvInput = waffleData
      .map(d => `${d.label},${d.value}`)
      .join('\n');
  }

  function applyCsv() {
    parseCSV(csvInput);
    hasUserData = true;
  }

  function addRow() {
    if (waffleData.length < 4) {
      waffleData = [
        ...waffleData,
        {
          label: `Category ${String.fromCharCode(65 + waffleData.length)}`,
          value: 10,
          color: defaultColors[waffleData.length % defaultColors.length]
        }
      ];
      updateDataCSV();
      hasUserData = true;
    }
  }

  function removeRow(idx: number) {
    waffleData = waffleData.filter((_, i) => i !== idx);
    updateDataCSV();
    hasUserData = true;
  }

  function updateLabel(idx: number, label: string) {
    waffleData[idx].label = label;
    waffleData = [...waffleData];
    hasUserData = true;
  }

  function updateValue(idx: number, value: number) {
    waffleData[idx].value = Math.max(1, value);
    waffleData = [...waffleData];
    hasUserData = true;
  }

  function updateColor(idx: number, color: string) {
    waffleData[idx].color = color;
    waffleData = [...waffleData];
    hasUserData = true;
  }

  // ─── Rendering ───
  function getGridDimensions() {
    const total = waffleData.reduce((sum, d) => sum + d.value, 0) || 100;
    const rows = Math.ceil(total / gridCols);
    return { total, rows };
  }

  function drawCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    shape: string
  ) {
    ctx.fillStyle = color;

    switch (shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y);
        ctx.lineTo(x + size, y + size / 2);
        ctx.lineTo(x + size / 2, y + size);
        ctx.lineTo(x, y + size / 2);
        ctx.closePath();
        ctx.fill();
        break;

      case 'heart':
        drawHeart(ctx, x, y, size);
        break;

      case 'square':
      default: {
        const r = Math.min(cellRounding, size / 2 - 1);
        if (r > 0) {
          ctx.beginPath();
          ctx.roundRect(x + 1, y + 1, size - 2, size - 2, r);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.rect(x + 1, y + 1, size - 2, size - 2);
          ctx.fill();
        }
      }
    }
  }

  function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const s = size * 0.85;
    const ox = x + (size - s) / 2;
    const oy = y + (size - s) / 2 + s * 0.05;
    ctx.beginPath();
    const topY = oy + s * 0.35;
    ctx.moveTo(ox + s / 2, oy + s);
    ctx.bezierCurveTo(ox + s / 2 - s * 0.02, oy + s * 0.72, ox, oy + s * 0.5, ox, topY);
    ctx.bezierCurveTo(ox, oy + s * 0.1, ox + s * 0.2, oy, ox + s * 0.35, oy);
    ctx.bezierCurveTo(ox + s * 0.42, oy, ox + s / 2, oy + s * 0.08, ox + s / 2, oy + s * 0.2);
    ctx.bezierCurveTo(ox + s / 2, oy + s * 0.08, ox + s * 0.58, oy, ox + s * 0.65, oy);
    ctx.bezierCurveTo(ox + s * 0.8, oy, ox + s, oy + s * 0.1, ox + s, topY);
    ctx.bezierCurveTo(ox + s, oy + s * 0.5, ox + s / 2 + s * 0.02, oy + s * 0.72, ox + s / 2, oy + s);
    ctx.closePath();
    ctx.fill();
  }

  async function renderWaffle() {
    if (!canvasEl || !browser) return;

    const container = canvasEl.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const { total, rows } = getGridDimensions();

    const cellSize = (width - cellGap * (gridCols - 1)) / gridCols;
    const gridWidth = gridCols * cellSize + (gridCols - 1) * cellGap;
    const gridHeight = rows * cellSize + (rows - 1) * cellGap;
    const offsetX = (width - gridWidth) / 2;
    const offsetY = (width - gridWidth) / 2;
    const canvasHeight = gridHeight + offsetY * 2;

    canvasEl.width = width;
    canvasEl.height = canvasHeight;

    const ctx = canvasEl.getContext('2d')!;

    if (bgColor === 'white') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, canvasHeight);
    }

    // Build cell color map
    const cellColors: string[] = [];
    waffleData.forEach(d => {
      for (let i = 0; i < d.value; i++) {
        cellColors.push(d.color);
      }
    });

    // Draw grid centered
    let cellIdx = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < gridCols; col++) {
        if (cellIdx < cellColors.length) {
          const x = offsetX + col * (cellSize + cellGap);
          const y = offsetY + row * (cellSize + cellGap);
          drawCell(ctx, x, y, cellSize, cellColors[cellIdx], cellShape);
          cellIdx++;
        }
      }
    }
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

  async function downloadWaffle() {
    const exportWidth = 1080;
    const { total, rows } = getGridDimensions();
    const cellSize = (exportWidth - cellGap * (gridCols - 1)) / gridCols - 2;
    const gridHeight = rows * cellSize + cellGap * (rows - 1) + 20;

    // Pre-measure title and caption for word wrapping
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d')!;
    const textMaxWidth = exportWidth - 80;

    const exportTitleFontSize = Math.round(titleSize * 2);
    const titleLineSpacing = exportTitleFontSize * 1.3;
    let titleLines: string[] = [];
    let titleBlockHeight = 0;
    if (chartTitle) {
      measureCtx.font = `${titleBold ? 'bold' : 'normal'} ${exportTitleFontSize}px ${titleFont}, sans-serif`;
      titleLines = wrapText(measureCtx, chartTitle, textMaxWidth);
      titleBlockHeight = (titleLines.length * titleLineSpacing) + 30;
    }

    const exportCaptionFontSize = Math.round(captionSize * 2);
    const captionLineSpacing = exportCaptionFontSize * 1.3;
    let captionLines: string[] = [];
    let captionBlockHeight = 0;
    if (chartCaption) {
      measureCtx.font = `${exportCaptionFontSize}px ${captionFont}, sans-serif`;
      captionLines = wrapText(measureCtx, chartCaption, textMaxWidth);
      captionBlockHeight = 40 + (captionLines.length * captionLineSpacing);
    }

    let totalHeight = 40;
    totalHeight += titleBlockHeight;
    totalHeight += gridHeight + 40;
    totalHeight += captionBlockHeight;

    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d')!;
    exportCanvas.width = exportWidth;
    exportCanvas.height = totalHeight;

    if (bgColor === 'white') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, exportWidth, totalHeight);
    }

    let yOffset = 40;

    if (chartTitle) {
      ctx.fillStyle = titleColor;
      ctx.font = `${titleBold ? 'bold' : 'normal'} ${exportTitleFontSize}px ${titleFont}, sans-serif`;
      ctx.textAlign = titleAlign;
      const titleX = titleAlign === 'left' ? 40 : titleAlign === 'right' ? exportWidth - 40 : exportWidth / 2;
      titleLines.forEach((line, idx) => {
        ctx.fillText(line, titleX, yOffset + 50 + (idx * titleLineSpacing));
      });
      yOffset += titleBlockHeight;
    }

    // Draw grid
    const cellColors: string[] = [];
    waffleData.forEach(d => {
      for (let i = 0; i < d.value; i++) {
        cellColors.push(d.color);
      }
    });

    let cellIdx = 0;
    const padding = 40;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < gridCols; col++) {
        if (cellIdx < cellColors.length) {
          const x = padding + col * (cellSize + cellGap);
          const y = yOffset + row * (cellSize + cellGap);
          drawCell(ctx, x, y, cellSize, cellColors[cellIdx], cellShape);
          cellIdx++;
        }
      }
    }

    yOffset += gridHeight + 40;

    if (chartCaption) {
      ctx.fillStyle = captionColor;
      ctx.font = `${exportCaptionFontSize}px ${captionFont}, sans-serif`;
      ctx.textAlign = captionAlign;
      const captionX = captionAlign === 'left' ? 40 : captionAlign === 'right' ? exportWidth - 40 : exportWidth / 2;
      captionLines.forEach((line, idx) => {
        ctx.fillText(line, captionX, yOffset + 40 + (idx * captionLineSpacing));
      });
    }

    const link = document.createElement('a');
    link.href = exportCanvas.toDataURL('image/png');
    link.download = 'waffle-chart.png';
    link.click();
  }

  function captureThumb(): string {
    if (!canvasEl) return '';
    try {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 400;
      thumbCanvas.height = 400;
      const tCtx = thumbCanvas.getContext('2d')!;
      tCtx.fillStyle = bgColor === 'transparent' ? '#FFFFFF' : (bgColor === 'white' ? '#FFFFFF' : bgColor);
      tCtx.fillRect(0, 0, 400, 400);
      const scale = Math.min(360 / canvasEl.width, 360 / canvasEl.height);
      const w = canvasEl.width * scale;
      const h = canvasEl.height * scale;
      tCtx.drawImage(canvasEl, (400 - w) / 2, (400 - h) / 2, w, h);
      return thumbCanvas.toDataURL('image/png', 0.7);
    } catch { return ''; }
  }

  function restoreFromArchive() {
    if (!initArchiveId) return;
    const archived = chartArchive.getById(initArchiveId);
    if (!archived) return;
    const c = archived.config;
    if (c.waffleData) waffleData = JSON.parse(JSON.stringify(c.waffleData));
    if (c.gridCols !== undefined) gridCols = c.gridCols;
    if (c.cellGap !== undefined) cellGap = c.cellGap;
    if (c.cellShape) cellShape = c.cellShape;
    if (c.cellRounding !== undefined) cellRounding = c.cellRounding;
    if (c.bgColor !== undefined) bgColor = c.bgColor;
    if (c.chartTitle !== undefined) chartTitle = c.chartTitle;
    if (c.titleFont) titleFont = c.titleFont;
    if (c.titleAlign) titleAlign = c.titleAlign;
    if (c.titleBold !== undefined) titleBold = c.titleBold;
    if (c.titleItalic !== undefined) titleItalic = c.titleItalic;
    if (c.titleSize !== undefined) titleSize = c.titleSize;
    if (c.titleLineHeight !== undefined) titleLineHeight = c.titleLineHeight;
    if (c.titleColor) titleColor = c.titleColor;
    if (c.chartCaption !== undefined) chartCaption = c.chartCaption;
    if (c.captionFont) captionFont = c.captionFont;
    if (c.captionAlign) captionAlign = c.captionAlign;
    if (c.captionBold !== undefined) captionBold = c.captionBold;
    if (c.captionItalic !== undefined) captionItalic = c.captionItalic;
    if (c.captionSize !== undefined) captionSize = c.captionSize;
    if (c.captionLineHeight !== undefined) captionLineHeight = c.captionLineHeight;
    if (c.captionColor) captionColor = c.captionColor;
    if (c.legendVisible !== undefined) legendVisible = c.legendVisible;
    if (c.legendPosition) legendPosition = c.legendPosition;
    if (c.legendSize !== undefined) legendSize = c.legendSize;
    if (c.legendColor) legendColor = c.legendColor;
    updateDataCSV();
  }

  onMount(() => {
    restoreFromArchive();
    renderWaffle();
  });

  $effect(() => {
    if (gridCols || cellGap || cellShape || cellRounding || bgColor) {
      renderWaffle();
    }
  });

  $effect(() => {
    if (waffleData) {
      renderWaffle();
    }
  });

  let saveTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const _ = [
      waffleData, gridCols, cellGap, cellShape, cellRounding, bgColor,
      chartTitle, titleFont, titleAlign, titleBold, titleItalic, titleSize, titleLineHeight, titleColor,
      chartCaption, captionFont, captionAlign, captionBold, captionItalic, captionSize, captionLineHeight, captionColor,
      legendVisible, legendPosition, legendSize, legendColor
    ];

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!browser) return;
      const thumb = captureThumb();
      if (!thumb) return;
      const config = {
        waffleData: JSON.parse(JSON.stringify(waffleData)),
        gridCols, cellGap, cellShape, cellRounding, bgColor,
        chartTitle, titleFont, titleAlign, titleBold, titleItalic, titleSize, titleLineHeight, titleColor,
        chartCaption, captionFont, captionAlign, captionBold, captionItalic, captionSize, captionLineHeight, captionColor,
        legendVisible, legendPosition, legendSize, legendColor
      };
      currentArchiveId = chartArchive.save('waffle', config, thumb, currentArchiveId);
    }, 800);

    return () => clearTimeout(saveTimer);
  });
</script>

<div class="waffle-editor">
<div class="editor-panel">
  <!-- Header -->
  <div class="editor-header">
    <button
      class="back-btn"
      onclick={onclose}
      title="Back"
      aria-label="Back"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M12 16l-6-6 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <h1 class="editor-title">Waffle Chart</h1>
    <div class="header-spacer"></div>
  </div>

  <!-- Canvas preview in card -->
  <div class="canvas-card card" style="background-color: {bgColor === 'white' ? '#FFFFFF' : bgColor === 'transparent' ? 'transparent' : bgColor};">
    <!-- Title -->
    {#if chartTitle}
      <h3
        class="preview-title"
        style="
          font-family: '{titleFont}', sans-serif;
          color: {titleColor};
          font-weight: {titleBold ? '700' : '400'};
          font-style: {titleItalic ? 'italic' : 'normal'};
          font-size: {titleSize}px;
          line-height: {titleLineHeight};
          text-align: {titleAlign};
        "
      >{chartTitle}</h3>
    {/if}

    <!-- Legend at top -->
    {#if legendVisible && waffleData.length > 0 && legendPosition === 'top'}
      <div class="waffle-legend-row">
        {#each waffleData as item}
          <div class="legend-item">
            <div class="legend-color" style="background-color: {item.color};"></div>
            <span class="legend-label" style="font-size: {legendSize}px; color: {legendColor};">{item.label}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="canvas-wrapper">
      <canvas bind:this={canvasEl} class="waffle-canvas"></canvas>
    </div>
    
    <!-- Legend at bottom -->
    {#if legendVisible && waffleData.length > 0 && legendPosition === 'bottom'}
      <div class="waffle-legend-row">
        {#each waffleData as item}
          <div class="legend-item">
            <div class="legend-color" style="background-color: {item.color};"></div>
            <span class="legend-label" style="font-size: {legendSize}px; color: {legendColor};">{item.label}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Caption -->
    {#if chartCaption}
      <p
        class="preview-caption"
        style="
          font-family: '{captionFont}', sans-serif;
          color: {captionColor};
          font-weight: {captionBold ? '700' : '400'};
          font-style: {captionItalic ? 'italic' : 'normal'};
          font-size: {captionSize}px;
          line-height: {captionLineHeight};
          text-align: {captionAlign};
        "
      >{chartCaption}</p>
    {/if}
  </div>

  <!-- Controls -->
  <div class="controls">

    <!-- ═══ DATA ═══ -->
    <div class="control-section" class:open={openSection === 'data'}>
      <button class="section-header" onclick={() => openSection = openSection === 'data' ? '' : 'data'}>
        Data
        <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      {#if openSection === 'data'}
        <div class="section-body">
          <!-- CSV -->
          <label class="csv-label">Paste CSV (max 4 categories)</label>
          <textarea
            class="csv-input"
            bind:value={csvInput}
            placeholder={'Category A,40\nCategory B,35\nCategory C,15'}
            rows="4"
          ></textarea>
          <button class="apply-csv-btn secondary" onclick={applyCsv} disabled={!csvInput.trim()}>
            Apply CSV Data
          </button>

          <div class="csv-divider"><span>or enter manually</span></div>

          <!-- Manual rows -->
          <div class="data-rows">
            {#each waffleData as row, i}
              <div class="data-row">
                <input
                  type="text"
                  class="label-input"
                  placeholder={row.label}
                  oninput={(e) => updateLabel(i, (e.target as HTMLInputElement).value || row.label)}
                />
                <input
                  type="number"
                  class="value-input"
                  placeholder={String(row.value)}
                  oninput={(e) => updateValue(i, Number((e.target as HTMLInputElement).value) || row.value)}
                />
                {#if waffleData.length > 1}
                  <button
                    class="row-delete"
                    onclick={() => removeRow(i)}
                    title="Remove"
                    aria-label="Remove row"
                  >
                    <img src="/icons/icon-trash.svg" alt="" width="14" height="14" />
                  </button>
                {/if}
              </div>
            {/each}
          </div>

          {#if waffleData.length < 4}
            <button class="add-row-btn" onclick={addRow} title="Add category" aria-label="Add category">
              <img src="/icons/icon-add.svg" alt="" width="18" height="18" />
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- ═══ COLOURS ═══ -->
    <div class="control-section" class:open={openSection === 'colours'}>
      <button class="section-header" onclick={() => openSection = openSection === 'colours' ? '' : 'colours'}>
        Colours
        <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      {#if openSection === 'colours'}
        <div class="section-body">
          <!-- Per-item colors -->
          {#each waffleData as row, i}
            <div class="color-row">
              <span class="color-label">{row.label}</span>
              <input
                type="color"
                class="color-picker"
                value={row.color}
                oninput={(e) => updateColor(i, (e.target as HTMLInputElement).value)}
              />
            </div>
          {/each}

          <!-- Background -->
          <div class="color-row bg-row">
            <span class="color-label">Background</span>
            <div class="bg-options">
              <button class="bg-option" class:active={bgColor === 'white'} onclick={() => { bgColor = 'white'; }} aria-label="White background">
                <span class="bg-circle bg-white"></span>
              </button>
              <button class="bg-option" class:active={bgColor === 'transparent'} onclick={() => { bgColor = 'transparent'; }} aria-label="Transparent background">
                <span class="bg-circle bg-transparent"></span>
              </button>
              <label class="bg-option" class:active={bgColor !== 'white' && bgColor !== 'transparent'} title="Custom background">
                <span class="bg-circle bg-rainbow"></span>
                <input
                  type="color"
                  class="visually-hidden"
                  value={bgColor === 'white' || bgColor === 'transparent' ? '#FFFFFF' : bgColor}
                  oninput={(e) => { bgColor = (e.target as HTMLInputElement).value; }}
                />
              </label>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- ═══ STYLE ═══ -->
    <div class="control-section" class:open={openSection === 'style'}>
      <button class="section-header" onclick={() => openSection = openSection === 'style' ? '' : 'style'}>
        Style
        <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      {#if openSection === 'style'}
        <div class="section-body">
          <!-- Shape toggles -->
          <div class="shape-toggles">
            <button class="shape-btn" class:active={cellShape === 'square'} onclick={() => cellShape = 'square'} title="Square">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16"/>
              </svg>
            </button>
            <button class="shape-btn" class:active={cellShape === 'circle'} onclick={() => cellShape = 'circle'} title="Circle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="8"/>
              </svg>
            </button>
            <button class="shape-btn" class:active={cellShape === 'diamond'} onclick={() => cellShape = 'diamond'} title="Diamond">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l8 8-8 8-8-8z"/>
              </svg>
            </button>
            <button class="shape-btn" class:active={cellShape === 'heart'} onclick={() => cellShape = 'heart'} title="Heart">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
          </div>

          <!-- Grid columns -->
          <div class="control-group">
            <label>Grid columns: {gridCols}</label>
            <input type="range" bind:value={gridCols} min="5" max="20" step="1" />
          </div>

          <!-- Rounding (squares only) -->
          {#if cellShape === 'square'}
            <div class="control-group">
              <label>Rounding</label>
              <input type="range" bind:value={cellRounding} min="0" max="12" step="1" />
            </div>
          {/if}

          <!-- Gap -->
          <div class="control-group">
            <label>Gap</label>
            <input type="range" bind:value={cellGap} min="0" max="12" step="1" />
          </div>
        </div>
      {/if}
    </div>

    <!-- ═══ TITLE ═══ -->
    <div class="control-section" class:open={openSection === 'title'}>
      <button class="section-header" onclick={() => openSection = openSection === 'title' ? '' : 'title'}>
        Title
        <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      {#if openSection === 'title'}
        <div class="section-body">
          <textarea
            class="title-input"
            bind:value={chartTitle}
            placeholder="Add chart title"
            maxlength={200}
            rows="1"
            oninput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
          ></textarea>
          <div class="text-control-row">
            <select class="font-select" bind:value={titleFont} style="font-family: '{titleFont}', sans-serif;">
              {#each fontOptions as font}
                <option value={font.value} style="font-family: '{font.value}', sans-serif;">{font.label}</option>
              {/each}
            </select>
            <button class="ctrl-btn" onclick={() => { titleAlign = cycleAlign(titleAlign); }} title="Text alignment">
              <img src={alignIcons[titleAlign]} alt="" width="16" height="16" />
            </button>
            <button class="ctrl-btn" class:active={titleBold} onclick={() => { titleBold = !titleBold; }} title="Bold">
              <img src="/icons/icon-bold.svg" alt="" width="16" height="16" />
            </button>
            <button class="ctrl-btn" class:active={titleItalic} onclick={() => { titleItalic = !titleItalic; }} title="Italic">
              <img src="/icons/icon-italic.svg" alt="" width="16" height="16" />
            </button>
          </div>
          <div class="text-control-row">
            <button class="ctrl-btn" class:active={titleSizeControl === 'size'} onclick={() => { titleSizeControl = 'size'; }} title="Font size">
              <img src="/icons/icon-font-size.svg" alt="" width="16" height="16" />
            </button>
            <button class="ctrl-btn" class:active={titleSizeControl === 'lineheight'} onclick={() => { titleSizeControl = 'lineheight'; }} title="Line spacing">
              <img src="/icons/icon-line-spacing.svg" alt="" width="16" height="16" />
            </button>
            <input
              type="range"
              class="style-slider"
              min="16"
              max="48"
              value={getTitleSliderValue()}
              oninput={(e) => setTitleSlider(Number((e.target as HTMLInputElement).value))}
            />
            <input
              type="color"
              class="color-picker"
              value={titleColor}
              oninput={(e) => { titleColor = (e.target as HTMLInputElement).value; }}
            />
          </div>
        </div>
      {/if}
    </div>

    <!-- ═══ CAPTION & SOURCE ═══ -->
    <div class="control-section" class:open={openSection === 'caption'}>
      <button class="section-header" onclick={() => openSection = openSection === 'caption' ? '' : 'caption'}>
        Caption & Source
        <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      {#if openSection === 'caption'}
        <div class="section-body">
          <textarea
            class="caption-input"
            bind:value={chartCaption}
            placeholder="Caption and Data Source"
            maxlength={300}
            rows="1"
            oninput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
          ></textarea>
          <div class="text-control-row">
            <select class="font-select" bind:value={captionFont} style="font-family: '{captionFont}', sans-serif;">
              {#each fontOptions as font}
                <option value={font.value} style="font-family: '{font.value}', sans-serif;">{font.label}</option>
              {/each}
            </select>
            <button class="ctrl-btn" onclick={() => { captionAlign = cycleAlign(captionAlign); }} title="Text alignment">
              <img src={alignIcons[captionAlign]} alt="" width="16" height="16" />
            </button>
            <button class="ctrl-btn" class:active={captionBold} onclick={() => { captionBold = !captionBold; }} title="Bold">
              <img src="/icons/icon-bold.svg" alt="" width="16" height="16" />
            </button>
            <button class="ctrl-btn" class:active={captionItalic} onclick={() => { captionItalic = !captionItalic; }} title="Italic">
              <img src="/icons/icon-italic.svg" alt="" width="16" height="16" />
            </button>
          </div>
          <div class="text-control-row">
            <button class="ctrl-btn" class:active={captionSizeControl === 'size'} onclick={() => { captionSizeControl = 'size'; }} title="Font size">
              <img src="/icons/icon-font-size.svg" alt="" width="16" height="16" />
            </button>
            <button class="ctrl-btn" class:active={captionSizeControl === 'lineheight'} onclick={() => { captionSizeControl = 'lineheight'; }} title="Line spacing">
              <img src="/icons/icon-line-spacing.svg" alt="" width="16" height="16" />
            </button>
            <input
              type="range"
              class="style-slider"
              min="12"
              max="24"
              value={getCaptionSliderValue()}
              oninput={(e) => setCaptionSlider(Number((e.target as HTMLInputElement).value))}
            />
            <input
              type="color"
              class="color-picker"
              value={captionColor}
              oninput={(e) => { captionColor = (e.target as HTMLInputElement).value; }}
            />
          </div>
        </div>
      {/if}
    </div>

    <!-- ═══ LEGEND ═══ -->
    <div class="control-section" class:open={openSection === 'legend'}>
      <button class="section-header" onclick={() => openSection = openSection === 'legend' ? '' : 'legend'}>
        Legend
        <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      {#if openSection === 'legend'}
        <div class="section-body">
          <div class="text-control-row">
            <img src="/icons/icon-font-size.svg" alt="" width="16" height="16" class="ctrl-icon" />
            <input
              type="range"
              class="style-slider"
              min="10"
              max="18"
              value={legendSize}
              oninput={(e) => { legendSize = Number((e.target as HTMLInputElement).value); }}
            />
            <button class="ctrl-btn" onclick={() => { legendVisible = !legendVisible; }} title="Show/hide legend">
              <img src={legendVisible ? '/icons/icon-visibility.svg' : '/icons/icon-no-visibility.svg'} alt="" width="16" height="16" />
            </button>
            <input
              type="color"
              class="color-picker"
              value={legendColor}
              oninput={(e) => { legendColor = (e.target as HTMLInputElement).value; }}
            />
          </div>
          <div class="legend-position-row">
            <button class="legend-position-btn" class:active={legendPosition === 'bottom'} onclick={() => { legendPosition = 'bottom'; }} title="Legend below">
              <img src="/icons/icon-align-bottom.svg" alt="" width="16" height="16" />
              <span>Legend below</span>
            </button>
            <button class="legend-position-btn" class:active={legendPosition === 'top'} onclick={() => { legendPosition = 'top'; }} title="Legend above">
              <img src="/icons/icon-align-top.svg" alt="" width="16" height="16" />
              <span>Legend above</span>
            </button>
          </div>
        </div>
      {/if}
    </div>

  </div>

  <!-- Download button (footer) -->
  <div class="editor-footer">
    <button class="download-btn primary" onclick={downloadWaffle} disabled={!hasUserData}>
      <img src="/icons/icon-download.svg" alt="" width="18" height="18" />
      Download
    </button>
  </div>
</div>
</div>

<style>
  .waffle-editor {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-modal) + 50);
    background: var(--bg-surface);
    overflow-y: auto;
  }

  .editor-panel {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    background: var(--white);
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.08);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--white);
    z-index: 10;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-round);
    cursor: pointer;
    color: var(--text-dark);
    min-height: 36px;
    min-width: 36px;
  }

  .back-btn:hover {
    background: var(--bg-light);
  }

  .editor-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-dark);
    text-align: center;
    flex: 1;
  }

  .header-spacer {
    width: 32px;
  }

  .canvas-card {
    margin: 0.75rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preview-title {
    margin: 0 0 0.375rem;
    word-wrap: break-word;
    white-space: pre-line;
  }

  .preview-caption {
    margin: 0.375rem 0 0;
    word-wrap: break-word;
    white-space: pre-line;
  }

  .title-input,
  .caption-input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    background: white;
    resize: none;
    overflow: hidden;
  }

  .canvas-wrapper {
    background: transparent;
    border-radius: var(--radius-md);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 0;
  }

  .waffle-canvas {
    width: 100%;
    height: auto;
    display: block;
  }

  .waffle-legend-row {
    display: flex;
    flex-direction: row;
    gap: 1.5rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 0.25rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-label {
    font-weight: 500;
  }

  .controls {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .control-section {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-bottom: 0.75rem;
  }

  .section-header {
    width: 100%;
    padding: 0.875rem 1rem;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-dark);
    min-height: 44px;
  }

  .section-header:hover {
    background: var(--bg-light);
  }

  .section-chevron {
    transition: transform var(--duration-fast) ease;
    color: var(--text-medium);
    flex-shrink: 0;
  }

  .control-section.open .section-chevron {
    transform: rotate(180deg);
  }

  .section-body {
    padding: 0.75rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* CSV & Data */
  .csv-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-medium);
    display: block;
  }

  .csv-input {
    padding: 0.625rem 0.625rem 1rem 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    background: white;
    color: var(--text-dark);
    resize: vertical;
  }

  .csv-input::placeholder {
    font-size: var(--font-size-base);
    color: #999999;
    opacity: 1;
  }

  .apply-csv-btn {
    width: 100%;
  }

  .csv-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.5rem 0;
  }

  .csv-divider::before,
  .csv-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  .csv-divider span {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-dark);
    white-space: nowrap;
  }

  .data-rows {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .data-row {
    display: flex;
    gap: 0.375rem;
    align-items: center;
  }

  .label-input,
  .value-input {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    background: white;
    -moz-appearance: textfield;
  }

  .value-input::-webkit-outer-spin-button,
  .value-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .label-input::placeholder,
  .value-input::placeholder {
    color: #999999;
    opacity: 1;
  }

  .label-input {
    flex: 2;
  }

  .value-input {
    width: 50px;
  }

  .color-picker {
    width: 32px;
    height: 32px;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    padding: 2px;
    flex-shrink: 0;
    min-height: 32px;
    min-width: 32px;
    background: var(--white);
  }

  .color-picker:hover {
    border-color: var(--color-primary);
  }

  .row-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    padding: 0;
    opacity: 0.4;
    min-height: 32px;
    min-width: 32px;
  }

  .row-delete:hover {
    opacity: 1;
  }

  .add-row-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: auto;
    height: auto;
    margin: 0.25rem auto 0;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-round);
    cursor: pointer;
    color: var(--text-medium);
  }

  .add-row-btn img {
    width: 32px;
    height: 32px;
  }

  .add-row-btn:hover {
    color: var(--color-primary);
  }

  .add-row-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Colours */
  .color-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .color-label {
    font-size: 0.85rem;
    color: var(--text-dark);
  }

  .bg-row {
    margin-top: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
  }

  .bg-options {
    display: flex;
    gap: 0.5rem;
  }

  .bg-option {
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-round);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast) ease;
  }

  .bg-option.active {
    border: 2px solid var(--color-primary);
  }

  .bg-circle {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-round);
  }

  .bg-circle.bg-white {
    background: #FFFFFF;
    border: 1px solid #e0e0e0;
  }

  .bg-circle.bg-transparent {
    background-color: #fff !important;
    background-image:
      linear-gradient(45deg, #ccc 25%, transparent 25%),
      linear-gradient(-45deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%),
      linear-gradient(-45deg, transparent 75%, #ccc 75%) !important;
    background-size: 6px 6px !important;
    background-position: 0 0, 0 3px, 3px -3px, -3px 0px !important;
  }

  .bg-circle.bg-rainbow {
    background-image: conic-gradient(
      red, yellow, lime, aqua, blue, magenta, red
    ) !important;
    background-color: transparent !important;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* Style */
  .shape-toggles {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .shape-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    background: white;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 40px;
  }

  .shape-btn:hover {
    border-color: var(--color-primary);
  }

  .shape-btn.active {
    background: #555555;
    border: none;
    color: white;
  }

  .shape-btn svg {
    filter: brightness(0) saturate(100%);
  }

  .shape-btn.active svg {
    filter: brightness(0) invert(1);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .control-group label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-medium);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--color-primary);
    min-height: auto;
    padding: 0;
    border: none;
  }

  /* Text controls */
  .section-body > input[type='text'] {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    background: white;
  }

  .section-body > input[type='text']::placeholder,
  .section-body > textarea::placeholder {
    color: var(--text-medium);
  }

  .text-control-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .ctrl-icon {
    width: 20px;
    height: 20px;
    filter: brightness(0) saturate(100%);
    flex-shrink: 0;
  }

  /* ─── Legend position row ─── */
  .legend-position-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .legend-position-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--white);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--text-dark);
    min-height: 36px;
    transition: all var(--duration-fast) ease;
  }

  .legend-position-btn.active {
    background: #555555;
    color: var(--white);
    border-color: #555555;
  }

  .legend-position-btn img {
    width: 16px;
    height: 16px;
    filter: brightness(0) saturate(100%);
  }

  .legend-position-btn.active img {
    filter: brightness(0) invert(1);
  }

  .font-select {
    flex: 1;
    padding: 0 1.5rem 0 0.5rem;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    background: white;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%23888888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 16px 16px;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: 36px;
    min-width: 36px;
    transition: all var(--duration-fast) ease;
  }

  .ctrl-btn:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  .ctrl-btn.active {
    background: #555555;
    border: none;
  }

  .ctrl-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .ctrl-btn img {
    width: 16px;
    height: 16px;
    filter: brightness(0) saturate(100%);
  }

  .ctrl-btn.active img {
    filter: brightness(0) invert(1);
  }

  .style-slider {
    flex: 1;
    accent-color: var(--color-primary);
    min-height: auto;
    padding: 0;
    border: none;
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    outline: none;
  }

  .style-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--color-primary);
    cursor: pointer;
    border-radius: var(--radius-round);
  }

  .style-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--color-primary);
    cursor: pointer;
    border-radius: var(--radius-round);
    border: none;
  }

  .style-slider::-moz-range-track {
    background: transparent;
    border: none;
  }

  .color-picker {
    width: 36px;
    height: 36px;
    padding: 2px;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    background: var(--white);
    min-height: 36px;
    min-width: 36px;
    flex-shrink: 0;
  }

  /* Footer */
  .editor-footer {
    padding: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .download-btn {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .download-btn img {
    filter: brightness(0) invert(1);
  }

  .download-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .waffle-editor {
      max-width: 100%;
      border-radius: 0;
    }
  }
</style>
