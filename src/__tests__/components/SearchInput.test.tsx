// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchInput } from '../../components/CommandBar/SearchInput';

describe('SearchInput', () => {
  it('renders an input with the correct placeholder', () => {
    render(<SearchInput query="" onQueryChange={() => {}} />);
    const input = screen.getByPlaceholderText('Search tabs, bookmarks, actions...');
    expect(input).toBeTruthy();
  });

  it('renders a controlled input with the given query value', () => {
    render(<SearchInput query="hello" onQueryChange={() => {}} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('hello');
  });

  it('calls onQueryChange when input value changes', () => {
    const onChange = vi.fn();
    render(<SearchInput query="" onQueryChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    // Native input event listener — set value then dispatch
    input.value = 'react';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('react');
  });

  it('has autoFocus set', () => {
    render(<SearchInput query="" onQueryChange={() => {}} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    // React sets the autofocus DOM property, which jsdom reflects as the active element
    expect(document.activeElement).toBe(input);
  });

  it('has autocomplete disabled', () => {
    render(<SearchInput query="" onQueryChange={() => {}} />);
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('renders a search icon SVG', () => {
    const { container } = render(<SearchInput query="" onQueryChange={() => {}} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('has the correct CSS classes', () => {
    const { container } = render(<SearchInput query="" onQueryChange={() => {}} />);
    const wrapper = container.querySelector('.smb-input-wrapper');
    expect(wrapper).toBeTruthy();
    const input = container.querySelector('.smb-input');
    expect(input).toBeTruthy();
  });

  it('has ARIA attributes for combobox role', () => {
    render(<SearchInput query="" onQueryChange={() => {}} />);
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-controls')).toBe('slashmebaby-results');
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });
});
