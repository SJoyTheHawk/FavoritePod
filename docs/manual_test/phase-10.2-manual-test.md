# Phase 10.2 Manual Test: Performance Optimization

**Status (2026-11-08)**: Closed after user-reported manual acceptance. All 11 manual
checks are marked complete. The user accepts the current optimization for this
stage, including the remaining memory cost with large numbers of groups.

## Closure Verification

- The user's completed checklist covers large-library loading and scrolling,
  grid/list resizing, search, selection, keyboard navigation, drag/drop and
  immediate Escape cancellation, previews, group collapse/expand, and memory.
- Final resource policy: 50% of the viewport height above and below; no additional
  unused card-thumbnail cache; ten most recently opened distinct hover images.
- Follow-up fixes include small image derivatives, bounded/cancelled image work,
  offscreen virtualizer suspension, active-only document measurement, on-demand
  group menu panels, and shared bounded file-availability status checks.
- Known limitation accepted: large group structures still retain substantial DOM
  and memory. The user chose to stop optimization here. Further group-tree
  optimization and bundle compression are deferred beyond this phase.
- Automated evidence is separate from the user's acceptance: 263 tests across 32
  files, TypeScript production compilation, lint, formatting, and production build
  pass. Isolated browser checks cover the reported regressions and cache policies.
- No Phase 10.2 acceptance blockers remain. Unmeasured performance targets are
  reference goals, not claims of verified timings. Phases 10.3–10.4 remain separate.

The investigation sections below preserve the chronological evidence and measured
limitations. Earlier pending-retest notes are superseded by this closure.

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
- [x] Open and close previews while scrolling repeated-hash and distinct-image favorites; confirm small previews appear, the final ten-image hover cache policy works, and failures use the existing fallback.
- [x] Collapse and expand groups while the page is scrolled; confirm descendant counts, focus, drop targets, and scroll positions remain usable.
- [x] Compare settled Chrome Task Manager memory with the prior build using the same profile, viewport, and library; record the result without assuming the isolated synthetic profile represents every device.

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
mounted cards. The user has checked the cancellation item above.
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
acceptance marks above. The user's normal-profile memory measurements and accepted
remaining limitation are recorded in the later follow-ups and closure.

## Scrolling Memory Follow-up (2026-11-08)

The user reported approximately 111 MB after importing 3,240 favorites, growing to
4.1 GB while scrolling. An isolated production fixture with 3,240 distinct
1280 × 800 previews across 54 groups reproduced resource accumulation. Window
virtualizers kept edge rows mounted in groups outside the viewport; one-shot image
observation then kept their thumbnails active. Imported previews without smallBlob
also decoded full-size images for cards. The initial shared-image, single-group
profile did not exercise these cases.

Offscreen collections now release ordinary cards while preserving their scroll
height and pinned drag/keyboard targets. Continuous viewport observation releases
card images and closes hover previews on exit. URLs revoke when the last consumer
releases, with independent ownership for drag copies. Four concurrent image jobs
bound storage/decode work, and cancelled queued requests are skipped. Missing card
previews are generated at 320 × 200 and persisted without changing originals.

Before the later 50% viewport tuning, the same fixture, viewport, and two-pass
scrolling sequence produced:

| Sampled metric | Before fix | After fix |
| --- | ---: | ---: |
| Maximum mounted cards at checkpoints | 1,745 | 50 |
| Maximum active thumbnail URLs at checkpoints | 1,724 | 32 |
| Active URLs after returning to the top | 359 | 25 |
| JavaScript heap after returning to the top | 886.9 MB | 30.5 MB |
| Largest card image width | 1,280 px | 320 px |

Afterward 3,307 of 3,332 created URLs had been revoked; the remaining 25 belonged
to nearby cards. These are synthetic measurements at checkpoints, not continuous
peak measurements or Chrome Task Manager's total process footprint. They verify
resource release but do not establish exact RAM reduction on the user's library.

Before the later ten-image hover cache, an isolated Chrome check confirmed that opening a hover preview acquires the
original image, closing it releases that resource, collapsing its group releases
the final card image, and expanding reuses the persisted 320 × 200 derivative.
The stored original remains 1280 × 800.

Large-library native drag cancellation, source retention after scrolling,
End navigation, and narrow-window checks still pass. Subsequent normal-profile
memory testing and the user's acceptance are recorded below. Chrome Task Manager
totals remain distinct from JavaScript heap.

## Viewport Buffer Tuning (2026-11-08)

The agreed initial buffer is 50% of the window scroll viewport height above and
below. For an 800 CSS-pixel viewport, images are retained within 400px above/below;
the total vertical window is 1600px. Whole-row overscan rounds outward to cover
this image window. Height changes update the shared observer and row count;
width/card-size changes also recalculate the rows. The scrolling dashboard header
is normal document content; browser chrome is outside the viewport, and transient
overlays do not resize this policy.

