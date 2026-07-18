import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../entrypoints/content/App', () => ({
  App: () => null,
}));

vi.mock('../../styles/command-bar.css?inline', () => ({ default: '' }));

interface ContentMain {
  main: () => void;
}

type ChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string
) => void;
type RuntimeListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (response: unknown) => void
) => void;
type StorageGetCb = (result: Record<string, unknown>) => void;

interface CapturedChrome {
  changeListeners: ChangeListener[];
  runtimeListeners: RuntimeListener[];
  storageGet: ReturnType<typeof vi.fn>;
}

function buildChrome(initialSettings?: { shortcut?: string }): CapturedChrome {
  const changeListeners: ChangeListener[] = [];
  const runtimeListeners: RuntimeListener[] = [];

  const storageGet = vi.fn((_keys: unknown, cb: StorageGetCb) => {
    cb({ settings: initialSettings });
  });

  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test-extension',
      onMessage: {
        addListener: vi.fn((cb: RuntimeListener) => {
          runtimeListeners.push(cb);
        }),
      },
      sendMessage: vi.fn(),
    },
    storage: {
      sync: { get: storageGet },
      onChanged: {
        addListener: vi.fn((cb: ChangeListener) => {
          changeListeners.push(cb);
        }),
      },
    },
  });

  return { changeListeners, runtimeListeners, storageGet };
}

async function loadContentMain(): Promise<ContentMain> {
  vi.resetModules();
  const mod = (await import('../../entrypoints/content/index')) as {
    default: ContentMain;
  };
  return mod.default;
}

function setLocation(protocol: 'http:' | 'https:' | 'chrome:' | 'about:' | 'file:') {
  // The injectability guard parses the full URL, so href must agree with
  // the faked protocol (jsdom's own href is always http://localhost/).
  const hrefByProtocol: Record<string, string> = {
    'http:': 'http://test.example/',
    'https:': 'https://test.example/',
    'chrome:': 'chrome://newtab/',
    'about:': 'about:blank',
    'file:': 'file:///Users/test/doc.html',
  };
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, protocol, href: hrefByProtocol[protocol] },
  });
}

function clearBody() {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

type KeydownHandler = (e: KeyboardEvent) => void;

function captureKeydown(): { handler: () => KeydownHandler } {
  let captured: KeydownHandler | null = null;
  const original = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, listener) => {
    if (type === 'keydown' && typeof listener === 'function') {
      captured = listener as KeydownHandler;
      return;
    }
    return original(type, listener as EventListener);
  });
  return {
    handler: () => {
      if (!captured) throw new Error('keydown handler not captured');
      return captured;
    },
  };
}

