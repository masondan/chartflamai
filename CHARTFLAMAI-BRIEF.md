# ChartFlamAI: Implementation Brief

**Project**: ChartFlamAI — AI-Powered Data Discovery & Chart Generation  
**Version**: 1.1  
**Status**: Approved for Development  
**Last Updated**: March 30, 2026  
**Scope**: Educational tool for journalists; non-commercial training focus  
**Deployment**: Cloudflare Pages → `chartflamai.pages.dev` (later: `chartflamai.flamtools.com`)  
**Repository**: GitHub (commit after initial framework setup)

---

## Executive Summary

ChartFlamAI is a new SvelteKit application that enables journalists to discover, extract, and visualize data through AI-guided workflows. It deploys to Cloudflare Pages (`chartflamai.pages.dev`) as a **standalone app**, with potential migration to `chartflamai.flamtools.com` post-validation. Integration with ChartFlam is deferred pending the outcome of this experiment.

Users can generate publication-ready charts in seconds by:
1. **Search**: Ask AI to find data and suggest story angles
2. **Source**: Upload PDFs/URLs and let AI mine for insights
3. **Paste**: Analyze CSV data and discover visualization angles

All three workflows feed into a unified "angles discovery" engine, returning headlines, summaries, and pre-formatted chart data—no raw data shown to users.

### Supported Chart Types

The following chart types are supported in the AI pipeline (all rendered via Chart.js):

| Type | Chart.js Type | Icon | AI-Suggested | Notes |
|------|--------------|------|-------------|-------|
| **Pie** | `pie` | `icon-pie-chart.svg` | ✅ | Single-series categorical data |
| **Donut** | `doughnut` | `icon-donut-chart.svg` | ✅ | Same as pie with centre cutout |
| **Line** | `line` | `icon-line-chart.svg` | ✅ | Time-series, trends |
| **Bar (vertical)** | `bar` | `icon-vertical-bars.svg` | ✅ | Categorical comparison |
| **Horizontal Bar** | `bar` (indexAxis: 'y') | `icon-horizontal-bars.svg` | ✅ | Long category labels |
| **Stacked Bar** | `bar` (stacked: true) | `icon-stacked-bars.svg` | ✅ | Part-to-whole across categories |
| **Pictogram** | Custom component | `icon-pictogram.svg` | ❌ | Manual only; separate from AI pipeline (see below) |

> **Pictogram strategy**: Pictograms are **not** part of the AI→Chart.js pipeline. They require a fundamentally different data structure (a ratio, e.g. "7 out of 10") rather than Chart.js datasets. Pictograms are best suited as a **manual editorial choice** — the journalist sees a stat and decides to present it as a pictogram. The pictogram icon appears in the UI as a separate "Create a pictogram" action (not in the chart type toggle row). It opens a simple manual input (ported from the ChartFlam pictogram component with its slider). **Status: Coming Soon placeholder** — the icon and CTA are present but not wired up until the ChartFlam pictogram component is ported.

---

## Architecture & Technical Decisions

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | SvelteKit + `@sveltejs/adapter-cloudflare` | Reactive, component-based; server routes protect API keys natively |
| **Build** | Vite | Fast HMR; native ES modules |
| **Styling** | CSS custom properties (matching ChartFlam) | Consistency; no additional tooling |
| **State** | Svelte stores (writable) | Centralized, reactive state for multi-step workflows |
| **Charts** | Chart.js 4.4.0 | Lightweight; matches ChartFlam |
| **Data Input** | PDF.js, PapaParse | Client-side extraction; no server needed |
| **LLM Search** | Perplexity Sonar API | Web search + citations; ~$0.006/request |
| **LLM Structuring** | OpenAI GPT-5 Nano | Strict JSON schema mode; ~$0.0004/request; structures Perplexity output into Chart.js-ready data |
| **Server Routes** | SvelteKit `+server.js` endpoints | API keys accessed via `platform.env` on Cloudflare; no separate Worker needed |
| **Deployment** | Cloudflare Pages | SvelteKit adapter-cloudflare; server routes become Cloudflare Functions automatically |
| **Icons** | SVG (provided by user) | Local loading; no CDN dependency |
| **Typography** | Inter (variable font, local) | Match ChartFlam; single `.ttf` variable font file |

### LLM API Strategy: Two-Step Pipeline

ChartFlamAI uses a **two-step LLM pipeline** for reliability and cost control:

| Step | Service | Role | Cost/request | JSON Reliability |
|------|---------|------|-------------|-----------------|
| 1. **Search & Summarize** | Perplexity Sonar (low context) | Web search, find data, return text + citations | ~$0.006 | N/A (returns prose) |
| 2. **Structure into JSON** | OpenAI GPT-5 Nano | Takes search text → produces strict JSON matching Chart.js schema | ~$0.0004 | ✅ Guaranteed via `response_format: { type: "json_schema" }` |
| **Total** | | | **~$0.007** | |

**Why two steps instead of one?**
- Perplexity excels at web search with citations but has **no strict JSON mode**. Asking it to search AND produce complex nested JSON in one shot produces frequent malformed output (missing brackets, hallucinated data, inconsistent schema).
- GPT-5 Nano with `response_format: { type: "json_schema", strict: true }` **guarantees** valid JSON matching the defined schema. It costs fractions of a cent per call.
- For **Source** and **Paste** modes (no web search needed), skip Perplexity entirely — send extracted text directly to GPT-5 Nano (or GPT-5 Mini for better analytical quality on complex data).

**Alternative structuring models** (if OpenAI is unavailable or for cost comparison):

