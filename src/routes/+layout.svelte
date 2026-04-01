<script lang="ts">
  import '../app.css';
  import DrawerManager from '$lib/components/DrawerManager.svelte';
  import SavedChartsDrawer from '$lib/components/SavedChartsDrawer.svelte';
  import type { ArchivedChart } from '$lib/stores/chartArchive.svelte';

  let { children } = $props();

  let savedChartsOpen = $state(false);

  // When a chart is edited from the archive, we store it here
  // so page.svelte can pick it up (via a custom event on the window)
  function handleEditFromArchive(chart: ArchivedChart) {
    savedChartsOpen = false;
    window.dispatchEvent(new CustomEvent('archive-edit', { detail: chart }));
  }
</script>

<div class="app-shell">
  <header class="header">
    <button class="header-btn" aria-label="Menu">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <a href="/" class="logo-link">
      <img src="/logos/logo-chartflam-logotype.png" alt="ChartFlam" class="logo" />
    </a>
    <button class="header-btn bookmark-btn" aria-label="Saved" onclick={() => savedChartsOpen = true}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 2h10a1 1 0 011 1v13l-5.5-3L4 16V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </button>
  </header>

  <main class="main-container">
    {@render children()}
  </main>
</div>

<DrawerManager />

{#if savedChartsOpen}
  <SavedChartsDrawer
    onclose={() => savedChartsOpen = false}
    onedit={handleEditFromArchive}
  />
{/if}

<style>
  .app-shell {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    background: var(--white);
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.08);
  }

  .header {
    position: sticky;
    top: 0;
    z-index: var(--z-header);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--white);
    border-bottom: 1px solid var(--color-border);
  }

  .header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-round);
    color: var(--text-dark);
    cursor: pointer;
    min-height: 36px;
    min-width: 36px;
  }

  .bookmark-btn {
    border: 1.5px solid var(--color-border);
  }

  .logo-link {
    display: flex;
    align-items: center;
  }

  .logo {
    height: 24px;
    width: auto;
  }

  .main-container {
    padding: 1rem;
  }
</style>
