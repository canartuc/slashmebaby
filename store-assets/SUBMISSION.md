# Chrome Web Store Submission Checklist (SlashMeBaby)

Human steps that cannot be automated. Work top to bottom; everything you need to paste into the dashboard lives in [listing.md](listing.md).

## 1. Account prerequisites

- [x] Create a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) and pay the one-time **$5 registration fee**.
- [x] Verify the publisher contact email, **canartuc@gmail.com**, in the dashboard (Account tab). Unverified emails block publishing.
- [x] Enable **two-factor authentication** on the Google account. CWS developer accounts require it.
- [x] Complete the **EU Digital Services Act (DSA) trader/non-trader declaration** in the Account tab. If you publish as an individual hobbyist with no revenue, declare non-trader; if you monetize, you must declare trader and provide contact details that will be shown publicly in the EU. Publishing to EU users is blocked until this is answered.

## 2. Privacy policy hosting

- [x] The Privacy tab requires a **public URL** for the privacy policy. Done. The repo is public, so the policy is live at:
  `https://github.com/canartuc/slashmebaby/blob/main/PRIVACY.md`
- [ ] Paste that URL into the dashboard's **Privacy → Privacy policy** field.

## 3. Package and listing

- [ ] Build the store zip: `npm run pack` (output in `.output/`).
- [ ] Upload the zip in the dashboard (Package tab).
- [ ] Fill the Store Listing tab from [listing.md](listing.md): name, short + detailed description, category (Productivity → Tools), language (English).
- [ ] Use the public repo URL `https://github.com/canartuc/slashmebaby` as the listing's **homepage** and **support** links.
- [ ] Upload screenshots from `store-assets/screenshots/` (1280×800 or 640×400 PNG/JPEG; at least one, up to five). Capture the palette on a real page, the action-only `>` mode, and the settings page.
- [ ] Fill the Privacy tab from listing.md: single-purpose statement, per-permission justifications, data-usage answers, remote-code answer, privacy policy URL.

## 4. Review expectations

- [ ] Because the extension requests the **`<all_urls>` host permission**, expect an **in-depth (manual) review** rather than the fast automated path. This can take from a few days up to a few weeks. The permission justifications in listing.md are written to answer the reviewer's questions up front; do not blank-submit them.
- [ ] Don't request deceptive installs or reviews while waiting; respond promptly if the review team emails with questions.

## 5. After acceptance

- [ ] Tag the release in git: `git tag v1.0.0 && git push origin v1.0.0`.
- [ ] Create the corresponding GitHub release so the CHANGELOG link resolves.
- [ ] Update README/store listing with the live Chrome Web Store URL.
