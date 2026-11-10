/**
 * Section A Test Harness for bar-chart-setup.ts
 *
 * Usage: call testBarChartSetup() from console or a test component
 * to validate that chartArea populates, hidden-data renders, and all
 * bar variants work correctly.
 *
 * Run in browser console: await window.testBarChartSetup?.()
 */

import { createHiddenDataRender, type BarClipConfig } from './renderers/bar-chart-setup';
import type { Chart } from 'chart.js/auto';

/** Simple test config builder. */
function buildTestConfig(
  barOrientation: 'vertical' | 'horizontal' = 'vertical',
  barMode: 'grouped' | 'stacked' = 'grouped'
): BarClipConfig {
  return {
    // Chart type
    activeType: 'bar',
    isPieVariant: 'pie',

    // Data (3 series, 4 items)
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    values: [[10, 20, 15, 30], [15, 25, 20, 28], [8, 12, 18, 22]],
    seriesNames: ['Series A', 'Series B', 'Series C'],

    // Pie/Donut (not used for bars but required by interface)
    sliceColors: ['#5422b0'],
    sliceGap: 0,
    donutCutout: 50,
    smoothing: 5,

    // Bar
    barRounding: 10,
    barSpacing: 80,
    barAspectRatio: 100,
    barOrientation,
    barMode,
    baseBarColor: '#5422b0',
    barBarColors: {},

    // Line (not used for bars but required by interface)
    lineTension: 0,
    lineWidth: 3,
    lineAspectRatio: 100,
    markerStyle: 'circle',
    markerSize: 5,
    markerVisible: true,
    lineColors: ['#5422b0'],
    markerColors: ['#5422b0'],

    // Text & appearance
    chartTitle: `Test ${barOrientation === 'vertical' ? 'Vertical' : 'Horizontal'} ${barMode === 'stacked' ? 'Stacked' : 'Grouped'} Bars`,
    chartCaption: 'Section A validation test',
    bgColor: 'white',
    legendVisible: true,
    legendPosition: 'bottom',
    legendSize: 12,
    legendColor: '#555555',
    axisVisible: true,
    axisSize: 12,
    axisBold: false,
    axisColor: '#555555',

    // NEW: Title styling
    titleFont: 'Inter',
    titleSize: 24,
    titleBold: true,
    titleItalic: false,
    titleAlign: 'center',
    titleColor: '#555555',

    // NEW: Caption styling
    captionFont: 'Inter',
    captionSize: 14,
    captionAlign: 'center',
    captionColor: '#555555'
  };
}

/** Test result. */
interface TestResult {
  name: string;
  passed: boolean;
  chartAreaBounds: { left: number; top: number; width: number; height: number } | null;
  errors: string[];
  normalImageSize: number;
  hiddenImageSize: number;
}

/** Run a single test. */
async function runSingleTest(
  testName: string,
  config: BarClipConfig,
  canvasWidth: number = 1080,
  canvasHeight: number = 600
): Promise<TestResult> {
  const result: TestResult = {
    name: testName,
    passed: false,
    chartAreaBounds: null,
    errors: [],
    normalImageSize: 0,
    hiddenImageSize: 0
  };

  try {
    console.log(`\n[BAR-SETUP-TEST] Starting: ${testName}`);

    const renderResult = await createHiddenDataRender(config, canvasWidth, canvasHeight);

    // Check chartArea
    const { chartAreaBounds } = renderResult;
    if (!chartAreaBounds || chartAreaBounds.width === 0 || chartAreaBounds.height === 0) {
      result.errors.push(`Invalid chartAreaBounds: ${JSON.stringify(chartAreaBounds)}`);
    } else {
      result.chartAreaBounds = chartAreaBounds;
      console.log(`[BAR-SETUP-TEST] ✓ chartArea bounds: left=${chartAreaBounds.left}, top=${chartAreaBounds.top}, width=${chartAreaBounds.width}, height=${chartAreaBounds.height}`);
    }

    // Capture normal render
    let normalImage: string | undefined;
    try {
      normalImage = renderResult.normalChart.toBase64Image();
      result.normalImageSize = normalImage.length;
      console.log(`[BAR-SETUP-TEST] ✓ Normal render captured (${normalImage.length} bytes)`);
    } catch (e) {
      result.errors.push(`Failed to capture normal render: ${e}`);
    }

    // Capture hidden render
    let hiddenImage: string | undefined;
    try {
      hiddenImage = renderResult.hiddenCanvas.toDataURL('image/png');
      result.hiddenImageSize = hiddenImage.length;
      console.log(`[BAR-SETUP-TEST] ✓ Hidden render captured (${hiddenImage.length} bytes)`);
    } catch (e) {
      result.errors.push(`Failed to capture hidden render: ${e}`);
    }

    // Verify images are different (normal should have color, hidden should be grey)
    if (normalImage && hiddenImage && normalImage === hiddenImage) {
      result.errors.push('Normal and hidden renders are identical — data hiding may have failed');
    } else if (normalImage && hiddenImage) {
      console.log(`[BAR-SETUP-TEST] ✓ Normal and hidden renders differ (hidden is greyed)`);
    }

    // Cleanup
    renderResult.normalChart.destroy();
    console.log(`[BAR-SETUP-TEST] ✓ Charts disposed`);

    result.passed = result.errors.length === 0;
    console.log(`[BAR-SETUP-TEST] ${result.passed ? '✅ PASSED' : '❌ FAILED'}: ${testName}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(errMsg);
    console.error(`[BAR-SETUP-TEST] ❌ EXCEPTION: ${testName}`, err);
  }

  return result;
}

/** Main test entry point. */
export async function testBarChartSetup(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('SECTION A: Bar Chart Setup & Two-Render Strategy Test');
  console.log('='.repeat(70));

  const results: TestResult[] = [];

  // Test 1: Vertical bars, grouped
  results.push(
    await runSingleTest(
      'Vertical Bars (Grouped)',
      buildTestConfig('vertical', 'grouped')
    )
  );

  // Test 2: Vertical bars, stacked
  results.push(
    await runSingleTest(
      'Vertical Bars (Stacked)',
      buildTestConfig('vertical', 'stacked')
    )
  );

  // Test 3: Horizontal bars, grouped
  results.push(
    await runSingleTest(
      'Horizontal Bars (Grouped)',
      buildTestConfig('horizontal', 'grouped')
    )
  );

  // Test 4: Horizontal bars, stacked
  results.push(
    await runSingleTest(
      'Horizontal Bars (Stacked)',
      buildTestConfig('horizontal', 'stacked')
    )
  );

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((r) => {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${r.name}`);
    if (r.chartAreaBounds) {
      console.log(
        `     └─ chartArea: ${r.chartAreaBounds.width}×${r.chartAreaBounds.height} @ (${r.chartAreaBounds.left}, ${r.chartAreaBounds.top})`
      );
    }
    if (r.errors.length > 0) {
      r.errors.forEach((err) => console.log(`     └─ ⚠️  ${err}`));
    }
  });

  console.log(`\n${passed}/${results.length} tests passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (failed === 0) {
    console.log('🎉 Section A ready! All chartArea + two-render tests passed.');
    console.log('Proceed to Section B (wipe math) when ready.');
  } else {
    console.log('❌ Section A has failures. Review errors above and fix before Section B.');
  }

  // Expose results globally for inspection
  (globalThis as any).barSetupTestResults = results;
  console.log('\n📋 Full results available at: window.barSetupTestResults');
}

// Export for use in browser console
if (typeof globalThis !== 'undefined') {
  (globalThis as any).testBarChartSetup = testBarChartSetup;
}
