<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import type { ChartType } from '$lib/config/design';
  import { DESIGN_TOKENS } from '$lib/config/design';
  import { chartArchive } from '$lib/stores/chartArchive.svelte';

  interface Props {
    chartType: ChartType;
    initialCsv?: string;
    archiveId?: string;
    onclose: () => void;
  }

  let { chartType: initChartType, initialCsv: initCsv = '', archiveId: initArchiveId, onclose }: Props = $props();

  // ─── Chart type ───
  let activeType = $state<ChartType>(initChartType);
  let isPieVariant = $state<'pie' | 'donut'>('pie');

  const typeTabs: Array<{ id: ChartType; label: string; icon: string }> = [
    { id: 'pie', label: 'Pie', icon: '/icons/icon-pie-chart.svg' },
    { id: 'bar', label: 'Bar', icon: '/icons/icon-vertical-bars.svg' },
    { id: 'line', label: 'Line', icon: '/icons/icon-line-chart.svg' }
  ];

  const fontOptions = [
    { value: 'Inter', label: 'Inter (Default)' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Roboto Slab', label: 'Roboto Slab' }
  ];

  // ─── Data state ───
  let csvText = $state(initCsv);
  let labels = $state<string[]>(['Item 1', 'Item 2', 'Item 3']);
  let values = $state<number[][]>([[25, 35, 20]]);
  let seriesNames = $state<string[]>(['Value']);

  // ─── Colour state ───
  const defaultColors = [...DESIGN_TOKENS.chartColors];
  const defaultBarColor = '#5422b0';
  let sliceColors = $state<string[]>([...defaultColors]);
  let barSeriesColors = $state<string[]>(['#5422b0', '#AB0000', '#004269']);
  let baseBarColor = $state<string>(defaultBarColor);
  let barBarColors = $state<Record<number, string | null>>({});
  let lineColors = $state<string[]>(['#5422b0', '#AB0000']);
  let markerColors = $state<string[]>(['#5422b0', '#AB0000']);
  let bgColor = $state<'white' | 'transparent' | string>('white');

  // ─── Style state (pie/donut) ───
  let smoothing = $state(5);
  let sliceGap = $state(4);
  let donutCutout = $state(50);
  let pieStyleControl = $state<'corner' | 'gap' | 'hole'>('corner');

  // ─── Style state (bar) ───
  let barRounding = $state(10);
  let barSpacing = $state(80);
  let barAspectRatio = $state(100);
  let barOrientation = $state<'vertical' | 'horizontal'>('vertical');
  let barMode = $state<'grouped' | 'stacked'>('grouped');
  let barStyleControl = $state<'corner' | 'gap' | 'resize'>('corner');

  // ─── Style state (line) ───
  let lineTension = $state(0);
  let lineWidth = $state(3);
  let lineAspectRatio = $state(100);
  let lineStyleControl = $state<'smoothing' | 'linewidth' | 'resize'>('smoothing');
  let markerStyle = $state<'circle' | 'rectRot' | 'rect'>('circle');
  let markerSize = $state(5);
  let markerVisible = $state(true);

  // ─── Title state ───
  let chartTitle = $state('');
  let titleFont = $state('Inter');
  let titleAlign = $state<'center' | 'left' | 'right'>('center');
  let titleBold = $state(true);
  let titleItalic = $state(false);
  let titleSizeControl = $state<'size' | 'lineheight'>('size');
  let titleSize = $state(24);
  let titleLineHeight = $state(1.2);
  let titleColor = $state('#555555');

  // ─── Caption state ───
  let chartCaption = $state('');
  let captionFont = $state('Inter');
  let captionAlign = $state<'center' | 'left' | 'right'>('center');
  let captionBold = $state(false);
  let captionItalic = $state(false);
  let captionSizeControl = $state<'size' | 'lineheight'>('size');
  let captionSize = $state(14);
  let captionLineHeight = $state(1.4);
  let captionColor = $state('#555555');

  // ─── Legend / Axis state ───
  let legendVisible = $state(true);
  let legendPosition = $state<'bottom' | 'top'>('bottom');
  let legendSize = $state(12);
  let legendColor = $state('#555555');
  let axisVisible = $state(true);
  let axisSize = $state(12);
  let axisBold = $state(false);
  let axisColor = $state('#555555');

  // ─── Canvas ───
  let canvas = $state<HTMLCanvasElement>();
  let chartInstance: any = null;
  let ChartJs: any = null;

  // ─── Accordion ───
  let openSection = $state<string>('data');

  // ─── Archive tracking ───
  let currentArchiveId = $state<string | undefined>(initArchiveId);

  // ─── Derived helpers ───
  let isPie = $derived(activeType === 'pie');
  let isBar = $derived(activeType === 'bar' || activeType === 'stackedBar' || activeType === 'groupedBar');
  let isLine = $derived(activeType === 'line');
  let isDonut = $derived(isPie && isPieVariant === 'donut');
  let isMultiSeries = $derived(values.length > 1);

  // Alignment icon map
  const alignIcons: Record<string, string> = {
    left: '/icons/icon-align-left.svg',
    center: '/icons/icon-align-center.svg',
    right: '/icons/icon-align-right.svg'
  };

  // ─── CSV parsing ───
  function parseAndApplyCsv() {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const newLabels: string[] = [];
    const columns: number[][] = [];
    let newSeriesNames: string[] = [];

    const firstRow = lines[0].split(',').map((c: string) => c.trim());
    const hasHeader = firstRow.length > 1 && isNaN(Number(firstRow[1]));
    const startIdx = hasHeader ? 1 : 0;
    if (hasHeader && firstRow.length > 1) newSeriesNames = firstRow.slice(1);

    for (let i = startIdx; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c: string) => c.trim());
      if (cells.length < 2) continue;
      newLabels.push(cells[0]);
      const nums = cells.slice(1).map((c: string) => { const n = Number(c); return isNaN(n) ? 0 : n; });
      while (columns.length < nums.length) columns.push([]);
      nums.forEach((n: number, ci: number) => columns[ci].push(n));
    }

    if (newLabels.length > 0 && columns.length > 0) {
      labels = newLabels;
      values = columns;
      if (newSeriesNames.length > 0) seriesNames = newSeriesNames;
      else seriesNames = columns.length === 1 ? ['Value'] : columns.map((_, i) => `Series ${i + 1}`);
      // Ensure sliceColors has enough entries
      while (sliceColors.length < newLabels.length) {
        sliceColors = [...sliceColors, defaultColors[sliceColors.length % defaultColors.length]];
      }
    }
  }

  // ─── Chart.js config ───
  function getChartJsType(): string {
    if (isPie) return isDonut ? 'doughnut' : 'pie';
    if (activeType === 'stackedBar' || activeType === 'groupedBar') return 'bar';
    return activeType;
  }

  function buildChartConfig(): any {
    const colors = DESIGN_TOKENS.chartColors;
    const datasets: any[] = values.map((vals, i) => {
      const ds: any = { label: seriesNames[i] || `Series ${i + 1}`, data: [...vals] };

      if (isPie) {
        ds.backgroundColor = vals.map((_: number, j: number) => sliceColors[j % sliceColors.length]);
        ds.borderColor = bgColor === 'transparent' ? 'transparent' : (bgColor === 'white' ? '#FFFFFF' : bgColor);
        ds.borderWidth = sliceGap;
      } else if (isLine) {
        const color = lineColors[i % lineColors.length];
        ds.borderColor = color;
        ds.backgroundColor = 'transparent';
        ds.fill = false;
        ds.tension = lineTension / 10;
        ds.borderWidth = lineWidth;
        ds.pointRadius = markerVisible ? markerSize : 0;
        ds.pointHoverRadius = markerVisible ? markerSize + 2 : 0;
        ds.pointBackgroundColor = markerColors[i % markerColors.length];
        ds.pointBorderColor = markerColors[i % markerColors.length];
        ds.pointStyle = markerStyle;
      } else {
        // Bar: apply per-bar colors or base color
        ds.backgroundColor = vals.map((_: number, labelIdx: number) => 
          barBarColors[labelIdx] || baseBarColor
        );
        ds.borderColor = vals.map((_: number, labelIdx: number) => 
          barBarColors[labelIdx] || baseBarColor
        );
        ds.borderWidth = 0;
        ds.borderRadius = barRounding;
        ds.categoryPercentage = barSpacing / 100;
      }
      return ds;
    });

    const options: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      layout: { padding: { top: 8, bottom: 4, left: 4, right: 4 } },
      plugins: {
        legend: {
          display: legendVisible && (isPie || isMultiSeries),
          position: legendPosition,
          labels: {
            font: { family: "'Inter', sans-serif", size: legendSize, weight: '500' },
            padding: 15,
            usePointStyle: true,
            color: legendColor
          }
        },
        tooltip: {
          backgroundColor: '#1f1f1f',
          titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
          bodyFont: { family: "'Inter', sans-serif", size: 11 },
          padding: 10,
          cornerRadius: 8
        }
      }
    };

    if (isPie) {
      options.elements = { arc: { borderRadius: smoothing } };
      if (isDonut) {
        options.cutout = `${donutCutout}%`;
      }
    }

    if (isBar) {
      options.indexAxis = barOrientation === 'vertical' ? 'x' : 'y';
      options.aspectRatio = barAspectRatio / 100;
      const axisOpts = {
        display: axisVisible,
        grid: { display: false },
        ticks: {
          color: axisColor,
          font: { family: "'Inter', sans-serif", size: axisSize, weight: axisBold ? 'bold' as const : 'normal' as const }
        },
        border: { display: false }
      };
      const isStacked = isMultiSeries && barMode === 'stacked';
      options.scales = {
        x: { ...axisOpts, stacked: isStacked },
        y: { ...axisOpts, stacked: isStacked, grid: { display: true, color: 'rgba(0,0,0,0.05)' } }
      };
    }

    if (isLine) {
      options.aspectRatio = lineAspectRatio / 100;
      const axisOpts = {
        display: axisVisible,
        ticks: {
          color: axisColor,
          font: { family: "'Inter', sans-serif", size: axisSize, weight: axisBold ? 'bold' as const : 'normal' as const }
        },
        border: { display: false }
      };
      options.scales = {
        x: { ...axisOpts, grid: { display: false } },
        y: { ...axisOpts, grid: { display: true, color: '#e0e0e0' }, beginAtZero: true }
      };
    }

    return {
      type: getChartJsType(),
      data: { labels: [...labels], datasets },
      options
    };
  }

  async function renderChart() {
    if (!browser || !canvas) return;

    if (!ChartJs) {
      const mod = await import('chart.js');
      ChartJs = mod.Chart;
      ChartJs.register(...mod.registerables);
    }

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    // Deep-clone to strip Svelte 5 $state proxies
    const config = JSON.parse(JSON.stringify(buildChartConfig()));
    chartInstance = new ChartJs(canvas, config);
  }

  function updateChart() {
    tick().then(() => renderChart());
  }

  // ─── Data row management ───
  function addRow() {
    labels = [...labels, `Item ${labels.length + 1}`];
    values = values.map(col => [...col, 0]);
    sliceColors = [...sliceColors, defaultColors[sliceColors.length % defaultColors.length]];
    updateChart();
  }

  function removeRow(index: number) {
    if (labels.length <= 1) return;
    labels = labels.filter((_, i) => i !== index);
    values = values.map(col => col.filter((_, i) => i !== index));
    sliceColors = sliceColors.filter((_, i) => i !== index);
    updateChart();
  }

  function updateLabel(index: number, val: string) {
    labels[index] = val;
    updateChart();
  }

  function updateValue(seriesIdx: number, rowIdx: number, val: number) {
    values[seriesIdx][rowIdx] = val;
    updateChart();
  }

  function applyCsv() {
    parseAndApplyCsv();
    updateChart();
  }

  function switchType(type: ChartType) {
    activeType = type;
    if (type !== 'pie') isPieVariant = 'pie';
    updateChart();
  }

  // ─── Style slider helpers ───
  function getPieSliderValue(): number {
    switch (pieStyleControl) {
      case 'corner': return smoothing;
      case 'gap': return sliceGap;
      case 'hole': return donutCutout;
    }
  }
  function getPieSliderMin(): number {
    return 0;
  }
  function getPieSliderMax(): number {
    switch (pieStyleControl) {
      case 'corner': return 20;
      case 'gap': return 20;
      case 'hole': return 90;
    }
  }
  function setPieSlider(val: number) {
    switch (pieStyleControl) {
      case 'corner': smoothing = val; break;
      case 'gap': sliceGap = val; break;
      case 'hole': donutCutout = val; break;
    }
    updateChart();
  }

  function getBarSliderValue(): number {
    switch (barStyleControl) {
      case 'corner': return barRounding;
      case 'gap': return barSpacing;
      case 'resize': return barAspectRatio;
    }
  }
  function getBarSliderMin(): number {
    switch (barStyleControl) {
      case 'corner': return 0;
      case 'gap': return 40;
      case 'resize': return 50;
    }
  }
  function getBarSliderMax(): number {
    switch (barStyleControl) {
      case 'corner': return 40;
      case 'gap': return 100;
      case 'resize': return 150;
    }
  }
  function setBarSlider(val: number) {
    switch (barStyleControl) {
      case 'corner': barRounding = val; break;
      case 'gap': barSpacing = val; break;
      case 'resize': barAspectRatio = val; break;
    }
    updateChart();
  }

  function getLineSliderValue(): number {
    switch (lineStyleControl) {
      case 'smoothing': return lineTension;
      case 'linewidth': return lineWidth;
      case 'resize': return lineAspectRatio;
    }
  }
  function getLineSliderMin(): number {
    switch (lineStyleControl) {
      case 'smoothing': return 0;
      case 'linewidth': return 1;
      case 'resize': return 50;
    }
  }
  function getLineSliderMax(): number {
    switch (lineStyleControl) {
      case 'smoothing': return 5;
      case 'linewidth': return 15;
      case 'resize': return 150;
    }
  }
  function setLineSlider(val: number) {
    switch (lineStyleControl) {
      case 'smoothing': lineTension = val; break;
      case 'linewidth': lineWidth = val; break;
      case 'resize': lineAspectRatio = val; break;
    }
    updateChart();
  }

  // ─── Title/Caption alignment cycle ───
  function cycleAlign(current: 'center' | 'left' | 'right'): 'center' | 'left' | 'right' {
    const order: Array<'center' | 'left' | 'right'> = ['center', 'left', 'right'];
    return order[(order.indexOf(current) + 1) % 3];
  }

  // ─── Title slider ───
  function getTitleSliderValue(): number {
    return titleSizeControl === 'size' ? titleSize : Math.round((titleLineHeight - 1.0) * 100 / 1.0 * 32 / 100 + 16);
  }
  function setTitleSlider(val: number) {
    if (titleSizeControl === 'size') {
      titleSize = val;
    } else {
      const lineHeightMap = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
      const index = Math.min(Math.floor((val - 16) / 5.33), 5);
      titleLineHeight = lineHeightMap[index];
    }
  }

  function getCaptionSliderValue(): number {
    return captionSizeControl === 'size' ? captionSize : Math.round((captionLineHeight - 1.0) * 100 / 1.0 * 12 / 100 + 12);
  }
  function setCaptionSlider(val: number) {
    if (captionSizeControl === 'size') {
      captionSize = val;
    } else {
      const lineHeightMap = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
      const index = Math.min(Math.floor((val - 12) / 2), 5);
      captionLineHeight = lineHeightMap[index];
    }
  }

  // ─── Download ───
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

  function downloadChart() {
    if (!chartInstance || !canvas) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const canvasAspectRatio = canvasHeight / canvasWidth;

    const exportWidth = 1080;
    const chartWidth = 1000;
    const chartHeight = chartWidth * canvasAspectRatio;

    // Pre-measure title and caption for word wrapping
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d')!;
    const textMaxWidth = exportWidth - 80;

    const titleFontSize = 48;
    const titleLineSpacing = titleFontSize * titleLineHeight;
    let titleLines: string[] = [];
    let titleBlockHeight = 0;
    if (chartTitle) {
      measureCtx.font = `${titleBold ? 'bold' : 'normal'} ${titleItalic ? 'italic' : 'normal'} ${titleFontSize}px '${titleFont}', sans-serif`;
      titleLines = wrapText(measureCtx, chartTitle, textMaxWidth);
      titleBlockHeight = (titleLines.length * titleLineSpacing) + 20;
    }

    const captionFontSize = 28;
    const captionLineSpacing = captionFontSize * captionLineHeight;
    let captionLines: string[] = [];
    let captionBlockHeight = 0;
    if (chartCaption) {
      measureCtx.font = `${captionBold ? 'bold' : 'normal'} ${captionItalic ? 'italic' : 'normal'} ${captionFontSize}px '${captionFont}', sans-serif`;
      captionLines = wrapText(measureCtx, chartCaption, textMaxWidth);
      captionBlockHeight = 40 + (captionLines.length * captionLineSpacing);
    }

    let totalHeight = 120;
    totalHeight += titleBlockHeight;
    totalHeight += chartHeight;
    totalHeight += captionBlockHeight;
    totalHeight += 60;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = exportWidth;
    tempCanvas.height = totalHeight;

    if (bgColor !== 'transparent') {
      tempCtx.fillStyle = bgColor === 'white' ? '#FFFFFF' : bgColor;
      tempCtx.fillRect(0, 0, exportWidth, totalHeight);
    }

    let yOffset = 60;

    if (chartTitle) {
      tempCtx.fillStyle = titleColor;
      tempCtx.font = `${titleBold ? 'bold' : 'normal'} ${titleItalic ? 'italic' : 'normal'} ${titleFontSize}px '${titleFont}', sans-serif`;
      tempCtx.textAlign = titleAlign;
      const titleX = titleAlign === 'left' ? 40 : (titleAlign === 'right' ? exportWidth - 40 : exportWidth / 2);
      titleLines.forEach((line, idx) => {
        tempCtx.fillText(line, titleX, yOffset + (idx * titleLineSpacing));
      });
      yOffset += titleBlockHeight;
    }

    // Temporarily disable tooltip for clean export
    chartInstance.options.plugins.tooltip.enabled = false;
    chartInstance.update();
    const chartImageSrc = chartInstance.toBase64Image();
    chartInstance.options.plugins.tooltip.enabled = true;
    chartInstance.update();

    const chartImage = new Image();
    chartImage.onload = function () {
      const chartX = (exportWidth - chartWidth) / 2;
      tempCtx.drawImage(chartImage, chartX, yOffset, chartWidth, chartHeight);
      yOffset += chartHeight + 40;

      if (chartCaption) {
        tempCtx.fillStyle = captionColor;
        tempCtx.font = `${captionBold ? 'bold' : 'normal'} ${captionItalic ? 'italic' : 'normal'} ${captionFontSize}px '${captionFont}', sans-serif`;
        tempCtx.textAlign = captionAlign;
        const captionX = captionAlign === 'left' ? 40 : (captionAlign === 'right' ? exportWidth - 40 : exportWidth / 2);
        captionLines.forEach((line, idx) => {
          tempCtx.fillText(line, captionX, yOffset + (idx * captionLineSpacing));
        });
      }

      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `chartflamai-${activeType}-${timestamp}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    };
    chartImage.src = chartImageSrc;
  }

  function captureThumb(): string {
    if (!canvas) return '';
    try {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 400;
      thumbCanvas.height = 400;
      const tCtx = thumbCanvas.getContext('2d')!;
      tCtx.fillStyle = bgColor === 'transparent' ? '#FFFFFF' : (bgColor === 'white' ? '#FFFFFF' : bgColor);
      tCtx.fillRect(0, 0, 400, 400);
      const src = canvas;
      const scale = Math.min(360 / src.width, 360 / src.height);
      const w = src.width * scale;
      const h = src.height * scale;
      tCtx.drawImage(src, (400 - w) / 2, (400 - h) / 2, w, h);
      return thumbCanvas.toDataURL('image/png', 0.7);
    } catch { return ''; }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  function restoreFromArchive() {
    if (!initArchiveId) return;
    const archived = chartArchive.getById(initArchiveId);
    if (!archived) return;
    const c = archived.config;
    if (c.activeType) activeType = c.activeType;
    if (c.isPieVariant) isPieVariant = c.isPieVariant;
    if (c.labels) labels = [...c.labels];
    if (c.values) values = c.values.map((v: number[]) => [...v]);
    if (c.seriesNames) seriesNames = [...c.seriesNames];
    if (c.sliceColors) sliceColors = [...c.sliceColors];
    if (c.barSeriesColors) barSeriesColors = [...c.barSeriesColors];
    if (c.lineColors) lineColors = [...c.lineColors];
    if (c.markerColors) markerColors = [...c.markerColors];
    if (c.bgColor !== undefined) bgColor = c.bgColor;
    if (c.smoothing !== undefined) smoothing = c.smoothing;
    if (c.sliceGap !== undefined) sliceGap = c.sliceGap;
    if (c.donutCutout !== undefined) donutCutout = c.donutCutout;
    if (c.barRounding !== undefined) barRounding = c.barRounding;
    if (c.barSpacing !== undefined) barSpacing = c.barSpacing;
    if (c.barAspectRatio !== undefined) barAspectRatio = c.barAspectRatio;
    if (c.barOrientation) barOrientation = c.barOrientation;
    if (c.barMode) barMode = c.barMode;
    if (c.lineTension !== undefined) lineTension = c.lineTension;
    if (c.lineWidth !== undefined) lineWidth = c.lineWidth;
    if (c.lineAspectRatio !== undefined) lineAspectRatio = c.lineAspectRatio;
    if (c.markerStyle) markerStyle = c.markerStyle;
    if (c.markerSize !== undefined) markerSize = c.markerSize;
    if (c.markerVisible !== undefined) markerVisible = c.markerVisible;
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
    if (c.axisVisible !== undefined) axisVisible = c.axisVisible;
    if (c.axisSize !== undefined) axisSize = c.axisSize;
    if (c.axisBold !== undefined) axisBold = c.axisBold;
    if (c.axisColor) axisColor = c.axisColor;
  }

  onMount(() => {
    restoreFromArchive();
    if (initCsv) parseAndApplyCsv();
    renderChart();
    return () => { if (chartInstance) chartInstance.destroy(); };
  });

  let saveTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    // Touch all reactive state to create dependencies
    const _ = [
      activeType, isPieVariant, csvText, labels, values, seriesNames,
      sliceColors, barSeriesColors, lineColors, markerColors, bgColor,
      smoothing, sliceGap, donutCutout, barRounding, barSpacing, barAspectRatio,
      barOrientation, barMode, lineTension, lineWidth, lineAspectRatio,
      markerStyle, markerSize, markerVisible,
      chartTitle, titleFont, titleAlign, titleBold, titleItalic, titleSize, titleLineHeight, titleColor,
      chartCaption, captionFont, captionAlign, captionBold, captionItalic, captionSize, captionLineHeight, captionColor,
      legendVisible, legendPosition, legendSize, legendColor,
      axisVisible, axisSize, axisBold, axisColor
    ];

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!browser) return;
      const thumb = captureThumb();
      if (!thumb) return;
      const config = {
        activeType, isPieVariant, labels: [...labels], values: values.map(v => [...v]),
        seriesNames: [...seriesNames], sliceColors: [...sliceColors],
        barSeriesColors: [...barSeriesColors], lineColors: [...lineColors],
        markerColors: [...markerColors], bgColor,
        smoothing, sliceGap, donutCutout, barRounding, barSpacing, barAspectRatio,
        barOrientation, barMode, lineTension, lineWidth, lineAspectRatio,
        markerStyle, markerSize, markerVisible,
        chartTitle, titleFont, titleAlign, titleBold, titleItalic, titleSize, titleLineHeight, titleColor,
        chartCaption, captionFont, captionAlign, captionBold, captionItalic, captionSize, captionLineHeight, captionColor,
        legendVisible, legendPosition, legendSize, legendColor,
        axisVisible, axisSize, axisBold, axisColor
      };
      currentArchiveId = chartArchive.save('chart', config, thumb, currentArchiveId);
    }, 800);

    return () => clearTimeout(saveTimer);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="editor-overlay">
  <div class="editor-panel">
    <!-- Header -->
    <div class="editor-header">
      <button class="back-btn" onclick={onclose} aria-label="Back">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M13 4l-6 6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="type-tabs">
        {#each typeTabs as tab}
          <button
            class="type-tab"
            class:active={activeType === tab.id || (tab.id === 'pie' && isPie)}
            onclick={() => switchType(tab.id)}
            title={tab.label}
          >
            <img src={tab.icon} alt={tab.label} class="type-tab-icon" />
          </button>
        {/each}
      </div>
      <div class="header-spacer"></div>
    </div>

    <!-- Chart preview -->
    <div class="chart-preview" style="background-color: {bgColor === 'white' ? '#FFFFFF' : bgColor === 'transparent' ? 'transparent' : bgColor};">
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
      <div class="canvas-container" class:pie-square={isPie} style="{isPie ? '' : 'height: ' + (isBar ? (240 * (100 / barAspectRatio)) : (240 * (100 / lineAspectRatio))) + 'px'}">
        {#if browser}
          <canvas bind:this={canvas}></canvas>
        {/if}
      </div>
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

    <!-- Pie/Donut Toggle -->
    {#if isPie}
      <div class="pie-donut-toggle">
        <button
          class="variant-btn"
          class:active={isPieVariant === 'pie'}
          onclick={() => { isPieVariant = 'pie'; updateChart(); }}
        >Pie Chart</button>
        <button
          class="variant-btn"
          class:active={isPieVariant === 'donut'}
          onclick={() => { isPieVariant = 'donut'; updateChart(); }}
        >Donut Chart</button>
      </div>
    {/if}

    <!-- Controls accordion -->
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
            {#if isPie}
              <!-- Pie: manual rows -->
              <div class="data-rows">
                {#each labels as label, i}
                  <div class="data-row">
                    <input
                       type="text"
                       class="label-input"
                       value=""
                       oninput={(e) => updateLabel(i, (e.target as HTMLInputElement).value)}
                       placeholder={label}
                     />
                    {#each values as series, si}
                       <input
                         type="number"
                         class="value-input"
                         value=""
                         oninput={(e) => updateValue(si, i, Number((e.target as HTMLInputElement).value) || 0)}
                         placeholder={String(series[i])}
                       />
                     {/each}
                    <button class="row-delete" onclick={() => removeRow(i)} title="Remove" aria-label="Remove row">
                      <img src="/icons/icon-trash.svg" alt="" width="14" height="14" />
                    </button>
                  </div>
                {/each}
              </div>
              <button class="add-row-btn" onclick={addRow} title="Add row" aria-label="Add row">
                <img src="/icons/icon-add.svg" alt="" width="32" height="32" />
              </button>
              <div class="csv-divider"><span>or paste CSV</span></div>
            {/if}

            <!-- CSV textarea (all types) -->
            <textarea
              class="csv-input"
              bind:value={csvText}
              placeholder={isPie ? 'Label,Value\nItem 1,25\nItem 2,35\nItem 3,20' : isBar ? 'Label,Value\nItem 1,25\nItem 2,35\nItem 3,20' : 'Label,Value\nItem 1,25\nItem 2,35\nItem 3,20'}
              rows={isPie ? 4 : 6}
            ></textarea>

            {#if isBar}
              <div class="bar-data-controls">
                <button class="ctrl-btn" class:active={barOrientation === 'vertical'} onclick={() => { barOrientation = 'vertical'; updateChart(); }} title="Vertical bars">
                  <img src="/icons/icon-vertical-bars.svg" alt="" width="16" height="16" />
                </button>
                <button class="ctrl-btn" class:active={barOrientation === 'horizontal'} onclick={() => { barOrientation = 'horizontal'; updateChart(); }} title="Horizontal bars">
                  <img src="/icons/icon-horizontal-bars.svg" alt="" width="16" height="16" />
                </button>
                <span class="controls-separator"></span>
                <button class="ctrl-btn" class:active={barMode === 'grouped'} disabled={!isMultiSeries} onclick={() => { barMode = 'grouped'; updateChart(); }} title="Grouped bars">
                  <img src="/icons/icon-grouped-bars.svg" alt="" width="16" height="16" />
                </button>
                <button class="ctrl-btn" class:active={barMode === 'stacked'} disabled={!isMultiSeries} onclick={() => { barMode = 'stacked'; updateChart(); }} title="Stacked bars">
                  <img src="/icons/icon-stacked-bars.svg" alt="" width="16" height="16" />
                </button>
              </div>
            {/if}

            <button class="apply-csv-btn secondary" onclick={applyCsv} disabled={!csvText.trim()}>
              Apply CSV Data
            </button>
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
            {#if isPie}
              <!-- Per-slice colors -->
              {#each labels as label, i}
                <div class="color-row">
                  <span class="color-label">{label}</span>
                  <input
                    type="color"
                    class="color-picker"
                    value={sliceColors[i] || defaultColors[i % defaultColors.length]}
                    oninput={(e) => { sliceColors[i] = (e.target as HTMLInputElement).value; sliceColors = [...sliceColors]; updateChart(); }}
                  />
                </div>
              {/each}
            {:else if isBar}
              <!-- Bar: Base Colour + per-bar overrides -->
              <div class="color-row base-color-row">
                <span class="color-label">Base Colour</span>
                <button
                  class="color-reset-btn"
                  onclick={() => { baseBarColor = defaultBarColor; barBarColors = {}; updateChart(); }}
                  title="Reset to default"
                  aria-label="Reset to default"
                >
                  <img src="/icons/icon-reset.svg" alt="" width="16" height="16" />
                </button>
                <input
                  type="color"
                  class="color-picker"
                  value={baseBarColor}
                  oninput={(e) => { baseBarColor = (e.target as HTMLInputElement).value; updateChart(); }}
                />
              </div>

              <!-- Per-bar colour overrides -->
              {#each labels as label, i}
                <div class="color-row bar-item-row">
                  <span class="color-label">{label}</span>
                  <button
                    class="color-reset-btn"
                    onclick={() => { delete barBarColors[i]; barBarColors = {...barBarColors}; updateChart(); }}
                    title="Reset to base colour"
                    aria-label="Reset to base colour"
                    disabled={!barBarColors[i]}
                  >
                    <img src="/icons/icon-reset.svg" alt="" width="16" height="16" />
                  </button>
                  <input
                    type="color"
                    class="color-picker"
                    value={barBarColors[i] || baseBarColor}
                    oninput={(e) => { barBarColors[i] = (e.target as HTMLInputElement).value; barBarColors = {...barBarColors}; updateChart(); }}
                  />
                </div>
              {/each}
            {:else if isLine}
              <!-- Line & marker colors -->
              {#each values as _, si}
                <div class="color-row">
                  <span class="color-label">Line {si + 1}</span>
                  <input
                    type="color"
                    class="color-picker"
                    value={lineColors[si] || lineColors[0]}
                    oninput={(e) => { lineColors[si] = (e.target as HTMLInputElement).value; lineColors = [...lineColors]; updateChart(); }}
                  />
                  <input
                    type="color"
                    class="color-picker"
                    value={markerColors[si] || markerColors[0]}
                    oninput={(e) => { markerColors[si] = (e.target as HTMLInputElement).value; markerColors = [...markerColors]; updateChart(); }}
                    title="Marker colour"
                  />
                </div>
              {/each}
            {/if}

            <!-- Background -->
            <div class="color-row bg-row">
              <span class="color-label">Background</span>
              <div class="bg-options">
                <button class="bg-option" class:active={bgColor === 'white'} onclick={() => { bgColor = 'white'; updateChart(); }} aria-label="White background">
                  <span class="bg-circle bg-white"></span>
                </button>
                <button class="bg-option" class:active={bgColor === 'transparent'} onclick={() => { bgColor = 'transparent'; updateChart(); }} aria-label="Transparent background">
                  <span class="bg-circle bg-transparent"></span>
                </button>
                <label class="bg-option" class:active={bgColor !== 'white' && bgColor !== 'transparent'} title="Custom background">
                  <span class="bg-circle bg-rainbow"></span>
                  <input
                    type="color"
                    class="visually-hidden"
                    value={bgColor === 'white' || bgColor === 'transparent' ? '#FFFFFF' : bgColor}
                    oninput={(e) => { bgColor = (e.target as HTMLInputElement).value; updateChart(); }}
                  />
                </label>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- ═══ STYLE & SIZE ═══ -->
      <div class="control-section" class:open={openSection === 'style'}>
        <button class="section-header" onclick={() => openSection = openSection === 'style' ? '' : 'style'}>
          Style & Size
          <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        {#if openSection === 'style'}
          <div class="section-body">
            {#if isPie}
              <!-- Pie/Donut style -->
              <div class="style-toggles">
                <button class="ctrl-btn" class:active={pieStyleControl === 'corner'} onclick={() => { pieStyleControl = 'corner'; }} title="Corner smoothing">
                  <img src="/icons/icon-corner-smoothing.svg" alt="" width="18" height="18" />
                </button>
                <button class="ctrl-btn" class:active={pieStyleControl === 'gap'} onclick={() => { pieStyleControl = 'gap'; }} title="Slice gap">
                   <img src="/icons/icon-horizontal-space.svg" alt="" width="18" height="18" />
                 </button>
                {#if isDonut}
                  <button class="ctrl-btn" class:active={pieStyleControl === 'hole'} onclick={() => { pieStyleControl = 'hole'; }} title="Donut hole size">
                    <img src="/icons/icon-donut-hole-size.svg" alt="" width="18" height="18" />
                  </button>
                {/if}
                <input
                  type="range"
                  class="style-slider"
                  min={getPieSliderMin()}
                  max={getPieSliderMax()}
                  value={getPieSliderValue()}
                  oninput={(e) => setPieSlider(Number((e.target as HTMLInputElement).value))}
                />
              </div>
            {:else if isBar}
              <!-- Bar style -->
              <div class="style-toggles">
                <button class="ctrl-btn" class:active={barStyleControl === 'corner'} onclick={() => { barStyleControl = 'corner'; }} title="Bar Rounding">
                  <img src="/icons/icon-corner-smoothing.svg" alt="" width="18" height="18" />
                </button>
                <button class="ctrl-btn" class:active={barStyleControl === 'gap'} onclick={() => { barStyleControl = 'gap'; }} title="Bar Spacing">
                   <img src="/icons/icon-horizontal-space.svg" alt="" width="18" height="18" />
                 </button>
                <button class="ctrl-btn" class:active={barStyleControl === 'resize'} onclick={() => { barStyleControl = 'resize'; }} title="Chart Size">
                  <img src="/icons/icon-chart-size.svg" alt="" width="18" height="18" />
                </button>
                <input
                  type="range"
                  class="style-slider"
                  min={getBarSliderMin()}
                  max={getBarSliderMax()}
                  value={getBarSliderValue()}
                  oninput={(e) => { setBarSlider(Number((e.target as HTMLInputElement).value)); }}
                />
              </div>
            {:else if isLine}
              <!-- Line style -->
              <div class="style-toggles">
                <button class="ctrl-btn" class:active={lineStyleControl === 'smoothing'} onclick={() => { lineStyleControl = 'smoothing'; }} title="Line Smoothing">
                  <img src="/icons/icon-line-smoothing.svg" alt="" width="18" height="18" />
                </button>
                <button class="ctrl-btn" class:active={lineStyleControl === 'linewidth'} onclick={() => { lineStyleControl = 'linewidth'; }} title="Line Width">
                  <img src="/icons/line-width.svg" alt="" width="18" height="18" />
                </button>
                <button class="ctrl-btn" class:active={lineStyleControl === 'resize'} onclick={() => { lineStyleControl = 'resize'; }} title="Chart Size">
                  <img src="/icons/icon-chart-size.svg" alt="" width="18" height="18" />
                </button>
                <input
                  type="range"
                  class="style-slider"
                  min={getLineSliderMin()}
                  max={getLineSliderMax()}
                  value={getLineSliderValue()}
                  oninput={(e) => { setLineSlider(Number((e.target as HTMLInputElement).value)); }}
                />
              </div>
              <!-- Marker controls -->
              <div class="style-divider"></div>
              <div class="style-toggles">
                <button class="ctrl-btn" class:active={markerStyle === 'circle'} onclick={() => { markerStyle = 'circle'; updateChart(); }} title="Circle markers">
                  <img src="/icons/icon-circle-markers.svg" alt="" width="18" height="18" />
                </button>
                <button class="ctrl-btn" class:active={markerStyle === 'rectRot'} onclick={() => { markerStyle = 'rectRot'; updateChart(); }} title="Diamond markers">
                  <img src="/icons/icon-diamond-markers.svg" alt="" width="18" height="18" />
                </button>
                <button class="ctrl-btn" class:active={markerStyle === 'rect'} onclick={() => { markerStyle = 'rect'; updateChart(); }} title="Square markers">
                  <img src="/icons/icon-square-markers.svg" alt="" width="18" height="18" />
                </button>
                <input
                  type="range"
                  class="style-slider"
                  min="0"
                  max="15"
                  value={markerSize}
                  disabled={!markerVisible}
                  oninput={(e) => { markerSize = Number((e.target as HTMLInputElement).value); updateChart(); }}
                />
                <button class="ctrl-btn" onclick={() => { markerVisible = !markerVisible; updateChart(); }} title="Toggle markers">
                  <img src={markerVisible ? '/icons/icon-visibility.svg' : '/icons/icon-no-visibility.svg'} alt="" width="18" height="18" />
                </button>
              </div>
            {/if}
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
                min={titleSizeControl === 'size' ? 12 : 16}
                max={titleSizeControl === 'size' ? 48 : 48}
                value={getTitleSliderValue()}
                oninput={(e) => { setTitleSlider(Number((e.target as HTMLInputElement).value)); }}
              />
            </div>
            <div class="color-row">
              <span class="color-label">Colour</span>
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

      <!-- ═══ CAPTION ═══ -->
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
                min={captionSizeControl === 'size' ? 12 : 12}
                max={captionSizeControl === 'size' ? 28 : 28}
                value={getCaptionSliderValue()}
                oninput={(e) => { setCaptionSlider(Number((e.target as HTMLInputElement).value)); }}
              />
            </div>
            <div class="color-row">
              <span class="color-label">Colour</span>
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
      {#if isPie || isMultiSeries}
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
                  oninput={(e) => { legendSize = Number((e.target as HTMLInputElement).value); updateChart(); }}
                />
                <button class="ctrl-btn" onclick={() => { legendVisible = !legendVisible; updateChart(); }} title="Show/hide legend">
                  <img src={legendVisible ? '/icons/icon-visibility.svg' : '/icons/icon-no-visibility.svg'} alt="" width="16" height="16" />
                </button>
                <input
                  type="color"
                  class="color-picker"
                  value={legendColor}
                  oninput={(e) => { legendColor = (e.target as HTMLInputElement).value; updateChart(); }}
                />
              </div>
              <div class="legend-position-row">
                <button class="legend-position-btn" class:active={legendPosition === 'bottom'} onclick={() => { legendPosition = 'bottom'; updateChart(); }} title="Legend below">
                  <img src="/icons/icon-align-bottom.svg" alt="" width="16" height="16" />
                  <span>Legend below</span>
                </button>
                <button class="legend-position-btn" class:active={legendPosition === 'top'} onclick={() => { legendPosition = 'top'; updateChart(); }} title="Legend above">
                  <img src="/icons/icon-align-top.svg" alt="" width="16" height="16" />
                  <span>Legend above</span>
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- ═══ AXES (Bar & Line) ═══ -->
      {#if isBar || isLine}
        <div class="control-section" class:open={openSection === 'axes'}>
          <button class="section-header" onclick={() => openSection = openSection === 'axes' ? '' : 'axes'}>
            Axes
            <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          {#if openSection === 'axes'}
            <div class="section-body">
              <div class="text-control-row">
                <img src="/icons/icon-font-size.svg" alt="" width="16" height="16" class="ctrl-icon" />
                <input
                  type="range"
                  class="style-slider"
                  min="10"
                  max="18"
                  value={axisSize}
                  oninput={(e) => { axisSize = Number((e.target as HTMLInputElement).value); updateChart(); }}
                />
                <button class="ctrl-btn" class:active={axisBold} onclick={() => { axisBold = !axisBold; updateChart(); }} title="Bold">
                  <img src="/icons/icon-bold.svg" alt="" width="16" height="16" />
                </button>
                <button class="ctrl-btn" onclick={() => { axisVisible = !axisVisible; updateChart(); }} title="Show/hide axes">
                  <img src={axisVisible ? '/icons/icon-visibility.svg' : '/icons/icon-no-visibility.svg'} alt="" width="16" height="16" />
                </button>
                <input
                  type="color"
                  class="color-picker"
                  value={axisColor}
                  oninput={(e) => { axisColor = (e.target as HTMLInputElement).value; updateChart(); }}
                />
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Download -->
      <div class="download-section">
        <button class="download-btn primary" onclick={downloadChart}>
          <img src="/icons/icon-download.svg" alt="" width="18" height="18" />
          Download
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body.dark) {
    --color-primary: #7c5cff;
    --color-border: #444;
    --text-dark: #e0e0e0;
    --white: #1a1a1a;
  }

  .editor-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
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
    cursor: pointer;
    color: var(--text-dark);
    flex-shrink: 0;
  }

  .type-tabs {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
    flex: 1;
  }

  .type-tab {
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .type-tab.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }

  .type-tab-icon {
    width: 18px;
    height: 18px;
  }

  .type-tab.active .type-tab-icon {
    filter: brightness(0) invert(1);
  }

  .header-spacer {
    width: 36px;
    flex-shrink: 0;
  }

  .chart-preview {
    margin: 0.75rem 1rem 0;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .preview-title {
    margin-bottom: 0.5rem;
    word-wrap: break-word;
    white-space: pre-line;
  }

  .preview-caption {
    margin-top: 0.375rem;
    margin-bottom: 0;
    word-wrap: break-word;
    white-space: pre-line;
  }

  .canvas-container {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  .canvas-container.pie-square {
    aspect-ratio: 1;
  }

  canvas {
    width: 100% !important;
    height: 100% !important;
  }

  .pie-donut-toggle {
    display: flex;
    gap: 0;
    margin: 0.75rem 1rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .variant-btn {
    flex: 1;
    padding: 0.5rem;
    background: none;
    border: none;
    border-radius: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-medium);
    cursor: pointer;
    min-height: 40px;
    transition: all var(--duration-fast) ease;
  }

  .variant-btn.active {
    background: var(--color-primary);
    color: var(--white);
  }

  .controls {
    padding: 0.75rem 1rem 1rem;
  }

  .control-section {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    margin-bottom: 0.5rem;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.75rem 1rem;
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    cursor: pointer;
    min-height: 44px;
    background: none;
    border: none;
    border-radius: var(--radius-lg);
    color: var(--text-dark);
    text-align: left;
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

  /* Data rows */
  .data-rows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .data-row {
    display: flex;
    gap: 0.375rem;
  }

  .label-input,
  .value-input {
    flex: 1;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    background: var(--white);
  }

  .label-input::placeholder,
  .value-input::placeholder {
    color: #999999;
    opacity: 1;
  }

  .value-input {
    flex: 0.75;
  }

  .row-delete {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    opacity: 0.4;
  }

  .row-delete:hover {
    opacity: 1;
  }

  .add-row-btn {
    align-self: center;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
  }

  .csv-input {
    width: 100%;
    padding: 0.625rem 0.625rem 1rem 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    background: var(--white);
    resize: vertical;
  }

  .csv-input::placeholder {
    font-size: var(--font-size-base);
    color: #999999;
    opacity: 1;
  }

  .csv-divider {
    text-align: center;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-dark);
    margin: 0.5rem 0;
    position: relative;
  }

  .csv-divider span {
    background: var(--white);
    padding: 0 0.5rem;
    position: relative;
    z-index: 1;
  }

  .csv-divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--color-border);
    z-index: 0;
  }

  .apply-csv-btn {
    width: 100%;
    font-size: var(--font-size-sm);
  }

  /* Bar data controls */
  .bar-data-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .controls-separator {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    margin: 0 0.25rem;
  }

  /* ─── Shared control button ─── */
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

  .ctrl-icon {
    width: 16px;
    height: 16px;
    filter: brightness(0) saturate(100%);
    flex-shrink: 0;
  }

  /* ─── Style toggles row ─── */
  .style-toggles {
    display: flex;
    align-items: center;
    gap: 0.375rem;
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

  .style-slider:focus {
    outline: none;
    box-shadow: none;
  }

  .style-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--color-primary);
    cursor: pointer;
    border-radius: var(--radius-round);
    border: none;
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

  .color-picker:hover {
    border-color: var(--color-primary);
  }

  .style-divider {
    border-top: 1px solid var(--color-border);
    margin: 0.25rem 0;
  }

  /* ─── Colour rows ─── */
  .color-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border);
  }

  .color-row.base-color-row {
    font-weight: var(--font-weight-semibold);
    padding-bottom: 0.75rem;
    margin-bottom: 0;
  }

  .color-label {
    font-size: var(--font-size-sm);
    color: var(--text-dark);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .color-reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
    min-height: 28px;
    min-width: 28px;
    color: var(--text-medium);
  }

  .color-reset-btn:hover:not(:disabled) {
    color: var(--color-primary);
  }

  .color-reset-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .bg-row {
    padding-bottom: 0;
    border-bottom: none;
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

  /* ─── Text control rows (Title, Caption, Legend) ─── */
  .text-control-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .font-select {
    flex: 1;
    font-size: var(--font-size-sm);
    padding: 0 1.5rem 0 0.5rem;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--white);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%23888888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 16px 16px;
  }

  .title-input,
  .caption-input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--white);
    font-size: var(--font-size-sm);
    font-family: inherit;
    resize: none;
    overflow: hidden;
    white-space: pre-line;
  }

  .title-input::placeholder,
  .caption-input::placeholder {
    color: #999999;
    opacity: 1;
  }

  /* Download */
  .download-section {
    margin-top: 0.5rem;
  }

  .download-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .download-btn img {
    filter: brightness(0) invert(1);
  }

  /* Slider in control rows */
  .text-control-row input[type="range"] {
    flex: 1;
    accent-color: var(--color-primary);
    min-height: auto;
    padding: 0;
    border: none;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    outline: none;
  }

  .text-control-row input[type="range"]:focus {
    outline: none;
    box-shadow: none;
  }

  .text-control-row input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--color-primary);
    cursor: pointer;
    border-radius: var(--radius-round);
    border: none;
  }
</style>
