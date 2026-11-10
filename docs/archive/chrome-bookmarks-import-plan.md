# Import Chrome bookmarks from HTML

> Historical reference. For current work, use the [implementation plan](../planning/implementation-plan.md) or [publishing checklist](../publishing/README.md).

## Summary

Add **Import Chrome bookmarks** under **Settings → Import and export**. Users select Chrome’s exported HTML file, review its contents, and import everything into a new **Imported: filename** folder.

Chrome provides this file through **Bookmark Manager → ⋮ → Export Bookmarks**. Include these instructions in the dialog and README. ([Chrome help](https://support.google.com/chrome/answer/96816?hl=en))

## Implementation

- Add a dedicated bookmarks import dialog using the existing dialog styling, file picker, drag-and-drop, progress, and success notification patterns.
- Show bookmark and folder counts, a folder hierarchy preview, and skipped entries with reasons before confirmation. Disable repeated submissions while importing.
- Preserve folder nesting, empty folders, bookmark names, and ordering within folders. Place bookmarks without a folder directly in the new import folder.
- Preserve every valid occurrence of a URL, including duplicates. Each import creates fresh records; existing favorites remain untouched.
- Add a core module exposing `parseBookmarksHtml(file)` for read-only review and `importBookmarks(parsed, onProgress)` for saving. Return imported counts using the existing `ImportResult` interface.
- Use [parse5](https://parse5.js.org/) to parse Chrome’s bookmark HTML as data. Recognize its bookmark structure, handle omitted closing tags and HTML entities, and never render the source HTML.
- Write groups and favorites atomically using fresh IDs, existing ordering helpers, and local field clocks. Update sync metadata and use the existing library-change hooks and dashboard import completion behavior.
- Keep the ZIP import format and database schema unchanged.

## Defaults and limits

- Import the entire file; folder selection and direct Chrome access are deferred.
- Accept `.html` and `.htm`, up to 20 MB. Apply the existing 10,000-record limits for favorites and groups, including the import container.
- Accept existing supported URL schemes: HTTP, HTTPS, and local files. Skip malformed or unsupported URLs and report them.
- Trim names, use existing default bookmark titles when blank, use “Untitled folder” for blank folders, and cap names at the existing 1,000-character limit.
- Reject unrelated HTML and files with no importable folders or bookmarks.
- Import names and URLs without screenshots or embedded icons; use FavoritePod’s existing fallback cards.

## Verification

- Test realistic Chrome exports with nested and empty folders, loose bookmarks, Unicode, entities, duplicate URLs, and omitted closing tags.
- Test unsupported links, invalid files, limits, and HTML containing scripts or external resources.
- Verify cancellation makes no changes, failed writes roll back, repeated imports create independent copies, and imported records survive ZIP export/import.
- Run tests, type-checking, lint, formatting checks, and production build.
- Manually verify file selection, drag-and-drop, review, keyboard navigation, progress, fallback cards, local links, and normal Drive sync.
