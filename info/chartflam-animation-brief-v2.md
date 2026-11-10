# ChartFlam: Animate → MP4 (v2 brief, fresh start)

**This replaces the old 345-line handoff. Do not read it.** The first attempt is parked on branch `anim-attempt`. Its failure cause: the animator re-drew each chart with its own layout code, which never matched the editor's. v2 avoids that completely.

## Working rules (read first)
- **Don't read whole files.** Search and read only the lines you need. Don't summarise the repo back to me.
- **One build step at a time.** After each step: stop, tell me what to test, wait for my result. Commit only when I say so.
- **No large file rewrites.** Small edits only.
- **Do not edit existing editor code** (static canvases, data controls, main Download button, `downloadChart` / `downloadWaffle` / `downloadPictogram`). Exception: `downloadWaffle()` now calls the shared legend helper to bake the legend into the PNG export (matching the on-screen preview layout). The only permitted touch is one small additive hook per editor to mount the Animate section. If a step seems to need any other change, **stop and ask**.
- I can't be sure what the code looks like: verify assumptions in code and report differences briefly.
- No new dependencies except `mediabunny`. No server, no paid services, no audio, no GIF.
- Target: journalists on mid-range Android phones, small screens, weak bandwidth.

## Concept
The Animate section is **fully separate** from the editor. It takes the finished static chart image (what the PNG export would produce), builds an MP4 where that image is **revealed by a feathered wipe**, and shows the real MP4 in a `<video>`. There is no second chart renderer and no live-canvas overlay. Final frame = the PNG by construction.

**Wipe design**
- Base frame: a greyed-out (desaturated) copy of the finished chart. The coloured chart is revealed over it.
- Confined to the **data region** where possible; title, caption, axes, gridlines and legend are fully visible from frame 0. Report how the data-region rectangle can be obtained per chart before relying on it.
- Soft (feathered) leading edge.
- Direction: waffle / pictogram top→bottom (matches existing fill order); line left→right; bars rise bottom→top (vertical) or left→right (horizontal); pie/donut clockwise from the chart's start angle. Easing: easeInOutCubic.
- Chart.js charts (Phase 2) additionally need a "data hidden" render and `chart.chartArea`. Waffle/pictogram do not.

## Video spec
- 30 fps. Timeline: lead-in 0.3 s → wipe 1/2/3 s (default 2) → hold 3 s on the finished chart.
- Size = what the PNG export produces (1080 px wide, existing height logic), dimensions rounded up to even; if longest edge > 1920, scale down proportionally and re-round.
- Transparent background → white; show hint "Video uses a white background."
- Export: WebCodecs + Mediabunny H.264 MP4, video only. Fallback: MediaRecorder (may produce WebM; report which target devices use it).
- Salvage (read only these two files from `anim-attempt`): `timeline.ts` and `chart-video-export.ts`. Don't carry over anything else.