| Model | Input $/M | Output $/M | Est. cost/call | JSON Reliability | Link |
|-------|-----------|------------|---------------|-----------------|------|
| **GPT-5 Nano** (recommended) | $0.05 | $0.40 | ~$0.0004 | ✅ Strict JSON schema | [openai.com/api/pricing](https://developers.openai.com/api/docs/pricing/) |
| Gemini 2.0 Flash | $0.10 | $0.40 | ~$0.0005 | ✅ `response_mime_type` + schema | [cloud.google.com/vertex-ai/pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) |
| GPT-5 Mini | $0.25 | $2.00 | ~$0.002 | ✅ Strict JSON schema | Same OpenAI link |
| Gemini 2.5 Flash | $0.30 | $2.50 | ~$0.003 | ✅ Schema enforcement | Same Google link |
| Claude Haiku 4.5 | $1.00 | $5.00 | ~$0.005 | ✅ Via forced tool_choice | [docs.anthropic.com/pricing](https://docs.anthropic.com/en/docs/about-claude/pricing) |

### Core Architecture

```
ChartFlamAI/
├── src/
│   ├── routes/
│   │   ├── +page.svelte          # Main layout with tab selection
│   │   ├── +layout.svelte        # Global layout, header, footer
│   │   ├── api/
│   │   │   ├── search/+server.js # Step 1: Perplexity search → Step 2: GPT-5 Nano structuring
│   │   │   └── analyze/+server.js# Source/Paste: GPT-5 Nano structuring (no Perplexity needed)
│   │   └── import/
│   │       └── +server.js        # Optional: handle deep-links from ChartFlam
│   ├── lib/
│   │   ├── components/
│   │   │   ├── SearchTab.svelte       # Search mode UI
│   │   │   ├── SourceTab.svelte       # Source mode UI (PDF/URL)
│   │   │   ├── PasteTab.svelte        # Paste mode UI
│   │   │   ├── AngleCard.svelte       # Accordion card: headline → expand to preview chart + controls
│   │   │   ├── ChartDisplay.svelte    # Renders chart from data (Chart.js)
│   │   │   ├── ChartTypeBar.svelte    # Row of chart type icons; active/inactive based on data compatibility
│   │   │   ├── BottomDrawer.svelte    # Reusable rising drawer modal (used for Sources, Data, Explain)
│   │   │   ├── EditDrawer.svelte      # Full-page edit drawer with customisation options (Coming Soon placeholder)
│   │   │   ├── PictogramPlaceholder.svelte # "Create a pictogram" CTA (Coming Soon)
│   │   │   ├── LoadingSpinner.svelte
│   │   │   └── SourcePreview.svelte   # Shows extracted text/data before analysis
│   │   ├── stores/
│   │   │   ├── aiState.js        # Centralized workflow state
│   │   │   └── uiState.js        # UI-only state (active tab, loading, etc.)
│   │   ├── utils/
│   │   │   ├── prompts.js        # System prompts for each mode
│   │   │   ├── validators.js     # JSON schema validation (client-side utility, not API route)
│   │   │   ├── extractors.js     # PDF.js, CSV parsing wrappers
│   │   │   ├── json-repair.js    # LLM response repair (strip fences, fix trailing commas)
│   │   │   └── formatters.js     # Convert responses to Chart.js format
│   │   └── config/
│   │       ├── design.js         # Design tokens (colors, spacing, breakpoints)
│   │       └── constants.js      # Magic numbers, limits, etc.
│   ├── app.css                   # Global styles (matching ChartFlam)
│   └── app.html                  # Root template
├── static/
│   ├── fonts/
│   │   └── Inter-VariableFont_opsz,wght.ttf  # Inter variable font (single file)
│   ├── icons/                    # SVG icons from ChartFlam (see info/icons/)
│   │   ├── icon-pie-chart.svg
│   │   ├── icon-donut-chart.svg
│   │   ├── icon-line-chart.svg
│   │   ├── icon-vertical-bars.svg
│   │   ├── icon-horizontal-bars.svg
│   │   ├── icon-stacked-bars.svg
│   │   ├── icon-pictogram.svg
│   │   ├── icon-edit-fill.svg
│   │   ├── icon-upload.svg
│   │   ├── icon-close.svg
│   │   ├── icon-share.svg
│   │   ├── icon-expand.svg
│   │   ├── icon-collapse.svg
│   │   └── ... (full set from info/icons/)
│   ├── logos/
│   │   ├── logo-chartflam-ai-logotype.png  # Logotype wordmark (header)
│   │   ├── logo-chartflam-ai-maskable.png  # 512×512 maskable icon (PWA)
│   │   ├── logo-chartflam-ai-touch.png     # Apple touch icon
│   │   ├── logo-chartflam-ai-og.png        # Open Graph image
│   │   ├── logo-chartflam-ai-favicon.ico   # Favicon
│   │   └── logo-chartflam-ai-favicon.svg   # Favicon (SVG)
│   └── manifest.json             # PWA manifest
├── svelte.config.js              # Uses @sveltejs/adapter-cloudflare
├── vite.config.js
├── IMPLEMENTATION.md             # This brief
└── README.md
```

### State Management: Svelte Stores Pattern

**`lib/stores/aiState.js`**:
```javascript
import { writable } from 'svelte/store';

export const aiState = writable({
  // Workflow step
  step: 'input', // 'input' | 'loading' | 'results' | 'error'
  
  // User inputs (mode is derived from uiState.activeTab — single source of truth)
  audience: '', // Free-text input, e.g., "Urban journalists in West Africa"
  query: '', // User's question or data
  
  // For 'source' mode
  sourceType: 'pdf', // 'pdf' | 'url' | 'google-sheet' | 'docx'
  sourceFile: null, // File object
  sourceUrl: '',
  extractedText: '', // Raw extraction before AI analysis
  
  // API response (cached in memory)
  apiResponse: null, // { angles: [...] } — data nested inside each angle
  
  // Per-angle chart type overrides (user switching chart types)
  // Key: angle ID, Value: currently selected chart type
  angleChartTypes: {}, // e.g., { angle_1: 'bar', angle_2: 'pie' }
  
  // Error handling
  error: null, // { message, code, retryable }
  
  // Metadata
  timestamp: null,
  sources: [] // Attribution links
});

// uiState.activeTab is the single source of truth for which mode is active.
// Do NOT duplicate this as a separate 'mode' property in aiState.
export const uiState = writable({
  activeTab: 'search', // 'search' | 'source' | 'paste'
  isLoading: false,
  showSourcePreview: false, // Show extracted data before AI analysis
  previewText: '',
  rateLimited: false, // True when API rate limit hit; triggers UI feedback
  expandedAngleId: null, // Which angle card accordion is expanded (null = all collapsed)
  activeDrawer: null, // 'sources' | 'data' | 'explain' | null — which BottomDrawer is open
  activeDrawerAngleId: null // Which angle's drawer is open
});
```

---

## User Workflows

### Unified Flow (All Three Modes)

```
┌─────────────────────────────────────────────────┐
│ 1. MODE SELECTION                               │
│ User selects tab: Search | Source | Paste       │
└────────────────┬────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ INPUT STAGE    │
         │ (Mode-specific)│
         └───────┬────────┘
                 │
    ┌────────────┴────────────┬──────────────┐
    │                         │              │
  Search              Source (PDF/URL)   Paste (CSV)
  [Question]          [File upload]      [Paste data]
  [Audience]          [Or URL input]     [Optional: question]
  [Chart it]          [Extract preview]  [Chart it]
    │                 [Restricted? ✓]    │
    │                 [Chart it]         │
    └────────┬────────┬──────────────────┘
             │        │
      ┌──────▼────────▼────────┐
      │  API CALL              │
      │  Two-step pipeline:    │
      │  Perplexity Sonar →    │
      │  GPT-5 Nano (JSON)     │
      └──────┬─────────────────┘
             │
      ┌──────▼──────────────────────────────────┐
      │  RESULTS: 3 ACCORDION ANGLE CARDS       │
      │  (collapsed by default, headline only)  │
      └──────┬──────────────────────────────────┘
             │
    ┌────────▼───────────────────────────────────┐
    │ USER EXPANDS AN ANGLE CARD                 │
    │ Reveals:                                   │
    │  - Summary text                            │
    │  - Chart type icon row (active/inactive    │
    │    based on data compatibility)            │
    │  - Inline chart preview (~200px height)    │
    │  - [Sources] [Data] [Explain] buttons      │
    │    (each opens a BottomDrawer modal)       │
    │  - [Edit] button → EditDrawer              │
    │    (Coming Soon placeholder)               │
    │  Chart renders from cache (NO 2nd API call)│
    └────────┬───────────────────────────────────┘
             │
    ┌────────▼──────────────────────────┐
    │ BOTTOM DRAWER MODALS              │
    │ (reusable rising panel)           │
    │  - Sources: attribution + links   │
    │  - Data: raw data table           │
    │  - Explain: AI reasoning          │
    │ Rises to fit content; full-screen │
    │ if needed. Copy/Share/Download    │
    │ actions in footer.                │
    └────────┬──────────────────────────┘
             │
    ┌────────▼──────────────────────────┐
    │ CHART TYPE SWITCHING              │
    │ User taps alt chart type icon →   │
    │ re-renders same cached data with  │
    │ new Chart.js type parameter       │
    │ (NO additional API call)          │
    └────────┬──────────────────────────┘
             │
    ┌────────▼─────────────────┐
    │ PICTOGRAM (separate CTA) │
    │ "Create a pictogram"     │
    │ Opens manual input       │
    │ (Coming Soon placeholder)│
    └──────────────────────────┘
```

### Mode 1: Search
- **Input**: Question + Audience selector
- **Process**: Perplexity web search → AI analysis → 3 angles
- **Output**: Headlines, summaries, pre-formatted data
- **UX**: Simple, minimal inputs; fast API call (~3–5 seconds)

### Mode 2: Source
- **Input**: PDF upload OR URL
- **Process**: 
  1. Extract text/data (PDF.js for PDF; Perplexity for URL)
  2. Show preview; user can confirm or edit
  3. Optional: User adds a question OR clicks "Suggest angles"
  4. Optional: Toggle "restrict to source" or "search widely"
  5. API call with context
- **Output**: Same as Search (headlines, summaries, data)
- **UX**: Two-step (extract → preview), then optional question

### Mode 3: Paste
- **Input**: CSV data pasted directly
- **Process**:
  1. Parse CSV (PapaParse)
  2. Show preview
  3. Optional: User adds a question OR clicks "Suggest angles"
  4. API call analyzes the data
- **Output**: Same as Search
- **UX**: Text input + preview; lowest friction

---

## API Response Structure

All three modes return the **same JSON structure** (cached in `aiState`):

```json
{
  "query": "Original user question or extracted data summary",
  "sourceType": "search|pdf|url|csv",
  "sourceData": {
    "text": "Raw extracted text (if applicable)",
    "citations": ["source1.com", "source2.com"]
  },
  "angles": [
    {
      "id": "angle_1",
      "headline": "Headline (max 70 chars)",
      "summary": "1–2 sentence summary",
      "suggestedChartType": "line",
      "compatibleChartTypes": ["line", "bar", "horizontalBar"],
      "reasoning": "Why this chart type works well",
      "sources": ["Source 1", "Source 2"],
      "keyFinding": "One-sentence key insight",
      "explain": "2–3 paragraph explanation of what this data means for the audience",
      "data": {
        "labels": ["Label 1", "Label 2"],
        "datasets": [
          {
            "label": "Series 1",
            "data": [10, 20, 30],
            "borderColor": "#5422b0",
            "backgroundColor": "rgba(84, 34, 176, 0.1)"
          }
        ]
      }
    },
    {
      "id": "angle_2",
      "headline": "...",
      "summary": "...",
      "suggestedChartType": "pie",
      "compatibleChartTypes": ["pie", "doughnut"],
      "reasoning": "...",
      "sources": ["..."],
      "keyFinding": "...",
      "explain": "...",
      "data": { "labels": ["..."], "datasets": [{ "...": "..." }] }
    },
    {
      "id": "angle_3",
      "headline": "...",
      "summary": "...",
      "suggestedChartType": "bar",
      "compatibleChartTypes": ["bar", "horizontalBar", "stackedBar"],
      "reasoning": "...",
      "sources": ["..."],
      "keyFinding": "...",
      "explain": "...",
      "data": { "labels": ["..."], "datasets": [{ "...": "..." }] }
    }
  ]
}
```

> **Design note**: Data is nested inside each angle (not in a separate `data` object keyed by angle ID). This prevents ID mismatches between `angles[]` and `data{}`, makes validation simpler, and is easier for the LLM to produce reliably.

> **Chart type fields**: `suggestedChartType` is the LLM's primary recommendation (rendered by default). `compatibleChartTypes` lists all valid Chart.js types for this data shape — the ChartTypeBar component uses this to enable/disable icons. Switching chart type re-renders the same cached data with a different `type` parameter (no API call). Valid values: `pie`, `doughnut`, `line`, `bar`, `horizontalBar`, `stackedBar`.

> **Chart colors**: Default to brand purple (`#5422b0`) palette. Client-side color customization (matching ChartFlam's 8-color presets + rainbow selector) will be added in Tier 2.

> **Explain field**: The `explain` field provides a journalist-friendly explanation of the data angle, rendered in the Explain BottomDrawer modal. This is generated in the same API call — no additional request needed.

---

## System Prompts (Mode-Specific)

Each mode uses a **two-step pipeline**. Prompts are stored in `lib/utils/prompts.js`.

**Step 1 prompts** go to Perplexity Sonar (search mode) or are skipped (source/paste).  
**Step 2 prompt** (STRUCTURING_PROMPT) goes to GPT-5 Nano for JSON structuring — shared across all modes.

### Mode 1: Search (Internet Data Discovery)

**Step 1 — Perplexity Sonar prompt** (returns prose + citations):

```javascript
export const SEARCH_PROMPT = `
You are a data journalist AI. A journalist is asking a question to find
relevant data and story angles.

JOURNALIST'S AUDIENCE: {audience}
JOURNALIST'S QUESTION: {query}

Your task:
1. Search authoritative sources for relevant data (government stats, 
   academic research, NGO reports, etc.)
2. Identify 3 distinct story angles from this data
3. For EACH angle, provide:
   - A compelling headline (max 70 characters, no quotes)
   - A brief summary (1–2 sentences explaining the angle)
   - The best chart type(s) to visualize (choose from: pie, doughnut, line, bar, horizontalBar, stackedBar)
   - Reasoning for why this chart type works well
   - Source citations (with URLs if possible)
   - One key finding (1 sentence)
4. Include the underlying numerical data for each angle

IMPORTANT:
- Include actual numerical data points (not just descriptions)
- Each angle should present a DIFFERENT perspective on the same data
- Avoid speculation; cite sources
- Keep summaries jargon-free for non-technical journalists

Return your analysis as structured text with clear sections for each angle.
`;
```

**Step 2 — GPT-5 Nano structuring prompt** (shared across all modes):

```javascript
export const STRUCTURING_PROMPT = `
You are a data formatting assistant. Convert the following analysis into
a strict JSON structure for Chart.js visualization.

ANALYSIS:
{analysisText}

SOURCES/CITATIONS:
{citations}

Return a JSON object with this exact structure. Data is nested INSIDE each angle:
{
  "query": "original question",
  "sourceType": "{sourceType}",
  "sourceData": {
    "text": "Brief summary",
    "citations": ["url1", "url2"]
  },
  "angles": [
    {
      "id": "angle_1",
      "headline": "headline (max 70 chars)",
      "summary": "1-2 sentence summary",
      "suggestedChartType": "line",
      "compatibleChartTypes": ["line", "bar"],
      "reasoning": "why this chart works",
      "sources": ["Source Name: url"],
      "keyFinding": "key insight",
      "explain": "2-3 paragraph explanation of what this data means",
      "data": {
        "labels": ["x-axis labels"],
        "datasets": [{
          "label": "Series name",
          "data": [numeric values],
          "borderColor": "#5422b0",
          "backgroundColor": "rgba(84, 34, 176, 0.1)"
        }]
      }
    }
  ]
}

IMPORTANT:
- All data values must be numeric (no strings in data arrays)
- Labels must be strings
- Include exactly 3 angles
- Each angle MUST include its own "data" object
- "suggestedChartType" is your primary recommendation (one of: pie, doughnut, line, bar, horizontalBar, stackedBar)
- "compatibleChartTypes" lists ALL chart types that would work with this data shape
  - pie/doughnut: only for single-series categorical data
  - line: for time-series or sequential data
  - bar/horizontalBar: for categorical comparisons
  - stackedBar: only when multiple series exist
- "explain" should be a journalist-friendly explanation (2-3 paragraphs) of what the data means and why it matters
`;
```

### Mode 2a: Source (PDF/Document Analysis)

> **Note**: Source mode sends extracted text directly to GPT-5 Nano (or GPT-5 Mini for complex documents). No Perplexity call unless scope is "search-widely", in which case Step 1 uses Perplexity to supplement.

```javascript
export const SOURCE_PROMPT_DOCUMENT = `
You are a data journalist AI. A journalist has provided a document
(PDF, report, data table) and wants to extract data and find story angles.

DOCUMENT CONTENT:
{extractedText}

JOURNALIST'S REQUEST: {query}
SEARCH SCOPE: {scope} (values: "restrict-to-document" or "search-widely")

Your task:
1. Analyze the data in the provided document
2. If scope is "search-widely", supplement with external authoritative sources
3. Identify 3 distinct story angles from this data
4. For EACH angle, provide:
   - A compelling headline (max 70 characters)
   - A brief summary (1–2 sentences)
   - The best chart type(s) to visualize
   - Reasoning for the chart choice
   - Source citations
   - One key finding
5. Include the actual numerical data for each angle

IMPORTANT:
- If searching widely, cite both document and external sources
- Highlight what the document reveals that might be surprising
- Make connections to broader trends if searching widely
- Include actual data points, not just descriptions

Return your analysis as structured text. JSON formatting is handled separately.
`;
```

### Mode 2b: Source (URL Analysis)

```javascript
export const SOURCE_PROMPT_URL = `
You are a data journalist AI. A journalist has provided a URL
to analyze for data and story angles.

URL: {url}
JOURNALIST'S REQUEST: {query}
SEARCH SCOPE: {scope} (values: "restrict-to-source" or "search-widely")

Your task:
1. Extract all relevant data from the URL
2. If scope is "search-widely", supplement with external sources
3. Identify 3 distinct story angles
4. For EACH angle, provide headline, summary, chart type, reasoning, sources, key finding
5. Include the actual numerical data for each angle

IMPORTANT:
- Prioritize data from the provided URL
- Cite sources clearly
- Ensure data accuracy

Return your analysis as structured text. JSON formatting is handled separately.
`;
```

### Mode 3: Paste (CSV/Data Analysis)

> **Note**: Paste mode sends CSV data directly to GPT-5 Nano. No Perplexity call.

```javascript
export const PASTE_PROMPT = `
You are a data journalist AI. A journalist has pasted CSV data
and wants to discover story angles.

CSV DATA:
{csvData}

OPTIONAL QUESTION: {query}

Your task:
1. Analyze the pasted data
2. Identify 3 distinct story angles (or answer the question if provided)
3. For EACH angle:
   - Compelling headline (max 70 characters)
   - Brief summary (1–2 sentences)
   - Best chart type(s)
   - Reasoning
   - One key finding (derived from the data)
4. Include the actual numerical data for each angle

IMPORTANT:
- Base insights on the PROVIDED data only (no external search)
- Avoid speculation
- Highlight what makes this data newsworthy
- Keep summaries simple and clear

Return your analysis as structured text. JSON formatting is handled separately.
`;
```

> **All modes**: The analysis text output from the prompts above is then passed to `STRUCTURING_PROMPT` (Step 2) via GPT-5 Nano with strict JSON schema enforcement. This guarantees valid, Chart.js-ready JSON regardless of which model produced the analysis.

---

## Design System & Styling

### Design Tokens (Matching ChartFlam)

> **Important**: These tokens are extracted directly from ChartFlam's `styles.css` to ensure visual consistency. Do not use Tailwind-style defaults.

**`lib/config/design.js`**:
```javascript
export const DESIGN_TOKENS = {
  // Colors — matched from ChartFlam styles.css :root
  colors: {
    primary: '#5422b0',                    // --color-icon-active-bg
    primaryLight: 'rgba(84, 34, 176, 0.1)',
    highlight: '#f0e6f7',                  // --color-highlight
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    bgLight: '#eeeeee',                    // --bg-light
    bgMedium: '#cccccc',                   // --bg-medium
    bgSurface: '#f8f8f8',                  // --bg-surface
    textDark: '#1f1f1f',                   // --text-dark / --text-primary
    textMedium: '#888888',                 // --text-medium
    textSecondary: '#777777',              // --text-secondary
    border: '#e0e0e0',                     // --color-border
    borderActive: '#999999',               // --color-border-active
    white: '#FFFFFF',
    black: '#000000'
  },

  // Chart color palette — matched from ChartFlam
  chartColors: [
    '#6A5ACD',  // --chart-color-1
    '#FFDAB9',  // --chart-color-2
    '#66C0B4',  // --chart-color-3
    '#E6E6FA',  // --chart-color-4
    '#DDA0DD',  // --chart-color-5
    '#ADD8E6',  // --chart-color-6
    '#FAEBD7',  // --chart-color-7
    '#C0C0C0'   // --chart-color-8
  ],
  
  // Typography — matched from ChartFlam
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    sizes: {
      xs: '0.75rem',     // --font-size-xs
      sm: '0.875rem',    // --font-size-sm
      base: '1rem',      // --font-size-base
      lg: '1.125rem',    // --font-size-lg
      larger: '1.25rem', // --font-size-larger
      xl: '1.5rem'       // --font-size-xl
    },
    weights: {
      regular: 400,      // --font-weight-regular
      medium: 500,       // --font-weight-medium
      semibold: 600,     // --font-weight-semibold
      bold: 700          // --font-weight-bold
    },
    lineHeights: {
      tight: 1.2,        // --line-height-tight
      normal: 1.5,       // --line-height-normal
      relaxed: 1.8       // --line-height-relaxed
    }
  },
  
  // Spacing — matched from ChartFlam (mobile-first compact)
  spacing: {
    xs: '0.375rem',      // --spacing-xs
    sm: '0.625rem',      // --spacing-sm
    md: '1rem',          // --spacing-md
    lg: '1.25rem',       // --spacing-lg
    xl: '1.75rem'        // --spacing-xl
  },
  
  // Breakpoints (mobile-first, 480px constraint)
  breakpoints: {
    mobile: '480px',
    tablet: '768px',
    desktop: '1024px'
  },
  
  // Border radius — matched from ChartFlam
  radius: {
    sm: '6px',           // --radius-sm
    md: '8px',           // --radius-md
    lg: '12px',          // --radius-lg
    xl: '16px',          // --radius-xl
    round: '50%'         // --radius-round
  },
  
  // Shadows — matched from ChartFlam
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',     // --shadow-sm
    md: '0 4px 6px rgba(0, 0, 0, 0.07)',     // --shadow-md
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)'     // --shadow-lg
  },
  
  // Z-index — matched from ChartFlam
  zIndex: {
    dropdown: 50,        // --z-dropdown
    header: 100,         // --z-header
    modalOverlay: 200,   // --z-modal-overlay
    modal: 210,          // --z-modal
    tooltip: 220         // --z-tooltip
  },

  // Transitions — matched from ChartFlam
  transitions: {
    fast: '200ms',       // --duration-fast
    normal: '300ms',     // --duration-normal
    slow: '500ms'        // --duration-slow
  }
};
```

### Global Styles (`app.css`)

> **Note**: CSS variables below are matched directly from ChartFlam's `styles.css`.

```css
/* CSS Custom Properties — matched from ChartFlam styles.css :root */
:root {
  /* Colors */
  --bg-light: #eeeeee;
  --bg-medium: #cccccc;
  --bg-surface: #f8f8f8;
  --text-dark: #1f1f1f;
  --text-medium: #888888;
  --text-primary: #1f1f1f;
  --text-secondary: #777777;
  --color-border: #e0e0e0;
  --color-border-active: #999999;
  --color-highlight: #f0e6f7;
  --color-primary: #5422b0;
  --color-primary-light: rgba(84, 34, 176, 0.1);
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --white: #FFFFFF;
  --black: #000000;

  /* Chart Color Palette — matched from ChartFlam */
  --chart-color-1: #6A5ACD;
  --chart-color-2: #FFDAB9;
  --chart-color-3: #66C0B4;
  --chart-color-4: #E6E6FA;
  --chart-color-5: #DDA0DD;
  --chart-color-6: #ADD8E6;
  --chart-color-7: #FAEBD7;
  --chart-color-8: #C0C0C0;

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-larger: 1.25rem;
  --font-size-xl: 1.5rem;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-xs: 0.375rem;
  --spacing-sm: 0.625rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.25rem;
  --spacing-xl: 1.75rem;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --duration-fast: 200ms;
  --duration-normal: 300ms;
}

/* Font Loading — Inter variable font (single file) */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-VariableFont_opsz,wght.ttf') format('truetype-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

/* Reset & Base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--text-dark);
  background-color: var(--white);
  line-height: 1.5;
}

/* Mobile-First: Max 480px */
@media (max-width: 480px) {
  body {
    padding: 0;
  }
  
  .container {
    padding: 1rem;
  }
}

/* Typography */
h1 {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

p {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

/* Interactive Elements */
button {
  font-family: inherit;
  font-size: inherit;
  border: none;
  border-radius: var(--radius-md);
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  min-height: 44px; /* Touch-friendly */
  min-width: 44px;
}

button.primary {
  background-color: var(--color-primary);
  color: var(--white);
  font-weight: var(--font-weight-medium);
}

button.primary:hover {
  background-color: #4319a0;
  box-shadow: var(--shadow-md);
}

button.secondary {
  background-color: var(--bg-surface);
  color: var(--text-dark);
  border: 1px solid var(--color-border);
}

button.secondary:hover {
  background-color: var(--bg-light);
}

input, textarea, select {
  font-family: inherit;
  font-size: inherit;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  min-height: 44px;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* Cards */
.card {
  background: var(--white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
}

/* Loading State */
.spinner {
  display: inline-block;
  width: 1.5rem;
  height: 1.5rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(1rem); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

.slide-up {
  animation: slideUp 0.3s ease-in-out;
}
```

### Component Styling Guidelines

1. **Touch-Friendly Targets**: All interactive elements ≥44×44px
2. **Color Consistency**: Use CSS custom properties; never hardcode colors
3. **Mobile-First**: Design for 480px first; expand for larger screens
4. **Accessibility**: High contrast ratios; clear focus states
5. **Animations**: Subtle transitions (0.2–0.3s); prefer `transform` and `opacity`

---

## Component Specifications

### Key Components (High-Level)

#### SearchTab.svelte
- Input: Question field + Audience text input (free-text; journalists serve too many niche audiences/locations for a dropdown)
- Button: "Search Data"
- Output: Routes to AngleCard display via shared state
- Mobile constraint: Full width, stacked layout

#### SourceTab.svelte
- Upload area: PDF/DOCX files (max 10MB)
- OR URL input field
- Preview section: Shows extracted text (editable)
- Optional: Scope toggle ("Restrict to source" / "Search widely")
- Optional: Question field (if user wants to ask something specific)
- Button: "Analyze"

#### PasteTab.svelte
- Textarea: Paste CSV data
- Preview: Shows parsed table
- Optional: Question field
- Button: "Analyze Data"

#### AngleCard.svelte
- **Collapsed state** (default): Headline text + chevron icon (accordion)
- **Expanded state**: Reveals:
  - Summary paragraph
  - `ChartTypeBar` — row of chart type icons (active/inactive based on `compatibleChartTypes`)
  - Inline `ChartDisplay` preview (~200px height, non-interactive)
  - Action buttons: [Sources] [Data] [Explain] — each opens a `BottomDrawer`
  - [Edit] button → opens `EditDrawer` (Coming Soon placeholder)
- Only one card expanded at a time (`uiState.expandedAngleId`)
- Design: Card with purple border when expanded; shadow on hover/active

#### ChartTypeBar.svelte
- Horizontal row of chart type SVG icons: pie, donut, line, bar, horizontal bar, stacked bar
- Each icon is active (clickable) or inactive (greyed out) based on `angle.compatibleChartTypes`
- Tapping an active icon re-renders the chart with the new type (no API call; data from cache)
- Currently selected type has underline/highlight indicator
- Pictogram icon is **not** in this row (separate CTA, see Pictogram strategy above)

#### BottomDrawer.svelte
- Reusable rising panel/modal component (used for Sources, Data, Explain)
- Rises from the bottom of the screen to fit content height; full-screen if content requires
- Header: Close [X] button + title ("Sources" / "Data" / "Explain")
- Footer: action icons for Copy, Share, Download
- Backdrop overlay dims the background
- Content is per-drawer:
  - **Sources**: Attribution links (clickable URLs) from `angle.sources`
  - **Data**: Raw data table rendered from `angle.data` (labels + datasets)
  - **Explain**: Multi-paragraph text from `angle.explain`

#### EditDrawer.svelte
- Full-page sliding drawer with chart customisation options
- **Status: Coming Soon** — displays placeholder message with icon
- Future: Will port ChartFlam's edit controls (colours, labels, legend, fonts, spacing, etc.)
- Opened via the [Edit] pencil button on each expanded AngleCard

#### PictogramPlaceholder.svelte
- "Create a pictogram" CTA button (outlined, purple border)
- Appears below an "or" divider in the Paste tab; available as a secondary action in other modes
- **Status: Coming Soon** — displays placeholder message when tapped
- Future: Will port ChartFlam's pictogram component (slider for highlighted icons out of 10)

#### ChartDisplay.svelte
- Chart.js integration (wrapped in `onMount` for SSR safety)
- Renders based on `angle.data` and current chart type from `angleChartTypes[angle.id]` (or `angle.suggestedChartType` as default)
- When rendered inside AngleCard: compact preview mode (~200px height)
- Mobile constraint: Responsive chart (matches 480px)

---

## API Endpoint Specifications

> **Note**: All server routes use SvelteKit `+server.js` files with `@sveltejs/adapter-cloudflare`. API keys are accessed via `platform.env` — no separate Cloudflare Worker needed. CORS is handled automatically since client and server share the same origin.

### POST /api/search
**Purpose**: Mode 1 (Search) — two-step pipeline  
**Input**:
```json
{
  "query": "Is it raining in Lagos more now than in the past",
  "audience": "Urban journalists in West Africa"
}
```
**Process**:
1. Server calls Perplexity Sonar API with `SEARCH_PROMPT` → receives prose + citations
2. Server calls OpenAI GPT-5 Nano with `STRUCTURING_PROMPT` + strict JSON schema → receives structured JSON
3. Server validates JSON with `validators.js` before returning to client

**Output**: Full API response (angles + nested data), streamed to client  
**Environment variables**: `PERPLEXITY_API_KEY`, `OPENAI_API_KEY` (via `platform.env`)

### POST /api/analyze
**Purpose**: Modes 2–3 (Source/Paste) — single-step pipeline (no Perplexity needed)  
**Input**:
```json
{
  "mode": "source|paste",
  "extractedText": "Raw CSV or document text (max ~8,000 tokens; truncated client-side)",
  "query": "Optional question",
  "scope": "restrict-to-source|search-widely",
  "sourceType": "pdf|url|csv"
}
```
**Process**:
1. If scope is "search-widely": calls Perplexity Sonar first, then GPT-5 Nano for structuring
2. If scope is "restrict-to-source": calls GPT-5 Nano directly with extracted text + appropriate prompt
3. Validates JSON before returning

**Output**: Full API response, streamed to client  
**Environment variables**: Same as above

### Validation (Client-Side Utility — NOT an API Route)
**Location**: `lib/utils/validators.js`  
**Purpose**: Validate structured JSON before rendering charts  
**Usage**: Called client-side after receiving API response; catches edge cases where JSON is valid but data is incomplete (e.g., empty datasets, mismatched label/data counts)  
**Function**: `validateAngleResponse(json)` → `{ valid: boolean, errors: [] }`

---

## Phased Implementation Plan

### Tier 0: Proof of Concept (Week 1, Mon–Fri)

**Goal**: Validate core UX and API efficiency. Search mode only. Step-by-step build.

**Build Order** (step-by-step, verify at each stage):

1. **Framework & project setup**
   - [ ] SvelteKit project init (Vite, `@sveltejs/adapter-cloudflare`)
   - [ ] Copy static assets: fonts, icons, logos from `info/` to `static/`
   - [ ] `manifest.json`, `app.html` with full meta tags (noindex/nofollow)
   - [ ] `.env.example` with `PERPLEXITY_API_KEY` and `OPENAI_API_KEY` placeholders
   - [ ] GitHub initial commit

2. **Design foundation**
   - [ ] `app.css` with CSS custom properties (matched from ChartFlam)
   - [ ] `lib/config/design.js` — design tokens
   - [ ] `lib/config/constants.js` — limits, magic numbers
   - [ ] `+layout.svelte` — header (logo, hamburger menu, bookmark), global layout
   - [ ] Verify: app loads, fonts render, layout matches mockups

3. **State & tab structure**
   - [ ] Svelte stores (`aiState.js`, `uiState.js`)
   - [ ] `+page.svelte` — tab selector (Search / Source / Paste)
   - [ ] Tab switching works; Source/Paste show "Coming Soon" placeholders
   - [ ] Verify: tabs switch, state updates correctly

4. **Search input**
   - [ ] `SearchTab.svelte` — audience + question inputs + chart type selector (Any/Bar/Line/Picto) + "Chart it" button
   - [ ] "Data explorer" accordion container (collapsible, matches mockup)
   - [ ] Verify: inputs capture values, button triggers action

5. **API pipeline**
   - [ ] `routes/api/search/+server.js` — two-step pipeline (Perplexity → GPT-5 Nano)
   - [ ] `lib/utils/prompts.js` — SEARCH_PROMPT + STRUCTURING_PROMPT
   - [ ] `lib/utils/json-repair.js` — strip fences, fix commas, auto-retry
   - [ ] `lib/utils/validators.js` — validate angle response structure
   - [ ] Streaming response to client
   - [ ] Verify: API returns 3 valid angle objects with data

6. **Results display**
   - [ ] `AngleCard.svelte` — accordion cards (collapsed: headline; expanded: summary + chart + actions)
   - [ ] `ChartTypeBar.svelte` — icon row with active/inactive states
   - [ ] `ChartDisplay.svelte` — Chart.js render (onMount guard for SSR)
   - [ ] Chart type switching (re-render from cache, no API call)
   - [ ] Verify: expand card → chart renders; switch chart type → re-renders

7. **Bottom drawers & polish**
   - [ ] `BottomDrawer.svelte` — reusable rising modal (Sources, Data, Explain)
   - [ ] `EditDrawer.svelte` — Coming Soon placeholder
   - [ ] `PictogramPlaceholder.svelte` — Coming Soon CTA
   - [ ] Error handling + loading states + rate-limit UI feedback
   - [ ] Verify: drawers open/close; error states display correctly

**Out of Scope**:
- [ ] PDF/URL upload (Tier 1)
- [ ] CSV paste (Tier 1)
- [ ] OCR / image scan (Tier 2)
- [ ] "What If?" button (Tier 2)
- [ ] Export PNG/JSON/CSV (Tier 2)
- [ ] Edit drawer functionality (Tier 2+)
- [ ] Pictogram component wiring (Tier 2+)

**Testing Checklist**:
- [ ] Desktop (Chrome, Safari on macOS): End-to-end flow
- [ ] Mobile (iOS Safari, Android Chrome): Touch interactions, accordion expand/collapse
- [ ] Ask one question; verify 3 angle accordion cards returned
- [ ] Expand one angle; verify inline chart renders instantly (no 2nd API call)
- [ ] Switch chart type via icon row; verify chart re-renders
- [ ] Open Sources/Data/Explain drawers; verify content displays
- [ ] Verify API latency and cost (~$0.007 per request; two-step pipeline)
- [ ] Check error handling (network failure, malformed response)

**Deliverable**: Working Tier 0 at `chartflamai.pages.dev`

---

### Tier 1: Full Extraction Support (Weeks 2–3, Mon–Fri)

**Goal**: Add Source and Paste modes. Validate multi-mode architecture.

**In Scope**:
- [ ] SourceTab component
  - [ ] PDF upload + PDF.js extraction
  - [ ] Smart text truncation (max ~8,000 tokens): extract full text, prioritize tables → headings + first paragraphs → body text; note truncation in prompt
  - [ ] URL input (pass to Perplexity for extraction)
  - [ ] SourcePreview component (show extracted text, allow editing before AI analysis)
  - [ ] Optional: DOCX support via docx library
  - [ ] File size validation (max 10MB)
- [ ] PasteTab component
  - [ ] CSV textarea input
  - [ ] PapaParse integration
  - [ ] Table preview
- [ ] Updated system prompts (SOURCE_PROMPT_DOCUMENT, SOURCE_PROMPT_URL, PASTE_PROMPT)
- [ ] Source toggle ("Restrict to document" / "Search widely")
- [ ] Scope parameter handling in API calls
- [ ] Enhanced error messages for extraction failures

**Out of Scope**:
- [ ] OCR (Tier 2)
- [ ] Google Sheets integration (defer)

**Testing Checklist**:
- [ ] PDF upload: Extract table; verify preview shows correct data
- [ ] PDF + question: AI returns 3 angles specific to the document
- [ ] URL input: Verify Perplexity fetches and analyzes correctly
- [ ] Restricted scope: Verify AI doesn't search beyond provided source
- [ ] CSV paste: Parse multi-series data; verify suggestions
- [ ] Error cases: Oversized file, corrupted PDF, empty CSV, invalid URL
- [ ] Mobile: Tap to upload on iOS; drag-and-drop on desktop (if supported)

**Deliverable**: ChartFlamAI with three modes live at `chartflamai.pages.dev`; ready for user testing

---

### Tier 2: Polish & Enhancement (Weeks 4–5, Mon–Fri)

**Goal**: Add UX refinements, export options, and optional advanced features.

**In Scope**:
- [ ] Chart export:
  - [ ] Download PNG (using Canvas API or html2canvas)
  - [ ] Export JSON (chart data + metadata)
  - [ ] Export CSV (raw data)
  - [ ] Copy to clipboard
- [ ] "What If?" button (re-prompt AI with same data, different angles)
- [ ] Mobile camera scan (Tesseract.js or Claude vision API for OCR)
  - [ ] Placeholder in SourceTab
- [ ] Loading states (skeleton screens, progress indicators)
- [ ] Animations (fade-in for results, slide-up for chart)
- [ ] Analytics (optional: track which modes users prefer, chart types selected)
- [ ] Help/tutorial modal (1–2 screens explaining each tab)
- [ ] Deep-link support (for future ChartFlam integration)
  - [ ] `/import?data={json}` endpoint

**Out of Scope**:
- [ ] Full ChartFlam integration (defer to post-launch decision)
- [ ] User accounts / chart history (future feature)

**Testing Checklist**:
- [ ] Download PNG: Verify image renders correctly; check file size
- [ ] Export JSON: Verify structure matches ChartFlam expectations
- [ ] "What If?": Re-prompt with same data; verify new angles differ from originals
- [ ] Mobile camera: Test OCR accuracy on clear table photos
- [ ] Animations: Verify smooth transitions; no jank on mobile
- [ ] Deep-link: Pass JSON via URL; verify import endpoint accepts data
- [ ] Help modal: Usability test with non-technical user

**Deliverable**: ChartFlamAI feature-complete; ready for public launch

---

### Tier 3: Post-Launch Iteration (Post-Week 5)

**Goal**: Monitor usage, refine based on feedback, decide on ChartFlam integration.

**Potential Enhancements** (based on user feedback):
- [ ] Voice input (Web Speech API)
- [ ] Google Sheets integration
- [ ] Undo/redo
- [ ] Save drafts (localStorage)
- [ ] Share charts (generate shareable link)
- [ ] Refine prompts based on user feedback
- [ ] A/B test different angle formats

---

## Key Testing Milestones

| Milestone | Tier | Condition | Action |
|-----------|------|-----------|--------|
| **Go/No-Go: Tier 0** | 0 | API works; 3 angles returned; chart renders; <5s latency | Proceed to Tier 1 OR iterate |
| **Soft Launch** | 1 | 3 modes working; no critical bugs; <10 user feedback items | Proceed to Tier 2 OR gather feedback |
| **Public Launch** | 2 | Feature-complete; mobile tested; error handling solid | Announce; monitor analytics |

---

## Integration with ChartFlam (Deferred)

**Status**: Not committed. Will decide post-launch.

**Possible approaches** (to be decided):

1. **Standalone**: ChartFlamAI and ChartFlam remain separate apps
2. **Deep-Link Bridge**: ChartFlamAI exports JSON; ChartFlam adds import endpoint
3. **Component Integration**: ChartFlamAI renders embedded in ChartFlam's new interface (future)
4. **Domain Redirect**: Point `chartflam.flamtools.com` to ChartFlamAI; ChartFlam editor as secondary feature

**Decision point**: After Tier 2 completion and 2–4 weeks of user feedback.

---

## Mobile UX Specifications

### Constraint: 480px Max Width

```css
/* Mobile-first breakpoint */
@media (max-width: 480px) {
  /* All components stack vertically */
  .container { max-width: 100%; padding: 1rem; }
  .tab-content { width: 100%; }
  .angle-cards { display: flex; flex-direction: column; gap: 1rem; }
}
```

### Touch Interactions

1. **Buttons**: Minimum 44×44px; 8px padding around text
2. **Input fields**: Minimum 44px height; large font (≥16px) to prevent zoom
3. **Card swipe**: Swipe left/right to navigate between angles (optional; touch-friendly alternative to click)
4. **Haptic feedback**: Subtle vibration on selection (if browser supports)

### Responsive Chart

- Chart container: 100% width on mobile, max 600px on desktop
- Chart height: Adaptive (4:3 or 16:9 aspect ratio)
- Legend: Below chart on mobile; right side on desktop

---

## PWA & Deployment Configuration

### Manifest (manifest.json)

```json
{
  "name": "ChartFlamAI",
  "short_name": "ChartFlamAI",
  "description": "AI-powered data discovery and chart generation for journalists",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#5422b0",
  "icons": [
    {
      "src": "/logos/logo-chartflam-ai-touch.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/logos/logo-chartflam-ai-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/logos/logo-chartflam-ai-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": ["productivity", "news"]
}
```

### Meta Tags (app.html)

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#5422b0" />
<meta name="description" content="AI-powered data discovery and chart generation for journalists" />

<!-- Open Graph -->
<meta property="og:title" content="ChartFlamAI" />
<meta property="og:description" content="Discover stories in data. Create charts in seconds." />
<meta property="og:image" content="https://chartflamai.pages.dev/logos/logo-chartflam-ai-og.png" />
<meta property="og:type" content="website" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="ChartFlamAI" />
<meta name="twitter:description" content="AI-powered data discovery for journalists" />
<meta name="twitter:image" content="https://chartflamai.pages.dev/logos/logo-chartflam-ai-og.png" />

<!-- Robots: strict noindex/nofollow during development -->
<meta name="robots" content="noindex, nofollow" />

<!-- PWA -->
<link rel="manifest" href="/manifest.json" />
<link rel="icon" href="/logos/logo-chartflam-ai-favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/logos/logo-chartflam-ai-favicon.ico" sizes="32x32" />
<link rel="apple-touch-icon" href="/logos/logo-chartflam-ai-touch.png" />
```

### Cloudflare Pages Deployment

> **Architecture**: SvelteKit with `@sveltejs/adapter-cloudflare`. Server routes (`+server.js` files) automatically become Cloudflare Functions. No separate Worker or `wrangler.toml` needed.

1. Connect GitHub repo to Cloudflare Pages
2. Build command: `npm run build`
3. Build output directory: `.svelte-kit/cloudflare`
4. Environment variables (set in Cloudflare Pages dashboard):
   - `PERPLEXITY_API_KEY` — Perplexity Sonar API key
   - `OPENAI_API_KEY` — OpenAI API key (for GPT-5 Nano structuring)
   - `ENVIRONMENT` — `dev` | `production`
5. Access keys in server routes via `platform.env`:
   ```javascript
   // In +server.js
   export async function POST({ request, platform }) {
     const perplexityKey = platform.env.PERPLEXITY_API_KEY;
     const openaiKey = platform.env.OPENAI_API_KEY;
     // ... make API calls
   }
   ```

**Server routes handle**:
- API key protection (keys stored in Cloudflare environment, never exposed to client)
- Rate-limiting (max 20 requests/hour per IP; return `429` status with clear UI message)
- Request validation
- Streaming responses to client
- Error logging

---

## Key Decisions & Constraints

| Decision | Status | Rationale |
|----------|--------|-----------|
| **SvelteKit for new app** | ✅ Approved | Better for reactive, multi-step workflows than vanilla JS |
| **Cloudflare Pages (`chartflamai.pages.dev`)** | ✅ Approved | Immediate deployment; migrate to `chartflamai.flamtools.com` post-validation |
| **Two-step LLM pipeline** | ✅ Approved | Perplexity Sonar for search; GPT-5 Nano for strict JSON structuring; ~$0.007/request |
| **SvelteKit server routes (not separate Worker)** | ✅ Approved | `adapter-cloudflare` handles server routes natively; simpler architecture |
| **No Tailwind** | ✅ Approved | CSS custom properties matched from ChartFlam; no additional tooling |
| **Three tabs (Search/Source/Paste)** | ✅ Approved | Clear UX; unified backend flow |
| **Accordion angle cards** | ✅ Approved | Cards expand inline (not full-screen select); chart preview + type switching inside card |
| **Chart type icon row per angle** | ✅ Approved | Active/inactive icons based on `compatibleChartTypes`; re-render from cache, no API call |
| **BottomDrawer modals** | ✅ Approved | Reusable rising panel for Sources, Data, Explain; same style, rises to fit content |
| **EditDrawer (Coming Soon)** | ✅ Approved | Full-page edit drawer placeholder; future port of ChartFlam edit controls |
| **Pictograms outside AI pipeline** | ✅ Approved | Manual editorial choice only; "Create a pictogram" CTA as Coming Soon placeholder |
| **Audience as free-text input** | ✅ Approved | Too many niche audiences/locations for dropdown; text input is more flexible |
| **Streaming responses** | ✅ Approved | Show angle cards progressively; better UX than blank 3–5s loading screen |
| **ChartFlam integration deferred** | ✅ Approved | Validate product first; decide post-launch |
| **Mobile-first, 480px max** | ✅ Approved | Match ChartFlam's mobile focus |
| **Svelte stores for state** | ✅ Approved | Clean, reactive state management; `activeTab` as single source of truth for mode |
| **Strict noindex/nofollow** | ✅ Approved | No crawling during development/testing phase |
| **Step-by-step build** | ✅ Approved | Build one page/feature at a time; verify before proceeding |

---

## Success Criteria

### Tier 0 (Proof of Concept)
- ✅ Two-step pipeline (Perplexity → GPT-5 Nano) returns 3 angles + pre-formatted data
- ✅ Chart renders instantly on angle selection (data cached from initial response)
- ✅ Combined API latency <5 seconds (streaming starts sooner)
- ✅ JSON repair + retry handles malformed LLM responses gracefully
- ✅ Error handling doesn't crash the app
- ✅ Mobile interactions work smoothly

### Tier 1 (MVP)
- ✅ All three input modes functional
- ✅ Source preview allows user correction before AI analysis
- ✅ Scope toggle (restrict/search) works as intended
- ✅ <3 critical bugs reported in first week of testing
- ✅ No single mode dominates (balanced usage across Search/Source/Paste)

### Tier 2 (Polish)
- ✅ Download PNG/JSON/CSV without errors
- ✅ "What If?" button generates meaningfully different angles
- ✅ Mobile camera scan OCR accuracy >75% on standard table photos
- ✅ <1 second delay from angle selection to chart render
- ✅ Ready for public launch

---

## Questions & Decisions (Resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | **Domain** | Deploy to Cloudflare Pages → `chartflamai.pages.dev`. Later point `chartflamai.flamtools.com` after validation. |
| 2 | **API Keys** | ✅ Ready. Perplexity + OpenAI keys available. Will populate `.env` after framework setup. |
| 3 | **Visuals** | ✅ Ready. Mockups in `info/mockups/`, icons in `info/icons/`, logos in `info/logos/`, Inter font in `info/fonts/`. Build one page at a time to agree look & function. |
| 4 | **Analytics** | Post-launch. Not in Tier 0–2 scope. |
| 5 | **Feedback Loop** | From journalists during training sessions. No in-app analytics or surveys initially. |

---

## LLM Response Reliability Strategy

Since LLM outputs can be malformed even with strict JSON mode, implement a three-layer defense:

### Layer 1: JSON Repair (`lib/utils/json-repair.js`)
Before parsing, attempt automatic fixes:
- Strip markdown code fences (`` ```json ... ``` ``)
- Remove trailing commas before `}` or `]`
- Fix unescaped newlines in strings
- Trim leading/trailing whitespace

### Layer 2: Auto-Retry
If JSON parsing fails after repair:
1. Retry **once** with a stricter prompt appending: `"IMPORTANT: Return ONLY valid JSON. No markdown, no explanation."`
2. If retry also fails, proceed to Layer 3

### Layer 3: Graceful Degradation
- If 2 of 3 angles parsed successfully, show those 2 with a note: "One angle couldn't be loaded"
- If all 3 fail, show a clear error with "Try again" button
- Never show a blank screen or crash

---

## Streaming Response Specification

### Why Streaming?
A 3–5 second blank loading screen is poor UX for journalists. Streaming shows progress immediately.

### Implementation
SvelteKit server routes support streaming via the `ReadableStream` API:

```javascript
// In +server.js
export async function POST({ request, platform }) {
  const stream = new ReadableStream({
    async start(controller) {
      // Step 1: Call Perplexity (await full response)
      const searchResult = await callPerplexity(query, platform.env.PERPLEXITY_API_KEY);
      
      // Send a progress event
      controller.enqueue(encode({ type: 'progress', message: 'Analyzing data...' }));
      
      // Step 2: Call GPT-5 Nano for structuring
      const structured = await callOpenAI(searchResult, platform.env.OPENAI_API_KEY);
      
      // Send final result
      controller.enqueue(encode({ type: 'result', data: structured }));
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

### Client-Side UX
- **Immediate**: Show skeleton cards on submit
- **~1–2s**: Replace skeleton with "Searching the web..." progress message
- **~3–5s**: Fade in angle cards as structured data arrives
- **Instant**: Chart renders on angle selection (data already cached)

---

## Dev Advisory: Chart.js & SvelteKit SSR

### The Problem
Chart.js requires an HTML `<canvas>` element, which only exists in the browser. SvelteKit pre-renders pages on the server (SSR), where there is no `<canvas>` or `document`. If `ChartDisplay.svelte` tries to initialize Chart.js during SSR, it will crash.

### The Fix
Wrap Chart.js initialization in Svelte's `onMount()` lifecycle hook and use the `browser` check:

```svelte
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let canvas;
  let chart;
  
  onMount(() => {
    import('chart.js/auto').then(({ default: Chart }) => {
      chart = new Chart(canvas, {
        type: selectedChartType,
        data: selectedAngle.data,
        options: { responsive: true, maintainAspectRatio: false }
      });
    });
    
    return () => { if (chart) chart.destroy(); };
  });
</script>

{#if browser}
  <canvas bind:this={canvas}></canvas>
{/if}
```

This pattern ensures Chart.js only loads and runs in the browser. The dynamic `import()` also keeps the Chart.js bundle out of the server build.

---

## Text Extraction & Truncation Strategy (Source Mode)

### Problem
A 50-page PDF can produce 100K+ tokens of text. Sending this directly to the LLM is expensive and slow.

### Strategy: Smart Truncation (max ~8,000 tokens)
1. **Extract full text** via PDF.js (preserving structure)
2. **Prioritize content** in this order:
   - Tables and structured data (highest priority)
   - Headings + first paragraph after each heading
   - Bullet/numbered lists
   - Remaining body text (lowest priority)
3. **Truncate** to ~8,000 tokens (~24,000 characters)
4. **Append note** to prompt: `"[Document truncated. Original: {totalPages} pages. Showing prioritized content.]"`

### Why Not Tables Only?
- A table showing "GDP by region" is meaningless without context explaining methodology or time period
- Data can appear in bullet lists, inline statistics ("grew 47% year-over-year"), or narrative paragraphs
- Headings provide essential framing for understanding what the data represents

### Implementation
`lib/utils/extractors.js` should export a `truncateForLLM(fullText, maxTokens)` function that handles the prioritization logic.

---

## Appendix: Quick Reference

### File Locations (By Role)

**Lead Coder**:
- `routes/+page.svelte` — Main layout & tab routing
- `routes/api/` — Backend endpoints
- `lib/stores/` — State management
- `lib/utils/prompts.js` — System prompts (tweak as needed)
- `svelte.config.js`, `vite.config.js` — Build config

**UI Expert**:
- `lib/components/` — All UI components
- `app.css` — Global styles & design tokens
- `static/` — Icons, fonts, manifest
- `lib/config/design.js` — Design token definitions

**Both**:
- `lib/utils/validators.js` — Data validation (shared)
- `lib/utils/extractors.js` — CSV/PDF parsing (shared)

### Commands (Expected)

```bash
npm install
npm run dev          # Local dev
npm run build        # SvelteKit build
npm run preview      # Preview production build
npm run deploy       # Deploy to Cloudflare Pages (if configured)
```

---

**Document Status**: ✅ Ready for Development (v1.1)  
**Last Updated**: March 30, 2026  
**Revision Notes (v1.1)**: Deployment target set (Cloudflare Pages → `chartflamai.pages.dev`). Accordion angle cards with inline chart preview. Chart type icon row with active/inactive states based on `compatibleChartTypes`. BottomDrawer modals for Sources/Data/Explain. EditDrawer (Coming Soon placeholder). Pictogram strategy: manual only, outside AI pipeline. Static asset filenames corrected to match actual files. Step-by-step build order for Tier 0. `suggestedChartType` + `compatibleChartTypes` in API schema. `explain` field added to angle response. OG/meta updated to `chartflamai.pages.dev`. Questions resolved.  
**Next Review**: Post-Tier 0 Step 1 (framework setup)

