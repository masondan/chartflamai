import { captureBarClipConfig } from './renderers/bar-chart-setup';
import { createClip } from './createClip';

export async function testEditorAnimationFlow(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║    Section E: ChartEditor → Animation Flow Integration Test    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const mockEditorState = {
    activeType: 'bar' as const,
    isPieVariant: 'pie' as const,
    barOrientation: 'vertical' as const,
    barMode: 'grouped' as const,
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    values: [[100, 120], [150, 180], [200, 210], [180, 190]],
    seriesNames: ['Product A', 'Product B'],
    
    barRounding: 4,
    barSpacing: 60,
    barAspectRatio: 200,
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

    sliceColors: ['#FF6B6B', '#4ECDC4'],
    sliceGap: 2,
    donutCutout: 50,
    smoothing: 0,

    titleFont: 'Inter',
    titleSize: 24,
    titleBold: true,
    titleItalic: false,
    titleAlign: 'center' as const,
    titleColor: '#555555',
    chartTitle: 'Monthly Sales Performance',

    captionFont: 'Inter',
    captionSize: 14,
    captionAlign: 'center' as const,
    captionColor: '#666666',
    chartCaption: 'Q1 2025 Product Comparison',

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
    console.log('[Test] Step 1: Simulating user clicks "Animate" button...');
    const config = captureBarClipConfig(mockEditorState);
    console.log('[Test] ✓ Editor state captured into BarClipConfig');

    console.log('[Test] Step 2: Calling createClip factory (simulating onAnimate handler)...');
    const clipSpec = await createClip({
      kind: 'bar',
      animMs: 1000,
      scale: 1,
      bar: config
    });
    console.log('[Test] ✓ ClipSpec generated:', clipSpec.width, '×', clipSpec.height);

    console.log('[Test] Step 3: Validating ClipSpec is ready for AnimateSection...');
    if (!clipSpec.drawFrame || !clipSpec.dispose) {
      throw new Error('ClipSpec missing drawFrame or dispose');
    }
    console.log('[Test] ✓ ClipSpec ready for Play preview & MP4 export');

    console.log('[Test] Step 4: Simulating AnimateSection renders & calls drawFrame...');
    const canvas = document.createElement('canvas');
    canvas.width = clipSpec.width;
    canvas.height = clipSpec.height;
    const ctx = canvas.getContext('2d')!;

    // Simulate preview playback (three key frames)
    clipSpec.drawFrame(ctx, 0);
    console.log('[Test]   ✓ Frame at t=0 (preview start)');

    clipSpec.drawFrame(ctx, clipSpec.totalMs / 2);
    console.log('[Test]   ✓ Frame at t=mid (preview mid-animation)');

    clipSpec.drawFrame(ctx, clipSpec.totalMs);
    console.log('[Test]   ✓ Frame at t=end (preview complete)');

    console.log('[Test] Step 5: Cleanup (simulating ChartEditor onDestroy)...');
    clipSpec.dispose();
    console.log('[Test] ✓ ClipSpec disposed');

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Integration test PASSED: ChartEditor → Animation UI flow OK  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  } catch (err) {
    console.error('\n[Test] Integration test FAILED:', err);
    console.error('╚════════════════════════════════════════════════════════════════╝\n');
    throw err;
  }
}
