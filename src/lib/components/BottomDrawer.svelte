<script lang="ts">
  import { uiState } from '$lib/stores/uiState.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
  }

  let { title, children }: Props = $props();

  let isOpen = $derived(uiState.value.activeDrawer !== null);

  function close() {
    uiState.closeDrawer();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  async function handleCopy() {
    const content = document.querySelector('.drawer-content')?.textContent || '';
    await navigator.clipboard.writeText(content);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="backdrop" onclick={handleBackdropClick} role="presentation">
    <div class="drawer" role="dialog" aria-label={title}>
      <div class="drawer-header">
        <button class="close-btn" onclick={close} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <h3 class="drawer-title">{title}</h3>
        <div class="spacer"></div>
      </div>

      <div class="drawer-content">
        {@render children()}
      </div>

      <div class="drawer-footer">
        <button class="footer-btn" onclick={handleCopy} title="Copy">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="6" y="6" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
        <button class="footer-btn" title="Share">
          <img src="/icons/icon-share.svg" alt="Share" width="18" height="18" />
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: var(--z-modal-overlay);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }

  .drawer {
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
    background: var(--white);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    display: flex;
    flex-direction: column;
    z-index: var(--z-modal);
    animation: slideDrawerUp 0.3s ease-out;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-round);
    cursor: pointer;
    color: var(--text-medium);
    min-height: 32px;
    min-width: 32px;
  }

  .close-btn:hover {
    background: var(--bg-light);
  }

  .drawer-title {
    flex: 1;
    text-align: center;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    margin: 0;
  }

  .spacer {
    width: 32px;
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
    color: var(--text-secondary);
  }

  .drawer-footer {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .footer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-round);
    cursor: pointer;
    color: var(--text-medium);
    min-height: 40px;
    min-width: 40px;
  }

  .footer-btn:hover {
    background: var(--bg-light);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideDrawerUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
</style>
