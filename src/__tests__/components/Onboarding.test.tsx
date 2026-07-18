// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingWizard } from '../../components/Onboarding/OnboardingWizard';
import { ShortcutPicker } from '../../components/Onboarding/ShortcutPicker';
import { TryItStep } from '../../components/Onboarding/TryItStep';
import { NavigationGuide } from '../../components/Onboarding/NavigationGuide';
import { CompletionStep } from '../../components/Onboarding/CompletionStep';
import { PinToToolbarStep } from '../../components/Onboarding/PinToToolbarStep';

// Stub window.close
const mockClose = vi.fn();
Object.defineProperty(window, 'close', { value: mockClose, writable: true });

describe('ShortcutPicker', () => {
  it('renders all 4 shortcut options', () => {
    const onSelect = vi.fn();
    render(<ShortcutPicker selectedShortcut="Ctrl+Shift+Space" onSelect={onSelect} />);

    expect(screen.getByText('Ctrl + Shift + Space')).toBeTruthy();
    expect(screen.getByText('Ctrl + Shift + L')).toBeTruthy();
    expect(screen.getByText('Ctrl + .')).toBeTruthy();
    expect(screen.getByText('Ctrl + /')).toBeTruthy();
  });

  it('highlights the selected shortcut', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ShortcutPicker selectedShortcut="Ctrl+." onSelect={onSelect} />
    );

    const selected = container.querySelector('.smb-onboarding-shortcut-option--selected');
    expect(selected).toBeTruthy();
    expect(selected?.textContent).toContain('Ctrl + .');
  });

  it('calls onSelect when an option is clicked', () => {
    const onSelect = vi.fn();
    render(<ShortcutPicker selectedShortcut="Ctrl+Shift+Space" onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Ctrl + /'));
    expect(onSelect).toHaveBeenCalledWith('Ctrl+/');
  });

  it('renders the step title', () => {
    render(<ShortcutPicker selectedShortcut="Ctrl+Shift+Space" onSelect={vi.fn()} />);
    expect(screen.getByText('Pick your shortcut')).toBeTruthy();
  });
});

describe('TryItStep', () => {
  it('renders the shortcut in the prompt', () => {
    render(<TryItStep shortcut="Ctrl+Shift+L" />);

    expect(screen.getByText('Ctrl + Shift + L')).toBeTruthy();
  });

  it('renders the animated bar placeholder', () => {
    const { container } = render(<TryItStep shortcut="Ctrl+Shift+Space" />);

    const bar = container.querySelector('.smb-onboarding-try-it-bar');
    expect(bar).toBeTruthy();
  });

  it('renders the step title', () => {
    render(<TryItStep shortcut="Ctrl+Shift+Space" />);
    expect(screen.getByText('Try it out!')).toBeTruthy();
  });

  it('explains the popup fallback on restricted pages', () => {
    render(<TryItStep shortcut="Ctrl+Shift+Space" />);
    expect(screen.getByText(/opens the palette in a toolbar popup/)).toBeTruthy();
  });

  it('asks the user to try it on a regular website tab', () => {
    render(<TryItStep shortcut="Ctrl+Shift+Space" />);
    expect(screen.getByText(/switch to a regular website/i)).toBeTruthy();
  });
});

