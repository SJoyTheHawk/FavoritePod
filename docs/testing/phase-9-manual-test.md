# Phase 9.1 and 9.2 Manual Verification

Implementation date: 2026-11-06. Phase 9.1 accepted on 2026-11-07 based on
the user reporting that the checklist passed without problems, including the
Chrome-top-sites-only revision and its layout/accessibility checks. Phase 9.2
right-click save menu checks remain pending and are the next work item.
The user did not supply a Chrome version or separate per-check observations.

## Automated and layout checks

- The Chrome-top-sites-only revision passes 172 tests in 20 suites, TypeScript,
  ESLint, Prettier, the production build, and git diff whitespace checks.
- Native Chrome 157.0.8103.38 upgrade check in a disposable profile: a temporary
  test manifest seeded required grants then moved them to optional permissions.
  Reloading with History removed retired its grant, retained Top sites and
  contextMenus, and preserved local settings/favorites. A native topSites.get()
  call succeeded. This does not replace testing the actual upgrade in a regular
  user profile; production grants remain optional.
- Extension UI smoke checks with deterministic top-site responses and real storage
  verified source order, fewer-than-ten and empty results, no history dependency,
  saved/hidden URLs, opening, editor prefilling/save, persistent Hide, independent
  All favorites/Home page visibility, native revocation, error/retry, keyboard
  menu focus, and 1280px/390px grid/list layouts without overflow.
- Grant and denial were simulated in UI smoke tests; the headless native dialog
  could not be confirmed during automation. Phase 9.1 manual checks, including
  interactive permission prompts, regular-profile upgrade, and real-list
  comparison/relevance, were subsequently reported passed by the user on
  2026-11-07. Native context menus remain pending under Phase 9.2.

## Setup

1. Build and reload FavoritePod from dist/ at chrome://extensions.
2. Use a Chrome test profile with top sites. For comparison, select Most visited
   sites (not My shortcuts) on Chrome New Tab.
3. Create a group and subgroup for destination checks.
4. On a new profile, **Show frequently visited** starts on; optional browser
   access and the right-click menu start off.

## Frequently visited shortcuts

- [x] Settings groups All favorites and Home page under Show frequently visited.
      Each switch is independent. Enabling Home shows shortcuts only in the group
      designated as home; hiding from its menu affects only that view. Saving from
      either view keeps the current view selected. Reload to verify persistence.

- [x] All favorites contains compact Frequently visited shortcuts above the
      library. There is no separate sidebar entry. Non-home groups and search hide it.
- [x] With no access, a short explanation and **Enable in Settings** appear.
      The button opens Settings at **Frequently visited access**, focused and
      visible, without requesting access until the user enables it. Only topSites should
      be requested; History must not appear in extension permissions.
- [x] Deny the permission prompt: access stays off, a useful error appears, and
      favorites remain available. Grant on retry: shortcuts appear.
- [x] Inspect chrome.topSites.get() in the extension console. Up to ten safe
      entries appear in its order, after duplicate/hidden filtering. Fewer returned
      sites stay fewer; no history pages fill gaps. Saved sites remain visible.
- [x] Before upgrading, enable access in the previous build. Reload the new build:
      permissions.getAll() excludes history and retains topSites/contextMenus
      grants if previously enabled. Feature flags, hidden URLs, and visibility
      settings persist without requiring History or re-enabling access.
- [x] Chrome selects and ranks the sites. Compare the shortcuts with Chrome New
      Tab in Most visited mode and review relevance after ordinary browsing. Do
      not expect manually customized shortcuts or locally hidden entries to match.
- [x] Click a shortcut: it opens the correct site without saving it.
- [x] Open **… → Add to favorites**: title/address are prefilled; select a nested
      group and confirm. The shortcut remains, All favorites stays selected, and
      the favorite appears in the right group. Undo/redo works. Cancel adds nothing.
- [x] A saved site's menu offers **Edit favorite** (including fragment variants),
      and reuses the existing favorite. Test an empty library and rapid saving.
- [x] **Hide shortcut** removes it persistently without deleting favorites or
      browser history. Hide several quickly and reopen the launcher.
- [x] **… → Hide frequently visited** hides the entire section. Reload: it stays
      hidden. Re-enable **Settings → Show frequently visited → All favorites**: shortcuts return
      without a new permission request if access was already granted.
