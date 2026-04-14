import { describe, it, expect } from 'vitest';
import { foldDiacritics } from '../../lib/diacritics';

describe('foldDiacritics', () => {
  it('returns empty string unchanged', () => {
    expect(foldDiacritics('')).toBe('');
  });

  it('leaves plain ASCII lowercase', () => {
    expect(foldDiacritics('hello world')).toBe('hello world');
  });

  it('lowercases ASCII uppercase', () => {
    expect(foldDiacritics('HELLO')).toBe('hello');
  });

  it('folds Latin diacritics (é ñ ü)', () => {
    expect(foldDiacritics('café niño über')).toBe('cafe nino uber');
  });

  it('folds Turkish sözcü to sozcu', () => {
    expect(foldDiacritics('sözcü')).toBe('sozcu');
  });

  it('folds Turkish çağdaş to cagdas', () => {
    expect(foldDiacritics('çağdaş')).toBe('cagdas');
  });

  it('folds Turkish dotless ı and ışık to isik', () => {
    expect(foldDiacritics('ışık')).toBe('isik');
  });

  it('folds Turkish İstanbul to istanbul', () => {
    expect(foldDiacritics('İstanbul')).toBe('istanbul');
  });

  it('is idempotent', () => {
    const s = 'Sözcü ışık çağdaş İstanbul';
    expect(foldDiacritics(foldDiacritics(s))).toBe(foldDiacritics(s));
  });

  it('preserves digits and punctuation', () => {
    expect(foldDiacritics('Café 123!')).toBe('cafe 123!');
  });
});
