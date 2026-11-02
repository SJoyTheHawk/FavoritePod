# Phase 5 Manual Test

Phase 5 thumbnail implementation is complete. This checklist remains open for
recorded browser acceptance; automated tests cover the core pipeline but cannot
exercise Chrome capture or real iframe behavior.

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
3. Focus a favorite with Tab. Confirm the popover opens after the delay and
   Escape closes it and returns focus to the card.
4. Choose Preview page on an HTTP(S) favorite. Confirm the opt-in sandboxed
   iframe either loads or returns to the saved preview after two seconds.
5. Try a `file://` favorite. Confirm the live preview action is unavailable and
   the saved thumbnail or fallback remains usable.
