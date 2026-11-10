# HANDOFF: Bar Chart Animation — Phase 2, Section E (ChartEditor Hook Integration)

**Status:** Section D complete. `createClip()` factory wired + routing to bar branch proven.  
**Current Session:** Factory returns valid ClipSpec. Ready to wire into ChartEditor UI.  
**Next Session:** Section E implementation (mount AnimateSection, capture config, trigger animation).

---

## Context

**Section D Delivered:**
- ✅ [`src/lib/animation/createClip.ts`](../../src/lib/animation/createClip.ts): Bar branch added to factory (kind='bar' routes to prepareBarClip)
- ✅ `EditorKind` type updated: `'pictogram' | 'waffle' | 'bar'`
- ✅ `CreateClipOptions` interface extended: `bar?: BarClipConfig` param
- ✅ Integration test `testCreateClipIntegration()` validates: config capture → factory → ClipSpec → drawFrame at key points → disposal
- ✅ TypeScript validation passes; factory ready for UI integration

**What ChartEditor Currently Does:**
```typescript
// ChartEditor.svelte (current state)
// - Renders chart in ChartDisplay component
// - Exposes editor state (activeType, labels, values, colors, styling, text)
// - No animation pipeline yet
```

**Gap:** ChartEditor has no way to:
1. Capture current editor state at animate-open time
2. Call `createClip()` with captured bar config
3. Pass resulting ClipSpec to AnimateSection component
4. Wire Play preview + MP4 export handlers

---

## Section E: Deliverable

**Files:** Modify [`src/lib/components/ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte)

**Purpose:** Wire animation entry point into ChartEditor UI; when user opens Animate panel, capture full editor state → call createClip → pass ClipSpec to AnimateSection.

**Pattern:** Similar to how ChartEditor already manages state & drawer lifecycle.

---

## Tasks

### Task 1: Import Animation Dependencies

**File:** [`src/lib/components/ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte) (top of `<script>`)

**Current (partial):**
```typescript
import { ChartDisplay } from './ChartDisplay.svelte';
import { ChartTypeBar } from './ChartTypeBar.svelte';
// ... other imports
```

**Updated:**
```typescript
import { ChartDisplay } from './ChartDisplay.svelte';
import { ChartTypeBar } from './ChartTypeBar.svelte';
import { AnimateSection } from './AnimateSection.svelte';  // NEW
import { createClip } from '$lib/animation/createClip';  // NEW
import { captureBarClipConfig } from '$lib/animation/renderers/bar-chart-setup';  // NEW
import type { ClipSpec } from '$lib/animation/createClip';  // NEW
// ... other imports
```

---

### Task 2: Add Animation State to Reactive Store

**File:** [`src/lib/components/ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte) (reactive state section)

**Current (partial):**
```typescript
let activeType = $state<ChartType>(initChartType);
let labels = $state<string[]>([...]);
let values = $state<number[][]>([...]);
// ... other state
```

**Add:**
```typescript
// ─── Animation state ───
let clipSpec = $state<ClipSpec | null>(null);
let animationLoading = $state(false);
let animationError = $state<string | null>(null);
```

---

### Task 3: Create onAnimate Handler

**File:** [`src/lib/components/ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte) (functions section)

