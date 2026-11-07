# FavoritePod Design Guide

## Design Philosophy

FavoritePod follows a **modern, minimal, and tactile** design language:

- **Fast and fluid**: 60fps animations, instant feedback
- **Content-first**: UI fades away, launchers take center stage
- **Adaptive**: Respects system theme (dark/light)
- **Forgiving**: Clear states, reversible actions, helpful errors
- **Accessible**: Keyboard-first, semantic HTML, ARIA labels

---

## Color System

### Semantic Colors

Define colors as CSS variables for theme switching:

**src/styles/themes.css**:
```css
:root {
  /* Light mode (default) */
  --color-background: #ffffff;
  --color-surface: #f8f9fa;
  --color-surface-hover: #f1f3f5;
  --color-border: #e9ecef;
  --color-border-focus: #adb5bd;
  
  --color-text-primary: #212529;
  --color-text-secondary: #6c757d;
  --color-text-tertiary: #adb5bd;
  
  --color-primary: #3b82f6;      /* Blue */
  --color-primary-hover: #2563eb;
  --color-primary-light: #dbeafe;
  
  --color-success: #10b981;      /* Green */
  --color-success-light: #d1fae5;
  
  --color-warning: #f59e0b;      /* Amber */
  --color-warning-light: #fef3c7;
  
  --color-danger: #ef4444;       /* Red */
  --color-danger-light: #fee2e2;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
  
  /* Border radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark mode */
[data-theme="dark"] {
  --color-background: #111827;
  --color-surface: #1f2937;
  --color-surface-hover: #374151;
  --color-border: #374151;
  --color-border-focus: #6b7280;
  
  --color-text-primary: #f9fafb;
  --color-text-secondary: #d1d5db;
  --color-text-tertiary: #9ca3af;
  
  --color-primary: #60a5fa;
  --color-primary-hover: #3b82f6;
  --color-primary-light: #1e3a8a;
  
  --color-success: #34d399;
  --color-success-light: #064e3b;
  
  --color-warning: #fbbf24;
  --color-warning-light: #78350f;
  
  --color-danger: #f87171;
  --color-danger-light: #7f1d1d;
  
  /* Darker shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.3);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.3);
}

/* Auto theme (follows system) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Copy dark mode vars here */
  }
}
```

### Color Usage

| Use Case | Light Mode | Dark Mode |
|----------|------------|-----------|
| Page background | `#ffffff` | `#111827` |
| Card background | `#f8f9fa` | `#1f2937` |
| Hover state | `#f1f3f5` | `#374151` |
| Primary action | Blue | Blue (lighter) |
| Success feedback | Green | Green (lighter) |
| Danger | Red | Red (lighter) |
| Text (primary) | `#212529` | `#f9fafb` |
| Text (secondary) | `#6c757d` | `#d1d5db` |

---

## Typography

### Font Stack

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", 
               Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", "Courier New", monospace;
}

body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Type Scale

```css
:root {
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
}
```

### Typography Examples

```tsx
// Page title
<h1 className="text-3xl font-bold text-text-primary">
  FavoritePod
</h1>

// Section heading
<h2 className="text-xl font-semibold text-text-primary mb-4">
  Recent Items
</h2>

// Body text
<p className="text-base text-text-secondary">
  Save your favorite pages and local tools.
</p>

// Small label
<span className="text-sm text-text-tertiary">
  Last synced 2 minutes ago
</span>

// Code/URL
<code className="font-mono text-sm bg-surface px-2 py-1 rounded">
  file:///Users/example/tools/index.html
</code>
```

---

## Layout & Spacing

### Spacing Scale

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
}
```

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header (h-16)                                              │
│  [Logo] [Search] [View] [Avatar] [Settings]                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐          │
│  │        │  │        │  │        │  │        │          │
│  │  Item  │  │  Item  │  │  Item  │  │  Item  │          │
│  │        │  │        │  │        │  │        │          │
│  └────────┘  └────────┘  └────────┘  └────────┘          │
│                                                             │
│  Grid: gap-4, p-6, max-w-7xl mx-auto                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Grid System

```tsx
// Dashboard grid (responsive)
<div className="
  grid 
  grid-cols-2 
  md:grid-cols-3 
  lg:grid-cols-4 
  xl:grid-cols-5 
  gap-4 
  p-6
