// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultList } from '../../components/CommandBar/ResultList';
import type { ResultGroup } from '../../lib/messaging';

const mockGroups: ResultGroup[] = [
  {
    category: 'tabs',
    items: [
      { id: 'tab-1', title: 'Gmail', url: 'https://mail.google.com', score: 0.9 },
      { id: 'tab-2', title: 'GitHub', url: 'https://github.com', score: 0.8 },
    ],
  },
  {
    category: 'bookmarks',
    items: [
      { id: 'bm-1', title: 'React Docs', url: 'https://react.dev', score: 0.85 },
    ],
  },
];

describe('ResultList', () => {
  it('renders group headers for each group', () => {
    render(
      <ResultList groups={mockGroups} selectedIndex={-1} showFavicons={true} onSelectItem={() => {}} />
    );
    expect(screen.getByText('Open Tabs')).toBeTruthy();
    expect(screen.getByText('Bookmarks')).toBeTruthy();
  });

  it('renders all result items', () => {
    render(
      <ResultList groups={mockGroups} selectedIndex={-1} showFavicons={true} onSelectItem={() => {}} />
    );
    expect(screen.getByText('Gmail')).toBeTruthy();
    expect(screen.getByText('GitHub')).toBeTruthy();
    expect(screen.getByText('React Docs')).toBeTruthy();
  });

  it('selects the correct item using flat index across groups', () => {
    const { container } = render(
      <ResultList groups={mockGroups} selectedIndex={2} showFavicons={true} onSelectItem={() => {}} />
    );
    // Index 2 is the first item in the "bookmarks" group (React Docs)
    const selectedItems = container.querySelectorAll('.smb-result-item--selected');
    expect(selectedItems.length).toBe(1);
    // The selected item should contain "React Docs"
    expect(selectedItems[0].textContent).toContain('React Docs');
  });

  it('selects first item when selectedIndex is 0', () => {
    const { container } = render(
      <ResultList groups={mockGroups} selectedIndex={0} showFavicons={true} onSelectItem={() => {}} />
    );
    const selectedItems = container.querySelectorAll('.smb-result-item--selected');
    expect(selectedItems.length).toBe(1);
    expect(selectedItems[0].textContent).toContain('Gmail');
  });

  it('calls onSelectItem with the correct item when clicked', () => {
    const onSelectItem = vi.fn();
    render(
      <ResultList groups={mockGroups} selectedIndex={-1} showFavicons={true} onSelectItem={onSelectItem} />
    );
    fireEvent.click(screen.getByText('GitHub'));
    expect(onSelectItem).toHaveBeenCalledWith(mockGroups[0].items[1]);
  });

  it('renders with correct listbox role', () => {
    render(
      <ResultList groups={mockGroups} selectedIndex={0} showFavicons={true} onSelectItem={() => {}} />
    );
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeTruthy();
    expect(listbox.id).toBe('slashmebaby-results');
  });

  it('renders empty when no groups are provided', () => {
    const { container } = render(
      <ResultList groups={[]} selectedIndex={-1} showFavicons={true} onSelectItem={() => {}} />
    );
    const items = container.querySelectorAll('.smb-result-item');
    expect(items.length).toBe(0);
  });

  it('no item is selected when selectedIndex is -1', () => {
    const { container } = render(
      <ResultList groups={mockGroups} selectedIndex={-1} showFavicons={true} onSelectItem={() => {}} />
    );
    const selectedItems = container.querySelectorAll('.smb-result-item--selected');
    expect(selectedItems.length).toBe(0);
  });
});
