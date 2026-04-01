<script lang="ts">
  import { aiState } from '$lib/stores/aiState.svelte';
  import { uiState } from '$lib/stores/uiState.svelte';
  import ChartDisplay from './ChartDisplay.svelte';
  import ChartEditor from './ChartEditor.svelte';
  import ChartTypeBar from './ChartTypeBar.svelte';
  import type { AngleData } from '$lib/stores/aiState.svelte';
  import type { ChartType } from '$lib/config/design';

  interface Props {
    angle: AngleData;
    storyNumber?: number;
  }

  let { angle, storyNumber = 1 }: Props = $props();

  let isExpanded = $derived(uiState.value.expandedAngleId === angle.id);
  let currentChartType = $derived(
    (aiState.value.angleChartTypes[angle.id] as ChartType) || angle.suggestedChartType
  );

  let editorOpen = $state(false);

  function getAngleCsv(): string {
    const { labels, datasets } = angle.data;
    if (datasets.length === 1) {
      return labels.map((l, i) => `${l},${datasets[0].data[i]}`).join('\n');
    }
    const header = ['Label', ...datasets.map(d => d.label)].join(',');
    const rows = labels.map((l, i) => [l, ...datasets.map(d => d.data[i])].join(','));
    return [header, ...rows].join('\n');
  }

  function handleChartTypeChange(type: ChartType) {
    aiState.setAngleChartType(angle.id, type);
  }
</script>

<div class="angle-card" class:expanded={isExpanded}>
  <button
    class="angle-header"
    onclick={() => uiState.toggleAngle(angle.id)}
    aria-expanded={isExpanded}
  >
    <div class="angle-header-content">
      <span class="story-label">Story {storyNumber}</span>
      <span class="angle-headline">{angle.headline}</span>
    </div>
    <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  {#if isExpanded}
    <div class="angle-body">
      <p class="angle-summary">{angle.summary}</p>

      <ChartTypeBar
        compatibleTypes={angle.compatibleChartTypes}
        selectedType={currentChartType}
        onselect={handleChartTypeChange}
      />

      <ChartDisplay
        {angle}
        chartType={currentChartType}
        height={200}
      />

      <div class="angle-actions">
        <button class="action-btn" onclick={() => uiState.openDrawer('sources', angle.id)}>
          Sources
        </button>
        <button class="action-btn" onclick={() => uiState.openDrawer('data', angle.id)}>
          Data
        </button>
        <button class="action-btn" onclick={() => uiState.openDrawer('explain', angle.id)}>
          Explain
        </button>
        <button class="edit-btn" title="Edit chart" aria-label="Edit chart" onclick={() => editorOpen = true}>
          <img src="/icons/icon-edit-fill.svg" alt="" width="18" height="18" />
        </button>
      </div>
    </div>
  {/if}
</div>

{#if editorOpen}
  <ChartEditor
    chartType={currentChartType}
    initialCsv={getAngleCsv()}
    onclose={() => editorOpen = false}
  />
{/if}

<style>
  .angle-card {
    background: var(--white);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: border-color var(--duration-normal) ease, opacity var(--duration-normal) ease;
    animation: fadeIn var(--duration-normal) ease-out;
  }

  .angle-card.expanded {
    border-color: var(--color-primary);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .angle-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    min-height: 44px;
  }

  .angle-header-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .story-label {
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-base);
    color: var(--color-primary);
  }

  .angle-headline {
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    color: var(--text-dark);
    line-height: var(--line-height-tight);
    flex: 1;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform var(--duration-fast) ease;
    color: var(--text-medium);
  }

  .expanded .chevron {
    transform: rotate(180deg);
  }

  .angle-body {
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    animation: slideUpFade var(--duration-normal) ease-out;
  }

  .angle-summary {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: var(--line-height-normal);
  }

  .angle-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-btn {
    padding: 0.375rem 0.75rem;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    background: var(--white);
    border: 1.5px solid var(--color-primary);
    border-radius: var(--radius-md);
    color: var(--color-primary);
    cursor: pointer;
    min-height: 32px;
    min-width: auto;
    transition: all var(--duration-fast) ease;
  }

  .action-btn:hover {
    background: var(--color-highlight);
  }

  .edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    margin-left: auto;
    background: var(--white);
    border: 1.5px solid var(--color-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: 32px;
    min-width: 32px;
  }

  .edit-btn:hover {
    background: var(--color-highlight);
  }

  @keyframes slideUpFade {
    from { 
      transform: translateY(0.25rem); 
      opacity: 0; 
    }
    to { 
      transform: translateY(0); 
      opacity: 1; 
    }
  }
</style>