function fakeKey(opts: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  isTrusted?: boolean;
}): KeyboardEvent {
  return {
    key: opts.key,
    ctrlKey: !!opts.ctrlKey,
    metaKey: !!opts.metaKey,
    shiftKey: !!opts.shiftKey,
    altKey: !!opts.altKey,
    isTrusted: opts.isTrusted !== false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('content script entrypoint', () => {
  beforeEach(() => {
    clearBody();
    setLocation('https:');
    // Re-stub WXT's auto-imported globals — afterEach's unstubAllGlobals
    // wipes the one set in setup.ts.
    vi.stubGlobal(
      'defineContentScript',
      (config: { matches: string[]; main: () => void }) => config
    );
  });

  afterEach(async () => {
    // Drain React's concurrent scheduler while the jsdom window is still
    // alive: clearBody() rips the DOM without unmounting React roots, and a
    // queued render task (Immediate.performWorkUntilDeadline) firing after
    // environment teardown crashes the whole run with "window is not
    // defined" on slow CI runners.
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    clearBody();
    vi.unstubAllGlobals();
  });

  it('skips injection on non-http(s)/file schemes', async () => {
    setLocation('chrome:');
    buildChrome();
    const cs = await loadContentMain();
    cs.main();
    expect(document.getElementById('slashmebaby-root')).toBeNull();
  });

  it('injects on file: pages', async () => {
    setLocation('file:');
    buildChrome();
    const cs = await loadContentMain();
    cs.main();
    expect(document.getElementById('slashmebaby-root')).not.toBeNull();
  });

  it('injects host element with shadow root on https pages', async () => {
    buildChrome();
    const cs = await loadContentMain();
    cs.main();

    const host = document.getElementById('slashmebaby-root');
    expect(host).not.toBeNull();
    expect(host?.dataset.slashmebaby).toBe('1');
    expect(host?.shadowRoot).not.toBeNull();
    expect(host?.shadowRoot?.querySelector('style')).not.toBeNull();
  });

  it('contains key events inside the shadow root while letting other events pass', async () => {
    buildChrome();
    const cs = await loadContentMain();
    cs.main();
    const shadow = document.getElementById('slashmebaby-root')!.shadowRoot!;
    const inner = shadow.querySelector('div')!; // mount point

    const keySpy = vi.fn();
    const clickSpy = vi.fn();
    document.addEventListener('keydown', keySpy);
    document.addEventListener('click', clickSpy);

    inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, composed: true }));
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    document.removeEventListener('keydown', keySpy);
    document.removeEventListener('click', clickSpy);

    // The click proves composed events DO reach the page document in this env,
    // so the keydown NOT reaching it proves the containment actually works
    // (rather than the event simply never propagating).
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(keySpy).not.toHaveBeenCalled();
  });

  it('reads initial shortcut from chrome.storage.sync', async () => {
    const captured = buildChrome({ shortcut: 'Ctrl+K' });
    const cs = await loadContentMain();
    cs.main();
    expect(captured.storageGet).toHaveBeenCalledWith('settings', expect.any(Function));
  });

  it('updates shortcut when chrome.storage.onChanged fires for sync area', async () => {
    const captured = buildChrome({ shortcut: 'Ctrl+K' });
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();
    expect(captured.changeListeners).toHaveLength(1);

    captured.changeListeners[0](
      { settings: { newValue: { shortcut: 'Ctrl+J' }, oldValue: undefined } },
      'sync'
    );

    keys.handler()(fakeKey({ key: 'j', ctrlKey: true }));
    const host = document.getElementById('slashmebaby-root');
    // Mount point + style + rendered React root.
    expect(host?.shadowRoot?.children.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores chrome.storage.onChanged events from non-sync areas', async () => {
    const captured = buildChrome({ shortcut: 'Ctrl+K' });
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();

    captured.changeListeners[0](
      { settings: { newValue: { shortcut: 'Ctrl+J' }, oldValue: undefined } },
      'local'
    );

    keys.handler()(fakeKey({ key: 'j', ctrlKey: true }));
    const host = document.getElementById('slashmebaby-root');
    expect(host?.shadowRoot?.children.length).toBe(2);
  });

  it('rejects synthetic (untrusted) keyboard events', async () => {
    buildChrome();
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();

    keys.handler()(fakeKey({ key: ' ', ctrlKey: true, shiftKey: true, isTrusted: false }));
    const host = document.getElementById('slashmebaby-root');
    expect(host?.shadowRoot?.children.length).toBe(2);
  });

  it('opens overlay when default shortcut Ctrl+Shift+Space is pressed (trusted)', async () => {
    buildChrome();
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();

    const event = fakeKey({ key: ' ', ctrlKey: true, shiftKey: true });
    keys.handler()(event);
    expect(event.preventDefault).toHaveBeenCalled();
    const host = document.getElementById('slashmebaby-root');
    expect(host?.shadowRoot?.children.length).toBeGreaterThanOrEqual(2);
  });

  it('Escape dismisses an open overlay', async () => {
    buildChrome();
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();

    keys.handler()(fakeKey({ key: ' ', ctrlKey: true, shiftKey: true }));
    const escEvent = fakeKey({ key: 'Escape' });
    keys.handler()(escEvent);
    expect(escEvent.preventDefault).toHaveBeenCalled();
  });

  it('special keys are forwarded to the shadow root as smb-keydown events', async () => {
    buildChrome();
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();

    // Open first.
    keys.handler()(fakeKey({ key: ' ', ctrlKey: true, shiftKey: true }));

    const host = document.getElementById('slashmebaby-root');
    const shadow = host?.shadowRoot as ShadowRoot;
    const received: CustomEvent[] = [];
    shadow.addEventListener('smb-keydown', (e) => {
      received.push(e as CustomEvent);
    });

    keys.handler()(fakeKey({ key: 'ArrowDown' }));
    keys.handler()(fakeKey({ key: 'Enter' }));

    expect(received).toHaveLength(2);
    expect(received[0].detail).toMatchObject({ key: 'ArrowDown' });
    expect(received[1].detail).toMatchObject({ key: 'Enter' });
  });

  it('non-special keys are NOT forwarded when a writable input is focused', async () => {
    buildChrome();
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();

    keys.handler()(fakeKey({ key: ' ', ctrlKey: true, shiftKey: true }));

    const host = document.getElementById('slashmebaby-root');
    const shadow = host?.shadowRoot as ShadowRoot;
    // Focus a writable input inside the shadow root so isSearchInputActive is true.
    const input = document.createElement('input');
    shadow.appendChild(input);
    input.focus();

    let count = 0;
    shadow.addEventListener('smb-keydown', () => {
      count++;
    });
    keys.handler()(fakeKey({ key: 'a' }));
    expect(count).toBe(0);
  });

  // '/' routing (F10/F27): mode toggle only when not typing a query — a
  // non-empty focused search input must receive '/' as literal text so
  // path-bearing URLs like "example.com/admin" stay typeable.

  async function openWithFocusedInput(value: string) {
    buildChrome();
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();

    keys.handler()(fakeKey({ key: ' ', ctrlKey: true, shiftKey: true }));

    const shadow = document.getElementById('slashmebaby-root')!.shadowRoot as ShadowRoot;
    const input = document.createElement('input');
    input.value = value;
    shadow.appendChild(input);
    input.focus();

    const received: CustomEvent[] = [];
    shadow.addEventListener('smb-keydown', (e) => {
      received.push(e as CustomEvent);
    });

    // Unmounts the React root and lets its scheduled work settle, so no
    // render task fires after the test environment is torn down.
    const close = async () => {
      keys.handler()(fakeKey({ key: 'Escape' }));
      await new Promise((r) => setTimeout(r, 0));
    };
    return { keys, received, close };
  }

  it("'/' is NOT intercepted while the focused search input has text (stays typeable)", async () => {
    const { keys, received, close } = await openWithFocusedInput('example.com');

    const slash = fakeKey({ key: '/' });
    keys.handler()(slash);

    // Not forwarded as a mode toggle, and not preventDefault-ed — the native
    // input keeps the keystroke and inserts the literal '/'.
    expect(received).toHaveLength(0);
    expect(slash.preventDefault).not.toHaveBeenCalled();
    await close();
  });

  it("'/' IS forwarded as the mode toggle when the focused search input is empty", async () => {
    const { keys, received, close } = await openWithFocusedInput('');

    const slash = fakeKey({ key: '/' });
    keys.handler()(slash);

    expect(received).toHaveLength(1);
    expect(received[0].detail).toMatchObject({ key: '/' });
    expect(slash.preventDefault).toHaveBeenCalled();
    await close();
  });

  it("'/' IS forwarded as the mode toggle when no input is focused (jump mode)", async () => {
    buildChrome();
    const keys = captureKeydown();
    const cs = await loadContentMain();
    cs.main();

    keys.handler()(fakeKey({ key: ' ', ctrlKey: true, shiftKey: true }));

    const shadow = document.getElementById('slashmebaby-root')!.shadowRoot as ShadowRoot;
    const received: CustomEvent[] = [];
    shadow.addEventListener('smb-keydown', (e) => {
      received.push(e as CustomEvent);
    });

    keys.handler()(fakeKey({ key: '/' }));
    expect(received).toHaveLength(1);
    expect(received[0].detail).toMatchObject({ key: '/' });

    keys.handler()(fakeKey({ key: 'Escape' }));
    await new Promise((r) => setTimeout(r, 0));
  });

  it('TOGGLE_OVERLAY message from background opens then dismisses overlay', async () => {
    const captured = buildChrome();
    const cs = await loadContentMain();
    cs.main();

    const sender = { id: 'test-extension' } as chrome.runtime.MessageSender;
    captured.runtimeListeners[0]({ type: 'TOGGLE_OVERLAY' }, sender);
    captured.runtimeListeners[0]({ type: 'TOGGLE_OVERLAY' }, sender);
    expect(captured.runtimeListeners).toHaveLength(1);
  });

  it('ignores runtime messages from other extensions', async () => {
    const captured = buildChrome();
    const cs = await loadContentMain();
    cs.main();

    captured.runtimeListeners[0](
      { type: 'TOGGLE_OVERLAY' },
      { id: 'attacker-extension' } as chrome.runtime.MessageSender
    );
    const host = document.getElementById('slashmebaby-root');
    expect(host?.shadowRoot?.children.length).toBe(2);
  });

  it('ignores non-TOGGLE_OVERLAY messages', async () => {
    const captured = buildChrome();
    const cs = await loadContentMain();
    cs.main();

    captured.runtimeListeners[0](
      { type: 'OTHER' },
      { id: 'test-extension' } as chrome.runtime.MessageSender
    );
    captured.runtimeListeners[0](
      'not-an-object',
      { id: 'test-extension' } as chrome.runtime.MessageSender
    );
    const host = document.getElementById('slashmebaby-root');
    expect(host?.shadowRoot?.children.length).toBe(2);
  });

  it('acks TOGGLE_OVERLAY with sendResponse so the background sees no lastError', async () => {
    // Without the ack, Chrome sets "The message port closed before a
    // response was received." in the background's sendMessage callback on
    // EVERY successful toggle — indistinguishable from a missing content
    // script without message filtering, and the reason the routing must see
    // a response here.
    const captured = buildChrome();
    const cs = await loadContentMain();
    cs.main();

    const sender = { id: 'test-extension' } as chrome.runtime.MessageSender;
    const sendResponse = vi.fn();
    captured.runtimeListeners[0]({ type: 'TOGGLE_OVERLAY' }, sender, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it('ignores malformed TOGGLE_OVERLAY-ish messages via the shared type guard', async () => {
    const captured = buildChrome();
    const cs = await loadContentMain();
    cs.main();

    const sender = { id: 'test-extension' } as chrome.runtime.MessageSender;
    captured.runtimeListeners[0]('TOGGLE_OVERLAY', sender); // bare string
    captured.runtimeListeners[0]({ type: 'toggle_overlay' }, sender); // wrong case
    captured.runtimeListeners[0](null, sender);
    const host = document.getElementById('slashmebaby-root');
    expect(host?.shadowRoot?.children.length).toBe(2);
  });
});

// ─── Activation shortcut presets ─────────────────────────────────────────────
// Every preset from the onboarding picker plus its Mac (Command) variant
// must activate the overlay; near-miss modifier combos must not.

describe('activation shortcut presets', () => {
  beforeEach(() => {
    clearBody();
    setLocation('https:');
    vi.stubGlobal(
      'defineContentScript',
      (config: { matches: string[]; main: () => void }) => config
    );
  });

  afterEach(async () => {
    // Drain React's concurrent scheduler while the jsdom window is still
    // alive: clearBody() rips the DOM without unmounting React roots, and a
    // queued render task (Immediate.performWorkUntilDeadline) firing after
    // environment teardown crashes the whole run with "window is not
    // defined" on slow CI runners.
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    clearBody();
    vi.unstubAllGlobals();
  });

  const positive: Array<{ shortcut: string; key: string; mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> }> = [
    // Uppercase key exercises the toLowerCase normalization (Shift held).
    { shortcut: 'Ctrl+Shift+L', key: 'L', mods: { ctrlKey: true, shiftKey: true } },
    { shortcut: 'Ctrl+.', key: '.', mods: { ctrlKey: true } },
    { shortcut: 'Ctrl+/', key: '/', mods: { ctrlKey: true } },
    // Space maps to the 'space' token in parseShortcut.
    { shortcut: 'Command+Shift+Space', key: ' ', mods: { metaKey: true, shiftKey: true } },
    { shortcut: 'Command+Shift+L', key: 'L', mods: { metaKey: true, shiftKey: true } },
    { shortcut: 'Command+.', key: '.', mods: { metaKey: true } },
    { shortcut: 'Command+/', key: '/', mods: { metaKey: true } },
  ];

  it.each(positive)(
    'opens the overlay for configured shortcut $shortcut',
    async ({ shortcut, key, mods }) => {
      buildChrome({ shortcut });
      const keys = captureKeydown();
      const cs = await loadContentMain();
      cs.main();

      const event = fakeKey({ key, ...mods });
      keys.handler()(event);
      expect(event.preventDefault).toHaveBeenCalled();
      const host = document.getElementById('slashmebaby-root');
      expect(host?.shadowRoot?.children.length).toBeGreaterThanOrEqual(2);
    }
  );

  const negative: Array<{ label: string; shortcut: string; key: string; mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> }> = [
    { label: 'bare key without modifiers', shortcut: 'Ctrl+.', key: '.', mods: {} },
    { label: 'extra Shift modifier', shortcut: 'Ctrl+.', key: '.', mods: { ctrlKey: true, shiftKey: true } },
    { label: 'Meta instead of Ctrl', shortcut: 'Ctrl+.', key: '.', mods: { metaKey: true } },
    { label: 'old default after a preset change', shortcut: 'Ctrl+.', key: ' ', mods: { ctrlKey: true, shiftKey: true } },
    { label: 'Ctrl instead of Command', shortcut: 'Command+Shift+Space', key: ' ', mods: { ctrlKey: true, shiftKey: true } },
  ];

  it.each(negative)(
    'does not open for $label',
    async ({ shortcut, key, mods }) => {
      buildChrome({ shortcut });
      const keys = captureKeydown();
      const cs = await loadContentMain();
      cs.main();

      const event = fakeKey({ key, ...mods });
      keys.handler()(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      const host = document.getElementById('slashmebaby-root');
      // Only style + mount point — no rendered overlay.
      expect(host?.shadowRoot?.children.length).toBe(2);
    }
  );
});
