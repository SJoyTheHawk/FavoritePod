# Phase 10.1 Manual Test: Design System Finalization

**Status (2026-11-07)**: Implementation and automated checks complete; user manual acceptance pending.

## Automated Browser Evidence

An isolated Chrome 157.0.8103.38 production extension profile passes theme persistence,
emulated foreground OS changes, live preferences across dashboard/popup pages,
dialog enter/exit and focus restoration, Escape, Cmd+K, favorite arrow/Home/End
navigation, focus trapping, reduced motion, thumbnail decoding, and 375px layout
checks with no runtime exceptions. Favorite, move, archive, sign-in, and popup
dialogs were exercised. Light/dark/narrow screenshots were visually reviewed.
The profile uses fixture favorites, does not authorize Google Drive, and does not
alter the user's Chrome profile or production extension permissions.

Unit coverage includes theme persistence/invalid defaults, responsive navigation
geometry, and determinate/indeterminate progress semantics. These checks do not
replace the native interactions below.

Edit-favorite follow-up checks also pass in the isolated production extension:
pressing Edit in the hover preview or card menu immediately closes the preview,
keeps focus in the editor, and allows one Escape to dismiss the editor. Image
removal, undo/redo, persistence after reload, upload after removal, and side-by-side
image controls in dark desktop/light narrow layouts pass without runtime errors.

Bookmark motion regression checks cover group transfers in both directions,
group-header drops, multi-selection transfers and undo, add/delete/undo, same-group
reordering, Escape cancellation, reduced motion, and narrow layouts. Group changes
do not replay neighboring cards' positions; same-group reordering keeps its motion
without stacking animations. The source card stays hidden until persistence is
reflected in the destination.

## Setup

1. Build the extension with `npm run build`.
2. Load or reload the `dist/` directory as an unpacked extension in Chrome.
3. Open the FavoritePod launcher.

## Theme Checks

1. Open Settings and select **System**. Confirm the launcher follows the current operating-system appearance.
2. Change the operating-system appearance while the launcher is open. Confirm the launcher updates without reloading.
3. Select **Light** and confirm the launcher stays light after changing the operating-system appearance.
4. Close and reopen the launcher. Confirm the selected appearance persists.
5. Open the toolbar popup. Confirm it uses the same saved appearance as the launcher.
6. Select **Dark**, then repeat the reopen and popup checks.
7. Select **System** again and confirm system preference changes are followed.
8. Keep two launcher tabs and the popup open. Change the preference in one launcher and confirm other open pages update.
9. Use Tab and arrow keys in the Appearance radio group. Confirm one selected option and visible focus.

## Motion and Dialogs

- [ ] Open/close Settings, favorite, group, move, import/export, and Google Drive sign-in dialogs; confirm a subtle 200ms fade/scale without layout jumps.
- [ ] Confirm Escape closes only the active overlay and focus returns to its trigger. Check nested sign-in and disconnect dialogs.
- [ ] Confirm save/import/sync controls retain their existing busy/cancel behavior.
- [ ] Drag one favorite, a multi-selection, and a nested group. Confirm existing ghost stacks, placement highlights, drop animation, and Escape cancellation still work.
- [ ] Add/remove favorites and drag between groups in both directions (including onto a group header). Neighboring cards must not bounce or replay an old position; the moved card must not flash back in its source group. Repeat with multi-selection, Undo/Redo, small grid/list layouts, and a narrow window. Same-group reordering should retain smooth motion without overlapping animations.
- [ ] Hover cards and open previews; confirm hover shadows do not move/reorder the grid.
- [ ] With a preview open, press Edit in the preview and in the card action menu. Confirm the preview closes immediately, stays closed while editing, and focus moves to Title. Repeat with a pending hover timer; Escape dismisses the editor directly.
- [ ] In Edit favorite, use Remove image beside Upload image. Confirm the favorite remains, its fallback appears, removal is disabled without an image, and the change persists after reopening. Check Undo/Redo and upload another image.
- [ ] Enable the OS Reduce Motion preference. Confirm no repeating pulse/spinner/indeterminate motion, no dialog movement, and no drag animation.

## Loading States

- [ ] Reopen a populated launcher with CPU throttling; confirm skeletons match the chosen grid/list size, including compact grid, and resolve to favorites without changing layout.
- [ ] Check favorites with saved thumbnails, missing blobs, and no thumbnail. Pending images have stable placeholders, decoded images fade in, and unavailable images use the existing fallback.
- [ ] With an authorized Drive account, sync a library with previews. Counted stages display actual progress; checking/merging/unknown-count stages remain indeterminate.
- [ ] Verify offline, failed sync, and completed sync replace progress with the existing correct status.
- [ ] Use a screen reader to confirm a single loading status, labeled progress, native theme radios, and named icon buttons.

## Keyboard Navigation

- [ ] Cmd+K on macOS / Ctrl+K on other platforms focuses and selects search. Type a query; Escape clears it.
- [ ] Focus a favorite's open control. Left/right move to adjacent favorites; up/down follow the nearest visual row/column. Home/End move to first/last visible favorite.
- [ ] Repeat in list, compact grid/list, other card sizes, filtered search, expanded groups, and a narrow window. Collapsed groups are skipped.
- [ ] Confirm arrows still work normally in text fields, select menus, native theme radios, and action menus. Modified shortcuts and input composition are not captured.
- [ ] Confirm Cmd/Ctrl+K cannot pull focus out of a modal; Cmd/Ctrl+Z still edits text inside fields and performs library undo outside fields.
- [ ] Tab to Skip to favorites and activate it; confirm focus moves to the content area.

## Manual Acceptance

- [ ] Real OS light/dark changes and persistent override accepted.
- [ ] Native toolbar popup, drag/drop, busy actions, and nested dialogs accepted.
- [ ] Live Drive progress and screen-reader behavior accepted.
- [ ] Light/dark and desktop/narrow layouts accepted.

## Expected Results

- Exactly one of System, Light, or Dark is selected.
- System mode reflects OS preference changes while the page is open.
- Light and Dark modes remain fixed regardless of OS preference.
- The preference persists across launcher and popup openings.
- No console errors appear while changing or loading the preference.
