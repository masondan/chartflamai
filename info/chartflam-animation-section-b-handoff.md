# HANDOFF: Bar Chart Animation — Phase 2, Section B (Wipe Math)

**Status:** Section A complete. All four critical questions answered. Ready to build wipe geometry.  
**Current Session:** Architecture proven; chartArea bounds validated for all bar variants.  
**Next Session:** Section B implementation (wipe math; feathered reveal using chartArea bounds).

---

## Context

**Section A Delivered:**
- ✅ Shared [`src/lib/utils/chart-config.ts`](../../src/lib/utils/chart-config.ts): unified Chart.js builder (editor + animator use same config)
- ✅ [`src/lib/animation/renderers/bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts): two-render strategy (normal + hidden-data Chart.js instances)
- ✅ chartArea bounds validated for **all four bar variants**: vertical/horizontal × grouped/stacked
- ✅ Test harness confirmed: bars grey correctly on base layer; axes/legend/gridlines remain visible

**Key Numbers (from Section A tests):**
```
Vertical Bars (Grouped):    chartArea 1043.02 × 520.4 @ (32.98, 10.2)
Vertical Bars (Stacked):    chartArea 1042.68 × 520.4 @ (33.32, 10.2)
Horizontal Bars (Grouped):  chartArea 1034.58 × 520.4 @ (34.93, 10.2)
Horizontal Bars (Stacked):  chartArea 1034.58 × 520.4 @ (34.93, 10.2)
```
→ **Wipe rectangle bounds are stable and consistent per bar variant.**

---

## Section B: Deliverable

**File:** Create [`src/lib/animation/renderers/bar.ts`](../../src/lib/animation/renderers/bar.ts)

**Purpose:** Wipe geometry math for each bar orientation. Build the full animation frame compositing logic (base layer + animated reveal via feathered wipe).

**Signature:**
```typescript
export async function prepareBarClip(
  config: BarClipConfig,
  scale = 1
): Promise<PreparedClip>;
```

**Returns:** `{ width, height, drawFrame(ctx, tMs, animMs), dispose() }`  
(Same interface as [`prepareWaffleClip()`](../../src/lib/animation/renderers/waffle.ts) — follow that pattern exactly.)

---

## Architecture (from waffle.ts pattern)

### Two-Render Compositing

```
Frame(t):
  1. Draw baseCanvas (grey bars + title + caption + axes + legend)
  2. Draw normalCanvas (full-color bars) clipped by wipe rectangle
  3. Composite: base @ full opacity, normal @ clipped by wipe progress
```

### Wipe Direction by Orientation

| Bar Orientation | Wipe Direction | Progress Geometry |
|---|---|---|
| **Vertical (default)** | Bottom → Top | wipeBottom = chartArea.bottom; wipeTop = chartArea.top + (chartArea.height × p) |
| **Horizontal** | Left → Right | wipeLeft = chartArea.left; wipeRight = chartArea.left + (chartArea.width × p) |

### Feathered Edge

- Soft transition zone: `featherWidth = 80px` (or similar; tune for smoothness)
- Leading edge: use `globalAlpha` or clipping mask to fade normal render over feathering distance
- Reference: [`waffle.ts` lines 300–323](../../src/lib/animation/renderers/waffle.ts:300) shows exact clamp01/distance math

### Static Base Layer

- Use `createHiddenDataRender()` from [`bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts) to generate greyed base canvas
- Bake title/caption/legend into base (pixel-identical to PNG export, just like waffle)
- Draw once at clip creation time, reuse every frame

---

## Implementation Checklist

### Step 1: Build Base Layer (Static)
- [ ] Call `createHiddenDataRender(config, canvasWidth, canvasHeight)`
- [ ] Get `hiddenCanvas` (greyed bars)
- [ ] Capture as base image: `hiddenCtx.getImageData()` or `toDataURL()`
- [ ] Add title/caption (layout pattern from [`waffle.ts` lines 244–265](../../src/lib/animation/renderers/waffle.ts:244))
- [ ] Return base canvas dimensions

