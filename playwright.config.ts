import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
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
            `--disable-extensions-except=${process.cwd()}/.output/chrome-mv3`,
            `--load-extension=${process.cwd()}/.output/chrome-mv3`,
          ],
        },
      },
    },
  ],
});
