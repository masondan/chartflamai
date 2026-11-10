# HANDOFF: Bar Chart Animation — Phase 2, Section C (Config Snapshot)

**Status:** Section B complete. `prepareBarClip()` implemented with feathered wipe geometry.  
**Current Session:** Wipe mechanics proven on all four bar variants. Ready to capture state.  
**Next Session:** Section C implementation (snapshot BarClipConfig from ChartEditor; restore for animation).

---

## Context

**Section B Delivered:**
- ✅ [`src/lib/animation/renderers/bar.ts`](../../src/lib/animation/renderers/bar.ts): Full `prepareBarClip()` with two-render compositing (194 lines)
- ✅ Two-layer base + animated compositing pattern (matches waffle.ts exactly)
- ✅ Feathered wipe geometry for all four bar variants (vertical/horizontal × grouped/stacked)
- ✅ [`src/lib/animation/test-bar-clip.ts`](../../src/lib/animation/test-bar-clip.ts): Test harness validating all variants
- ✅ [`src/routes/test-bar-clip/+page.svelte`](../../src/routes/test-bar-clip/+page.svelte): Interactive test page

**What prepareBarClip() Expects:**
```typescript
export async function prepareBarClip(
  config: BarClipConfig,  // Full ChartEditor state snapshot
  scale = 1
): Promise<PreparedClip>;
```

