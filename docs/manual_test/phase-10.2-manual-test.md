# Phase 10.2 Manual Test: Performance Optimization

**Status (2026-11-08)**: Manual acceptance is underway; checked items below reflect
the user's results. The reported Escape regression is fixed and verified in isolated
Chrome. Cancellation retesting and device memory checks remain pending.

## Setup

1. Build the extension with `npm run build` and reload the unpacked extension from `dist/`.
2. Use a library with at least 1,000 favorites. Include several groups, repeated preview hashes, and distinct previews.
3. Open the dashboard in a fresh tab and note the viewport and Chrome Task Manager memory before testing.

## Manual Checks

- [x] Open All favorites with 1,000+ entries and confirm the dashboard becomes usable without a long pause.
- [x] Scroll from top to bottom and back several times in grid and list layouts; confirm rows do not disappear, overlap, or leave blank gaps.
- [x] Change bookmark size and resize the window from wide desktop to narrow/mobile width; confirm columns and scroll height remain correct.
- [x] Type a search quickly, pause, and confirm only the final query is shown after a short debounce; clear it with the input's Escape key.
- [x] Select favorites at the top and bottom, scroll between them, and confirm selection remains checked. Verify Select all, Move, and Delete still cover the complete result set.
- [x] Focus a favorite and use Left/Right/Up/Down, Home, and End across virtual rows and expanded groups; confirm focus scrolls to off-screen favorites and ignores collapsed groups.
- [x] Drag one favorite and a multi-selection within and between groups, including while scrolling toward the collection edge; confirm the drag source and placeholder remain stable and the saved destination persists after refresh.
- [x] Cancel a drag with Escape and confirm the original order returns immediately with no stale placeholder or group highlight.
- [x] Open and close previews while scrolling repeated-hash and distinct-image favorites; confirm small previews appear, full-size previews release on close, and failures use the existing fallback.
- [x] Collapse and expand groups while the page is scrolled; confirm descendant counts, focus, drop targets, and scroll positions remain usable.
- [ ] Compare settled Chrome Task Manager memory with the prior build using the same profile, viewport, and library; record the result without assuming the isolated synthetic profile represents every device.

## Escape Cancellation Follow-up

The screen recording reproduced a virtualization regression: inserting the drag
placeholder changed the row key and detached the original native drag source.
Its cleanup removed the ghost, but Chrome's cancellation dragend could no longer
bubble to the shared page listener, leaving the preview order active.

Favorite slots now keep stable favorite-ID keys under the same collection parent,
including across row changes. The hidden native source remains mounted while
scrolling and takes no layout slot; selected favorites share one placeholder.
Escape and native dragend retain the existing synchronous cleanup with no added
delay or return animation.

Isolated production Chrome verifies original-order restoration at native dragend,
before mouse release, for single and multiple favorites in grid/list layouts and
hierarchical/labeled groups. Delivered Escape events also pass in labeled/flat
views. Cancellation after scrolling 50,000px in a 5,760-favorite collection leaves
no ghost, placeholder, hidden card, or active card animation. Scrolling back shows
the original first row; End navigation and a 375px resize still work with bounded
mounted cards. The unchecked cancellation item above remains for user retesting.
A subsequent native drop after these cancellation cases persists its new order;
the pending-save guard retains the placeholder until that order is observed.

## Automated Profile

An isolated production Chrome profile was seeded with 5,760 favorites in one group,
all referencing the same valid thumbnail. Before virtualization, 5,760 cards and
11,520 card images mounted; first card rendering took about 2.2s, settled loading
took about 4.7s, and the renderer reported about 1.4GB JS heap. After the change,
the first 9 cards appeared in about 100ms; settled loading took about 1.1s with
about 20.8MB JS heap and 9 cards mounted. Three visible preview images shared
one object URL. End navigation focused the final favorite, and selection
remained checked after the favorite unmounted and remounted during scrolling.
The same run collapsed and expanded the group, observed search stay at 5,760
results during the 300ms debounce and then filter to one, cleared search back to
5,760, and switched to list layout with four cards mounted.

These are automated synthetic-profile measurements, separate from the user's
acceptance marks above. Chrome Task Manager memory and cancellation retesting
still need verification in the user's normal extension profile.
