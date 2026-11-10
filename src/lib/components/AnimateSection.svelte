<script lang="ts">
  import { browser } from '$app/environment';
  import { createClip, type CreateClipOptions } from '$lib/animation/createClip';
  import { smartExportClip, downloadBlob, generateVideoFilename, type ExportProgress } from '$lib/utils/chart-video-export';
  import { DURATION_OPTIONS_MS } from '$lib/animation/timeline';
  import type { WaffleClipConfig } from '$lib/animation/renderers/waffle';
  import type { BarClipConfig } from '$lib/animation/renderers/bar-chart-setup';

  console.log('[AnimateSection] Module loaded');

  interface Props {
    waffleConfig?: WaffleClipConfig;
    barConfig?: BarClipConfig;
  }

  let { waffleConfig, barConfig }: Props = $props();
  console.log('[AnimateSection] Props destructured, waffleConfig:', waffleConfig, 'barConfig:', barConfig);

  type PreviewState = 'idle' | 'growing' | 'generating' | 'ready';
  type Duration = 1 | 2 | 3;

  const IDLE_HEIGHT = 56;
  
  let duration = $state<Duration>(2);
  let previewState = $state<PreviewState>('idle');
  let isPlaying = $state(false);
  let previewEl: HTMLDivElement;
  let videoEl: HTMLVideoElement | undefined;
  let videoBlobUrl: string | null = null;
  let videoHeight: number = 360;
  let lastMimeType: string = 'video/mp4';
  let exportProgress = $state<ExportProgress>({ phase: 'preparing', progress: 0, message: '' });

  function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  function scrollPreviewIntoView() {
    previewEl?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // ─── Invalidate cached preview when chart config changes ───
  // barConfig/waffleConfig are freshly-built objects each time the parent
  // ChartEditor re-renders (e.g. buildBarClipConfig() is called inline in
  // the template), so a reference comparison would false-positive on every
  // unrelated re-render. Serializing and comparing content is reliable and
  // cheap enough for chart-config-sized objects. Without this, once a
  // preview has been generated (previewState === 'ready'), clicking Play
  // again just replays the cached video — any edits made to the chart after
  // the first Play (bar/line depth, colours, rounding, data, etc.) would
  // silently NOT appear in the animation until the Animate section was
  // closed and reopened (which remounts this component and resets state).
  let lastConfigSnapshot: string | null = null;
  $effect(() => {
    const snapshot = JSON.stringify(barConfig ?? waffleConfig ?? null);
    if (lastConfigSnapshot !== null && snapshot !== lastConfigSnapshot && previewState !== 'idle') {
      previewState = 'idle';
      isPlaying = false;
      if (videoEl) videoEl.pause();
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
        videoBlobUrl = null;
      }
    }
    lastConfigSnapshot = snapshot;
  });

  function selectDuration(d: Duration) {
    if (d === duration) return;
    duration = d;
    previewState = 'idle';
    isPlaying = false;
    if (videoEl) videoEl.pause();
  }

  async function handlePlayClick() {
    console.log('[AnimateSection] handlePlayClick called, previewState:', previewState);
    if (previewState === 'idle') {
      console.log('[AnimateSection] Calling generateVideo...');
      await generateVideo();
      return;
    }

    if (previewState === 'ready' && videoEl) {
      if (videoEl.paused) {
        videoEl.play();
        isPlaying = true;
      } else {
        videoEl.pause();
        isPlaying = false;
      }
    }
  }

  async function generateVideo() {
    console.log('[AnimateSection] generateVideo called. waffleConfig:', waffleConfig, 'barConfig:', barConfig, 'browser:', browser);
    if ((!waffleConfig && !barConfig) || !browser) {
      console.warn('[AnimateSection] Bailing: waffleConfig =', waffleConfig, ', barConfig =', barConfig, ', browser =', browser);
      return;
    }

    console.log('[AnimateSection] Starting video generation...');
    isPlaying = true;
    previewState = 'growing';
    scrollPreviewIntoView();

    await wait(300);
    previewState = 'generating';

    try {
      const animMs = DURATION_OPTIONS_MS[duration - 1];
      
      let clipOptions: CreateClipOptions;
      if (barConfig) {
        console.log('[AnimateSection] Creating bar clip with animMs:', animMs);
        clipOptions = {
          kind: 'bar',
          animMs,
          scale: 1,
          bar: barConfig
        };
      } else {
        console.log('[AnimateSection] Creating waffle clip with animMs:', animMs, 'cells:', waffleConfig?.cells.length);
        clipOptions = {
          kind: 'waffle',
          animMs,
          waffle: waffleConfig!
        };
      }

      const clip = await createClip(clipOptions);
      console.log('[AnimateSection] Clip created:', clip.width, 'x', clip.height);

      // clip.width/height are export-resolution pixels (e.g. 1080x1100),
      // not CSS/display pixels. The preview box is as wide as its container
      // (a phone screen, ~300-450px), so scale the clip's aspect ratio down
      // to that width — otherwise videoHeight ends up absurdly tall (this
      // was the "deep grey box with one row of cells" bug).
      const containerWidth = previewEl?.clientWidth || 320;
      videoHeight = Math.round((clip.height / clip.width) * containerWidth);

      // Generate MP4 (or WebM fallback)
      const result = await smartExportClip({
        clip,
        onProgress: (progress) => {
          exportProgress = progress;
        }
      });

      lastMimeType = result.mimeType;

      // Revoke old URL if exists
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);

      videoBlobUrl = URL.createObjectURL(result.blob);

      // previewState flips to 'ready' first so the <video> element's
      // visibility updates; videoEl itself is always mounted (see template)
      // so this ordering doesn't matter for the binding, but keeping it
      // here makes the preview-ready UI and the src assignment land in the
      // same tick.
      previewState = 'ready';

      if (videoEl) {
        videoEl.src = videoBlobUrl;
        videoEl.currentTime = 0;
        try {
          await videoEl.play();
          isPlaying = true;
        } catch (playErr) {
          console.warn('[AnimateSection] Autoplay blocked or failed:', playErr);
          isPlaying = false;
        }
      } else {
        console.error('[AnimateSection] videoEl is not bound — video element missing from DOM');
      }

      clip.dispose();
    } catch (err) {
      console.error('[AnimateSection] Video generation failed:', err);
      previewState = 'idle';
      isPlaying = false;
    }
  }

  async function handleDownloadClick() {
    if (!videoBlobUrl) return;

    try {
      const blob = await fetch(videoBlobUrl).then((r) => r.blob());
      const filename = generateVideoFilename('chartflam-waffle', lastMimeType);
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('[AnimateSection] Download failed:', err);
    }
  }

  const playDisabled = $derived(previewState === 'growing' || previewState === 'generating');
  const downloadDisabled = $derived(previewState !== 'ready' || !videoBlobUrl);
  const previewHeight = $derived(previewState === 'idle' ? IDLE_HEIGHT : videoHeight);
  const previewLabel = $derived(
    previewState === 'generating'
      ? `${exportProgress.message}`
      : previewState === 'ready'
        ? ''
        : 'Press play to animate'
  );
