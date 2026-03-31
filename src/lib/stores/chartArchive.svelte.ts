import { browser } from '$app/environment';

const STORAGE_KEY = 'chartflamai-archive';
const MAX_CHARTS = 10;
const EXPIRY_DAYS = 30;

export type EditorType = 'chart' | 'waffle' | 'pictogram';

export interface ArchivedChart {
  id: string;
  editorType: EditorType;
  thumbnail: string; // base64 data URL
  config: Record<string, any>;
  createdAt: number;
  lastAccessedAt: number;
}

function generateId(): string {
  return `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createChartArchive() {
  let charts = $state<ArchivedChart[]>([]);

  function loadFromStorage() {
    if (!browser) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ArchivedChart[] = JSON.parse(raw);
        // Purge expired entries (>30 days inactive)
        const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        charts = parsed.filter(c => c.lastAccessedAt > cutoff);
        if (charts.length !== parsed.length) {
          persist();
        }
      }
    } catch {
      charts = [];
    }
  }

  function persist() {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
    } catch {
      // localStorage full — evict oldest and retry
      if (charts.length > 1) {
        charts = charts.slice(1);
        persist();
      }
    }
  }

  function save(editorType: EditorType, config: Record<string, any>, thumbnail: string, existingId?: string): string {
    const now = Date.now();

    if (existingId) {
      const idx = charts.findIndex(c => c.id === existingId);
      if (idx !== -1) {
        charts[idx] = { ...charts[idx], config, thumbnail, lastAccessedAt: now };
        charts = [...charts];
        persist();
        return existingId;
      }
    }

    // New chart — evict oldest if at capacity
    if (charts.length >= MAX_CHARTS) {
      const sorted = [...charts].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      const toRemove = sorted[0];
      charts = charts.filter(c => c.id !== toRemove.id);
    }

    const id = generateId();
    charts = [...charts, { id, editorType, config, thumbnail, createdAt: now, lastAccessedAt: now }];
    persist();
    return id;
  }

  function remove(ids: string[]) {
    charts = charts.filter(c => !ids.includes(c.id));
    persist();
  }

  function duplicate(id: string): string | null {
    const source = charts.find(c => c.id === id);
    if (!source) return null;
    return save(source.editorType, { ...source.config }, source.thumbnail);
  }

  function touch(id: string) {
    const chart = charts.find(c => c.id === id);
    if (chart) {
      chart.lastAccessedAt = Date.now();
      charts = [...charts];
      persist();
    }
  }

  function getById(id: string): ArchivedChart | undefined {
    return charts.find(c => c.id === id);
  }

  // Load on creation
  loadFromStorage();

  return {
    get charts() { return charts; },
    save,
    remove,
    duplicate,
    touch,
    getById,
    reload: loadFromStorage
  };
}

export const chartArchive = createChartArchive();
