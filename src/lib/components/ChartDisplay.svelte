<script lang="ts">
  import { onMount } from 'svelte';
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
  let chart: any;

  function getChartJsType(type: ChartType): string {
    switch (type) {
      case 'horizontalBar': return 'bar';
      case 'stackedBar': return 'bar';
      case 'doughnut': return 'doughnut';
      default: return type;
    }
  }

  function getChartJsOptions(type: ChartType): Record<string, unknown> {
    const base: Record<string, unknown> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: {
            font: { family: "'Inter', sans-serif", size: 11 },
            padding: 12
          }
        }
      }
    };

    if (type === 'horizontalBar') {
      (base as any).indexAxis = 'y';
    }

    if (type === 'stackedBar') {
      (base as any).scales = {
        x: { stacked: true },
        y: { stacked: true }
      };
    }

    return base;
  }

  function applyColors(datasets: AngleData['data']['datasets']): AngleData['data']['datasets'] {
    return datasets.map((ds, i) => ({
      ...ds,
      borderColor: ds.borderColor || DESIGN_TOKENS.chartColors[i % DESIGN_TOKENS.chartColors.length],
      backgroundColor: ds.backgroundColor || DESIGN_TOKENS.chartColors[i % DESIGN_TOKENS.chartColors.length]
    }));
  }

  async function renderChart() {
    if (!browser || !canvas) return;

    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    if (chart) {
      chart.destroy();
    }

    // Deep-clone data to strip Svelte 5 $state proxies — Chart.js uses
    // Object.defineProperty internally which conflicts with reactive proxies.
    const plainData = JSON.parse(JSON.stringify({
      labels: angle.data.labels,
      datasets: applyColors(angle.data.datasets)
    }));

    chart = new Chart(canvas, {
      type: getChartJsType(chartType) as any,
      data: plainData,
      options: getChartJsOptions(chartType) as any
    });
  }

  onMount(() => {
    renderChart();
    return () => { if (chart) chart.destroy(); };
  });

  $effect(() => {
    // Re-render when chartType or angle changes
    const _type = chartType;
    const _data = angle.data;
    if (chart) renderChart();
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
    background: var(--bg-surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    overflow: hidden;
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
