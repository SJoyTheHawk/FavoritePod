# AI Agent Quick Start Guide

**For Claude Opus, GPT-6/6.1, and other AI development agents**

This document helps AI agents quickly understand how to work on FavoritePod efficiently.

---

## 🎯 Project Context

**What**: Chrome extension for visual bookmark launcher with local file support  
**Priority**: `file://` URL handling is the PRIMARY v1 feature  
**Approach**: Unit-test core logic; manually test extension behavior in Chrome  
**Experience Level**: First-time Chrome extension developers  

---

## 📋 Essential Reading Order

For any task, read in this order:

1. **This document** (AI_AGENT_GUIDE.md) - Quick context
2. **Relevant section of CODE_GUIDE.md** - Technical patterns
3. **Relevant section of DESIGN_GUIDE.md** - UI patterns (if UI work)
4. **IMPLEMENTATION_PLAN.md phase** - Acceptance criteria

Don't read everything at once. Read what's relevant to your current task.

---

## 🏗️ Architecture at a Glance

```
Extension Structure:
├── popup/          → Toolbar popup (save current page)
├── dashboard/      → Full launcher UI (main app)
├── background/     → Service worker (MV3, no DOM access)
└── core/           → Shared business logic

Key Technologies:
- TypeScript + React + Vite
- IndexedDB via Dexie (local storage)
- Tailwind CSS (styling)
- Chrome Extension Manifest V3

Data Model:
- Groups: Organize items in a nested parentId hierarchy
- Items: Individual bookmarks (URL + thumbnail + metadata)
- Thumbnails: JPEG blobs stored by SHA-256 hash
```

---

## 🎨 Code Patterns

### Pattern 1: Create a New Module

```typescript
// src/core/my-feature.ts

import { db } from './db';

/**
 * Brief description of what this module does
 */

// Types first
export interface MyData {
  id: string;
  // ... fields
}

// Pure functions (testable, no side effects)
export function processData(input: MyData): MyData {
  // ...
}

// DB operations (async)
export async function saveData(data: MyData): Promise<void> {
  await db.myTable.put(data);
}

// Export everything clearly
```

**Key principles**:
- Pure functions where possible
- Clear TypeScript types
- Async/await for all DB operations
- JSDoc for complex logic

### Pattern 2: Create a React Component

```tsx
// src/dashboard/components/MyComponent.tsx

import { useState, useEffect } from 'react';

interface MyComponentProps {
  // Props with clear types
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState<string>('');
  
  useEffect(() => {
    // Side effects here
    return () => {
      // Cleanup
    };
  }, []);
  
  return (
    <div className="...tailwind classes...">
      {/* Component content */}
    </div>
  );
}
```

**Key principles**:
- Named exports (not default)
- Props interface
- Tailwind for styling (see DESIGN_GUIDE.md)
- Hooks for state/effects

### Pattern 3: Chrome Extension API Usage

```typescript
// GOOD: Use Chrome APIs correctly

// Capture screenshot (from popup with activeTab)
const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
  format: 'jpeg',
  quality: 80
});

// Open URL (works for file://)
await chrome.tabs.create({ url: item.url });

// Check file access permission
const hasAccess = await chrome.extension.isAllowedFileSchemeAccess();

// Get extension ID
const extensionId = chrome.runtime.id;
```

**Key principles**:
- All Chrome APIs are async (use await)
- Check permissions before using sensitive APIs
- Handle errors gracefully

---

## 🚫 Common Pitfalls

### 1. Service Worker Limitations
```typescript
// ❌ DON'T: Use DOM APIs in background/service-worker.ts
document.querySelector('#app'); // Throws error

// ❌ DON'T: Use window or localStorage
window.location.href; // Undefined
localStorage.setItem(); // Throws error

// ✅ DO: Use IndexedDB and Chrome APIs
await db.items.toArray();
await chrome.storage.local.set({ key: 'value' });
```

### 2. URL Validation (CRITICAL FOR SECURITY)
```typescript
// ❌ DON'T: Accept any URL
function saveItem(url: string) {
  // Dangerous: javascript:, data:, etc.
}

// ✅ DO: Validate URL scheme
import { isValidUrl } from './validation';

function saveItem(url: string) {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL scheme');
  }
  // Only http:, https:, file: allowed
}
```

