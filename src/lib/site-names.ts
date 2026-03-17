// Known sites where the domain doesn't directly give a good name
const KNOWN_SITES: Record<string, string> = {
  'mail.google.com': 'Gmail',
  'docs.google.com': 'Docs',
  'drive.google.com': 'Drive',
  'sheets.google.com': 'Sheets',
  'slides.google.com': 'Slides',
  'calendar.google.com': 'Calendar',
  'meet.google.com': 'Meet',
  'maps.google.com': 'Maps',
  'photos.google.com': 'Photos',
  'translate.google.com': 'Translate',
  'news.google.com': 'News',
  'console.cloud.google.com': 'GCloud',
  'console.aws.amazon.com': 'AWS',
  'aws.amazon.com': 'AWS',
  'portal.azure.com': 'Azure',
  'app.slack.com': 'Slack',
  'app.asana.com': 'Asana',
  'app.clickup.com': 'ClickUp',
  'linear.app': 'Linear',
  'app.linear.app': 'Linear',
  'notion.so': 'Notion',
  'www.notion.so': 'Notion',
  'web.whatsapp.com': 'WhatsApp',
  'web.telegram.org': 'Telegram',
  'discord.com': 'Discord',
  'app.discord.com': 'Discord',
  'twitter.com': 'Twitter',
  'x.com': 'X',
  'www.reddit.com': 'Reddit',
  'old.reddit.com': 'Reddit',
  'www.youtube.com': 'YouTube',
  'music.youtube.com': 'YT Music',
  'studio.youtube.com': 'YT Studio',
  'open.spotify.com': 'Spotify',
  'www.netflix.com': 'Netflix',
  'www.amazon.com': 'Amazon',
  'www.ebay.com': 'eBay',
  'www.linkedin.com': 'LinkedIn',
  'www.facebook.com': 'Facebook',
  'www.instagram.com': 'Instagram',
  'www.tiktok.com': 'TikTok',
  'www.pinterest.com': 'Pinterest',
  'www.twitch.tv': 'Twitch',
  'github.com': 'GitHub',
  'www.github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'www.gitlab.com': 'GitLab',
  'bitbucket.org': 'Bitbucket',
  'www.bitbucket.org': 'Bitbucket',
  'stackoverflow.com': 'Stack OF',
  'www.stackoverflow.com': 'Stack OF',
  'codepen.io': 'CodePen',
  'codesandbox.io': 'CodeSB',
  'www.figma.com': 'Figma',
  'figma.com': 'Figma',
  'vercel.com': 'Vercel',
  'app.vercel.com': 'Vercel',
  'app.netlify.com': 'Netlify',
  'dashboard.heroku.com': 'Heroku',
  'grafana.com': 'Grafana',
  'app.datadoghq.com': 'Datadog',
  'sentry.io': 'Sentry',
  'medium.com': 'Medium',
  'dev.to': 'Dev.to',
  'news.ycombinator.com': 'HN',
  'www.wikipedia.org': 'Wikipedia',
  'en.wikipedia.org': 'Wikipedia',
  'chat.openai.com': 'ChatGPT',
  'chatgpt.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'www.perplexity.ai': 'Perplexity',
  'jira.atlassian.com': 'Jira',
  'confluence.atlassian.com': 'Confluence',
  'trello.com': 'Trello',
  'www.trello.com': 'Trello',
  'localhost': 'Localhost',
};

/**
 * Extract a short, readable site name from a URL.
 * Tries known sites first, then falls back to domain extraction.
 */
export function getSiteName(url?: string): string {
  if (!url) return '';

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return '';
  }

  // Check known sites (exact match)
  if (KNOWN_SITES[hostname]) {
    return KNOWN_SITES[hostname];
  }

  // localhost with port
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'Localhost';
  }

  // Strip www.
  const bare = hostname.replace(/^www\./, '');

  // Check again without www
  if (KNOWN_SITES[bare]) {
    return KNOWN_SITES[bare];
  }

  // Extract main domain name (before TLD)
  // e.g., "app.example.co.uk" → "example"
  const parts = bare.split('.');

  // Handle two-part TLDs: .co.uk, .com.au, etc.
  const twoPartTLDs = ['co.uk', 'co.jp', 'co.kr', 'com.au', 'com.br', 'co.nz', 'co.in'];
  const lastTwo = parts.slice(-2).join('.');

  let name: string;
  if (twoPartTLDs.includes(lastTwo) && parts.length >= 3) {
    name = parts[parts.length - 3];
  } else if (parts.length >= 2) {
    name = parts[parts.length - 2];
  } else {
    name = parts[0];
  }

  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}
