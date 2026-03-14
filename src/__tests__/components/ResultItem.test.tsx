// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultItem } from '../../components/CommandBar/ResultItem';
import type { SearchResultItem } from '../../lib/messaging';

const mockItem: SearchResultItem = {
  id: 'tab-1',
  title: 'Example Page',
  url: 'https://www.example.com/path/to/page',
  icon: 'https://www.example.com/favicon.ico',
  score: 0.9,
};

const mockActionItem: SearchResultItem = {
  id: 'action-1',
  title: 'Close Tab',
  score: 0.8,
};

describe('ResultItem', () => {
  it('renders the item title', () => {
    render(
      <ResultItem item={mockItem} isSelected={false} showFavicons={true} onSelect={() => {}} />
    );
    expect(screen.getByText('Example Page')).toBeTruthy();
  });

  it('renders the hostname from the URL', () => {
    render(
      <ResultItem item={mockItem} isSelected={false} showFavicons={true} onSelect={() => {}} />
    );
    expect(screen.getByText('www.example.com')).toBeTruthy();
  });

  it('does not render URL when item has no url', () => {
    const { container } = render(
      <ResultItem item={mockActionItem} isSelected={false} showFavicons={true} onSelect={() => {}} />
    );
    const urlEl = container.querySelector('.smb-url');
    expect(urlEl).toBeNull();
  });

  it('renders favicon when showFavicons is true and icon exists', () => {
    const { container } = render(
      <ResultItem item={mockItem} isSelected={false} showFavicons={true} onSelect={() => {}} />
    );
    const img = container.querySelector('img.smb-favicon') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://www.example.com/favicon.ico');
  });

  it('does not render favicon when showFavicons is false', () => {
    const { container } = render(
      <ResultItem item={mockItem} isSelected={false} showFavicons={false} onSelect={() => {}} />
    );
    const img = container.querySelector('img.smb-favicon');
    expect(img).toBeNull();
  });

  it('does not render favicon when icon is undefined', () => {
    const { container } = render(
      <ResultItem item={mockActionItem} isSelected={false} showFavicons={true} onSelect={() => {}} />
    );
    const img = container.querySelector('img.smb-favicon');
    expect(img).toBeNull();
  });

  it('adds selected CSS class when isSelected is true', () => {
    const { container } = render(
      <ResultItem item={mockItem} isSelected={true} showFavicons={true} onSelect={() => {}} />
    );
    const el = container.querySelector('.smb-result-item--selected');
    expect(el).toBeTruthy();
  });

  it('does not add selected CSS class when isSelected is false', () => {
    const { container } = render(
      <ResultItem item={mockItem} isSelected={false} showFavicons={true} onSelect={() => {}} />
    );
    const el = container.querySelector('.smb-result-item--selected');
    expect(el).toBeNull();
  });

  it('shows keyboard hint only when selected', () => {
    const { container, rerender } = render(
      <ResultItem item={mockItem} isSelected={false} showFavicons={true} onSelect={() => {}} />
    );
    expect(container.querySelector('.smb-kbd')).toBeNull();

    rerender(
      <ResultItem item={mockItem} isSelected={true} showFavicons={true} onSelect={() => {}} />
    );
    expect(container.querySelector('.smb-kbd')).toBeTruthy();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <ResultItem item={mockItem} isSelected={false} showFavicons={true} onSelect={onSelect} />
    );
    const el = screen.getByRole('option');
    fireEvent.click(el);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('has correct ARIA attributes', () => {
    render(
      <ResultItem item={mockItem} isSelected={true} showFavicons={true} onSelect={() => {}} />
    );
    const el = screen.getByRole('option');
    expect(el.getAttribute('aria-selected')).toBe('true');
    expect(el.getAttribute('aria-label')).toBe('Example Page — https://www.example.com/path/to/page');
  });

  it('has correct ARIA label for items without URL', () => {
    render(
      <ResultItem item={mockActionItem} isSelected={false} showFavicons={true} onSelect={() => {}} />
    );
    const el = screen.getByRole('option');
    expect(el.getAttribute('aria-label')).toBe('Close Tab');
  });
});
