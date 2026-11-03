# FavoritePod

**Visual bookmark launcher with local file support for Chrome**

A Chrome extension for organizing favorite web pages and local HTML tools in a visual launcher.

---

## 🎯 Project Status

**Current status**: Phases 2–7 are implemented. Phases 4 and 5 closed on November 3, 2026 at the user's request.

**Pending validation**: Manual Chrome checks for extension loading, HMR, screenshot capture, favicon persistence, hover previews, `file://` access, and ZIP import/export.

**Target**: v1.0 (Simplified scope with file:// priority)

Start with [NEXT_STEPS.md](NEXT_STEPS.md) for the validation checklist, development workflow, and remaining milestones.

---

## ✨ Implemented Core

### Phase 2: Local Data Layer

- Hybrid Logical Clocks and deterministic merge rules
- Fractional ordering and tombstone deletion
- IndexedDB storage for groups, favorites, and thumbnails
- Versioned migrations, including compatibility with existing favicon records
- Three restorable local snapshots

### Phase 3: Popup and Dashboard

- Add the active page through a bookmark-style review dialog with a compressed screenshot
- Edit its name or folder, remove it, or confirm with Done
- Show up to five recent, non-dismissed favorites on the popup home screen
- Dismiss individual pages from recent pages without deleting their favorites
- Store captured favicons locally and display them in the popup and dashboard
- Search and organize favorites in responsive grid or list views
- Create nested groups; add, edit, move between groups, and delete favorites
- Save a preferred grid or list view in settings
- Save web and `file://` URLs locally
- Generate two-size page previews with SHA-256 deduplication
- Show fallback cards and hover previews with Open, Edit, and Copy URL actions; saved previews remain usable for sites that block embedding
- Organize groups with drag-and-drop, bulk actions, and undo/redo

### Phase 6: Local File Links

- Check file URL access and show permission guidance
- Report local-file availability and apply per-device path overrides when opening

### Phase 7: ZIP Import/Export

- Export all groups or selected group trees with preview images
- Validate ZIP contents and preview imports before writing
- Merge as copy, update matching IDs, or replace after saving a snapshot

### Planned for Later Phases

- Theme preferences and accessibility polish
- Google Drive sync (Phase 8)

Manual browser acceptance remains tracked in the [Phase 4](docs/phase-4-manual-test.md), [Phase 5](docs/phase-5-manual-test.md), [Phase 6](docs/phase-6-manual-test.md), and [Phase 7](docs/phase-7-manual-test.md) checklists.

## Interface Preview

Popup:

![FavoritePod popup home screen with recent pages and the Add bookmark review dialog](docs/screenshots/popup.png)

Dashboard grid view:

![FavoritePod dashboard showing saved favorites in grid view](docs/screenshots/dashboard-grid.png)

Dashboard list view:

![FavoritePod dashboard showing saved favorites in list view](docs/screenshots/dashboard-list.png)

Empty dashboard (desktop and mobile):

![FavoritePod empty dashboard at desktop size](docs/screenshots/dashboard-empty-desktop.png)

![FavoritePod empty dashboard at mobile size](docs/screenshots/dashboard-empty-mobile.png)

See the [full set of UI captures](docs/PROJECT_OVERVIEW.md#ui-captures).

---

## 📚 Documentation

| Document                                                       | Purpose                                   |
| -------------------------------------------------------------- | ----------------------------------------- |
| [**NEXT_STEPS.md**](NEXT_STEPS.md)                             | Current checklist and development handoff |
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)           | Architecture and UI captures              |
| [**docs/IMPLEMENTATION_PLAN.md**](docs/IMPLEMENTATION_PLAN.md) | Phase-by-phase development roadmap        |
| [**docs/CODE_GUIDE.md**](docs/CODE_GUIDE.md)                   | Technical reference for AI agents         |
| [**docs/DESIGN_GUIDE.md**](docs/DESIGN_GUIDE.md)               | UI/UX patterns and components             |
| [**docs/AI_AGENT_GUIDE.md**](docs/AI_AGENT_GUIDE.md)           | Quick start for AI development agents     |
| [docs/project_plan.md](docs/project_plan.md)                   | Original requirements (full v2 scope)     |

---

## 🛠️ Technology Stack

- **TypeScript 5.x** - Type safety
- **React 18** - UI framework
- **Vite 6.x** - Build tool
- **Tailwind CSS** - Styling
- **Dexie** - IndexedDB wrapper
- **Manifest V3** - Chrome extension standard

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20.19+ and npm
- Google Chrome
- Basic knowledge of Chrome extensions (optional, guides included)

### Install and Run

```bash
npm install

# Start the extension development build with HMR
npm run dev

# Or create a production build
npm run build
```

To load it locally in Chrome:

1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and choose the project's `dist/` directory.
3. Pin FavoritePod, then click its toolbar icon to open the popup.

For development, keep `npm run dev` running while Chrome has the unpacked `dist/` build loaded. For a production build, run `npm run build` and reload the extension from `chrome://extensions/`.

Development uses `localhost:5173` for both HTTP and hot reload. Run only one
development server for this project; if port 5173 is occupied, stop the previous
server before restarting. The port is fixed so extension pages can connect to
the correct WebSocket. After changing Vite configuration or switching between
development and production builds, reload FavoritePod in `chrome://extensions/`
and reopen its popup/dashboard. Stop the development server before building for
production, since both commands write to `dist/`.

Useful checks:

```bash
npm test
npm run test:coverage
npm run type-check
npm run lint
npm run format:check
```

### Local Extension Identity

The local RSA private key is stored at `.local/favoritepod-local.pem` and is ignored by Git. The corresponding public key is in `public/manifest.json`, which keeps the local extension ID stable. Back up the private key somewhere secure if you may need it later; never commit or share it. A Chrome Web Store developer account is not needed for local development or testing.

---

## 📖 Development Workflow

This project is designed for **AI-assisted development**:

1. Read the relevant guide (IMPLEMENTATION_PLAN, CODE_GUIDE, DESIGN_GUIDE)
2. Pick a specific module/feature from the plan
3. Follow the existing code and design tokens; adapt guide examples to the current implementation
4. Run the automated core tests, then manually check Chrome extension behavior
5. Iterate with AI agent on feedback
6. Move to next feature

**Testing**:

- Last recorded implementation checks: 29 tests passed, with 100% merge coverage; type check, lint, formatting, and production build passed
- Vitest covers core storage, migrations, merge behavior, and favicon capture with mocked browser APIs
- Popup APIs and the full extension workflow need manual Chrome checks; the screenshots are visual references, not evidence that these checks passed

**Codebase principles**:

- Clear modular architecture
- Shared components and consistent design tokens
- Comprehensive type definitions

---

## 🎯 V1 Simplified Scope

We're starting with a focused v1 to validate core functionality:

### Remaining V1 Work

- Chrome validation of screenshot capture and `file://` access ⭐ **PRIORITY**
- ZIP export/import

### ❌ Deferred to V2

- Google Drive sync (most complex)
- Visited-site discovery
- Advanced animations
- Automated E2E tests

Historical estimates in the implementation plan are planning references; no release date is committed.

---

## 🔒 Security & Permissions

### Required Permissions

- `activeTab` - Screenshot capture
- `favicon` - Access to Chrome's cached page icons
- `unlimitedStorage` - Large thumbnail DB

### Optional Permissions (v2)

- `history` - Visited site suggestions
- `topSites` - Frequently visited

The current manifest requests `activeTab`, `favicon`, and `unlimitedStorage`. IndexedDB
does not require Chrome's separate `storage` permission.

### No Scary Permissions

- ❌ No `<all_urls>` (uses `activeTab` instead)
- ❌ No remote code execution
- ❌ No external analytics

### File Access

Local file (`file://`) support requires manual user permission:

1. Install extension
2. Go to `chrome://extensions/`
3. Find FavoritePod
4. Enable "Allow access to file URLs"

---

## 🤝 Contributing

This is an AI-assisted development project. The codebase is designed to be:

- **AI-friendly**: Clear types, modular structure, documented patterns
- **Human-reviewable**: Manual testing, clear acceptance criteria
- **Maintainable**: Pure functions, TypeScript strict mode, minimal dependencies

To work on this project:

1. Review the implementation plan
2. Pick a module from CODE_GUIDE.md
3. Implement using provided patterns
4. Run automated checks and test Chrome-specific paths manually
5. Submit PR with test results

---

## 📝 License

[Choose license - MIT recommended for open source]

---

## 🗺️ Roadmap

### V1 (Current)

Focus on core launcher with file:// support

### V2 (Future)

- Google Drive synchronization
- Advanced features (history discovery, context menus)
- Browser E2E testing

### V3 (Future) - TBD

- New-tab replacement variant
- Custom themes
- Tag system
- Shared collections (requires backend)

---

## 💡 Design Philosophy

**FavoritePod is**:

- **Fast and fluid**: 60fps interactions, instant feedback
- **Content-first**: UI fades away, your launchers shine
- **Forgiving**: Clear states, undo, helpful errors
- **Accessible**: Keyboard-first, semantic HTML
- **Private**: Your data stays local (or in your Drive)

**FavoritePod is not**:

- A full bookmark manager replacement
- A complex workflow automation tool
- A social bookmarking service

We focus on doing one thing well: **organizing and accessing your favorite pages and local tools with visual flair**.

---

## ❓ FAQ

### Why focus on file:// support?

Many developers have local HTML tools (documentation, dashboards, utilities) that are hard to organize in Chrome. FavoritePod makes them first-class citizens.

### Why not use browser bookmarks?

- Bookmarks don't support thumbnails
- Bookmarks don't handle local files well
- Bookmarks lack visual organization
- Bookmarks don't sync thumbnails

### Why build a Chrome extension instead of a web app?

- Access to `chrome.tabs.captureVisibleTab()` for screenshots
- Ability to open `file://` URLs
- System integration (toolbar popup)
- Offline-first by design

### Why IndexedDB instead of chrome.storage?

- IndexedDB handles binary blobs (thumbnails) efficiently
- Better for large datasets (1000+ items)
- Standard Web API (easier to test)
- chrome.storage has quota limits

### Will there be a Firefox/Safari version?

Maybe in v3+. V1 focuses on Chrome to validate the concept. Firefox and Safari have different extension APIs and limitations.

---

## 📧 Contact

[Add contact information or Discord/GitHub discussions link]

---

## 🙏 Acknowledgments

Built with:

- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Dexie.js](https://dexie.org/)
- [Heroicons](https://heroicons.com/)
- Claude Code (AI development assistant)

Inspired by visual bookmark managers, start pages, and the need for better local file organization.
