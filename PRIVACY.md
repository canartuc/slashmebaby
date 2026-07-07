# SlashMeBaby Privacy Policy

**Effective date:** 2026-07-07

SlashMeBaby is a browser extension that provides a keyboard-driven command palette for searching your open tabs, bookmarks, and browsing history, and for running tab-management actions. This policy describes what data the extension accesses, how it is used, and what never leaves your browser.

## Summary

SlashMeBaby processes everything on your device. It does not collect, transmit, sell, or share any data. There are no accounts, no analytics, no telemetry, no advertising, and no remote code. One technical caveat about rendering the palette on web pages is described under "On-page rendering" below.

## What the extension accesses, and why

To power its local search and actions, SlashMeBaby reads the following data through standard browser extension APIs. The extension keeps all of this data inside your browser and uses it solely to display search results and execute the actions you choose:

- **Tabs**: the titles, URLs, and favicons of your open tabs, so you can search them and switch between them, and so tab actions (close, pin, mute, duplicate, sort by domain, close duplicates, and so on) can operate on them.
- **Bookmarks**: your bookmark tree, so you can search bookmarks and open them.
- **History**: your recent browsing history, so you can search it and revisit pages.
- **Sessions**: your recently closed tabs, so the "Recently Closed" action can restore the most recent one (a single-shot restore/undo; the extension never displays a list of closed tabs).

None of this data is stored by the extension beyond short-lived in-memory caches inside the extension's background process, and the extension never sends any of it anywhere.

## On-page rendering

To appear on the page you are viewing, the command-palette overlay is rendered inside that page's own document, in an isolated Shadow DOM container injected by the extension's content script. This isolation keeps the page's styles and scripts from interfering with the palette, but it does not hide the palette's contents from the page. As with any content rendered into a web page, the text the palette displays while it is open on that page (the titles and URLs of your open tabs and bookmarks in the tree view, and any bookmark or history rows matching what you type) is technically readable by that page's own JavaScript for as long as the palette is open there.

SlashMeBaby itself never transmits this data, pages cannot open the palette (only your real keystrokes can; synthetic page-generated key events are rejected), and history entries are only rendered once you actually type a matching query. If you are on a page you do not trust, press Escape to close the overlay, or use the toolbar-icon popup instead. The popup renders in the extension's own UI, which no web page can read.

## Network requests

SlashMeBaby makes no network requests of its own, with one narrow exception: displaying favicons next to search results. Favicons load in two stages:

1. **In-page image element.** The palette first renders each favicon as an ordinary `<img>` element pointing at the website's own favicon URL, from within the page you are viewing. This is a browser-standard image subresource request, made in anonymous CORS mode with the referrer suppressed, so the browser attaches no cookies or credentials to it and does not tell the favicon's server which page you were on.
2. **Background fetch fallback.** If that image fails to load (for example, the host page's security policy blocks it), the extension's background process fetches the same favicon URL itself. These fetches are made with credentials omitted (no cookies or authentication are ever sent), accept image responses only, and are converted to inline `data:` URLs cached in memory (the cache is discarded when the background process shuts down).

In both stages, nothing is sent except the standard HTTP request for the image itself, and favicon URLs pointing at private, local, or loopback addresses are refused. No request is ever made to any server operated by, or on behalf of, the developer. There is no backend.

## What the extension stores

- **`chrome.storage.sync`** stores your UI settings only: keyboard shortcut, palette position, theme, maximum results per group, favicon display toggle, and which search sources (tabs, bookmarks, history) are enabled. If you are signed into your browser, the browser may sync these settings across your devices; that syncing is handled entirely by your browser vendor under its own policy.
- **`chrome.storage.local`** stores your onboarding progress only (which tutorial step you have completed), so the first-run tutorial does not reappear.

Nothing else is stored. The extension never writes browsing data, search queries, or personal information to storage.

## What the extension does not do

- No data collection of any kind: browsing activity, search queries, and personal information are never recorded or transmitted.
- No analytics or telemetry.
- No remote code: all code ships inside the extension package and is reviewed by the browser store.
- No accounts or sign-in.
- No personally identifiable information is collected or processed.
- Nothing is sold or shared with anyone, because nothing is collected.

## Changes to this policy

If this policy ever changes, the updated version will be published at the same location with a new effective date. Because the extension collects nothing, material changes are not anticipated.

## Contact

Questions about this policy or the extension's data practices: **canartuc@gmail.com**
