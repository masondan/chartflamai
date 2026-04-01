import { browser } from '$app/environment';
import type { AngleData } from './aiState.svelte';

const STORAGE_KEY_CHARTS = 'chartflamai-archive-charts';
const STORAGE_KEY_STORIES = 'chartflamai-archive-stories';
const MAX_CHARTS = 10;
const MAX_STORIES = 10;
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

export interface ArchivedStory {
  id: string;
  data: AngleData;
  createdAt: number;
  lastAccessedAt: number;
}

function generateId(): string {
  return `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createChartArchive() {
  let charts = $state<ArchivedChart[]>([]);
  let stories = $state<ArchivedStory[]>([]);

  function loadFromStorage() {
    if (!browser) return;
    try {
      // Load charts
      const chartsRaw = localStorage.getItem(STORAGE_KEY_CHARTS);
      if (chartsRaw) {
        const parsed: ArchivedChart[] = JSON.parse(chartsRaw);
        const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        charts = parsed.filter(c => c.lastAccessedAt > cutoff);
        if (charts.length !== parsed.length) {
          persistCharts();
        }
      }

      // Load stories
      const storiesRaw = localStorage.getItem(STORAGE_KEY_STORIES);
      if (storiesRaw) {
        const parsed: ArchivedStory[] = JSON.parse(storiesRaw);
        const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        stories = parsed.filter(s => s.lastAccessedAt > cutoff);
        if (stories.length !== parsed.length) {
          persistStories();
        }
      }
    } catch {
      charts = [];
      stories = [];
    }
  }

  function persistCharts() {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY_CHARTS, JSON.stringify(charts));
    } catch {
      // localStorage full — evict oldest and retry
      if (charts.length > 1) {
        charts = charts.slice(1);
        persistCharts();
      }
    }
  }

  function persistStories() {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(stories));
    } catch {
      // localStorage full — evict oldest and retry
      if (stories.length > 1) {
        stories = stories.slice(1);
        persistStories();
      }
    }
  }

  function saveChart(editorType: EditorType, config: Record<string, any>, thumbnail: string, existingId?: string): string {
    const now = Date.now();

    if (existingId) {
      const idx = charts.findIndex(c => c.id === existingId);
      if (idx !== -1) {
        charts[idx] = { ...charts[idx], config, thumbnail, lastAccessedAt: now };
        charts = [...charts];
        persistCharts();
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
    persistCharts();
    return id;
  }

  function saveStory(angleData: AngleData): string {
    const now = Date.now();

    // New story — evict oldest if at capacity
    if (stories.length >= MAX_STORIES) {
      const sorted = [...stories].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      const toRemove = sorted[0];
      stories = stories.filter(s => s.id !== toRemove.id);
    }

    const id = generateId();
    stories = [...stories, { id, data: angleData, createdAt: now, lastAccessedAt: now }];
    persistStories();
    return id;
  }

  function removeCharts(ids: string[]) {
    charts = charts.filter(c => !ids.includes(c.id));
    persistCharts();
  }

  function removeStories(ids: string[]) {
    stories = stories.filter(s => !ids.includes(s.id));
    persistStories();
  }

  function duplicateChart(id: string): string | null {
    const source = charts.find(c => c.id === id);
    if (!source) return null;
    return saveChart(source.editorType, { ...source.config }, source.thumbnail);
  }

  function touchChart(id: string) {
    const chart = charts.find(c => c.id === id);
    if (chart) {
      chart.lastAccessedAt = Date.now();
      charts = [...charts];
      persistCharts();
    }
  }

  function touchStory(id: string) {
    const story = stories.find(s => s.id === id);
    if (story) {
      story.lastAccessedAt = Date.now();
      stories = [...stories];
      persistStories();
    }
  }

  function getChartById(id: string): ArchivedChart | undefined {
    return charts.find(c => c.id === id);
  }

  function getStoryById(id: string): ArchivedStory | undefined {
    return stories.find(s => s.id === id);
  }

  function isStoryArchived(angleId: string): boolean {
    return stories.some(s => s.data.id === angleId);
  }

  // Load on creation
  loadFromStorage();

  return {
    get charts() { return charts; },
    get stories() { return stories; },
    saveChart,
    saveStory,
    removeCharts,
    removeStories,
    duplicateChart,
    touchChart,
    touchStory,
    getChartById,
    getStoryById,
    isStoryArchived,
    reload: loadFromStorage
  };
}

export const chartArchive = createChartArchive();
