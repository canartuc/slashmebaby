# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |

## Reporting a vulnerability

Report vulnerabilities privately. **Do not open a public issue for an exploitable bug.**

Either:

- Email **canartuc@gmail.com** with the subject **"SECURITY: slashmebaby"**, or
- Use GitHub's private vulnerability reporting: [Report a vulnerability](https://github.com/canartuc/slashmebaby/security/advisories/new).

Include what you can: affected version, browser, steps to reproduce or a proof of concept, and your assessment of the impact.

You should get an acknowledgment within 7 days. There is no bug bounty (this is an unpaid open-source project), but reports are taken seriously. Fixes are credited unless you prefer otherwise, and coordinated disclosure is appreciated.

## Scope notes

The extension's content script runs on all pages (`<all_urls>` host permission), so its main attack surface is input that a hostile web page controls. The sensitive areas are:

- **Content-script injection and overlay isolation.** The palette UI mounts in a Shadow DOM inside the isolated content-script world (`src/entrypoints/content/index.tsx`). Anything that lets the host page read palette input or drive the extension is a vulnerability.
- **Favicon fetching (SSRF surface).** The background worker fetches favicon URLs that originate from page-controlled data. The guards live in `src/lib/url-safety.ts` (`isSafeFaviconUrl`: scheme allowlist, private/loopback/link-local IP rejection) and `src/entrypoints/background/favicon.ts` (credentials omitted, redirects rejected, image-only content type, size caps). Bypasses of these checks are in scope.
- **Message routing and origin checks.** The background router (`src/entrypoints/background/index.ts`) rejects messages from other extensions, validates every message shape via the type guards in `src/lib/messaging.ts`, and validates navigation URLs (`validateNavigationUrl`) before opening them. A message that reaches a privileged API without passing these checks is in scope.

Bugs that require the user to already run malicious software with higher privileges than a web page (e.g. another extension with debugger access, a compromised browser profile) are generally out of scope.