describe('PinToToolbarStep', () => {
  // The installed @types/chrome types getUserSettings in its callback form,
  // so the promise-form mock needs a cast.
  const getUserSettingsMock = () =>
    chrome.action.getUserSettings as unknown as ReturnType<typeof vi.fn>;

  function mockPinState(isOnToolbar: boolean) {
    getUserSettingsMock().mockImplementation(() => Promise.resolve({ isOnToolbar }));
  }

  beforeEach(() => {
    getUserSettingsMock().mockReset();
    mockPinState(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('renders the step title', () => {
    render(<PinToToolbarStep />);
    expect(screen.getByText('Pin it to your toolbar')).toBeTruthy();
  });

  it('renders the extension icon', () => {
    render(<PinToToolbarStep />);
    expect(screen.getByAltText('SlashMeBaby icon')).toBeTruthy();
  });

  it('shows Chrome pin instructions by default', () => {
    render(<PinToToolbarStep />);
    expect(screen.getByText(/puzzle-piece Extensions button/)).toBeTruthy();
    expect(screen.getByText(/pushpin/)).toBeTruthy();
  });

  it('shows Firefox pin instructions on the firefox build', () => {
    vi.stubEnv('BROWSER', 'firefox');
    render(<PinToToolbarStep />);
    expect(screen.getByText(/Pin to Toolbar/)).toBeTruthy();
    expect(screen.getByText(/Extensions panel/)).toBeTruthy();
  });

  it('shows a live Pinned confirmation when the icon is on the toolbar', async () => {
    mockPinState(true);
    render(<PinToToolbarStep />);
    await waitFor(() => {
      expect(screen.getByText(/Pinned/)).toBeTruthy();
    });
  });

  it('does not show the Pinned confirmation when the icon is not on the toolbar', async () => {
    render(<PinToToolbarStep />);
    await waitFor(() => {
      expect(getUserSettingsMock()).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Pinned/)).toBeNull();
  });

  it('renders without a pinned status when getUserSettings is unsupported', () => {
    const chromeWithAction = chrome as unknown as { action?: unknown };
    const saved = chromeWithAction.action;
    delete chromeWithAction.action;
    try {
      render(<PinToToolbarStep />);
      expect(screen.getByText(/puzzle-piece Extensions button/)).toBeTruthy();
      expect(screen.queryByText(/Pinned/)).toBeNull();
    } finally {
      chromeWithAction.action = saved;
    }
  });

  it('stops polling getUserSettings after unmount', async () => {
    vi.useFakeTimers();
    const { unmount } = render(<PinToToolbarStep />);
    await vi.advanceTimersByTimeAsync(4000);
    const callsBeforeUnmount = getUserSettingsMock().mock.calls.length;
    expect(callsBeforeUnmount).toBeGreaterThan(1);
    unmount();
    await vi.advanceTimersByTimeAsync(6000);
    expect(getUserSettingsMock().mock.calls.length).toBe(callsBeforeUnmount);
  });
});

describe('NavigationGuide', () => {
  it('renders all keyboard navigation hints', () => {
    render(<NavigationGuide />);

    expect(screen.getByText('Move between results')).toBeTruthy();
    expect(screen.getByText('Jump to next group')).toBeTruthy();
    expect(screen.getByText('Open selected result')).toBeTruthy();
    expect(screen.getByText('Close the command bar')).toBeTruthy();
  });

  it('lists Shift+Tab for jumping to the previous group', () => {
    render(<NavigationGuide />);
    expect(screen.getByText('Jump to previous group')).toBeTruthy();
    expect(screen.getByText('Shift')).toBeTruthy();
  });

  it('renders key badges', () => {
    render(<NavigationGuide />);

    // 'Tab' appears twice: the Tab row and the Shift+Tab row.
    expect(screen.getAllByText('Tab')).toHaveLength(2);
    expect(screen.getByText('Enter')).toBeTruthy();
    expect(screen.getByText('Esc')).toBeTruthy();
  });

  it('renders the step title', () => {
    render(<NavigationGuide />);
    expect(screen.getByText('Navigate like a pro')).toBeTruthy();
  });
});

describe('CompletionStep', () => {
  it('renders pro tips', () => {
    render(<CompletionStep onComplete={vi.fn()} />);

    expect(screen.getByText('Use the > prefix')).toBeTruthy();
    expect(screen.getByText('Recency matters')).toBeTruthy();
    expect(screen.getByText('Customize in settings')).toBeTruthy();
  });

  it('renders the Start Browsing button', () => {
    render(<CompletionStep onComplete={vi.fn()} />);

    expect(screen.getByText('Start Browsing')).toBeTruthy();
  });

  it('calls onComplete when Start Browsing is clicked', () => {
    const onComplete = vi.fn();
    render(<CompletionStep onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Start Browsing'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders the step title', () => {
    render(<CompletionStep onComplete={vi.fn()} />);
    expect(screen.getByText("You're all set!")).toBeTruthy();
  });
});

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.mocked(chrome.storage.local.get).mockReset();
    vi.mocked(chrome.storage.local.set).mockReset();
    vi.mocked(chrome.storage.sync.get).mockReset();
    vi.mocked(chrome.storage.sync.set).mockReset();
    mockClose.mockReset();

    // Default: fresh onboarding state
    vi.mocked(chrome.storage.local.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({});
      }
    );

    vi.mocked(chrome.storage.local.set).mockImplementation(
      (_items: unknown, cb?: () => void) => {
        cb?.();
      }
    );

    vi.mocked(chrome.storage.sync.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({});
      }
    );

    vi.mocked(chrome.storage.sync.set).mockImplementation(
      (_items: unknown, cb?: () => void) => {
        cb?.();
      }
    );
  });

  it('renders the wizard title', async () => {
    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('SlashMeBaby')).toBeTruthy();
    });
  });

  it('renders 5 progress dots', async () => {
    const { container } = render(<OnboardingWizard />);

    await waitFor(() => {
      const dots = container.querySelectorAll('.smb-onboarding-dot');
      expect(dots.length).toBe(5);
    });
  });

  it('starts on step 0 (ShortcutPicker) for fresh install', async () => {
    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Pick your shortcut')).toBeTruthy();
    });
  });

  it('advances to step 1 (TryItStep) when Next is clicked', async () => {
    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Pick your shortcut')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Try it out!')).toBeTruthy();
  });

  it('saves progress when advancing steps', async () => {
    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Pick your shortcut')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Next'));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { onboarding: { completedStep: 1, completed: false } },
      expect.any(Function)
    );
  });

  it('advances through all steps to completion', async () => {
    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Pick your shortcut')).toBeTruthy();
    });

    // Step 0 -> 1
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Try it out!')).toBeTruthy();

    // Step 1 -> 2
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Navigate like a pro')).toBeTruthy();

    // Step 2 -> 3
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Pin it to your toolbar')).toBeTruthy();

    // Step 3 -> 4
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText("You're all set!")).toBeTruthy();
  });

  it('marks onboarding as completed when Start Browsing is clicked', async () => {
    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Pick your shortcut')).toBeTruthy();
    });

    // Advance to step 4
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    fireEvent.click(screen.getByText('Start Browsing'));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { onboarding: { completedStep: 5, completed: true } },
      expect.any(Function)
    );
  });

  it('resumes from saved step', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({ onboarding: { completedStep: 2, completed: false } });
      }
    );

    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Navigate like a pro')).toBeTruthy();
    });
  });

  it('shows loading state while fetching onboarding state', () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(() => {
      // Don't call callback — stay loading
    });

    render(<OnboardingWizard />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('does not show Next button on the last step', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({ onboarding: { completedStep: 4, completed: false } });
      }
    );

    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText("You're all set!")).toBeTruthy();
    });

    expect(screen.queryByText('Next')).toBeNull();
  });

  it('shows the pin step when resuming at step 3', async () => {
    // Also covers users who saved completedStep 3 under the 4-step wizard:
    // they resume onto the new pin step instead of the completion screen.
    vi.mocked(chrome.storage.local.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({ onboarding: { completedStep: 3, completed: false } });
      }
    );

    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Pin it to your toolbar')).toBeTruthy();
    });
  });

  it('falls back to the completion step for out-of-range saved steps', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({ onboarding: { completedStep: 9, completed: false } });
      }
    );

    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText("You're all set!")).toBeTruthy();
    });
  });
});
