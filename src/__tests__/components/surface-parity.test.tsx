// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { CommandBar } from '../../components/CommandBar/CommandBar';
import { Popup } from '../../entrypoints/popup/Popup';
import { mockRawDataMessages, findSentMessage } from '../helpers/mock-palette-messages';
import type { MockPaletteOptions } from '../helpers/mock-palette-messages';
import { routePaletteKey } from '../../lib/palette-keys';

// ─── Surface parity suite ───────────────────────────────────────────────────
// The popup and the in-page overlay are ONE palette in two window frames.
// Every test here renders BOTH surfaces from the same fixture and asserts
// identical behavior. Any future divergence fails a named parity test.
//
// Channel note: in jsdom the overlay CommandBar attaches its smb-keydown
// listener to the document (ShadowRoot fallback) — the same channel
// usePopupKeySource dispatches on. The popup is driven by NATIVE keydown
// (exercising usePopupKeySource + routePaletteKey); the overlay by the
// content-script contract (smb-keydown CustomEvents).

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockClose = vi.fn();
Object.defineProperty(window, 'close', { value: mockClose, writable: true });

interface SurfaceState {
  placeholder: string;
  readOnly: boolean;
  tabGridLabels: string[];
  treeBadges: string[];
  headers: string[];
}

function collectSurfaceState(container: HTMLElement): SurfaceState {
  const input = container.querySelector('.smb-input') as HTMLInputElement | null;
  return {
    placeholder: input?.placeholder ?? '',
    readOnly: input?.readOnly ?? false,
    tabGridLabels: Array.from(container.querySelectorAll('.smb-tab-col-label')).map(
      (el) => el.textContent ?? ''
    ),
    treeBadges: Array.from(
      container.querySelectorAll('.smb-tree-item .smb-label-badge')
    ).map((el) => el.textContent ?? ''),
    headers: Array.from(container.querySelectorAll('.smb-group-header')).map(
      (el) => el.textContent ?? ''
    ),
  };
}

type Surface = 'overlay' | 'popup';

function sendKey(
  surface: Surface,
  key: string,
  shiftKey = false,
  mods: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {}
) {
  const { ctrlKey = false, metaKey = false, altKey = false } = mods;
  act(() => {
    if (surface === 'popup') {
      fireEvent.keyDown(document, { key, shiftKey, ctrlKey, metaKey, altKey });
    } else {
      // Mirror the content-script forwarder faithfully: run the SHARED
      // routing layer first (so overlay-leg parity exercises
      // routePaletteKey's pass/forward/normalization decisions too), then
      // dispatch the normalized CustomEvent the overlay consumes.
      const decision = routePaletteKey(
        { key, shiftKey, ctrlKey, metaKey, altKey } as KeyboardEvent,
        { activeElement: document.activeElement }
      );
      if (decision.kind === 'forward') {
        document.dispatchEvent(
          new CustomEvent('smb-keydown', {
            detail: { key: decision.key, shiftKey: decision.shiftKey },
          })
        );
      }
    }
  });
}

function countSentMessages(type: string): number {
  return vi
    .mocked(chrome.runtime.sendMessage)
    .mock.calls.filter((c) => (c[0] as unknown as { type: string }).type === type).length;
}

async function renderSurface(surface: Surface) {
  const view =
    surface === 'popup'
      ? render(<Popup />)
      : render(<CommandBar onDismiss={() => {}} />);
  await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());
  return view;
}

/** Runs `scenario` against one surface and returns whatever it collects. */
async function runOn<T>(
  surface: Surface,
  fixture: MockPaletteOptions,
  scenario: (ctx: {
    container: HTMLElement;
    key: (
      k: string,
      shift?: boolean,
      mods?: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }
    ) => void;
  }) => Promise<T>
): Promise<T> {
  mockRawDataMessages(fixture);
  mockClose.mockReset();
  const view = await renderSurface(surface);
  try {
    return await scenario({
      container: view.container,
      key: (k, shift = false, mods = {}) => sendKey(surface, k, shift, mods),
    });
  } finally {
    view.unmount();
  }
}

