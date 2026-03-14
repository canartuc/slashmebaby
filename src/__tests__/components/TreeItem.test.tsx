// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeItem } from '../../components/CommandBar/TreeItem';
import type { TreeItem as TreeItemData } from '../../hooks/useTreeData';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const tabItem: TreeItemData = {
  id: 'tab-101',
  title: 'Gmail',
  url: 'https://mail.google.com',
  icon: 'https://mail.google.com/favicon.ico',
  type: 'tab',
  depth: 1,
  isExpanded: false,
  childCount: 0,
  parentId: 'group-Window 1',
  tabId: 101,
};

const groupItem: TreeItemData = {
  id: 'group-Window 1',
  title: 'Window 1',
  type: 'group',
  depth: 0,
  isExpanded: false,
  childCount: 3,
};

const expandedFolder: TreeItemData = {
  id: 'folder-1',
  title: 'Bookmarks Bar',
  type: 'folder',
  depth: 0,
  isExpanded: true,
  childCount: 5,
};

const bookmarkItem: TreeItemData = {
  id: 'bookmark-10',
  title: 'MDN',
  url: 'https://developer.mozilla.org',
  type: 'bookmark',
  depth: 2,
  isExpanded: false,
  childCount: 0,
  parentId: 'folder-1',
};

const defaultProps = {
  label: 'a',
  isSelected: false,
  showFavicons: true,
  onSelect: vi.fn(),
  searchMode: false,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TreeItem', () => {
  // ─── Label Badge ──────────────────────────────────────────────────────────

  it('renders the label badge', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} label="b" />
    );
    const badge = container.querySelector('.smb-label-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toBe('b');
  });

  it('dims the label badge in search mode', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} searchMode={true} />
    );
    const badge = container.querySelector('.smb-label-badge--dimmed');
    expect(badge).toBeTruthy();
  });

  it('does not dim the label badge when not in search mode', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} searchMode={false} />
    );
    const badge = container.querySelector('.smb-label-badge--dimmed');
    expect(badge).toBeNull();
  });

  // ─── Indentation ─────────────────────────────────────────────────────────

  it('applies correct paddingLeft based on depth', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} />
    );
    const el = container.querySelector('.smb-tree-item') as HTMLElement;
    expect(el.style.paddingLeft).toBe('32px'); // 16 + depth=1 * 16
  });

  it('applies 0 paddingLeft for depth 0', () => {
    const { container } = render(
      <TreeItem item={groupItem} {...defaultProps} />
    );
    const el = container.querySelector('.smb-tree-item') as HTMLElement;
    expect(el.style.paddingLeft).toBe('16px'); // 16 + depth=0 * 16
  });

  it('applies 48px paddingLeft for depth 2', () => {
    const { container } = render(
      <TreeItem item={bookmarkItem} {...defaultProps} />
    );
    const el = container.querySelector('.smb-tree-item') as HTMLElement;
    expect(el.style.paddingLeft).toBe('48px'); // 16 + depth=2 * 16
  });

  // ─── Folder indicator ─────────────────────────────────────────────────────

  it('shows collapsed indicator for collapsed group', () => {
    const { container } = render(
      <TreeItem item={groupItem} {...defaultProps} />
    );
    const indicator = container.querySelector('.smb-folder-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator!.textContent).toBe('\u25B8'); // ▸
  });

  it('shows expanded indicator for expanded folder', () => {
    const { container } = render(
      <TreeItem item={expandedFolder} {...defaultProps} />
    );
    const indicator = container.querySelector('.smb-folder-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator!.textContent).toBe('\u25BE'); // ▾
  });

  it('does not show folder indicator for tab items', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} />
    );
    const indicator = container.querySelector('.smb-folder-indicator');
    expect(indicator).toBeNull();
  });

  it('does not show folder indicator for bookmark items', () => {
    const { container } = render(
      <TreeItem item={bookmarkItem} {...defaultProps} />
    );
    const indicator = container.querySelector('.smb-folder-indicator');
    expect(indicator).toBeNull();
  });

  // ─── Favicon ──────────────────────────────────────────────────────────────

  it('renders favicon when showFavicons is true and icon exists', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} showFavicons={true} />
    );
    const img = container.querySelector('img.smb-favicon') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://mail.google.com/favicon.ico');
  });

  it('does not render favicon when showFavicons is false', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} showFavicons={false} />
    );
    const img = container.querySelector('img.smb-favicon');
    expect(img).toBeNull();
  });

  it('does not render favicon when icon is undefined', () => {
    const { container } = render(
      <TreeItem item={groupItem} {...defaultProps} showFavicons={true} />
    );
    const img = container.querySelector('img.smb-favicon');
    expect(img).toBeNull();
  });

  // ─── Title ────────────────────────────────────────────────────────────────

  it('renders the item title', () => {
    render(<TreeItem item={tabItem} {...defaultProps} />);
    expect(screen.getByText('Gmail')).toBeTruthy();
  });

  // ─── Child count ──────────────────────────────────────────────────────────

  it('shows child count for folder items', () => {
    const { container } = render(
      <TreeItem item={groupItem} {...defaultProps} />
    );
    const count = container.querySelector('.smb-child-count');
    expect(count).toBeTruthy();
    expect(count!.textContent).toBe('(3)');
  });

  it('does not show child count for tab items', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} />
    );
    const count = container.querySelector('.smb-child-count');
    expect(count).toBeNull();
  });

  // ─── Keyboard hint ────────────────────────────────────────────────────────

  it('shows keyboard hint when selected', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} isSelected={true} />
    );
    const kbd = container.querySelector('.smb-kbd');
    expect(kbd).toBeTruthy();
  });

  it('does not show keyboard hint when not selected', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} isSelected={false} />
    );
    const kbd = container.querySelector('.smb-kbd');
    expect(kbd).toBeNull();
  });

  // ─── CSS classes ──────────────────────────────────────────────────────────

  it('adds smb-tree-item--selected when isSelected is true', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} isSelected={true} />
    );
    expect(container.querySelector('.smb-tree-item--selected')).toBeTruthy();
  });

  it('does not add smb-tree-item--selected when isSelected is false', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} isSelected={false} />
    );
    expect(container.querySelector('.smb-tree-item--selected')).toBeNull();
  });

  it('adds smb-tree-item--folder for folder/group types', () => {
    const { container } = render(
      <TreeItem item={groupItem} {...defaultProps} />
    );
    expect(container.querySelector('.smb-tree-item--folder')).toBeTruthy();
  });

  it('does not add smb-tree-item--folder for tab items', () => {
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} />
    );
    expect(container.querySelector('.smb-tree-item--folder')).toBeNull();
  });

  // ─── Click handler via native addEventListener ────────────────────────────

  it('calls onSelect when clicked via native event', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TreeItem item={tabItem} {...defaultProps} onSelect={onSelect} />
    );
    const el = container.querySelector('.smb-tree-item') as HTMLElement;
    el.click(); // Native click, not fireEvent
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // ─── scrollIntoView ──────────────────────────────────────────────────────

  it('calls scrollIntoView when selected', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<TreeItem item={tabItem} {...defaultProps} isSelected={true} />);
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' });
    scrollSpy.mockRestore();
  });

  it('does not call scrollIntoView when not selected', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    scrollSpy.mockClear();
    render(<TreeItem item={tabItem} {...defaultProps} isSelected={false} />);
    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  // ─── ARIA ─────────────────────────────────────────────────────────────────

  it('has role="option"', () => {
    render(<TreeItem item={tabItem} {...defaultProps} />);
    expect(screen.getByRole('option')).toBeTruthy();
  });

  it('has correct aria-selected', () => {
    render(<TreeItem item={tabItem} {...defaultProps} isSelected={true} />);
    const el = screen.getByRole('option');
    expect(el.getAttribute('aria-selected')).toBe('true');
  });

  it('has correct aria-label', () => {
    render(<TreeItem item={tabItem} {...defaultProps} />);
    const el = screen.getByRole('option');
    expect(el.getAttribute('aria-label')).toBe('Gmail');
  });
});