### 3. File URLs Cannot Use <a> Tags
```typescript
// ❌ DON'T: Use anchor tags for file://
<a href="file:///path/to/file.html">Open</a>
// Blocked by Chrome

// ✅ DO: Use chrome.tabs.create()
async function openFile(url: string) {
  await chrome.tabs.create({ url });
}
```

### 4. Thumbnail Memory Leaks
```typescript
// ❌ DON'T: Forget to revoke object URLs
const url = URL.createObjectURL(blob);
// Memory leak if not cleaned up

// ✅ DO: Revoke in cleanup
useEffect(() => {
  const url = URL.createObjectURL(blob);
  setImageUrl(url);
  
  return () => {
    URL.revokeObjectURL(url); // Cleanup
  };
}, [blob]);
```

---

## 🧪 Testing Approach

Pure core logic and IndexedDB storage have Vitest unit tests. Extension API
behavior and the full popup-to-dashboard workflow still need manual checks in
Chrome. Add tests when they verify behavior outside the implementation details.

### Manual Test Checklist Pattern

### Testing Checklist Pattern

When implementing a feature, provide a manual test checklist:

```markdown
## Manual Test: Add Bookmark Review

### Setup
1. Load extension in Chrome (unpacked from dist/)
2. Navigate to any website (e.g., google.com)

### Test Steps
1. Click extension icon in toolbar
2. Popup should fit the recent pages without scrolling
3. Confirm the popup home screen shows "Add bookmark" and recent pages
4. Click "Add bookmark"
5. The review dialog should add the current page and show its preview
6. Change the name or folder, then click "Done"
7. Reopen the popup and confirm the page appears in recent pages
8. Open dashboard (click "Open launcher")
9. New item should appear with thumbnail

### Expected Results
- ✅ Popup opens without errors
- ✅ Screenshot captured successfully when the review dialog opens
- ✅ Item appears in dashboard
- ✅ Thumbnail displays correctly
- ✅ Title matches page title
- ✅ Favicon remains visible after closing and reopening the popup and launcher
- ✅ Reopening Add bookmark refreshes an existing favorite’s icon without duplication
- ✅ Name and folder edits persist
- ✅ Remove deletes the current favorite
- ✅ The x action removes a page from recent pages without deleting its favorite
- ✅ Clicking item opens correct URL

### Edge Cases to Test
- [ ] Test on chrome:// page (should fail gracefully)
- [ ] Test on page with no favicon
- [ ] Test with very long title (should truncate)
- [ ] Test rapid clicking (should not duplicate)

### How to Verify
Open Chrome DevTools:
- Console: No errors
- Application > IndexedDB > FavoritePod:
  - Check `items` table has new entry
  - Check `thumbnails` table has blob
```

### Debugging Tips

**View Extension Logs**:
1. Popup: Right-click icon → "Inspect popup"
2. Dashboard: Open dashboard → F12
3. Service Worker: chrome://extensions/ → "service worker" link

**View IndexedDB**:
1. Open DevTools (F12)
2. Application tab → Storage → IndexedDB
3. Browse FavoritePod database tables

**Common Issues**:
- "Cannot read property": Check async/await usage
- "Permission denied": Check manifest.json permissions
- "Storage quota exceeded": Add `unlimitedStorage` permission
- Popup closes immediately: Pin DevTools open

---

## 📝 Task Execution Template

When you receive a task, follow this structure:

### 1. Understand the Task
- What module/feature am I building?
- What files need to be created/modified?
- What are the acceptance criteria?

### 2. Plan the Implementation
- List files to create/modify
- Identify dependencies (types, imports)
- Note any Chrome API usage

### 3. Implement
- Create/modify files
- Follow patterns from CODE_GUIDE.md
- Add TypeScript types
- Handle errors

### 4. Provide Test Instructions
- Manual test checklist
- Expected results
- Edge cases to verify
- Debugging tips

### 5. Document
- Add JSDoc comments for complex logic
- Update README if needed
- Note any assumptions made

---

## 🎯 V1 Priority Order

If you're choosing what to work on, prioritize in this order:

1. **File:// link support** ⭐ PRIMARY GOAL
   - Opening file:// URLs
   - Permission checking
   - Permission hint UI
   - Path override system

2. **Core data layer**
   - IndexedDB schema
   - CRUD operations
   - Basic types

3. **Thumbnail system**
   - Capture from popup
   - Resize and hash
   - Storage and retrieval

