import { describe, it, expect, vi, afterEach } from 'vitest';
import { createActionRouting } from '../../entrypoints/background/action-routing';

type ClickListener = (tab: chrome.tabs.Tab) => void;
// Structural stand-ins for the onUpdated/onActivated payloads — the
// installed @types/chrome doesn't export names for them.
type UpdatedListener = (
  tabId: number,
  changeInfo: { status?: string; url?: string },
  tab: chrome.tabs.Tab
) => void;
type ActivatedListener = (info: { tabId: number; windowId: number }) => void;

interface MockOptions {
  /** Tabs returned by the sweep's tabs.query. */
  tabs?: Array<Partial<chrome.tabs.Tab>>;
  /** Result of chrome.extension.isAllowedFileSchemeAccess (Chrome only). */
  fileAccess?: boolean;
  /** Firefox MV2 shape: chrome.browserAction present, chrome.action absent. */
  firefox?: boolean;
  /** Neither chrome.action nor chrome.browserAction exists. */
  noActionApi?: boolean;
  /** chrome.runtime.lastError message during callbacks (counts reads).
   *  Chrome sets DIFFERENT messages for "no content script" vs the benign
   *  "listener didn't respond" case — the routing must distinguish them. */
  lastErrorMessage?: string;
  /** Where lastError is set: only inside the sendMessage callback (default,
   *  matches the real no-receiver case) or during every callback. */
  lastErrorScope?: 'sendMessage' | 'always';
  /** When true, isAllowedFileSchemeAccess never invokes its callback —
   *  simulates the probe still being in flight on service-worker wake. */
  fileProbeNeverResolves?: boolean;
}

const NO_RECEIVER_ERROR = 'Could not establish connection. Receiving end does not exist.';
const PORT_CLOSED_ERROR = 'The message port closed before a response was received.';

function makeActionChromeMock(opts: MockOptions = {}) {
  const clickListeners: ClickListener[] = [];
  const updatedListeners: UpdatedListener[] = [];
  const activatedListeners: ActivatedListener[] = [];
  let lastErrorReads = 0;
  let inSendMessageCallback = false;

  const actionApi = {
    setPopup: vi.fn((_details: object, cb?: () => void) => cb?.()),
    getPopup: vi.fn((_details: object, cb?: (p: string) => void) => cb?.('')),
    openPopup: vi.fn(() => Promise.resolve()),
    onClicked: { addListener: vi.fn((fn: ClickListener) => clickListeners.push(fn)) },
  };

  const queryTabs = (opts.tabs ?? []) as chrome.tabs.Tab[];

  const chromeMock: Record<string, unknown> = {
    runtime: {
      id: 'real-ext-id',
      getManifest: vi.fn(() =>
        opts.firefox
          ? { browser_action: { default_popup: 'popup.html' } }
          : { action: { default_popup: 'popup.html' } }
      ),
      get lastError() {
        lastErrorReads += 1;
        if (!opts.lastErrorMessage) return undefined;
        const scoped = (opts.lastErrorScope ?? 'sendMessage') === 'sendMessage';
        if (scoped && !inSendMessageCallback) return undefined;
        return { message: opts.lastErrorMessage };
      },
    },
    tabs: {
      query: vi.fn((_q: object, cb?: (tabs: chrome.tabs.Tab[]) => void) => {
        cb?.(queryTabs);
        return Promise.resolve(queryTabs);
      }),
      get: vi.fn((tabId: number, cb?: (tab?: chrome.tabs.Tab) => void) => {
        const tab = queryTabs.find((t) => t.id === tabId);
        cb?.(tab);
      }),
      sendMessage: vi.fn((_tabId: number, _msg: unknown, cb?: () => void) => {
        inSendMessageCallback = true;
        cb?.();
        inSendMessageCallback = false;
      }),
      onUpdated: { addListener: vi.fn((fn: UpdatedListener) => updatedListeners.push(fn)) },
      onActivated: { addListener: vi.fn((fn: ActivatedListener) => activatedListeners.push(fn)) },
    },
    extension: {
      isAllowedFileSchemeAccess: vi.fn((cb: (allowed: boolean) => void) => {
        if (!opts.fileProbeNeverResolves) cb(opts.fileAccess ?? false);
      }),
    },
  };

  if (!opts.noActionApi) {
    if (opts.firefox) chromeMock.browserAction = actionApi;
    else chromeMock.action = actionApi;
  }

  return {
    chromeMock,
    actionApi,
    clickListeners,
    updatedListeners,
    activatedListeners,
    readLastErrorCount: () => lastErrorReads,
  };
}

