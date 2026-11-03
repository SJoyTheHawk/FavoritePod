# FavoritePod Next Steps

**Status**: Phases 2–7 are implemented as milestones. Phases 4 and 5 closed on 2026-11-03; Phase 7 closed on 2026-11-04 after automated and manual Chrome checks.

**Pending validation**: Manual Chrome checks for loading the unpacked extension, HMR, screenshot capture, favicon persistence, hover previews, and local-file access.

## Completed

- Repository setup, Manifest V3 build, and local extension key
- Phase 2: HLC data model, fractional ordering, deterministic merge, IndexedDB storage, migrations, and restorable snapshots
- Phase 3: bookmark review dialog, recent favorites, responsive dashboard, search, groups, favorite CRUD, and saved view preference
- Favicon persistence and display, including refresh of an existing favorite from the popup
- Phase 4: nested groups, direct dragging with placement indicators, group management, bulk actions, and undo/redo
- Phase 5: two-size thumbnail pipeline, SHA-256 deduplication, fallback cards, hover previews, and saved previews for sites that block embedding
- Phase 6: local file handling, permission hints, availability states, and per-device path overrides
- Phase 7: schema-versioned ZIP export/import, group selection, archive validation, three import modes, snapshots, rollback, and clean exports without soft-deleted records
- Latest checks: 76 tests across 9 suites, lint, formatting, type check, and production build passed. Phase 7's manual Chrome checklist was completed on 2026-11-04 per user report; no other browser is included in that acceptance.

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
9. Export all groups and a selected nested group. Confirm ZIP contents and preview hashes.
10. Import with copy, update, and replace modes. Confirm the snapshot and malformed-archive handling; Phase 7 browser acceptance is recorded in `docs/phase-7-manual-test.md`.
11. Stop the development server, run `npm run build`, then reload the unpacked extension to check the production build.

The local key is ignored by Git at `.local/favoritepod-local.pem`. Keep a secure backup if the same local extension ID will be needed later.

Record browser-specific results in `docs/PROJECT_OVERVIEW.md` or a dedicated validation note, including the commit, Chrome version, development or production build, steps, and outcome. Phase 7 browser acceptance is complete; acceptance for other phases remains open. Existing UI captures are visual references, not proof of Chrome API behavior.

### Browser Acceptance Checklist

These boxes track checks that still need recorded results, not features that still need implementation.

- [ ] Load the unpacked development build; open popup and launcher without console errors.
- [ ] Change a popup label, verify HMR, then restore the label.
- [ ] Open Add bookmark on a new page; confirm it saves by default.
- [ ] Use Done to save name and folder edits; reopen and confirm persistence.
- [ ] Reopen Add bookmark on an existing URL; confirm no duplicate is created.
- [ ] Verify Remove deletes the favorite, while closing the dialog retains the default save.
- [ ] Confirm a captured thumbnail appears in the dashboard after reopening.
- [ ] Hover a favorite for 400ms; confirm the preview popover shows the stored preview, full URL, Open, Edit, and Copy URL actions.
- [ ] Focus a favorite with the keyboard; confirm the preview opens and Escape closes it.
- [ ] Hover an EasyEDA favorite; confirm the saved preview appears without a frame-ancestors error and Open visits the page in a browser tab.
- [ ] Confirm favicons persist across popup and dashboard reopening, including after refreshing an older favorite through Add bookmark.
- [ ] Verify at most five recent favorites appear; dismiss one and confirm it remains in the dashboard and stays dismissed after reopening.
- [ ] Check search, group filtering, favorite editing/deletion, responsive layouts, and saved default-view preference.
- [ ] Check file URL access with permission enabled and disabled; record actual behavior and any missing guidance.
- [x] Complete ZIP import/export browser checks in `docs/phase-7-manual-test.md` (reported complete 2026-11-04).
- [ ] Repeat the main save/open flows with the production build.

### Phase 1 Follow-up

- [x] Repository, dependency lockfile, TypeScript/Vite/React setup, and design tokens
- [x] ESLint, Prettier, pre-commit hook, and extension entry pages
- [x] Manifest V3 and stable local extension key
- [ ] Record local load/HMR acceptance from Phase 1.1.
- [ ] Record screenshot capture, file opening, and file permission findings for Phase 1.2.
- [ ] If temporary spike code is used, document its location and remove it or retain it as an explicit test fixture.

The original Phase 1.2 list also includes Drive authentication and upload/download tests. Those belong to the deferred Drive work under the simplified v1 scope; they are not prerequisites for local development.

## After Browser Validation

Phases 4 and 5 (Thumbnail System) closed on 2026-11-03. Phase 7 closed on 2026-11-04 after automated checks and user-reported manual validation in Chrome. Browser acceptance for other phases remains open in their checklists. Google Drive Sync is the next planned implementation phase.

Nested groups are implemented under the user-approved Phase 4 scope, superseding earlier flat-group-only guidance. Drive sync remains deferred. Long group-path shortening is deferred at the user's request; retain full paths with » separators. Use numbered phase sections for task references; the historical revised-timeline table uses different numbering.

Work on one agreed subphase at a time. Finish its implementation, checks, documentation, and commit before advancing. Continue to follow [DESIGN_GUIDE.md](docs/DESIGN_GUIDE.md) and the existing components for coherent visuals.

## Milestones and Remaining Work

