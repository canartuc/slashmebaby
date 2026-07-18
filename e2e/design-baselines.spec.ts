import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  openPopupPage,
  seedBookmarks,
  setSetting,
  pinTab,
  typeInCommandBar,
  getSectionedResults,
  injectNormalizationCss,
  closeOnboardingTab,
  waitForStableSections,
  getExtensionId,
} from './helpers';

// Pixel-perfect design baselines: every distinct designed surface captured
// once against checked-in snapshots (e2e/__screenshots__/darwin/...).
// Theme scope: dark everywhere + light once per token-bearing stylesheet
// (overlay shadow CSS, popup CSS, settings CSS); onboarding-light is a
// conscious exclusion (shares the settings token approach). Regeneration
// and review policy: see CONTRIBUTING.md "Visual design baselines".

test.skip(
  process.platform !== 'darwin',
  'design baselines are darwin-generated; see CONTRIBUTING.md'
);

const VIEWPORT = { width: 1200, height: 800 };

async function preparedOverlay(
  options: { theme?: 'dark' | 'light'; position?: string; withPinned?: boolean } = {}
) {
  const context = await launchWithExtension();
  await closeOnboardingTab(context);
  await seedBookmarks(context);
  if (options.withPinned) {
    await openPage(context, 'https://example.org');
    await pinTab(context, 'example.org');
  }
  await setSetting(context, {
    theme: options.theme ?? 'dark',
    ...(options.position ? { position: options.position } : {}),
  });
  const page = await openPage(context, 'https://example.com');
  await page.setViewportSize(VIEWPORT);
  await openCommandBar(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const host = document.getElementById('slashmebaby-root');
        return (
          host?.shadowRoot?.querySelector('.smb-container')?.getAttribute('data-theme') ?? ''
        );
      }),
      { timeout: 5000 }
    )
    .toBe(options.theme ?? 'dark');
  await waitForStableSections(page);
  await injectNormalizationCss(page);
  return { context, page };
}

test('overlay jump view matches baseline (dark, center)', async () => {
  const { context, page } = await preparedOverlay({ withPinned: true });
  await expect(page.locator('.smb-backdrop')).toHaveScreenshot('overlay-jump-dark.png');
  await context.close();
});

test('overlay position variants match baseline (dark)', async () => {
  const { context, page } = await preparedOverlay({ position: 'top' });
  await expect(page.locator('.smb-backdrop')).toHaveScreenshot('overlay-jump-top-dark.png');
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));

  await setSetting(context, { position: 'bottom' });
  await openCommandBar(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const host = document.getElementById('slashmebaby-root');
        return (
          host?.shadowRoot
            ?.querySelector('.smb-container')
            ?.classList.contains('smb-container--bottom') ?? false
        );
      }),
      { timeout: 5000 }
    )
    .toBe(true);
  await waitForStableSections(page);
  await injectNormalizationCss(page);
  await expect(page.locator('.smb-backdrop')).toHaveScreenshot('overlay-jump-bottom-dark.png');
  await context.close();
});

test('overlay search results match baseline (dark)', async () => {
  const { context, page } = await preparedOverlay();
  // The overlay fetches history once at mount — reopen on miss until the
  // debounced visit cache has the example.com entry (same pattern as
  // history-search.spec.ts) so the baseline always shows the History
  // section.
  await expect
    .poll(async () => {
      await openCommandBar(page).catch(() => {});
      await page.keyboard.press('/');
      await typeInCommandBar(page, 'example');
      const headers = (await getSectionedResults(page)).map(s => s.header);
      if (!headers.includes('History')) {
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 400));
      }
      return headers;
    }, { timeout: 15000, intervals: [500, 1000, 1000, 2000] })
    .toContain('History');
  await waitForStableSections(page);
  await injectNormalizationCss(page);
  await expect(page.locator('.smb-container')).toHaveScreenshot('overlay-search-example-dark.png');
  await context.close();
});

test('overlay action mode matches baseline (dark)', async () => {
  const { context, page } = await preparedOverlay();
  await page.keyboard.press('/');
  await typeInCommandBar(page, '>');
  await expect
    .poll(async () => (await getSectionedResults(page)).map(s => s.header), { timeout: 5000 })
    .toContain('Actions');
  await waitForStableSections(page);
  await expect(page.locator('.smb-container')).toHaveScreenshot('overlay-actions-dark.png');
  await context.close();
});

test('overlay jump view matches baseline (light)', async () => {
  const { context, page } = await preparedOverlay({ theme: 'light' });
  await expect(page.locator('.smb-backdrop')).toHaveScreenshot('overlay-jump-light.png');
  await context.close();
});

