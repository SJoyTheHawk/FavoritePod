# Bookmark thumbnail review

## Flow

1. Open a website, invoke FavoritePod from Chrome’s toolbar, and click Add bookmark.
2. Inspect the full thumbnail. Refresh captures the current page again; Remove
   clears only the pending thumbnail. No temporary tab or broad access prompt appears.
3. Before Save, check that the bookmark already exists in IndexedDB and its initial
   preview is stored when capture succeeds. Closing must keep both.
4. Remove, then Save: the bookmark exists without a previewHash. It is not deleted.
5. Reopen the same page’s Add bookmark dialog: Refresh, then Save updates the
   existing bookmark without making a duplicate. Closing discards image changes.
6. Confirm a capture failure retains the previous image and still allows Save.
7. During capture, Remove, Delete, or closing must prevent a late result restoring
   the image. Delete removes the saved bookmark; Remove only clears its thumbnail.
8. Switch tabs or navigate during capture: discard the result. Refresh never
   creates, closes, or selects any tab.
9. A concurrent address/thumbnail change or deletion rejects a stale Save.
10. Dashboard menu → Edit has Upload image only; Refresh thumbnail is absent.
11. The toolbar footer keeps Delete and Save. Delete removes the automatically
    saved bookmark. Right-click save requests retain Cancel and Save.

## Local files and right-click

- Local files show the same controls. Without file access, capture shows guidance;
  Save without a thumbnail remains available when the page address is readable.
- Enable Allow access to file URLs and capture a local HTML page.
- Open a favorite using a device path override, then Add bookmark: it edits the
  existing record and preserves the saved original URL.
- Saving a right-clicked link never captures its containing page. Refresh is
  disabled; open the link first to capture its page. Right-click page requests preview
  the invoking page when Chrome has granted activeTab access.

## Verification

Unit tests cover target validation, capture queue checks, tab switching away and
back, navigation, close/detach, cancellation, local-file permission, stale saves,
removal sync clocks, and atomic image/detail writes.

### Recorded Chrome verification — 2026-11-07

Chrome 157.0.8103.38 passed the following checks in a disposable headless profile
with the unchanged production manifest. CDP `Extensions.triggerAction` invoked
the real toolbar action, granting activeTab normally; all-sites access remained
absent throughout. No normal Chrome profile or library was modified.

- Actual website capture and Refresh succeeded. Tab IDs were unchanged.
- Toolbar additions and initial previews were stored before Save. Closing kept
  them, and reopening edited the same bookmark without duplicates.
- Remove → Save cleared the saved bookmark’s image. Refresh → Save updated an
  existing record without duplicating it. Save confirmed changes on the same record.
- Failed refresh preserved the preview; cancelled removal preserved the saved
  image. Remove during a delayed capture discarded the late result.
- Local HTML capture succeeded after enabling file access in the test profile.
- A device path override matched the existing bookmark and preserved its URL.
- A link-save request disabled Refresh and saved without a containing-page image.
- The actual dashboard favorite menu → Edit showed Upload image and no Refresh.
- The toolbar footer showed Delete and Save. Delete removed an automatic addition and
  deleted an existing bookmark during a delayed capture without restoring it or
  affecting other bookmarks. Closing discarded unsaved thumbnail removal.
- Light/dark popup screenshots were reviewed; preview and action buttons were
  visible without horizontal overflow. Short browser windows scroll form content.

Drive network sync was not exercised in this browser run. Existing sync tests
and thumbnail storage tests cover the updated preview hash and removal clock.

The explanatory thumbnail helper text is removed for a cleaner popup.
