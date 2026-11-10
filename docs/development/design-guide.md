# FavoritePod design guide

Use the existing app components and semantic tokens. This guide describes the
implemented UI; it does not define a second component library.

## Source of truth

| Concern                                | Source                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| Colors, type, radius, shadows          | [themes.css](../../src/styles/themes.css)                |
| Tailwind mappings                      | [tailwind.config.ts](../../tailwind.config.ts)           |
| Motion, focus, loading, shared classes | [global.css](../../src/styles/global.css)                |
| Shared UI components                   | [components/](../../src/components/)                     |
| Library and settings UI                | [dashboard/components/](../../src/dashboard/components/) |
| Toolbar save/review UI                 | [popup/](../../src/popup/)                               |

Use semantic utilities such as `bg-surface`, `text-text-primary`, and
`border-border` so both themes work. Reuse the existing spacing and controls.
Use native buttons and inputs, visible focus states, descriptive labels for icon
buttons, and modal focus management. Avoid geometry-changing hover transforms
that interfere with drag/drop.

## Saving and settings

The toolbar's Add bookmark action initially saves the page and available preview.
Save confirms edits; closing the popup retains the initial bookmark. Keep preview
refresh/removal explicit and preserve failure feedback.

Right-click saving opens the same review form. Frequently visited shortcuts
require optional Top sites access and use Chrome's order. Local-file UI must
explain Chrome's file-access switch and device-specific path remapping.

Settings has Appearance, Behavior, Import & export, Google Drive, and Local files
tabs. Keep tab keyboard navigation, error feedback, and busy states consistent.
Drive progress must distinguish disconnected, offline, syncing, and error states.

## Theme Switching

### Current behavior

- Keep the existing CSS variables in `src/styles/themes.css`; do not introduce a second palette.
- Settings offers **System / Light / Dark**. System is stored as `auto` in the existing IndexedDB `settings` table under `theme` and is the default for missing or invalid records.
- `useTheme()` in `src/dashboard/hooks/use-theme.ts` runs once per dashboard or popup app, not only inside Settings. It applies the resolved `data-theme` to `<html>`, observes settings with Dexie, and follows OS changes with `matchMedia`. Focus refresh handles pages resumed after an OS change.
- Preference updates apply immediately, persist locally, and roll back on save failure. Errors appear in Settings. Appearance is not included in Drive sync or library exports.
- The Settings selector uses native radios, visible keyboard focus, existing semantic colors, surface/background contrast, `rounded-md`, and the same small type and spacing as adjacent settings. System is the user-facing label for Auto.

The dashboard owns the hook for the page lifetime and passes its `theme`, `ready`, `saving`, `error`, and `setTheme` values to Settings. The popup initializes the same hook without rendering a separate selector.

### Shared Motion and Loading Patterns

- Use `AnimatedDialog` and `useDialogTransition` from `src/components/AnimatedDialog.tsx` for conditionally mounted dialogs. Route dismissal through the transition hook; the parent unmount callback runs after exit. Keep operation-specific busy/cancel guards.
- Keep Headless UI `DialogBackdrop` and `DialogPanel` with `transition` and the shared `dialog-backdrop` / `dialog-panel` CSS classes. The 200ms fade and small panel movement use the guide's timing. Preserve existing widths, padding, backdrop, and focus traps.
- Preserve existing drag-stack ghosts, placement highlights, and reorder/drop animations. During a drag, animate existing source/destination cards as the placeholder enters, moves, or leaves, including across groups. Include the placeholder position in the motion revision even when the dragged item is not yet a destination member. Adding/removing favorites or committing a transfer must not replay neighboring cards' old positions. Keep the drag placeholder until the saved destination is rendered, and replace active motion when retargeting. Card hover changes the established shadow without adding transforms that conflict with drag geometry.
- Cancelling a drag with Escape restores the original layout and clears the ghost, placeholder, group-header tint, and sidebar placement highlight without waiting for mouse release. Native drag termination must perform the same cleanup; a drop already saving keeps its placeholder until persistence is observed.
- Cancellation removes the ghost and resets the layout in the same update, with no return/reorder animation. Normal reordering and successful drops retain their existing motion.
- Use `ThumbnailImage` to hold image space while storage/decode is pending, fade in decoded previews, and fall back if an image fails. Existing object-URL cleanup remains with the owning card.
- Use `ProgressBar` for real counts. Unknown counts remain indeterminate; never invent an overall sync percentage. Existing sync stage text remains visible.
- Reuse initial skeletons in the current collection layout and size. Announce a single loading status and hide decorative placeholders from assistive technology.
- Respect `prefers-reduced-motion`: stop repeating loading animations, remove dialog movement, and shorten transitions. Existing drag animations already check this preference.

