# Reduce FavoritePod’s memory use while keeping continuous scrolling

## Findings and approach

The strongest approach is **rendering only the favorites near the screen, sharing duplicate images, and loading large previews only when needed**.

The code contains several likely contributors:

- [DashboardApp.tsx](/Users/szemy/Workspace/FavoritePod/src/dashboard/DashboardApp.tsx:1326) mounts every matching favorite. “All favorites” can therefore mount all 5,760 cards.
- [FavoriteCard.tsx](/Users/szemy/Workspace/FavoritePod/src/dashboard/components/FavoriteCard.tsx:238) retrieves thumbnails and creates both small and full-size image URLs for every mounted card—even when favorites share the same image.
- [import.ts](/Users/szemy/Workspace/FavoritePod/src/core/import.ts:269) imports previews without the smaller card image, so imported favorites fall back to the original image.
- Each group branch builds its own lookup of the entire group hierarchy, and collapsed branches remain mounted.

These are confirmed code behaviors, but their individual contribution to the reported **2.0 GB** still needs profiling. Chrome Task Manager’s memory footprint includes more than JavaScript memory; measure both during validation. ([developer.chrome.com](https://developer.chrome.com/docs/devtools/memory-problems))

## Implementation

1. **Virtualize the favorite grid and list.** Keep the complete searchable metadata in memory, but mount only visible rows plus two extra rows above and below. Use a shared windowing helper, existing card dimensions, and `ResizeObserver` to handle all sizes, responsive columns, and sidebar changes. Preserve the full scroll height; changing the search or group starts at the beginning of its results.

2. **Preserve interactions across unmounted cards.** Keep selection and ordering keyed by favorite ID in the dashboard. “Select all” continues to cover every matching favorite. Calculate drag destinations from logical positions rather than requiring every card in the DOM; preserve edge scrolling and keep the active drag source mounted until completion. Retain focused cards and cards with open menus/previews, and mount adjacent rows when keyboard navigation crosses a rendered boundary.

3. **Share thumbnail resources by image hash and size.** Add an internal thumbnail service returning an image URL and a release function. Deduplicate concurrent requests, limit loading/conversion to four jobs, and reference-count active consumers. Keep at most 64 unused small previews, additionally capped at 16 MiB of encoded blobs; evict unused entries and revoke their URLs. Release full-size previews when closed. Object URLs require explicit lifecycle management because each creation produces a separate URL that retains its backing object. ([developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob))

4. **Create missing small previews on demand.** Generate and persist a 320 × 200 derivative when an imported image first needs a card preview. Preserve the original image and hash. Compact cards request no screenshot until their hover preview opens; full-size image URLs are acquired only for an open preview.

5. **Bound group rendering and repeated calculations.** Build group-child and item-sibling indexes once per data update. Flatten expanded groups into ordered rows and virtualize those rows using the same windowing helper, including the mobile sidebar’s scroll container. Collapsed descendants are unmounted. Preserve group counts, nesting, expansion, and drop behavior.

## Validation

- Compare the existing and updated production builds using the same 5,760-favorite dataset, Chrome profile, viewport, and opening group. Record opening peak, settled memory, JavaScript heap, and mounted-card count.
- Scroll through the whole library repeatedly, switch groups/layouts, and open/close previews. Verify rendered cards stay bounded by the viewport and unused thumbnail resources stay within cache limits.
- Test both duplicated-image and distinct-image datasets so results do not depend exclusively on duplication.
- Add unit tests for window calculations, shared resource cleanup, cancelled requests, derivative generation, and drag destinations across virtualized rows. Run existing tests, type checking, lint, and production build.
- Manually verify selection, keyboard navigation, dragging beyond the initial viewport, group expansion, undo/redo, and local-file opening.

## Assumptions

Continuous scrolling and all existing favorites are retained. Existing database and archive formats remain compatible; small previews use the already-supported optional field. Preserve current uncommitted work.

Exact RAM savings will be reported from the before/after benchmark, rather than promising an unmeasured number. No code changes have been made during this planning pass.
