import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension,
  openPage,
  seedBookmarks,
  openCommandBar,
  OPEN_SHORTCUT,
} from './helpers';

/**
 * User-visible latency measurements. Numbers are logged so loops can compare
 * before/after; assertions are loose sanity bounds only, to avoid flakes.
 */

function stats(timings: number[]): string {
  const sorted = [...timings].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return `mean ${mean.toFixed(0)}ms | p50 ${p50}ms | p95 ${p95}ms`;
}

test('palette open and search latency', async () => {
  const context = await launchBrowserWithExtension();
  await seedBookmarks(context);
  const page = await openPage(context);

  // ── Palette open: shortcut press → backdrop with content rendered ──
  const openTimings: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    await page.keyboard.press(OPEN_SHORTCUT);
    await page.waitForFunction(() => {
      const sr = document.getElementById('slashmebaby-root')?.shadowRoot;
      if (!sr?.querySelector('.smb-backdrop')) return false;
      return (
        sr.querySelectorAll('.smb-tab-col-item').length > 0 ||
        sr.querySelectorAll('.smb-tree-item').length > 0
      );
    }, undefined, { timeout: 5000 });
    openTimings.push(Date.now() - start);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const sr = document.getElementById('slashmebaby-root')?.shadowRoot;
      return !sr?.querySelector('.smb-backdrop');
    }, undefined, { timeout: 5000 });
  }
  console.log(`[PERF-E2E] palette open -> content visible (n=10): ${stats(openTimings)}`);
  expect(Math.min(...openTimings)).toBeLessThan(5000);

  // ── Keystroke → filtered results: query narrows seeded data to one hit ──
  await openCommandBar(page);
  await page.keyboard.press('/'); // switch to search mode

  // Alternate two queries whose top results are distinguishable, so each
  // iteration waits for the *new* state without needing a reset round-trip.
  const setQuery = (q: string) =>
    page.evaluate((value) => {
      const sr = document.getElementById('slashmebaby-root')?.shadowRoot;
      const input = sr?.querySelector('.smb-input') as HTMLInputElement | null;
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, q);
  const waitForTitle = (marker: string, absent: string) =>
    page.waitForFunction(([want, reject]) => {
      const sr = document.getElementById('slashmebaby-root')?.shadowRoot;
      const titles = Array.from(sr?.querySelectorAll('.smb-tree-item .smb-title') ?? [])
        .map((el) => el.textContent ?? '');
      return titles.some((t) => t.includes(want)) && !titles.some((t) => t.includes(reject));
    }, [marker, absent] as const, { timeout: 5000 });

  const searchTimings: number[] = [];
  for (let i = 0; i < 10; i++) {
    const mozillaTurn = i % 2 === 0;
    const start = Date.now();
    await setQuery(mozillaTurn ? 'mozilla' : 'example org');
    if (mozillaTurn) {
      await waitForTitle('Mozilla Developer', 'Example Org');
    } else {
      await waitForTitle('Example Org', 'Mozilla Developer');
    }
    searchTimings.push(Date.now() - start);
  }
  console.log(`[PERF-E2E] query -> filtered results (n=10): ${stats(searchTimings)}`);
  expect(Math.min(...searchTimings)).toBeLessThan(5000);

  await context.close();
});
