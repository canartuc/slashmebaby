import React, { useState, useEffect } from 'react';
import { isSafeFaviconUrl } from '../../lib/url-safety';

export interface FaviconProps {
  src?: string;
  size?: number;
  className?: string;
}

/** Inert placeholder glyph. An SVG element (not an <img>), so the host page's
 *  CSP `img-src` cannot block it and it makes no network request. */
const GlobeGlyph: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg
    className={className ?? 'smb-favicon'}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
    <path
      d="M1.5 8h13M8 1.5c2.2 2 2.2 11 0 13M8 1.5c-2.2 2-2.2 11 0 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      opacity="0.55"
    />
  </svg>
);

/**
 * Safe favicon renderer with a three-stage fallback:
 *   stage 0 — load the icon URL directly (zero background messages);
 *   stage 1 — on error, ask the background to re-fetch it as a `data:` URL
 *             (bypasses host CSP / no-referrer / CORS) and swap it in;
 *   stage 2 — on a second error (or a null response), show an inline globe.
 *
 * Unsafe or absent icons render nothing, unchanged from before — the globe
 * only appears when a *valid* icon fails to load, so icon-less bookmark and
 * history rows stay blank.
 */
export const Favicon: React.FC<FaviconProps> = ({ src, size = 16, className }) => {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [proxied, setProxied] = useState<string | null>(null);

  // Rows are recycled during navigation; reset when the icon changes so a
  // stale failed stage never sticks to a different tab's row.
  useEffect(() => {
    setStage(0);
    setProxied(null);
  }, [src]);

  if (!isSafeFaviconUrl(src)) return null;
  if (stage === 2) return <GlobeGlyph size={size} className={className} />;

  const handleError = () => {
    if (stage === 0) {
      chrome.runtime
        .sendMessage({ type: 'GET_FAVICON', payload: { url: src } })
        .then((res: { dataUrl?: string | null } | undefined) => {
          if (res && typeof res.dataUrl === 'string') {
            setProxied(res.dataUrl);
            setStage(1);
          } else {
            setStage(2);
          }
        })
        .catch(() => setStage(2));
    } else {
      setStage(2);
    }
  };

  const imgSrc = stage === 1 && proxied ? proxied : src;

  return (
    <img
      className={className ?? 'smb-favicon'}
      src={imgSrc}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={handleError}
    />
  );
};
