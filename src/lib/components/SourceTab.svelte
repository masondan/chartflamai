<script lang="ts">
  import { aiState } from '$lib/stores/aiState.svelte';
  import { uiState } from '$lib/stores/uiState.svelte';
  import { extractPdfText, truncateForLLM } from '$lib/utils/extractors';

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  let sourceOpen = $state(true);
  let summaryOpen = $state(false);
  let explorerOpen = $state(false);
  let progressMessage = $state('');
  let buttonMessage = $state('Find Stories');
  let messageInterval: ReturnType<typeof setInterval> | null = null;
  const loadingMessages = ['Digging for data', 'Selecting angles', 'Checking'];

  let urlInput = $state('');
  let fileName = $state('');
  let audience = $state('');
  let query = $state('');
  let scope = $state<'restrict' | 'related'>('restrict');
  let suggestAngles = $state(false);
  let chartTypeHint = $state('any');

  let summaryText = $state('');
  let summaryLoading = $state(false);
  let summaryPreparing = $state(false);
  let summaryError = $state('');
  let fileError = $state('');
  let isDragOver = $state(false);
  let fileInput: HTMLInputElement;

  const chartTypeOptions = [
    { id: 'any', label: 'Any' },
    { id: 'pie', label: 'Pie' },
    { id: 'bar', label: 'Bar' },
    { id: 'line', label: 'Line' }
  ];

  function closeOtherAccordions(openSection: 'source' | 'summary' | 'explorer') {
    if (openSection !== 'source') sourceOpen = false;
    if (openSection !== 'summary') summaryOpen = false;
    if (openSection !== 'explorer') explorerOpen = false;
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    fileError = '';
    summaryError = '';

    if (file.size > MAX_FILE_SIZE) {
      fileError = `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`;
      input.value = '';
      return;
    }

    fileName = file.name;
    aiState.value.sourceFile = file;
    aiState.value.sourceType = 'pdf';

    summaryPreparing = true;
    summaryText = '';

    try {
      const rawText = await extractPdfText(file);
      const truncated = truncateForLLM(rawText);
      aiState.value.extractedText = truncated;

      // Call summarize API
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedText: truncated })
      });

      if (!res.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await res.json();
      summaryText = data.summary || 'No summary available.';
      sourceOpen = false;
      summaryOpen = true;
      explorerOpen = false;
    } catch (err) {
      summaryError = err instanceof Error ? err.message : 'Failed to extract and summarise document.';
      summaryText = '';
    } finally {
      summaryPreparing = false;
    }
  }

  async function handleUrlSubmit() {
    if (!urlInput.trim()) return;
    
    const url = urlInput.trim();
    aiState.value.sourceUrl = url;
    aiState.value.sourceType = 'url';
    
    summaryPreparing = true;
    summaryText = '';
    summaryError = '';

    try {
      // Fetch URL content via server endpoint to avoid CORS
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) {
        throw new Error('Failed to fetch URL content');
      }

      const data = await res.json();
      const extractedContent = data.text || '';
      
      if (!extractedContent.trim()) {
        throw new Error('No readable content found at URL');
      }

      aiState.value.extractedText = extractedContent;

      // Now summarize the fetched content
      const summaryRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedText: extractedContent })
      });

      if (!summaryRes.ok) {
        throw new Error('Failed to generate summary');
      }

      const summaryData = await summaryRes.json();
      summaryText = summaryData.summary || 'No summary available.';
      sourceOpen = false;
      summaryOpen = true;
      explorerOpen = false;
    } catch (err) {
      summaryError = err instanceof Error ? err.message : 'Failed to fetch and summarise URL.';
      summaryText = '';
    } finally {
      summaryPreparing = false;
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      fileError = 'Please upload a PDF file';
      return;
    }

    // Trigger file change handler
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    
    const event = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(event);
  }

  let hasSource = $derived(!!aiState.value.extractedText);

  async function handleSubmit() {
    if (!hasSource) return;

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
            if (event.type === 'progress') buttonMessage = event.message;
            else if (event.type === 'result') {
              aiState.setResponse(event.data);
              explorerOpen = false;
              // Auto-expand the first story
              if (event.data.angles && event.data.angles.length > 0) {
                uiState.expandAngle(event.data.angles[0].id);
              }
            } else if (event.type === 'error') throw new Error(event.message);
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

<div class="source-tab">
  <!-- Add a source -->
  <div class="section-card card" class:collapsed={!sourceOpen} class:fading={summaryPreparing}>
    <button class="accordion-header" class:open={sourceOpen} onclick={() => !summaryPreparing && (sourceOpen ? (sourceOpen = false) : (closeOtherAccordions('source'), sourceOpen = true))} aria-expanded={sourceOpen} disabled={summaryPreparing}>
      <span class="accordion-title">Add a source</span>
      <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    {#if sourceOpen}
      <div class="section-body" class:preparing={summaryPreparing}>
        {#if summaryPreparing}
          <div class="preparing-overlay">
            <span class="spinner"></span>
            <span class="preparing-text">Preparing summary</span>
          </div>
        {/if}
         <label class="upload-zone" class:drag-over={isDragOver} ondragover={handleDragOver} ondragleave={handleDragLeave} ondrop={handleDrop}>
          <input type="file" accept=".pdf,.docx" onchange={handleFileChange} class="visually-hidden" bind:this={fileInput} />
          <img src="/icons/icon-upload.svg" alt="" width="32" height="32" class="upload-icon" />
          <span class="upload-label">Upload PDF/DOCX</span>
          {#if fileName}
            <span class="upload-filename">{fileName}</span>
          {/if}
        </label>

        {#if fileError}
          <p class="file-error">{fileError}</p>
        {/if}

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
  <div class="section-card card" class:collapsed={!summaryOpen} class:disabled-card={!hasSource} class:opening={summaryOpen && hasSource}>
    <button class="accordion-header" class:open={summaryOpen} onclick={() => hasSource && (summaryOpen ? (summaryOpen = false) : (closeOtherAccordions('summary'), summaryOpen = true))} aria-expanded={summaryOpen} disabled={!hasSource}>
      <span class="accordion-title">Source summary</span>
      <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    {#if summaryOpen && hasSource}
      <div class="section-body">
        {#if summaryLoading}
          <div class="summary-loading">
            <span class="spinner"></span>
            <span>Extracting and summarising document…</span>
          </div>
        {:else if summaryError}
          <p class="summary-error">{summaryError}</p>
        {:else if summaryText}
          <p class="summary-text">{summaryText}</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Data explorer -->
  <div class="section-card card" class:active-border={explorerOpen} class:collapsed={!explorerOpen} class:disabled-card={!hasSource}>
    <button class="accordion-header" class:open={explorerOpen} onclick={() => hasSource && (explorerOpen ? (explorerOpen = false) : (closeOtherAccordions('explorer'), explorerOpen = true))} aria-expanded={explorerOpen} disabled={!hasSource}>
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
          Topic
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

        <button 
          class="submit-btn primary" 
          class:loading={uiState.value.isLoading}
          onclick={handleSubmit} 
          disabled={!hasSource || uiState.value.isLoading}
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
      {#each Array(3) as _}
        <div class="skeleton-card card"><div class="skeleton-line wide"></div><div class="skeleton-line narrow"></div></div>
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
  .source-tab {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-card {
    padding: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .section-card.fading {
    opacity: 0.5;
  }

  .section-card.opening {
    animation: fadeIn var(--duration-normal) ease-out;
  }

  .section-card.disabled-card {
    opacity: 0.5;
    pointer-events: none;
  }

  .section-card.collapsed {
    border-color: #999999;
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
    position: relative;
  }

  .section-body.preparing {
    pointer-events: none;
  }

  .section-body.preparing > :not(.preparing-overlay) {
    opacity: 0.3;
  }

  .preparing-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    z-index: 10;
  }

  .preparing-overlay .spinner {
    width: 48px;
    height: 48px;
  }

  .preparing-text {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: #7c3aed;
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

  .upload-zone.drag-over {
    border-color: var(--color-primary);
    background-color: var(--color-highlight);
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

  .file-error {
    font-size: var(--font-size-sm);
    color: var(--color-error);
    font-weight: var(--font-weight-medium);
    margin: 0;
    text-align: center;
  }

  .summary-text {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: var(--line-height-relaxed);
    white-space: pre-line;
    margin: 0;
  }

  .summary-text + .summary-text {
    margin-top: 0.75rem;
  }

  .summary-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 0.75rem;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-primary);
  }

  .summary-error {
    font-size: var(--font-size-sm);
    color: var(--color-error);
    font-weight: var(--font-weight-medium);
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
    border: 1px solid var(--color-primary);
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
    color: var(--text-dark);
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
    border: 1px solid var(--color-primary);
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

  .submit-btn.loading {
    background: var(--color-primary) !important;
    color: var(--white);
    border-color: var(--color-primary);
  }

  .error-card { border-color: var(--color-error); text-align: center; }
  .error-message { color: var(--color-error); font-weight: var(--font-weight-medium); }

  .loading-cards { display: flex; flex-direction: column; gap: 0.75rem; }
  .skeleton-card { padding: 1.25rem; }
  .skeleton-line { height: 0.875rem; background: var(--bg-light); border-radius: var(--radius-sm); animation: pulse 1.5s ease-in-out infinite; }
  .skeleton-line.wide { width: 80%; margin-bottom: 0.5rem; }
  .skeleton-line.narrow { width: 50%; }

  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
