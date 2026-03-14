import { useState, useEffect } from 'react';

/**
 * Resolves a theme setting to the actual 'light' or 'dark' value.
 *
 * - 'light' or 'dark' → returned directly
 * - 'system' → resolved from window.matchMedia, with live listener for changes
 */
export function useTheme(setting: 'system' | 'light' | 'dark'): 'light' | 'dark' {
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (setting !== 'system') return setting;
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (setting !== 'system') {
      setResolvedTheme(setting);
      return;
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    // Set initial value
    setResolvedTheme(mql.matches ? 'dark' : 'light');

    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, [setting]);

  return resolvedTheme;
}