## UI (the "Animate" accordion section, same header style as others, no on/off toggle)
Toolbar, left to right, app-button style: **[Play/Pause] [1s | 2s | 3s segmented control] [Download]**
- Icons: `icon-play-new.svg`, `icon-pause-new.svg`, `icon-download.svg`.
- Segmented control: same height, border and radius as other buttons, wider, three segments. Active segment = dark grey fill (the app's existing active-button grey, **not purple**) with white text; inactive = dark grey text.
- Below the toolbar: **preview area**, full width, same depth as an accordion bar.
  - **Idle:** pale grey rectangle, dotted grey border, text "Press play to animate".
  - **On first Play:** the rectangle smoothly grows to the final video height (known from chart settings before rendering), stays grey/dotted, a chaser animation runs round its border, text changes to "Generating…" (show a minimum of ~0.6 s to avoid a flash). Play is disabled while generating.
  - **Ready:** the `<video>` replaces the placeholder (already at correct size) and plays once to the end, including the hold. Play shows Pause during playback, then reverts. The finished frame stays on screen. **No looping.**
  - Later Play taps replay the existing video without regenerating.
- Download is disabled until a video exists. It downloads that video.
- **Reset to placeholder** when: the duration segment changes; or the chart's settings differ from the snapshot the video was made from (compare when the section opens). Closing the section mid-play pauses the video.
- When the preview appears, scroll it into view with extra bottom padding so the fixed purple download bar doesn't cover it.
- The main editor, its controls and the purple PNG Download button are never disabled or changed.
- Mobile video: muted, `playsinline`. Test early on a real iPhone and Android.
- Visual styling details: I'll supply separately. Build the shell with existing CSS variables for now.

## Build order (stop and report after each)
0. Git: commit current work to branch `anim-attempt`; return `main` to the last fully working static version. Confirm static Waffle and Pictogram work. **Report only.** Then find (briefly) whether each editor's PNG export builds a canvas I can reuse without editing it, and say what the least invasive hook would be. Wait for my decision.
1. UI shell only: toolbar, placeholder states (idle → growing → generating), scrolling, no chart or video wiring. I test on phone.
2. **Waffle:** wipe → MP4 → `<video>`, Play/Pause, Download. I test on desktop + Android + iPhone.
3. Reset logic (settings snapshot, duration change, section closing).
4. **Pictogram.**
5. Phase 2, one chart type per step: bar (vertical/horizontal/stacked), line, pie/donut.

## Acceptance checks (per chart)
- Static editor and PNG export behave exactly as before, with the section open or closed.
- Final video frame matches the PNG pixel-for-pixel.
- Total length ≈ 4.3 / 5.3 / 6.3 s for 1 / 2 / 3 s.
- No blank or white flash at t = 0; title/caption/legend present throughout.
- Plays once, stops, replays on tap; reset works as above.
- Downloaded MP4 plays on desktop, Android and iPhone.

## Shared legend helper (`src/lib/utils/waffle-legend.ts`)

**Scope: Waffle only.** Chart.js charts (bar/line/pie/donut) have legends natively rendered onto the chart canvas by Chart.js itself, so no separate helper needed. Pictogram has no legend.

The waffle legend is built in HTML (`.waffle-legend-row`, flex-wrapped, centered). To ensure PNG export and video are pixel-identical (brief § "Final frame = the PNG by construction"), a shared `measureWaffleLegend()` + `drawWaffleLegend()` pair was added:
- `downloadWaffle()` now calls this to **bake the legend into the PNG**, respecting position (top/bottom), wrapping, font size, and color.
- Step 2 (animator base-frame builder) will call the same functions to match the PNG exactly.
- No duplicate layout logic anywhere — single source of truth for legend sizing/positioning.

**Not needed by Chart.js or Pictogram.** Do not import this module in other renderers.

---

## Completed (Phase 1: Waffle)

✅ **UI shell:** Toolbar (Play/Pause, 1/2/3s segmented, Download), placeholder (idle → growing → generating), scrolling on video appearance.
✅ **Waffle animation:** Feathered top→bottom wipe, legend baked into base layer via shared `measureWaffleLegend()`/`drawWaffleLegend()` helpers (pixel-identical to PNG export).
✅ **MP4 export:** WebCodecs + Mediabunny H.264 with **fallback to MediaRecorder.**
✅ **Spinner:** Ported AudioFlam's chaser border (two 60° arcs via animated `@property --export-angle`; smooth, visible on mobile).
✅ **Legend export:** Fixed missing legend in video by adding legend fields to `WaffleClipConfig` and drawing on base layer in `prepareWaffleClip()`.
✅ **MP4/WebM consistency:** Fixed false-positive support check (`checkVideoEncodeSupport()`) which passed on first export then failed on second. Now always attempts WebCodecs; catches real exceptions and falls back to MediaRecorder. Logging shows which format succeeded.

### Key implementation notes
- Legend is baked into base canvas (not revealed by wipe) so it's visible frame 0 → end.
- WebCodecs export now skips upfront support probe; real-time exception handling is more reliable.
- Spinner uses CSS `@property --export-angle` for smooth continuous rotation (not stepped `transform`).

---

## Phase 2 Plan (Pictogram + Chart.js)

**Effort estimate:** Waffle set the pattern. Subsequent charts are simpler in some ways, harder in others.

**Simpler:**
- Infrastructure proven: `createClip()`, export pipeline, timeline, easing all in place.
- Chart.js legends render natively (no custom helper needed for bar/line/pie/donut).
- Layout pattern established.

**Still complex (per chart):**
- **Chart.js charts** need TWO renders: "data hidden" (greyed base layer) + normal (animate reveal). This requires bespoke logic per chart type to hide data while keeping axes/gridlines/legend visible.
- **Wipe math varies:** bar (bottom→top or left→right), line (left→right), pie (clockwise from start angle).
- **Data region boundaries:** Getting `chart.chartArea` or equivalent per chart type.

**Bottleneck for Phase 2:** Design Chart.js two-render architecture upfront (one consistent pattern across bar/line/pie) before coding. This is the main new work beyond waffle.

**Pictogram (step 4):** Similar complexity to waffle (custom render, not Chart.js), probably ~70% of waffle effort. Follow waffle's pattern: base layer + feathered wipe.
