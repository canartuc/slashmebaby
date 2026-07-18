/**
 * The active tab's URL in the current window, or null. Used by the popup,
 * whose own window.location is the extension page — actions like
 * copy-clean-link need the page the user is actually looking at. Relies on
 * the "tabs" permission (already granted in wxt.config.ts).
 */
export async function getActiveTabUrl(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url ?? null;
  } catch {
    return null;
  }
}
