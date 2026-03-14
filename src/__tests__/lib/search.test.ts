import { describe, it, expect } from 'vitest';
import {
  computeRecencyScore,
  computeFinalScore,
  createSearchEngine,
} from '../../lib/search';
import type { SearchableItem } from '../../lib/search';

// ─── computeRecencyScore ──────────────────────────────────────────────────────

describe('computeRecencyScore', () => {
  it('returns 1.0 for a timestamp of right now', () => {
    const now = Date.now();
    const score = computeRecencyScore(now, 2);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('returns ~0.5 at exactly one half-life', () => {
    const halfLifeHours = 2;
    const now = Date.now();
    const halfLifeAgo = now - halfLifeHours * 60 * 60 * 1000;
    const score = computeRecencyScore(halfLifeAgo, halfLifeHours);
    expect(score).toBeCloseTo(0.5, 5);
  });

  it('returns ~0.25 at exactly two half-lives', () => {
    const halfLifeHours = 2;
    const now = Date.now();
    const twoHalfLivesAgo = now - 2 * halfLifeHours * 60 * 60 * 1000;
    const score = computeRecencyScore(twoHalfLivesAgo, halfLifeHours);
    expect(score).toBeCloseTo(0.25, 5);
  });

  it('returns 0 when no timestamp is provided (undefined)', () => {
    expect(computeRecencyScore(undefined, 24)).toBe(0);
  });

  it('returns a smaller score for older timestamps', () => {
    const halfLifeHours = 24;
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const tenHoursAgo = now - 10 * 60 * 60 * 1000;
    const recent = computeRecencyScore(oneHourAgo, halfLifeHours);
    const older = computeRecencyScore(tenHoursAgo, halfLifeHours);
    expect(recent).toBeGreaterThan(older);
  });

  it('works with a 168h (one week) half-life', () => {
    const halfLifeHours = 168;
    const now = Date.now();
    const halfLifeAgo = now - halfLifeHours * 60 * 60 * 1000;
    const score = computeRecencyScore(halfLifeAgo, halfLifeHours);
    expect(score).toBeCloseTo(0.5, 5);
  });
});

// ─── computeFinalScore ────────────────────────────────────────────────────────

describe('computeFinalScore', () => {
  it('returns 1.0 for perfect fuse score (0) and perfect recency (1)', () => {
    // (1 - 0) * 0.6 + 1 * 0.4 = 1.0
    expect(computeFinalScore(0, 1)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.4 for perfect fuse score (0) and zero recency (0)', () => {
    // (1 - 0) * 0.6 + 0 * 0.4 = 0.6
    expect(computeFinalScore(0, 0)).toBeCloseTo(0.6, 5);
  });

  it('applies 60/40 weighting correctly', () => {
    // fuseScore = 0.5 -> fuzzy contribution = (1 - 0.5) * 0.6 = 0.3
    // recencyScore = 0.5 -> recency contribution = 0.5 * 0.4 = 0.2
    // total = 0.5
    expect(computeFinalScore(0.5, 0.5)).toBeCloseTo(0.5, 5);
  });

  it('returns 0 for worst fuse score (1) and zero recency (0)', () => {
    // (1 - 1) * 0.6 + 0 * 0.4 = 0
    expect(computeFinalScore(1, 0)).toBeCloseTo(0, 5);
  });

  it('returns 0.4 for worst fuse score (1) and perfect recency (1)', () => {
    // (1 - 1) * 0.6 + 1 * 0.4 = 0.4
    expect(computeFinalScore(1, 1)).toBeCloseTo(0.4, 5);
  });
});

// ─── createSearchEngine ───────────────────────────────────────────────────────

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

const sampleItems: SearchableItem[] = [
  {
    id: 'tab-1',
    title: 'GitHub Pull Requests',
    url: 'https://github.com/pulls',
    category: 'tabs',
    timestamp: NOW - 1 * HOUR,
  },
  {
    id: 'tab-2',
    title: 'GitHub Issues',
    url: 'https://github.com/issues',
    category: 'tabs',
    timestamp: NOW - 3 * HOUR,
  },
  {
    id: 'bm-1',
    title: 'GitHub Bookmarks',
    url: 'https://github.com/starred',
    category: 'bookmarks',
    timestamp: NOW - 48 * HOUR,
  },
  {
    id: 'hist-1',
    title: 'GitHub History',
    url: 'https://github.com/notifications',
    category: 'history',
    timestamp: NOW - 12 * HOUR,
  },
  {
    id: 'action-1',
    title: 'Open New Tab',
    category: 'actions',
  },
  {
    id: 'action-2',
    title: 'Close Current Tab',
    category: 'actions',
  },
];

describe('createSearchEngine', () => {
  describe('basic search', () => {
    it('returns grouped results for a matching query', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('GitHub');
      expect(results.length).toBeGreaterThan(0);
      // All groups should only contain categories with hits
      const categories = results.map((g) => g.category);
      expect(categories).toEqual([...new Set(categories)]); // no duplicates
    });

    it('returns empty array when no items match', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('xyzzy_no_match_at_all_12345');
      expect(results).toEqual([]);
    });

    it('groups results in order: tabs, bookmarks, history, actions', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('GitHub');

      const order: string[] = ['tabs', 'bookmarks', 'history', 'actions'];
      const returnedCategories = results.map((g) => g.category);

      for (let i = 0; i < returnedCategories.length - 1; i++) {
        const aIdx = order.indexOf(returnedCategories[i]);
        const bIdx = order.indexOf(returnedCategories[i + 1]);
        expect(aIdx).toBeLessThanOrEqual(bIdx);
      }
    });

    it('items within tabs group are sorted by recency (most recent first)', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('GitHub');

      const tabGroup = results.find((g) => g.category === 'tabs');
      expect(tabGroup).toBeDefined();
      if (tabGroup && tabGroup.items.length >= 2) {
        // tab-1 is 1h old, tab-2 is 3h old — tab-1 should score higher
        expect(tabGroup.items[0].id).toBe('tab-1');
      }
    });
  });

  describe('maxResultsPerGroup', () => {
    it('limits results per group to default 5', () => {
      // Create 7 tab items
      const manyTabs: SearchableItem[] = Array.from({ length: 7 }, (_, i) => ({
        id: `tab-${i}`,
        title: `Tab Number ${i}`,
        url: `https://example.com/${i}`,
        category: 'tabs' as const,
        timestamp: NOW - i * HOUR,
      }));
      const engine = createSearchEngine(manyTabs);
      const results = engine.search('Tab');
      const tabGroup = results.find((g) => g.category === 'tabs');
      expect(tabGroup).toBeDefined();
      expect(tabGroup!.items.length).toBeLessThanOrEqual(5);
    });

    it('respects custom maxResultsPerGroup option', () => {
      const manyTabs: SearchableItem[] = Array.from({ length: 7 }, (_, i) => ({
        id: `tab-${i}`,
        title: `Tab Number ${i}`,
        url: `https://example.com/${i}`,
        category: 'tabs' as const,
        timestamp: NOW - i * HOUR,
      }));
      const engine = createSearchEngine(manyTabs, { maxResultsPerGroup: 3 });
      const results = engine.search('Tab');
      const tabGroup = results.find((g) => g.category === 'tabs');
      expect(tabGroup).toBeDefined();
      expect(tabGroup!.items.length).toBeLessThanOrEqual(3);
    });
  });

  describe('action prefix mode (>)', () => {
    it('returns only actions when query starts with >', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('>Tab');
      for (const group of results) {
        expect(group.category).toBe('actions');
      }
    });

    it('strips the > before searching', () => {
      const engine = createSearchEngine(sampleItems);
      // ">Tab" should match "Open New Tab" and "Close Current Tab"
      const results = engine.search('>Tab');
      const actionGroup = results.find((g) => g.category === 'actions');
      expect(actionGroup).toBeDefined();
      expect(actionGroup!.items.length).toBeGreaterThan(0);
    });

    it('returns empty array when no actions match the stripped query', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('>xyzzy_no_match_999');
      expect(results).toEqual([]);
    });

    it('handles lone > with empty query gracefully', () => {
      const engine = createSearchEngine(sampleItems);
      // "> " or ">" alone — should not throw, may return all actions or empty
      expect(() => engine.search('>')).not.toThrow();
    });
  });

  describe('score shape', () => {
    it('each result item has a numeric score', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('GitHub');
      for (const group of results) {
        for (const item of group.items) {
          expect(typeof item.score).toBe('number');
          expect(item.score).toBeGreaterThanOrEqual(0);
          expect(item.score).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('empty effective query', () => {
    it('returns empty results for whitespace-only query', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('   ');
      expect(results).toEqual([]);
    });

    it('returns empty results for > followed by whitespace', () => {
      const engine = createSearchEngine(sampleItems);
      const results = engine.search('>   ');
      expect(results).toEqual([]);
    });
  });
});