**BarClipConfig Interface** (from [`bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts) line 19):
```typescript
export interface BarClipConfig extends BarChartConfigParams {
  // All BarChartConfigParams fields already present:
  // - Chart type: activeType, isPieVariant, barOrientation, barMode
  // - Data: labels, values, seriesNames
  // - Styling: all bar/line/pie colors, sizing, axis props
  // Note: No title/caption/legend fields yet — must extend interface!
}
```

---

## Section C: Deliverable

**File:** Extend [`src/lib/animation/renderers/bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts)

**Purpose:** Capture full BarClipConfig from ChartEditor state at animate-open time; restore for previews/replays.

**Tasks:**

### Task 1: Extend BarClipConfig Interface
Add missing text/appearance fields to support base layer rendering:

```typescript
export interface BarClipConfig extends BarChartConfigParams {
  // Existing BarChartConfigParams fields (inherited)
  
  // NEW: Title styling (required for base layer)
  titleFont: string;
  titleSize: number;
  titleBold: boolean;
  titleItalic: boolean;
  titleAlign: 'left' | 'center' | 'right';
  titleColor: string;
  
  // NEW: Caption styling (required for base layer)
  captionFont: string;
  captionSize: number;
  captionAlign: 'left' | 'center' | 'right';
  captionColor: string;
}
```

**Reference:** [`WaffleClipConfig`](../../src/lib/animation/renderers/waffle.ts:37) (lines 37–66) shows the complete pattern.

### Task 2: Build Config Capture Function
Create helper in [`bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts):

```typescript
/**
 * Capture full ChartEditor state as BarClipConfig snapshot.
 * Call at animate-open time (before rendering preview/export).
 * Ensures animation matches editor state at that moment.
 */
export function captureBarClipConfig(
  editorState: ChartEditorState  // All editor reactive values
): BarClipConfig {
  return {
    // Chart type + data (from active chart)
    activeType: editorState.activeType,
    isPieVariant: editorState.isPieVariant,
    labels: editorState.labels,
    values: editorState.values,
    seriesNames: editorState.seriesNames,
    
    // Bar styling
    barOrientation: editorState.barOrientation,
    barMode: editorState.barMode,
    barRounding: editorState.barRounding,
    // ... (all bar/line/pie fields from BarChartConfigParams)
    
    // NEW: Text styling (base layer)
    titleFont: editorState.titleFont,
    titleSize: editorState.titleSize,
    titleBold: editorState.titleBold,
    titleItalic: editorState.titleItalic,
    titleAlign: editorState.titleAlign,
    titleColor: editorState.titleColor,
    captionFont: editorState.captionFont,
    captionSize: editorState.captionSize,
    captionAlign: editorState.captionAlign,
    captionColor: editorState.captionColor
  };
}
```

**Reference:** Waffle pattern — look at how `WaffleChartEditor.downloadWaffle` (or animation call point) captures state → pass to `prepareWaffleClip()`.

### Task 3: Build Config Restore Function
Create inverse helper:

```typescript
/**
 * Restore BarClipConfig snapshot back into ChartEditor state.
 * Used for replay/undo after exporting animation.
 */
export function restoreBarClipConfig(
  config: BarClipConfig,
  editorState: ChartEditorState
): void {
  editorState.activeType = config.activeType;
  editorState.labels = config.labels;
  editorState.values = config.values;
  // ... (update all reactive fields)
  editorState.titleFont = config.titleFont;
  // ... (restore text styling)
}
```

---

## Key Assumptions (Validated in Sections A–B)

✅ BarChartConfigParams covers all data/styling fields  
✅ prepareBarClip() builds full chart from config without editor context  
✅ Text/appearance fields must be captured separately (not in BarChartConfigParams)  
✅ Snapshot-at-open-time pattern matches existing waffle flow  

---

## Reference Implementations

| Pattern | File | Lines | Purpose |
|---|---|---|---|
| Config capture | `WaffleChartEditor.svelte` | (search for animation handler) | How waffle captures state before calling `prepareWaffleClip()` |
| Config interface | [`waffle.ts`](../../src/lib/animation/renderers/waffle.ts:37) | 37–66 | Complete text/style field list |
| ChartEditor state | [`ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte) | (search `$state`) | All reactive fields to snapshot |
| BarChartConfigParams | [`chart-config.ts`](../../src/lib/utils/chart-config.ts:11) | 11–58 | Data/chart-type fields (baseline) |

---

## Implementation Checklist

- [ ] **Step 1:** Extend `BarClipConfig` interface with title/caption fields
- [ ] **Step 2:** Build `captureBarClipConfig(editorState)` helper
- [ ] **Step 3:** Build `restoreBarClipConfig(config, editorState)` helper
- [ ] **Step 4:** Update [`src/lib/animation/renderers/bar.ts`](../../src/lib/animation/renderers/bar.ts) imports to use new interface
- [ ] **Step 5:** Test capture/restore with test-bar-clip suite (verify fields round-trip)
- [ ] **Step 6:** Document config snapshot pattern in comments

---

## Testing Strategy

### Before Integration

1. **Extend test-bar-clip.ts:**
   - Snapshot test config (use `captureBarClipConfig()`)
   - Call `prepareBarClip(snapshotConfig)`
   - Verify no new errors vs. Section B tests

2. **Round-trip test:**
   - Create initial config
   - Capture with `captureBarClipConfig()`
   - Restore with `restoreBarClipConfig()`
   - Compare (should be identical)

3. **Run full test suite:**
   ```
   curl http://localhost:5174/test-bar-clip
   ```
   All 4 variants should still pass.

### Then Integration (Section D)

- Wire `captureBarClipConfig()` into ChartEditor `onAnimate()` handler
- Pass snapshot to `createClip()` factory (next section)

---

## Blocking Questions for Section C

None — all patterns already validated in waffle animation. Config capture is mechanical.

---

## Effort Estimate

- Interface extension: ~15 min
- Capture function: ~20 min
- Restore function: ~15 min
- Test round-trip: ~15 min
- Integration check: ~10 min
- **Total: ~1.5 hours**

---

## Next Steps After Section C

1. **Section D** (createClip integration): Wire `captureBarClipConfig()` → `createClip()` factory
2. **Section E** (ChartEditor hook): Mount `AnimateSection` component in ChartEditor
3. **Section F** (end-to-end test): Record animation, export MP4, verify pixel-perfect final frame

---

## Key File Locations

| File | Purpose |
|---|---|
| [`src/lib/animation/renderers/bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts) | Add capture/restore functions here |
| [`src/lib/components/ChartEditor.svelte`](../../src/lib/components/ChartEditor.svelte) | Source of editor state to snapshot |
| [`src/lib/animation/test-bar-clip.ts`](../../src/lib/animation/test-bar-clip.ts) | Extend with round-trip tests |

---

**Branch:** `main` (all Section B code committed)  
**Dev Server:** Running at `http://localhost:5174/`  
**Test Page:** `http://localhost:5174/test-bar-clip` (Section B validation)

**Lead Dev Handoff:** Config snapshot is mechanical. Patterns proven by waffle animation. Straightforward capture/restore with extended interface.
