import { describe, it, expect } from 'vitest';
import { foldDiacritics } from '../../lib/diacritics';

describe('foldDiacritics', () => {
  it('lowercases ASCII input unchanged', () => {
    expect(foldDiacritics('Hello World')).toBe('hello world');
  });

  it('strips common Latin diacritics (é → e, ñ → n, à → a)', () => {
    expect(foldDiacritics('café')).toBe('cafe');
    expect(foldDiacritics('niño')).toBe('nino');
    expect(foldDiacritics('àèìòù')).toBe('aeiou');
  });

  it('folds Turkish sözcü to sozcu', () => {
    expect(foldDiacritics('sözcü')).toBe('sozcu');
    expect(foldDiacritics('Sözcü')).toBe('sozcu');
    expect(foldDiacritics('SÖZCÜ')).toBe('sozcu');
  });

  it('folds Turkish ğ, ş, ç to g, s, c', () => {
    expect(foldDiacritics('çağdaş')).toBe('cagdas');
    expect(foldDiacritics('şükür')).toBe('sukur');
  });

  it('folds Turkish dotless ı and dotted İ to i', () => {
    expect(foldDiacritics('ışık')).toBe('isik');
    expect(foldDiacritics('İstanbul')).toBe('istanbul');
  });

  it('is idempotent on already-folded input', () => {
    const folded = foldDiacritics('sözcü');
    expect(foldDiacritics(folded)).toBe(folded);
  });

  it('returns empty string for empty input', () => {
    expect(foldDiacritics('')).toBe('');
  });

  it('preserves non-letter characters (spaces, punctuation, digits)', () => {
    expect(foldDiacritics('42 naïve - tests!')).toBe('42 naive - tests!');
  });
});
