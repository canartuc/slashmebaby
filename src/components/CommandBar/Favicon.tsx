import React from 'react';
import { isSafeFaviconUrl } from '../../lib/url-safety';

export interface FaviconProps {
  src?: string;
  size?: number;
  className?: string;
}

/**
 * Safe favicon renderer.
 *
 * - Drops any icon whose scheme is not http(s)/data, so `javascript:` or
 *   `chrome-extension://` icons (whether from a malicious favicon tag on a
 *   host page or from an exotic session) never hit the DOM.
 * - Forces `referrerPolicy="no-referrer"` so cross-origin favicon fetches
 *   from the content-script host page don't leak the current URL to third
 *   parties (privacy hardening — the same favicons are also rendered inside
 *   bank/webmail pages because the content script runs on `<all_urls>`).
 * - Sets `loading="lazy"` and `decoding="async"` to avoid blocking paint.
 */
export const Favicon: React.FC<FaviconProps> = ({ src, size = 16, className }) => {
  if (!isSafeFaviconUrl(src)) return null;
  return (
    <img
      className={className ?? 'smb-favicon'}
      src={src}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
    />
  );
};
