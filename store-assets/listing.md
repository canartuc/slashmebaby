# SlashMeBaby Chrome Web Store Listing

Everything needed to fill in the CWS Developer Dashboard in one pass.

## Store listing tab

### Name

SlashMeBaby

### Short description (max 132 characters)

Matches the manifest description in `wxt.config.ts` (128 characters):

> A keyboard-driven command palette for your browser. Switch tabs, search bookmarks and history, and run actions in one keystroke.

> **Trademark note (resolved):** an earlier draft read "Arc & Zen-style command palette". "Arc" and "Zen" are other companies' browser brands, and Chrome Web Store policy prohibits third-party trademarks in listing metadata that imply affiliation. The shipped manifest and this listing now use the trademark-free wording above; the inspiration credit remains only in the README, which is not store metadata.

### Detailed description

SlashMeBaby puts your whole browser one keystroke away. Press Ctrl+Shift+Space (Cmd+Shift+Space on Mac) on any page and a fast, keyboard-driven command palette appears. Search your open tabs, bookmarks, and history, or run tab-management commands, all without touching the mouse.

FIND ANYTHING, INSTANTLY
- Switch tabs: fuzzy-search every open tab in every window and jump to it with Enter.
- Search bookmarks: your full bookmark tree, including nested folders.
- Search history: your recent browsing history, ready to reopen with Enter.
- Empty-query browsing: open the palette to a navigable tree of all your tabs and bookmarks, with one-key jump labels.
- Smart suggestions: the toolbar popup's empty state shows your most recent tabs, newest bookmarks, and contextual actions, with results ranked by both match quality and recency.

TAKE ACTION FROM THE KEYBOARD
- Close tab, close other tabs, close duplicate tabs
- Pin/unpin, mute/unmute, duplicate, reload, move to a new window
- Sort tabs by domain to tame a messy tab bar
- New tab, go to URL, restore recently closed tabs
- Type ">" as the first character for action-only mode (e.g. ">close")

MADE TO FIT YOU
- Choose your shortcut, palette position (center, top, or bottom), and theme (system, light, or dark)
- Control how many results appear per group, toggle favicons, and enable or disable each search source
- A short interactive tutorial on first install gets you productive in under a minute
- On restricted pages (chrome:// and the Chrome Web Store) the toolbar icon opens a popup with the same search

PRIVATE BY DESIGN
Everything runs on your device. SlashMeBaby has no servers, no analytics, no telemetry, and no accounts. It never collects or transmits your data. The only network requests it makes fetch favicon images directly from the sites' own URLs, with credentials omitted. Full policy: https://github.com/canartuc/slashmebaby/blob/main/PRIVACY.md

Default shortcut: Ctrl+Shift+Space (Cmd+Shift+Space on Mac). Change it anytime in Settings or at chrome://extensions/shortcuts.

### Category

Productivity → Tools

### Language

English

## Privacy tab

### Single-purpose statement

SlashMeBaby is a keyboard-driven command palette for browser navigation and tab management: it lets the user search and switch between open tabs, search bookmarks and browsing history, and execute tab-management actions (close, pin, mute, duplicate, sort, restore) from a single overlay opened with a keyboard shortcut. All functionality serves this one purpose and all processing happens locally on the user's device.

### Permission justifications

The **tabs** permission is required to read the titles, URLs, and favicons of open tabs so the palette can list and fuzzy-search them, and to execute the user's tab actions (switch, close, pin, mute, duplicate, move, reload, sort by domain, close duplicates). Tab data is only held in an in-memory cache and never transmitted.

The **bookmarks** permission is required to read the user's bookmark tree so the palette can fuzzy-search bookmarks and open the one the user selects. Bookmark data is only used for local search and is never transmitted.

The **history** permission is required to read recent browsing history so the palette can fuzzy-search it and reopen pages the user selects. History data is only used for local search and is never transmitted.

The **sessions** permission is required for the "Recently Closed" action, which restores the user's most recently closed tab(s), or undoes the palette's last tab operation, by reading chrome.sessions.getRecentlyClosed() and calling chrome.sessions.restore(). There is no browsable list: session data is read only at the moment of the restore, is never displayed, and is never transmitted.

The **storage** permission is required to persist the user's UI settings (keyboard shortcut, palette position, theme, max results, favicon toggle, search-source toggles) in chrome.storage.sync, and first-run onboarding progress in chrome.storage.local. No browsing data or personal information is stored.

The **tabGroups** permission is required to read tab-group titles and colors so the palette's tab tree view can display tabs grouped the way the user organized them in Chrome. Read-only enrichment of the tab list; group data is never transmitted.

The **`<all_urls>`** host permission is required for two reasons. First, the content script must inject the command-palette overlay into every page before any user gesture, because the palette opens via a global keyboard shortcut on whatever page the user is currently viewing (activeTab is not sufficient since there is no preceding click). Second, the background service worker fetches favicon images cross-origin from the sites' own favicon URLs (image responses only, credentials omitted, converted to data: URLs and cached in memory) so results can show icons even when a page's CSP or hotlink protection would block an image tag. No page content is read or modified beyond rendering the palette overlay in an isolated Shadow DOM, and no data is transmitted anywhere.

### Data usage disclosure answers

- Personally identifiable information: **No**
- Health information: **No**
- Financial and payment information: **No**
- Authentication information: **No**
- Personal communications: **No**
- Location: **No**
- Web history: **No** (read locally for search only; never collected or transmitted)
- User activity: **No**
- Website content: **No**

Certifications (check all three):
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

Remote code: **No, I am not using remote code.** All code ships inside the extension package.

### Privacy policy URL

The policy is hosted at https://github.com/canartuc/slashmebaby/blob/main/PRIVACY.md. Paste that URL here.
