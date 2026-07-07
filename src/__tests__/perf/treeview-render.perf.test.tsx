import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { appendFileSync } from 'node:fs';
import { TreeView } from '../../components/CommandBar/TreeView';
import type { TreeItem as TreeItemData } from '../../hooks/useTreeData';

/**
 * Render benchmark for the arrow-key navigation hot path.
 *
 * Run explicitly with:
 *   PERF=1 npx vitest run src/__tests__/perf/treeview-render.perf.test.tsx
 *
 * Simulates a user arrowing through a 100-item list: each keypress changes
 * only `selectedIndex`, so ideally only the items whose selection state
 * changed should re-render. React.Profiler's actualDuration aggregates the
 * real render cost of the whole TreeView subtree per commit.
 */

const RESULTS_FILE = process.env.PERF_OUT ?? '/tmp/slashmebaby-perf.log';
function report(line: string): void {
  console.log(line);
  appendFileSync(RESULTS_FILE, `${new Date().toISOString()} ${line}\n`);
}

function makeItems(count: number): TreeItemData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bm-${i}`,
    type: 'bookmark' as const,
    title: `Bookmark ${i} — some descriptive title for item number ${i}`,
    url: `https://example.com/page/${i}`,
    depth: i % 3,
    isExpanded: false,
    childCount: 0,
  }));
}

const ITEM_COUNT = 100;
const KEYPRESSES = 100;

// Stays gated: an on-demand benchmark (timings logged to PERF_OUT, no thresholds), not a correctness test.
describe.runIf(process.env.PERF === '1')('TreeView arrow-key render benchmark', () => {
  it('measures total render duration across selection changes', () => {
    const items = makeItems(ITEM_COUNT);
    const labels = new Map<number, string>();
    const noop = () => {};

    const durations: number[] = [];
    const onRender: React.ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
      durations.push(actualDuration);
    };

    const tree = (selectedIndex: number) => (
      <React.Profiler id="treeview" onRender={onRender}>
        <TreeView
          pinnedTabs={[]}
          allTabs={[]}
          visibleItems={items}
          labels={labels}
          selectedIndex={selectedIndex}
          showFavicons={false}
          onSelectItem={noop}
          onPinnedTabSelect={noop}
          onTabGridSelect={noop}
          searchMode={false}
          searchQuery=""
        />
      </React.Profiler>
    );

    const { rerender } = render(tree(0));
    durations.length = 0; // discard mount commit; measure updates only

    const start = performance.now();
    for (let i = 1; i <= KEYPRESSES; i++) {
      rerender(tree(i % ITEM_COUNT));
    }
    const wallClock = performance.now() - start;

    const totalRender = durations.reduce((a, b) => a + b, 0);
    report(
      `[PERF] TreeView ${KEYPRESSES} selection changes over ${ITEM_COUNT} items: ` +
      `profiler total ${totalRender.toFixed(1)}ms | mean ${(totalRender / KEYPRESSES).toFixed(3)}ms per keypress | ` +
      `wall-clock ${wallClock.toFixed(1)}ms`
    );
    expect(durations.length).toBe(KEYPRESSES);
  });
});
