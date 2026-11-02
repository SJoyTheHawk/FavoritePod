# Phase 4 Manual Test

## Setup

1. Run `npm run build`.
2. Load `dist/` as an unpacked extension from `chrome://extensions/`.
3. Open the FavoritePod launcher and add a few favorites to different groups.

## Nested Groups

1. Create a root group, a child group, and a grandchild group.
2. Expand and collapse the parent; verify indentation and connector lines.
3. Check the count beside each group includes items in its descendants.
4. Select a parent and verify favorites from its subtree appear. Select the
   child and verify its subtree appears.
5. Edit a group's name and parent. Verify moving a group into itself or a
   descendant is rejected.
6. Try deleting a group that still has favorites or child groups; verify it is
   kept and the dialog shows why.

## Favorites and Ordering

1. Verify a saved thumbnail loads in grid and list views. Add an item without a
   thumbnail and verify its favicon or file/web fallback appears.
2. Edit a favorite's title, URL, and group. Try a `javascript:` URL and verify
   it is rejected.
3. Update a thumbnail by choosing an image file. Verify the new preview remains
   after closing and reopening the launcher.
4. Drag a favorite before another favorite in the same group, then drag it to a
   different group. Verify the order and group persist after reloading.
5. Drag any group row directly. At the top or bottom edge of a target, check
   the blue line and circle show sibling placement at that target's level.
   Drop on the center to append it as the last child; verify its existing
   descendants move with it. For example, moving Work (with child 123) onto
   Favorites produces Favorites / Work / 123. Drag Work onto a root row's
   edge to move it back to the root. Verify invalid descendant drops have
   no insertion indicator. Favorite cards are also draggable without handles.
6. Use the favorite and group action menus to reorder and move with the
   keyboard. Verify the same destinations are available without dragging.

## Bulk Actions and Undo

1. Select several visible favorites, use Select all, then clear the selection.
2. Move selected favorites to another group. Verify order is retained and the
   source group count changes.
3. Delete selected favorites and verify the confirmation. Undo the deletion,
   then redo it.
4. Edit or move a favorite, then undo and redo. Verify the title, URL, group,
   thumbnail, or order returns each time.
5. Create, rename, move, and delete an empty group; verify Undo and Redo restore
   each change.

## Local Files

1. Save a `file://` URL through the popup and enable file URL access for the
   extension if Chrome prompts or blocks the open.
2. Open the favorite from the launcher and verify it opens in a new tab.
