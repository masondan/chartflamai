<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import type { ChartType } from '$lib/config/design';
  import type { AngleData } from '$lib/stores/aiState.svelte';
  import { DESIGN_TOKENS } from '$lib/config/design';

  interface Props {
    angle: AngleData;
    chartType: ChartType;
    height?: number;
  }

  let { angle, chartType, height = 200 }: Props = $props();

  let canvas = $state<HTMLCanvasElement>();
  let chartInstance: any = null;
  let ChartJs: any = null;

  function normalizeChartType(type: string): ChartType {
    const t = type.replace(/[\s_-]+/g, '').toLowerCase();
    if (t === 'stackedbar') return 'stackedBar';
    if (t === 'groupedbar') return 'groupedBar';
    if (t === 'horizontalbar') return 'bar';
    if (t === 'doughnut' || t === 'donut') return 'pie';
    if (['pie', 'bar', 'line'].includes(t)) return t as ChartType;
    return 'bar';
  }

  function getChartJsType(type: ChartType): string {
    switch (type) {
      case 'stackedBar': return 'bar';
      case 'groupedBar': return 'bar';
      default: return type;
    }
  }

  const isPieType = (type: ChartType) => type === 'pie';

  function getChartJsOptions(type: ChartType): Record<string, any> {
    const base: Record<string, any> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      layout: { padding: { top: 8, bottom: 4, left: 4, right: 4 } },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
            padding: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            pointStyleWidth: 8,
            boxWidth: 8,
            color: '#555'
          }
        },
        tooltip: {
          backgroundColor: '#1f1f1f',
          titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
          bodyFont: { family: "'Inter', sans-serif", size: 11 },
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 4
        }
      }
    };

    if (!isPieType(type)) {
      base.scales = {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "'Inter', sans-serif", size: 10 },
            color: '#888',
            maxRotation: 45
          },
          border: { display: false }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
          ticks: {
            font: { family: "'Inter', sans-serif", size: 10 },
            color: '#888'
          },
          border: { display: false }
        }
      };
    }

    if (type === 'stackedBar') {
      base.scales.x.stacked = true;
      base.scales.y.stacked = true;
    }

    if (type === 'line') {
      base.elements = {
        line: { tension: 0.3, borderWidth: 2.5 },
        point: { radius: 3, hoverRadius: 5, borderWidth: 2, backgroundColor: '#fff' }
      };
    }

    if (type === 'bar' || type === 'groupedBar' || type === 'stackedBar') {
      base.elements = {
        bar: { borderRadius: 4, borderSkipped: false }
      };
    }

    return base;
  }

  function applyColors(datasets: AngleData['data']['datasets'], type: ChartType) {
    const colors = DESIGN_TOKENS.chartColors;
    return datasets.map((ds, i) => {
      const color = colors[i % colors.length];
      const result: Record<string, any> = { ...ds };

      if (isPieType(type)) {
        // Pie/donut: each slice gets a different colour
        result.backgroundColor = ds.data.map((_: number, j: number) => colors[j % colors.length]);
        result.borderColor = '#fff';
        result.borderWidth = 2;
      } else if (type === 'line') {
        result.borderColor = color;
        result.backgroundColor = color + '18';
        result.fill = true;
        result.pointBackgroundColor = '#fff';
        result.pointBorderColor = color;
      } else {
        // Bar types
        result.backgroundColor = color + 'CC';
        result.borderColor = color;
        result.borderWidth = 0;
      }
      return result;
    });
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

    const safeType = normalizeChartType(chartType);

    // Deep-clone to strip Svelte 5 $state proxies
    const plainData = JSON.parse(JSON.stringify({
      labels: angle.data.labels,
      datasets: applyColors(angle.data.datasets, safeType)
    }));

    chartInstance = new ChartJs(canvas, {
      type: getChartJsType(safeType),
      data: plainData,
      options: getChartJsOptions(safeType)
    });
  }

  onMount(() => {
    renderChart();
    return () => { if (chartInstance) chartInstance.destroy(); };
  });

  let prevType = '';
  $effect(() => {
    const currentType = chartType;
    if (prevType && currentType !== prevType) {
      tick().then(() => renderChart());
    }
    prevType = currentType;
  });
</script>

<div class="chart-container" style="height: {height}px">
  {#if browser}
    <canvas bind:this={canvas}></canvas>
  {:else}
    <div class="chart-placeholder">
      <span class="spinner"></span>
    </div>
  {/if}
</div>

<style>
  .chart-container {
    position: relative;
    width: 100%;
    background: var(--white);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    overflow: hidden;
    padding: 0.5rem;
  }

  canvas {
    width: 100% !important;
    height: 100% !important;
  }

  .chart-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
</style>