function stubAndRegister(opts: MockOptions = {}) {
  const mock = makeActionChromeMock(opts);
  vi.stubGlobal('chrome', mock.chromeMock);
  const routing = createActionRouting();
  routing.register();
  // The initial sweep is triggered by onInstalled/onStartup in production;
  // tests run it explicitly to exercise the same startup state.
  routing.sweep();
  return { ...mock, routing };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createActionRouting > register', () => {
  it('subscribes action.onClicked, tabs.onUpdated and tabs.onActivated synchronously', () => {
    const { actionApi, chromeMock } = stubAndRegister();
    expect(actionApi.onClicked.addListener).toHaveBeenCalledTimes(1);
    const tabs = chromeMock.tabs as { onUpdated: { addListener: unknown }; onActivated: { addListener: unknown } };
    expect(tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    expect(tabs.onActivated.addListener).toHaveBeenCalledTimes(1);
  });

  it('register alone does not sweep tabs (per-tab state survives worker wakes)', () => {
    const mock = makeActionChromeMock({ tabs: [{ id: 1, url: 'https://example.com/' }] });
    vi.stubGlobal('chrome', mock.chromeMock);
    const routing = createActionRouting();
    routing.register();
    expect(mock.actionApi.setPopup).not.toHaveBeenCalled();
    routing.sweep();
    expect(mock.actionApi.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: '' });
  });

  it('sweeps existing tabs and clears the per-tab popup for https tabs', () => {
    const { actionApi } = stubAndRegister({
      tabs: [{ id: 1, url: 'https://example.com/' }],
    });
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: '' });
  });

  it('leaves the popup untouched for chrome:// tabs during the sweep', () => {
    const { actionApi } = stubAndRegister({
      tabs: [
        { id: 1, url: 'chrome://extensions/' },
        { id: 2, url: 'https://example.com/' },
      ],
    });
    const touchedTabIds = actionApi.setPopup.mock.calls.map(
      (c) => (c[0] as { tabId: number }).tabId
    );
    expect(touchedTabIds).toEqual([2]);
  });

  it('is a safe no-op when neither chrome.action nor chrome.browserAction exists', () => {
    const mock = makeActionChromeMock({ noActionApi: true });
    vi.stubGlobal('chrome', mock.chromeMock);
    const routing = createActionRouting();
    expect(() => routing.register()).not.toThrow();
    expect(() => routing.requestOverlayToggle({ id: 1, url: 'chrome://newtab/' } as chrome.tabs.Tab)).not.toThrow();
  });

  it('uses chrome.browserAction when chrome.action is unavailable (Firefox MV2)', () => {
    const { actionApi } = stubAndRegister({
      firefox: true,
      tabs: [{ id: 3, url: 'https://example.com/' }],
    });
    expect(actionApi.onClicked.addListener).toHaveBeenCalledTimes(1);
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 3, popup: '' });
  });

  it('treats file:// tabs as restricted while file access is denied', () => {
    const { actionApi } = stubAndRegister({
      fileAccess: false,
      tabs: [{ id: 4, url: 'file:///Users/me/doc.html' }],
    });
    expect(actionApi.setPopup).not.toHaveBeenCalled();
  });

  it('clears file:// tabs once isAllowedFileSchemeAccess reports true', () => {
    const { actionApi } = stubAndRegister({
      fileAccess: true,
      tabs: [{ id: 4, url: 'file:///Users/me/doc.html' }],
    });
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 4, popup: '' });
  });

  it('treats file:// tabs as injectable on Firefox without calling isAllowedFileSchemeAccess', () => {
    const { actionApi, chromeMock } = stubAndRegister({
      firefox: true,
      tabs: [{ id: 5, url: 'file:///home/me/doc.html' }],
    });
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 5, popup: '' });
    const ext = chromeMock.extension as { isAllowedFileSchemeAccess: ReturnType<typeof vi.fn> };
    expect(ext.isAllowedFileSchemeAccess).not.toHaveBeenCalled();
  });
});

