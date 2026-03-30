<script lang="ts">
  import { uiState } from '$lib/stores/uiState.svelte';
  import SearchTab from '$lib/components/SearchTab.svelte';

  const tabs = [
    { id: 'search' as const, label: 'Search' },
    { id: 'source' as const, label: 'Source' },
    { id: 'paste' as const, label: 'Paste' }
  ];
</script>

<div class="tabs">
  {#each tabs as tab}
    <button
      class="tab-btn"
      class:active={uiState.value.activeTab === tab.id}
      onclick={() => uiState.setTab(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<div class="tab-content">
  {#if uiState.value.activeTab === 'search'}
    <SearchTab />
  {:else if uiState.value.activeTab === 'source'}
    <div class="coming-soon card">
      <p>Source mode coming soon</p>
      <p class="coming-soon-sub">Upload PDFs or enter URLs to discover data angles</p>
    </div>
  {:else if uiState.value.activeTab === 'paste'}
    <div class="coming-soon card">
      <p>Paste mode coming soon</p>
      <p class="coming-soon-sub">Paste CSV data to discover visualization angles</p>
    </div>
  {/if}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tab-btn {
    flex: 1;
    padding: 0.625rem 1rem;
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
    background: var(--white);
    color: var(--color-primary);
    border: 1.5px solid var(--color-primary);
    transition: all var(--duration-fast) ease;
  }

  .tab-btn.active {
    background: var(--color-primary);
    color: var(--white);
    border-color: var(--color-primary);
  }

  .tab-content {
    min-height: 300px;
  }

  .coming-soon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    text-align: center;
  }

  .coming-soon p {
    font-weight: var(--font-weight-semibold);
    color: var(--text-dark);
    margin-bottom: 0.5rem;
  }

  .coming-soon-sub {
    font-weight: var(--font-weight-regular) !important;
    color: var(--text-medium) !important;
    font-size: var(--font-size-sm);
  }
</style>
