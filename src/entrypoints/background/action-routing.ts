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
  /** Registers all listeners synchronously (MV3 wake-safe). Does NOT sweep —
   *  per-tab popup state survives worker suspensions, so sweeping belongs to
   *  onInstalled/onStartup (see sweep()). */
  register(): void;
  /** Resolves the file-access setting and applies popup routing to every
   *  open tab. Call on runtime.onInstalled and runtime.onStartup, when the
   *  stored per-tab state can actually be stale. */
  sweep(): void;
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
  // file tabs keep the default popup, where the palette always works.
  let fileAccessAllowed = false;

  // Tabs where a toggle found no content script (recovery restored the
  // default popup). Kept on the default popup across activations — on
  // Firefox pre-149 re-clearing would re-arm a dead first click, since the
  // recovery openPopup call has no user-input context. Cleared when the tab
  // finishes a navigation (fresh content script) or a message succeeds.
  const unreachableTabs = new Set<number>();

  function getActionApi(): ActionApi | undefined {
    const c = chrome as unknown as ChromeWithActionApis;
    return c.action ?? c.browserAction;
  }

  function isChromeActionNamespace(): boolean {
    return (chrome as unknown as ChromeWithActionApis).action !== undefined;
  }

  function browserKind(): 'chrome' | 'firefox' {
    return isChromeActionNamespace() ? 'chrome' : 'firefox';
  }

  // Chrome/Firefox set this exact phrase when NO listener exists on the
  // receiving end. Any other lastError (notably "The message port closed
  // before a response was received.") means a listener ran — the overlay
  // toggled — and recovering would stack the popup on top of it.
  function isNoReceiverError(error: { message?: string } | undefined): boolean {
    return !!error?.message?.includes('Receiving end does not exist');
  }

  function getDefaultPopupPath(): string {
    const manifest = chrome.runtime.getManifest() as {
      action?: { default_popup?: string };
      browser_action?: { default_popup?: string };
    };
    return manifest.action?.default_popup ?? manifest.browser_action?.default_popup ?? '';
  }

  // Whether the content script CAN exist on this URL at all — used by the
  // toggle path, which asks the tab directly and falls back on failure.
  function canHostContentScript(url: string | undefined): boolean {
    return isInjectableUrl(url) && !isContentScriptBlockedUrl(url, browserKind());
  }

  // Stricter check for popup routing: also requires file-access opt-in,
  // since a cleared popup on an unscripted file:// tab would leave the icon
  // doing nothing.
  function isScriptableTabUrl(url: string | undefined): boolean {
    if (!canHostContentScript(url)) return false;
    if ((url as string).toLowerCase().startsWith('file:') && !fileAccessAllowed) return false;
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
    // Only reachable through listeners registered when the action API
    // exists, hence the optional chain rather than a guard.
    const api = getActionApi();
    if (isScriptableTabUrl(url) && !unreachableTabs.has(tabId)) {
      api?.setPopup({ tabId, popup: '' });
    } else if (mode === 'event') {
      // Explicit restore rather than relying on the browser's
      // navigation-reset of per-tab popup state, which is not guaranteed by
      // Chrome's documentation. During the sweep restricted tabs are left
      // untouched — they already show the manifest default.
      api?.setPopup({ tabId, popup: getDefaultPopupPath() });
    }
  }

  function requestOverlayToggle(tab: chrome.tabs.Tab | undefined): void {
    const api = getActionApi();
    if (!api) return;
    // The content script's presence is the ground truth: try the message on
    // every URL that can host one, including file:// tabs whose access
    // probe hasn't resolved yet (a wrong popup-guess there would drop the
    // keystroke entirely).
    if (tab?.id !== undefined && canHostContentScript(tab.url)) {
      const tabId = tab.id;
      chrome.tabs.sendMessage(tabId, TOGGLE_OVERLAY_MESSAGE, () => {
        const error = chrome.runtime.lastError;
        if (isNoReceiverError(error)) {
          // Genuinely no content script (file:// without access, tab from
          // before install). Restore the popup for this tab — and keep it
          // (unreachableTabs) so the icon works on the next click — then
          // try to open it. On Firefox pre-149 the gesture is lost by now,
          // so this openPopup rejects and the restored popup opens on the
          // following click instead.
          unreachableTabs.add(tabId);
          api.setPopup({ tabId, popup: getDefaultPopupPath() }, () => openPopupFallback(api));
        } else if (!error) {
          // The overlay answered — the tab is definitely reachable again.
          unreachableTabs.delete(tabId);
        }
        // Any other error (e.g. "message port closed") means the listener
        // ran and the overlay toggled; reading lastError above swallows it.
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

  function sweep(): void {
    if (!getActionApi()) return;
    // Resolve the file-access setting first so file:// tabs are classified
    // correctly; Firefox matches file: through <all_urls> without a separate
    // opt-in, so no probe is needed there.
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

  function register(): void {
    const api = getActionApi();
    if (!api) return;

    api.onClicked.addListener((tab) => requestOverlayToggle(tab));

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        // A completed load means a fresh content script where one can run —
        // any earlier "unreachable" verdict is stale.
        unreachableTabs.delete(tabId);
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

    // Resolve the file-access flag on every worker wake (cheap, no tab
    // writes) so event-driven routing classifies file:// tabs correctly;
    // the full sweep is reserved for sweep().
    const probe = isChromeActionNamespace()
      ? chrome.extension?.isAllowedFileSchemeAccess
      : undefined;
    if (probe) {
      probe((allowed) => {
        fileAccessAllowed = allowed;
      });
    } else {
      fileAccessAllowed = !isChromeActionNamespace();
    }
  }

  return { register, sweep, requestOverlayToggle };
}
