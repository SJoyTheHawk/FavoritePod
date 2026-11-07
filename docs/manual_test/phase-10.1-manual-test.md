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

Drag accessibility follow-up checks reproduce an attempt to apply `aria-hidden`
while a card button is focused, including a focused sibling in a multi-selection.
The fix moves focus to the content area before hiding the selected cards, relies
on their existing `inert` state, and makes the visual drag copies inert. Isolated
Chrome checks pass for both selection cases, Escape cleanup, native mouse
drag/drop persistence, and card focusability after dropping, with no focused
`aria-hidden` mutations or related console warnings in the fixed build.

The recorded open-menu drag regression is also reproduced in isolated Chrome:
the action menu stayed visible after its anchor card moved offscreen. The menu
now closes on drag while its button remains mounted, portal focus is moved to
the content area, and hover previews stay closed during dragging. Browser checks
cover focused card/menu drag starts, cancellation, reopening the menu and Edit,
plus a separate native mouse reorder with persisted order and restored card
focusability. No related accessibility warnings or runtime exceptions appeared.

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

- [x] Open/close Settings, favorite, group, move, import/export, and Google Drive sign-in dialogs; confirm a subtle 200ms fade/scale without layout jumps.
- [x] Confirm Escape closes only the active overlay and focus returns to its trigger. Check nested sign-in and disconnect dialogs.
- [x] Confirm save/import/sync controls retain their existing busy/cancel behavior.
- [x] Drag one favorite, a multi-selection, and a nested group. Confirm existing ghost stacks, placement highlights, drop animation, and Escape cancellation still work.
    - Note: Pressing Esc when doing bookmark dragging will dismiss the bookmark, but the background does not return to the state of mouse release
- [ ] Focus a favorite's open button, then drag that favorite. Repeat with multiple selected favorites while focus is in a different selected card. Focus should move to the main content area before the cards hide; no `Blocked aria-hidden` warning should appear. Drag copies must not receive keyboard focus. Cancel with Escape and complete a drop; the restored cards must be focusable again.
- [x] Add/remove favorites and drag between groups in both directions (including onto a group header). Neighboring cards must not bounce or replay an old position; the moved card must not flash back in its source group. Repeat with multi-selection, Undo/Redo, small grid/list layouts, and a narrow window. Same-group reordering should retain smooth motion without overlapping animations.
- [x] Hover cards and open previews; confirm hover shadows do not move/reorder the grid.
- [ ] Open a favorite's action menu, then drag the card. The menu and hover preview must close without jumping to the window edge. After dropping or cancelling, the menu must stay closed and reopen normally; Edit must still work.
- [x] With a preview open, press Edit in the preview and in the card action menu. Confirm the preview closes immediately, stays closed while editing, and focus moves to Title. Repeat with a pending hover timer; Escape dismisses the editor directly.
- [x] In Edit favorite, use Remove image beside Upload image. Confirm the favorite remains, its fallback appears, removal is disabled without an image, and the change persists after reopening. Check Undo/Redo and upload another image.
- [x] Enable the OS Reduce Motion preference. Confirm no repeating pulse/spinner/indeterminate motion, no dialog movement, and no drag animation.

## Loading States

- [x] Reopen a populated launcher with CPU throttling; confirm skeletons match the chosen grid/list size, including compact grid, and resolve to favorites without changing layout.
- [x] Check favorites with saved thumbnails, missing blobs, and no thumbnail. Pending images have stable placeholders, decoded images fade in, and unavailable images use the existing fallback.
- [x] With an authorized Drive account, sync a library with previews. Counted stages display actual progress; checking/merging/unknown-count stages remain indeterminate.
- [x] Verify offline, failed sync, and completed sync replace progress with the existing correct status.
- [x] Use a screen reader to confirm a single loading status, labeled progress, native theme radios, and named icon buttons.

## Keyboard Navigation

- [x] Cmd+K on macOS / Ctrl+K on other platforms focuses and selects search. Type a query; Escape clears it.
- [x] Focus a favorite's open control. Left/right move to adjacent favorites; up/down follow the nearest visual row/column. Home/End move to first/last visible favorite.
- [x] Repeat in list, compact grid/list, other card sizes, filtered search, expanded groups, and a narrow window. Collapsed groups are skipped.
- [x] Confirm arrows still work normally in text fields, select menus, native theme radios, and action menus. Modified shortcuts and input composition are not captured.
- [x] Confirm Cmd/Ctrl+K cannot pull focus out of a modal; Cmd/Ctrl+Z still edits text inside fields and performs library undo outside fields.
- [x] Tab to Skip to favorites and activate it; confirm focus moves to the content area.

## Manual Acceptance

- [x] Real OS light/dark changes and persistent override accepted.
- [x] Native toolbar popup, drag/drop, busy actions, and nested dialogs accepted.
- [x] Live Drive progress and screen-reader behavior accepted.
- [x] Light/dark and desktop/narrow layouts accepted.

## Expected Results

- Exactly one of System, Light, or Dark is selected.
- System mode reflects OS preference changes while the page is open.
- Light and Dark modes remain fixed regardless of OS preference.
- The preference persists across launcher and popup openings.
- No console errors appear while changing or loading the preference.
