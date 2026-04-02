# ChartFlam: AI Agent Guide

**Project**: ChartFlam — AI-Powered Data Discovery & Chart Generation  
**Status**: Active & Deployed  
**Deployment**: Cloudflare Pages → `chartflam.flamtools.com`  
**Repository**: GitHub — `masondan/chartflamai`

---

## Quick Overview

ChartFlam enables journalists to discover and visualize data through three workflows:
- **Search**: AI finds data and suggests story angles
- **Source**: Upload PDFs/URLs for data mining
- **Classic**: Paste CSV data and explore angles

All workflows return **3 angle cards** (headlines + charts), no raw data shown to users.

### Supported Chart Types
| Type | Chart.js Type | AI-Suggested | Notes |
|------|--------------|-------------|-------|
| Pie | `pie` | ✅ | Single-series categorical |
| Donut | `doughnut` | ✅ | Pie with centre cutout |
| Line | `line` | ✅ | Time-series, trends |
| Bar (vertical) | `bar` | ✅ | Categorical comparison |
| Horizontal Bar | `bar` (indexAxis: 'y') | ✅ | Long labels |
| Stacked Bar | `bar` (stacked: true) | ✅ | Part-to-whole |
| Pictogram | Custom component | Manual only | Separate from AI pipeline |

---

## Architecture

### Core Stack
| Layer | Technology |
|-------|-----------|
| **Framework** | SvelteKit + `@sveltejs/adapter-cloudflare` |
| **State** | Svelte stores (writable) |
| **Charts** | Chart.js 4.4.0 |
| **Data Input** | PDF.js, PapaParse |
| **LLM Search** | Perplexity Sonar API |
| **LLM Structuring** | OpenAI GPT-4o Mini |
| **Deployment** | Cloudflare Pages (SvelteKit adapter) |
| **Typography** | Inter (variable font, local) |
| **Icons** | SVG (static/icons/) |

### Two-Step LLM Pipeline
1. **Perplexity Sonar**: Web search + text extraction (Search & Source modes only)
2. **GPT-4o Mini**: Strict JSON schema structuring → Chart.js data

Cost: ~$0.007/request (combined)

---

## Directory Structure

```
src/
├── routes/
│   ├── +layout.svelte          # Root layout with header (flam-nav component)
│   ├── +page.svelte            # Tab selection (Search | Source | Classic)
│   └── api/
│       ├── search/+server.js   # POST: Search mode (Perplexity → GPT structuring)
│       ├── analyze/+server.js  # POST: Source/Classic modes (GPT only)
│       └── [other API routes]
├── lib/
│   ├── components/
│   │   ├── SearchTab.svelte    # Search mode UI
│   │   ├── SourceTab.svelte    # Source mode UI (PDF/URL upload)
│   │   ├── ClassicTab.svelte   # Classic mode (CSV input, chart starters, reset)
│   │   ├── AngleCard.svelte    # Story accordion (headline → expand → chart)
│   │   ├── ChartDisplay.svelte # Chart.js renderer
│   │   ├── ChartTypeBar.svelte # Chart type selector (pie/bar/line icons)
│   │   ├── ChartEditor.svelte  # Full-page editor (customization)
│   │   ├── PictogramEditor.svelte # Full-page pictogram builder
│   │   ├── BottomDrawer.svelte # Reusable modal drawer
│   │   ├── ArchivedStoryCard.svelte # Story card from archive
│   │   └── [other components]
│   ├── stores/
│   │   ├── aiState.svelte      # Workflow state (search query, results, errors)
│   │   ├── uiState.svelte      # UI state (active tab, loading, drawer open)
│   │   └── chartArchive.svelte # Persisted stories (localStorage)
│   ├── utils/
│   │   ├── prompts.ts          # LLM system prompts
│   │   ├── extractors.ts       # PDF/URL/CSV parsing
│   │   ├── formatters.ts       # Response → Chart.js format
│   │   └── validators.ts       # JSON schema validation
│   ├── config/
│   │   ├── design.ts           # Design tokens (colors, spacing, etc.)
│   │   └── constants.ts        # Magic numbers, limits
│   └── data/
│       └── pictogram-icons.ts  # 118 SVG icons (12 categories)
├── app.css                      # Global styles (CSS custom properties)
└── app.html                     # Root template + flam-nav.js loader
static/
├── fonts/
│   ├── Inter-VariableFont_opsz,wght.ttf
│   └── saira.ttf               # Flam navigation menu font
├── icons/
│   ├── icon-pie-chart.svg
│   ├── icon-vertical-bars.svg
│   ├── icon-line-chart.svg
│   ├── icon-reset.svg          # Chart reset button
│   └── [other icons]
├── logos/
│   ├── logo-chartflam-logotype.png  # Header logo
│   └── [other logos]
├── flam-nav.js                 # Shared hamburger menu (web component)
└── manifest.json               # PWA manifest
```

