import { describe, it, expect } from 'vitest';
import {
  sectionOf,
  computeSectionBoundaries,
  stepSectionBoundary,
} from '../../lib/palette-sections';

// Fixtures mirror the three shapes CommandBar's selectable list takes.
// Search mode: contiguous type runs tab* bookmark* history* [goto].
const SEARCH_ITEMS = [
  { type: 'tab', depth: 0 },
  { type: 'tab', depth: 0 },
  { type: 'bookmark', depth: 1 },
  { type: 'bookmark', depth: 2 },
  { type: 'history', depth: 0 },
  { type: 'goto', depth: 0 },
];

// Jump mode: the bookmark tree — top-level roots are the Tab stops,
// nested folders are not.
const JUMP_ITEMS = [
  { type: 'folder', depth: 0 },
  { type: 'bookmark', depth: 1 },
  { type: 'bookmark', depth: 1 },
  { type: 'folder', depth: 1 },
  { type: 'bookmark', depth: 2 },
  { type: 'folder', depth: 0 },
];

// Action mode ('>' prefix): one homogeneous run.
const ACTION_ITEMS = [
  { type: 'action', depth: 0 },
  { type: 'action', depth: 0 },
  { type: 'action', depth: 0 },
];

describe('sectionOf', () => {
  it('maps tab and group to "Open Tabs"', () => {
    expect(sectionOf({ type: 'tab' })).toBe('Open Tabs');
    expect(sectionOf({ type: 'group' })).toBe('Open Tabs');
  });

  it('maps bookmark and folder to "Bookmarks"', () => {
    expect(sectionOf({ type: 'bookmark' })).toBe('Bookmarks');
    expect(sectionOf({ type: 'folder' })).toBe('Bookmarks');
  });

  it('maps history to "History"', () => {
    expect(sectionOf({ type: 'history' })).toBe('History');
  });

  it('maps action to "Actions"', () => {
    expect(sectionOf({ type: 'action' })).toBe('Actions');
  });

  it('maps goto to "Navigate"', () => {
    expect(sectionOf({ type: 'goto' })).toBe('Navigate');
  });

  it('returns null for an unknown type', () => {
    expect(sectionOf({ type: 'mystery' })).toBeNull();
  });
});

describe('computeSectionBoundaries', () => {
  it('returns [] for an empty list', () => {
    expect(computeSectionBoundaries([])).toEqual([]);
  });

  it('marks each type-run start in grouped search results', () => {
    expect(computeSectionBoundaries(SEARCH_ITEMS)).toEqual([0, 2, 4, 5]);
  });

  it('marks a single boundary for a single-type action list', () => {
    expect(computeSectionBoundaries(ACTION_ITEMS)).toEqual([0]);
  });

  it('marks top-level folders as group starts in the bookmark tree', () => {
    expect(computeSectionBoundaries(JUMP_ITEMS)).toEqual([0, 5]);
  });

  it('does not mark nested folders as boundaries', () => {
    expect(computeSectionBoundaries(JUMP_ITEMS)).not.toContain(3);
  });

  it('does not duplicate a boundary when a top-level folder also starts a new section', () => {
    const items = [
      { type: 'tab', depth: 0 },
      { type: 'folder', depth: 0 },
      { type: 'bookmark', depth: 1 },
    ];
    expect(computeSectionBoundaries(items)).toEqual([0, 1]);
  });
});

describe('stepSectionBoundary', () => {
  it('returns null when there are no boundaries', () => {
    expect(stepSectionBoundary([], 3, 1)).toBeNull();
    expect(stepSectionBoundary([], 0, -1)).toBeNull();
  });

  it('returns null for a single boundary so callers fall back to item stepping', () => {
    // One section = nothing to jump between. Snapping to index 0 would yank
    // the selection away from the user's position (destructive with Enter).
    expect(stepSectionBoundary([0], 0, 1)).toBeNull();
    expect(stepSectionBoundary([0], 2, 1)).toBeNull();
    expect(stepSectionBoundary([0], 2, -1)).toBeNull();
  });

  it('advances to the first boundary after the selection', () => {
    expect(stepSectionBoundary([0, 2, 4, 5], 0, 1)).toBe(2);
    expect(stepSectionBoundary([0, 2, 4, 5], 3, 1)).toBe(4);
  });

  it('wraps forward to the first boundary from the last section', () => {
    expect(stepSectionBoundary([0, 2, 4, 5], 5, 1)).toBe(0);
  });

  it('steps back to the PREVIOUS section start, even from mid-section', () => {
    // idx 3 sits inside the section starting at 2 — Shift+Tab goes to the
    // section ABOVE it (0), matching TS-063 and the onboarding copy.
    expect(stepSectionBoundary([0, 2, 4, 5], 3, -1)).toBe(0);
    expect(stepSectionBoundary([0, 2, 4, 5], 5, -1)).toBe(4);
    expect(stepSectionBoundary([0, 2, 4, 5], 4, -1)).toBe(2);
  });

  it('wraps backward to the last boundary from the top', () => {
    expect(stepSectionBoundary([0, 2, 4, 5], 0, -1)).toBe(5);
  });

  it('forward matches the recovered useKeyboard contract for boundaries [0,3]', () => {
    expect(stepSectionBoundary([0, 3], 0, 1)).toBe(3);
    expect(stepSectionBoundary([0, 3], 4, 1)).toBe(0);
  });

  it('backward from mid-section skips to the previous section, wrapping from the first', () => {
    // Deliberate departure from the deleted useKeyboard hook (which went to
    // the CURRENT section's start first): docs and onboarding promise the
    // previous group.
    expect(stepSectionBoundary([0, 3], 4, -1)).toBe(0);
    expect(stepSectionBoundary([0, 3], 3, -1)).toBe(0);
    expect(stepSectionBoundary([0, 3], 1, -1)).toBe(3);
    expect(stepSectionBoundary([0, 3], 0, -1)).toBe(3);
  });
});
