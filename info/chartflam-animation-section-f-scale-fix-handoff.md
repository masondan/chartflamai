# HANDOFF: Bar Chart Animation — Section F (Scale/Aspect Ratio Bug Fix)

**Status:** Section E complete & functional. UI/UX working perfectly. Animation renders but **canvas scale/aspect ratio is wrong**.  
**Issue:** Animation preview canvas has wrong dimensions — bars stretched vertically, grey strip at bottom, MP4 export inherits same broken aspect ratio.  
**Session:** Context preserved for next coding session (fresh start recommended).

---

## Problem Description

### Symptoms (from user screenshots)
1. **Main editor preview** (top screenshot): Bar chart renders correctly with proper proportions
2. **Animation preview** (bottom screenshot): Same bars appear **vertically stretched** — too tall
3. **Canvas overflow:** Animation preview box shows grey dashed border — bars burst out of viewport
4. **Bottom grey strip:** Where chart background should be purple, appears as unfilled grey area
5. **MP4 export:** Inherits same broken aspect ratio — exports with stretched bars

### Root Cause
The bar animation clip's canvas is being created with **incorrect width/height dimensions**. This doesn't match Chart.js's expected aspect ratio for the same data, causing:
- Canvas upscaling/letterboxing mismatch
- Bars rendered at wrong vertical scale
- Missing bottom section of chart (grey strip)

**Key insight:** The **editor preview uses Chart.js**, which handles its own canvas sizing based on container + aspect ratio. The **animation clip uses raw canvas 2D context** in the bar renderer — these two are generating different final dimensions for the same chart.

---

## Where to Investigate

### Primary File: `src/lib/animation/renderers/bar-chart-setup.ts`

Look for canvas dimension setup in:
1. **`prepareBarClip()` function** — where ClipSpec dimensions are set
2. **`drawBarFrame()` function** — canvas context setup during rendering
3. **`BarClipConfig` interface** — what config is passed to the renderer

**Line to check:** Search for `width` / `height` assignments that determine the final canvas size.

### Secondary File: `src/lib/animation/createClip.ts`

The factory calls `prepareBarClip()` and receives back `ClipSpec` with `width` / `height` fields.
- Verify these dimensions are being passed to AnimateSection correctly
- Check if `scale: 1` param is being applied (see Section E code: `scale: 1` hardcoded)

### Reference File: `src/lib/animation/renderers/waffle.ts`

The waffle animation likely has **correct aspect ratio handling**. Compare:
- How waffle sets its canvas dimensions
- How waffle calculates aspect ratio
- Any aspect ratio adjustments made

---

## What Should Be Fixed

### Goal
The bar animation canvas dimensions should match Chart.js's rendering output **exactly** — same aspect ratio, same final pixel dimensions, so bars appear identical in both preview and animation.

### Likely Fix Areas

**Option A: Canvas dimension calculation**
- Bar renderer may be using a fixed width/height (e.g., 1080×900)
- Should instead derive from: editor canvas dimensions + barAspectRatio setting
- barAspectRatio is a control in ChartEditor (0–150 range) that stretches bars vertically

**Option B: Aspect ratio scaling**
- The bar animation needs to apply the same aspect ratio multiplier that Chart.js uses
- If `barAspectRatio = 100` (default), canvas should match editor
- If `barAspectRatio = 150`, canvas height should scale proportionally

**Option C: Scale parameter application**
- Section E passes `scale: 1` to createClip
- But `scale` might not be applied correctly in bar renderer
- Should upscale final canvas to match export resolution (1080px width typical)

### Success Criteria
- Animation preview shows bars **at identical proportions to editor preview**
- No grey strip at bottom — full chart background visible
- Animation fits within preview container (no overflow)
- MP4 export has correct aspect ratio

---

## Testing Strategy

### Before Fix
1. Create bar chart in ChartEditor
2. Expand Animate section
3. Click Play → **observe vertical stretch**
4. Download MP4 → open in video player → **confirm same stretch**

### After Fix
1. Same chart → Animate preview shows **identical proportions to editor**
2. MP4 export plays correctly with proper bar heights
3. Try different `barAspectRatio` values (50, 100, 150) → all should scale proportionally

### Edge Cases to Test
- Horizontal bars (barOrientation: 'horizontal')
- Stacked bars (barMode: 'stacked')
- Grouped bars with multi-series data
- Different canvas sizes (editor preview can be resized)

---

## Code Diff Preview (Expected Fix)

Likely location: `src/lib/animation/renderers/bar-chart-setup.ts`

```typescript
// BEFORE (probably too rigid):
const clipSpec: ClipSpec = {
  width: 1080,      // ← Fixed value
  height: 900,      // ← Fixed value
  fps: 30,
  totalMs,
  drawFrame: (ctx, tMs) => { /* ... */ },
  dispose: () => { /* ... */ }
};

// AFTER (should be derived from config):
const width = 1080;  // Export resolution
const height = Math.round(width * (chartHeight / chartWidth));  // Respect aspect ratio
const clipSpec: ClipSpec = {
  width,
  height,
  fps: 30,
  totalMs,
  drawFrame: (ctx, tMs) => { /* ... */ },
  dispose: () => { /* ... */ }
};
```

---

## Blocking Questions for Next Session

1. **barAspectRatio handling:** Does `captureBarClipConfig()` already pass `barAspectRatio` to the renderer? Or is it missing?
2. **Chart.js canvas dimensions:** What are the actual dimensions Chart.js uses for the editor preview? (Check browser DevTools)
3. **Scale multiplier:** Should `scale: 1` in Section E code actually be `scale: (exportWidth / editorWidth)`?

---

## Related Files (No Changes Needed)

- [`src/lib/components/ChartEditor.svelte`](src/lib/components/ChartEditor.svelte) — Section E working correctly
- [`src/lib/components/AnimateSection.svelte`](src/lib/components/AnimateSection.svelte) — Properly passes barConfig to createClip
- [`src/lib/animation/createClip.ts`](src/lib/animation/createClip.ts) — Factory routing correct
- [`src/routes/test-bar-clip/+page.svelte`](src/routes/test-bar-clip/+page.svelte) — Tests valid (update after fix)

---

## Effort Estimate

- Diagnosis (compare bar vs. waffle renderers): ~10 min
- Implement fix to canvas dimension logic: ~15 min
- Test all bar variants: ~10 min
- Debug MP4 export if needed: ~10 min
- **Total: ~45 min**

---

## Next Steps (Section F)

Once this scale bug is fixed:
1. Verify MP4 export pixel-perfect matches editor preview
2. Test all bar chart variants (grouped, stacked, horizontal, vertical)
3. Ensure animation duration scales correctly (1s/2s/3s buttons work)
4. Update integration test to match actual rendering dimensions
5. Ready for Section G: Full UI validation + polishing

---

**Branch:** `main` (all Section A–E code committed)  
**Dev Server:** Running at `http://localhost:5174/`  
**Test Path:** Create bar chart → expand Animate → click Play (observe stretch)

**Lead Dev Note:** The fix is almost certainly a one-line or two-line change to how canvas dimensions are calculated in bar-chart-setup.ts. The waffle renderer probably has the correct pattern — copy its approach.
