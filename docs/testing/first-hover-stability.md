# First-hover card stability

## Regression

The card layout effect measured offsets on every render and treated any change
as a reorder. Layout changes without a card render left an old position cached.
Opening a hover preview then replayed that old position for 220 ms, making the
card jump before settling back. No bookmark or thumbnail write was involved.

The collection now supplies an order revision from its item IDs, order keys,
and drag-preview ranks. Card movement animation requires that revision to change
and the layout/size to remain the same. Hover and thumbnail renders still update
position measurements, but do not replay movement. Drag landing remains separate.

## Verified in Chrome 157 on 2026-11-07

- Seed twelve favorites in a medium-size grid in a disposable profile.
- Hover the first six cards, resize the viewport from 1350 to 1050 pixels, and
  hover them again. Before the fix, five cards replayed stale reorder animations
  on first hover after resizing. After the fix, no movement animations occurred.
- Use Move down on the first favorite: order changes correctly and both affected
  cards still animate into their new positions.
- The production build, lint, and all 216 existing tests pass.

## Additional interactive checks

- Reload, hover every card, then repeat after sidebar, card-size, and view changes.
- Verify hover previews still open and close normally.
- Drag single and multiple favorites; check preview movement and drop landing.
- Repeat with group labels enabled and with reduced motion enabled.