/** Runs the same scenario on both surfaces and returns [overlay, popup]. */
async function runOnBoth<T>(
  fixture: MockPaletteOptions,
  scenario: Parameters<typeof runOn<T>>[2]
): Promise<[T, T]> {
  const overlay = await runOn<T>('overlay', fixture, scenario);
  const popup = await runOn<T>('popup', fixture, scenario);
  return [overlay, popup];
}

const PINNED_FIXTURE: MockPaletteOptions = { withPinnedTab: true };

describe('surface parity — popup is the overlay in a different frame', () => {
  beforeEach(() => {
    mockClose.mockReset();
  });

  it('popup and overlay render identical entry state: jump placeholder and read-only input', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container }) => {
      const state = collectSurfaceState(container);
      return { placeholder: state.placeholder, readOnly: state.readOnly };
    });
    expect(popup).toEqual(overlay);
    expect(overlay.readOnly).toBe(true);
    expect(overlay.placeholder).toBe('Press / to search');
  });

  it('popup and overlay render identical tab-grid label sets', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container }) =>
      collectSurfaceState(container).tabGridLabels
    );
    expect(popup).toEqual(overlay);
    expect(overlay.length).toBeGreaterThan(0);
  });

  it('popup and overlay render identical bookmark tree-row label badges', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container }) =>
      collectSurfaceState(container).treeBadges
    );
    expect(popup).toEqual(overlay);
    expect(overlay.length).toBeGreaterThan(0);
  });

  it('popup and overlay render identical section header sequences', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container }) =>
      collectSurfaceState(container).headers
    );
    expect(popup).toEqual(overlay);
    expect(overlay).toContain('Pinned');
    expect(overlay).toContain('Open Tabs');
  });

  it('a digit key sends the same SWITCH_TAB pinned-tab message from both surfaces, exactly once', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ key }) => {
      key('1');
      await waitFor(() => expect(findSentMessage('SWITCH_TAB')).toBeTruthy());
      // Exactly one — a leaked duplicate listener would double-fire and
      // still satisfy a first-match assertion.
      expect(countSentMessages('SWITCH_TAB')).toBe(1);
      return (findSentMessage('SWITCH_TAB')?.[0] as unknown as { payload: unknown }).payload;
    });
    expect(popup).toEqual(overlay);
    expect(overlay).toEqual({ tabId: 9 });
  });

  it("'/' toggles into typed search and back identically on both surfaces", async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container, key }) => {
      key('/');
      await waitFor(() =>
        expect(collectSurfaceState(container).readOnly).toBe(false)
      );
      const searchState = collectSurfaceState(container);
      key('/');
      await waitFor(() =>
        expect(collectSurfaceState(container).readOnly).toBe(true)
      );
      const backState = collectSurfaceState(container);
      return {
        search: { placeholder: searchState.placeholder, readOnly: searchState.readOnly },
        back: { placeholder: backState.placeholder, readOnly: backState.readOnly },
      };
    });
    expect(popup).toEqual(overlay);
    expect(overlay.search.placeholder).toBe('Search tabs, bookmarks, actions...');
  });

  it("'/' then '>' enters action mode with identical Actions rows on both surfaces", async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container, key }) => {
      key('/');
      const input = await waitFor(() => {
        const el = container.querySelector('.smb-input') as HTMLInputElement;
        expect(el.readOnly).toBe(false);
        return el;
      });
      fireEvent.input(input, { target: { value: '>' } });
      await waitFor(() => expect(screen.getByText('Close Tab')).toBeTruthy());
      const state = collectSurfaceState(container);
      const rows = Array.from(
        container.querySelectorAll('.smb-tree-item .smb-title')
      ).map((el) => el.textContent ?? '');
      return { headers: state.headers, rows };
    });
    expect(popup).toEqual(overlay);
    expect(overlay.rows).toEqual(['Close Tab', 'Pin Tab', 'New Tab']);
  });

  it('Tab and Shift+Tab land on the same section-jump targets on both surfaces', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container, key }) => {
      const selected = () =>
        container.querySelector('.smb-tree-item--selected')?.textContent ?? '';
      const sequence: string[] = [];
      key('Tab');
      await waitFor(() => expect(selected()).not.toBe(''));
      sequence.push(selected());
      key('Tab');
      await waitFor(() => expect(selected()).not.toBe(sequence[0]));
      sequence.push(selected());
      key('Tab', true);
      await waitFor(() => expect(selected()).not.toBe(sequence[1]));
      sequence.push(selected());
      return sequence;
    });
    expect(popup).toEqual(overlay);
  });

  it('an action key dispatches an identical EXECUTE_ACTION message from both surfaces, exactly once', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ key }) => {
      key('c');
      await waitFor(() => expect(findSentMessage('EXECUTE_ACTION')).toBeTruthy());
      expect(countSentMessages('EXECUTE_ACTION')).toBe(1);
      return (findSentMessage('EXECUTE_ACTION')?.[0] as unknown as { payload: unknown }).payload;
    });
    expect(popup).toEqual(overlay);
    expect(overlay).toEqual({ actionId: 'action-close-tab' });
  });

  it('popup and overlay render identical sleep badges on discarded tab rows', async () => {
    const fixture: MockPaletteOptions = { withDiscardedTab: true };
    const [overlay, popup] = await runOnBoth(fixture, async ({ container }) => {
      await waitFor(() =>
        expect(container.querySelectorAll('.smb-sleep-badge').length).toBeGreaterThan(0)
      );
      return Array.from(container.querySelectorAll('.smb-tab-col-item'))
        .filter((row) => row.querySelector('.smb-sleep-badge'))
        .map((row) => row.querySelector('.smb-tab-col-title')?.textContent ?? '');
    });
    expect(popup).toEqual(overlay);
    expect(overlay).toEqual(['Sleeping Docs']);
  });

  it('modifier chords never trigger palette actions on either surface', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container, key }) => {
      // Ctrl+C / Cmd+C must be inert (browser copy chords, not palette keys).
      // Through key() both surfaces exercise their REAL routing path — the
      // overlay leg runs routePaletteKey's chord guard, not a bare no-op.
      key('c', false, { ctrlKey: true });
      key('c', false, { metaKey: true });
      await new Promise((r) => setTimeout(r, 50));
      return {
        executed: countSentMessages('EXECUTE_ACTION'),
        rendered: !!container.querySelector('.smb-container'),
      };
    });
    expect(popup).toEqual(overlay);
    expect(overlay).toEqual({ executed: 0, rendered: true });
  });

  it('two-char labels appear and activate the same target on both surfaces', async () => {
    // 2 default tabs + 14 extra tabs + 2 top-level folders = 18 labeled
    // items > the 14-char pool → two-char combos exist.
    const fixture: MockPaletteOptions = { extraTabs: 14 };
    const [overlay, popup] = await runOnBoth(fixture, async ({ container, key }) => {
      let combo = '';
      await waitFor(() => {
        const badges = Array.from(
          container.querySelectorAll('.smb-label-badge, .smb-tab-col-label')
        ).map((el) => el.textContent ?? '');
        const twoChar = badges.find((b) => b.length === 2);
        expect(twoChar).toBeTruthy();
        combo = twoChar as string;
      });
      key(combo[0]);
      // The pending two-char prefix is React state — let it commit before
      // the second character arrives (real keystrokes are frames apart).
      await act(async () => {});
      key(combo[1]);
      await waitFor(() => {
        expect(
          findSentMessage('SWITCH_TAB') ??
            findSentMessage('NAVIGATE') ??
            findSentMessage('OPEN_NEW_TAB')
        ).toBeTruthy();
      });
      const call =
        findSentMessage('SWITCH_TAB') ??
        findSentMessage('NAVIGATE') ??
        findSentMessage('OPEN_NEW_TAB');
      return { combo, message: call?.[0] };
    });
    expect(popup).toEqual(overlay);
  });

  it('Backspace is inert on both surfaces (never closes, never navigates)', async () => {
    const [overlay, popup] = await runOnBoth(PINNED_FIXTURE, async ({ container, key }) => {
      key('Backspace');
      // Give any (wrong) dismissal a chance to run.
      await new Promise((r) => setTimeout(r, 50));
      return {
        stillRendered: !!container.querySelector('.smb-container'),
        closed: mockClose.mock.calls.length > 0,
        acted: !!(findSentMessage('SWITCH_TAB') ?? findSentMessage('NAVIGATE')),
      };
    });
    expect(popup).toEqual(overlay);
    expect(overlay).toEqual({ stillRendered: true, closed: false, acted: false });
  });
});