| Milestone               | Current status                            | Remaining work                                                                   |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Foundation              | Repository setup implemented              | Record Chrome loading and HMR checks                                             |
| Phase 2 data layer      | Implementation complete                   | Keep storage, migration, and merge regression checks passing                     |
| Phase 3 popup/dashboard | Implementation complete                   | Record browser acceptance above                                                  |
| Local-file support      | Implementation complete                  | Validate permissions/opening in Chrome                                       |
| Phase 4 organization    | Closed on 2026-11-03                      | Record browser acceptance; long-path display changes deferred                    |
| Phase 5 thumbnails      | Closed on 2026-11-03                      | Record browser acceptance for capture and previews                                |
| Portability             | Closed on 2026-11-04                     | Phase 7 browser checks completed; Chrome version/build not recorded             |
| Polish                  | Planned                                   | Theme preferences, accessibility/error-state review, and release testing         |
| Public release          | Deferred by user decision                 | Evaluate extension readiness before Store registration and submission            |

These are status summaries, not additional phase numbers. Historical week/day estimates are not delivery commitments; estimate the next subphase after reviewing its remaining scope.

## Development Environment and Checks

Use Node.js 20.19+ and npm, Git, and Chrome. Optional editor support includes ESLint, Prettier, Tailwind CSS IntelliSense, and TypeScript tooling.

```bash
node --version
npm --version
git --version
npm install
npm run dev
```

Run only one development server on `localhost:5173`. Stop it before `npm run build`, because both modes write to `dist/`. Reload the extension and reopen its pages after switching modes or changing Vite/manifest configuration.

```bash
npm run test:coverage
npm run type-check
npm run lint
npm run format:check
npm run build
```

Use focused tests while developing and the relevant full checks before closing a subphase. Core unit tests complement manual browser testing. Formatting currently excludes `docs/` and `NEXT_STEPS.md`, so review their Markdown explicitly and run `git diff --check`.

## Debugging Reference

| Task                                               | Where to look                                             |
| -------------------------------------------------- | --------------------------------------------------------- |
| Extension details, reload, permissions, and errors | `chrome://extensions/`                                    |
| Popup logs                                         | Open the popup, right-click inside it, and choose Inspect |
| Dashboard logs                                     | Open DevTools in the launcher tab                         |
| Service worker logs                                | Extension details → service worker inspection link        |
| Stored favorites, thumbnails, and settings         | Extension page DevTools → Application → IndexedDB         |
| A specific extension's settings                    | `chrome://extensions/?id=<extension-id>`                  |

When a flow fails, record the exact action and console error, confirm which build is loaded, inspect relevant stored records, and check the manifest permissions. Compare with the existing implementation and code guide before changing behavior. Reproduce the issue after reloading the extension, and document any browser limitation.

## Working with AI Agents

Read the README and project overview first, then the relevant implementation-plan section, code guide, and design guide. Use the AI agent guide for detailed conventions.

For each task, provide the subphase, expected behavior, relevant files, design references, acceptance criteria, and known errors. Keep work sequential, as requested; the old suggestion to run several phases in parallel is not the current workflow.

```text
Task: Implement the next agreed subphase from docs/IMPLEMENTATION_PLAN.md.
Scope: Apply the simplified v1 scope and account for existing completed features.
References: docs/CODE_GUIDE.md, docs/DESIGN_GUIDE.md, and the current components.
Acceptance: List the user-visible behavior and persistence requirements.
Validation: Run relevant automated checks and provide a focused Chrome checklist.
Completion: Update status docs, report remaining checks honestly, and commit the work.
```

Prefer small, reviewable changes; reuse design tokens and component patterns; document unusual bugs; test after each feature. Keep local-file support a priority and defer Drive sync until the local experience is ready. Guide code examples must be checked against the current codebase before use.

## Decisions to Revisit Before Release

- **Chrome Web Store:** Registration and payment are deferred until the extension is judged ready to proceed. Local testing continues with the existing key.
- **Extension identity:** Repository initialization and key generation are done; retain the private-key backup rather than generating a new identity during routine setup.
- **License:** Still undecided; replace the README placeholder when a license is chosen.
- **Public listing:** Check name availability and prepare listing material when publication is in scope.
- **Google Cloud/Drive:** Configure and validate only when the deferred sync work begins.
- **Release evidence:** Record browser results, known limitations, and data backup/restore behavior before declaring release readiness.

## Review of Removed Material

The earlier cleanup removed useful onboarding and debugging guidance too broadly. This revision restores that guidance, phase checklists, milestone tracking, task handoff advice, and outstanding decisions in an updated form.

The following material remains removed from the active instructions:

- `git init`, `npm init`, initial dependency scaffolding, and prompts to start Phase 1.1: already completed; use the existing repository and lockfile.
- Duplicate startup commands and generic motivational text: consolidated into the setup and workflow sections.
- Fixed documentation file sizes and conflicting week estimates: stale metadata, replaced by links and scope-based planning.
- Checkmarks claiming ZIP, themes, or Store submission were done: replaced by the milestone table with accurate statuses.
- Advice to avoid automated tests: superseded by the project's existing regression suite.
- Parallel-phase instructions: superseded by the user's preference for sequential work.

The full earlier text remains available in Git history with `git show 214be16:NEXT_STEPS.md`; no historical copy needs to be maintained as a second set of active instructions.

## Project References

| Document                      | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `README.md`                   | Project introduction and current feature summary |
| `docs/PROJECT_OVERVIEW.md`    | Architecture, screenshots, and validation status |
| `docs/IMPLEMENTATION_PLAN.md` | Phase acceptance criteria and roadmap            |
| `docs/CODE_GUIDE.md`          | Technical patterns and APIs                      |
| `docs/DESIGN_GUIDE.md`        | UI design system and component guidance          |
| `docs/AI_AGENT_GUIDE.md`      | AI development workflow                          |
| `docs/project_plan.md`        | Original detailed requirements                   |
