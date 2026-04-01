<script lang="ts">
  import ChartDisplay from './ChartDisplay.svelte';
  import ChartTypeBar from './ChartTypeBar.svelte';
  import ChartEditor from './ChartEditor.svelte';
  import PictogramEditor from './PictogramEditor.svelte';
  import WaffleChartEditor from './WaffleChartEditor.svelte';
  import type { ChartType } from '$lib/config/design';
  import type { AngleData } from '$lib/stores/aiState.svelte';
  import { DESIGN_TOKENS } from '$lib/config/design';

  let csvData = $state('');
  let dataOpen = $state(true);
  let chartData = $state<AngleData | null>(null);
  let selectedChartType = $state<ChartType>('bar');
  let parseError = $state('');

  // Chart editor state
  let editorOpen = $state(false);
  let editorChartType = $state<ChartType>('bar');
  let editorCsvData = $state('');

  // Pictogram editor state
  let pictogramOpen = $state(false);

  // Waffle chart editor state
  let waffleOpen = $state(false);

  const chartStarters: Array<{ type: ChartType; label: string; icon: string }> = [
    { type: 'pie', label: 'Pie', icon: '/icons/icon-pie-chart.svg' },
    { type: 'bar', label: 'Bar', icon: '/icons/icon-vertical-bars.svg' },
    { type: 'line', label: 'Line', icon: '/icons/icon-line-chart.svg' },
    { type: 'pie', label: 'Pictogram', icon: '/icons/icon-pictogram.svg' },
    { type: 'pie', label: 'Waffle', icon: '/icons/icon-waffle.svg' }
  ];

  function parseCSV(raw: string): { labels: string[]; values: number[][]; seriesNames: string[] } | null {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const labels: string[] = [];
    const columns: number[][] = [];
    let seriesNames: string[] = [];

    const firstRow = lines[0].split(',').map(c => c.trim());
    const hasHeader = firstRow.length > 1 && isNaN(Number(firstRow[1]));

    const startIdx = hasHeader ? 1 : 0;
    if (hasHeader && firstRow.length > 1) {
      seriesNames = firstRow.slice(1);
    }

    for (let i = startIdx; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim());
      if (cells.length < 2) continue;

      labels.push(cells[0]);
      const nums = cells.slice(1).map(c => {
        const n = Number(c);
        return isNaN(n) ? 0 : n;
      });

      while (columns.length < nums.length) columns.push([]);
      nums.forEach((n, ci) => columns[ci].push(n));
    }

    if (labels.length === 0 || columns.length === 0) return null;

    if (seriesNames.length === 0) {
      seriesNames = columns.length === 1 ? ['Value'] : columns.map((_, i) => `Series ${i + 1}`);
    }

    return { labels, values: columns, seriesNames };
  }

  function handleChartIt() {
    parseError = '';
    const parsed = parseCSV(csvData);
    if (!parsed) {
      parseError = 'Could not parse CSV data. Use format: Label,Value (one per line)';
      return;
    }

    const datasets = parsed.values.map((vals, i) => ({
      label: parsed.seriesNames[i],
      data: vals,
      borderColor: DESIGN_TOKENS.chartColors[i % DESIGN_TOKENS.chartColors.length],
      backgroundColor: DESIGN_TOKENS.chartColors[i % DESIGN_TOKENS.chartColors.length]
    }));

    chartData = {
      id: 'classic_chart',
      headline: '',
      summary: '',
      suggestedChartType: 'bar',
      compatibleChartTypes: [...DESIGN_TOKENS.chartTypes],
      reasoning: '',
      sources: [],
      keyFinding: '',
      explain: '',
      data: { labels: parsed.labels, datasets }
    };

    selectedChartType = 'bar';
    dataOpen = false;
  }

  function handleChartTypeChange(type: ChartType) {
    selectedChartType = type;
  }

  function openEditor(type: ChartType, csv: string = '') {
    editorChartType = type;
    editorCsvData = csv;
    editorOpen = true;
  }

  function handleEditClick() {
    openEditor(selectedChartType, csvData);
  }

  function handleStartWithChart(starter: typeof chartStarters[number]) {
    if (starter.label === 'Pictogram') {
      pictogramOpen = true;
      return;
    }
    if (starter.label === 'Waffle') {
      waffleOpen = true;
      return;
    }
    openEditor(starter.type);
  }

  function closeEditor() {
    editorOpen = false;
  }
</script>

