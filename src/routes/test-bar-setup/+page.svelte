<script lang="ts">
  import { onMount } from 'svelte';
  import { testBarChartSetup } from '$lib/animation/test-bar-setup';

  let output = $state<string[]>([]);
  let isRunning = $state(false);

  onMount(() => {
    // Intercept console.log to capture output
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      output.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      originalLog(...args);
    };

    return () => {
      console.log = originalLog;
    };
  });

  async function runTest() {
    isRunning = true;
    output = [];
    try {
      await testBarChartSetup();
    } catch (err) {
      output.push(`❌ Test error: ${err}`);
    }
    isRunning = false;
  }
</script>

<div class="test-page">
  <h1>Section A: Bar Chart Setup Test</h1>
  
  <button onclick={runTest} disabled={isRunning}>
    {isRunning ? 'Running...' : 'Run Test'}
  </button>

  <div class="output">
    {#each output as line}
      <div class="line">{line}</div>
    {/each}
  </div>
</div>

<style>
  .test-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    font-family: monospace;
    background: #1f1f1f;
    color: #0f0;
    min-height: 100vh;
  }

  h1 {
    color: #5422b0;
    margin-bottom: 20px;
  }

  button {
    background: #5422b0;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 20px;
  }

  button:hover:not(:disabled) {
    background: #3d1a7f;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .output {
    background: #111;
    border: 1px solid #333;
    border-radius: 4px;
    padding: 15px;
    max-height: 600px;
    overflow-y: auto;
    font-size: 12px;
    line-height: 1.5;
  }

  .line {
    margin: 2px 0;
  }
</style>
