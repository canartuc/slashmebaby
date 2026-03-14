import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 2,
  workers: 1,
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
