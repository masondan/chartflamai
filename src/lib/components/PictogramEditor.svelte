<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { PICTOGRAM_ICONS, type PictogramIcon } from '$lib/data/pictogram-icons';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  // ─── Pictogram state ───
  let pictogramFilled = $state(6.7);
  let pictogramFilledColor = $state('#8628DC');
  let pictogramUnfilledColor = $state('#e2c4ff');
  let horizontalSpacing = $state(50);
  let verticalSpacing = $state(50);
  let activeSpacingControl = $state<'horizontal' | 'vertical'>('horizontal');
  let currentIconName = $state('gas');
  let currentIconSvg = $state('');
  let allIcons = $state<PictogramIcon[]>([]);
  let iconCategories = $state<Record<string, PictogramIcon[]>>({});
  let bgColor = $state<'white' | 'transparent' | string>('white');

  // ─── Title / Caption state ───
  let chartTitle = $state('');
  let titleFont = $state('Inter');
  let titleAlign = $state<'center' | 'left' | 'right'>('center');
  let titleBold = $state(true);
  let titleItalic = $state(false);
  let titleSizeControl = $state<'size' | 'lineheight'>('size');
  let titleSize = $state(24);
  let titleLineHeight = $state(1.2);
  let titleColor = $state('#555555');
  let chartCaption = $state('');
  let captionFont = $state('Inter');
  let captionAlign = $state<'center' | 'left' | 'right'>('center');
  let captionBold = $state(false);
  let captionItalic = $state(false);
  let captionSizeControl = $state<'size' | 'lineheight'>('size');
  let captionSize = $state(14);
  let captionLineHeight = $state(1.4);
  let captionColor = $state('#555555');

  // ─── UI state ───
  let openSection = $state<string>('data');
  let iconDrawerOpen = $state(false);
  let selectedCategory = $state('');

  // ─── Refs ───
  let canvasEl: HTMLCanvasElement;
  let drawerContentEl: HTMLDivElement;

  const fontOptions = [
    { value: 'Inter', label: 'Inter (Default)' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Roboto Slab', label: 'Roboto Slab' }
  ];

  const alignIcons: Record<string, string> = {
    left: '/icons/icon-align-left.svg',
    center: '/icons/icon-align-center.svg',
    right: '/icons/icon-align-right.svg'
  };

  function cycleAlign(current: 'left' | 'center' | 'right'): 'left' | 'center' | 'right' {
    return current === 'left' ? 'center' : current === 'center' ? 'right' : 'left';
  }

  // ─── SVG helpers ───
  function sanitizeSvg(svgString: string): string {
    if (!browser) return svgString;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return svgString;
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    if (!svg.hasAttribute('viewBox')) {
      svg.setAttribute('viewBox', '0 0 24 24');
    }
    return svg.outerHTML;
  }

  function renderSvgToCanvas(
    ctx: CanvasRenderingContext2D,
    svgString: string,
    x: number, y: number,
    width: number, height: number,
    color: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const coloredSvg = svgString.replace(/currentColor/g, color);
      const img = new Image();
      const blob = new Blob([coloredSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        ctx.drawImage(img, x, y, width, height);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject();
      };
      img.src = url;
    });
  }

  // ─── Icon loading ───
  function loadIcons() {
    allIcons = PICTOGRAM_ICONS;
    const cats: Record<string, PictogramIcon[]> = {};
    allIcons.forEach(icon => {
      if (!cats[icon.category]) cats[icon.category] = [];
      cats[icon.category].push(icon);
    });
    iconCategories = cats;

    const defaultIcon = allIcons.find(i => i.name === 'gas');
    if (defaultIcon) {
      currentIconSvg = sanitizeSvg(defaultIcon.svg);
    }
  }

  function selectIcon(icon: PictogramIcon) {
    currentIconName = icon.name;
    currentIconSvg = sanitizeSvg(icon.svg);
    iconDrawerOpen = false;
  }

  function handleCategoryScroll() {
    if (!selectedCategory || !drawerContentEl) return;
    const header = drawerContentEl.querySelector(`[data-category="${selectedCategory}"]`);
    if (header) {
      header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ─── Pictogram rendering ───
  async function renderPictogram() {
    if (!currentIconSvg || !canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const container = canvasEl.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    canvasEl.width = width;

    const iconsPerRow = 5;
    const totalIcons = 10;
    const rows = 2;
    const hSpacing = horizontalSpacing - 50;
    const vSpacing = verticalSpacing - 50;
    const padding = 20;
    const availableWidth = width - (padding * 2);
    const iconWidth = (availableWidth - (hSpacing * (iconsPerRow - 1))) / iconsPerRow;
    const iconHeight = iconWidth;
    const canvasHeight = (rows * iconHeight) + ((rows - 1) * vSpacing) + (padding * 2);
    canvasEl.height = canvasHeight;
    ctx.clearRect(0, 0, width, canvasHeight);

    const filled = pictogramFilled;
    const fullIcons = Math.floor(filled);
    const partialAmount = filled % 1;

    for (let i = 0; i < totalIcons; i++) {
      const row = Math.floor(i / iconsPerRow);
      const col = i % iconsPerRow;
      const x = padding + (col * (iconWidth + hSpacing));
      const y = padding + (row * (iconHeight + vSpacing));

      if (i < fullIcons) {
        await renderSvgToCanvas(ctx, currentIconSvg, x, y, iconWidth, iconHeight, pictogramFilledColor);
      } else if (i === fullIcons && partialAmount > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, iconWidth * partialAmount, iconHeight);
        ctx.clip();
        await renderSvgToCanvas(ctx, currentIconSvg, x, y, iconWidth, iconHeight, pictogramFilledColor);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(x + (iconWidth * partialAmount), y, iconWidth * (1 - partialAmount), iconHeight);
        ctx.clip();
        await renderSvgToCanvas(ctx, currentIconSvg, x, y, iconWidth, iconHeight, pictogramUnfilledColor);
        ctx.restore();
      } else {
        await renderSvgToCanvas(ctx, currentIconSvg, x, y, iconWidth, iconHeight, pictogramUnfilledColor);
      }
    }
  }

  // ─── Download ───
  async function downloadPictogram() {
    const exportWidth = 1080;
    const iconsPerRow = 5;
    const totalIcons = 10;
    const rows = 2;
    const hSpacing = horizontalSpacing - 50;
    const vSpacing = verticalSpacing - 50;
    const padding = 40;
    const availableWidth = exportWidth - (padding * 2);
    const iconWidth = (availableWidth - (hSpacing * (iconsPerRow - 1))) / iconsPerRow;
    const iconHeight = iconWidth;
    const canvasHeight = (rows * iconHeight) + ((rows - 1) * vSpacing) + (padding * 2);

    let totalHeight = 120;
    if (chartTitle) totalHeight += 80;
    totalHeight += canvasHeight;
    if (chartCaption) totalHeight += 80;
    totalHeight += 60;

    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d')!;
    exportCanvas.width = exportWidth;
    exportCanvas.height = totalHeight;

    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor === 'white' ? '#FFFFFF' : bgColor;
      ctx.fillRect(0, 0, exportWidth, totalHeight);
    }

    let yOffset = 60;

    if (chartTitle) {
      ctx.fillStyle = titleColor;
      const exportTitleSize = Math.round(titleSize * (exportWidth / 480));
      ctx.font = `${titleBold ? 'bold' : 'normal'} ${titleItalic ? 'italic' : 'normal'} ${exportTitleSize}px ${titleFont}, sans-serif`;
      ctx.textAlign = titleAlign;
      const titleX = titleAlign === 'left' ? 40 : (titleAlign === 'right' ? exportWidth - 40 : exportWidth / 2);
      ctx.fillText(chartTitle, titleX, yOffset);
      yOffset += 80;
    }

    const filled = pictogramFilled;
    const fullIcons = Math.floor(filled);
    const partialAmount = filled % 1;

    for (let i = 0; i < totalIcons; i++) {
      const row = Math.floor(i / iconsPerRow);
      const col = i % iconsPerRow;
      const x = padding + (col * (iconWidth + hSpacing));
      const y = yOffset + padding + (row * (iconHeight + vSpacing));

      if (i < fullIcons) {
        await renderSvgToCanvas(ctx, currentIconSvg, x, y, iconWidth, iconHeight, pictogramFilledColor);
      } else if (i === fullIcons && partialAmount > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, iconWidth * partialAmount, iconHeight);
        ctx.clip();
        await renderSvgToCanvas(ctx, currentIconSvg, x, y, iconWidth, iconHeight, pictogramFilledColor);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + (iconWidth * partialAmount), y, iconWidth * (1 - partialAmount), iconHeight);
        ctx.clip();
        await renderSvgToCanvas(ctx, currentIconSvg, x, y, iconWidth, iconHeight, pictogramUnfilledColor);
        ctx.restore();
      } else {
        await renderSvgToCanvas(ctx, currentIconSvg, x, y, iconWidth, iconHeight, pictogramUnfilledColor);
      }
    }

    if (chartCaption) {
      const captionY = yOffset + canvasHeight + 40;
      ctx.fillStyle = captionColor;
      const exportCaptionSize = Math.round(captionSize * (exportWidth / 480));
      ctx.font = `${captionBold ? 'bold' : 'normal'} ${captionItalic ? 'italic' : 'normal'} ${exportCaptionSize}px ${captionFont}, sans-serif`;
      ctx.textAlign = captionAlign;
      const captionX = captionAlign === 'left' ? 40 : (captionAlign === 'right' ? exportWidth - 40 : exportWidth / 2);
      ctx.fillText(chartCaption, captionX, captionY);
    }

    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `chartflamai-pictogram-${timestamp}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  // ─── Title/Caption slider helpers (matching ChartEditor) ───
  function getTitleSliderValue(): number {
    return titleSizeControl === 'size' ? titleSize : Math.round((titleLineHeight - 1.0) * 100 / 1.0 * 32 / 100 + 16);
  }
  function setTitleSlider(val: number) {
    if (titleSizeControl === 'size') {
      titleSize = val;
    } else {
      const lineHeightMap = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
      const index = Math.min(Math.floor((val - 16) / 5.33), 5);
      titleLineHeight = lineHeightMap[index];
    }
  }

  function getCaptionSliderValue(): number {
    return captionSizeControl === 'size' ? captionSize : Math.round((captionLineHeight - 1.0) * 100 / 1.0 * 12 / 100 + 12);
  }
  function setCaptionSlider(val: number) {
    if (captionSizeControl === 'size') {
      captionSize = val;
    } else {
      const lineHeightMap = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
      const index = Math.min(Math.floor((val - 12) / 2), 5);
      captionLineHeight = lineHeightMap[index];
    }
  }

  // ─── Keyboard ───
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (iconDrawerOpen) {
        iconDrawerOpen = false;
      } else {
        onclose();
      }
    }
  }

  // ─── Lifecycle ───
  onMount(() => {
    loadIcons();
  });

  $effect(() => {
    if (!browser || !canvasEl || !currentIconSvg) return;
    // Track all pictogram display dependencies
    pictogramFilled;
    pictogramFilledColor;
    pictogramUnfilledColor;
    horizontalSpacing;
    verticalSpacing;
    currentIconSvg;
    renderPictogram();
  });

  // Derived for spacing slider
  let spacingSliderValue = $derived(activeSpacingControl === 'horizontal' ? horizontalSpacing : verticalSpacing);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="editor-overlay">
  <div class="editor-panel">
    <!-- Header -->
    <div class="editor-header">
      <button class="back-btn" onclick={onclose} aria-label="Back">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M13 4l-6 6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="editor-title">Pictogram</span>
      <button class="back-btn" onclick={downloadPictogram} aria-label="Download" title="Download PNG">
        <img src="/icons/icon-share.svg" alt="" width="18" height="18" />
      </button>
    </div>

    <!-- Canvas preview -->
    <div class="chart-preview" style="background-color: {bgColor === 'white' ? '#FFFFFF' : bgColor === 'transparent' ? 'transparent' : bgColor};">
      {#if chartTitle}
        <h3
          class="preview-title"
          style="
            font-family: '{titleFont}', sans-serif;
            color: {titleColor};
            font-weight: {titleBold ? '700' : '400'};
            font-style: {titleItalic ? 'italic' : 'normal'};
            font-size: {titleSize}px;
            line-height: {titleLineHeight};
            text-align: {titleAlign};
          "
        >{chartTitle}</h3>
      {/if}
      <div class="canvas-container">
        {#if browser}
          <canvas bind:this={canvasEl}></canvas>
        {/if}
      </div>
      {#if chartCaption}
        <p
          class="preview-caption"
          style="
            font-family: '{captionFont}', sans-serif;
            color: {captionColor};
            font-weight: {captionBold ? '700' : '400'};
            font-style: {captionItalic ? 'italic' : 'normal'};
            font-size: {captionSize}px;
            line-height: {captionLineHeight};
            text-align: {captionAlign};
          "
        >{chartCaption}</p>
      {/if}
    </div>

    <!-- Controls accordion -->
    <div class="controls">

      <!-- ═══ DATA ═══ -->
      <div class="control-section" class:open={openSection === 'data'}>
        <button class="section-header" onclick={() => openSection = openSection === 'data' ? '' : 'data'}>
          Data
          <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        {#if openSection === 'data'}
          <div class="section-body">
            <!-- Filled icons row -->
            <div class="control-row">
              <span class="control-label">Filled icons</span>
              <input type="range" bind:value={pictogramFilled} min="0" max="10" step="0.1" class="style-slider" />
              <input
                type="number"
                class="pictogram-input-box"
                value={pictogramFilled}
                oninput={(e) => {
                  let v = parseFloat((e.target as HTMLInputElement).value);
                  if (isNaN(v)) v = 0;
                  if (v < 0) v = 0;
                  if (v > 10) v = 10;
                  pictogramFilled = v;
                }}
                min="0" max="10" step="0.1"
              />
            </div>

            <!-- Spacing row -->
            <div class="control-row">
              <button
                class="ctrl-btn"
                class:active={activeSpacingControl === 'horizontal'}
                onclick={() => { activeSpacingControl = 'horizontal'; }}
                title="Horizontal spacing"
              >
                <img src="/icons/icon-horizontal-space.svg" alt="" width="18" height="18" />
              </button>
              <button
                class="ctrl-btn"
                class:active={activeSpacingControl === 'vertical'}
                onclick={() => { activeSpacingControl = 'vertical'; }}
                title="Vertical spacing"
              >
                <img src="/icons/icon-vertical-space.svg" alt="" width="18" height="18" />
              </button>
              <input
                type="range"
                class="style-slider"
                min="0"
                max="100"
                value={spacingSliderValue}
                oninput={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value);
                  if (activeSpacingControl === 'horizontal') {
                    horizontalSpacing = val;
                  } else {
                    verticalSpacing = val;
                  }
                }}
              />
              <button class="icon-preview-btn" onclick={() => iconDrawerOpen = true} title="Choose icon">
                <div class="icon-preview-inner">
                  {#if currentIconSvg}
                    {@html currentIconSvg.replace(/currentColor/g, pictogramFilledColor)}
                  {/if}
                </div>
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- ═══ COLOURS ═══ -->
      <div class="control-section" class:open={openSection === 'colours'}>
        <button class="section-header" onclick={() => openSection = openSection === 'colours' ? '' : 'colours'}>
          Colours
          <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        {#if openSection === 'colours'}
          <div class="section-body">
            <div class="color-row">
              <span class="color-label">Icons</span>
              <div class="color-pair">
                <input
                  type="color"
                  class="color-picker"
                  value={pictogramFilledColor}
                  oninput={(e) => { pictogramFilledColor = (e.target as HTMLInputElement).value; }}
                  title="Filled color"
                />
                <input
                  type="color"
                  class="color-picker"
                  value={pictogramUnfilledColor}
                  oninput={(e) => { pictogramUnfilledColor = (e.target as HTMLInputElement).value; }}
                  title="Unfilled color"
                />
              </div>
            </div>
            <div class="color-row">
              <span class="color-label">Background</span>
              <div class="bg-options">
                <button class="bg-option" class:active={bgColor === 'white'} onclick={() => bgColor = 'white'} title="White background">
                  <span class="bg-circle bg-white"></span>
                </button>
                <button class="bg-option" class:active={bgColor === 'transparent'} onclick={() => bgColor = 'transparent'} title="Transparent background">
                  <span class="bg-circle bg-transparent"></span>
                </button>
                <label class="bg-option" class:active={bgColor !== 'white' && bgColor !== 'transparent'} title="Custom background">
                  <span class="bg-circle bg-rainbow"></span>
                  <input
                    type="color"
                    class="visually-hidden"
                    value={bgColor === 'white' || bgColor === 'transparent' ? '#FFFFFF' : bgColor}
                    oninput={(e) => { bgColor = (e.target as HTMLInputElement).value; }}
                  />
                </label>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- ═══ TITLE ═══ -->
      <div class="control-section" class:open={openSection === 'title'}>
        <button class="section-header" onclick={() => openSection = openSection === 'title' ? '' : 'title'}>
          Title
          <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        {#if openSection === 'title'}
          <div class="section-body">
            <input
              type="text"
              value={chartTitle}
              oninput={(e) => { chartTitle = (e.target as HTMLInputElement).value; }}
              placeholder="Add chart title"
              maxlength={100}
            />
            <div class="text-control-row">
              <select class="font-select" bind:value={titleFont} style="font-family: '{titleFont}', sans-serif;">
                {#each fontOptions as font}
                  <option value={font.value} style="font-family: '{font.value}', sans-serif;">{font.label}</option>
                {/each}
              </select>
              <button class="ctrl-btn" onclick={() => { titleAlign = cycleAlign(titleAlign); }} title="Text alignment">
                <img src={alignIcons[titleAlign]} alt="" width="16" height="16" />
              </button>
              <button class="ctrl-btn" class:active={titleBold} onclick={() => { titleBold = !titleBold; }} title="Bold">
                <img src="/icons/icon-bold.svg" alt="" width="16" height="16" />
              </button>
              <button class="ctrl-btn" class:active={titleItalic} onclick={() => { titleItalic = !titleItalic; }} title="Italic">
                <img src="/icons/icon-italic.svg" alt="" width="16" height="16" />
              </button>
            </div>
            <div class="text-control-row">
              <button class="ctrl-btn" class:active={titleSizeControl === 'size'} onclick={() => { titleSizeControl = 'size'; }} title="Font size">
                <img src="/icons/icon-font-size.svg" alt="" width="16" height="16" />
              </button>
              <button class="ctrl-btn" class:active={titleSizeControl === 'lineheight'} onclick={() => { titleSizeControl = 'lineheight'; }} title="Line spacing">
                <img src="/icons/icon-line-spacing.svg" alt="" width="16" height="16" />
              </button>
              <input
                type="range"
                class="style-slider"
                min="16"
                max="48"
                value={getTitleSliderValue()}
                oninput={(e) => setTitleSlider(Number((e.target as HTMLInputElement).value))}
              />
              <input
                type="color"
                class="color-picker"
                value={titleColor}
                oninput={(e) => { titleColor = (e.target as HTMLInputElement).value; }}
              />
            </div>
          </div>
        {/if}
      </div>

      <!-- ═══ CAPTION & SOURCE ═══ -->
      <div class="control-section" class:open={openSection === 'caption'}>
        <button class="section-header" onclick={() => openSection = openSection === 'caption' ? '' : 'caption'}>
          Caption & Source
          <svg class="section-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        {#if openSection === 'caption'}
          <div class="section-body">
            <input
              type="text"
              value={chartCaption}
              oninput={(e) => { chartCaption = (e.target as HTMLInputElement).value; }}
              placeholder="Caption and Data Source"
              maxlength={200}
            />
            <div class="text-control-row">
              <select class="font-select" bind:value={captionFont} style="font-family: '{captionFont}', sans-serif;">
                {#each fontOptions as font}
                  <option value={font.value} style="font-family: '{font.value}', sans-serif;">{font.label}</option>
                {/each}
              </select>
              <button class="ctrl-btn" onclick={() => { captionAlign = cycleAlign(captionAlign); }} title="Text alignment">
                <img src={alignIcons[captionAlign]} alt="" width="16" height="16" />
              </button>
              <button class="ctrl-btn" class:active={captionBold} onclick={() => { captionBold = !captionBold; }} title="Bold">
                <img src="/icons/icon-bold.svg" alt="" width="16" height="16" />
              </button>
              <button class="ctrl-btn" class:active={captionItalic} onclick={() => { captionItalic = !captionItalic; }} title="Italic">
                <img src="/icons/icon-italic.svg" alt="" width="16" height="16" />
              </button>
            </div>
            <div class="text-control-row">
              <button class="ctrl-btn" class:active={captionSizeControl === 'size'} onclick={() => { captionSizeControl = 'size'; }} title="Font size">
                <img src="/icons/icon-font-size.svg" alt="" width="16" height="16" />
              </button>
              <button class="ctrl-btn" class:active={captionSizeControl === 'lineheight'} onclick={() => { captionSizeControl = 'lineheight'; }} title="Line spacing">
                <img src="/icons/icon-line-spacing.svg" alt="" width="16" height="16" />
              </button>
              <input
                type="range"
                class="style-slider"
                min="12"
                max="24"
                value={getCaptionSliderValue()}
                oninput={(e) => setCaptionSlider(Number((e.target as HTMLInputElement).value))}
              />
              <input
                type="color"
                class="color-picker"
                value={captionColor}
                oninput={(e) => { captionColor = (e.target as HTMLInputElement).value; }}
              />
            </div>
          </div>
        {/if}
      </div>

      <!-- Download -->
      <div class="download-section">
        <button class="download-btn primary" onclick={downloadPictogram}>
          Download PNG
        </button>
      </div>

    </div>
  </div>
</div>

<!-- Icon search drawer -->
{#if iconDrawerOpen}
  <div class="icon-drawer-overlay" role="dialog" aria-label="Choose icon">
    <div class="icon-drawer">
      <div class="drawer-header-bar">
        <button class="close-drawer-btn" onclick={() => iconDrawerOpen = false} aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        <div class="category-dropdown">
          <label for="pictogram-category-select">Icon Category</label>
          <select
            id="pictogram-category-select"
            bind:value={selectedCategory}
            onchange={handleCategoryScroll}
          >
            <option value="">All Categories</option>
            {#each Object.keys(iconCategories) as cat}
              <option value={cat}>{cat}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="drawer-content" bind:this={drawerContentEl}>
        {#each Object.entries(iconCategories) as [category, icons]}
          <div class="icon-category-header" data-category={category}>{category}</div>
          <div class="icon-grid">
            {#each icons as icon}
              <button class="icon-item" onclick={() => selectIcon(icon)} title={icon.name}>
                {@html icon.svg}
              </button>
            {/each}
          </div>
        {/each}
        <div style="height: 80vh;"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Full-screen overlay — matches ChartEditor */
  .editor-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    background: var(--bg-surface);
    overflow-y: auto;
  }

  .editor-panel {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    background: var(--white);
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.08);
  }

  /* Header */
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--white);
    z-index: 10;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-round);
    cursor: pointer;
    color: var(--text-dark);
    min-height: 36px;
    min-width: 36px;
  }

  .back-btn:hover {
    background: var(--bg-light);
  }

  .editor-title {
    font-weight: var(--font-weight-semibold);
    color: var(--text-dark);
  }

  /* Chart preview */
  .chart-preview {
    margin: 0.75rem 1rem 0;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .preview-title {
    margin-bottom: 0.5rem;
  }

  .canvas-container {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  canvas {
    width: 100%;
    display: block;
  }

  .preview-caption {
    margin-top: 0.375rem;
    margin-bottom: 0;
  }

  /* Controls */
  .controls {
    padding: 0.75rem 1rem 1rem;
  }

  .control-section {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    margin-bottom: 0.5rem;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.75rem 1rem;
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    cursor: pointer;
    min-height: 44px;
    background: none;
    border: none;
    border-radius: var(--radius-lg);
    color: var(--text-dark);
    text-align: left;
  }

  .section-chevron {
    transition: transform var(--duration-fast) ease;
    color: var(--text-medium);
    flex-shrink: 0;
  }

  .control-section.open .section-chevron {
    transform: rotate(180deg);
  }

  .section-body {
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-body input[type="text"] {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
  }

  /* Control rows */
  .control-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .control-label {
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    min-width: 80px;
  }

  .style-slider {
    flex: 1;
    min-width: 0;
  }

  .pictogram-input-box {
    width: 44px;
    height: 44px;
    padding: var(--spacing-xs);
    border: 1px solid var(--bg-medium);
    border-radius: var(--radius-sm);
    text-align: center;
    font-size: 0.95rem;
    font-family: var(--font-family);
    -moz-appearance: textfield;
    min-height: 44px;
    min-width: 44px;
  }

  .pictogram-input-box::-webkit-inner-spin-button,
  .pictogram-input-box::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Button controls — matches ChartEditor .ctrl-btn */
  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-medium);
    min-height: 36px;
    min-width: 36px;
    transition: all var(--duration-fast) ease;
  }

  .ctrl-btn.active {
    border-color: var(--color-primary);
    background: var(--color-highlight);
  }

  .ctrl-btn:hover:not(.active) {
    background: var(--bg-light);
  }

  .icon-preview-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: var(--white);
    border: 1px solid var(--bg-medium);
    border-radius: var(--radius-sm);
    padding: 4px;
    min-height: 44px;
    min-width: 44px;
  }

  .icon-preview-btn:hover {
    border-color: var(--color-primary);
  }

  .icon-preview-inner {
    width: 30px;
    height: 30px;
  }

  .icon-preview-inner :global(svg) {
    width: 100%;
    height: 100%;
  }

  /* Color controls */
  .color-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .color-label {
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
  }

  .color-pair {
    display: flex;
    gap: var(--spacing-sm);
  }

  /* Text controls — matches ChartEditor */
  .text-control-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .font-select {
    flex: 1;
    min-width: 0;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    background: var(--white);
  }

  /* Icon drawer */
  .icon-drawer-overlay {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-modal) + 10);
  }

  .icon-drawer {
    position: absolute;
    inset: 0;
    background: var(--white);
    display: flex;
    flex-direction: column;
    animation: slideUp var(--duration-normal) ease-out;
    max-width: 480px;
    margin: 0 auto;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .drawer-header-bar {
    position: sticky;
    top: 0;
    background: var(--white);
    padding: var(--spacing-md);
    border-bottom: 2px solid var(--bg-light);
    z-index: var(--z-header);
  }

  .close-drawer-btn {
    position: absolute;
    top: var(--spacing-md);
    right: var(--spacing-md);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-xs);
    color: var(--text-medium);
    min-height: 36px;
  }

  .close-drawer-btn:hover {
    color: var(--text-dark);
  }

  .category-dropdown {
    margin-top: var(--spacing-xl);
  }

  .category-dropdown label {
    display: block;
    font-weight: 600;
    margin-bottom: var(--spacing-xs);
    color: var(--text-dark);
  }

  .category-dropdown select {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--bg-medium);
    border-radius: var(--radius-sm);
    font-size: 1rem;
    background: white;
    color: var(--text-dark);
  }

  .drawer-content {
    padding: var(--spacing-md);
    overflow-y: auto;
    flex: 1;
  }

  .icon-category-header {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-dark);
    margin-top: var(--spacing-xl);
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-xs);
    border-bottom: 2px solid var(--bg-medium);
  }

  .icon-category-header:first-child {
    margin-top: 0;
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }

  .icon-item {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 2px solid var(--bg-light);
    border-radius: var(--radius-sm);
    background: var(--white);
    padding: var(--spacing-xs);
    min-height: 60px;
    min-width: 60px;
    transition: all var(--duration-fast) ease;
  }

  .icon-item :global(svg) {
    width: 36px;
    height: 36px;
    color: var(--text-medium);
  }

  .icon-item:hover {
    border-color: var(--color-primary);
    background: var(--color-highlight);
    transform: scale(1.05);
  }

  .icon-item:active {
    transform: scale(0.95);
  }

  @media (max-width: 480px) {
    .icon-grid {
      grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    }
    .icon-item {
      width: 50px;
      height: 50px;
      min-height: 50px;
      min-width: 50px;
    }
    .icon-item :global(svg) {
      width: 30px;
      height: 30px;
    }
  }

  /* Download */
  .download-section {
    margin-top: 0.5rem;
  }

  .download-btn {
    width: 100%;
  }

  /* Slider in text control rows */
  .text-control-row input[type="range"] {
    flex: 1;
    accent-color: var(--color-primary);
    min-height: auto;
    padding: 0;
    border: none;
  }
</style>
