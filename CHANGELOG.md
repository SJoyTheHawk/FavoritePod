# Changelog

## 1.0.0 — 2026-11-10

First GitHub release. Chrome Web Store publication and production OAuth validation
remain separate release tasks.

### Features

- Save websites from the toolbar with preview images, names, and folders.
- Organize favorites in nested folders with drag-and-drop, bulk movement, search,
  and undo/redo.
- Browse grid and list views with adjustable sizes and light/dark/system themes.
- Open local-file favorites with optional device-specific path remapping.
- Optionally synchronize the library and previews using the user's Google Drive.
- Import/export FavoritePod ZIP backups and Chrome-compatible HTML bookmarks.
- Enable optional frequently visited shortcuts and a right-click save menu.

### Release preparation

- Set package, lockfile, and extension manifest versions to `1.0.0`.
- Prepare Rocky Road Studio's product homepage, privacy policy, support page,
  store listing, privacy declarations, and reviewer instructions.
- Include a voluntary Buy Me a Coffee link in the listing and website copy.
- Prepare Elementor content fragments that inherit the studio's Astra styling,
  with a WordPress publishing guide and reproducible local previews.
- Document AI assistance and add the requested GitHub Sponsors link in the README.
- Package the store ZIP with `npm run package:store`, omitting the development
  manifest key while preserving it in local builds.
- Consolidate publishing into one checklist, remove superseded guides, and update
  the README with a product introduction and five screenshots.

### Validation

- Lint, formatting, and the production build pass.
- All 335 tests across 36 suites pass; the merge module retains 100% configured
  coverage.
- Browser-specific release acceptance, production OAuth, and store review are
  separate pending checks in the implementation plan.
- Public-page previews pass Chrome checks at 1440px, 390px, and 320px widths:
  images load, internal links and FAQ controls work, and content does not overflow.
  CSS selectors are scoped to FavoritePod. The live product privacy URL currently
  redirects to the studio policy; correct that route before store submission.
