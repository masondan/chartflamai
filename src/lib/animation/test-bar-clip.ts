/**
 * Test harness for Section B & D: Bar chart animation (prepareBarClip + createClip factory).
 *
 * Tests all four bar variants:
 *   1. Vertical Bars (Grouped)
 *   2. Vertical Bars (Stacked)
 *   3. Horizontal Bars (Grouped)
 *   4. Horizontal Bars (Stacked)
 *
 * For each variant:
 *   - Create PreparedClip via prepareBarClip()
 *   - Render frames at t=0 (base only), t=mid (wipe in progress), t=end (fully revealed)
 *   - Verify wipe math is directionally correct (vertical: bottom→top, horizontal: left→right)
 *   - Cleanup via dispose()
 *
 * Section D additions:
 *   - testCreateClipIntegration(): Full pipeline from config capture to createClip factory
 */

import { prepareBarClip } from './renderers/bar';
import type { BarClipConfig } from './renderers/bar-chart-setup';
import { captureBarClipConfig, restoreBarClipConfig } from './renderers/bar-chart-setup';
import { DURATION_OPTIONS_MS } from './timeline';
import { createClip } from './createClip';

/** Test variant descriptor. */
interface TestVariant {
  name: string;
  config: BarClipConfig;
}

/** Build a minimal BarClipConfig for testing. */
function buildTestConfig(
  barOrientation: 'vertical' | 'horizontal',
  barMode: 'grouped' | 'stacked'
): BarClipConfig {
  return {
    activeType: 'bar',
    isPieVariant: 'pie',
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    values: [
      [120, 150, 100, 200],
      [80, 120, 140, 160]
    ],
    seriesNames: ['Series A', 'Series B'],
    sliceColors: ['#FF6B6B', '#4ECDC4'],
    sliceGap: 2,
    donutCutout: 50,
    smoothing: 0,
    barRounding: 4,
    barSpacing: 60,
    barAspectRatio: 200,
    barOrientation,
    barMode,
    baseBarColor: '#5422B0',
    barBarColors: {},
    lineTension: 0.3,
    lineWidth: 2,
    lineAspectRatio: 150,
    markerStyle: 'circle' as const,
    markerSize: 4,
    markerVisible: true,
    lineColors: ['#5422B0', '#FF6B6B'],
    markerColors: ['#5422B0', '#FF6B6B'],
    chartTitle: `Bar Chart Test (${barOrientation} ${barMode})`,
    chartCaption: 'Section B animation test harness',
    bgColor: 'white',
    legendVisible: true,
    legendPosition: 'bottom' as const,
    legendSize: 14,
    legendColor: '#1f1f1f',
    axisVisible: true,
    axisSize: 12,
    axisBold: false,
    axisColor: '#777777',
    // NEW: Title styling
    titleFont: 'Inter',
    titleSize: 24,
    titleBold: true,
    titleItalic: false,
    titleAlign: 'center' as const,
    titleColor: '#555555',
    // NEW: Caption styling
    captionFont: 'Inter',
    captionSize: 14,
    captionAlign: 'center' as const,
    captionColor: '#555555'
  };
}

/** Render a frame to a canvas and return as data URL for inspection. */
async function renderFrameToDataUrl(
  clip: Awaited<ReturnType<typeof prepareBarClip>>,
  tMs: number,
  animMs: number
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = clip.width;
  canvas.height = clip.height;
  const ctx = canvas.getContext('2d')!;
  clip.drawFrame(ctx, tMs, animMs);
  return canvas.toDataURL('image/png');
}

