<script lang="ts">
  import { uiState } from '$lib/stores/uiState.svelte';
  import { aiState } from '$lib/stores/aiState.svelte';
  import { chartArchive } from '$lib/stores/chartArchive.svelte';
  import BottomDrawer from './BottomDrawer.svelte';
  import type { AngleData } from '$lib/stores/aiState.svelte';

  let currentAngle = $derived.by<AngleData | undefined>(() => {
    const angleId = uiState.value.activeDrawerAngleId;
    if (!angleId) return undefined;
    
    // First check API response angles
    const apiAngle = aiState.value.apiResponse?.angles.find(a => a.id === angleId);
    if (apiAngle) return apiAngle;
    
    // Then check archived stories
    const archivedStory = chartArchive.stories.find(s => s.data.id === angleId);
    return archivedStory?.data;
  });

  let drawerTitle = $derived(
    uiState.value.activeDrawer === 'sources' ? 'Sources' :
    uiState.value.activeDrawer === 'data' ? 'Data' :
    uiState.value.activeDrawer === 'explain' ? 'Explain' : ''
  );
</script>

{#if uiState.value.activeDrawer && currentAngle}
  <BottomDrawer title={drawerTitle}>
    {#if uiState.value.activeDrawer === 'sources'}
      <div class="sources-content">
        {#if currentAngle.sources.length > 0}
          <ul class="source-list">
            {#each currentAngle.sources as source}
              <li class="source-item">
                {#if source.includes('http')}
                  {@const parts = source.split(': ')}
                  {#if parts.length > 1}
                    <a href={parts[parts.length - 1]} target="_blank" rel="noopener noreferrer">
                      {parts.slice(0, -1).join(': ')}
                    </a>
                  {:else}
                    <a href={source} target="_blank" rel="noopener noreferrer">{source}</a>
                  {/if}
                {:else}
                  <span>{source}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p>No sources available for this angle.</p>
        {/if}
      </div>

    {:else if uiState.value.activeDrawer === 'data'}
      <div class="data-content">
        <table class="data-table">
          <thead>
            <tr>
              <th>Label</th>
              {#each currentAngle.data.datasets as ds}
                <th>{ds.label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each currentAngle.data.labels as label, i}
              <tr>
                <td>{label}</td>
                {#each currentAngle.data.datasets as ds}
                  <td>{ds.data[i] ?? '–'}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    {:else if uiState.value.activeDrawer === 'explain'}
      <div class="explain-content">
        {#each currentAngle.explain.split('\n\n') as paragraph}
          <p>{paragraph}</p>
        {/each}
        {#if currentAngle.keyFinding}
          <p class="key-finding"><strong>Key finding:</strong> {currentAngle.keyFinding}</p>
        {/if}
      </div>
    {/if}
  </BottomDrawer>
{/if}

<style>
  .source-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .source-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-border);
  }

  .source-item a {
    color: var(--color-primary);
    text-decoration: none;
    word-break: break-word;
  }

  .source-item a:hover {
    text-decoration: underline;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-xs);
  }

  .data-table th,
  .data-table td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .data-table th {
    font-weight: var(--font-weight-semibold);
    background: var(--bg-surface);
    position: sticky;
    top: 0;
  }

  .data-table td {
    font-variant-numeric: tabular-nums;
  }

  .explain-content p {
    margin-bottom: 0.75rem;
    line-height: var(--line-height-relaxed);
  }

  .key-finding {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--color-highlight);
    border-radius: var(--radius-md);
  }
</style>
