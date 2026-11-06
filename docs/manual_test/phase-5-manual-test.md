# Phase 5 Manual Test

Phase 5 thumbnail implementation is complete. This checklist remains open for
recorded browser acceptance; automated tests cover the core pipeline but cannot
exercise Chrome capture or real browser navigation.

## Thumbnail Capture

1. Build and load `dist/` as an unpacked extension.
2. Save a web page through the popup. Confirm the review dialog shows a crisp
   preview and the dashboard card loads its saved image after reopening.
3. Save a page without a usable screenshot. Confirm the card shows a colored
   fallback with its favicon, title, and domain.
4. Save the same page twice or update an item with the same image. Confirm the
   stored preview is reused by its hash and the item does not duplicate.

## Hover Preview

1. Hover a favorite for at least 400ms. Confirm the popover opens with the
   larger preview, title, domain, full URL, Open, Edit, and Copy URL actions.
2. Move from the card into the popover. Confirm it remains open and interactive.
   Check favorites near the bottom of the viewport: the popover should sit
   directly above or below the hovered row with a small, consistent gap.
3. Focus a favorite with Tab. Confirm the popover opens after the delay and
   Escape closes it and returns focus to the card.
4. Hover an EasyEDA favorite (or another site that blocks embedding). Confirm
   the saved thumbnail or fallback appears without a frame-ancestors error.
   Choose Open and confirm the page opens normally in a browser tab.
5. Try a `file://` favorite. Confirm the saved thumbnail or fallback remains
   usable. No favorite should offer a live iframe preview.