This change does not add the proposed recently-used thumbnail memory cache.
Small card images are saved 320 × 200 derivatives; full hover images are the saved
originals used in the floating preview. Final-consumer URL release preserves both
images in IndexedDB. At this stage full hover URLs released when the preview
closed; the subsequent approved policy below supersedes that behavior.

Automated Chrome checks with 360 distinct previews across six groups pass at
viewport heights 600, 920, and 1200px, plus a 375px-wide window. Images remain
allocated during scroll reversal inside the buffer, release beyond its boundary,
and load throughout the buffered mounted region after resizing. The 5,760-item
native drag cancellation, End navigation, and narrow-window checks also pass.
These are automated checks; user memory and scrolling acceptance was pending at
this point and is now complete as recorded in the closure.

The 3,240-distinct-preview, 54-group two-pass regression also passes with the new
buffer: sampled mounted cards peak at 55 and active image URLs at 50. Returning
to the top leaves 35 cards and 30 URLs; 3,104 of 3,134 URLs were revoked. Final
JavaScript heap is 72.4 MB without forcing garbage collection. These checkpoint
measurements are not total Chrome process RAM or a continuous peak measurement.

## Ten-Image Hover Cache (2026-11-08)

The user declined an additional unused card-thumbnail cache. Card thumbnails
remain governed by the 50% viewport buffer and final-consumer release. Full-size
hover resources now retain the ten most recently opened distinct image hashes.
Reopening refreshes recency; closing does not. Opening an eleventh evicts the
oldest resource once it has no active consumer. An evicted but still-open preview
remains valid until it closes. Failed or cancelled pending loads are not cached.
The cache lasts for the dashboard page lifetime and never deletes saved originals.

Unit tests cover ten-entry eviction, reopen recency, shared active ownership,
out-of-order completion, cancellation, and unchanged small-image release. An
isolated production Chrome check opens ten previews, reopens the first, opens an
eleventh, and confirms the second is evicted. Reopening the evicted image reloads
it from storage and evicts the next oldest. Collapsing the group leaves exactly
ten hover URLs and no card-thumbnail URLs (36 created, 26 revoked). All 259 tests,
production build, lint, and formatting checks pass. The completed user checklist
and closure now include this final policy.

## Investigating the 1.6 GB Scrolling Report (2026-11-08)

The user reported 1.6 GB in Chrome Task Manager while scrolling only. At this
stage the cause was not established. Earlier JS-heap/resource-count profiles do not measure total
process memory and cannot rule out native image memory or browser caches.

The dashboard exposes a lazy-loaded, read-only diagnostic through
window.favoritePodMemoryReport(). It returns aggregate numbers only: no bookmark
titles, paths, addresses, image URLs, hashes, or blobs. It reads item/group metadata
one record at a time, never the thumbnail table. It does not change cache policy.

1. Reload the extension and refresh the dashboard to load the instrumented build.
2. In Chrome Task Manager, enable JavaScript memory alongside Memory footprint.
   Record the FavoritePod row, its process ID, and the live JS value in parentheses.
3. On the dashboard, open DevTools Console and run:

   copy(JSON.stringify(await window.favoritePodMemoryReport(), null, 2))

4. Save the initial output, scroll until memory grows, pause, then run it again.
   Keep both Task Manager readings with the reports. Note other open FavoritePod
   tabs and whether the pointer paused over cards (hover can open automatically).
5. If live JS grows, compare DevTools Memory heap snapshots before/after the same
   action and inspect retained objects and detached DOM trees. If process memory
   grows while live JS and app-owned resources stay bounded, investigate native
   image/cache memory with Chrome profiling instead of inferring a metadata leak.

Report caveats: encodedBytes measures live object-URL blob payloads, not decoded
RAM. RGBA byte estimates use width × height × 4 and are not measured allocations;
mounted images may share storage. Library JSON character counts are serialized
record sizes, not retained heap. JS heap is sampled before the metadata scan;
the scan allocates temporary strings. Reports are snapshots, not continuous peaks,
and cannot account for every byte of Chrome process or GPU memory.

The instrumented 3,240-item synthetic run validates the report against URL
create/revoke instrumentation: 30 live small URLs, zero cached hover images,
35 mounted cards, 40 loaded favicon elements, and no queued jobs at the final
checkpoint. Card RGBA estimate is 7.68 MB; favicon estimate is 0.164 MB. Metadata
contains 1,449,720 item JSON characters and 12,140 group JSON characters. This
fixture has no embedded favicon data and does not reproduce the user's library.
JS heap is 68.9 MB before explicit GC and 27.1 MB afterward. The largest renderer
RSS from ps is 512.3 MiB before GC and 296.5 MiB afterward; these OS resident-size
samples are not Chrome Task Manager footprint measurements. The subsequent
real-profile report is analyzed in the next section. All 260 tests, build, lint,
format checks, and isolated report assertions pass.