### Step 2: Wipe Math (Per Orientation)
- [ ] Extract `chartAreaBounds` from `createHiddenDataRender()` result
- [ ] **Vertical bars:** calculate `wipeTop` sweeping bottom→top as progress 0→1
- [ ] **Horizontal bars:** calculate `wipeLeft` sweeping left→right as progress 0→1
- [ ] Clamp feather softness to chartArea bounds (don't overshoot)

### Step 3: Frame Compositing
- [ ] `drawFrame(ctx, tMs, animMs)`:
  1. Draw base layer at full scale
  2. Draw normal (full-color) layer clipped by wipe rectangle
  3. Apply feathering via `globalAlpha` ramp over featherWidth distance
  4. Use `easeInOutCubic` for smooth progression (from [`timeline.ts`](../../src/lib/animation/timeline.ts))

### Step 4: Disposal
- [ ] Call `disposeBarCharts(normalChart, hiddenChart)` on cleanup
- [ ] Release canvas references

### Step 5: Config Snapshot
- [ ] Extend `BarClipConfig` interface if needed (text fonts, alignment, etc.)
- [ ] Capture from ChartEditor state at animate-open time (parallel to WaffleClipConfig capture)

---

## Reference Implementations

| Component | File | Lines | Purpose |
|---|---|---|---|
| Two-render setup | [`bar-chart-setup.ts`](../../src/lib/animation/renderers/bar-chart-setup.ts) | 1–194 | `createHiddenDataRender()` factory |
| Waffle wipe math | [`waffle.ts`](../../src/lib/animation/renderers/waffle.ts) | 290–323 | Feathered top→bottom, exact pattern to follow |
| Waffle base layer | [`waffle.ts`](../../src/lib/animation/renderers/waffle.ts) | 233–265 | Title/caption/legend baking (reuse for bars) |
| Timeline easing | [`timeline.ts`](../../src/lib/animation/timeline.ts) | 1–70 | `progressAt()`, `easeInOutCubic()` utilities |
| Layout helpers | [`layout.ts`](../../src/lib/animation/layout.ts) | 1–146 | `computeVideoSize()`, `loadFonts()`, text drawing |

---

## Testing Strategy

### Before Wiring into createClip

1. **Build test config** (same as `test-bar-setup.ts` but with full BarClipConfig)
2. **Call `prepareBarClip()` directly** for vertical/horizontal × grouped/stacked
3. **Render frames** at t=0 (should show grey base), t=mid, t=end (should show full color, same as PNG export)
4. **Verify:** final frame matches PNG export pixel-by-pixel
5. **Check:** no memory leaks (dispose called)

### Then Integration

- Wire `bar` case into [`createClip.ts`](../../src/lib/animation/createClip.ts) (lines 37–60)
- Mount `AnimateSection` into ChartEditor (future phase)
- End-to-end: record → export → play on desktop/mobile

---

## Key Assumptions (Validated in Section A)

✅ chartArea bounds are stable and consistent  
✅ Grey backgroundColor hides data while keeping axes visible  
✅ Stacked bars work with hidden datasets  
✅ Horizontal bars have same-shape chartArea (no rotation math needed)  

---

## Blocking Questions for Section B

None — all critical questions answered by Section A tests. Proceed with full confidence.

---

## Effort Estimate

- Wipe math setup: ~30 min
- Frame compositing: ~30 min
- Base layer baking: ~20 min
- Testing & debug: ~30 min
- **Total: ~2 hours**

---

## Next Steps After Section B

1. **Section C** (Config snapshot): Capture + restore BarClipConfig from ChartEditor state
2. **Section D** (createClip integration): Wire `prepareBarClip()` into factory
3. **Section E** (ChartEditor hook): Mount AnimateSection, test end-to-end

---

**Branch:** `main` (all Section A code committed)  
**Dev Server:** Running at `http://localhost:5174/`  
**Test Page:** `http://localhost:5174/test-bar-setup` (Section A validation)

**Lead Dev Handoff:** All architecture unknowns resolved. Bar animation ready to build.
