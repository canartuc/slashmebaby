import { validateNavigationUrl } from './url-safety';

// Matches domain-like queries such as "example.com", "www.foo.com?q=1",
// "x.dev/path" or "example.com:8080/admin": one or more dot-separated labels
// followed by an alphabetic TLD (2+ chars), an optional port, and an optional
// path/query/fragment with no whitespace.
const DOMAIN_LIKE =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#]\S*)?$/i;

// Detects an explicit scheme prefix ("https:", "javascript:", ...).
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Interprets a search query as a navigable URL (F10 go-to-URL fallback).
 *
 * - "example.com" / "x.dev/path"  → prefixed with the default https scheme
 * - "https://x.dev/path"          → returned as-is (scheme-validated)
 * - anything else (plain words, unsafe schemes, multi-word queries) → null
 */
export function guessNavigableUrl(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  // Domain-like takes precedence over the scheme check: "example.com:8080"
  // would otherwise parse as scheme "example.com:".
  if (DOMAIN_LIKE.test(trimmed)) {
    const candidate = `https://${trimmed}`;
    return validateNavigationUrl(candidate).ok ? candidate : null;
  }

  if (HAS_SCHEME.test(trimmed)) {
    return validateNavigationUrl(trimmed).ok ? trimmed : null;
  }

  return null;
}