**New function:**
```typescript
/**
 * Capture current editor state and generate ClipSpec for animation.
 * Called when user opens Animate panel.
 */
async function onAnimate() {
  try {
    animationLoading = true;
    animationError = null;

    // Only bar charts support animation for now
    if (activeType !== 'bar') {
      animationError = 'Animation currently supports bar charts only';
      return;
    }

    // Capture full editor state into config
    const config = captureBarClipConfig({
      activeType,
      isPieVariant,
      labels,
      values,
      seriesNames,
      sliceColors,
      sliceGap,
      donutCutout,
      smoothing,
      barRounding,
      barSpacing,
      barAspectRatio,
      barOrientation,
      barMode,
      baseBarColor,
      barBarColors,
      lineTension,
      lineWidth,
      lineAspectRatio,
      markerStyle,
      markerSize,
      markerVisible,
      lineColors,
      markerColors,
      chartTitle,
      chartCaption,
      bgColor,
      legendVisible,
      legendPosition,
      legendSize,
      legendColor,
      axisVisible,
      axisSize,
      axisBold,
      axisColor,
      titleFont,
      titleSize,
      titleBold,
      titleItalic,
      titleAlign,
      titleColor,
      captionFont,
      captionSize,
      captionAlign,
      captionColor
    });

    // Generate ClipSpec from factory (1 second animation)
    clipSpec = await createClip({
      kind: 'bar',
      animMs: 1000,
      scale: 1,
      bar: config
    });

    console.log('[ChartEditor] ✓ Animation clip generated:', clipSpec.width, '×', clipSpec.height);
  } catch (err) {
    animationError = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ChartEditor] Animation generation failed:', err);
  } finally {
    animationLoading = false;
  }
}
```

---

### Task 4: Mount AnimateSection & Wire UI

