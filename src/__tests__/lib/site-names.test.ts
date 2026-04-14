import { describe, it, expect } from 'vitest';
import { getSiteName } from '../../lib/site-names';

describe('getSiteName', () => {
  // Known sites
  it('returns Gmail for mail.google.com', () => {
    expect(getSiteName('https://mail.google.com/inbox')).toBe('Gmail');
  });

  it('returns Docs for docs.google.com', () => {
    expect(getSiteName('https://docs.google.com/document/d/123')).toBe('Docs');
  });

  it('returns AWS for console.aws.amazon.com', () => {
    expect(getSiteName('https://console.aws.amazon.com/ec2')).toBe('AWS');
  });

  it('returns GitHub for github.com', () => {
    expect(getSiteName('https://github.com/user/repo')).toBe('GitHub');
  });

  it('returns YouTube for www.youtube.com', () => {
    expect(getSiteName('https://www.youtube.com/watch?v=123')).toBe('YouTube');
  });

  it('returns Slack for app.slack.com', () => {
    expect(getSiteName('https://app.slack.com/client/T123')).toBe('Slack');
  });

  it('returns Stack OF for stackoverflow.com', () => {
    expect(getSiteName('https://stackoverflow.com/questions/123')).toBe('Stack OF');
  });

  it('returns ChatGPT for chatgpt.com', () => {
    expect(getSiteName('https://chatgpt.com/c/123')).toBe('ChatGPT');
  });

  it('returns Claude for claude.ai', () => {
    expect(getSiteName('https://claude.ai/chat/123')).toBe('Claude');
  });

  // Domain extraction fallback
  it('extracts name from simple domain', () => {
    expect(getSiteName('https://www.example.com/page')).toBe('Example');
  });

  it('extracts name from subdomain', () => {
    expect(getSiteName('https://app.myservice.com/dashboard')).toBe('Myservice');
  });

  it('handles co.uk TLD', () => {
    expect(getSiteName('https://www.bbc.co.uk/news')).toBe('Bbc');
  });

  it('handles com.au TLD', () => {
    expect(getSiteName('https://www.news.com.au')).toBe('News');
  });

  it('returns Localhost for localhost', () => {
    expect(getSiteName('http://localhost:3000')).toBe('Localhost');
  });

  it('returns Localhost for 127.0.0.1', () => {
    expect(getSiteName('http://127.0.0.1:8080')).toBe('Localhost');
  });

  // Edge cases
  it('returns empty string for undefined', () => {
    expect(getSiteName(undefined)).toBe('');
  });

  it('returns empty string for invalid URL', () => {
    expect(getSiteName('not-a-url')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(getSiteName('')).toBe('');
  });

  it('returns HN for news.ycombinator.com', () => {
    expect(getSiteName('https://news.ycombinator.com')).toBe('HN');
  });

  it('returns Linear for linear.app', () => {
    expect(getSiteName('https://linear.app/team/issue')).toBe('Linear');
  });

  it('returns Notion for notion.so', () => {
    expect(getSiteName('https://notion.so/page-123')).toBe('Notion');
  });

  it('matches a known site after stripping the www. prefix', () => {
    // www.discord.com is NOT in KNOWN_SITES directly, but discord.com is —
    // the bare-hostname re-check should still resolve to Discord.
    expect(getSiteName('https://www.discord.com/channels/123')).toBe('Discord');
  });

  it('handles single-segment hostnames (no TLD)', () => {
    // Internal/intranet hosts have no dots — fall through to parts[0].
    expect(getSiteName('http://intranet/dashboard')).toBe('Intranet');
  });
});
