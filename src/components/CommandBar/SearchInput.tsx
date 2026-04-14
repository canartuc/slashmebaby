import React, { useRef, useEffect } from 'react';

export interface SearchInputProps {
  query: string;
  onQueryChange: (q: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  mode?: 'jump' | 'search' | 'url';
}

const SearchIcon: React.FC = () => (
  <svg
    className="smb-input-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="7" cy="7" r="4.5" />
    <line x1="10.5" y1="10.5" x2="14" y2="14" />
  </svg>
);

export const SearchInput: React.FC<SearchInputProps> = ({ query, onQueryChange, onKeyDown, mode }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Attach native keydown listener directly — React events don't work in Shadow DOM
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !onKeyDown) return;

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Attach native input listener for onChange — React onChange may not work in Shadow DOM
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handler = () => onQueryChange(el.value);
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [onQueryChange]);

  // Focus/blur based on mode
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    if (mode === 'search' || mode === 'url') {
      el.focus();
    } else if (mode === 'jump') {
      el.blur();
    }
  }, [mode]);

  // Auto-focus on mount only — uses initial mode value, intentionally not tracking changes.
  useEffect(() => {
    if (!mode || mode === 'search' || mode === 'url') {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep input text in sync when the query is reset externally (e.g. url mode entry).
  useEffect(() => {
    const el = inputRef.current;
    if (el && el.value !== query) el.value = query;
  }, [query]);

  const isJump = mode === 'jump';
  const wrapperClass = `smb-input-wrapper${isJump ? ' smb-input-wrapper--jump' : ''}`;
  const placeholder =
    mode === 'url'
      ? 'Enter a URL and press Enter'
      : isJump
        ? 'Press / to search'
        : 'Search tabs, bookmarks, actions...';

  return (
    <div className={wrapperClass}>
      <SearchIcon />
      <input
        ref={inputRef}
        className="smb-input"
        type="text"
        defaultValue={query}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        role="combobox"
        aria-label={mode === 'url' ? 'URL to open' : 'Search tabs, bookmarks, and actions'}
        aria-autocomplete="list"
        aria-controls="slashmebaby-results"
        aria-expanded="true"
        readOnly={isJump}
        data-cb-mode={mode}
      />
    </div>
  );
};
