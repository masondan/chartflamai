<script lang="ts">
  import { onMount } from 'svelte';
  import { uiState } from '$lib/stores/uiState.svelte';
  import { aiState } from '$lib/stores/aiState.svelte';
  import SearchTab from '$lib/components/SearchTab.svelte';
  import SourceTab from '$lib/components/SourceTab.svelte';
  import ClassicTab from '$lib/components/ClassicTab.svelte';
  import ChartEditor from '$lib/components/ChartEditor.svelte';
  import PictogramEditor from '$lib/components/PictogramEditor.svelte';
  import WaffleChartEditor from '$lib/components/WaffleChartEditor.svelte';
  import type { ArchivedChart } from '$lib/stores/chartArchive.svelte';
  import type { ChartType } from '$lib/config/design';

  const tabs = [
    { id: 'classic' as const, label: 'Classic', ai: false },
    { id: 'search' as const, label: 'Search', ai: true },
    { id: 'source' as const, label: 'Source', ai: true }
  ];

  // Per-tab results cache so switching tabs doesn't lose work
  let tabCache: Record<string, { response: any; step: string }> = {};

  // Archive edit state — editors opened from Saved Charts
  let archiveEditor = $state<{ type: 'chart' | 'waffle' | 'pictogram'; chart: ArchivedChart } | null>(null);

  function switchTab(tab: typeof tabs[number]['id']) {
    if (uiState.value.activeTab === tab) return;

    // Save current tab's state
    const current = uiState.value.activeTab;
    if (aiState.value.apiResponse || aiState.value.step !== 'input') {
      tabCache[current] = {
        response: aiState.value.apiResponse,
        step: aiState.value.step
      };
    }

    // Restore target tab's state (or reset to input)
    const cached = tabCache[tab];
    if (cached?.response) {
      aiState.setResponse(cached.response);
    } else {
      aiState.setStep('input');
      aiState.value.apiResponse = null;
      aiState.value.error = null;
    }

    uiState.value.expandedAngleId = null;
    uiState.closeDrawer();
    uiState.setTab(tab);
  }

  function handleArchiveEdit(e: Event) {
    const chart = (e as CustomEvent<ArchivedChart>).detail;
    archiveEditor = { type: chart.editorType, chart };
  }

  onMount(() => {
    window.addEventListener('archive-edit', handleArchiveEdit);
    return () => window.removeEventListener('archive-edit', handleArchiveEdit);
  });
</script>

<div class="tabs">
  {#each tabs as tab}
    <button
      class="tab-btn"
      class:active={uiState.value.activeTab === tab.id}
      onclick={() => switchTab(tab.id)}
    >
      {#if tab.ai}
        <img src="/icons/icon-ai-fill.svg" alt="" width="14" height="14" class="sparkle" />
      {/if}
      {tab.label}
    </button>
  {/each}
</div>

<div class="tab-content">
  {#if uiState.value.activeTab === 'search'}
    <SearchTab />
  {:else if uiState.value.activeTab === 'source'}
    <SourceTab />
  {:else if uiState.value.activeTab === 'classic'}
    <ClassicTab />
  {/if}
</div>

<!-- Archive edit — editors opened from Saved Charts drawer -->
{#if archiveEditor?.type === 'chart'}
  <ChartEditor
    chartType={(archiveEditor.chart.config.activeType ?? 'bar') as ChartType}
    archiveId={archiveEditor.chart.id}
    onclose={() => archiveEditor = null}
  />
{:else if archiveEditor?.type === 'pictogram'}
  <PictogramEditor
    archiveId={archiveEditor.chart.id}
    onclose={() => archiveEditor = null}
  />
{:else if archiveEditor?.type === 'waffle'}
  <WaffleChartEditor
    archiveId={archiveEditor.chart.id}
    onclose={() => archiveEditor = null}
  />
{/if}

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.625rem 1rem;
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
    background: var(--white);
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    transition: all var(--duration-fast) ease;
  }

  .tab-btn.active {
    background: var(--color-primary);
    color: var(--white);
    border-color: var(--color-primary);
  }

  .tab-btn.active .sparkle {
    filter: brightness(0) invert(1);
  }

  .sparkle {
    flex-shrink: 0;
  }

  .tab-content {
    min-height: 300px;
  }
</style>
