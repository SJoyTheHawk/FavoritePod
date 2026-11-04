# Revised Visual Launcher Plan with Google Drive Sync

## Review corrections

The previous plan needs five adjustments:

- Use Google Drive’s private `appDataFolder`; it avoids operating a backend but cannot be shared directly with colleagues.
- Use a stable extension ID and OAuth configuration from the beginning.
- Avoid overwriting one shared Drive JSON file from multiple devices.
- Do not promise a runtime toggle for new-tab replacement; Chrome declares that behavior in the manifest.
- Keep ZIP export as the sharing mechanism for colleagues.

Second review pass:

- Data model must be sync-ready from the first IndexedDB schema (stable IDs, per-field clocks, tombstones, order keys), not retrofitted in the sync phase.
- Ordering uses per-item fractional order keys instead of ordered arrays, so concurrent moves merge cleanly.
- Merge must repair group cycles created by concurrent moves of nested groups.
- Use hybrid logical clocks instead of raw wall-clock timestamps to survive clock skew.
- Device files need compaction; reinstalls create new device IDs and orphan files otherwise.
- `appDataFolder` belongs to the Google Cloud project, not to the OAuth client. A future new-tab build can share the same Drive data if its OAuth client lives in the same project.
- Live iframe hover previews are mostly blocked by `X-Frame-Options`/CSP. Replace with enlarged stored thumbnails; never strip frame headers.
- `chrome.topSites` exposes Chrome's own most-visited list, so the frequency ranking does not need to be guessed.
- `file://` links cannot be opened with plain anchors from an extension page and their existence cannot be checked reliably. Open through `chrome.tabs.create` and gate on file-scheme access.
- Only the public key goes into the manifest. The private `.pem` stays out of git.
- Disconnect stops sync only in the current Chrome profile and clears local Identity credentials; it must never revoke the account-wide Google grant.
- ZIP merge should upsert by ID so re-importing a colleague's updated export updates instead of duplicating.
- Reject non-`http`/`https`/`file` URL schemes everywhere (`javascript:` in particular), including imports.
- Add a de-risking spike before building UI.

## Product scope

Build a separate repository using TypeScript, React, Vite, and Manifest V3.

The first release includes:

- Toolbar popup with “Save current page” and “Open launcher”.
- Full launcher dashboard in an extension tab or window.
- Nested groups.
- Drag-and-drop ordering and movement.
- Web URLs and local `file://` links.
- JPEG thumbnails and favicon/title fallbacks.
- Hover previews from stored thumbnails (live iframes only as an opt-in experiment, see below).
- Edit, delete, move, and context-menu actions.
- ZIP import/export.
- Optional visited-site discovery.
- Google Drive synchronization for metadata and thumbnails.

The first release will not implement a server or Google login screen. Google authorization is handled through Chrome’s extension identity API.

## Google Drive design

Use:

```json
{
  "key": "<BASE64_PUBLIC_KEY>",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "unlimitedStorage",
    "identity",
    "contextMenus",
    "alarms",
    "favicon"
  ],
  "optional_permissions": [
    "history",
    "topSites"
  ],
  "oauth2": {
    "client_id": "YOUR_EXTENSION_OAUTH_CLIENT.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.appdata"
    ]
  }
}
```

Permission notes:

