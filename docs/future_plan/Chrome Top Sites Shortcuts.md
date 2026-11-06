# Frequently Visited: Use Chrome Top Sites Only

Status: Implemented November 6, 2026; accepted November 7, 2026 based on the
user reporting that the Phase 9.1 checklist passed without problems.

## Goal

Use Chrome's selected top sites as the sole source for Frequently visited, then
review whether the shortcuts feel more relevant. A shorter list is acceptable;
ten is a maximum, not a target to fill. Improved relevance is a hypothesis to
validate with actual use.

## Previous behavior

FavoritePod previously took Chrome top sites, appended up to 500 history entries
from the last 30 days, sorted those additions by visit count and recency, and showed
up to ten shortcuts. This could introduce pages that Chrome did not select for its
top-sites list. Permission checks required both history and topSites.

## Implementation sequence

### 1. Use a single source

- [x] In src/dashboard/use-visited-sites.ts, fetch only chrome.topSites.get().
      Remove history.search(), history state, the 30-day window, and history limits.
- [x] Simplify src/core/discovery.ts and its types to consume top sites and the
      local hidden list. Remove history merging and visit-count/recency sorting.
- [x] Preserve Chrome's returned order. Apply the existing safe-web-URL, duplicate,
      and hidden-URL checks, then display at most ten entries from that source.
- [x] Keep saved sites eligible. Do not add domain-level grouping, custom scoring,
      or extra pages to fill empty spaces. An empty result uses the existing empty
      state; an API error offers Retry without a history fallback.

### 2. Reduce access and handle existing profiles

- [x] Remove history from public/manifest.json optional_permissions, leaving
      topSites and the independent contextMenus permission.
- [x] Update src/core/optional-features.ts, use-optional-features.ts, and
      use-visited-sites.ts to request/check only topSites. Retain the user-click
      permission request, denial handling, revocation handling, and disable flow.
- [x] Retain the existing feature flag, hidden URLs, and both visibility settings.
      An enabled profile with topSites already granted should continue working
      without requiring History or a new enable action.
- [x] Test an upgrade from the current build with both grants present. Inspect
      permissions.getAll() after reload; ensure History access is retired. If a
      legacy grant remains, add and test an idempotent cleanup using the supported
      permissions.remove() path without disrupting topSites or contextMenus.
- [x] Never request History again, including when re-enabling the feature.

### 3. Update wording and documentation

- [x] Change Settings and inline permission copy to describe Chrome top sites
      only. Suggested inline text: "Open your most-visited sites in one click.
      Allow Chrome top sites access to show your shortcuts."
- [x] Keep the centered, transparent-icon shortcut layout above the page heading,
      grouped All favorites/Home page switches, and existing Add/Edit/Hide actions.
- [x] Update README, AI_AGENT_GUIDE, CODE_GUIDE, Phase 9.1 implementation notes,
      and docs/manual_test/phase-9-manual-test.md after implementation.

### 4. Verify behavior and review relevance

- [x] Unit tests: preserve source order; fewer than ten stay fewer; handle empty
      results, unsafe URLs, duplicate fragments, hidden URLs, and saved URLs.
- [x] Permission tests: topSites-only grant succeeds; denial/revocation clears
      results; disabling removes topSites; no history API calls or requests occur.
- [x] Run tests, type checks, lint, formatting checks, and the production build.
- [x] Exercise the extension UI: refresh, error/empty states, both visibility
      settings, opening, adding/editing/hiding, reload persistence, native
      revocation, keyboard menus, and desktop/narrow layouts (fixtures below).
- [x] Complete interactive browser acceptance for the native fresh-profile
      grant/deny prompt and an upgrade in a regular user profile.
- [x] In the same Chrome profile, compare FavoritePod with the returned topSites
      list and Chrome New Tab in Most visited sites mode. Account for FavoritePod's
      local hidden list, safety filtering, and ten-entry cap when comparing.
- [x] Review after normal browsing: are the remaining shortcuts useful, are
      unwanted history-only pages gone, and is the shorter list preferable?
      User feedback on November 7, 2026: the checklist works without problems; no
  separate qualitative relevance observations were supplied.

## Verification results (November 6, 2026)

- All 172 tests in 20 suites, TypeScript, ESLint, Prettier, the production build,
  and git diff whitespace checks pass.
- A disposable Chrome 157.0.8103.38 profile loaded the extension through the
  Extensions debugging API. A temporary manifest seeded native grants as required
  permissions, then moved them to optional permissions to establish the previous
  granted state. Removing History from that optional manifest and reloading
  removed History from permissions.getAll(), while retaining Top sites and
  contextMenus. No cleanup function was needed; existing IndexedDB preferences,
  hidden URLs, and favorites remained usable. The shipped manifest never makes
  these permissions required. A native topSites.get() call also succeeded.
- UI checks used deterministic top-sites fixtures with real extension storage and
  permission checks. They verified retained order, three results staying three,
  saved/hidden/duplicate filtering, opening, add/edit/hide, reload persistence,
  All favorites/Home page visibility, empty/error/retry states, native revocation,
  keyboard menu focus, and grid/list layouts at 1280px and 390px without overflow.
- Grant/denial responses were simulated for UI checks because the headless native
  confirmation dialog could not be completed. Unit tests verify requesting only
  topSites synchronously from the enable action. These automated results are
  separate from the subsequent user-reported manual acceptance below.
- No custom score, ranking, domain grouping, history read, or history backfill is
  present in the implementation.

## User acceptance (November 7, 2026)

The user reported that the checklist passed without problems. The remaining
Phase 9.1 permission, upgrade, comparison/relevance, and layout checks are marked
passed on that basis in [the manual checklist](../manual_test/phase-9-manual-test.md).
No new automated run or independent measurement of relevance is implied.
Phase 9.2 right-click save menu work remains separate and pending.

## Acceptance and limitations

Every displayed shortcut must come from Chrome's topSites response and retain
its relative source order. No raw-history backfill is allowed. Layout, favorites,
local preferences, and right-click saving retain their existing behavior.

The topSites API excludes user-customized shortcuts. Treat this as using Chrome's
top-sites selection, not a promise to mirror every New Tab tile or its exact count.
User acceptance is recorded above; this does not establish an exact match to
Chrome New Tab or a measured relevance improvement.

## Official references

- Chrome topSites API: https://developer.chrome.com/docs/extensions/reference/api/topSites
- Optional permission requests and removal: https://developer.chrome.com/docs/extensions/reference/api/permissions
