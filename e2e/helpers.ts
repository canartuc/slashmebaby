import type { BrowserContext } from '@playwright/test';

/**
 * Finds the extension ID of the loaded SlashMeBaby extension by inspecting
 * the service worker URL registered in the browser context.
 *
 * This works because Chromium exposes service workers via the `chrome.serviceWorkers()`
 * method on the BrowserContext. The extension's background service worker URL follows
 * the pattern: chrome-extension://<extension-id>/background.js
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  // Wait for the service worker to be registered (extension load)
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const url = serviceWorker.url();
  // URL format: chrome-extension://<id>/background.js
  const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
  if (!match) {
    throw new Error(`Could not extract extension ID from service worker URL: ${url}`);
  }

  return match[1];
}
