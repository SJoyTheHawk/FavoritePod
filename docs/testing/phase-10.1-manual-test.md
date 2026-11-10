# Phase 10.1 Manual Test: Design System Finalization

**Status (2026-11-07)**: Closed after user-reported manual acceptance. All manual
checkboxes are checked. The Escape-during-drag note is resolved and independently
verified in isolated Chrome; the original acceptance marks are preserved below.

## Closure Verification

- User confirmed completion of phase 10.1 manual testing, including OS appearance,
  the native popup and drag/drop, live Drive progress, screen-reader behavior, and
  light/dark desktop/narrow layouts.
- Resolved the reported cancellation issue: Escape now clears group-header and
  sidebar drop highlights along with the dragged preview and placeholder. Native
  drag termination also restores the layout even when no Escape key event reaches
  the page. A drop already saving retains its existing persistence behavior.
- Isolated Chrome regression checks reproduce the old stuck highlights and verify
  their removal for individual and multiple favorites. Native mouse drag followed
  by browser cancellation clears hidden/inert cards, placeholders, and temporary
  ordering; a subsequent native drop persists its new order without runtime errors.
  These are automated follow-up results, separate from the user's manual acceptance.
- All 233 tests across 26 files pass with coverage enabled; the configured merge
  module coverage remains 100%. TypeScript production compilation, ESLint,
  repository formatting checks, and the production build pass.
- No phase 10.1 acceptance blockers remain. Explicitly deferred polish and the
  performance, broader testing, and documentation work in phases 10.2–10.4 remain
  outside this closure.

## Automated Browser Evidence

Mouse-release parity follow-up (2026-11-07): Escape now invokes FavoriteCard's
exact native dragend completion handler, including temporary card/entry size cleanup
and the parent callback. Matched synthetic Escape/dragend checks produce identical
restored states for one favorite and a multi-selection over a group header. Native
Chrome cancellation and a subsequent saved reorder also pass. All 233 unit tests,
lint, formatting, and the production build pass after this change.

Post-closure timing follow-up (2026-11-07): the user reported a 1–2 second gap
between ghost dismissal and layout restoration. No intentional timer was present.
Instrumentation confirmed that the ghost was removed before the React commit and
that cancellation then replayed 220–300ms card animations. Shared synchronous
cleanup now commits both together and skips cancellation motion. Repeated sibling
sorting and cancellation geometry reads were also removed. In isolated Chrome with
5,760 fixture favorites, measured reset work improved from about 1,462ms in the
initial synchronous version to 537ms, with no remaining ghost, placeholder, hidden
cards, or card animations at event return. This removes the split visual update;
large collections still incur render cost and need the planned phase 10.2 work.
Native cancellation, multi-selection, group targets, and subsequent persisted drops
pass in the final build. Timing varies with hardware and collection contents.

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
  - **Resolved (2026-11-07)** — Original note: "Pressing Esc when doing bookmark dragging will dismiss the bookmark, but the background does not return to the state of mouse release."
    Shared capture-phase cancellation cleanup now resets the grid preview and both
    group-header/sidebar drop highlights on Escape or native dragend. Regression
    coverage includes cancellation without mouse release and a subsequent saved drop.
    The later timing follow-up also synchronizes ghost/layout cleanup and removes
    cancellation animations; it is verified separately from the original manual mark.
- [x] Focus a favorite's open button, then drag that favorite. Repeat with multiple selected favorites while focus is in a different selected card. Focus should move to the main content area before the cards hide; no `Blocked aria-hidden` warning should appear. Drag copies must not receive keyboard focus. Cancel with Escape and complete a drop; the restored cards must be focusable again.
- [x] Add/remove favorites and drag between groups in both directions (including onto a group header). Neighboring cards must not bounce or replay an old position; the moved card must not flash back in its source group. Repeat with multi-selection, Undo/Redo, small grid/list layouts, and a narrow window. Same-group reordering should retain smooth motion without overlapping animations.
- [x] Hover cards and open previews; confirm hover shadows do not move/reorder the grid.
- [x] Open a favorite's action menu, then drag the card. The menu and hover preview must close without jumping to the window edge. After dropping or cancelling, the menu must stay closed and reopen normally; Edit must still work.
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
