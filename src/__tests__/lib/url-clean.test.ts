import { describe, it, expect } from 'vitest';
import { cleanUrl } from '../../lib/url-clean';

describe('cleanUrl', () => {
  it('returns unparseable strings unchanged', () => {
    expect(cleanUrl('not a url')).toBe('not a url');
    expect(cleanUrl('')).toBe('');
  });

  it('returns URL unchanged when there are no tracking params', () => {
    expect(cleanUrl('https://example.com/')).toBe('https://example.com/');
    expect(cleanUrl('https://example.com/page?id=42')).toBe('https://example.com/page?id=42');
  });

  it('strips gclid', () => {
    expect(cleanUrl('https://example.com/?gclid=abc123')).toBe('https://example.com/');
  });

  it('strips fbclid', () => {
    expect(cleanUrl('https://example.com/?fbclid=xyz')).toBe('https://example.com/');
  });

  it('strips utm_* params (prefix match)', () => {
    const input = 'https://example.com/?utm_source=x&utm_medium=y&utm_campaign=z';
    expect(cleanUrl(input)).toBe('https://example.com/');
  });

  it('keeps meaningful params alongside trackers', () => {
    const input = 'https://example.com/page?id=42&utm_source=x&gclid=abc&q=search';
    expect(cleanUrl(input)).toBe('https://example.com/page?id=42&q=search');
  });

  it('strips mc_eid and mc_cid (Mailchimp)', () => {
    const input = 'https://example.com/?mc_eid=a&mc_cid=b&foo=1';
    expect(cleanUrl(input)).toBe('https://example.com/?foo=1');
  });

  it('strips _hsenc and __hstc (HubSpot)', () => {
    const input = 'https://example.com/?_hsenc=a&__hstc=b&foo=1';
    expect(cleanUrl(input)).toBe('https://example.com/?foo=1');
  });

  it('strips yclid, msclkid, twclid', () => {
    expect(cleanUrl('https://example.com/?yclid=a')).toBe('https://example.com/');
    expect(cleanUrl('https://example.com/?msclkid=b')).toBe('https://example.com/');
    expect(cleanUrl('https://example.com/?twclid=c')).toBe('https://example.com/');
  });

  it('strips pk_* (Piwik/Matomo)', () => {
    expect(cleanUrl('https://example.com/?pk_campaign=x&pk_kwd=y')).toBe('https://example.com/');
  });

  it('matches param names case-insensitively', () => {
    expect(cleanUrl('https://example.com/?UTM_SOURCE=x&GCLID=y')).toBe('https://example.com/');
  });

  it('preserves hash fragments', () => {
    expect(cleanUrl('https://example.com/page?utm_source=x#section')).toBe('https://example.com/page#section');
  });

  it('preserves port and path', () => {
    expect(cleanUrl('https://example.com:8080/deep/path?gclid=x&keep=1'))
      .toBe('https://example.com:8080/deep/path?keep=1');
  });

  it('handles non-http schemes gracefully', () => {
    expect(cleanUrl('about:blank')).toBe('about:blank');
    expect(cleanUrl('chrome://extensions')).toBe('chrome://extensions');
  });
});