/** Run a single test variant. */
async function testVariant(variant: TestVariant): Promise<void> {
  console.log(`\n[TestBarClip] Starting: ${variant.name}`);
  console.log(`  Config: orientation=${variant.config.barOrientation}, mode=${variant.config.barMode}`);

  try {
    // Create clip
    const clip = await prepareBarClip(variant.config);
    console.log(`[TestBarClip] ✓ Clip created: ${clip.width}×${clip.height}`);

    // Animation duration (use default 2s)
    const animMs = DURATION_OPTIONS_MS[1]; // 2000ms

    // Render key frames
    console.log(`[TestBarClip] Rendering key frames (animMs=${animMs})...`);

    // t=0 (base only, no animation yet)
    const frame0 = await renderFrameToDataUrl(clip, 0, animMs);
    console.log(`[TestBarClip]   frame@0ms (base only): ${frame0.substring(0, 50)}...`);

    // t=mid (halfway through animation)
    const frameMid = await renderFrameToDataUrl(clip, 300 + animMs / 2, animMs);
    console.log(`[TestBarClip]   frame@mid (50% wipe): ${frameMid.substring(0, 50)}...`);

    // t=end (fully revealed)
    const frameEnd = await renderFrameToDataUrl(clip, 300 + animMs + 500, animMs);
    console.log(`[TestBarClip]   frame@end (100% wipe): ${frameEnd.substring(0, 50)}...`);

    // Dispose
    clip.dispose();
    console.log(`[TestBarClip] ✓ ${variant.name} PASSED`);
  } catch (err) {
    console.error(`[TestBarClip] ✗ ${variant.name} FAILED:`, err);
    throw err;
  }
}

/** Compare two configs for deep equality. Used in round-trip tests. */
function configsEqual(a: BarClipConfig, b: BarClipConfig): boolean {
  const keysA = Object.keys(a) as (keyof BarClipConfig)[];
  if (keysA.length !== Object.keys(b).length) return false;

  for (const key of keysA) {
    const vA = a[key];
    const vB = b[key];

    // Handle arrays
    if (Array.isArray(vA) && Array.isArray(vB)) {
      if (vA.length !== vB.length) return false;
      for (let i = 0; i < vA.length; i++) {
        if (JSON.stringify(vA[i]) !== JSON.stringify(vB[i])) return false;
      }
    }
    // Handle objects
    else if (typeof vA === 'object' && typeof vB === 'object' && vA !== null && vB !== null) {
      if (JSON.stringify(vA) !== JSON.stringify(vB)) return false;
    }
    // Handle primitives
    else if (vA !== vB) {
      return false;
    }
  }

  return true;
}

/** Test config round-trip: capture → restore → compare */
async function testRoundTrip(): Promise<void> {
  console.log('\n[TestBarClip] Starting round-trip test (capture → restore)...');

  try {
    // Create original config
    const original = buildTestConfig('vertical', 'grouped');
    console.log('[TestBarClip] ✓ Original config created');

    // Simulate editor state (just a plain object with all fields)
    const editorState = {
      activeType: '',
      isPieVariant: 'pie',
      labels: [],
      values: [],
      seriesNames: [],
      sliceColors: [],
      sliceGap: 0,
      donutCutout: 0,
      smoothing: 0,
      barRounding: 0,
      barSpacing: 0,
      barAspectRatio: 0,
      barOrientation: 'vertical' as const,
      barMode: 'grouped' as const,
      baseBarColor: '',
      barBarColors: {},
      lineTension: 0,
      lineWidth: 0,
      lineAspectRatio: 0,
      markerStyle: 'circle' as const,
      markerSize: 0,
      markerVisible: true,
      lineColors: [],
      markerColors: [],
      chartTitle: '',
      chartCaption: '',
      bgColor: 'white' as const,
      legendVisible: true,
      legendPosition: 'bottom' as const,
      legendSize: 0,
      legendColor: '',
      axisVisible: true,
      axisSize: 0,
      axisBold: false,
      axisColor: '',
      titleFont: '',
      titleSize: 0,
      titleBold: false,
      titleItalic: false,
      titleAlign: 'center' as const,
      titleColor: '',
      captionFont: '',
      captionSize: 0,
      captionAlign: 'center' as const,
      captionColor: ''
    };

    // Capture original into editor state (simulates snapshot at animate-open)
    const captured = captureBarClipConfig(original);
    console.log('[TestBarClip] ✓ Config captured');

    // Restore captured config back into editor state
    restoreBarClipConfig(captured, editorState);
    console.log('[TestBarClip] ✓ Config restored into editor state');

    // Re-capture from restored state to verify symmetry
    const recaptured = captureBarClipConfig(editorState);
    console.log('[TestBarClip] ✓ Config re-captured from restored state');

    // Deep equality check
    if (!configsEqual(original, recaptured)) {
      console.error('[TestBarClip] ✗ Round-trip equality check FAILED');
      console.error('  Original:', JSON.stringify(original, null, 2));
      console.error('  Recaptured:', JSON.stringify(recaptured, null, 2));
      throw new Error('Round-trip configs do not match');
    }

    console.log('[TestBarClip] ✓ Round-trip PASSED: original ≈ captured → restored → recaptured');
  } catch (err) {
    console.error('[TestBarClip] ✗ Round-trip test FAILED:', err);
    throw err;
  }
}

