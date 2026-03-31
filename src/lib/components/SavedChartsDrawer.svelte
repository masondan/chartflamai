<script lang="ts">
  import { chartArchive, type ArchivedChart } from '$lib/stores/chartArchive.svelte';

  interface Props {
    onclose: () => void;
    onedit: (chart: ArchivedChart) => void;
  }

  let { onclose, onedit }: Props = $props();

  let selected = $state<Set<string>>(new Set());
  let selectionMode = $state(false);

  let hasSelection = $derived(selected.size > 0);
  let singleSelection = $derived(selected.size === 1);

  function toggleSelect(id: string) {
    if (!selectionMode) {
      selectionMode = true;
    }
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selected = next;
    if (next.size === 0) {
      selectionMode = false;
    }
  }

  function handleEdit() {
    if (!singleSelection) return;
    const id = [...selected][0];
    const chart = chartArchive.getById(id);
    if (chart) {
      chartArchive.touch(id);
      onedit(chart);
    }
  }

  function handleCopy() {
    if (!singleSelection) return;
    const id = [...selected][0];
    chartArchive.duplicate(id);
    selected = new Set();
    selectionMode = false;
  }

  function handleDownload() {
    if (!singleSelection) return;
    const id = [...selected][0];
    const chart = chartArchive.getById(id);
    if (!chart) return;

    const link = document.createElement('a');
    link.href = chart.thumbnail;
    link.download = `chartflamai-${chart.editorType}-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  }

  function handleDelete() {
    if (!hasSelection) return;
    chartArchive.remove([...selected]);
    selected = new Set();
    selectionMode = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="saved-overlay">
  <div class="saved-panel">
    <!-- Header -->
    <div class="saved-header">
      <button class="close-btn" onclick={onclose} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <h1 class="saved-title">Saved charts</h1>
      <div class="header-spacer"></div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <button
        class="toolbar-btn"
        class:active={hasSelection && singleSelection}
        disabled={!hasSelection || !singleSelection}
        onclick={handleEdit}
        title="Edit"
        aria-label="Edit"
      >
        <img src="/icons/icon-edit-fill.svg" alt="" width="20" height="20" />
      </button>
      <button
        class="toolbar-btn"
        class:active={hasSelection && singleSelection}
        disabled={!hasSelection || !singleSelection}
        onclick={handleCopy}
        title="Copy"
        aria-label="Copy"
      >
        <img src="/icons/icon-copy.svg" alt="" width="20" height="20" />
      </button>
      <button
        class="toolbar-btn"
        class:active={hasSelection && singleSelection}
        disabled={!hasSelection || !singleSelection}
        onclick={handleDownload}
        title="Download"
        aria-label="Download"
      >
        <img src="/icons/icon-download.svg" alt="" width="20" height="20" />
      </button>
      <button
        class="toolbar-btn"
        class:active={hasSelection}
        disabled={!hasSelection}
        onclick={handleDelete}
        title="Delete"
        aria-label="Delete"
      >
        <img src="/icons/icon-trash.svg" alt="" width="20" height="20" />
      </button>
    </div>

    <!-- Grid -->
    <div class="chart-grid">
      {#if chartArchive.charts.length === 0}
        <div class="empty-state">
          <p>No saved charts yet</p>
          <p class="empty-hint">Charts will appear here automatically as you create them</p>
        </div>
      {:else}
        {#each chartArchive.charts.toReversed() as chart (chart.id)}
          <button
            class="grid-item"
            class:selected={selected.has(chart.id)}
            onclick={() => toggleSelect(chart.id)}
            aria-label="Select chart"
          >
            <img src={chart.thumbnail} alt="" class="grid-thumbnail" />
            <!-- Checkmark overlay -->
            {#if selectionMode}
              <div class="check-circle" class:checked={selected.has(chart.id)}>
                {#if selected.has(chart.id)}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                {/if}
              </div>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .saved-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    background: var(--bg-surface);
    overflow-y: auto;
  }

  .saved-panel {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    background: var(--white);
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.08);
  }

  .saved-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--white);
    z-index: 10;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-round);
    cursor: pointer;
    color: var(--text-dark);
    min-height: 36px;
    min-width: 36px;
  }

  .close-btn:hover {
    background: var(--bg-light);
  }

  .saved-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-dark);
    text-align: center;
    flex: 1;
  }

  .header-spacer {
    width: 36px;
  }

  /* Toolbar — 4 equally spaced outline purple buttons */
  .toolbar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.625rem;
    padding: 1rem;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 0;
    background: var(--white);
    border: 1.5px solid var(--color-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 48px;
  }

  .toolbar-btn img {
    filter: brightness(0) saturate(100%) invert(15%) sepia(80%) saturate(4000%) hue-rotate(260deg);
    opacity: 0.3;
    transition: opacity var(--duration-fast) ease;
  }

  .toolbar-btn.active img {
    opacity: 1;
  }

  .toolbar-btn:disabled {
    cursor: default;
    border-color: var(--color-border);
  }

  .toolbar-btn:not(:disabled):hover {
    background: var(--color-highlight);
  }

  /* Grid — 2 columns, square thumbnails */
  .chart-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    padding: 0.5rem 1rem 2rem;
  }

  .grid-item {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    background: var(--white);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    overflow: hidden;
    transition: all var(--duration-fast) ease;
    min-height: auto;
    min-width: auto;
  }

  .grid-item:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
  }

  .grid-item.selected {
    border-color: var(--color-primary);
    border-width: 2px;
  }

  .grid-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Checkmark circle — top-right corner of thumbnail */
  .check-circle {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-round);
    background: var(--white);
    border: 2px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast) ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .check-circle.checked {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }

  /* Empty state */
  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-medium);
  }

  .empty-state p {
    margin: 0;
    font-weight: 500;
  }

  .empty-hint {
    font-size: var(--font-size-sm);
    margin-top: 0.5rem !important;
    color: var(--text-medium);
    font-weight: 400 !important;
  }
</style>
