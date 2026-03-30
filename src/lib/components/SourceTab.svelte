<script lang="ts">
  import { aiState } from '$lib/stores/aiState.svelte';
  import { uiState } from '$lib/stores/uiState.svelte';

  let sourceOpen = $state(true);
  let summaryOpen = $state(false);
  let explorerOpen = $state(false);
  let progressMessage = $state('');

  let urlInput = $state('');
  let fileName = $state('');
  let audience = $state('');
  let query = $state('');
  let scope = $state<'restrict' | 'related'>('restrict');
  let suggestAngles = $state(false);
  let chartTypeHint = $state('any');

  const chartTypeOptions = [
    { id: 'any', label: 'Any' },
    { id: 'pie', label: 'Pie' },
    { id: 'bar', label: 'Bar' },
    { id: 'line', label: 'Line' }
  ];

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    fileName = file.name;
    aiState.value.sourceFile = file;
    aiState.value.sourceType = 'pdf';
    aiState.value.extractedText = `[PDF uploaded: ${file.name}, ${(file.size / 1024).toFixed(0)}KB — full extraction coming in Tier 1]`;

    sourceOpen = false;
    summaryOpen = true;
    explorerOpen = true;
  }

  function handleUrlSubmit() {
    if (!urlInput.trim()) return;
    aiState.value.sourceUrl = urlInput.trim();
    aiState.value.sourceType = 'url';
    aiState.value.extractedText = `[URL provided: ${urlInput.trim()} — content will be fetched via Perplexity]`;

    sourceOpen = false;
    summaryOpen = true;
    explorerOpen = true;
  }

  let hasSource = $derived(!!aiState.value.extractedText);

  async function handleSubmit() {
    if (!hasSource) return;

    uiState.setLoading(true);
    aiState.setStep('loading');
    progressMessage = 'Connecting...';

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'source',
          extractedText: aiState.value.extractedText,
          query: suggestAngles ? '' : query.trim(),
          scope: scope === 'restrict' ? 'restrict-to-source' : 'search-widely',
          sourceType: aiState.value.sourceType,
          audience: audience.trim(),
          chartTypeHint
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${res.status})`);
      }

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
            if (event.type === 'progress') progressMessage = event.message;
            else if (event.type === 'result') {
              aiState.setResponse(event.data);
              explorerOpen = false;
            } else if (event.type === 'error') throw new Error(event.message);
          } catch (e) {
            if (e instanceof Error && e.message !== match[1]) throw e;
          }
        }
      }
    } catch (err) {
      aiState.setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      uiState.setLoading(false);
      progressMessage = '';
    }
  }
</script>

<div class="source-tab">
  <!-- Add a source -->
  <div class="section-card card" class:collapsed={!sourceOpen}>
    <button class="accordion-header" class:open={sourceOpen} onclick={() => sourceOpen = !sourceOpen} aria-expanded={sourceOpen}>
      <span class="accordion-title">Add a source</span>
      <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    {#if sourceOpen}
      <div class="section-body">
        <label class="upload-zone">
          <input type="file" accept=".pdf,.docx" onchange={handleFileChange} class="visually-hidden" />
          <img src="/icons/icon-upload.svg" alt="" width="32" height="32" class="upload-icon" />
          <span class="upload-label">Upload PDF/DOCX</span>
          {#if fileName}
            <span class="upload-filename">{fileName}</span>
          {/if}
        </label>

        <div class="divider"><span class="divider-text">or</span></div>

        <div class="url-row">
          <input type="url" bind:value={urlInput} placeholder="https://www.source-url..." disabled={uiState.value.isLoading} />
          <button class="url-submit" onclick={handleUrlSubmit} disabled={!urlInput.trim() || uiState.value.isLoading} aria-label="Add URL">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M11 5l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Source summary -->
  {#if hasSource}
    <div class="section-card card" class:collapsed={!summaryOpen}>
      <button class="accordion-header" class:open={summaryOpen} onclick={() => summaryOpen = !summaryOpen} aria-expanded={summaryOpen}>
        <span class="accordion-title">Source summary</span>
        <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      {#if summaryOpen}
        <div class="section-body">
          <p class="summary-text">{aiState.value.extractedText}</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Data explorer -->
  <div class="section-card card" class:active-border={explorerOpen}>
    <button class="accordion-header" class:open={explorerOpen} onclick={() => explorerOpen = !explorerOpen} aria-expanded={explorerOpen}>
      <span class="accordion-title">Data explorer</span>
      <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    {#if explorerOpen}
      <div class="section-body">
        <div class="scope-toggle">
          <span class="field-label">Data focus</span>
          <div class="scope-options">
            <button class="scope-btn" class:selected={scope === 'restrict'} onclick={() => scope = 'restrict'}>Restrict to source</button>
            <button class="scope-btn" class:selected={scope === 'related'} onclick={() => scope = 'related'}>Include related</button>
          </div>
        </div>

        <label class="field-label">
          Audience
          <input type="text" bind:value={audience} placeholder="Describe your target audience: who, where" disabled={uiState.value.isLoading} />
        </label>

        <label class="field-label">
          Question
          <input type="text" bind:value={query} placeholder="What do you want the chart to show?" disabled={uiState.value.isLoading || suggestAngles} />
        </label>

        <label class="suggest-toggle">
          <span>Or ... suggest three angles</span>
          <input type="checkbox" bind:checked={suggestAngles} />
        </label>

        <div class="chart-type-selector">
          <span class="field-label">Chart type</span>
          <div class="chart-type-options">
            {#each chartTypeOptions as option}
              <button class="chart-type-btn" class:selected={chartTypeHint === option.id} onclick={() => chartTypeHint = option.id} disabled={uiState.value.isLoading}>
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        <button class="submit-btn primary" onclick={handleSubmit} disabled={!hasSource || uiState.value.isLoading}>
          {#if uiState.value.isLoading}
            <span class="spinner"></span>
            Analyzing...
          {:else}
            Chart it
          {/if}
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
    <div class="loading-section">
      {#if progressMessage}
        <div class="progress-message"><span class="spinner"></span><span>{progressMessage}</span></div>
      {/if}
      <div class="loading-cards">
        {#each Array(3) as _}
          <div class="skeleton-card card"><div class="skeleton-line wide"></div><div class="skeleton-line narrow"></div></div>
        {/each}
      </div>
    </div>
  {/if}

  {#if aiState.value.step === 'results' && aiState.value.apiResponse}
    {#each aiState.value.apiResponse.angles as angle}
      {#await import('./AngleCard.svelte') then module}
        <module.default {angle} />
      {/await}
    {/each}
  {/if}
</div>

<style>
  .source-tab {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-card {
    padding: 0;
  }

  .section-card.collapsed {
    border-color: var(--color-border);
  }

  .section-card.active-border {
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

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0 var(--spacing-lg) var(--spacing-lg);
  }

  .upload-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem;
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color var(--duration-fast) ease;
  }

  .upload-zone:hover {
    border-color: var(--color-primary);
  }

  .upload-icon {
    opacity: 0.4;
  }

  .upload-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-medium);
  }

  .upload-filename {
    font-size: var(--font-size-xs);
    color: var(--color-primary);
    font-weight: var(--font-weight-medium);
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
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
    color: var(--text-medium);
  }

  .url-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .url-row input {
    flex: 1;
  }

  .url-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: var(--color-primary);
    color: var(--white);
    border: none;
    border-radius: var(--radius-round);
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    flex-shrink: 0;
  }

  .url-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .summary-text {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: var(--line-height-relaxed);
    white-space: pre-wrap;
    margin: 0;
  }

  .scope-toggle {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .scope-options {
    display: flex;
    gap: 0.375rem;
  }

  .scope-btn {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    background: var(--white);
    color: var(--color-primary);
    border: 1.5px solid var(--color-primary);
    min-height: 38px;
    transition: all var(--duration-fast) ease;
  }

  .scope-btn.selected {
    background: var(--color-highlight);
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-dark);
  }

  .suggest-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .suggest-toggle input[type="checkbox"] {
    width: 18px;
    height: 18px;
    min-height: auto;
    accent-color: var(--color-primary);
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
    border: 1.5px solid var(--color-primary);
    min-height: 38px;
    transition: all var(--duration-fast) ease;
  }

  .chart-type-btn.selected {
    background: var(--color-highlight);
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

  .error-card { border-color: var(--color-error); text-align: center; }
  .error-message { color: var(--color-error); font-weight: var(--font-weight-medium); }

  .loading-section { display: flex; flex-direction: column; gap: 0.75rem; }
  .progress-message { display: flex; align-items: center; justify-content: center; gap: 0.625rem; padding: 0.75rem; font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-primary); }
  .loading-cards { display: flex; flex-direction: column; gap: 0.75rem; }
  .skeleton-card { padding: 1.25rem; }
  .skeleton-line { height: 0.875rem; background: var(--bg-light); border-radius: var(--radius-sm); animation: pulse 1.5s ease-in-out infinite; }
  .skeleton-line.wide { width: 80%; margin-bottom: 0.5rem; }
  .skeleton-line.narrow { width: 50%; }

  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