describe('createActionRouting > popup routing via tab events', () => {
  it('onUpdated status=complete on an https tab clears the per-tab popup', () => {
    const { actionApi, updatedListeners } = stubAndRegister();
    actionApi.setPopup.mockClear();
    updatedListeners[0](
      9,
      { status: 'complete' },
      { id: 9, url: 'https://example.com/' } as chrome.tabs.Tab
    );
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 9, popup: '' });
  });

  it('onUpdated url change into chrome:// restores the manifest default popup', () => {
    const { actionApi, updatedListeners } = stubAndRegister();
    actionApi.setPopup.mockClear();
    updatedListeners[0](
      9,
      { url: 'chrome://settings/' },
      { id: 9, url: 'chrome://settings/' } as chrome.tabs.Tab
    );
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 9, popup: 'popup.html' });
  });

  it('does not clear the popup while an https page is still loading', () => {
    const { actionApi, updatedListeners } = stubAndRegister();
    actionApi.setPopup.mockClear();
    updatedListeners[0](
      9,
      { status: 'loading' },
      { id: 9, url: 'https://example.com/' } as chrome.tabs.Tab
    );
    expect(actionApi.setPopup).not.toHaveBeenCalled();
  });

  it('onActivated re-applies routing from tabs.get', () => {
    const { actionApi, activatedListeners } = stubAndRegister({
      tabs: [{ id: 6, url: 'https://example.com/' }],
    });
    actionApi.setPopup.mockClear();
    activatedListeners[0]({ tabId: 6, windowId: 1 });
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 6, popup: '' });
  });

  it('onActivated restores the default popup on a restricted tab', () => {
    const { actionApi, activatedListeners } = stubAndRegister({
      tabs: [{ id: 8, url: 'chrome://newtab/' }],
    });
    actionApi.setPopup.mockClear();
    activatedListeners[0]({ tabId: 8, windowId: 1 });
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 8, popup: 'popup.html' });
  });

  it('swallows lastError when the activated tab is gone', () => {
    const { actionApi, activatedListeners, readLastErrorCount } = stubAndRegister({
      lastErrorMessage: 'No tab with id: 99.',
      lastErrorScope: 'always',
    });
    actionApi.setPopup.mockClear();
    expect(() => activatedListeners[0]({ tabId: 99, windowId: 1 })).not.toThrow();
    expect(readLastErrorCount()).toBeGreaterThan(0);
    expect(actionApi.setPopup).not.toHaveBeenCalled();
  });

  it('treats Chrome Web Store tabs as restricted despite the https scheme', () => {
    const { actionApi, updatedListeners } = stubAndRegister();
    actionApi.setPopup.mockClear();
    updatedListeners[0](
      11,
      { status: 'complete' },
      { id: 11, url: 'https://chromewebstore.google.com/detail/x' } as chrome.tabs.Tab
    );
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 11, popup: 'popup.html' });
  });
});