">
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</div>
```

---

## Components

### Button

**Variants**: primary, secondary, danger, ghost

```tsx
// Primary button
<button className="
  px-4 py-2 
  bg-primary text-white 
  rounded-lg 
  font-medium 
  transition-all duration-200
  hover:bg-primary-hover 
  hover:shadow-md
  active:scale-95
  focus:outline-none 
  focus:ring-2 
  focus:ring-primary 
  focus:ring-offset-2
">
  Save Page
</button>

// Secondary button
<button className="
  px-4 py-2 
  bg-surface 
  text-text-primary 
  border border-border
  rounded-lg 
  font-medium 
  transition-all duration-200
  hover:bg-surface-hover 
  hover:border-border-focus
  active:scale-95
  focus:outline-none 
  focus:ring-2 
  focus:ring-primary 
  focus:ring-offset-2
">
  Cancel
</button>

// Danger button
<button className="
  px-4 py-2 
  bg-danger text-white 
  rounded-lg 
  font-medium 
  transition-all duration-200
  hover:bg-red-600 
  hover:shadow-md
  active:scale-95
">
  Delete
</button>

// Ghost button (icon only)
<button className="
  p-2 
  text-text-secondary 
  rounded-lg 
  transition-colors duration-200
  hover:bg-surface-hover 
  hover:text-text-primary
">
  <IconTrash className="w-5 h-5" />
</button>
```

### Item Card

**Specs**:
- Aspect ratio: 16:10 (matches thumbnail)
- Rounded corners: `rounded-xl` (12px)
- Hover effect: Lift + shadow
- Thumbnail: Object-fit cover

```tsx
<div className="
  group
  relative
  bg-surface 
  rounded-xl 
  overflow-hidden
  transition-all duration-200
  hover:shadow-lg
  hover:-translate-y-1
  cursor-pointer
">
  {/* Thumbnail */}
  <div className="aspect-[16/10] bg-border relative">
    {thumbnailUrl ? (
      <img 
        src={thumbnailUrl} 
        alt={item.title}
        className="w-full h-full object-cover"
      />
    ) : (
      <FallbackCard title={item.title} url={item.url} />
    )}
    
    {/* Overlay actions (show on hover) */}
    <div className="
      absolute inset-0 
      bg-gradient-to-t from-black/60 to-transparent
      opacity-0 group-hover:opacity-100
      transition-opacity duration-200
      flex items-end justify-between
      p-3
    ">
      <button className="p-2 bg-white/90 rounded-lg hover:bg-white">
        <IconEdit className="w-4 h-4" />
      </button>
      <button className="p-2 bg-white/90 rounded-lg hover:bg-white">
        <IconTrash className="w-4 h-4 text-danger" />
      </button>
    </div>
  </div>
  
  {/* Title */}
  <div className="p-3">
    <h3 className="
      text-sm font-medium text-text-primary 
      truncate
      group-hover:text-primary
      transition-colors
    ">
      {item.title}
    </h3>
    
    {/* Domain or file indicator */}
    <p className="text-xs text-text-tertiary truncate mt-1">
      {item.url.startsWith('file://') ? (
        <>
          <IconFile className="inline w-3 h-3 mr-1" />
          Local file
        </>
      ) : (
        new URL(item.url).hostname
      )}
    </p>
  </div>
</div>
```

### Fallback Card (No Thumbnail)

```tsx
function FallbackCard({ title, url }: { title: string; url: string }) {
  // Generate gradient from URL hash
  const gradient = useMemo(() => {
    const hash = url.split('').reduce((acc, char) => 
      char.charCodeAt(0) + ((acc << 5) - acc), 0
    );
    const hue = Math.abs(hash % 360);
    return `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${hue + 30}, 60%, 40%))`;
  }, [url]);
  
  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center p-4"
      style={{ background: gradient }}
    >
      {/* Large favicon or icon */}
      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
        <IconLink className="w-8 h-8 text-white" />
      </div>
      
      <p className="text-white text-sm font-medium text-center line-clamp-2">
        {title}
      </p>
    </div>
  );
}
```

### Modal Dialog

```tsx
<div className="
  fixed inset-0 
  bg-black/50 
  backdrop-blur-sm
  flex items-center justify-center 
  p-4
  z-50
  animate-fade-in
