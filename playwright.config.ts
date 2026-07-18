import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 2,
  workers: 1,
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // 0.001 keeps a 1px hairline change on the 720px panel visible;
      // per-shot 0.002 overrides allowed with a comment for proven jitter.
      // NEVER raise thresholds to green a red baseline (see CONTRIBUTING).
      maxDiffPixelRatio: 0.001,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    headless: false,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('.output/chrome-mv3')}`,
            `--load-extension=${path.resolve('.output/chrome-mv3')}`,
            '--no-first-run',
            '--disable-default-apps',
          ],
        },
      },
    },
  ],
});