- [x] With both visibility switches off, Top sites reads stop. Disabling
      **Frequently visited access** removes only topSites. Browser revocation
      clears shortcuts in an open launcher. No chrome.history API is accessed.
- [x] An empty Top sites response shows a brief empty state. Simulate an API failure, then
      retry successfully. No stale shortcuts appear after access is revoked.
- [x] ZIP export and Drive state contain only explicitly saved favorites;
      history, hidden shortcuts, visibility, and feature flags are excluded.

## Right-click save menu

Phase 9.2 revised on 2026-11-07; manual acceptance is pending and is not included
in Phase 9.1 acceptance. The old page/link/group submenus are superseded.

Automated checks: 177 tests in 21 suites plus TypeScript, ESLint, Prettier, and
production build pass. An isolated Chrome 157.0.8103.38 profile verified one native
menu registration, native toolbar popup opening, page/link targets, nested folder
selection, Save/Cancel, existing edits without duplication, Escape cancellation,
light/dark layout, restoration of normal toolbar home, file-link targeting, and
the popup-window fallback. Test-only grants and fixture click data were used;
the installed listener, popup APIs, and storage were real. Native context-menu
selection, permission prompts, and worker wake/restart remain manual acceptance.

- [ ] Enable **Settings → Behavior → Permission control → Right-click save menu**. Deny any
      permission prompt first, then enable successfully. Frequently visited access
      remains independent. There is exactly one **Save to FavoritePod** option,
      with no **Save this page**, **Save this link**, or **Save to group** submenu.
- [ ] Right-click a normal web page and choose **Save to FavoritePod**. The
      toolbar popup opens directly to the save form with the page URL/title.
      No launcher tab opens. Change the name/folder and Save; verify the favorite.
- [ ] Right-click a link and use the same action. The popup uses the link URL,
      with a destination-based title and favicon, not the containing page's
      title or screenshot. Saving does not navigate to the link.
- [ ] Choose a nested folder inside the popup, save, and reopen another target.
      Full folder paths are clear and the last-used folder is selected. Rename,
      move, delete, restore, import, or sync groups; the selector stays current.
- [ ] Cancel, close, click outside, and press Escape on new and existing targets.
      No favorite is added or edited. Repeating Save on an existing URL edits it
      without duplication. Rapid clicks and an empty library work correctly.
- [ ] Disable the switch. The single menu disappears immediately and stays absent
      after launcher/browser restart. Re-enable it and confirm it returns once.
- [ ] Let the service worker idle or stop it from DevTools; use the menu again.
      Repeat after browser restart and extension reload. Test more than one window
      and confirm each popup uses the clicked target. Later toolbar clicks show
      the normal Add bookmark/recent-pages home, not an old right-click target.
- [ ] With file URL access enabled, save a file page/link. Unsafe schemes do not
      open a save form. Switch/navigate/close the source tab before saving: never
      attach another page's screenshot. Capture failure must not block saving.
- [ ] Revoke context-menu permission. The setting becomes off and the worker/Drive
      sync continue without errors. If the toolbar popup cannot open, the same
      Save/Cancel form opens in a small popup window without a dashboard tab.
- [ ] Check the popup at its normal size in light/dark themes, with long titles
      and nested folder paths. Tab/Shift+Tab, Enter/Space, and Escape work; focus
      is visible and buttons, errors, and fields are not clipped.

## Phase 9.1 layout and accessibility

- [x] Check Frequently visited and its visibility/access settings in light/dark themes, at
      narrow and desktop widths, with long titles and nested group paths. No
      horizontal page overflow, overlapping controls, or clipped error appears.
- [x] Use Tab/Shift+Tab, Space/Enter, and Escape for navigation, switches,
      settings, shortcut menus, opening sites, Add, and Hide. Focus is visible and icon
      actions have accessible names.
- [x] Switch between grid/list and all bookmark sizes: shortcuts keep the compact
      grid format. Switch groups and collapse the sidebar; favorites/dragging work.

For the next Phase 9.2 verification, record the Chrome version, build, steps,
and outcomes, including its Settings layout and keyboard access. Existing
automated coverage checks source-order preservation/filtering, safe URLs, local
preferences/hiding, denied permissions, single-menu rebuilds, page/link popup routing, fallback,
and capture-target validation.
