// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../hooks/useTheme';

describe('useTheme', () => {
  let listeners: ((e: MediaQueryListEvent) => void)[];
  let matchesDark: boolean;

  beforeEach(() => {
    listeners = [];
    matchesDark = true;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)' ? matchesDark : !matchesDark,
        media: query,
        onchange: null,
        addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners.push(handler);
        },
        removeEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners = listeners.filter((h) => h !== handler);
        },
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    listeners = [];
  });

  it('returns "light" when setting is "light"', () => {
    const { result } = renderHook(() => useTheme('light'));
    expect(result.current).toBe('light');
  });

  it('returns "dark" when setting is "dark"', () => {
    const { result } = renderHook(() => useTheme('dark'));
    expect(result.current).toBe('dark');
  });

  it('returns "dark" when setting is "system" and OS prefers dark', () => {
    matchesDark = true;
    const { result } = renderHook(() => useTheme('system'));
    expect(result.current).toBe('dark');
  });

  it('returns "light" when setting is "system" and OS prefers light', () => {
    matchesDark = false;
    const { result } = renderHook(() => useTheme('system'));
    expect(result.current).toBe('light');
  });

  it('updates when system theme changes', () => {
    matchesDark = true;
    const { result } = renderHook(() => useTheme('system'));
    expect(result.current).toBe('dark');

    // Simulate system theme changing to light
    act(() => {
      for (const listener of listeners) {
        listener({ matches: false } as MediaQueryListEvent);
      }
    });
    expect(result.current).toBe('light');
  });

  it('cleans up listener on unmount', () => {
    matchesDark = true;
    const { unmount } = renderHook(() => useTheme('system'));
    expect(listeners.length).toBe(1);

    unmount();
    expect(listeners.length).toBe(0);
  });

  it('does not add listener when setting is not "system"', () => {
    renderHook(() => useTheme('dark'));
    expect(listeners.length).toBe(0);
  });
});
