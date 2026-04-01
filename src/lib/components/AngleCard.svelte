<script lang="ts">
  import { aiState } from '$lib/stores/aiState.svelte';
  import { uiState } from '$lib/stores/uiState.svelte';
  import { chartArchive } from '$lib/stores/chartArchive.svelte';
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
  let isArchived = $derived(chartArchive.isStoryArchived(angle.id));

  let editorOpen = $state(false);

  function handleToggleAngle() {
    uiState.toggleAngle(angle.id);
  }

  function handleToggleArchive(e: MouseEvent) {
    e.stopPropagation();
    if (isArchived) {
      // Remove from archive
      const storiesToRemove = chartArchive.stories.filter(s => s.data.id === angle.id).map(s => s.id);
      if (storiesToRemove.length > 0) {
        chartArchive.removeStories(storiesToRemove);
      }
    } else {
      // Add to archive
      chartArchive.saveStory(angle);
    }
  }

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
    onclick={handleToggleAngle}
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

      <div class="chart-controls">
        <button
          class="archive-btn"
          class:active={isArchived}
          onclick={handleToggleArchive}
          title={isArchived ? 'Remove from archive' : 'Archive story'}
          aria-label={isArchived ? 'Remove from archive' : 'Archive story'}
        >
          {#if isArchived}
            <svg class="archive-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2Z"></path></svg>
          {:else}
            <svg class="archive-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2ZM18 4H6V19.4324L12 15.6707L18 19.4324V4Z"></path></svg>
          {/if}
        </button>
        <div class="chart-type-bar-wrapper">
          <ChartTypeBar
            compatibleTypes={angle.compatibleChartTypes}
            selectedType={currentChartType}
            onselect={handleChartTypeChange}
          />
        </div>
      </div>

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
          Edit chart
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

  .chart-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .archive-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--text-dark);
    min-height: 32px;
    min-width: 32px;
    flex-shrink: 0;
    transition: filter 0.2s ease;
  }

  .archive-icon {
    transition: opacity 0.2s ease;
  }

  .archive-btn .archive-icon {
    color: var(--text-dark);
    opacity: 0.5;
  }

  .archive-btn:hover .archive-icon {
    opacity: 0.7;
  }

  .archive-btn.active .archive-icon {
    color: #5422B0;
    opacity: 1;
  }

  .chart-type-bar-wrapper {
    flex: 1;
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
    border: 1px solid var(--color-primary);
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
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    background: var(--color-primary);
    color: var(--white);
    border: 1.5px solid var(--color-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: 32px;
    flex: 1;
    transition: all var(--duration-fast) ease;
  }

  .edit-btn:hover {
    background: #7c3aed;
    border-color: #7c3aed;
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
