// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { Favicon } from '../../components/CommandBar/Favicon';

describe('Favicon', () => {
  it('renders an img with no-referrer for https icons', () => {
    const { container } = render(<Favicon src="https://icons.example.com/f.ico" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('https://icons.example.com/f.ico');
    expect(img!.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img!.getAttribute('loading')).toBe('lazy');
    expect(img!.getAttribute('decoding')).toBe('async');
    expect(img!.getAttribute('alt')).toBe('');
  });

  it('renders data: icons', () => {
    const { container } = render(
      <Favicon src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEA" />
    );
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('renders nothing for javascript: URLs', () => {
    const { container } = render(<Favicon src="javascript:alert(1)" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing for chrome-extension: URLs', () => {
    const { container } = render(<Favicon src="chrome-extension://abc/fav.png" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing for file: URLs', () => {
    const { container } = render(<Favicon src="file:///home/me/evil.png" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing when src is undefined or empty', () => {
    const { container: c1 } = render(<Favicon />);
    expect(c1.querySelector('img')).toBeNull();
    const { container: c2 } = render(<Favicon src="" />);
    expect(c2.querySelector('img')).toBeNull();
  });

  it('honours the size prop', () => {
    const { container } = render(
      <Favicon src="https://icons.example.com/f.ico" size={32} />
    );
    const img = container.querySelector('img');
    expect(img!.getAttribute('width')).toBe('32');
    expect(img!.getAttribute('height')).toBe('32');
  });
});

describe('Favicon fallback chain', () => {
  beforeEach(() => {
    // The `chrome` global (src/__tests__/setup.ts) is a bare `vi.fn()`, not a
    // spy on a real method, so `restoreAllMocks()` alone leaves its recorded
    // `.mock.calls` intact across tests — `clearAllMocks()` resets them too.
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('renders a globe svg (not an img) after the proxied load also fails', async () => {
    // Direct load fails → ask background → returns null → globe.
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({ dataUrl: null });
    const { container } = render(<Favicon src="https://a.com/f.ico" />);
    const img = container.querySelector('img')!;
    fireEvent.error(img);
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
      expect(container.querySelector('img')).toBeNull();
    });
  });

  it('swaps to the proxied data: url when the direct load fails', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({
      dataUrl: 'data:image/png;base64,AP8=',
    });
    const { container } = render(<Favicon src="https://a.com/f.ico" />);
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => {
      expect(container.querySelector('img')!.getAttribute('src')).toBe(
        'data:image/png;base64,AP8='
      );
    });
  });

  it('shows the globe if the proxied data: url also errors', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({
      dataUrl: 'data:image/png;base64,AP8=',
    });
    const { container } = render(<Favicon src="https://a.com/f.ico" />);
    fireEvent.error(container.querySelector('img')!); // stage 0 → 1
    await waitFor(() =>
      expect(container.querySelector('img')!.getAttribute('src')).toContain('data:')
    );
    fireEvent.error(container.querySelector('img')!); // stage 1 → 2
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
      expect(container.querySelector('img')).toBeNull();
    });
  });

  it('does not message the background on a successful direct load', () => {
    const spy = vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({ dataUrl: null });
    render(<Favicon src="https://a.com/f.ico" />);
    expect(spy).not.toHaveBeenCalled();
  });
});
