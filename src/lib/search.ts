import Fuse from 'fuse.js';
import type { Source, ResultGroup, SearchResultItem } from './messaging';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface SearchableItem {
  id: string;
  title: string;
  url?: string;
  category: Source;
  timestamp?: number;
  icon?: string;
}

export interface SearchEngineOptions {
  maxResultsPerGroup?: number;
}

export interface SearchEngine {
  search(query: string): ResultGroup[];
}

// ─── Category constants ───────────────────────────────────────────────────────

const CATEGORY_ORDER: Source[] = ['tabs', 'bookmarks', 'history', 'actions'];

/** Half-life in hours per category for recency scoring. */
const HALF_LIFE_BY_CATEGORY: Record<Source, number> = {
  tabs: 2,
  bookmarks: 168,
  history: 24,
  actions: 0,
};

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/**
 * Exponential decay recency score.
 * Returns 1.0 for a timestamp of right now, ~0.5 at one half-life, etc.
 * Returns 0 if timestamp is undefined or halfLifeHours is 0.
 */
export function computeRecencyScore(
  timestamp: number | undefined,
  halfLifeHours: number
): number {
  if (timestamp === undefined || halfLifeHours === 0) return 0;
  const ageInHours = (Date.now() - timestamp) / (60 * 60 * 1000);
  return Math.exp((-Math.LN2 * ageInHours) / halfLifeHours);
}

/**
 * Combines a Fuse.js score (0 = perfect, 1 = worst) with a recency score
 * (0–1) using a 60/40 weighting.
 */
export function computeFinalScore(
  fuseScore: number,
  recencyScore: number
): number {
  return (1 - fuseScore) * 0.6 + recencyScore * 0.4;
}

// ─── Engine factory ───────────────────────────────────────────────────────────

/**
 * Creates a search engine backed by Fuse.js with recency-aware scoring.
 */
export function createSearchEngine(
  items: SearchableItem[],
  options: SearchEngineOptions = {}
): SearchEngine {
  const { maxResultsPerGroup = 5 } = options;

  const fuse = new Fuse(items, {
    keys: ['title', 'url'],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
    includeMatches: true,
  });

  function search(query: string): ResultGroup[] {
    // Detect action-prefix mode
    const actionMode = query.startsWith('>');
    const effectiveQuery = actionMode ? query.slice(1).trim() : query.trim();

    // When the effective query is empty (e.g. lone ">"), return nothing
    if (effectiveQuery === '') return [];

    const rawResults = fuse.search(effectiveQuery);

    // Filter to actions-only when using the > prefix
    const filtered = actionMode
      ? rawResults.filter((r) => r.item.category === 'actions')
      : rawResults;

    // Score each hit
    interface ScoredResult {
      item: SearchableItem;
      finalScore: number;
    }

    const scored: ScoredResult[] = filtered.map((r) => {
      const fuseScore = r.score ?? 1;
      const halfLife = HALF_LIFE_BY_CATEGORY[r.item.category];
      const recency = computeRecencyScore(r.item.timestamp, halfLife);
      return { item: r.item, finalScore: computeFinalScore(fuseScore, recency) };
    });

    // Group by category
    const groups = new Map<Source, ScoredResult[]>();
    for (const result of scored) {
      const cat = result.item.category;
      const list = groups.get(cat);
      if (list) list.push(result);
      else groups.set(cat, [result]);
    }

    // Sort within each group by finalScore descending and apply limit
    const resultGroups: ResultGroup[] = [];
    for (const category of CATEGORY_ORDER) {
      const groupItems = groups.get(category);
      if (!groupItems || groupItems.length === 0) continue;

      groupItems.sort((a, b) => b.finalScore - a.finalScore);

      const limited = groupItems.slice(0, maxResultsPerGroup);

      resultGroups.push({
        category,
        items: limited.map(
          (r): SearchResultItem => ({
            id: r.item.id,
            title: r.item.title,
            url: r.item.url,
            icon: r.item.icon,
            score: r.finalScore,
          })
        ),
      });
    }

    return resultGroups;
  }

  return { search };
}