## Many-Group and Missing-File Follow-up (2026-11-08)

The user's report has 3,240 items and 1,439 groups, with 37,560–37,930 mounted
elements but only 18–36 cards. JS heap rises from 272.7 MB to 584.9 MB. Image
resource counts and bytes are unchanged (nine small URLs, one full URL, no queued
work). The supplied log contains 88 ERR_FILE_NOT_FOUND requests for the same
intentionally removed file. Metadata character counts are unchanged; these
observations do not support active thumbnail/favicons as the source of the JS
increase, though they do not account for every byte of browser memory.

A matched-shape synthetic fixture (3,240 items, 1,439 root groups, nine shared
previews, no local files) reproduces a 596.6 MB sampled JS peak and approximately
1.49 GiB largest-renderer RSS after scrolling. This demonstrates that the spike
can occur without missing-file failures. Allocation sampling identifies collection
measurement/render work and closed group menu components. The earlier 54-group
fixture was not representative of this library's group count.

Changes: suspend offscreen virtualizer subscriptions while preserving height and
focused/drag pins; observe document-wide size only for active collections; mount
group menu panels only when open. File probes share in-flight requests and at most
256 30-second cached statuses by rewritten path; they cancel unread response
bodies and time out after five seconds. The image policy remains 50% viewport
buffers and ten recently opened full hover images.

In the same two-pass synthetic sequence, sampled JS peak falls from 596.6 MB to
399.1 MB. After explicit GC, live JS falls from 226.1 MB to 157.9 MB. Largest
renderer RSS at the end falls from 1.49 GiB to 1.19 GiB, and after GC from 850.9 MiB
to 667.1 MiB. RSS is an OS measurement, not Chrome Task Manager's footprint, and
these are sampled single runs. Roughly 36,000 elements remain mounted: the large
group structure still has a material baseline cost. The user accepts this
limitation for the current stage and defers further optimization; closure does
not claim that all high memory use is solved.

All 263 tests, production build, lint, and formatting pass. Browser regressions
cover group-menu pointer and keyboard opening, Escape focus restoration, edit
action, group collapse/expand, 50% boundaries/resizing, and native drag cancellation
after scrolling 50,000px with 5,760 items. The report now includes active versus
total virtual collections and file probe counts without exposing local paths.

## Post-Closure Cross-Group Motion Follow-up (2026-11-08)

The user reported that neighboring cards animate only for same-group drags.
The prior cross-group guard disabled preview motion, and destination order
revisions omitted the foreign dragged favorite's placeholder. Cross-group
placeholder entry, retargeting, and exit now animate existing cards using the
same 220ms motion as same-group reorder. Collection membership changes still
suppress old-position replay on commit, ordinary add/remove, and undo. Escape
keeps its immediate non-animated reset; reduced-motion preferences are respected.

This is a post-closure bug fix; the original manual acceptance marks are retained.
Automated browser follow-up is recorded separately from user acceptance.

Verification: all 264 unit tests, production build, lint, and formatting pass.
Isolated Chrome checks cover cross-group placeholder entry and retargeting in
grid/list views, single and multiple selection, persisted destination groups,
same-group motion, and reduced motion. Single-card drops do not replay neighbor
movement. For multiple selection, neighbors settle once when the single stack
placeholder becomes the saved cards; animations do not stack. Escape restores
order without return animation, including native cancellation after scrolling
50,000px in a 5,760-favorite collection.

## Post-Closure ResizeObserver Follow-up (2026-11-08)

The user reported "ResizeObserver loop completed with undelivered notifications"
at the dashboard HTML entry. Row resize callbacks directly changed virtualizer
measurements, while collection and hover-preview observers updated React layout
inside observer delivery. These updates now run through a frame-scheduled helper
that batches the latest notification per target and cancels pending work on
cleanup. Unchanged hover-preview positions no longer schedule a state update.
Initial collection measurement and synchronous drag cancellation are preserved.

The warning did not reproduce consistently in the small isolated fixture before
the fix, so the original trigger is not claimed as conclusively reproduced.
After the change, isolated Chrome captures no window errors during repeated
viewport resizing, grid/list switching, hover-preview resizing, or group
collapse/expand. Cross-group animation and native Escape cancellation after
scrolling 50,000px with 5,760 favorites still pass. All 266 tests, production
build, lint, and formatting pass; the new tests verify frame batching and
cleanup of queued callbacks. User manual acceptance marks remain unchanged.