4. **Basic UI**
   - Popup (save page)
   - Dashboard shell
   - Item cards
   - Group list

5. **Features**
   - Drag-and-drop
   - Edit/delete
   - ZIP export/import

**Implemented in v1**: Google Drive sync, profile-local connection recovery,
sync status/history, quota reporting, optional visited-site discovery, and
right-click saving (Phases 9.1/9.2). Discovery/history access and context menus
are opt-in from Settings; hidden suggestions stay local. **Defer to v2**:
optional visual polish, and other features not listed in the implementation plan.

---

## 🔧 Development Commands

```bash
# Start dev server with HMR
npm run dev

# Build for production
npm run build

# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format
```

After build, load `dist/` folder as unpacked extension in Chrome.

---

## 💡 AI-Friendly Features

This codebase is designed for AI agents:

✅ **Copy-paste ready**: Code examples work as-is  
✅ **Type-safe**: Full TypeScript types provided  
✅ **Modular**: Each module is independent  
✅ **Documented**: Comments explain "why", not just "what"  
✅ **Testable**: Pure functions, clear interfaces  
✅ **No magic**: Explicit over clever  

---

## 📞 When to Ask for Clarification

Ask the human when:

1. **Requirements are ambiguous**: "Should file:// items show a special badge?"
2. **Multiple valid approaches**: "Use HTML5 drag-and-drop or @dnd-kit for v1?"
3. **Design decisions**: "What should the empty state illustration look like?"
4. **Edge cases**: "What happens if user has 10,000 items?"
5. **Performance tradeoffs**: "Virtual scrolling adds complexity, needed for v1?"

Don't ask about:
- Technical implementation details (refer to CODE_GUIDE.md)
- Chrome API usage (documented in CODE_GUIDE.md)
- Styling patterns (refer to DESIGN_GUIDE.md)
- Module structure (follow existing patterns)

---

## 🚀 Example Task Execution

### Task: "Implement thumbnail capture module"

**1. Understand**:
- File: `src/core/thumbnail.ts`
- Needs: captureVisibleTab, resize, hash, save/get functions
- Chrome API: `chrome.tabs.captureVisibleTab()`

**2. Plan**:
```
Create src/core/thumbnail.ts
├── captureVisibleTab() - Capture screenshot
├── resizeImage() - Resize to 640x400
├── saveThumbnail() - Store in IndexedDB
└── getThumbnail() - Retrieve by hash

Dependencies:
- Crypto API (SHA-256 hash)
- OffscreenCanvas (resize)
- Dexie (storage)
```

**3. Implement**:
[Create file with complete implementation following CODE_GUIDE.md patterns]

**4. Test Instructions**:
```markdown
## Test: Thumbnail Capture

1. Load extension
2. Visit google.com
3. Open popup
4. Open DevTools console
5. Run: chrome.tabs.query({active:true,currentWindow:true})
   to get windowId
6. Run: const result = await captureVisibleTab()
7. Verify: result.hash is 64-char hex string
8. Verify: result.blob is Blob with type image/jpeg
9. Check IndexedDB: thumbnails table has entry
```

**5. Document**:
```typescript
/**
 * Captures the visible tab as a thumbnail JPEG
 * Requires activeTab permission (granted by popup click)
 * 
 * @returns Thumbnail data with blob and hash, or null if capture fails
 */
export async function captureVisibleTab(): Promise<...> {
```

---

## 🎓 Learning Resources

If you need to understand Chrome extension concepts:

- Manifest V3: https://developer.chrome.com/docs/extensions/mv3/
- chrome.tabs API: https://developer.chrome.com/docs/extensions/reference/tabs/
- chrome.identity API: https://developer.chrome.com/docs/extensions/reference/identity/
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

But remember: CODE_GUIDE.md has working examples for everything we need.

---

## ✅ Ready to Start

You now have everything you need to work on FavoritePod:

1. ✅ Project context (this document)
2. ✅ Technical patterns (CODE_GUIDE.md)
3. ✅ Design system (DESIGN_GUIDE.md)
4. ✅ Implementation roadmap (IMPLEMENTATION_PLAN.md)

**Next step**: Pick a task from IMPLEMENTATION_PLAN.md Phase 1, read the relevant CODE_GUIDE section, and start building!

Good luck! 🚀

