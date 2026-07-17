import { isInjectableUrl, isContentScriptBlockedUrl } from '../../lib/url-safety';
import type { ToggleOverlayCommand } from '../../lib/messaging';

// ─── Per-tab action-popup routing ─────────────────────────────────────────
//
// The toolbar icon serves two surfaces:
//   - Normal pages (http/https/file): the per-tab popup is cleared to '', so
//     clicks fire action.onClicked and toggle the in-page overlay.
//   - Restricted pages (chrome://, about:, Web Store, other extensions): the
//     manifest default popup stays in place and renders the palette instead,
//     because content scripts cannot run there.
//
// The same split drives the keyboard shortcut: the commands handler calls
// requestOverlayToggle, which messages the content script on scriptable tabs
// and opens the popup on restricted ones.
//
// Firefox builds are MV2, where the API namespace is browserAction rather
// than action — getActionApi() bridges the two.

/** The subset of chrome.action/browserAction this module relies on. */
interface ActionApi {
  setPopup(details: { tabId?: number; popup: string }, callback?: () => void): void;
  openPopup?(): Promise<void> | void;
  onClicked: { addListener(callback: (tab: chrome.tabs.Tab) => void): void };
}

interface ChromeWithActionApis {
  action?: ActionApi;
  browserAction?: ActionApi;
}

export interface ActionRouting {
  /** Registers all listeners synchronously (MV3 wake-safe) and kicks off the
   *  initial popup-state sweep of existing tabs. */
  register(): void;
  /** Opens the palette for the given tab: in-page overlay when the content
   *  script can run there, action popup otherwise. Must be called
   *  synchronously from a user-action handler so the Firefox pre-149
   *  openPopup gesture requirement is satisfied. */
  requestOverlayToggle(tab: chrome.tabs.Tab | undefined): void;
}

const TOGGLE_OVERLAY_MESSAGE: ToggleOverlayCommand = { type: 'TOGGLE_OVERLAY' };

export function createActionRouting(): ActionRouting {
  // file:// tabs only host content scripts once the user enables
  // "Allow access to file URLs" (Chrome). Until the probe resolves true,
  // file tabs are routed to the popup, where the palette always works.
  let fileAccessAllowed = false;

  function getActionApi(): ActionApi | undefined {
    const c = chrome as unknown as ChromeWithActionApis;
    return c.action ?? c.browserAction;
  }

  function isChromeActionNamespace(): boolean {
    return (chrome as unknown as ChromeWithActionApis).action !== undefined;
  }

  function getDefaultPopupPath(): string {
    const manifest = chrome.runtime.getManifest() as {
      action?: { default_popup?: string };
      browser_action?: { default_popup?: string };
    };
    return manifest.action?.default_popup ?? manifest.browser_action?.default_popup ?? '';
  }

  function isScriptableTabUrl(url: string | undefined): boolean {
    if (!isInjectableUrl(url)) return false;
    if (isContentScriptBlockedUrl(url)) return false;
    if (url.toLowerCase().startsWith('file:') && !fileAccessAllowed) return false;
    return true;
  }

  function openPopupFallback(api: ActionApi): void {
    try {
      const result = api.openPopup?.();
      if (result && typeof result.catch === 'function') {
        // Rejections are expected: unfocused window, popup missing for the
        // tab, or a lost user gesture on Firefox pre-149. The shortcut just
        // does nothing in those moments; the next attempt works.
        result.catch(() => undefined);
      }
    } catch {
      // Synchronous throw (API present but unsupported) — same story.
    }
  }

  function restoreDefaultPopup(tabId: number): void {
    getActionApi()?.setPopup({ tabId, popup: getDefaultPopupPath() });
  }

  function applyPopupRouting(tabId: number, url: string | undefined, mode: 'sweep' | 'event'): void {
    const api = getActionApi();
    if (!api) return;
    if (isScriptableTabUrl(url)) {
      api.setPopup({ tabId, popup: '' });
    } else if (mode === 'event') {
      // Explicit restore rather than relying on the browser's
      // navigation-reset of per-tab popup state, which is not guaranteed by
      // Chrome's documentation. During the sweep restricted tabs are left
      // untouched — they already show the manifest default.
      api.setPopup({ tabId, popup: getDefaultPopupPath() });
    }
  }

  function requestOverlayToggle(tab: chrome.tabs.Tab | undefined): void {
    const api = getActionApi();
    if (!api) return;
    if (tab?.id !== undefined && isScriptableTabUrl(tab.url)) {
      const tabId = tab.id;
      chrome.tabs.sendMessage(tabId, TOGGLE_OVERLAY_MESSAGE, () => {
        if (chrome.runtime.lastError) {
          // Content script unreachable despite a scriptable URL (races,
          // frame not yet injected). Restore the popup for this tab and open
          // it. On Firefox pre-149 the gesture is lost by now, so openPopup
          // rejects and the popup simply opens on the next click.
          api.setPopup({ tabId, popup: getDefaultPopupPath() }, () => openPopupFallback(api));
        }
      });
      return;
    }
    // Restricted page or no usable tab: the default popup is still in place
    // for this tab, so openPopup shows the palette. Called synchronously to
    // preserve the Firefox user-input context.
    openPopupFallback(api);
  }

  function sweepAllTabs(): void {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id !== undefined) applyPopupRouting(tab.id, tab.url, 'sweep');
      }
    });
  }

  function register(): void {
    const api = getActionApi();
    if (!api) return;

    api.onClicked.addListener((tab) => requestOverlayToggle(tab));

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        // Route only once the page finished loading: the content script
        // injects at document_idle, so clearing earlier would open a window
        // where icon clicks find no receiver.
        applyPopupRouting(tabId, tab.url, 'event');
      } else if (typeof changeInfo.url === 'string' && !isScriptableTabUrl(changeInfo.url)) {
        // Navigating into a restricted URL: restore the default popup right
        // away so the icon and shortcut fall back to the popup immediately.
        restoreDefaultPopup(tabId);
      }
    });

    chrome.tabs.onActivated.addListener(({ tabId }) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return; // tab already closed
        applyPopupRouting(tabId, tab.url, 'event');
      });
    });

    // Initial sweep. On Chrome, resolve the file-access setting first so
    // file:// tabs are classified correctly; Firefox matches file: through
    // <all_urls> without a separate opt-in, so no probe is needed there.
    const probe = isChromeActionNamespace()
      ? chrome.extension?.isAllowedFileSchemeAccess
      : undefined;
    if (probe) {
      probe((allowed) => {
        fileAccessAllowed = allowed;
        sweepAllTabs();
      });
    } else {
      fileAccessAllowed = !isChromeActionNamespace();
      sweepAllTabs();
    }
  }

  return { register, requestOverlayToggle };
}
