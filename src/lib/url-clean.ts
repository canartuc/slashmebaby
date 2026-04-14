// Strips tracking parameters from URLs. Modeled on Brave's "Copy Clean Link".
//
// Exact-match names (case-insensitive) are the common advertiser / analytics IDs
// that never convey meaningful navigational state. Prefix patterns catch whole
// families (utm_*, pk_*, mc_*) without hard-coding every variant.
//
// Unknown URLs or anything without a query string are returned untouched.

const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  // Generic click / ad identifiers
  'gclid',
  'gclsrc',
  'dclid',
  'fbclid',
  'msclkid',
  'yclid',
  'twclid',
  'li_fat_id',
  'igshid',
  'mkt_tok',
  'vero_id',
  'vero_conv',
  // Mailchimp / email
  'mc_eid',
  'mc_cid',
  // HubSpot
  '_hsenc',
  '_hsmi',
  '__hstc',
  '__hssc',
  '__hsfp',
  'hsctatracking',
  // Misc
  'oly_anon_id',
  'oly_enc_id',
  'wickedid',
  'oicampaign',
  '_openstat',
  'yandexclid',
  // Referral
  'ref',
  'ref_src',
  'ref_url',
  'referrer',
  // AMP / Google
  'amp',
  'amp_js_v',
  'gbraid',
  'wbraid',
  'usg',
]);

const TRACKING_PREFIXES: readonly string[] = [
  'utm_',
  'pk_',
  'mtm_',
  'piwik_',
  'hsa_',
  'matomo_',
  'vero_',
  'mkt_',
];

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) return true;
  return TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function cleanUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const paramsToDelete: string[] = [];
  parsed.searchParams.forEach((_value, key) => {
    if (isTrackingParam(key)) paramsToDelete.push(key);
  });

  if (paramsToDelete.length === 0) return rawUrl;

  for (const key of paramsToDelete) parsed.searchParams.delete(key);
  return parsed.toString();
}
