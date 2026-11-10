# HANDOFF: ChartFlam Animation — Remaining Scope (Pictogram, Line, Pie/Donut)

**Status:** Waffle ✅ done. Bar ✅ done (just fixed 4 real bugs this session — see "Bar fixes" below). Pictogram = stub only. Line/Pie/Donut = not started.

**Your job:** Build Pictogram, then Line, then Pie/Donut, each as a complete checkpoint with explicit user testing before moving to the next. Do NOT batch all three into one untested delivery — the owner is about to travel and needs working increments, not a big-bang finish.

**Read [`info/chartflam-animation-brief-v2.md`](info/chartflam-animation-brief-v2.md:1) first** — it's the original spec (UI shell, wipe design, video spec, build order). This handoff only covers what's changed/learned since, and the concrete remaining work.

---

## Order of work (confirmed with owner)

1. **Pictogram** — reuses the waffle pattern (not Chart.js). Lowest risk, ~60-70% of waffle's effort.
2. **Line** — reuses ~90% of the bar Chart.js pipeline. Low-medium risk.
3. **Pie/Donut** — reuses bar's plumbing but needs genuinely new wipe geometry (angular sweep, not a rectangular clip). Highest risk — do this last so if time runs out, 4/5 chart types ship working.

**Checkpoint after each chart type**, not after every file. Tell the owner exactly what to click/test, wait for confirmation (they test on real iPhone/Android per the original brief), then proceed.

---

## Critical bugs fixed in the Bar session — read before touching Line/Pie (same traps apply)

These were NOT bar-specific bugs — they're generic Chart.js-in-animation-canvas bugs that will recur for Line and Pie/Donut if not replicated:

### 1. `devicePixelRatio` canvas mismatch (caused cropped/zoomed preview + grey strip)
Chart.js auto-scales a canvas's backing store by `window.devicePixelRatio` (e.g. 2x on Retina) unless told not to. A canvas requested at `1080×600` silently becomes `2160×1200` internally while `canvas.style.width/height` stays `1080px/600px`. Downstream `drawImage()` compositing that uses `1080×600` as the *source rect* then only samples the top-left quarter of the real canvas.

**Fix applied (must replicate for Line/Pie):** force `options.devicePixelRatio = 1` on every offscreen Chart.js config used for animation. See [`buildChartConfigForAnimation()`](src/lib/animation/renderers/bar-chart-setup.ts:90-107) and the `normalConfig` build in [`bar.ts`](src/lib/animation/renderers/bar.ts:176-186).

### 2. Pixel-based Chart.js style properties look wrong-sized on the wider export canvas
Chart.js options like `axisSize` (tick font), `barRounding`, `legendSize`, `lineWidth`, `markerSize`, `sliceGap`, `smoothing` are absolute pixel values. The animation canvas renders at `EXPORT_WIDTH = 1080`, but the live editor's actual preview canvas tops out at **416px wide** (derived from `.editor-panel` max-width 480px − 2×16px margin − 2×16px padding, see [`ChartEditor.svelte`](src/lib/components/ChartEditor.svelte:1310,1379)). Same pixel values on a canvas ~2.6x wider look proportionally tiny/sharp.

**Fix applied:** [`ANIMATION_STYLE_SCALE`](src/lib/animation/renderers/bar-chart-setup.ts:64) = `1080 / 416 ≈ 2.6`, applied via [`scaleConfigForAnimation()`](src/lib/animation/renderers/bar-chart-setup.ts:73-84) to all pixel-based config fields before calling `buildChartConfig()`. Title/caption font sizing in `bar.ts` also uses this same constant (previously hardcoded `* 2`, which was wrong). **Replicate this scaling for any new pixel-based style fields Line/Pie introduce** (e.g. pie's `smoothing`/`sliceGap` are already in the scale list; check nothing new needs adding).

### 3. Aspect-ratio-to-height formula direction must match the editor exactly — verify, don't assume
`ChartEditor.svelte`'s canvas container height is `240 * (100 / barAspectRatio)` — **inversely** proportional (bigger ratio = flatter/shorter chart, since Chart.js's `aspectRatio` = width/height). An earlier fix attempt got this backwards (`height = 600 * (barAspectRatio/100)`) and produced an exact inversion bug (max depth setting → min animation height). Line has its own `lineAspectRatio` control with presumably the same `240 * (100 / lineAspectRatio)` formula — **check the exact formula in ChartEditor.svelte before writing the Line renderer's height calc**, don't copy-paste the bar constant blind.