<div class="classic-tab">
  <!-- CSV data input -->
  <div class="data-card card" class:collapsed={!dataOpen} class:active-border={dataOpen}>
    <button class="accordion-header" class:open={dataOpen} onclick={() => dataOpen = !dataOpen} aria-expanded={dataOpen}>
      <span class="accordion-title">CSV data</span>
      <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    {#if dataOpen}
      <div class="data-body">
        <textarea
           bind:value={csvData}
           placeholder={"Label,Value\nItem 1,25\nItem 2,35\nItem 3,20"}
           rows="4"
         ></textarea>

        <button
          class="submit-btn primary"
          onclick={handleChartIt}
          disabled={!csvData.trim()}
        >
          Chart it
        </button>
      </div>
    {/if}
  </div>

  {#if parseError}
    <div class="error-card card">
      <p class="error-message">{parseError}</p>
    </div>
  {/if}

  <!-- Chart preview (after CSV) -->
  {#if chartData}
    <div class="chart-card card active-border">
      <div class="chart-card-header">
        <span class="chart-card-title">Chart</span>
        <ChartTypeBar
          compatibleTypes={chartData.compatibleChartTypes}
          selectedType={selectedChartType}
          onselect={handleChartTypeChange}
        />
      </div>

      <ChartDisplay
        angle={chartData}
        chartType={selectedChartType}
        height={240}
      />

      <div class="chart-actions">
        <button class="edit-btn" title="Edit chart" aria-label="Edit chart" onclick={handleEditClick}>
          <img src="/icons/icon-edit-fill.svg" alt="" width="18" height="18" />
        </button>
      </div>
    </div>
  {/if}

  <!-- Start with a chart -->
  <div class="chart-starters">
    <div class="divider">
      <span class="divider-text">or start with a chart</span>
    </div>
    <div class="starter-grid">
      {#each chartStarters as starter}
        <button
          class="starter-btn"
          onclick={() => handleStartWithChart(starter)}
          title={starter.label}
        >
          <img src={starter.icon} alt={starter.label} class="starter-icon" />
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- Full-page chart editor -->
{#if editorOpen}
  <ChartEditor
    chartType={editorChartType}
    initialCsv={editorCsvData}
    onclose={closeEditor}
  />
{/if}

<!-- Full-page pictogram editor -->
{#if pictogramOpen}
  <PictogramEditor onclose={() => pictogramOpen = false} />
{/if}

<!-- Full-page waffle chart editor -->
{#if waffleOpen}
  <WaffleChartEditor onclose={() => waffleOpen = false} />
{/if}

<style>
  .classic-tab {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .data-card {
    padding: 0;
  }

  .data-card.collapsed {
    border-color: var(--color-border);
  }

  .data-card.active-border,
  .chart-card.active-border {
    border-color: var(--color-primary);
  }

  .accordion-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.875rem 1rem;
    background: none;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    min-height: 44px;
  }

  .accordion-title {
    font-weight: var(--font-weight-semibold);
    color: var(--text-dark);
  }

  .chevron {
    transition: transform var(--duration-fast) ease;
    color: var(--text-medium);
  }

  .accordion-header.open .chevron {
    transform: rotate(180deg);
  }

  .data-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0 var(--spacing-lg) var(--spacing-lg);
  }

  textarea {
    resize: vertical;
    min-height: 120px;
    font-family: 'Inter', monospace;
    font-size: var(--font-size-sm);
    line-height: var(--line-height-normal);
  }

  .submit-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
  }

  .chart-card {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chart-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .chart-card-title {
    font-weight: var(--font-weight-semibold);
    color: var(--text-dark);
  }

  .chart-actions {
    display: flex;
    justify-content: flex-end;
  }

  .edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: 1.5px solid var(--color-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: 36px;
    min-width: 36px;
  }

  .edit-btn:hover {
    background: var(--color-highlight);
  }

  /* Chart starters */
  .chart-starters {
    margin-top: 0.25rem;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  .divider-text {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-dark);
    white-space: nowrap;
  }

  .starter-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem;
  }

  .starter-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    padding: 0.5rem;
    background: var(--white);
    border: 1.5px solid var(--color-primary);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: auto;
    min-width: auto;
  }

  .starter-btn:hover {
    background: var(--color-highlight);
    box-shadow: var(--shadow-md);
  }

  .starter-icon {
    width: 48px;
    height: 48px;
    filter: brightness(0) saturate(100%) invert(15%) sepia(80%) saturate(4000%) hue-rotate(260deg);
  }

  .error-card { border-color: var(--color-error); text-align: center; }
  .error-message { color: var(--color-error); font-weight: var(--font-weight-medium); margin: 0; }
</style>