---

## State Management

### `aiState.svelte`
```typescript
{
  step: 'input' | 'loading' | 'results' | 'error',
  
  // User inputs (Search mode)
  audience: string,
  query: string,
  
  // Source mode
  sourceType: 'pdf' | 'url',
  sourceFile: File | null,
  sourceUrl: string,
  extractedText: string,
  
  // Results
  apiResponse: { angles: Angle[] } | null,
  
  // Per-angle chart type overrides
  angleChartTypes: { [angleId: string]: ChartType },
  
  // Error tracking
  error: { message: string; retryable: boolean } | null,
}
```

### `uiState.svelte`
```typescript
{
  activeTab: 'search' | 'source' | 'classic',
  isLoading: boolean,
  expandedAngleId: string | null,  // Which angle card is expanded
  activeDrawer: 'sources' | 'data' | 'explain' | null,
}
```

### `chartArchive.svelte`
Persisted to `localStorage` under `chartflam-archive-stories`:
- Stores archived stories with 30-day expiry
- Max 10 stories
- Used by SavedChartsDrawer and ArchivedStoryCard

---

## API Routes

### POST `/api/search`
**Input**: `{ query, audience, chartTypeHint }`  
**Output**: Server-Sent Events (SSE) stream with progress & results  
**Flow**:
1. Perplexity Sonar: Search web → return text + citations
2. GPT-4o Mini: Structure text → strict JSON

### POST `/api/analyze`
**Input**: `{ extractedText, query, mode }`  
**Output**: SSE stream with JSON results  
**Flow**: Skip Perplexity, go straight to GPT structuring (Source/Classic modes)

---

## Design System

### Colors (CSS Custom Properties)
```css
--color-primary: #5422b0;          /* Purple */
--color-highlight: #f0e6f7;        /* Light purple */
--color-border: #e0e0e0;
--text-dark: #1f1f1f;
--text-secondary: #777777;
--color-error: #ef4444;
```

### Typography
- **Font**: Inter (variable) + Saira (navigation menu)
- **Sizes**: xs (0.75rem) → xl (1.5rem)
- **Weights**: 400, 500, 600, 700

### Spacing
```
xs: 0.375rem  |  sm: 0.625rem  |  md: 1rem  |  lg: 1.25rem  |  xl: 1.75rem
```

### Border Radius
```
sm: 6px  |  md: 8px  |  lg: 12px  |  xl: 16px  |  round: 50%
```

---

## Key Patterns

### Reactive State
All state uses Svelte's `$state()` rune (Svelte 5). Direct mutations update UI:
```svelte
<script>
  let query = $state('');
  query = 'new value'; // UI updates automatically
</script>
```

### SSE Streaming (API Responses)
API routes return `ReadableStream` for real-time progress updates:
```javascript
// Client
const res = await fetch('/api/search', { method: 'POST', body: JSON.stringify(...) });
const reader = res.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Parse SSE events from value
}
```

### Chart Type Compatibility
Each angle includes `compatibleChartTypes[]`. UI shows only valid chart icons.

### Drawer Routing
`DrawerManager.svelte` centralizes drawer state. Open with:
```svelte
uiState.openDrawer('sources', angleId);
uiState.openDrawer('data', angleId);
uiState.openDrawer('explain', angleId);
```

