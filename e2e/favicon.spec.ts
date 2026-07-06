import { test, expect } from '@playwright/test';
import { launchBrowserWithExtension, openPage, openCommandBar } from './helpers';

// A favicon <img> is "broken" once it has finished loading (`complete`) but has
// zero intrinsic size. The fallback chain must ensure no such element survives:
// every icon is either a loaded image or replaced by the globe <svg>.
test('palette favicons never render as broken images', async () => {
  const context = await launchBrowserWithExtension();
  // Open a couple of real pages first so the palette has tabs with favicons.
  await openPage(context, 'https://example.com');
  const page = await openPage(context, 'https://www.wikipedia.org');

  await openCommandBar(page);

  // Give the fallback chain time to run (direct error → proxy round-trip).
  await page.waitForTimeout(1500);

  const brokenCount = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const imgs = Array.from(
      host?.shadowRoot?.querySelectorAll('img.smb-favicon') ?? []
    ) as HTMLImageElement[];
    return imgs.filter((img) => img.complete && img.naturalWidth === 0).length;
  });

  expect(brokenCount).toBe(0);

  await context.close();
});