</script>

<div class="animate-toolbar">
  <button
    class="anim-btn play-btn"
    onclick={handlePlayClick}
    disabled={playDisabled}
    aria-label={isPlaying ? 'Pause' : 'Play'}
    title={isPlaying ? 'Pause' : 'Play'}
  >
    <img src={isPlaying ? '/icons/icon-pause-new.svg' : '/icons/icon-play-new.svg'} alt="" width="16" height="16" />
  </button>

  <div class="duration-buttons" role="group" aria-label="Animation duration">
    {#each [1, 2, 3] as const as d}
      <button
        type="button"
        class="duration-btn"
        class:active={duration === d}
        onclick={() => selectDuration(d)}
      >{d}s</button>
    {/each}
  </div>

  <button
    class="anim-btn download-anim-btn"
    onclick={handleDownloadClick}
    disabled={downloadDisabled}
    aria-label="Download video"
    title="Download video"
  >
    <img src="/icons/icon-download.svg" alt="" width="16" height="16" />
  </button>
</div>

<div
  class="animate-preview"
  class:generating={previewState === 'generating'}
  class:ready={previewState === 'ready'}
  style="height: {previewHeight}px;"
  bind:this={previewEl}
>
  <!--
    The <video> element is always mounted (never behind an {#if}) so that
    `bind:this={videoEl}` is valid the moment generateVideo() needs it —
    fixes a bug where src/play() silently no-op'd because the element
    didn't exist yet while previewState was still 'generating'.
    Visibility is controlled purely by CSS.
  -->
  <video
    bind:this={videoEl}
    class="preview-video"
    class:visible={previewState === 'ready'}
    muted
    playsinline
    onended={() => { isPlaying = false; }}
  ></video>
  {#if previewState !== 'ready'}
    <span class="preview-label">{previewLabel}</span>
  {/if}
</div>

<style>
  .animate-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .anim-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    flex-shrink: 0;
    background: none;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: 36px;
    min-width: 36px;
    transition: all var(--duration-fast) ease;
  }

  .anim-btn:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  .anim-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .anim-btn img {
    width: 16px;
    height: 16px;
    filter: brightness(0) saturate(100%);
  }

  .duration-buttons {
    display: flex;
    flex: 1;
    gap: 0.5rem;
    justify-content: center;
  }

  .duration-btn {
    flex: 1;
    height: 36px;
    padding: 0 0.5rem;
    background: none;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
    color: #555555;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    transition: all var(--duration-fast) ease;
  }

  .duration-btn:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  .duration-btn.active {
    background: #555555;
    border-color: #555555;
    color: var(--white);
  }

  .duration-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .animate-preview {
    position: relative;
    margin-top: 0.75rem;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-light);
    border: 1.5px dashed var(--bg-medium);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: height var(--duration-normal) ease;
    scroll-margin-bottom: 6rem;
  }

  /* Chaser border — ported from AudioFlam's AudiogramPage.svelte export
     spinner: two opposite 60deg arcs rotated via an animated custom
     property (smooth continuous sweep, not a stepped transform). */
  .animate-preview.generating::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: calc(var(--radius-md) + 2px);
    background: conic-gradient(
      from var(--export-angle, 0deg),
      var(--color-primary) 0deg,
      transparent 60deg,
      transparent 180deg,
      var(--color-primary) 180deg,
      transparent 240deg,
      transparent 360deg
    );
    z-index: 1;
    pointer-events: none;
    animation: export-spin 5s linear infinite;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    padding: 5px;
  }

  @keyframes export-spin {
    to { --export-angle: 360deg; }
  }

  :global {
    @property --export-angle {
      syntax: '<angle>';
      initial-value: 0deg;
      inherits: false;
    }
  }

  .preview-video {
    display: none;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .preview-video.visible {
    display: block;
  }

  .preview-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-medium);
    text-align: center;
    padding: 0 1rem;
    position: relative;
    z-index: 1;
  }
</style>