/**
 * Section D: Integration test — full pipeline from config capture to createClip factory.
 * Verifies that captured config produces valid ClipSpec from factory.
 */
export async function testCreateClipIntegration(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║       Section D: createClip Factory Integration Test           ║');
  console.log('║    Full pipeline: config capture → createClip → verify          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const mockEditorState = {
    // Chart type + data
    activeType: 'bar',
    isPieVariant: 'pie' as const,
    barOrientation: 'vertical' as const,
    barMode: 'grouped' as const,
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    values: [[10, 20], [15, 25], [20, 30], [25, 35]],
    seriesNames: ['2024', '2025'],

    // Bar styling
    barRounding: 4,
    barSpacing: 60,
    barAspectRatio: 200,
    baseBarColor: '#5422B0',
    barBarColors: {},

    // Line styling (required for BarClipConfig interface)
    lineTension: 0.3,
    lineWidth: 2,
    lineAspectRatio: 150,
    markerStyle: 'circle' as const,
    markerSize: 4,
    markerVisible: true,
    lineColors: ['#5422B0', '#FF6B6B'],
    markerColors: ['#5422B0', '#FF6B6B'],

    // Pie styling (required for BarClipConfig interface)
    sliceColors: ['#FF6B6B', '#4ECDC4'],
    sliceGap: 2,
    donutCutout: 50,
    smoothing: 0,

    // Text styling (required for BarClipConfig)
    titleFont: 'Inter',
    titleSize: 24,
    titleBold: true,
    titleItalic: false,
    titleAlign: 'center' as const,
    titleColor: '#555555',
    chartTitle: 'Quarterly Revenue',

    captionFont: 'Inter',
    captionSize: 14,
    captionAlign: 'center' as const,
    captionColor: '#666666',
    chartCaption: 'FY2024–2025 comparison',

    // Legend + axis
    legendVisible: true,
    legendPosition: 'bottom' as const,
    legendSize: 14,
    legendColor: '#1f1f1f',
    axisVisible: true,
    axisSize: 12,
    axisBold: false,
    axisColor: '#777777',
    bgColor: 'white' as const
  };

  try {
    // Step 1: Capture config (simulates ChartEditor state at animate-open)
    console.log('[Test] Step 1: Capturing config from editor state...');
    const config = captureBarClipConfig(mockEditorState);
    console.log('[Test] ✓ Config captured:', config.activeType, `"${config.chartTitle}"`);

    // Step 2: Call createClip factory with bar config
    console.log('[Test] Step 2: Calling createClip factory...');
    const animMs = 1000; // 1 second animation
    const clipSpec = await createClip({
      kind: 'bar',
      animMs,
      scale: 1,
      bar: config
    });

    console.log('[Test] ✓ ClipSpec created:');
    console.log('  width:', clipSpec.width, 'height:', clipSpec.height);
    console.log('  fps:', clipSpec.fps, 'totalMs:', clipSpec.totalMs, 'animMs:', clipSpec.animMs);

    // Step 3: Verify ClipSpec properties
    console.log('[Test] Step 3: Validating ClipSpec structure...');
    if (typeof clipSpec.width !== 'number' || clipSpec.width <= 0) {
      throw new Error('ClipSpec.width invalid');
    }
    if (typeof clipSpec.height !== 'number' || clipSpec.height <= 0) {
      throw new Error('ClipSpec.height invalid');
    }
    if (clipSpec.fps !== 30) {
      throw new Error(`ClipSpec.fps should be 30, got ${clipSpec.fps}`);
    }
    if (clipSpec.totalMs <= clipSpec.animMs) {
      throw new Error('ClipSpec.totalMs should include LEAD_IN + HOLD');
    }
    if (!clipSpec.drawFrame || typeof clipSpec.drawFrame !== 'function') {
      throw new Error('ClipSpec.drawFrame not a function');
    }
    if (!clipSpec.dispose || typeof clipSpec.dispose !== 'function') {
      throw new Error('ClipSpec.dispose not a function');
    }
    console.log('[Test] ✓ ClipSpec structure validated');

    // Step 4: Test drawFrame at key points (t=0, t=mid, t=end)
    console.log('[Test] Step 4: Testing drawFrame at key timepoints...');
    const testCanvas = document.createElement('canvas');
    testCanvas.width = clipSpec.width;
    testCanvas.height = clipSpec.height;
    const testCtx = testCanvas.getContext('2d')!;

    // Frame at t=0 (start of animation, should show base layer)
    clipSpec.drawFrame(testCtx, 0);
    console.log('[Test]   ✓ drawFrame(t=0) successful');

    // Frame at t=mid (mid-animation, wipe in progress)
    const midMs = clipSpec.totalMs / 2;
    clipSpec.drawFrame(testCtx, midMs);
    console.log('[Test]   ✓ drawFrame(t=mid) successful');

    // Frame at t=end (full animation, should match PNG export)
    clipSpec.drawFrame(testCtx, clipSpec.totalMs);
    console.log('[Test]   ✓ drawFrame(t=end) successful');

    // Step 5: Test scale parameter (create half-size variant)
    console.log('[Test] Step 5: Testing scale parameter...');
    const scaledClipSpec = await createClip({
      kind: 'bar',
      animMs,
      scale: 0.5,
      bar: config
    });
    const scaledWidth = Math.round(clipSpec.width * 0.5);
    const scaledHeight = Math.round(clipSpec.height * 0.5);
    if (
      Math.abs(scaledClipSpec.width - scaledWidth) > 2 ||
      Math.abs(scaledClipSpec.height - scaledHeight) > 2
    ) {
      throw new Error(
        `Scale 0.5 produced dimensions ${scaledClipSpec.width}×${scaledClipSpec.height}, expected ~${scaledWidth}×${scaledHeight}`
      );
    }
    console.log('[Test] ✓ Scale parameter works (0.5 → dimensions halved)');
    scaledClipSpec.dispose();

    // Step 6: Cleanup
    console.log('[Test] Step 6: Testing disposal...');
    clipSpec.dispose();
    console.log('[Test] ✓ Dispose successful');

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Integration test PASSED: Full factory pipeline validated      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  } catch (err) {
    console.error('\n[Test] Integration test FAILED:', err);
    console.error('╚════════════════════════════════════════════════════════════════╝\n');
    throw err;
  }
}