### 4. Stale preview cache — AnimateSection doesn't regenerate on config change
Once a preview video exists (`previewState === 'ready'`), clicking Play just replays the cached video — it never checks if `barConfig`/`waffleConfig`/`lineConfig`/`pieConfig` changed. **Already fixed generically** in [`AnimateSection.svelte`](src/lib/components/AnimateSection.svelte:41-64) via a content-comparison `$effect` that resets `previewState` to `'idle'` whenever the config prop changes. This fix is type-agnostic (works for any config shape) — **no further changes needed here** for Line/Pie, just make sure their `buildXClipConfig()` functions are called inline in the template the same way bar's is (`<AnimateSection barConfig={buildBarClipConfig()} />` pattern), so Svelte re-evaluates the prop on every reactive update.

---

## Current architecture (what exists, what to reuse)

```
src/lib/animation/
├── createClip.ts          — factory; dispatches by `kind: 'pictogram'|'waffle'|'bar'`
├── timeline.ts            — FPS, easing, LEAD_IN/HOLD constants, progressAt(), staggered()
├── layout.ts              — font loading, text measuring/drawing, computeVideoSize() (even-int rounding)
└── renderers/
    ├── waffle.ts           — ✅ complete reference pattern (non-Chart.js)
    ├── bar.ts              — ✅ complete reference pattern (Chart.js, just fixed)
    ├── bar-chart-setup.ts  — ✅ shared Chart.js two-render helpers (hidden-data render,
    │                          scaleConfigForAnimation, devicePixelRatio fix, capture/restore config)
    └── pictogram.ts        — ❌ STUB ONLY — returns blank canvas, no real implementation

src/lib/utils/
├── chart-config.ts         — buildChartConfig() — ALREADY generic across pie/donut/line/bar/
│                              stacked/grouped (branches on activeType). Shared by editor + animation.
├── chart-video-export.ts   — export pipeline (WebCodecs/Mediabunny + MediaRecorder fallback) — DONE, no changes needed
└── waffle-legend.ts         — waffle-only legend helper, NOT needed for Chart.js charts (native legends)

src/lib/components/
├── AnimateSection.svelte    — ✅ shared UI component (toolbar, preview, cache-invalidation) — DONE,
│                              works for any chart kind via its `waffleConfig`/`barConfig` props pattern.
│                              For Line/Pie, ADD new optional props `lineConfig`/`pieConfig` (see below).
├── ChartEditor.svelte       — handles pie/donut/line/bar/stacked/grouped in ONE component already.
│                              Only bar currently has the Animate section mounted (`{#if isBar}` at
│                              line 1266). Need to extend the condition / add parallel sections for
│                              line and pie, each calling their own buildXClipConfig().
├── WaffleChartEditor.svelte — reference for waffle's AnimateSection integration
└── PictogramEditor.svelte   — has NO animation hook yet. Static pictogram rendering is in
                               renderPictogram() (line 185) and downloadPictogram() (line 268).
```

### Key insight on "single component" question (owner asked this)
[`buildChartConfig()`](src/lib/utils/chart-config.ts:60) in `chart-config.ts` is **already** the single shared Chart.js config builder for pie/donut/line/bar/stacked/grouped — this was built correctly from the start. The *animation* layer (`bar-chart-setup.ts` + `bar.ts`) is named around "bar" for historical reasons but its two-render-plus-wipe pattern is generic. **Recommended refactor while building Line:** rename/generalize `bar-chart-setup.ts` → keep file name or rename to `chartjs-animation-setup.ts` (owner's call — ask if renaming breaks their mental model, otherwise just extend in place), and make the wipe-geometry calculation (currently inline in `bar.ts`'s `drawFrame()`) a pluggable function selected by `activeType`. Don't do a big upfront rewrite — extend incrementally as Line is built, verify bar doesn't regress (re-run the bar manual test after any shared-code change).

---

## Step 1: Pictogram

### Reuse pattern: waffle, not Chart.js
Pictogram is NOT a Chart.js chart — it's custom canvas drawing (SVG icons rendered to canvas, partial-fill clipping). This matches waffle's architecture almost exactly: static grid of items, each either "filled" or "ghost", revealed via wipe.

### What exists today
- [`PictogramEditor.svelte`](src/lib/components/PictogramEditor.svelte:1) — full static editor, `renderPictogram()` (live canvas draw, line 185), `downloadPictogram()` (PNG export, line 268), `calculatePictogramLayout()` (shared layout math, line 85).
- [`pictogram.ts`](src/lib/animation/renderers/pictogram.ts:1) — stub, `PictogramClipConfig` interface is empty (`// TBD`).
- `createClip.ts` already dispatches `kind: 'pictogram'` → `preparePictogramClip()` — the plumbing exists, just needs real implementation.

