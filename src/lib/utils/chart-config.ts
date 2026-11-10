/**
 * Shared Chart.js configuration builder for bar charts.
 * Single source of truth — used by both ChartEditor (live preview) and
 * animation renderers (video export). Prevents drift between editor output
 * and animation final frame.
 */

import type { ChartConfiguration } from 'chart.js/auto';
import { DESIGN_TOKENS } from '$lib/config/design';

export interface BarChartConfigParams {
  // Chart type
  activeType: 'pie' | 'bar' | 'stackedBar' | 'groupedBar' | 'line';
  isPieVariant: 'pie' | 'donut';

  // Data
  labels: string[];
  values: number[][];
  seriesNames: string[];

  // Pie/Donut styling
  sliceColors: string[];
  sliceGap: number;
  donutCutout: number;
  smoothing: number;

  // Bar styling
  barRounding: number;
  barSpacing: number;
  barAspectRatio: number;
  barOrientation: 'vertical' | 'horizontal';
  barMode: 'grouped' | 'stacked';
  baseBarColor: string;
  barBarColors: Record<number, string | null>;

  // Line styling
  lineTension: number;
  lineWidth: number;
  lineAspectRatio: number;
  markerStyle: 'circle' | 'rectRot' | 'rect';
  markerSize: number;
  markerVisible: boolean;
  lineColors: string[];
  markerColors: string[];

  // Text & appearance
  chartTitle: string;
  chartCaption: string;
  bgColor: 'white' | 'transparent' | string;
  legendVisible: boolean;
  legendPosition: 'bottom' | 'top';
  legendSize: number;
  legendColor: string;
  axisVisible: boolean;
  axisSize: number;
  axisBold: boolean;
  axisColor: string;
}

export function buildChartConfig(params: BarChartConfigParams): ChartConfiguration {
  const isPie = params.activeType === 'pie';
  const isLine = params.activeType === 'line';
  const isBar = params.activeType === 'bar' || params.activeType === 'stackedBar' || params.activeType === 'groupedBar';
  const isDonut = isPie && params.isPieVariant === 'donut';
  const isMultiSeries = params.values.length > 1;

  const datasets: any[] = params.values.map((vals, i) => {
    const ds: any = { label: params.seriesNames[i] || `Series ${i + 1}`, data: [...vals] };

    if (isPie) {
      ds.backgroundColor = vals.map((_: number, j: number) =>
        params.sliceColors[j % params.sliceColors.length]
      );
      ds.borderColor = params.bgColor === 'transparent' ? 'transparent' : (params.bgColor === 'white' ? '#FFFFFF' : params.bgColor);
      ds.borderWidth = params.sliceGap;
    } else if (isLine) {
      const color = params.lineColors[i % params.lineColors.length];
      ds.borderColor = color;
      ds.backgroundColor = 'transparent';
      ds.fill = false;
      ds.tension = params.lineTension / 10;
      ds.borderWidth = params.lineWidth;
      ds.pointRadius = params.markerVisible ? params.markerSize : 0;
      ds.pointHoverRadius = params.markerVisible ? params.markerSize + 2 : 0;
      ds.pointBackgroundColor = params.markerColors[i % params.markerColors.length];
      ds.pointBorderColor = params.markerColors[i % params.markerColors.length];
      ds.pointStyle = params.markerStyle;
    } else {
      // Bar: apply per-bar colors or base color
      ds.backgroundColor = vals.map((_: number, labelIdx: number) =>
        params.barBarColors[labelIdx] || params.baseBarColor
      );
      ds.borderColor = vals.map((_: number, labelIdx: number) =>
        params.barBarColors[labelIdx] || params.baseBarColor
      );
      ds.borderWidth = 0;
      ds.borderRadius = params.barRounding;
      ds.categoryPercentage = params.barSpacing / 100;
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
        display: params.legendVisible && (isPie || isMultiSeries),
        position: params.legendPosition,
        labels: {
          font: { family: "'Inter', sans-serif", size: params.legendSize, weight: '500' },
          padding: 15,
          usePointStyle: true,
          pointStyle: isLine ? 'circle' : 'rect',
          color: params.legendColor,
          ...(isLine && {
            generateLabels(chart: any) {
              const { data } = chart;
              return data.datasets.map((dataset: any, i: number) => ({
                text: dataset.label || '',
                fillStyle: dataset.borderColor || 'rgba(0,0,0,0.1)',
                strokeStyle: dataset.borderColor || 'rgba(0,0,0,0.1)',
                lineWidth: 0,
                hidden: !chart.isDatasetVisible(i),
                index: i,
                pointStyle: 'circle'
              }));
            }
          })
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
    options.elements = { arc: { borderRadius: params.smoothing } };
    if (isDonut) {
      options.cutout = `${params.donutCutout}%`;
    }
  }

  if (isBar) {
    options.indexAxis = params.barOrientation === 'vertical' ? 'x' : 'y';
    options.aspectRatio = params.barAspectRatio / 100;
    const axisOpts = {
      display: params.axisVisible,
      grid: { display: false },
      ticks: {
        color: params.axisColor,
        font: { family: "'Inter', sans-serif", size: params.axisSize, weight: params.axisBold ? 'bold' as const : 'normal' as const }
      },
      border: { display: false }
    };
    const isStacked = isMultiSeries && params.barMode === 'stacked';
    options.scales = {
      x: { ...axisOpts, stacked: isStacked },
      y: { ...axisOpts, stacked: isStacked, grid: { display: true, color: 'rgba(0,0,0,0.05)' } }
    };
  }

  if (isLine) {
    options.aspectRatio = params.lineAspectRatio / 100;
    const axisOpts = {
      display: params.axisVisible,
      ticks: {
        color: params.axisColor,
        font: { family: "'Inter', sans-serif", size: params.axisSize, weight: params.axisBold ? 'bold' as const : 'normal' as const }
      },
      border: { display: false }
    };
    options.scales = {
      x: { ...axisOpts, grid: { display: false } },
      y: { ...axisOpts, grid: { display: true, color: '#e0e0e0' }, beginAtZero: true }
    };
  }

  function getChartJsType(): string {
    if (isPie) return isDonut ? 'doughnut' : 'pie';
    if (params.activeType === 'stackedBar' || params.activeType === 'groupedBar') return 'bar';
    return params.activeType;
  }

  return {
    type: getChartJsType() as any,
    data: { labels: [...params.labels], datasets },
    options
  };
}
