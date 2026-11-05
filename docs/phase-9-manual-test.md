# Phase 9.1 and 9.2 Manual Verification

Implementation date: 2026-11-06. Native Chrome permission and context-menu
checks remain pending; automated tests do not substitute for these checks.

## Automated and layout checks

- The shortcut redesign passes 168 tests across 20 suites, TypeScript, ESLint,
  Prettier, the production build, and git diff whitespace checks.
- An isolated Chrome review at 1440px, 1280px, and 390px verified every grid/list
  size, light/dark layouts, and no horizontal overflow. Visual review confirmed
  the circular shortcuts and compact labels match the requested layout.
- The production UI smoke check passed opening, add/edit prefilling and saving,
  cancellation, shortcut hiding, persisted section visibility, group/search
  scoping, keyboard menus/focus restoration, denied/granted/revoked permission
  states, empty results, and retry after an API error. No uncaught errors occurred.
- Browser smoke checks use an isolated profile and mocked extension APIs. Native
  prompts, real history, context menus, file access, and service-worker suspension
  still require the manual checks below.

## Setup

1. Build and reload FavoritePod from dist/ at chrome://extensions.
2. Use a Chrome test profile with browsing history and top sites.
3. Create a group and subgroup for destination checks.
4. On a new profile, **Show frequently visited** starts on; optional browser
   access and the right-click menu start off.

## Frequently visited shortcuts

- [ ] All favorites contains compact Frequently visited shortcuts above the
      library. There is no separate sidebar entry. Group views and search hide it.
- [ ] With no access, a short explanation and **Enable in Settings** appear.
      The button opens Settings at **Frequently visited access**, focused and
      visible, without requesting access until the user enables it.
- [ ] Deny the permission prompt: access stays off, a useful error appears, and
      favorites remain available. Grant on retry: shortcuts appear.
- [ ] At most ten safe http/https shortcuts appear, top sites first then recent
      history ranked by visits/recency. Saved sites remain; fragments deduplicate.
- [ ] Click a shortcut: it opens the correct site without saving it.
- [ ] Open **… → Add to favorites**: title/address are prefilled; select a nested
      group and confirm. The shortcut remains, All favorites stays selected, and
      the favorite appears in the right group. Undo/redo works. Cancel adds nothing.
- [ ] A saved site's menu offers **Edit favorite** (including fragment variants),
      and reuses the existing favorite. Test an empty library and rapid saving.
- [ ] **Hide shortcut** removes it persistently without deleting favorites or
      browser history. Hide several quickly and reopen the launcher.
- [ ] **… → Hide frequently visited** hides the entire section. Reload: it stays
      hidden. Re-enable **Settings → Show frequently visited**: shortcuts return
      without a new permission request if access was already granted.
- [ ] Hiding stops top-sites/history reads. Disabling **Frequently visited access**
      also removes grants. Browser revocation clears shortcuts in an open launcher.
- [ ] Empty history shows a brief empty state. Simulate an API failure, then
      retry successfully. No stale shortcuts appear after access is revoked.
- [ ] ZIP export and Drive state contain only explicitly saved favorites;
      history, hidden shortcuts, visibility, and feature flags are excluded.

## Right-click save menu

- [ ] Enable **Settings → Optional features → Right-click save menu**. Deny any
      permission prompt first, then enable successfully. Frequently visited access remains
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
      settings, shortcut menus, opening sites, Add, and Hide. Focus is visible and icon
      actions have accessible names.
- [ ] Switch between grid/list and all bookmark sizes: shortcuts keep the compact
      grid format. Switch groups and collapse the sidebar; favorites/dragging work.

Record the Chrome version, build, steps, and outcomes before marking acceptance
complete. Existing automated coverage checks ranking/filtering, safe URLs, local
preferences/hiding, denied permissions, menu rebuilds, and page/link/group routing.