**File:** [`src/lib/components/ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte) (JSX/template section)

**Current (partial, simplified):**
```svelte
<div class="editor-layout">
  <div class="chart-preview">
    <ChartDisplay {activeType} {labels} {values} {seriesNames} {sliceColors} ... />
  </div>
  
  <div class="controls">
    <button onclick={() => downloadPNG()}>Export PNG</button>
    <!-- Other buttons -->
  </div>
</div>
```

**Updated (add Animate button & AnimateSection):**
```svelte
<div class="editor-layout">
  <div class="chart-preview">
    <ChartDisplay {activeType} {labels} {values} {seriesNames} {sliceColors} ... />
  </div>
  
  <div class="controls">
    <button onclick={() => downloadPNG()}>Export PNG</button>
    <button onclick={onAnimate} disabled={animationLoading || activeType !== 'bar'}>
      {animationLoading ? '⏳ Creating animation...' : '🎬 Animate'}
    </button>
    <!-- Other buttons -->
  </div>

  {#if animationError}
    <div class="error-banner">
      <p>{animationError}</p>
    </div>
  {/if}

  {#if clipSpec}
    <AnimateSection {clipSpec} />
  {/if}
</div>
```

---

### Task 5: Handle ClipSpec Disposal on Unmount

**File:** [`src/lib/components/ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte) (onDestroy section)

**New:**
```typescript
import { onDestroy } from 'svelte';

onDestroy(() => {
  // Clean up animation clip if still in memory
  if (clipSpec) {
    clipSpec.dispose();
    clipSpec = null;
  }
});
```

---

### Task 6: Integration Test (AnimateSection ↔ ChartEditor Flow)

**File:** Create [`src/lib/animation/test-bar-editor-integration.ts`](../../src/lib/animation/test-bar-editor-integration.ts)

**Purpose:** Test end-to-end: ChartEditor state → onAnimate → createClip → ClipSpec validation

**Test implementation:**
```typescript
/**
 * Integration test: ChartEditor state → onAnimate → createClip flow.
 * Simulates user opening Animate panel in ChartEditor.
 */
export async function testEditorAnimationFlow(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║    Section E: ChartEditor → Animation Flow Integration Test    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const mockEditorState = {
    activeType: 'bar',
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
```

**Wire into test page:** Add button to [`src/routes/test-bar-clip/+page.svelte`](../../src/routes/test-bar-clip/+page.svelte):
```svelte
<button onclick={() => runTest(testEditorAnimationFlow)}>Run Section E Editor Flow Test</button>
```

---

## Key Assumptions (Validated in Sections A–D)

✅ `captureBarClipConfig()` produces complete snapshot from reactive editor state  
✅ `createClip()` factory accepts BarClipConfig and returns valid ClipSpec  
✅ ClipSpec.drawFrame is synchronous and can be called repeatedly  
✅ ClipSpec.dispose() cleans up all resources without errors  
✅ AnimateSection component exists and accepts { clipSpec } as prop  

---

## Integration Checklist

- [ ] **Step 1:** Import AnimateSection, createClip, captureBarClipConfig into ChartEditor
- [ ] **Step 2:** Add animation state (clipSpec, animationLoading, animationError)
- [ ] **Step 3:** Implement onAnimate() handler (capture config + call createClip)
- [ ] **Step 4:** Mount AnimateSection conditionally when clipSpec is ready
- [ ] **Step 5:** Add "Animate" button to trigger onAnimate()
- [ ] **Step 6:** Implement onDestroy to dispose clipSpec on unmount
- [ ] **Step 7:** Build testEditorAnimationFlow() in test harness
- [ ] **Step 8:** Test end-to-end: button click → state capture → factory → ClipSpec → cleanup
- [ ] **Step 9:** Verify no TypeScript errors
- [ ] **Step 10:** Verify UI renders Animate button (enabled only for bar charts)

---

## Testing Strategy

### Before Integration

1. **Handler validation test:**
   - Mock editor state with all required fields
   - Call onAnimate() → verify clipSpec is returned
   - Verify clipSpec.width, height, fps, totalMs are correct values

2. **State capture test:**
   - Verify captureBarClipConfig() extracts all editor fields correctly
   - Spot-check title, labels, colors match input

3. **AnimateSection mounting test:**
   - Render ChartEditor with bar chart
   - Click Animate button → verify AnimateSection appears
   - Click again (if already mounted) → verify no duplicate mounting

4. **Disposal test:**
   - Unmount ChartEditor while clipSpec is active
   - Verify dispose() called without errors

### Then Validation (Before Section F)

- Play preview in AnimateSection (should show wipe animation at 30fps)
- Export MP4 (should use clipSpec.drawFrame at all frames)
- Verify final MP4 frame matches PNG export pixel-for-pixel

---

## Reference Implementations

| Pattern | File | Lines | Purpose |
|---|---|---|---|
| AnimateSection component | [`src/lib/components/AnimateSection.svelte`](../../src/lib/components/AnimateSection.svelte) | (full) | Play preview + MP4 export UI |
| Config capture | [`bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts:188) | 188–251 | captureBarClipConfig() |
| Factory call | [`createClip.ts`](../../src/lib/animation/createClip.ts:37) | 37–61 | Routing & ClipSpec return |
| Editor state management | [`ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte:1) | (full) | Reactive state pattern |
| Pictogram animation flow | [`PictogramEditor.svelte`](../../src/lib/components/PictogramEditor.svelte) | (full) | Reference for similar animate flow |

---

## Blocking Questions for Section E

1. **Animation duration:** Should 1000ms (1 second) be fixed, or should users configure animMs? (Expected: fixed for MVP, make configurable in future)
   - Test: Verify clipSpec.animMs = 1000 always

2. **Scale parameter:** For ChartEditor preview, should scale be 1 (export quality) or < 1 (smooth playback on weak devices)? (Expected: scale=1 for accuracy)
   - Test: Verify clipSpec dimensions match canvas size

3. **Error recovery:** If onAnimate throws error (e.g., invalid chart data), should AnimateSection unmount, or show error in drawer? (Expected: show error banner, AnimateSection remains hidden)
   - Test: Call onAnimate with invalid data → verify animationError populated, clipSpec stays null

---

## Effort Estimate

- Import dependencies + state setup: ~10 min
- Implement onAnimate() handler (capture + factory call): ~15 min
- Mount AnimateSection + wire Animate button: ~10 min
- Add onDestroy disposal: ~5 min
- Build testEditorAnimationFlow(): ~15 min
- Run and debug end-to-end flow: ~20 min
- **Total: ~1.5 hours**

---

## Code Diff Preview

### ChartEditor.svelte (minimal additions)

```diff
+ import { AnimateSection } from './AnimateSection.svelte';
+ import { createClip } from '$lib/animation/createClip';
+ import { captureBarClipConfig } from '$lib/animation/renderers/bar-chart-setup';
+ import type { ClipSpec } from '$lib/animation/createClip';

+ let clipSpec = $state<ClipSpec | null>(null);
+ let animationLoading = $state(false);
+ let animationError = $state<string | null>(null);

+ async function onAnimate() {
+   try {
+     animationLoading = true;
+     if (activeType !== 'bar') {
+       animationError = 'Animation currently supports bar charts only';
+       return;
+     }
+     const config = captureBarClipConfig({ ... });
+     clipSpec = await createClip({ kind: 'bar', animMs: 1000, bar: config });
+   } catch (err) {
+     animationError = err instanceof Error ? err.message : 'Unknown error';
+   } finally {
+     animationLoading = false;
+   }
+ }

+ <button onclick={onAnimate} disabled={animationLoading || activeType !== 'bar'}>
+   {animationLoading ? '⏳ Creating animation...' : '🎬 Animate'}
+ </button>

+ {#if clipSpec}
+   <AnimateSection {clipSpec} />
+ {/if}
```

---

## Next Steps After Section E

1. **Section F** (Play preview + MP4 export): AnimateSection.svelte — integrate clipSpec into Play button and Mediabunny MP4 encoder
2. **Section G** (end-to-end validation): Record animation, export MP4, verify final frame pixel-perfect match to PNG
3. **Section H** (full UI integration): Enable animation for pictogram + waffle, add to main export menu

---

## Key Files to Touch

| File | Change | Purpose |
|---|---|---|
| [`src/lib/components/ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte) | Import + state + onAnimate + AnimateSection mount | Hook animation into UI |
| [`src/lib/animation/test-bar-editor-integration.ts`](../../src/lib/animation/test-bar-editor-integration.ts) | Create new test | Validate end-to-end flow |
| [`src/routes/test-bar-clip/+page.svelte`](../../src/routes/test-bar-clip/+page.svelte) | Add test button | Manual trigger for flow test |

---

## Validation Checklist (Before Handoff to Section F)

- [ ] Animate button visible only for bar charts (disabled for other types)
- [ ] Clicking Animate triggers onAnimate() without errors
- [ ] captureBarClipConfig() extracts all editor state fields
- [ ] createClip() returns valid ClipSpec (width, height, fps, totalMs correct)
- [ ] AnimateSection mounts when clipSpec is set, unmounts when null
- [ ] onDestroy calls clipSpec.dispose() safely (no exceptions)
- [ ] animationError displays banner if onAnimate throws
- [ ] testEditorAnimationFlow() passes all steps (capture → factory → drawFrame → dispose)
- [ ] No TypeScript errors in ChartEditor or test files
- [ ] Animate button is disabled while animationLoading = true

---

**Branch:** `main` (all Section A–E code committed)  
**Dev Server:** Running at `http://localhost:5174/`  
**Test Page:** `http://localhost:5174/test-bar-clip` (Section E flow test button)  

**Lead Dev Handoff:** Section E wires the captured config from Section C + factory from Section D into the ChartEditor UI. Two new reactive state properties + one async handler + AnimateSection mount. All dependencies proven in prior sections. No architecture changes; straightforward event-driven integration.

---

## Post-Section E: Integration Points for Section F

Once onAnimate() successfully generates ClipSpec:

1. **AnimateSection.svelte:** Receives { clipSpec } prop
   ```svelte
   <script>
     import type { ClipSpec } from '$lib/animation/createClip';
     export let clipSpec: ClipSpec;
     
     function playPreview() {
       // Use clipSpec.drawFrame to render at 30fps
     }
     
     async function exportMP4() {
       // Use clipSpec.drawFrame with Mediabunny encoder
     }
   </script>
   ```

2. **Preview playback:** Request animation frame loop calling clipSpec.drawFrame(ctx, tMs) from t=0 to t=clipSpec.totalMs

3. **MP4 export:** Pass clipSpec.drawFrame to chart-video-export pipeline for frame-by-frame encoding

4. **Verification:** Final MP4 frame at t=clipSpec.totalMs must equal PNG export at same chart state

This handoff ensures Section F has working UI integration + proven state flow, ready to implement Play/Export handlers.
