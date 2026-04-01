<script lang="ts">
  import { aiState } from '$lib/stores/aiState.svelte';
  import { uiState } from '$lib/stores/uiState.svelte';

  let audience = $state('');
  let query = $state('');
  let chartTypeHint = $state('any');
  let explorerOpen = $state(true);
  let progressMessage = $state('');
  let buttonMessage = $state('Find Stories');
  let messageInterval: ReturnType<typeof setInterval> | null = null;
  const loadingMessages = ['Analysing data', 'Finding angles', 'Fact checking'];

  const chartTypeOptions = [
    { id: 'any', label: 'Any' },
    { id: 'pie', label: 'Pie' },
    { id: 'bar', label: 'Bar' },
    { id: 'line', label: 'Line' }
  ];

  // Register callbacks to close explorer when stories or drawers are opened
  $effect(() => {
    uiState.setAngleToggleCallback((angleId) => {
      if (angleId) {
        explorerOpen = false;
      }
    });
    uiState.setDrawerOpenCallback(() => {
      explorerOpen = false;
    });
  });

  function toggleExplorer() {
    explorerOpen = !explorerOpen;
    // Close any expanded stories when opening explorer
    if (explorerOpen) {
      uiState.expandAngle(null as any);
    }
  }

  async function handleSubmit() {
    if (!query.trim()) return;

    uiState.setLoading(true);
    aiState.setStep('loading');
    
    // Start cycling through loading messages every 3 seconds
    let messageIndex = 0;
    buttonMessage = loadingMessages[messageIndex];
    messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      buttonMessage = loadingMessages[messageIndex];
    }, 3000);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          audience: audience.trim(),
          chartTypeHint
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed (${res.status})`);
      }

      // Read SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/);
          if (!match) continue;

          try {
            const event = JSON.parse(match[1]);
            if (event.type === 'progress') {
              buttonMessage = event.message;
            } else if (event.type === 'result') {
              aiState.setResponse(event.data);
              explorerOpen = false;
              // Auto-expand the first story
              if (event.data.angles && event.data.angles.length > 0) {
                uiState.expandAngle(event.data.angles[0].id);
              }
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== match[1]) throw e;
          }
        }
      }
    } catch (err) {
      aiState.setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      if (messageInterval) clearInterval(messageInterval);
      uiState.setLoading(false);
      buttonMessage = 'Find Stories';
    }
  }
</script>

<div class="search-tab">
  <div class="explorer-card card" class:collapsed={!explorerOpen}>
    <button
      class="accordion-header"
      class:open={explorerOpen}
      onclick={() => explorerOpen = !explorerOpen}
      aria-expanded={explorerOpen}
    >
      <span class="accordion-title">Data explorer</span>
      <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    {#if explorerOpen}
       <div class="explorer-form" onclick={(e) => e.stopPropagation()}>
        <label class="field-label">
          Audience
          <input
            type="text"
            bind:value={audience}
            placeholder="Describe your target audience: who, where"
            disabled={uiState.value.isLoading}
          />
        </label>

        <label class="field-label">
          Topic
          <input
            type="text"
            bind:value={query}
            placeholder="What do you want the chart to show?"
            disabled={uiState.value.isLoading}
          />
        </label>

        <div class="chart-type-selector">
          <span class="field-label">Chart type</span>
          <div class="chart-type-options">
            {#each chartTypeOptions as option}
              <button
                class="chart-type-btn"
                class:selected={chartTypeHint === option.id}
                onclick={() => chartTypeHint = option.id}
                disabled={uiState.value.isLoading}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        <button
          class="submit-btn primary"
          class:loading={uiState.value.isLoading}
          onclick={handleSubmit}
          disabled={!query.trim() || uiState.value.isLoading}
        >
          {#if uiState.value.isLoading}
            <span class="spinner"></span>
          {/if}
          {buttonMessage}
        </button>
      </div>
    {/if}
  </div>

  {#if aiState.value.step === 'error' && aiState.value.error}
    <div class="error-card card">
      <p class="error-message">{aiState.value.error.message}</p>
      {#if aiState.value.error.retryable}
        <button class="primary" onclick={handleSubmit}>Try again</button>
      {/if}
    </div>
  {/if}

  {#if aiState.value.step === 'loading'}
    <div class="loading-cards">
      {#each Array(3) as _, i}
        <div class="skeleton-card card">
          <div class="skeleton-line wide"></div>
          <div class="skeleton-line narrow"></div>
        </div>
      {/each}
    </div>
  {/if}

  {#if aiState.value.step === 'results' && aiState.value.apiResponse}
    {#each aiState.value.apiResponse.angles as angle, index}
      {#await import('./AngleCard.svelte') then module}
        <module.default {angle} storyNumber={index + 1} />
      {/await}
    {/each}
  {/if}
</div>

<style>
  .search-tab {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .explorer-card {
    border-color: var(--color-primary);
    padding: 0;
  }

  .explorer-card.collapsed {
    border-color: var(--color-border);
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

  .explorer-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0 var(--spacing-lg) var(--spacing-lg);
    animation: slideUp var(--duration-normal) ease-out;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-dark);
  }

  .chart-type-selector {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .chart-type-options {
    display: flex;
    gap: 0.375rem;
  }

  .chart-type-btn {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    background: var(--white);
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    min-height: 38px;
    transition: all var(--duration-fast) ease;
  }

  .chart-type-btn.selected {
    background: var(--color-highlight);
    border-color: var(--color-primary);
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

  .submit-btn.loading {
    background: var(--color-primary) !important;
    color: var(--white);
    border-color: var(--color-primary);
  }

  .error-card {
    border-color: var(--color-error);
    text-align: center;
  }

  .error-message {
    color: var(--color-error);
    font-weight: var(--font-weight-medium);
  }

  .loading-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .skeleton-card {
    padding: 1.25rem;
  }

  .skeleton-line {
    height: 0.875rem;
    background: var(--bg-light);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-line.wide {
    width: 80%;
    margin-bottom: 0.5rem;
  }

  .skeleton-line.narrow {
    width: 50%;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(0.5rem); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
