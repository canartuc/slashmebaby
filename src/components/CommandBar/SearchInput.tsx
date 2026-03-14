import React from 'react';

export interface SearchInputProps {
  query: string;
  onQueryChange: (q: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
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

export const SearchInput: React.FC<SearchInputProps> = ({ query, onQueryChange, onKeyDown }) => {
  return (
    <div className="smb-input-wrapper">
      <SearchIcon />
      <input
        className="smb-input"
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search tabs, bookmarks, actions..."
        autoFocus
        autoComplete="off"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="slashmebaby-results"
        aria-expanded="true"
      />
    </div>
  );
};