- `activeTab` is enough for `chrome.tabs.captureVisibleTab()` when the user clicks the toolbar popup. Do not request `<all_urls>`.
- `scripting` is only used to read page metadata (title, `og:image`, favicon) from the active tab during "Save current page". Drop it if titles from `tab.title` are sufficient.
- `contextMenus` is only needed if "Save to launcher" appears in Chrome's page/link right-click menu. In-dashboard context menus need no permission.
- `alarms` drives periodic background sync; MV3 service workers cannot hold timers.
- `unlimitedStorage` keeps IndexedDB thumbnails from being evicted.
- Chrome extension cross-origin requests from extension pages and the service worker require host permissions. Keep these limited to the Google API origin used by the Drive client (`https://www.googleapis.com/*`); the `drive.appdata` OAuth scope still limits which Drive files the app can access. See [Chrome's cross-origin network request guidance](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

Stable ID: generate the key pair once. Commit only the base64 public key into `manifest.json` as `"key"`. Keep the private `.pem` out of git (password manager or CI secret). The Chrome Web Store issues its own ID on first upload; if the extension will be published, upload once early, copy the store's public key into `"key"`, and register the OAuth client against that ID so unpacked and store builds share one identity.

`appDataFolder` is scoped to the Google Cloud project, not the individual OAuth client. Keep all OAuth clients (dev, store, a future new-tab build) in the same Cloud project so they read and write the same Drive data.

Use `chrome.identity.getAuthToken()` for authorization. Never include a client secret in the extension. `getAuthToken` only works in Google Chrome; Edge, Brave, and other Chromium browsers would need `launchWebAuthFlow`. v1 targets Chrome only and states this in the README.

Token handling:

- On HTTP 401, call `chrome.identity.removeCachedAuthToken()` and retry once with a fresh token.
- Disconnect clears only this Chrome profile's Drive connection/bookkeeping and Chrome Identity cache. It never requests a token, contacts the revocation endpoint, or deletes Drive files. Local library data, snapshots, deviceId, and lastHlc remain. Other profiles/devices stay authorized. This explicitly supersedes the original revoke-on-disconnect requirement.
- Authorization failures persist a local recovery state, pause background sync, and show a contextual Connect Google Drive action. Network failures retain bounded retries without changing authorization state. Only user-initiated Connect may open consent.
- From a disconnected profile, Connect first identifies the Google account and asks the user to confirm it before saving the connection or starting sync. Cancel leaves the profile disconnected. Chrome may reuse the existing Google grant and skip its consent screen; the FavoritePod confirmation is the explicit reconnect step. Authorization recovery for a remembered account remains a one-click Connect action.
- Connected Settings shows Sync now and Disconnect; Check account and Reconnect or switch account are removed. Google Account settings remain the place for account-wide revocation.
- Identify the connected account with `GET drive/v3/about?fields=user(emailAddress,permissionId)`, store `permissionId` locally, and treat a change as an account switch.
- While the OAuth consent screen is in "Testing" mode, refresh tokens expire after 7 days and only listed test users can connect. Move to "In production" before colleagues use sync. `drive.appdata` is a non-sensitive scope, so verification should be light.

Provide:

- Connect Google Drive.
- Sync now.
- Disconnect.
- Last synchronized time.
- Sync error details.
- Account switch confirmation.

Store sync data in Drive’s hidden `appDataFolder`. This gives the extension access to its own private application files without access to the user’s normal Drive documents. Colleagues cannot share this folder directly, so ZIP export remains the sharing mechanism. ([Drive app data](https://developers.google.com/workspace/drive/api/guides/appdata), [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity))

## Conflict-safe Drive layout

Avoid having every device overwrite a single JSON file.

Each installation receives a stable local `deviceId` and owns one metadata file:

```text
appDataFolder/
├── launcher-state-device-A.json
├── launcher-state-device-B.json
├── asset-<sha256>.jpg
└── asset-<sha256>.jpg
```

Each device file contains:

- Groups.
- Items.
- Deletion tombstones.
- Schema version.
- Device ID.
- Revision number.
- Last update time.

Record model (identical in IndexedDB, device files, and ZIP exports):

```ts
type HLC = string; // hybrid logical clock: "<wallMs>-<counter>-<deviceId>", lexicographically comparable

interface Group {
  id: string;            // UUID, never reused
  parentId: string | null;
  orderKey: string;      // fractional index, e.g. "a0", "a0V"
  title: string;
  clock: Record<'parentId' | 'orderKey' | 'title', HLC>;
  deleted?: HLC;         // tombstone
}

interface Item {
  id: string;
  groupId: string;
  orderKey: string;
  url: string;           // http:, https:, or file: only
  title: string;
  previewHash?: string;  // sha256 of the JPEG blob
  clock: Record<'groupId' | 'orderKey' | 'url' | 'title' | 'previewHash', HLC>;
  deleted?: HLC;
}
```

Design choices:

- Ordering uses a fractional `orderKey` per record (for example the `fractional-indexing` package) rather than an ordered child array. Two devices reordering different items in the same group then merge without conflict; ties on equal keys sort by `id`.
- Conflicts resolve per field, not per record: a title edit on device A and a move on device B both survive.
- Hybrid logical clocks prevent a device with a fast system clock from permanently winning.
- A tombstone wins over any field change with an older clock. An edit made after the deletion (newer clock) resurrects the record. Pick one rule and test it; this plan uses "newer clock wins, deletion included".

Synchronization flow:

1. Save changes locally in IndexedDB immediately and mark the store dirty.
2. List `appDataFolder` files with `spaces=appDataFolder` and `fields=files(id,name,modifiedTime,appProperties)`. Download only device files whose `modifiedTime` changed since the last sync.
3. Merge records by stable ID, field by field, using HLC ordering.
4. Repair the group tree: if concurrent moves create a cycle or point to a deleted parent, move the affected group under the root and log it.
5. Upload the device’s merged state file. Use the stored Drive `fileId` and `PATCH`; create it only on first sync.
6. Upload missing preview assets by content hash, skipping hashes already listed in step 2.
7. Retry 429/5xx and network failures with exponential backoff and jitter. Do not retry 401 more than once or 403 quota errors automatically.
8. Keep local operation working when Drive is offline or unavailable.

Triggers: on launcher open, 10 seconds after the last local change (debounced), and every 15 minutes through `chrome.alarms`. Use a lock (`navigator.locks` in the service worker) so only one sync runs at a time across popup, dashboard, and worker.

Maintenance:

- Tombstones older than 90 days are purged during compaction. A device that has not synced for longer than that is treated as stale and offered the first-connection choice again.
- Device files not updated in 90 days are removed after their records are merged into the current device's file. This keeps reinstalls (which create new device IDs) from accumulating files.
- Asset files not referenced by any live record are deleted after the same grace period.

Drive stores the exact JPEG blob whose SHA-256 is referenced by `Item.previewHash`, with the existing 5 MB per-image limit. The 320×200 derivative is local-only because it has no synchronized hash; uploading it under the full preview's hash would make content verification fail on download. If quota measurements later justify smaller remote previews, add a separate synchronized hash for that derivative first. `appDataFolder` counts against the user's Drive quota, and quota failures must show a clear message.

On first connection, show item and group counts for both sides, then a choice:

- Merge local and Drive data.
- Replace local data with Drive data.
- Replace Drive data with local data.
- Cancel.

If Drive is empty, skip the dialog and upload. "Replace Drive data" writes tombstones for the records it removes rather than only deleting files, so other devices do not re-upload them on their next sync.

Changing Google accounts requires the same explicit choice. Disconnecting Drive retains local data.

Before any Replace action (Drive or ZIP), write an automatic local snapshot and keep the last three. Offer "Restore previous snapshot" in settings.

## Local storage and data

Use IndexedDB through Dexie for:

- Groups.
- Launcher items.
- JPEG blobs.
- Pending sync operations.
- Device-specific local-file status.
- Sync metadata.

Synchronize:

- Group structure.
- Saved URLs.
- Titles.
- Ordering.
- Shared settings.
- JPEG previews.

Keep local:

- Local-file availability checks.
- Device-specific path overrides.
- Browser history cache.
- Last-used group.
- Current UI state.

For `file://` links, preserve the original path. Do not package the HTML tools themselves into Drive or ZIP exports.

Chrome constraints for `file://`:

- An `<a href="file://...">` on an extension page is blocked. Open local links with `chrome.tabs.create({ url })`, which works for user-initiated navigation.
- Thumbnail capture and `fetch()` of local files require the user to enable "Allow access to file URLs" for the extension. Detect it with `chrome.extension.isAllowedFileSchemeAccess()` and show a one-time hint with a link to `chrome://extensions/?id=<extension-id>` (users have to open it themselves; extensions cannot navigate there for them).
- File existence cannot be checked reliably without that toggle. Use three states: `unknown` (default, no access), `available`, `missing`. Check only when file access is allowed, and only when the dashboard opens. Never block opening a link on the check.
- Paths differ between machines. Store a per-device path prefix override (for example `/Users/a/tools` → `C:\Users\a\tools`) locally and apply it when opening, not when saving, so synced data stays canonical.

## Thumbnails and hover previews

Capture:

- "Save current page" from the popup calls `chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 80 })`. The popup click grants `activeTab`, so no host permissions are needed.
- Resize with `OffscreenCanvas` to 640×400 for the stored preview and 320×200 for a local display derivative, then `convertToBlob({ type: 'image/jpeg', quality: 0.75 })`. Hash the stored preview with `crypto.subtle.digest('SHA-256', ...)`.
- `captureVisibleTab` cannot capture `chrome://`, Chrome Web Store, or other extension pages, and is rate-limited to about two calls per second. Fall back to favicon + title card.
- Items added without capture (history suggestions, imports without images, manual URLs) show the fallback card and an "Update thumbnail" action that opens the page and captures when the user returns to the popup. Do not open background tabs to auto-capture.
- Favicons: use the MV3 `favicon` permission and `chrome-extension://<id>/_favicon/?pageUrl=<url>&size=64` (build it with `chrome.runtime.getURL('/_favicon/')`). This avoids sending URLs to a third-party favicon service.

Hover previews:

- Default: after a 400 ms hover delay, show the 640×400 stored thumbnail in a popover with title and full URL. Works for every item, including local files.
- Live iframe previews are mostly blocked by `X-Frame-Options` and CSP `frame-ancestors` (Google, GitHub, most SaaS tools), and blocked frames do not fire a reliable error event. Keep this as an opt-in setting off by default, with a timeout fallback to the thumbnail. Never use `declarativeNetRequest` to strip frame-blocking headers; it weakens site security and invites Web Store rejection.

## Visited-site discovery

Request the optional permissions with `chrome.permissions.request()` from a click handler only when the user enables the feature. Removing the permission in settings calls `chrome.permissions.remove()` and clears the cached data.

Use two sources:

- `chrome.topSites.get()` for "Frequently visited". It returns Chrome's own most-visited list, which is what the user expects from the New Tab page, and it needs only the lighter `topSites` permission. ([Chrome Top Sites API](https://developer.chrome.com/docs/extensions/reference/api/topSites))
- `chrome.history.search({ text: '', startTime, maxResults })` for "Recently visited". Chrome supplies `visitCount`, `lastVisitTime`, and visit events. ([Chrome History API](https://developer.chrome.com/docs/extensions/reference/api/history))

If only `topSites` is granted, show only the frequent list. Filter out URLs already saved in the launcher and URLs the user has hidden (hidden list is local-only).

The feature displays:

- Recently visited pages.
- Frequently visited pages.
- Save-to-group action.
- Hide suggestion action.

It tracks browser history visits, not every network request. Network request monitoring would require a separate, more sensitive feature using APIs such as `webNavigation`.

## New-tab behavior

Do not implement a runtime “replace new tab” toggle in v1. Chrome declares new-tab replacement through the manifest, so it is package behavior rather than an ordinary preference. ([Override Chrome pages](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages))

Recommended rollout:

- v1: toolbar popup and full launcher only.
- Later: release a dedicated new-tab build after the launcher is stable.
- If both variants must coexist, they require separate extension IDs and separate OAuth clients. Create both clients in the same Google Cloud project so both builds read the same `appDataFolder` data, and give each install its own `deviceId`.
- Simpler alternative worth testing first: one extension whose launcher page is lightweight enough to open fast, plus a documented "set as homepage / pin tab" option. This avoids a second build entirely.

The new-tab build will use Chrome’s Search API so it respects the user’s configured search provider. ([Chrome Search API](https://developer.chrome.com/docs/extensions/reference/api/search))

## Import/export format

```text
launcher-export.zip
├── launcher.json
└── previews/
    ├── asset-001.jpg
    └── asset-002.jpg
```

Name preview files by content hash (`previews/<sha256>.jpg`) so the format matches Drive assets and duplicate images are stored once. `launcher.json` carries `format: "visual-launcher"`, `schemaVersion`, `exportedAt`, and the same `Group`/`Item` records as sync, without per-field clocks or tombstones.

Import supports Replace, Merge as copy, Update from source, and Cancel:

- Merge as copy: imported records get new IDs and land in a new top-level group named after the file. Duplicate URLs are preserved.
- Update from source: records match by ID. Use this when a colleague sends a newer export of the same library; it updates instead of duplicating.
- Replace: snapshot first (see Drive section), then replace.

The importer must validate the full archive before writing anything, and write in one Dexie transaction:

- Validate `launcher.json` against a schema (`zod`).
- Reject URL schemes other than `http:`, `https:`, and `file:`. A shared ZIP with a `javascript:` URL would otherwise run on click.
- Enforce limits: archive size, item count, per-image size, and that every referenced preview exists. Decode images with `createImageBitmap` and re-encode to JPEG, dropping anything that fails.
- Ignore archive paths outside `previews/`.

ZIP export is the supported way to share launcher data with colleagues. Use `fflate` for zip handling (small, works in the service worker).

## Implementation phases

Tooling: Vite with `@crxjs/vite-plugin` (or a plain multi-entry Vite build if the plugin lags behind Vite releases), Dexie, `@dnd-kit` for nested drag-and-drop, `fractional-indexing`, `fflate`, `zod`, Vitest for unit tests, Playwright with a persistent context for loading the unpacked extension in E2E tests. Pin exact versions.

1. Create the separate repository and stable extension identity (public key in manifest, private key outside git).
2. Spike (1–2 days, throwaway code): `getAuthToken` + `drive.appdata` round-trip, `captureVisibleTab` from the popup, opening a `file://` link from the extension page. Confirms the risky platform assumptions before UI work.
3. Configure Google Cloud, Drive API, OAuth consent, and test users. Put all OAuth clients in one Cloud project.
4. Define the shared record model, HLC, and merge function as a pure module with unit tests. Sync, ZIP, and the UI all depend on it.
5. Build popup, launcher page, service worker, and IndexedDB layer on that model.
6. Implement nested groups, items, ordering, and edit mode.
7. Implement save-current-page and thumbnail capture.
8. Implement local-file status and fallback behavior.
9. Implement hover previews (stored thumbnails).
10. Implement ZIP import/export.
11. Implement Drive synchronization, compaction, and conflict recovery.
12. Add optional history/top-sites discovery.
13. Test with two Chrome profiles and two computers.
14. Decide whether to ship a separate new-tab build.

## Acceptance tests

- Two devices converge on groups, links, ordering, and preview images.
- Offline changes upload after reconnection.
- Concurrent edits do not silently overwrite newer data.
- Deletions propagate correctly.
- Drive authorization failure leaves local operation usable.
- Account switching never mixes libraries silently.
- ZIP round-trips preserve metadata and images.
- Invalid ZIP files leave existing data unchanged.
- Missing local paths remain editable.
- Blocked iframe previews fall back cleanly.
- History permission denial disables only visited-site discovery.
- Drive quotas and upload failures produce actionable messages.
- Extension upgrades retain the same ID and OAuth configuration.
- Concurrent reorders of different items in the same group both survive.
- A title edit on one device and a move on another both survive.
- Concurrent moves that would create a group cycle end in a valid tree with no lost items.
- A device with its system clock set an hour ahead does not override newer edits from other devices.
- "Replace Drive data" does not get undone by another device's next sync.
- Reinstalling the extension does not leave growing numbers of device files after compaction.
- Imported `javascript:` and other disallowed URLs are rejected.
- Re-importing an updated colleague export with "Update from source" updates records instead of duplicating them.
- Restoring a pre-Replace snapshot returns the exact previous library.
- An expired or revoked token prompts reconnection without losing pending changes.

