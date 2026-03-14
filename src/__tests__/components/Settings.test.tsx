// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShortcutSetting } from '../../components/Settings/ShortcutSetting';
import { PositionSetting } from '../../components/Settings/PositionSetting';
import { ThemeSetting } from '../../components/Settings/ThemeSetting';
import { SearchSources } from '../../components/Settings/SearchSources';
import { SettingsPage } from '../../components/Settings/SettingsPage';
import { DEFAULT_SETTINGS } from '../../lib/messaging';
import type { UserSettings } from '../../lib/messaging';

// Mock matchMedia for useTheme
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

describe('ShortcutSetting', () => {
  it('renders all 4 shortcut options', () => {
    const onUpdate = vi.fn();
    render(<ShortcutSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    expect(screen.getByText('Ctrl + Shift + Space')).toBeTruthy();
    expect(screen.getByText('Ctrl + Shift + L')).toBeTruthy();
    expect(screen.getByText('Ctrl + .')).toBeTruthy();
    expect(screen.getByText('Ctrl + /')).toBeTruthy();
  });

  it('shows the current shortcut as selected', () => {
    const onUpdate = vi.fn();
    render(<ShortcutSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const selected = radios.find((r) => r.checked);
    expect(selected?.value).toBe('Ctrl+Shift+Space');
  });

  it('calls onUpdate when a different shortcut is selected', () => {
    const onUpdate = vi.fn();
    render(<ShortcutSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const ctrlDot = radios.find((r) => r.value === 'Ctrl+.');
    fireEvent.click(ctrlDot!);

    expect(onUpdate).toHaveBeenCalledWith('shortcut', 'Ctrl+.');
  });

  it('renders section title', () => {
    const onUpdate = vi.fn();
    render(<ShortcutSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);
    expect(screen.getByText('Keyboard Shortcut')).toBeTruthy();
  });
});

describe('PositionSetting', () => {
  it('renders all 3 position options', () => {
    const onUpdate = vi.fn();
    render(<PositionSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    expect(screen.getByText('Center')).toBeTruthy();
    expect(screen.getByText('Top')).toBeTruthy();
    expect(screen.getByText('Bottom')).toBeTruthy();
  });

  it('shows the current position as selected', () => {
    const onUpdate = vi.fn();
    render(<PositionSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const selected = radios.find((r) => r.checked);
    expect(selected?.value).toBe('center');
  });

  it('calls onUpdate when a different position is selected', () => {
    const onUpdate = vi.fn();
    render(<PositionSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const topRadio = radios.find((r) => r.value === 'top');
    fireEvent.click(topRadio!);

    expect(onUpdate).toHaveBeenCalledWith('position', 'top');
  });

  it('renders visual preview with position bar', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <PositionSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />
    );

    const bars = container.querySelectorAll('.smb-settings-position-bar');
    expect(bars.length).toBe(3);
  });

  it('highlights the selected position preview', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <PositionSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />
    );

    const selectedPreview = container.querySelector('.smb-settings-position-preview--selected');
    expect(selectedPreview).toBeTruthy();
  });
});

describe('ThemeSetting', () => {
  it('renders all 3 theme options', () => {
    const onUpdate = vi.fn();
    render(<ThemeSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  it('shows the current theme as selected', () => {
    const onUpdate = vi.fn();
    render(<ThemeSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const selected = radios.find((r) => r.checked);
    expect(selected?.value).toBe('system');
  });

  it('calls onUpdate when a different theme is selected', () => {
    const onUpdate = vi.fn();
    render(<ThemeSetting settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const darkRadio = radios.find((r) => r.value === 'dark');
    fireEvent.click(darkRadio!);

    expect(onUpdate).toHaveBeenCalledWith('theme', 'dark');
  });
});

describe('SearchSources', () => {
  it('renders all 3 source toggles', () => {
    const onUpdate = vi.fn();
    render(<SearchSources settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    expect(screen.getByText('Tabs')).toBeTruthy();
    expect(screen.getByText('Bookmarks')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
  });

  it('renders toggle switches with correct aria-checked state', () => {
    const onUpdate = vi.fn();
    render(<SearchSources settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(3);

    // All are on by default
    switches.forEach((sw) => {
      expect(sw.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('calls onUpdate when toggling a source off', () => {
    const onUpdate = vi.fn();
    render(<SearchSources settings={DEFAULT_SETTINGS} onUpdate={onUpdate} />);

    const switches = screen.getAllByRole('switch');
    // Click the Bookmarks toggle (second one)
    fireEvent.click(switches[1]);

    expect(onUpdate).toHaveBeenCalledWith('searchSources', {
      tabs: true,
      bookmarks: false,
      history: true,
    });
  });

  it('shows off state for disabled sources', () => {
    const onUpdate = vi.fn();
    const settings: UserSettings = {
      ...DEFAULT_SETTINGS,
      searchSources: { tabs: true, bookmarks: false, history: true },
    };
    render(<SearchSources settings={settings} onUpdate={onUpdate} />);

    const switches = screen.getAllByRole('switch');
    expect(switches[0].getAttribute('aria-checked')).toBe('true');
    expect(switches[1].getAttribute('aria-checked')).toBe('false');
    expect(switches[2].getAttribute('aria-checked')).toBe('true');
  });
});

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.mocked(chrome.storage.sync.get).mockReset();
    vi.mocked(chrome.storage.sync.set).mockReset();

    vi.mocked(chrome.storage.sync.get).mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => {
        cb({ settings: DEFAULT_SETTINGS });
      }
    );

    vi.mocked(chrome.storage.sync.set).mockImplementation(
      (_items: unknown, cb?: () => void) => {
        cb?.();
      }
    );
  });

  it('renders the page title', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('SlashMeBaby Settings')).toBeTruthy();
    });
  });

  it('renders all setting sections after loading', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcut')).toBeTruthy();
      expect(screen.getByText('Command Bar Position')).toBeTruthy();
      expect(screen.getByText('Theme')).toBeTruthy();
      expect(screen.getByText('Search Sources')).toBeTruthy();
    });
  });

  it('shows loading state initially when storage is slow', () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation(() => {
      // Don't call callback — stay in loading state
    });

    render(<SettingsPage />);
    expect(screen.getByText('Loading settings...')).toBeTruthy();
  });

  it('updates settings when a control is changed', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcut')).toBeTruthy();
    });

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const darkRadio = radios.find((r) => r.value === 'dark');
    fireEvent.click(darkRadio!);

    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      { settings: expect.objectContaining({ theme: 'dark' }) },
      expect.any(Function)
    );
  });
});
