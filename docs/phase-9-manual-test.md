# Phase 9.1 and 9.2 Manual Verification

Implementation date: 2026-11-06. Native Chrome permission and context-menu
checks remain pending; automated tests do not substitute for these checks.

## Automated and layout checks

- All 166 tests across 20 suites pass, along with TypeScript, ESLint, Prettier,
  the production build, and `git diff --check`.
- An isolated headless Chrome smoke check with mocked extension APIs and sample
  data verified desktop (1280px) and narrow (390px) layouts, light/dark screens,
  suggestion saving/hiding, the right-click setting, and editor URL/title/group
  prefilling. No uncaught JavaScript errors or horizontal page overflow occurred.
- This smoke check exercised the production UI through localhost. It did not
  exercise native extension permission prompts, actual browser history, real
  context menus, file access, or service-worker suspension. The manual checks
  below remain open for those behaviors.
- A follow-up UI check at 1280px and 390px verified the shorter off state and
  **Enable in Settings** navigation: the discovery switch is visible and focused,
  remains off, and makes no permission request. Opening Settings from the header
  still starts at the top.

## Setup

1. Run `npm run build` and reload FavoritePod from `dist/` at `chrome://extensions`.
2. Use a Chrome test profile with some browsing history and top sites.
3. Open the launcher and create a group and subgroup for destination checks.
4. Open Settings. Both optional features should start off for a new profile.

## Visited-site discovery

- [ ] Select **Frequently visited** with discovery off. It shows **Discovery is
      off**, a brief explanation of the suggestions and required Chrome top-sites
      and browsing-history access, and **Enable in Settings**. Click the button:
      Settings opens scrolled to the discovery setting with its switch focused,
      without enabling it or requesting permissions. Open Settings from the header
      separately and confirm it still starts at the top.
- [ ] Enable **Settings → Optional features → Visited-site discovery** and deny
      the prompt. The switch stays off and a useful error appears. Favorites
      remain available.
- [ ] Enable again and grant access. Frequently visited shows top sites followed
      by pages from the last 30 days, ranked by visit count and recency. No
      chrome://, file://, javascript:, or data: suggestion appears.
- [ ] Save a listed URL to the library, including a version with a different
      fragment. Refresh; that page should be excluded from suggestions.
- [ ] Select a nested group in **Save to** and click a suggestion's + action.
      It disappears and appears in the selected group with the correct title and
      favicon fallback. Undo removes it; redo restores it.
- [ ] Rapidly click +; only one favorite is added. Repeat with an empty library:
      the default Favorites group is created and the save succeeds.
- [ ] Click Hide on several pages quickly, then reopen the launcher. All stay
      hidden. Hiding does not remove Chrome history or existing favorites.
- [ ] Refresh and test an empty history/top-sites profile. The empty state is
      readable and no error occurs. Simulate an API error and use Try again.
- [ ] Disable discovery. Suggestions disappear, history/top-sites grants are
      removed, and the extension makes no further discovery API calls.
- [ ] Re-enable, then revoke History/Top sites access through Chrome. The open
      launcher shows discovery off and never displays cached suggestions.
- [ ] Inspect a ZIP export and Drive device state with discovery enabled. Only
      explicitly saved favorites appear; hidden URLs, history, suggestions, and
      feature preferences are not exported or synced.

## Right-click save menu

- [ ] Enable **Settings → Optional features → Right-click save menu**. Deny any
      permission prompt first, then enable successfully. Discovery remains
      independent of this setting.
- [ ] Right-click a normal web page. **Save to FavoritePod → Save this page**
      opens Add favorite with the current URL/title; Save adds it. Cancel adds
      nothing. Repeating on the same exact URL opens its existing editor.
- [ ] Right-click a link. **Save this link** uses the link destination rather
      than the containing page's URL or title.
- [ ] Choose **Save to group → Parent » Child** on a page and on a link. The
      correct destination is selected in Add favorite and Save persists there.
- [ ] Create, rename, move, delete, and restore groups; import a group or sync
      a remote one. Menus reflect current full paths without duplicate entries.
- [ ] Disable the switch. Menus disappear immediately. Close/reopen the launcher
      and restart Chrome; they remain absent. Re-enable and confirm they return.
- [ ] Stop the extension service worker from DevTools or wait for it to idle,
      then use a menu action. The save editor still opens. Repeat after a browser
      restart and extension reload.
- [ ] With file URL access enabled in Chrome, save a file page or file link.
      Unsafe schemes never open an editor or enter the library.
- [ ] Revoke context-menu permission in Chrome. The Settings switch becomes off
      and the service worker/Drive sync continue without startup errors.

## Layout and accessibility

- [ ] Check Frequently visited and both new settings in light/dark themes, at
      narrow and desktop widths, with long titles and nested group paths. No
      horizontal page overflow, overlapping controls, or clipped error appears.
- [ ] Use Tab/Shift+Tab, Space/Enter, and Escape for navigation, switches,
      settings, destination selection, Save, and Hide. Focus is visible and icon
      actions have accessible names.
- [ ] Switch between discovery and group views, including after collapsing the
      sidebar. The active view is clear and existing favorites/dragging work.

Record the Chrome version, build, steps, and outcomes before marking acceptance
complete. Existing automated coverage checks ranking/filtering, safe URLs, local
preferences/hiding, denied permissions, menu rebuilds, and page/link/group routing.