describe('createActionRouting > requestOverlayToggle', () => {
  it('sends typed TOGGLE_OVERLAY to a scriptable tab', () => {
    const { routing, chromeMock } = stubAndRegister();
    const tabs = chromeMock.tabs as { sendMessage: ReturnType<typeof vi.fn> };
    routing.requestOverlayToggle({ id: 7, url: 'https://example.com/' } as chrome.tabs.Tab);
    expect(tabs.sendMessage).toHaveBeenCalledWith(
      7,
      { type: 'TOGGLE_OVERLAY' },
      expect.any(Function)
    );
  });

  it('calls openPopup synchronously for restricted tabs without querying tabs', () => {
    const { routing, actionApi, chromeMock } = stubAndRegister();
    const tabs = chromeMock.tabs as {
      query: ReturnType<typeof vi.fn>;
      sendMessage: ReturnType<typeof vi.fn>;
    };
    tabs.query.mockClear();
    routing.requestOverlayToggle({ id: 8, url: 'chrome://newtab/' } as chrome.tabs.Tab);
    expect(actionApi.openPopup).toHaveBeenCalledTimes(1);
    expect(tabs.sendMessage).not.toHaveBeenCalled();
    expect(tabs.query).not.toHaveBeenCalled();
  });

  it('recovers via default-popup restore + openPopup when no receiver exists', () => {
    const { routing, actionApi, chromeMock, readLastErrorCount } = stubAndRegister({
      lastErrorMessage: NO_RECEIVER_ERROR,
    });
    const tabs = chromeMock.tabs as { sendMessage: ReturnType<typeof vi.fn> };
    routing.requestOverlayToggle({ id: 7, url: 'https://example.com/' } as chrome.tabs.Tab);
    expect(tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(readLastErrorCount()).toBeGreaterThan(0);
    expect(actionApi.setPopup).toHaveBeenCalledWith(
      { tabId: 7, popup: 'popup.html' },
      expect.any(Function)
    );
    expect(actionApi.openPopup).toHaveBeenCalledTimes(1);
  });

  it('does NOT recover on the benign port-closed lastError (listener ran, no response)', () => {
    // Chrome sets this whenever a listener handles the message without
    // calling sendResponse — it means the overlay DID toggle. Recovering
    // here would open the popup on top of the overlay and wedge the
    // per-tab popup onto popup.html.
    const { routing, actionApi, chromeMock, readLastErrorCount } = stubAndRegister({
      lastErrorMessage: PORT_CLOSED_ERROR,
    });
    const tabs = chromeMock.tabs as { sendMessage: ReturnType<typeof vi.fn> };
    actionApi.setPopup.mockClear();
    routing.requestOverlayToggle({ id: 7, url: 'https://example.com/' } as chrome.tabs.Tab);
    expect(tabs.sendMessage).toHaveBeenCalledTimes(1);
    // lastError must still be read (else Chrome logs "Unchecked runtime.lastError")
    expect(readLastErrorCount()).toBeGreaterThan(0);
    expect(actionApi.setPopup).not.toHaveBeenCalled();
    expect(actionApi.openPopup).not.toHaveBeenCalled();
  });

  it('swallows openPopup rejections', async () => {
    const { routing, actionApi } = stubAndRegister();
    actionApi.openPopup.mockImplementation(() => Promise.reject(new Error('no popup')));
    routing.requestOverlayToggle({ id: 8, url: 'chrome://newtab/' } as chrome.tabs.Tab);
    // Flush microtasks — an unhandled rejection would fail the test run.
    await Promise.resolve();
    await Promise.resolve();
    expect(actionApi.openPopup).toHaveBeenCalledTimes(1);
  });

  it('swallows synchronous openPopup exceptions', () => {
    const { routing, actionApi } = stubAndRegister();
    actionApi.openPopup.mockImplementation(() => {
      throw new Error('openPopup not supported');
    });
    expect(() =>
      routing.requestOverlayToggle({ id: 8, url: 'chrome://newtab/' } as chrome.tabs.Tab)
    ).not.toThrow();
  });

  it('falls back to openPopup when the tab has no id', () => {
    const { routing, actionApi } = stubAndRegister();
    routing.requestOverlayToggle(undefined);
    expect(actionApi.openPopup).toHaveBeenCalledTimes(1);
  });
});

describe('createActionRouting > file-access probe race', () => {
  it('tries the content script on file:// tabs even before the probe resolves', () => {
    // On service-worker wake the probe is async; a shortcut arriving first
    // must not misroute a working file:// overlay to a popup that may have
    // been cleared for that tab.
    const { routing, chromeMock } = stubAndRegister({ fileProbeNeverResolves: true });
    const tabs = chromeMock.tabs as { sendMessage: ReturnType<typeof vi.fn> };
    routing.requestOverlayToggle({ id: 4, url: 'file:///Users/me/doc.html' } as chrome.tabs.Tab);
    expect(tabs.sendMessage).toHaveBeenCalledWith(
      4,
      { type: 'TOGGLE_OVERLAY' },
      expect.any(Function)
    );
  });
});

describe('createActionRouting > recovery re-arm protection', () => {
  it('keeps the default popup on a recovered tab across activations until it navigates', () => {
    const { routing, actionApi, activatedListeners, updatedListeners } = stubAndRegister({
      tabs: [{ id: 7, url: 'https://example.com/' }],
      lastErrorMessage: NO_RECEIVER_ERROR,
    });
    // First toggle: content script unreachable → recovery restores default.
    routing.requestOverlayToggle({ id: 7, url: 'https://example.com/' } as chrome.tabs.Tab);
    expect(actionApi.setPopup).toHaveBeenCalledWith(
      { tabId: 7, popup: 'popup.html' },
      expect.any(Function)
    );

    // Re-activating the tab must NOT re-clear the popup (that would re-arm
    // the dead-first-click trap on Firefox pre-149).
    actionApi.setPopup.mockClear();
    activatedListeners[0]({ tabId: 7, windowId: 1 });
    const cleared = actionApi.setPopup.mock.calls.some(
      (c) => (c[0] as { tabId: number; popup: string }).popup === ''
    );
    expect(cleared).toBe(false);

    // A completed navigation re-injects the content script → routing clears
    // the per-tab popup again.
    actionApi.setPopup.mockClear();
    updatedListeners[0](
      7,
      { status: 'complete' },
      { id: 7, url: 'https://example.com/other' } as chrome.tabs.Tab
    );
    expect(actionApi.setPopup).toHaveBeenCalledWith({ tabId: 7, popup: '' });
  });
});

describe('createActionRouting > action.onClicked', () => {
  it('clicking the icon on a cleared tab routes through requestOverlayToggle', () => {
    const { clickListeners, chromeMock } = stubAndRegister();
    const tabs = chromeMock.tabs as { sendMessage: ReturnType<typeof vi.fn> };
    clickListeners[0]({ id: 12, url: 'https://example.com/' } as chrome.tabs.Tab);
    expect(tabs.sendMessage).toHaveBeenCalledWith(
      12,
      { type: 'TOGGLE_OVERLAY' },
      expect.any(Function)
    );
  });
});
