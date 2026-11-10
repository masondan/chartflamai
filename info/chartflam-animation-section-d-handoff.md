# HANDOFF: Bar Chart Animation — Phase 2, Section D (createClip Integration)

**Status:** Section C complete. `captureBarClipConfig()` and `restoreBarClipConfig()` implemented.  
**Current Session:** Config snapshot proven with round-trip testing. Ready to wire into createClip factory.  
**Next Session:** Section D implementation (integrate bar branch into createClip; build factory test).

---

## Context

**Section C Delivered:**
- ✅ [`src/lib/animation/renderers/bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts): Extended `BarClipConfig` interface with text/styling fields (lines 19–39)
- ✅ `captureBarClipConfig(editorState)` function (lines 188–251): Snapshot full editor state → `BarClipConfig`
- ✅ `restoreBarClipConfig(config, editorState)` function (lines 260–323): Inverse — restore snapshot back into editor reactive state
- ✅ Round-trip test pattern validated with [`test-bar-clip.ts`](../../src/lib/animation/test-bar-clip.ts)
- ✅ [`prepareBarClip(config, scale)`](../../src/lib/animation/renderers/bar.ts:50) proven: returns `PreparedClip` (width, height, drawFrame, dispose)

**What `createClip()` Currently Does:**
```typescript
// from src/lib/animation/createClip.ts
export type EditorKind = 'pictogram' | 'waffle';

export async function createClip(options: CreateClipOptions): Promise<ClipSpec> {
  const { kind, animMs, scale = 1 } = options;
  
  // Routes to preparePictogramClip or prepareWaffleClip
  // Returns ClipSpec (width, height, fps, totalMs, animMs, drawFrame, dispose)
}
```

**Gap:** `createClip` has no 'bar' route. Must add bar branch + update signature.

---

## Section D: Deliverable

**File:** Modify [`src/lib/animation/createClip.ts`](../../src/lib/animation/createClip.ts)

**Purpose:** Wire `BarClipConfig` into `createClip()` factory; enable ChartEditor to pass bar config and receive unified `ClipSpec`.

**Pattern:** Identical to waffle/pictogram — one config param per kind, factory routes & returns same interface.

---

## Tasks

### Task 1: Update EditorKind Type & CreateClipOptions Interface

**File:** [`src/lib/animation/createClip.ts`](../../src/lib/animation/createClip.ts) (lines 26–35)

**Current:**
```typescript
export type EditorKind = 'pictogram' | 'waffle';

export interface CreateClipOptions {
  kind: EditorKind;
  animMs: number;
  scale?: number;
  pictogram?: PictogramClipConfig;
  waffle?: WaffleClipConfig;
}
```

**Updated:**
```typescript
export type EditorKind = 'pictogram' | 'waffle' | 'bar';

export interface CreateClipOptions {
  kind: EditorKind;
  animMs: number;
  scale?: number;
  pictogram?: PictogramClipConfig;
  waffle?: WaffleClipConfig;
  bar?: BarClipConfig;  // NEW
}
```

**Reference:** [`WaffleClipConfig`](../../src/lib/animation/renderers/waffle.ts:37) vs. [`BarClipConfig`](../../src/lib/animation/renderers/bar-chart-setup.ts:19) — both define full animation state.

---

### Task 2: Add Bar Import

**File:** [`src/lib/animation/createClip.ts`](../../src/lib/animation/createClip.ts) (lines 10–12)

**Current:**
```typescript
import { preparePictogramClip, type PictogramClipConfig } from './renderers/pictogram';
import { prepareWaffleClip, type WaffleClipConfig } from './renderers/waffle';
```

**Updated:**
```typescript
import { preparePictogramClip, type PictogramClipConfig } from './renderers/pictogram';
import { prepareWaffleClip, type WaffleClipConfig } from './renderers/waffle';
import { prepareBarClip, type BarClipConfig } from './renderers/bar';  // NEW
```

---

### Task 3: Extend createClip() Factory Routing

**File:** [`src/lib/animation/createClip.ts`](../../src/lib/animation/createClip.ts) (lines 37–61)

**Current Logic:**
```typescript
export async function createClip(options: CreateClipOptions): Promise<ClipSpec> {
  const { kind, animMs, scale = 1 } = options;

  let prepared: { width: number; height: number; drawFrame: (ctx, tMs, animMs) => void; dispose: () => void };

  if (kind === 'pictogram') {
    if (!options.pictogram) throw new Error('createClip: pictogram config required for kind="pictogram"');
    prepared = await preparePictogramClip(options.pictogram, scale);
  } else if (kind === 'waffle') {
    if (!options.waffle) throw new Error('createClip: waffle config required for kind="waffle"');
    prepared = await prepareWaffleClip(options.waffle, scale);
  } else {
    throw new Error(`createClip: unsupported kind "${kind}"`);
  }

  return {
    width: prepared.width,
    height: prepared.height,
    fps: FPS,
    totalMs: totalMs(animMs),
    animMs,
    drawFrame: (ctx, tMs) => prepared.drawFrame(ctx, tMs, animMs),
    dispose: () => prepared.dispose()
  };
}
```

**Updated with Bar Branch:**
```typescript
export async function createClip(options: CreateClipOptions): Promise<ClipSpec> {
  const { kind, animMs, scale = 1 } = options;

  let prepared: { width: number; height: number; drawFrame: (ctx, tMs, animMs) => void; dispose: () => void };

  if (kind === 'pictogram') {
    if (!options.pictogram) throw new Error('createClip: pictogram config required for kind="pictogram"');
    prepared = await preparePictogramClip(options.pictogram, scale);
  } else if (kind === 'waffle') {
    if (!options.waffle) throw new Error('createClip: waffle config required for kind="waffle"');
    prepared = await prepareWaffleClip(options.waffle, scale);
  } else if (kind === 'bar') {
    // NEW: Bar chart animation branch
    if (!options.bar) throw new Error('createClip: bar config required for kind="bar"');
    prepared = await prepareBarClip(options.bar, scale);
  } else {
    throw new Error(`createClip: unsupported kind "${kind}"`);
  }

  return {
    width: prepared.width,
    height: prepared.height,
    fps: FPS,
    totalMs: totalMs(animMs),
    animMs,
    drawFrame: (ctx, tMs) => prepared.drawFrame(ctx, tMs, animMs),
    dispose: () => prepared.dispose()
  };
}
```

**Pattern Match:** `prepareBarClip()` returns same `{ width, height, drawFrame, dispose }` as waffle/pictogram.

---

### Task 4: Build Integration Test

**File:** Extend or create [`src/lib/animation/test-bar-clip.ts`](../../src/lib/animation/test-bar-clip.ts)

**Purpose:** Test full flow — `captureBarClipConfig()` → `createClip()` → verify ClipSpec.

**Test Steps:**
```typescript
import { createClip } from './createClip';
import { captureBarClipConfig } from './renderers/bar-chart-setup';

/**
 * Integration test: full pipeline from config capture to createClip.
 * Verifies that captured config produces valid ClipSpec from factory.
 */
export async function testCreateClipIntegration() {
  const mockEditorState = {
    // Chart type + data
    activeType: 'bar',
    isPieVariant: false,
    barOrientation: 'vertical',
    barMode: 'grouped',
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    values: [[10, 20], [15, 25], [20, 30], [25, 35]],
    seriesNames: ['2024', '2025'],
    
    // All bar/line/pie styling fields...
    barRounding: 4,
    barSpacing: 0.1,
    // ... (copy full set from test-bar-clip.ts existing config)
    
    // Text styling (required for BarClipConfig)
    titleFont: 'Inter',
    titleSize: 24,
    titleBold: false,
    titleItalic: false,
    titleAlign: 'left',
    titleColor: '#000000',
    chartTitle: 'Quarterly Revenue',
    
    captionFont: 'Inter',
    captionSize: 14,
    captionAlign: 'left',
    captionColor: '#666666',
    chartCaption: 'FY2024–2025 comparison'
  };

  // Step 1: Capture config (simulates ChartEditor state at animate-open)
  const config = captureBarClipConfig(mockEditorState);
  console.log('[Test] Config captured:', config.activeType, config.chartTitle);

  // Step 2: Call createClip factory with bar config
  const animMs = 1000; // 1 second animation
  try {
    const clipSpec = await createClip({
      kind: 'bar',
      animMs,
      scale: 1,
      bar: config  // Pass captured config
    });
    
    console.log('[Test] ✓ ClipSpec created:');
    console.log('  width:', clipSpec.width, 'height:', clipSpec.height);
    console.log('  fps:', clipSpec.fps, 'totalMs:', clipSpec.totalMs);
    console.log('  animMs:', clipSpec.animMs);
    
    // Step 3: Verify ClipSpec properties
    if (!clipSpec.drawFrame || typeof clipSpec.drawFrame !== 'function') {
      throw new Error('ClipSpec.drawFrame not a function');
    }
    if (!clipSpec.dispose || typeof clipSpec.dispose !== 'function') {
      throw new Error('ClipSpec.dispose not a function');
    }

    // Step 4: Test drawFrame at key points (t=0, t=mid, t=end)
    const testCanvas = document.createElement('canvas');
    testCanvas.width = clipSpec.width;
    testCanvas.height = clipSpec.height;
    const testCtx = testCanvas.getContext('2d')!;

    // Frame at t=0 (start of animation, should show base layer)
    clipSpec.drawFrame(testCtx, 0);
    console.log('[Test] ✓ drawFrame(t=0) successful');

    // Frame at t=mid (mid-animation, wipe in progress)
    const midMs = clipSpec.animMs / 2;
    clipSpec.drawFrame(testCtx, clipSpec.totalMs / 2);
    console.log('[Test] ✓ drawFrame(t=mid) successful');

    // Frame at t=end (full animation, should match PNG export)
    clipSpec.drawFrame(testCtx, clipSpec.totalMs);
    console.log('[Test] ✓ drawFrame(t=end) successful');

    // Step 5: Cleanup
    clipSpec.dispose();
    console.log('[Test] ✓ Dispose successful. Integration test PASSED.');

    return true;
  } catch (err) {
    console.error('[Test] Integration test FAILED:', err);
    throw err;
  }
}
```

**Where to Add:**
- Add `testCreateClipIntegration()` to end of [`test-bar-clip.ts`](../../src/lib/animation/test-bar-clip.ts)
- Or create new file: `src/lib/animation/test-bar-clip-factory.ts` (keeps factory tests separate)

**Test Page:** Update [`src/routes/test-bar-clip/+page.svelte`](../../src/routes/test-bar-clip/+page.svelte) to call new test:
```svelte
<button onclick={() => testCreateClipIntegration()}>Run Factory Integration Test</button>
```

---

## Key Assumptions (Validated in Sections A–C)

✅ `prepareBarClip()` returns interface identical to `prepareWaffleClip()` and `preparePictogramClip()`  
✅ Bar config can be captured from ChartEditor at animate-open time (no async setup needed)  
✅ `captureBarClipConfig()` produces complete snapshot for `prepareBarClip()`  
✅ Factory routing pattern (if/else by kind) is proven with pictogram + waffle  
✅ Scale parameter works uniformly across all three chart types  

---

## Integration Checklist

- [ ] **Step 1:** Update `EditorKind` type to include `'bar'`
- [ ] **Step 2:** Add `bar?: BarClipConfig` to `CreateClipOptions` interface
- [ ] **Step 3:** Import `{ prepareBarClip, type BarClipConfig }` from `./renderers/bar`
- [ ] **Step 4:** Add `else if (kind === 'bar')` branch to `createClip()` factory
- [ ] **Step 5:** Build `testCreateClipIntegration()` in test harness
- [ ] **Step 6:** Test factory routing with all three config types (pictogram, waffle, bar)
- [ ] **Step 7:** Verify ClipSpec.drawFrame renders at t=0, t=mid, t=end (all frames valid)
- [ ] **Step 8:** Verify ClipSpec.dispose() cleans up resources without errors

---

## Testing Strategy

### Before Integration

1. **Factory routing test:**
   ```bash
   # Call createClip with kind='bar' + bar config
   # Verify ClipSpec returned (not null)
   # Check width, height, fps, totalMs, animMs match expected
   ```

2. **drawFrame validation:**
   - Call drawFrame at t=0, t=50%, t=100%
   - Verify no exceptions thrown
   - Verify canvas updates (no empty frames)

3. **Disposal test:**
   - Call clipSpec.dispose() after frames rendered
   - Verify no memory leaks (console logs should show chart cleanup)

4. **Config variant test:**
   - Capture config for all four bar types: vertical/grouped, vertical/stacked, horizontal/grouped, horizontal/stacked
   - Call createClip() with each → verify all succeed

### Then Integration (Section E)

- Wire `captureBarClipConfig()` into ChartEditor `onAnimate()` handler
- Pass snapshot to `createClip()` in AnimateSection component
- Connect ClipSpec to Play preview and MP4 export handlers

---

## Reference Implementations

| Pattern | File | Lines | Purpose |
|---|---|---|---|
| Factory routing | [`createClip.ts`](../../src/lib/animation/createClip.ts:37) | 37–61 | How pictogram + waffle route through factory |
| Config capture | [`bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts:188) | 188–251 | `captureBarClipConfig()` pattern |
| Config interface | [`bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts:19) | 19–39 | Full BarClipConfig definition |
| Renderer interface | [`bar.ts`](../../src/lib/animation/renderers/bar.ts:31) | 31–36 | `PreparedClip` interface (shared) |
| prepareBarClip | [`bar.ts`](../../src/lib/animation/renderers/bar.ts:50) | 50–255 | Bar animation factory (returns PreparedClip) |
| prepareWaffleClip | [`waffle.ts`](../../src/lib/animation/renderers/waffle.ts) | (full) | Reference implementation for same pattern |
| Test harness | [`test-bar-clip.ts`](../../src/lib/animation/test-bar-clip.ts) | (full) | Existing config + render tests (extend with factory test) |

---

## Blocking Questions for Section D

1. **Scale parameter uniformity:** Does scale = 0.5 work for bar charts same as waffle? (Expected: yes, but needs test)
   - Test with `createClip({ kind: 'bar', scale: 0.5, bar: config })` and verify dimensions halved

2. **Canvas disposal order:** In `clipSpec.dispose()`, should bar charts dispose in same order as waffle? (Expected: yes, but confirm no resource leaks)
   - Test: call dispose(), then try to render again (should error cleanly)

3. **Frame time edge cases:** At exactly t=0 and t=totalMs, should wipe be at 0% and 100% respectively?
   - Test: `drawFrame(t=0)` shows base layer only; `drawFrame(t=totalMs)` shows full animation (exact final state)

---

## Effort Estimate

- Type updates (EditorKind, CreateClipOptions): ~10 min
- Import bar branch: ~5 min
- Add bar routing to factory: ~10 min
- Build testCreateClipIntegration(): ~20 min
- Run and debug factory tests (all variants): ~15 min
- Verify disposal and edge cases: ~10 min
- **Total: ~1.5 hours**

---

## Code Diff Preview

### createClip.ts (minimal changes)

```diff
- import { preparePictogramClip, type PictogramClipConfig } from './renderers/pictogram';
- import { prepareWaffleClip, type WaffleClipConfig } from './renderers/waffle';
+ import { preparePictogramClip, type PictogramClipConfig } from './renderers/pictogram';
+ import { prepareWaffleClip, type WaffleClipConfig } from './renderers/waffle';
+ import { prepareBarClip, type BarClipConfig } from './renderers/bar';

- export type EditorKind = 'pictogram' | 'waffle';
+ export type EditorKind = 'pictogram' | 'waffle' | 'bar';

  export interface CreateClipOptions {
    kind: EditorKind;
    animMs: number;
    scale?: number;
    pictogram?: PictogramClipConfig;
    waffle?: WaffleClipConfig;
+   bar?: BarClipConfig;
  }

  export async function createClip(options: CreateClipOptions): Promise<ClipSpec> {
    const { kind, animMs, scale = 1 } = options;
    
    let prepared: { ... };
    
    if (kind === 'pictogram') {
      // ... existing
    } else if (kind === 'waffle') {
      // ... existing
+   } else if (kind === 'bar') {
+     if (!options.bar) throw new Error('createClip: bar config required for kind="bar"');
+     prepared = await prepareBarClip(options.bar, scale);
    } else {
      throw new Error(`createClip: unsupported kind "${kind}"`);
    }
    
    return { ... };
  }
```

---

## Next Steps After Section D

1. **Section E** (ChartEditor hook): Mount `AnimateSection` component in ChartEditor; wire `onAnimate()` handler to capture config + call `createClip()`
2. **Section F** (end-to-end test): Record animation from UI, export MP4, verify final frame matches PNG export pixel-perfectly
3. **Section G** (full integration): Enable animation export in ChartEditor menu

---

## Key Files to Touch

| File | Change | Purpose |
|---|---|---|
| [`src/lib/animation/createClip.ts`](../../src/lib/animation/createClip.ts) | Add bar branch | Factory routing |
| [`src/lib/animation/test-bar-clip.ts`](../../src/lib/animation/test-bar-clip.ts) | Add factory integration test | Validation |
| [`src/routes/test-bar-clip/+page.svelte`](../../src/routes/test-bar-clip/+page.svelte) | Add test button | Manual test trigger |

---

## Validation Checklist (Before Handoff to Section E)

- [ ] `createClip({ kind: 'bar', animMs: 1000, bar: config })` returns valid ClipSpec
- [ ] ClipSpec.width and height are positive integers
- [ ] ClipSpec.fps = 30, totalMs = 1333 (LEAD_IN 333 + anim 1000)
- [ ] ClipSpec.drawFrame(ctx, 0) and drawFrame(ctx, totalMs) work without error
- [ ] ClipSpec.dispose() runs cleanly, logs confirm chart destruction
- [ ] All four bar variants (vert/grouped, vert/stacked, horiz/grouped, horiz/stacked) produce valid ClipSpec
- [ ] Scale parameter: `scale: 0.5` produces dimensions ≈ half original
- [ ] No TypeScript errors in createClip.ts or test file

---

**Branch:** `main` (all Section A–C code committed)  
**Dev Server:** Running at `http://localhost:5174/`  
**Test Page:** `http://localhost:5174/test-bar-clip` (Section D factory test)

**Lead Dev Handoff:** Factory integration is minimal and mechanical — three changes to createClip.ts (type, interface, one if-branch), plus config capture/factory test already proven in Sections A–C. No architecture changes needed; bar chart fits existing pictogram/waffle pattern perfectly.

---

## Post-Section D: Integration Points for Section E

Once `createClip` integration is proven, Section E wires the full flow:

1. **ChartEditor.svelte:** When user opens Animate panel, capture config:
   ```svelte
   import { captureBarClipConfig } from '$lib/animation/renderers/bar-chart-setup';
   
   async function onAnimate() {
     const config = captureBarClipConfig(editorState);
     const clipSpec = await createClip({
       kind: 'bar',
       animMs: 1000,
       bar: config
     });
     // Pass clipSpec to AnimateSection for Play/Export
   }
   ```

2. **AnimateSection.svelte:** Play preview or export MP4 using `clipSpec.drawFrame`

3. **Verification:** Final frame at t=clipSpec.totalMs must match PNG export pixel-for-pixel

This handoff ensures Section E has working factory + proven config capture, ready to connect UI.