### Keyboard Behavior

- Cmd/Ctrl+K focuses and selects launcher search; Escape clears it.
- Favorite open controls accept arrows across visible expanded groups. Up/down follow the nearest visual row and column in responsive grids; Home/End go to the first/last visible favorite.
- Keep ordinary Tab navigation for selection and action controls. Do not capture arrows in text/select fields, menus, dialogs, composition input, or while dragging.
- Escape dismisses the active dialog/menu/preview through its existing handler. Modal focus remains trapped and returns to the trigger after closing.
- Keep the visible-on-focus Skip to favorites link and semantic/native controls.

See [Phase 10.1 manual checks](../testing/phase-10.1-manual-test.md). Browser automation complements actual OS, native toolbar, drag, and screen-reader acceptance; it does not mark those checks complete.

---

## Performance

### Image Loading

The dashboard uses `ThumbnailImage` for stable sizing, decode feedback, and
fallbacks. `thumbnail-visibility.ts` shares one IntersectionObserver across
cards and collections. The buffer is 50% of the window scroll viewport height
above and below, computed in CSS pixels and rebuilt on height changes. The window
viewport excludes browser chrome; the dashboard header scrolls with the document.
Transient overlays do not change the buffer. Use pixel root margins calculated
from height, not percentage root margins. Report exits from this buffered region
so images release beyond it. Keep full-size previews closed until the hover
preview opens, and close them when the card leaves the buffered region.

`thumbnail-resources.ts` keys object URLs by preview hash and size, deduplicates
parallel reads, and reference-counts active consumers, including drag copies.
Revoke small URLs immediately after their final consumer releases; do not add
an unused card-thumbnail memory cache beyond the 50% viewport buffer. Retain the
ten most recently opened distinct full-size hover images by hash. Reopening
refreshes recency; closing does not. Evict older URLs once no active consumer
needs them. Still-open previews retain ownership until they close. Cancelled or
failed pending loads do not enter this cache; saved originals remain in IndexedDB.
Limit reads/conversions to four jobs and skip queued loads whose consumers leave
view. Imported/synced images without a small preview get a persisted 320 × 200
derivative; preserve the original bytes and hash. Close decoded bitmaps and release
canvas buffers after conversion. Reuse on-disk card derivatives instead of unused
small URLs. The hover cache retains resource URLs for reuse, not hidden image nodes.

### Large Collections

`FavoriteCollection` uses `@tanstack/react-virtual` to mount visible rows plus
50% of the viewport height on each side, rounded outward to whole overscan rows,
while preserving the full document scroll height. Share the buffer fraction with
image observation; recalculate rows on viewport/card-size changes. The row count
follows responsive grid columns and the existing card dimensions for each size.
Keep selection in dashboard state by favorite ID; do not tie it to mounted cards.
Offscreen collections return an empty ordinary virtual range: window virtualizers
otherwise clamp to edge rows and accumulate mounted cards across groups. Preserve
the collection height and explicitly pinned keyboard/drag source while hidden.
Disable offscreen virtualizers so they remove scroll subscriptions; preserve the
last measured collection height (or the current row estimate after size changes).
Only active collections observe document-wide height changes. Group action menu
panels mount on opening, retaining existing pointer/keyboard behavior and styling.

Render visible favorite slots directly under the collection with stable item keys;
moving between rows must retain the same card element. Keep the native drag source
mounted outside the layout slots and pin the keyboard-focused row in the virtual range.
Register logical item geometry so arrows, Home, and End can move focus beyond
mounted DOM nodes. Keep drop hit testing based on mounted visible slots, and
measure positions relative to the full virtualized collection. Search waits 300ms
after the last keystroke and resets scrolling to the start of the result set.

Phase 10.2 closed on 2026-11-08 after all user manual checks passed. The isolated
profiles, normal-profile measurements, final cache policy, and accepted remaining
large-group memory cost are recorded in
[`phase-10.2-manual-test.md`](../testing/phase-10.2-manual-test.md).
