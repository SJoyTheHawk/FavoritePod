# Publish FavoritePod 1.0 — start here

Follow this checklist for the first **private test release**. Open the linked
files only when a step needs them. The homepage and support page are reachable;
the privacy-page redirect below still needs fixing. Store publication is not
confirmed by these checks.

## 1. Upload the website images

In WordPress, open **Media → Add New**. Upload [favoritepod-icon.png](site/favoritepod/assets/favoritepod-icon.png)
and [favoritepod-visual-home.png](site/favoritepod/assets/favoritepod-visual-home.png). Copy their **File URLs**.

## 2. Add the styling

Open **Appearance → Customize → Additional CSS**. Paste
[favoritepod.css](wordpress/favoritepod.css) below existing CSS and publish.

## 3. Create and publish the website pages

Create FavoritePod first, then its two child pages:

| Page title                 | Slug        | Parent      | Content to paste                               |
| -------------------------- | ----------- | ----------- | ---------------------------------------------- |
| FavoritePod                | favoritepod | None        | [overview.html](wordpress/pages/overview.html) |
| FavoritePod Privacy Policy | privacy     | FavoritePod | [privacy.html](wordpress/pages/privacy.html)   |
| FavoritePod Support        | support     | FavoritePod | [support.html](wordpress/pages/support.html)   |

For each page: **Edit with Elementor → Page Settings → Elementor Full Width**.
Hide the automatic title and disable comments. Add a full-width container with
zero padding, then an **HTML widget**, and paste the matching file's contents.

In the homepage widget, replace **{{FAVORITEPOD_ICON_URL}}** and
**{{FAVORITEPOD_SCREENSHOT_URL}}** with the image URLs from step 1.

Publish all three pages. Check images, links, and mobile layout, then open these
URLs signed out:

- https://rockyroad.studio/favoritepod/
- https://rockyroad.studio/favoritepod/privacy/
- https://rockyroad.studio/favoritepod/support/

**Link check (November 10, 2026):** The privacy URL redirects to the studio-wide
`/privacy-policy/` page. Check its WordPress parent/slug and any redirect rule
so it serves the prepared FavoritePod policy. Verify the product-specific policy
before using this URL in the store or OAuth settings.

Keep the existing studio privacy page. Use the fragments above, not the local
preview documents. Your theme supplies the studio header and footer.

## 4. Build the extension ZIP

Stop the development server. Run these commands from the repository root:

    npm ci
    npm run lint
    npm test
    npm run package:store

Upload file: **release/favoritepod-1.0.0.zip**. The packaging command builds the
extension and removes the development-only **key** from the ZIP's manifest.
Repeat **npm run package:store** to rebuild it; do not ZIP dist directly.

## 5. Upload a store draft

Open the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
Complete developer registration if needed. Choose **Add new item**, upload the
ZIP, and record the extension ID. Save the draft; do not submit yet.

**Steps 4–5 can run alongside the website work.** A draft is not yet installable.

## 6. Check Google sign-in and the final build

In Google Cloud's **Google Auth Platform**:

- **Clients:** open the existing client configured in
  [public/manifest.json](../../public/manifest.json) under oauth2.client_id. Compare
  its **Item ID / Application ID** with the store's extension ID. If they match
  and its type is **Chrome Extension**, reuse it. If they differ, create a new
  **Chrome Extension** client in the same Google Cloud project using the store
  extension ID. Put the matching client ID in oauth2.client_id, then rebuild
  and re-upload with **npm run package:store**. Both builds currently share this
  client ID. To use it locally, align the unpacked extension ID with the store's
  public key using the ID/OAuth instructions below. Export a backup before
  changing IDs; Chrome stores each extension ID's library separately.
- **Branding:** enter the live homepage and privacy URLs from step 3; complete
  Google's domain/branding requirements.
- **Audience:** prepare production access and verify Drive sync with an account
  outside the OAuth test-user list before using the prepared reviewer instructions.
  Keep the store draft unsubmitted if reviewer sign-in is still restricted.

Load the production **dist/** build in Chrome. Check saving, folders, local files,
backup/import, optional shortcuts, and Drive sync. Google's
[ID/OAuth instructions](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)
explain matching an unpacked build's ID.

Add the live privacy link inside the extension before release. After any code or
manifest changes, repeat step 4 and upload the corrected ZIP to the **same item**.

## 7. Complete the listing and select private testing

| Dashboard field                   | Prepared resource                                                           |
| --------------------------------- | --------------------------------------------------------------------------- |
| Description and listing details   | [store-listing.md](store-listing.md)                                        |
| Privacy practices and permissions | [privacy-practices.md](privacy-practices.md)                                |
| Test instructions                 | [reviewer-instructions.md](reviewer-instructions.md), after its checks pass |
| Icon                              | [extension-icon-128.png](artwork/extension-icon-128.png)                    |
| Screenshots                       | All five PNGs in [screenshots](screenshots/), in numbered order             |
| Small promotional image           | [small-promo-440x280.png](artwork/small-promo-440x280.png)                  |
| Homepage, privacy, support        | The verified URLs from step 3                                               |

Publisher/contact: **Rocky Road Studio · rockyroadstudio@outlook.com**.
Confirm the declarations match the final build.

Add testers' Google-account emails to **Trusted testers** in developer account
settings. In the item's **Distribution** tab, choose **Private** and that audience.

## 8. Submit, publish privately, and test

Submit for review. Private releases also require review. After approval, publish
privately if you selected deferred publication; otherwise confirm it is published.
Send the listing URL to your trusted testers, who must use their approved accounts.
Store testers and Google OAuth test users are separate lists.

After publication, release fixes with an increased version. For public launch,
change the same item's visibility to **Public** and submit the update. Once it is
publicly available, replace the website's release notice with the real install link.

---

Official references: [store publishing](https://developer.chrome.com/docs/webstore/publish),
[private distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution).
