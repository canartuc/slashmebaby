// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
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