### What's different from a simple waffle port
- Pictogram uses a **fractional fill** concept (`pictogramFilled = 6.7` means 6 full icons + 1 icon clipped at 70%), not discrete colored cells. The wipe needs to animate toward this exact fractional end-state, not a binary reveal.
- Only ONE icon shape is used per pictogram (not per-category colors like waffle) — filled color vs. unfilled color, two SVG renders of the same icon.
- Layout is row-major (5 per row × 2 rows = 10 icons fixed grid, see `calculatePictogramLayout()`), not column-driven like waffle's `gridCols`.
- No legend (per brief v2 line 72).

### Suggested wipe mechanism (matches brief v2 §"Wipe design" — pictogram = top→bottom like waffle)
1. Base layer: all 10 icon slots at "ghost" opacity (reuse waffle's `GHOST_COLOR` pattern) in unfilled color, baked once.
2. Animated layer: reveal icons in the same top-down/row-major order as the static render, using `staggered()` from `timeline.ts` (already used by waffle) so it reads as a wave rather than popping all at once.
3. Final icon (the partially-filled one, if `partialAmount > 0`) needs special handling — likely animate its clip-rect fill percentage growing from 0 to `partialAmount` during its stagger window, rather than a binary pop-in.
4. Reuse `renderSvgToCanvas()` / `decodeSvgImage()` logic conceptually (likely need an animation-safe copy since the live ones are tied to component state — check if they can be imported as pure functions or need duplicating into `pictogram.ts`).

### Required new interface (replace the stub)
```typescript
export interface PictogramClipConfig {
  iconSvg: string;              // currentIconSvg (sanitized)
  filled: number;                // pictogramFilled (fractional, e.g. 6.7)
  filledColor: string;
  unfilledColor: string;
  horizontalSpacing: number;
  verticalSpacing: number;
  bgColor: 'white' | 'transparent' | string;
  chartTitle: string;
  titleFont: string; titleSize: number; titleBold: boolean; titleItalic: boolean;
  titleAlign: 'left'|'center'|'right'; titleColor: string; titleLineHeight: number;
  chartCaption: string;
  captionFont: string; captionSize: number; captionAlign: 'left'|'center'|'right';
  captionColor: string; captionLineHeight: number;
}
```
(Match field names to `PictogramEditor.svelte`'s existing `$state` variable names exactly, same convention as `captureBarClipConfig()`.)

### Required new files/hooks
1. Rewrite [`pictogram.ts`](src/lib/animation/renderers/pictogram.ts:1) — full `preparePictogramClip()` implementation, following `waffle.ts`'s structure (measure title/caption blocks, build static base canvas, `drawFrame()` with wipe math, `dispose()`).
2. Add `buildPictogramClipConfig()` helper in `PictogramEditor.svelte` (mirrors `buildBarClipConfig()` in `ChartEditor.svelte:271`).
3. Add the "Animate" accordion section to `PictogramEditor.svelte` (copy the `{#if isBar}` block pattern from `ChartEditor.svelte:1266-1280`, adapted — pictogram animate section should probably always show, no `isBar`-style gate needed since pictogram has only one "type").
4. Import and mount `<AnimateSection pictogramConfig={buildPictogramClipConfig()} />` — note `AnimateSection.svelte`'s `Props` interface currently only has `waffleConfig?`/`barConfig?` ([line 11-14](src/lib/components/AnimateSection.svelte:11-14)) — add `pictogramConfig?: PictogramClipConfig` and a third branch in `generateVideo()`'s `clipOptions` construction ([line 87-103](src/lib/components/AnimateSection.svelte:87-103)).

### Pictogram checkpoint — what to tell the owner to test
1. Build a pictogram (any icon, fractional fill like 6.7), expand Animate, Play.
2. Confirm: ghost icons visible from frame 0, fill wave moves top-to-bottom/row-major, partial icon animates its clip fraction correctly, final frame matches the static PNG exactly.
3. Change `pictogramFilled`, horizontal/vertical spacing, icon choice, colors — confirm Play regenerates (cache-invalidation fix already handles this generically).
4. Download MP4, confirm plays correctly on desktop + mobile.
5. **Do not proceed to Line until this is confirmed working.**

---

## Step 2: Line

### Reuse: ~90% of bar's Chart.js pipeline
`buildChartConfig()` in `chart-config.ts` already fully handles `activeType === 'line'` (see lines 76-87, 170-184) — tension, width, markers, point colors/styles, aspect ratio via `lineAspectRatio`. The two-render hidden/normal pattern, devicePixelRatio fix, and style scaling in `bar-chart-setup.ts` are NOT bar-specific — they operate on whatever `BarClipConfig`-shaped object is passed in (it already includes all line fields — see [`BarChartConfigParams`](src/lib/utils/chart-config.ts:11-58), which covers both bar and line properties in one interface).

### What's actually new for Line
1. **Wipe direction:** left→right only (brief v2 line 21: "line left→right"), simpler than bar's orientation branching (no vertical/horizontal toggle for line).
2. **Point/marker pop-in:** Chart.js line charts can show point markers (`markerVisible`, `markerStyle`, `markerSize`). These should likely pop in as the wipe passes their x-position, not just appear via simple rectangular clip — worth testing with the simple clip-rect approach FIRST (matches brief's wipe mechanism) before adding marker-specific pop logic; only add complexity if the simple clip looks wrong.
3. **Height formula:** verify `lineAspectRatio`'s relationship in `ChartEditor.svelte` (search for `lineAspectRatio` usage in the canvas-container style, same spot as `barAspectRatio` at [line 724](src/lib/components/ChartEditor.svelte:724)) — do NOT assume it matches bar's constant or direction without checking.

### Suggested approach
1. Decide: extend `bar-chart-setup.ts`/`bar.ts` in place to handle `activeType === 'line'` (since the config object already carries line fields), OR create a parallel `line.ts` that imports and reuses `createHiddenDataRender()`/`scaleConfigForAnimation()` from `bar-chart-setup.ts`. **Prefer option 2** (parallel file importing shared helpers) to avoid risking regressions in the now-stable bar path, consistent with the brief's "small edits only" rule. This is also the natural point to generalize naming if you choose to (e.g. renaming `BarClipConfig` → `ChartJsClipConfig` is optional/cosmetic — functionally it already covers line).
3. `createClip.ts` needs a new `kind: 'line'` branch (or reuse `kind: 'bar'` if the renderer internally dispatches on `config.activeType === 'line'` — simpler, fewer files, recommended).
4. `ChartEditor.svelte`'s Animate section gate is currently `{#if isBar}` ([line 1266](src/lib/components/ChartEditor.svelte:1266)) — change to `{#if isBar || isLine}` and ensure `buildBarClipConfig()` (possibly rename to `buildChartClipConfig()`) is reused for both, since it already captures all line fields.

### Line checkpoint — what to tell the owner to test
1. Build a line chart (single + multi-series), expand Animate, Play.
2. Confirm: left→right wipe, points/markers appear correctly, final frame matches PNG exactly.
3. Change line tension, width, marker style/size, aspect ratio ("depth") — confirm Play regenerates correctly and in the right direction (not inverted — re-verify bug #3 above doesn't recur).
4. Download MP4, test on mobile.
5. **Do not proceed to Pie/Donut until confirmed.**

---

## Step 3: Pie / Donut (highest risk — do last)

### Why this is different (genuinely new work, not just config reuse)
Bar/line wipes are **rectangular clip regions** sweeping across a Cartesian data area. Pie/donut has no Cartesian data area — it's a circular arc. Brief v2 (line 21) specifies: "pie/donut clockwise from the chart's start angle."

### Two viable approaches — pick ONE, don't half-build both
**Option A (recommended — simpler, more robust): Chart.js native `circumference` animation.**
Chart.js pie/donut datasets support a `circumference` option (0–360°) that limits how much of the circle is drawn. Instead of a canvas clip-rect wipe:
1. Render the grey "hidden" base layer at full circumference (as now).
2. For the animated reveal layer, create the normal-color Chart.js instance but override `circumference: 0` initially, then re-render frame-by-frame (destroy/recreate or use `chart.update()`) with `circumference` interpolated from `0` to `360 * eased` via `easeInOutCubic`.
3. **Caveat:** destroying/recreating a Chart.js instance every frame (30fps × ~2-3s = 60-90 frames) could be slow. Test performance early — if too slow, investigate `chart.options.circumference = X; chart.update('none')` (no-animation update) reused across frames instead of full recreate.

**Option B (fallback if A is too slow/complex): canvas arc clip path.**
1. Get the pie/donut's center point and radius from `chart.chartArea` (need to verify Chart.js exposes a usable center/radius for pie — `chartArea` is primarily designed for Cartesian charts; may need to compute center as `(chartArea.left+chartArea.right)/2, (chartArea.top+chartArea.bottom)/2` and radius as `Math.min(chartArea.width, chartArea.height)/2`).
2. Use `ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,radius, startAngle, startAngle + (2*Math.PI*eased)); ctx.closePath(); ctx.clip();` to reveal a growing wedge, matching the chart's actual start angle (Chart.js pie charts start at -90° i.e. 12 o'clock by default — verify this before hardcoding).
3. For donut, the clip-arc needs an inner radius too (annular sector) — slightly more complex path construction (two arcs, one reversed).

**Recommendation: try Option A first.** It's more "correct" (uses Chart.js's own rendering, guaranteed visually identical to the static chart at every frame) and avoids reimplementing arc geometry. Only fall back to Option B if performance testing shows A is too slow for 30fps on a mid-range Android phone (brief's stated target hardware).

### Other pie/donut-specific considerations
- `isDonut` + `donutCutout` (the inner hole size) — verify the reveal animation respects cutout correctly in both options.
- `sliceGap` (border width between slices) and `smoothing` (arc corner rounding) are both already in `scaleConfigForAnimation()`'s scaled-fields list ([bar-chart-setup.ts:76-83](src/lib/animation/renderers/bar-chart-setup.ts:76-83)) — no new scaling work needed there.
- Legend: pie/donut legends are native Chart.js (same as bar/line) — no waffle-style custom legend needed.
- `ChartEditor.svelte`'s Animate gate needs `{#if isBar || isLine || isPie}` (or restructure to show Animate for all Chart.js-backed types — effectively always-on since pictogram is the only non-Chart.js editor).

### Pie/Donut checkpoint — what to tell the owner to test
1. Pie chart (several slices), Donut (varying `donutCutout`), single-series, with/without slice gap.
2. Confirm: clockwise sweep from 12 o'clock (or whatever Chart.js's actual default start angle is — verify, don't assume), final frame matches PNG exactly, no visual artifacts at the wipe seam.
3. Change slice colors, gap, smoothing, cutout — confirm regeneration.
4. Download MP4, test on mobile.
5. This is the last chart type — after confirmation, all 5 chart types (waffle, pictogram, bar, line, pie/donut) are animation-complete.

---

## General reminders for every step (per brief v2's working rules)

- **Don't edit existing editor code** beyond the one additive Animate-section hook per editor. If a step seems to need more, stop and ask.
- **Small edits only** — no large file rewrites. Extend `bar-chart-setup.ts` incrementally rather than rewriting it.
- **One build step at a time** — after each meaningful change, stop, state exactly what to test, wait for the result before continuing.
- **Final frame = PNG export, pixel-for-pixel** — this is the core guarantee of the whole architecture (brief v2 line 15). Verify this explicitly for every new chart type before calling it done.
- **No new dependencies** beyond `mediabunny` (already installed).
- Build must pass (`npm run build`) after every change with zero new errors — this has been the practice all session, keep it up.

---

## Quick reference: files touched this session (for context on what "done" bar looks like)

- [`src/lib/animation/renderers/bar.ts`](src/lib/animation/renderers/bar.ts) — devicePixelRatio fix, style scaling, corrected aspect-ratio-to-height formula
- [`src/lib/animation/renderers/bar-chart-setup.ts`](src/lib/animation/renderers/bar-chart-setup.ts) — devicePixelRatio fix, `ANIMATION_STYLE_SCALE` + `scaleConfigForAnimation()`
- [`src/lib/components/AnimateSection.svelte`](src/lib/components/AnimateSection.svelte) — stale-preview cache-invalidation effect

Use these as the template for "what a fully debugged chart type looks like" when building Pictogram/Line/Pie.
