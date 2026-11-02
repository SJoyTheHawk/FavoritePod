# FavoritePod Next Steps

**Status**: Phase 2 (Core Data Layer) and Phase 3 (Popup and Dashboard) implementation complete.
**Pending validation**: Manual Chrome checks for loading the unpacked extension, HMR, screenshot capture, and local-file access.

## Completed

- Repository setup, Manifest V3 build, and local extension key
- Phase 2: HLC data model, fractional ordering, deterministic merge, IndexedDB storage, migrations, and restorable snapshots
- Phase 3: bookmark review dialog, recent favorites, responsive dashboard, search, groups, favorite CRUD, and saved view preference
- Favicon persistence and display, including refresh of an existing favorite from the popup
- Automated checks: 29 tests pass; merge logic has 100% coverage; lint, formatting, type check, and production build pass

## Next: Verify in Chrome

Chrome Web Store registration is not needed for local testing. To test the current build:

1. Run `npm install` if dependencies are missing.
2. Run `npm run dev` and keep the server running.
3. In `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select `dist/`.
4. Pin FavoritePod and check that its popup and dashboard open without console errors.
5. Add a page, edit its name or folder, close and reopen it, and confirm the saved data and favicon persist.
6. Dismiss a recent page and confirm the favorite remains in the dashboard.
7. Check screenshot capture and opening a `file://` favorite after enabling file URL access for the extension.
8. Confirm popup updates through HMR while the development server is running.
9. Stop the development server, run `npm run build`, then reload the unpacked extension to check the production build.

The local key is ignored by Git at `.local/favoritepod-local.pem`. Keep a secure backup if the same local extension ID will be needed later.

Record browser-specific results in `docs/PROJECT_OVERVIEW.md` or a dedicated validation note. Until those checks are recorded, phases 2 and 3 are closed as implementation milestones, while Chrome/platform validation remains open.

## After Browser Validation

Continue with Phase 4 in `docs/IMPLEMENTATION_PLAN.md`: nested group management, drag-and-drop ordering, and the remaining edit/delete interactions. Revisit the original requirements in `docs/project_plan.md` only when expanding beyond the current implementation plan.

## Project References

| Document | Purpose |
| --- | --- |
| `README.md` | Project introduction and current feature summary |
| `docs/PROJECT_OVERVIEW.md` | Architecture, screenshots, and validation status |
| `docs/IMPLEMENTATION_PLAN.md` | Phase acceptance criteria and roadmap |
| `docs/CODE_GUIDE.md` | Technical patterns and APIs |
| `docs/DESIGN_GUIDE.md` | UI design system and component guidance |
| `docs/AI_AGENT_GUIDE.md` | AI development workflow |
| `docs/project_plan.md` | Original detailed requirements |
