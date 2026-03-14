// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingWizard } from '../../components/Onboarding/OnboardingWizard';
import { ShortcutPicker } from '../../components/Onboarding/ShortcutPicker';
import { TryItStep } from '../../components/Onboarding/TryItStep';
import { NavigationGuide } from '../../components/Onboarding/NavigationGuide';
import { CompletionStep } from '../../components/Onboarding/CompletionStep';

// Stub window.close
const mockClose = vi.fn();
Object.defineProperty(window, 'close', { value: mockClose, writable: true });

describe('ShortcutPicker', () => {
  it('renders all 4 shortcut options', () => {
    const onSelect = vi.fn();
    render(<ShortcutPicker selectedShortcut="Alt+Space" onSelect={onSelect} />);

    expect(screen.getByText('Alt + Space')).toBeTruthy();
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
    render(<ShortcutPicker selectedShortcut="Alt+Space" onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Ctrl + /'));
    expect(onSelect).toHaveBeenCalledWith('Ctrl+/');
  });

  it('renders the step title', () => {
    render(<ShortcutPicker selectedShortcut="Alt+Space" onSelect={vi.fn()} />);
    expect(screen.getByText('Pick your shortcut')).toBeTruthy();
  });
});

describe('TryItStep', () => {
  it('renders the shortcut in the prompt', () => {
    render(<TryItStep shortcut="Ctrl+Shift+L" />);

    expect(screen.getByText('Ctrl + Shift + L')).toBeTruthy();
  });

  it('renders the animated bar placeholder', () => {
    const { container } = render(<TryItStep shortcut="Alt+Space" />);

    const bar = container.querySelector('.smb-onboarding-try-it-bar');
    expect(bar).toBeTruthy();
  });

  it('renders the step title', () => {
    render(<TryItStep shortcut="Alt+Space" />);
    expect(screen.getByText('Try it out!')).toBeTruthy();
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

  it('renders key badges', () => {
    render(<NavigationGuide />);

    expect(screen.getByText('Tab')).toBeTruthy();
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

  it('renders 4 progress dots', async () => {
    const { container } = render(<OnboardingWizard />);

    await waitFor(() => {
      const dots = container.querySelectorAll('.smb-onboarding-dot');
      expect(dots.length).toBe(4);
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
    expect(screen.getByText("You're all set!")).toBeTruthy();
  });

  it('marks onboarding as completed when Start Browsing is clicked', async () => {
    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText('Pick your shortcut')).toBeTruthy();
    });

    // Advance to step 3
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    fireEvent.click(screen.getByText('Start Browsing'));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { onboarding: { completedStep: 4, completed: true } },
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
        cb({ onboarding: { completedStep: 3, completed: false } });
      }
    );

    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.getByText("You're all set!")).toBeTruthy();
    });

    expect(screen.queryByText('Next')).toBeNull();
  });
});