### Story Persistence
Archive stories to `chartArchive` store (syncs to localStorage):
```javascript
chartArchive.addStories([...]);
chartArchive.removeStories([id1, id2]);
chartArchive.clearExpired(); // Auto-run on load
```

---

## Common Tasks

### Add a New Chart Type
1. Add icon to `static/icons/icon-{name}.svg`
2. Add entry to `lib/config/design.ts` (`DESIGN_TOKENS.chartTypes`)
3. Update `ChartTypeBar.svelte` (if needed)
4. Update LLM prompt in `lib/utils/prompts.ts`
5. Update `ChartDisplay.svelte` Chart.js options

### Modify LLM Prompt
- **Search**: Edit `SEARCH_PROMPT` in `lib/utils/prompts.ts`
- **Source (PDF)**: Edit `SOURCE_PROMPT_PDF`
- **Source (URL)**: Edit `SOURCE_PROMPT_URL`
- **Classic (CSV)**: Edit `PASTE_PROMPT`
- **Structuring**: Edit `STRUCTURING_PROMPT` (applies to all modes)

### Add an API Endpoint
1. Create `src/routes/api/{name}/+server.js`
2. Export `POST` (or `GET`, etc.)
3. Access env vars via `platform.env` (Cloudflare):
   ```javascript
   export async function POST({ request, platform }) {
     const apiKey = platform.env.OPENAI_API_KEY;
   }
   ```

### Debug API Issues
- Check `.env` for `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`
- Use `console.log()` in `+server.js` (logs appear in Cloudflare Workers dashboard)
- Errors are sent back as `{ error: "message" }` in JSON

---

## Deployment

### Environment Variables (Cloudflare Pages)
Required in `.env`:
```
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
```

### Build & Deploy
```bash
npm run build
# SvelteKit adapter-cloudflare automatically converts server routes to Cloudflare Functions
npx wrangler pages deploy ./build
```

### Monitoring
- Logs: Cloudflare Pages dashboard → Functions logs
- Analytics: Cloudflare Pages dashboard
- Error tracking: Check API responses (SSE stream errors)

---

## Navigation

**Hamburger Menu** (`<flam-nav current="chartflam"></flam-nav>`):
- Shared web component across all Flam apps
- Links to: PromptFlam, PicFlam, AudioFlam, ChartFlam, MapFlam, StoryFlam, FlamIt
- Saira font for consistency across all apps

---

## Useful Files for Agents

| File | Purpose |
|------|---------|
| `src/lib/utils/prompts.ts` | All LLM system prompts |
| `src/lib/config/design.ts` | Design tokens & chart config |
| `src/lib/stores/aiState.svelte` | Workflow state schema |
| `static/flam-nav.js` | Navigation menu (do not edit locally—sync from PicFlam) |
| `.env` | API keys (required for local dev) |
| `svelte.config.js` | Build config (SvelteKit + Cloudflare adapter) |

---

## Conventions

- **Components**: PascalCase, one file per component
- **Stores**: camelCase, `.svelte` extension (Svelte 5 reactive)
- **Routes**: `+page.svelte`, `+layout.svelte`, `+server.js`
- **Utilities**: camelCase, plain `.ts` files
- **Icons**: `icon-{name}.svg` in `static/icons/`
- **CSS**: Global variables defined in `:root` of `app.css`; component-scoped styles in `<style>` blocks

---

## Quick Debugging Checklist

- [ ] API key in `.env`? → Check `.env` file
- [ ] Chart data malformed? → Validate JSON in `utils/validators.ts`
- [ ] State not updating? → Use `$state()` rune, not writable stores
- [ ] Drawer not opening? → Check `DrawerManager.svelte` is mounted
- [ ] Chart type missing? → Add to `DESIGN_TOKENS.chartTypes` and icon
- [ ] SSE not streaming? → Check API route returns `ReadableStream`

---

Last Updated: April 2, 2026  
Maintained by: Lead Development Team
