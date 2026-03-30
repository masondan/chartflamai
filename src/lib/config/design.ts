export const DESIGN_TOKENS = {
  colors: {
    primary: '#5422b0',
    primaryLight: 'rgba(84, 34, 176, 0.1)',
    primaryHover: '#4319a0',
    highlight: '#f0e6f7',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    bgLight: '#eeeeee',
    bgMedium: '#cccccc',
    bgSurface: '#f8f8f8',
    textDark: '#1f1f1f',
    textMedium: '#888888',
    textSecondary: '#777777',
    border: '#e0e0e0',
    borderActive: '#999999',
    white: '#FFFFFF',
    black: '#000000'
  },

  chartColors: [
    '#6A5ACD',
    '#FFDAB9',
    '#66C0B4',
    '#E6E6FA',
    '#DDA0DD',
    '#ADD8E6',
    '#FAEBD7',
    '#C0C0C0'
  ],

  chartTypes: ['pie', 'doughnut', 'line', 'bar', 'horizontalBar', 'stackedBar'] as const
} as const;

export type ChartType = (typeof DESIGN_TOKENS.chartTypes)[number];