test('popup jump view matches baseline (dark and light)', async () => {
  const context = await launchWithExtension();
  await closeOnboardingTab(context);
  await seedBookmarks(context);
  await setSetting(context, { theme: 'dark' });
  const popup = await openPopupPage(context);
  await popup.setViewportSize(VIEWPORT);

  const themeIs = (t: string) =>
    popup.evaluate(
      (want: string) =>
        document.querySelector('.smb-container')?.getAttribute('data-theme') === want,
      t
    );
  await expect.poll(() => themeIs('dark'), { timeout: 5000 }).toBe(true);
  await waitForStableSections(popup);
  await injectNormalizationCss(popup);
  await expect(popup.locator('.smb-container--popup')).toHaveScreenshot('popup-jump-dark.png');

  await setSetting(context, { theme: 'light' });
  await expect.poll(() => themeIs('light'), { timeout: 5000 }).toBe(true);
  await expect(popup.locator('.smb-container--popup')).toHaveScreenshot('popup-jump-light.png');
  await context.close();
});

test('popup search and action modes match baseline (dark)', async () => {
  const context = await launchWithExtension();
  await closeOnboardingTab(context);
  await seedBookmarks(context);
  await setSetting(context, { theme: 'dark' });
  const popup = await openPopupPage(context);
  await popup.setViewportSize(VIEWPORT);
  await waitForStableSections(popup);
  await injectNormalizationCss(popup);

  // Pipeline-proof '/': retry until search mode is live.
  await expect
    .poll(async () => {
      const ro = await popup.evaluate(
        () => (document.querySelector('.smb-input') as HTMLInputElement)?.readOnly ?? true
      );
      if (ro) await popup.keyboard.press('/');
      return ro;
    }, { timeout: 5000 })
    .toBe(false);
  await typeInCommandBar(popup, 'example');
  await waitForStableSections(popup);
  await expect(popup.locator('.smb-container--popup')).toHaveScreenshot('popup-search-example-dark.png');

  await typeInCommandBar(popup, '>');
  await expect
    .poll(async () => (await getSectionedResults(popup)).map(s => s.header), { timeout: 5000 })
    .toContain('Actions');
  await waitForStableSections(popup);
  await expect(popup.locator('.smb-container--popup')).toHaveScreenshot('popup-actions-dark.png');
  await context.close();
});

test('settings page matches baseline (dark and light)', async () => {
  const context = await launchWithExtension();
  await closeOnboardingTab(context);
  const id = await getExtensionId(context);
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORT);
  // Settings themes via prefers-color-scheme only — emulate, not setSetting.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 500));
  await injectNormalizationCss(page);
  await expect(page).toHaveScreenshot('settings-dark.png', { fullPage: true });

  await page.emulateMedia({ colorScheme: 'light' });
  await new Promise(r => setTimeout(r, 300));
  await expect(page).toHaveScreenshot('settings-light.png', { fullPage: true });
  await context.close();
});

test('onboarding steps match baselines (dark)', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);
  await closeOnboardingTab(context);
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORT);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 500));
  await injectNormalizationCss(page);

  const container = page.locator('.smb-onboarding-container');
  const next = page.locator('button.smb-onboarding-next-btn');

  await expect(container).toHaveScreenshot('onboarding-step1-dark.png');
  await next.click();
  await new Promise(r => setTimeout(r, 300));
  await expect(container).toHaveScreenshot('onboarding-step2-dark.png');
  await next.click();
  await new Promise(r => setTimeout(r, 300));
  await expect(container).toHaveScreenshot('onboarding-step3-dark.png');
  await next.click();
  await new Promise(r => setTimeout(r, 300));
  // Step 4: the async "Pinned ✓" badge is nondeterministic — mask it.
  await expect(container).toHaveScreenshot('onboarding-step4-dark.png', {
    mask: [page.locator('.smb-onboarding-pin-status')],
  });
  await next.click();
  await new Promise(r => setTimeout(r, 300));
  await expect(container).toHaveScreenshot('onboarding-step5-dark.png');
  await context.close();
});

test('error strip visible state matches baseline (dark)', async () => {
  // The trigger logic (failed action keeps the palette open) is pinned by
  // CommandBar unit tests; no action fails deterministically in e2e, so
  // only the designed VISUAL state is forced and captured here.
  const { context, page } = await preparedOverlay();
  await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const strip = host?.shadowRoot?.querySelector('.smb-error-strip');
    strip?.classList.add('smb-error-strip--visible');
    if (strip) strip.textContent = "Couldn't close tab";
  });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  );
  await expect(page.locator('.smb-container')).toHaveScreenshot('overlay-error-strip-dark.png');
  await context.close();
});