">
  <div className="
    bg-background 
    rounded-2xl 
    shadow-2xl
    max-w-md w-full
    animate-scale-in
  ">
    {/* Header */}
    <div className="px-6 py-4 border-b border-border">
      <h2 className="text-xl font-semibold text-text-primary">
        Edit Item
      </h2>
    </div>
    
    {/* Body */}
    <div className="px-6 py-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Title
        </label>
        <input
          type="text"
          className="
            w-full px-3 py-2
            bg-surface
            border border-border
            rounded-lg
            text-text-primary
            focus:outline-none
            focus:ring-2
            focus:ring-primary
            focus:border-transparent
            transition-all
          "
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      
      {/* More fields... */}
    </div>
    
    {/* Footer */}
    <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
      <button className="px-4 py-2 bg-surface rounded-lg hover:bg-surface-hover">
        Cancel
      </button>
      <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover">
        Save
      </button>
    </div>
  </div>
</div>
```

### Toast Notification

```tsx
<div className="
  fixed bottom-4 right-4
  bg-surface 
  border border-border
  rounded-xl 
  shadow-xl
  p-4
  min-w-[300px]
  animate-slide-in-up
  z-50
">
  <div className="flex items-start gap-3">
    {/* Icon */}
    <div className="flex-shrink-0">
      <div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center">
        <IconCheck className="w-5 h-5 text-success" />
      </div>
    </div>
    
    {/* Content */}
    <div className="flex-1">
      <h3 className="text-sm font-semibold text-text-primary">
        Page saved successfully
      </h3>
      <p className="text-xs text-text-secondary mt-1">
        Added to "Work Tools" group
      </p>
    </div>
    
    {/* Close */}
    <button className="flex-shrink-0 text-text-tertiary hover:text-text-primary">
      <IconX className="w-4 h-4" />
    </button>
  </div>
</div>
```

### Input Field

```tsx
<div className="space-y-2">
  <label 
    htmlFor="url" 
    className="block text-sm font-medium text-text-secondary"
  >
    URL
  </label>
  <input
    id="url"
    type="url"
    placeholder="https://example.com or file://..."
    className="
      w-full px-3 py-2
      bg-surface
      border border-border
      rounded-lg
      text-text-primary
      placeholder:text-text-tertiary
      focus:outline-none
      focus:ring-2
      focus:ring-primary
      focus:border-transparent
      transition-all
      disabled:opacity-50
      disabled:cursor-not-allowed
    "
  />
  
  {/* Error state */}
  {error && (
    <p className="text-xs text-danger flex items-center gap-1">
      <IconAlertCircle className="w-3 h-3" />
      {error}
    </p>
  )}
  
  {/* Help text */}
  <p className="text-xs text-text-tertiary">
    Supports http://, https://, and file:// URLs
  </p>
</div>
```

### Dropdown / Select

```tsx
<div className="relative">
  <button className="
    w-full px-3 py-2
    bg-surface
    border border-border
    rounded-lg
    text-left
    text-text-primary
    hover:bg-surface-hover
    focus:outline-none
    focus:ring-2
    focus:ring-primary
    transition-all
    flex items-center justify-between
  ">
    <span>{selectedGroup?.title || 'Select group'}</span>
    <IconChevronDown className="w-4 h-4 text-text-tertiary" />
  </button>
  
  {/* Dropdown menu (use @headlessui/react Listbox for accessibility) */}
  <div className="
    absolute top-full left-0 right-0 mt-2
    bg-surface
    border border-border
    rounded-lg
    shadow-lg
    overflow-hidden
    z-10
  ">
    {groups.map(group => (
      <button
        key={group.id}
        className="
          w-full px-3 py-2
          text-left text-sm
          hover:bg-surface-hover
          transition-colors
        "
      >
        {group.title}
      </button>
    ))}
  </div>
</div>
```

### Empty State

```tsx
<div className="
  flex flex-col items-center justify-center
  min-h-[400px]
  text-center
  p-8
">
  {/* Illustration or icon */}
  <div className="w-24 h-24 mb-6 bg-surface rounded-full flex items-center justify-center">
    <IconInbox className="w-12 h-12 text-text-tertiary" />
  </div>
  
  <h3 className="text-xl font-semibold text-text-primary mb-2">
    No items yet
  </h3>
  
  <p className="text-text-secondary mb-6 max-w-sm">
    Save your first page by clicking the extension icon while browsing
  </p>
  
  <button className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover">
    Learn How
  </button>
