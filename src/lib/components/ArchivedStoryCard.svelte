<script lang="ts">
  import { uiState } from '$lib/stores/uiState.svelte';
  import { aiState } from '$lib/stores/aiState.svelte';
  import { chartArchive, type ArchivedStory } from '$lib/stores/chartArchive.svelte';
  import ChartDisplay from './ChartDisplay.svelte';
  import ChartEditor from './ChartEditor.svelte';
  import ChartTypeBar from './ChartTypeBar.svelte';
  import type { ChartType } from '$lib/config/design';

  interface Props {
    story: ArchivedStory;
  }

  let { story }: Props = $props();

  let isExpanded = $state(false);
  let currentChartType = $derived(
    (aiState.value.angleChartTypes[story.data.id] as ChartType) || story.data.suggestedChartType
  );

  let editorOpen = $state(false);

  function handleToggle() {
    isExpanded = !isExpanded;
    if (isExpanded) {
      chartArchive.touchStory(story.id);
    }
  }

  function getAngleCsv(): string {
    const { labels, datasets } = story.data.data;
    if (datasets.length === 1) {
      return labels.map((l, i) => `${l},${datasets[0].data[i]}`).join('\n');
    }
    const header = ['Label', ...datasets.map(d => d.label)].join(',');
    const rows = labels.map((l, i) => [l, ...datasets.map(d => d.data[i])].join(','));
    return [header, ...rows].join('\n');
  }

  function handleChartTypeChange(type: ChartType) {
    aiState.setAngleChartType(story.data.id, type);
  }

  function handleDelete() {
    chartArchive.removeStories([story.id]);
  }
</script>

<div class="story-card" class:expanded={isExpanded}>
  <button
    class="story-header"
    onclick={handleToggle}
    aria-expanded={isExpanded}
  >
    <div class="story-header-content">
      <span class="story-headline">{story.data.headline}</span>
    </div>
    <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  {#if isExpanded}
    <div class="story-body">
      <p class="story-summary">{story.data.summary}</p>

      <div class="chart-controls">
        <div class="chart-type-bar-wrapper">
          <ChartTypeBar
            compatibleTypes={story.data.compatibleChartTypes}
            selectedType={currentChartType}
            onselect={handleChartTypeChange}
          />
        </div>
      </div>

      <ChartDisplay
        angle={story.data}
        chartType={currentChartType}
        height={200}
      />

      <div class="story-actions">
        <button class="action-btn" onclick={() => uiState.openDrawer('sources', story.data.id)}>
          Sources
        </button>
        <button class="action-btn" onclick={() => uiState.openDrawer('data', story.data.id)}>
          Data
        </button>
        <button class="action-btn" onclick={() => uiState.openDrawer('explain', story.data.id)}>
          Explain
        </button>
        <button class="edit-btn" title="Edit chart" aria-label="Edit chart" onclick={() => editorOpen = true}>
          Edit chart
        </button>
      </div>

      <div class="delete-row">
        <button class="delete-btn" onclick={handleDelete} title="Delete" aria-label="Delete story">
          <img src="/icons/icon-trash.svg" alt="" width="16" height="16" />
          <span>Delete</span>
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
  .story-card {
    background: var(--white);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: border-color var(--duration-normal) ease;
    animation: fadeIn var(--duration-normal) ease-out;
  }

  .story-card.expanded {
    border-color: var(--color-primary);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .story-header {
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

  .story-header-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .story-headline {
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

  .story-body {
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    animation: slideUpFade var(--duration-normal) ease-out;
  }

  .story-summary {
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

  .chart-type-bar-wrapper {
    flex: 1;
  }

  .story-actions {
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

  .delete-row {
    display: flex;
    justify-content: center;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border);
    margin-top: 0.5rem;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    background: none;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 32px;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-radius: var(--radius-md);
  }

  .delete-btn img {
    opacity: 0.6;
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
