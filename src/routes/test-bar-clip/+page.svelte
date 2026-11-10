<script lang="ts">
  import { onMount } from 'svelte';
  import { runBarClipTests, testCreateClipIntegration } from '$lib/animation/test-bar-clip';
  import { testEditorAnimationFlow } from '$lib/animation/test-bar-editor-integration';

  let testOutput = $state('');
  let testStatus = $state<'idle' | 'running' | 'pass' | 'fail'>('idle');

  async function runTest(testFn: () => Promise<void>, isIntegration = false) {
    testStatus = 'running';
    const originalLog = console.log;
    const originalError = console.error;
    const logs: string[] = [];

    // Intercept console output
    console.log = (...args: any[]) => {
      logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      originalLog(...args);
    };
    console.error = (...args: any[]) => {
      logs.push(
        'ERROR: ' +
          args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
      );
      originalError(...args);
    };

    try {
      await testFn();
      testStatus = 'pass';
    } catch (err) {
      testStatus = 'fail';
      console.error('Test failed:', err);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      testOutput = logs.join('\n');
    }
  }

  onMount(async () => {
    await runTest(runBarClipTests);
  });

  async function runIntegrationTest() {
    await runTest(testCreateClipIntegration, true);
  }
</script>

<div class="test-page">
  <h1>Bar Chart Animation Tests (Section B, D, & E)</h1>

  <div class="controls">
    <button onclick={() => runTest(runBarClipTests)}>Run Section B Tests</button>
    <button onclick={runIntegrationTest}>Run Section D Integration Test</button>
    <button onclick={() => runTest(testEditorAnimationFlow)}>Run Section E Editor Flow Test</button>
  </div>

  <div class="status" class:pass={testStatus === 'pass'} class:fail={testStatus === 'fail'} class:running={testStatus === 'running'}>
    {#if testStatus === 'idle'}
      <p>Click a button to run tests...</p>
    {:else if testStatus === 'running'}
      <p>🔄 Running tests...</p>
    {:else if testStatus === 'pass'}
      <p>✅ All tests passed!</p>
    {:else if testStatus === 'fail'}
      <p>❌ One or more tests failed</p>
    {/if}
  </div>

  <div class="output">
    <pre>{testOutput}</pre>
  </div>
</div>

<style>
  .test-page {
    padding: 2rem;
    font-family: 'Inter', sans-serif;
    background: #f9f9f9;
    min-height: 100vh;
  }

  h1 {
    margin-bottom: 1.5rem;
    color: #1f1f1f;
  }

  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  button {
    padding: 0.75rem 1.25rem;
    background: #5422b0;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover {
    background: #4318a0;
  }

  button:active {
    background: #3b0c90;
  }

  .status {
    padding: 1rem;
    margin-bottom: 2rem;
    border-radius: 8px;
    border-left: 4px solid #e0e0e0;
    background: #fafafa;
  }

  .status.running {
    border-left-color: #5422b0;
    background: #f0e6f7;
  }

  .status.pass {
    border-left-color: #10b981;
    background: #ecfdf5;
  }

  .status.fail {
    border-left-color: #ef4444;
    background: #fef2f2;
  }

  .status p {
    margin: 0;
    color: #1f1f1f;
    font-weight: 500;
  }

  .output {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
    overflow-x: auto;
  }

  pre {
    margin: 0;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