</div>
```

### Loading State (Skeleton)

```tsx
// Item card skeleton
<div className="bg-surface rounded-xl overflow-hidden animate-pulse">
  <div className="aspect-[16/10] bg-border" />
  <div className="p-3 space-y-2">
    <div className="h-4 bg-border rounded w-3/4" />
    <div className="h-3 bg-border rounded w-1/2" />
  </div>
</div>

// Full page skeleton
<div className="grid grid-cols-4 gap-4 p-6">
  {Array.from({ length: 8 }).map((_, i) => (
    <ItemCardSkeleton key={i} />
  ))}
</div>
```

---

## Animations

### CSS Animations

**src/styles/animations.css**:
```css
/* Fade in */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-fade-in {
  animation: fade-in 200ms ease-out;
}

/* Scale in (modal) */
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Slide in from bottom (toast) */
@keyframes slide-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in-up {
  animation: slide-in-up 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Slide in from right (sidebar) */
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in-right {
  animation: slide-in-right 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Spin (loading) */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Pulse (skeleton loading) */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Shake (error) */
@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
}

.animate-shake {
  animation: shake 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Bounce (success) */
@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.animate-bounce {
  animation: bounce 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Transition Guidelines

| Interaction | Duration | Easing | Example |
|-------------|----------|--------|---------|
| Hover | 150-200ms | `ease-out` | Button color change |
| Click/Tap | 100-150ms | `ease-in-out` | Button press |
| Modal open | 200-250ms | `ease-out` | Fade + scale in |
| Drawer slide | 300ms | `ease-out` | Sidebar from right |
| Toast appear | 300ms | `ease-out` | Slide up from bottom |
| Loading | 1s | `linear` | Spinner rotation |

### Micro-interactions

**Button press**:
```css
.btn {
  transition: all 150ms ease-out;
}

.btn:active {
  transform: scale(0.95);
}
```

**Card hover**:
```css
.card {
  transition: all 200ms ease-out;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

**Drag handle hint**:
```css
.drag-handle {
  cursor: grab;
  transition: transform 150ms ease-out;
}

.drag-handle:active {
  cursor: grabbing;
  transform: scale(1.05);
}
```

---

## Icons

### Icon System

Use Heroicons (MIT license, React components available):

```bash
npm install @heroicons/react
```

**Common icons**:
```tsx
import {
  BookmarkIcon,
  FolderIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  DocumentIcon,
  LinkIcon,
  CloudIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';

// Or solid variants
import { CheckCircleIcon } from '@heroicons/react/24/solid';
```

**Icon sizing**:
```tsx
// Small (16px)
<PlusIcon className="w-4 h-4" />

// Medium (20px)
<BookmarkIcon className="w-5 h-5" />

// Large (24px)
<FolderIcon className="w-6 h-6" />
```

---

## Responsive Design

### Breakpoints

```css
/* Tailwind default breakpoints */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large desktops */
```

### Dashboard Grid Responsive

```tsx
<div className="
  grid
  grid-cols-1         /* Mobile: 1 column */
  sm:grid-cols-2      /* Small: 2 columns */
  md:grid-cols-3      /* Tablet: 3 columns */
  lg:grid-cols-4      /* Laptop: 4 columns */
  xl:grid-cols-5      /* Desktop: 5 columns */
  2xl:grid-cols-6     /* Large: 6 columns */
  gap-4
  p-4 sm:p-6
">
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</div>
```

### Popup Size

```tsx
// Keep the popup width fixed and let it fit its content vertically
<div className="w-80 bg-background">
  {/* Popup content */}
</div>
```

### Toolbar Capture Review

The popup home screen keeps a single **Add bookmark** action, up to five recent
pages, and access to the launcher. Each recent row has an x action that removes
it from the recent list while keeping the favorite in the launcher. Opening the action shows a focused
review dialog for the current supported page. Add it when the dialog opens, then
show its captured thumbnail when available, its address, and compact fields for
its name and folder. **Done** saves edits and closes the dialog; **Remove**
deletes the favorite. If the current URL is already saved, edit that favorite
instead of adding a duplicate. Keep recent pages on the home screen, outside the
review dialog.

---

## Right-click Save Popup

Chrome exposes one **Save to FavoritePod** action for pages and links, with no
submenu. Open the toolbar popup directly to the existing bookmark dialog layout:
URL/favicon, Name, and Folder with nested paths. Use the same typography, spacing,
colors, focus treatment, and 320px popup width. Right-click saves are drafts:
**Save** commits; **Cancel**, close, and Escape leave the library unchanged.
Existing favorites prefill their saved name/folder. The regular toolbar button
keeps its Add bookmark/recent-pages home and immediate-save review behavior.
If the toolbar popup cannot open, reuse the same form in a small popup window.

## Frequently Visited Shortcuts

Show Frequently visited above the All favorites heading and toolbar, outside search.
A separate default-off option shows the same section above the designated home group.
Each view has independent visibility; hiding from its menu affects that view only.
Use compact 6.5rem tiles and a 0.5rem gap in every library view. Center each row,
including partially filled rows, and wrap on narrow screens. Each shortcut has
a 24px favicon in a transparent 48px area and one truncated centered 12px label.
Keep tiles borderless with a surface hover state
and visible keyboard focus. Clicking opens the site.

Use an accessible three-dot menu for Add to favorites/Edit favorite and Hide
shortcut. Show that button on hover, keyboard focus, menu-open, and touch. Keep
Refresh, Settings, and Hide frequently visited in the section menu. Permission,
empty, and error copy stays compact and inline. The default-on Settings visibility
switch hides the whole section independently of access permission.

## Accessibility

### Keyboard Navigation

**Focus styles**:
```css
.focus-visible:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Alternative ring style */
.focus-ring:focus {
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
```

**Tab order**:
- Use semantic HTML (`<button>`, `<a>`, `<input>`)
- Avoid `tabindex` > 0 (breaks natural order)
- Use `tabindex="-1"` to remove from tab order
- Test with keyboard only (hide your mouse!)

**Keyboard shortcuts** (v1 basic, v2 advanced):
```tsx
useEffect(() => {
  function handleKeyPress(e: KeyboardEvent) {
    // Ctrl/Cmd + K: Open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    
    // Escape: Close modal/popover
    if (e.key === 'Escape') {
      closeOverlay();
    }
  }
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

### ARIA Labels

```tsx
// Button with icon only
<button aria-label="Delete item">
  <IconTrash className="w-5 h-5" />
</button>

// Image with meaningful alt
<img 
  src={thumbnailUrl} 
  alt={`Thumbnail of ${item.title}`}
/>

// Loading state
<div role="status" aria-live="polite">
  <IconSpinner className="animate-spin" />
  <span className="sr-only">Loading items...</span>
</div>

// Modal
<div role="dialog" aria-labelledby="modal-title" aria-modal="true">
  <h2 id="modal-title">Edit Item</h2>
  {/* ... */}
</div>
```

### Screen Reader Support

```tsx
// Skip to main content
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
>
  Skip to main content
</a>

<main id="main-content">
  {/* Dashboard content */}
</main>

// Visually hidden but accessible
<span className="sr-only">
  {/* Screen reader only text */}
</span>
```

**sr-only utility**:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Special States

### File Access Hint (Critical for v1)

```tsx
function FileAccessHint({ onDismiss }: { onDismiss: () => void }) {
  const extensionId = chrome.runtime.id;
  const settingsUrl = `chrome://extensions/?id=${extensionId}`;
  
  return (
    <div className="
      bg-warning-light 
      border border-warning
      rounded-xl 
      p-4 
      mb-6
    ">
      <div className="flex items-start gap-3">
        <IconExclamationTriangle className="w-6 h-6 text-warning flex-shrink-0" />
        
        <div className="flex-1">
          <h3 className="font-semibold text-text-primary mb-1">
            File Access Not Enabled
          </h3>
          <p className="text-sm text-text-secondary mb-3">
            To save and open local files, enable "Allow access to file URLs" in Chrome settings.
          </p>
          
          <div className="flex gap-2">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(settingsUrl);
                // Show toast: "URL copied"
              }}
              className="text-sm font-medium text-primary hover:underline"
            >
              Copy settings URL
            </button>
            <span className="text-text-tertiary">•</span>
            <button 
              onClick={onDismiss}
              className="text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Offline State

```tsx
function OfflineBanner() {
  return (
    <div className="
      bg-surface 
      border-b border-border
      px-4 py-2
      text-center
    ">
      <p className="text-sm text-text-secondary">
        <IconWifiOff className="inline w-4 h-4 mr-2" />
        You're offline. Changes will sync when you reconnect.
      </p>
    </div>
  );
}
```

### Error State

```tsx
function ErrorState({ error, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="w-16 h-16 bg-danger-light rounded-full flex items-center justify-center mb-4">
        <IconExclamationTriangle className="w-8 h-8 text-danger" />
      </div>
      
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        Something went wrong
      </h3>
      
      <p className="text-sm text-text-secondary text-center max-w-sm mb-6">
        {error.message || 'An unexpected error occurred'}
      </p>
      
      <button 
        onClick={onRetry}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
      >
        Try Again
      </button>
    </div>
  );
}
```

---

## Theme Switching

### Implemented in Phase 10.1 (2026-11-07)

- Keep the existing CSS variables in `src/styles/themes.css`; do not introduce a second palette.
- Settings offers **System / Light / Dark**. System is stored as `auto` in the existing IndexedDB `settings` table under `theme` and is the default for missing or invalid records.
- `useTheme()` in `src/dashboard/hooks/use-theme.ts` runs once per dashboard or popup app, not only inside Settings. It applies the resolved `data-theme` to `<html>`, observes settings with Dexie, and follows OS changes with `matchMedia`. Focus refresh handles pages resumed after an OS change.
- Preference updates apply immediately, persist locally, and roll back on save failure. Errors appear in Settings. Appearance is not included in Drive sync or library exports.
- The Settings selector uses native radios, visible keyboard focus, existing semantic colors, surface/background contrast, `rounded-md`, and the same small type and spacing as adjacent settings. System is the user-facing label for Auto.

The dashboard owns the hook for the page lifetime and passes its `theme`, `ready`, `saving`, `error`, and `setTheme` values to Settings. The popup initializes the same hook without rendering a separate selector.

### Shared Motion and Loading Patterns

- Use `AnimatedDialog` and `useDialogTransition` from `src/components/AnimatedDialog.tsx` for conditionally mounted dialogs. Route dismissal through the transition hook; the parent unmount callback runs after exit. Keep operation-specific busy/cancel guards.
- Keep Headless UI `DialogBackdrop` and `DialogPanel` with `transition` and the shared `dialog-backdrop` / `dialog-panel` CSS classes. The 200ms fade and small panel movement use the guide's timing. Preserve existing widths, padding, backdrop, and focus traps.
- Preserve existing drag-stack ghosts, placement highlights, and reorder/drop animations. During a drag, animate existing source/destination cards as the placeholder enters, moves, or leaves, including across groups. Include the placeholder position in the motion revision even when the dragged item is not yet a destination member. Adding/removing favorites or committing a transfer must not replay neighboring cards' old positions. Keep the drag placeholder until the saved destination is rendered, and replace active motion when retargeting. Card hover changes the established shadow without adding transforms that conflict with drag geometry.
- Cancelling a drag with Escape restores the original layout and clears the ghost, placeholder, group-header tint, and sidebar placement highlight without waiting for mouse release. Native drag termination must perform the same cleanup; a drop already saving keeps its placeholder until persistence is observed.
- Cancellation removes the ghost and resets the layout in the same update, with no return/reorder animation. Normal reordering and successful drops retain their existing motion.
- Use `ThumbnailImage` to hold image space while storage/decode is pending, fade in decoded previews, and fall back if an image fails. Existing object-URL cleanup remains with the owning card.
- Use `ProgressBar` for real counts. Unknown counts remain indeterminate; never invent an overall sync percentage. Existing sync stage text remains visible.
- Reuse initial skeletons in the current collection layout and size. Announce a single loading status and hide decorative placeholders from assistive technology.
- Respect `prefers-reduced-motion`: stop repeating loading animations, remove dialog movement, and shorten transitions. Existing drag animations already check this preference.

### Keyboard Behavior

- Cmd/Ctrl+K focuses and selects launcher search; Escape clears it.
- Favorite open controls accept arrows across visible expanded groups. Up/down follow the nearest visual row and column in responsive grids; Home/End go to the first/last visible favorite.
- Keep ordinary Tab navigation for selection and action controls. Do not capture arrows in text/select fields, menus, dialogs, composition input, or while dragging.
- Escape dismisses the active dialog/menu/preview through its existing handler. Modal focus remains trapped and returns to the trigger after closing.
- Keep the visible-on-focus Skip to favorites link and semantic/native controls.

See [Phase 10.1 manual checks](./manual_test/phase-10.1-manual-test.md). Browser automation complements actual OS, native toolbar, drag, and screen-reader acceptance; it does not mark those checks complete.

---

## Performance

### Image Loading

The dashboard uses `ThumbnailImage` for stable sizing, decode feedback, and
fallbacks. `thumbnail-visibility.ts` shares one IntersectionObserver across
cards and collections. The buffer is 50% of the window scroll viewport height
above and below, computed in CSS pixels and rebuilt on height changes. The window
viewport excludes browser chrome; the dashboard header scrolls with the document.
Transient overlays do not change the buffer. Use pixel root margins calculated
from height, not percentage root margins. Report exits from this buffered region
so images release beyond it. Keep full-size previews closed until the hover
preview opens, and close them when the card leaves the buffered region.

`thumbnail-resources.ts` keys object URLs by preview hash and size, deduplicates
parallel reads, and reference-counts active consumers, including drag copies.
Revoke small URLs immediately after their final consumer releases; do not add
an unused card-thumbnail memory cache beyond the 50% viewport buffer. Retain the
ten most recently opened distinct full-size hover images by hash. Reopening
refreshes recency; closing does not. Evict older URLs once no active consumer
needs them. Still-open previews retain ownership until they close. Cancelled or
failed pending loads do not enter this cache; saved originals remain in IndexedDB.
Limit reads/conversions to four jobs and skip queued loads whose consumers leave
view. Imported/synced images without a small preview get a persisted 320 × 200
derivative; preserve the original bytes and hash. Close decoded bitmaps and release
canvas buffers after conversion. Reuse on-disk card derivatives instead of unused
small URLs. The hover cache retains resource URLs for reuse, not hidden image nodes.

### Large Collections

`FavoriteCollection` uses `@tanstack/react-virtual` to mount visible rows plus
50% of the viewport height on each side, rounded outward to whole overscan rows,
while preserving the full document scroll height. Share the buffer fraction with
image observation; recalculate rows on viewport/card-size changes. The row count
follows responsive grid columns and the existing card dimensions for each size.
Keep selection in dashboard state by favorite ID; do not tie it to mounted cards.
Offscreen collections return an empty ordinary virtual range: window virtualizers
otherwise clamp to edge rows and accumulate mounted cards across groups. Preserve
the collection height and explicitly pinned keyboard/drag source while hidden.
Disable offscreen virtualizers so they remove scroll subscriptions; preserve the
last measured collection height (or the current row estimate after size changes).
Only active collections observe document-wide height changes. Group action menu
panels mount on opening, retaining existing pointer/keyboard behavior and styling.

Render visible favorite slots directly under the collection with stable item keys;
moving between rows must retain the same card element. Keep the native drag source
mounted outside the layout slots and pin the keyboard-focused row in the virtual range.
Register logical item geometry so arrows, Home, and End can move focus beyond
mounted DOM nodes. Keep drop hit testing based on mounted visible slots, and
measure positions relative to the full virtualized collection. Search waits 300ms
after the last keystroke and resets scrolling to the start of the result set.

Phase 10.2 closed on 2026-11-08 after all user manual checks passed. The isolated
profiles, normal-profile measurements, final cache policy, and accepted remaining
large-group memory cost are recorded in
[`phase-10.2-manual-test.md`](./manual_test/phase-10.2-manual-test.md).

---

## Summary

This design guide provides:

- ✅ Complete color system with theme support
- ✅ Typography scale and usage
- ✅ Spacing/layout system
- ✅ Component library (buttons, cards, modals, etc.)
- ✅ Animation patterns
- ✅ Accessibility guidelines
- ✅ Special states (file access, errors, empty)
- ✅ Theme switching implementation

All patterns are **AI-friendly**: copy-paste ready with Tailwind classes and clear specifications.