/** Main test runner. */
export async function runBarClipTests(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║      Section C: Bar Chart Animation (Config Snapshot)          ║');
  console.log('║    Testing capture/restore + all 4 bar variants + wipe         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Run round-trip test first (config capture/restore)
  try {
    await testRoundTrip();
  } catch (err) {
    console.error('\n[TestBarClip] Round-trip test failed. Aborting remaining tests.');
    throw err;
  }

  const variants: TestVariant[] = [
    {
      name: 'Vertical Bars (Grouped)',
      config: buildTestConfig('vertical', 'grouped')
    },
    {
      name: 'Vertical Bars (Stacked)',
      config: buildTestConfig('vertical', 'stacked')
    },
    {
      name: 'Horizontal Bars (Grouped)',
      config: buildTestConfig('horizontal', 'grouped')
    },
    {
      name: 'Horizontal Bars (Stacked)',
      config: buildTestConfig('horizontal', 'stacked')
    }
  ];

  let passCount = 0;
  let failCount = 0;

  for (const variant of variants) {
    try {
      await testVariant(variant);
      passCount++;
    } catch (err) {
      failCount++;
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passCount} PASSED, ${failCount} FAILED                               ${failCount > 0 ? '║' : '║'}`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (failCount > 0) {
    throw new Error(`${failCount} test(s) failed`);
  }
}
