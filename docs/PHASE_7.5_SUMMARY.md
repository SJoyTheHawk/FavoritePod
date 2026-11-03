# Phase 7.5: Grouped Favorites View - Quick Reference

## Overview

Add three view modes for organizing favorites in the dashboard when viewing "All favorites" or groups with sub-groups.

**Document**: See full details in [PHASE_7.5_GROUPED_VIEW.md](PHASE_7.5_GROUPED_VIEW.md)

---

## Three View Modes

### 1. Hierarchical Grouped View (Default)
- Favorites grouped under collapsible headers
- Nested structure with indentation
- Count badges show items per group
- Collapsed state persists in localStorage

### 2. Flat View with Labels
- Group label badge on each favorite card
- Sorted by group, then orderKey
- No collapsing (always expanded)

### 3. Flat View (Current)
- All favorites in single list
- No grouping indicators
- Existing behavior preserved

---

## Implementation Summary

### Files to Create

1. **`src/dashboard/components/GroupHeader.tsx`**
   - Collapsible header with icon, title, count, chevron
   - Drop zone for drag-and-drop
   - ~100 lines

2. **`src/dashboard/components/GroupedFavoriteSection.tsx`**
   - Renders header + favorites grid/list
   - Handles nested groups recursively
   - ~150 lines

### Files to Modify

1. **`src/core/storage.ts`**
   - Add `getGroupingMode()` / `setGroupingMode()`
   - Add `getCollapsedGroups()` / `setCollapsedGroups()`
   - ~50 lines added

2. **`src/dashboard/DashboardApp.tsx`**
   - Add grouping mode state
   - Add collapsed groups state
   - Implement grouping algorithm (useMemo)
   - Conditional rendering based on mode
   - ~200 lines modified/added

3. **`src/dashboard/components/FavoriteCard.tsx`**
   - Add optional `groupLabel` prop
   - Render badge overlay (labeled mode)
   - ~20 lines added

4. **`src/dashboard/components/SettingsDialog.tsx`**
   - Add grouping mode radio buttons
   - ~100 lines added

---

## Design Tokens Used

All styling uses existing tokens from DESIGN_GUIDE.md:

**Colors**:
- `bg-surface` / `bg-surface-hover`
- `border-border`
- `text-text-primary` / `text-text-secondary` / `text-text-tertiary`
- `bg-primary-light` (drop zone highlight)

**Spacing**:
- `px-3 py-2` (header padding)
- `space-y-3` (header to content)
- `space-y-8` (between sections)
- `gap-3` (flex gaps)

**Typography**:
- `text-sm font-medium` (header title)
- `text-xs` (count badge, group labels)

**Borders & Radius**:
- `rounded-lg` (8px, headers and sections)
- `rounded` (6px, small badges)

**Transitions**:
- `transition-all duration-200` (smooth state changes)
- `hover:bg-surface-hover` (interactive feedback)

**Icons** (Heroicons):
- `FolderIcon` (w-5 h-5)
- `ChevronDownIcon` / `ChevronRightIcon` (w-4 h-4)

---

## Key Algorithms

### Grouping Logic

**For "All favorites"**:
1. Get top-level groups (parentId === null)
2. For each top-level group, collect all descendant items
3. Return sections array with { group, items }

**For "Parent group with children"**:
1. Get immediate child groups (parentId === selectedGroupId)
2. For each child, collect its descendant items
3. Also collect direct items in parent
4. Return sections + directItems

**Individual group**:
- Ignore grouping mode
- Show flat list (current behavior)

### Collapse State Management

```typescript
// localStorage (session-only, fast)
const COLLAPSED_GROUPS_KEY = 'favoritepod:collapsedGroups';

// Load on mount
const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
  () => getCollapsedGroups()
);

// Toggle
const toggleCollapse = (groupId: string) => {
  const next = new Set(collapsedGroups);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  setCollapsedGroups(next);
  setCollapsedGroupsInStorage(next); // persist
};
```

---

## Component API

### GroupHeader

```typescript
interface GroupHeaderProps {
  group: Group;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  isDragOver: boolean;
  onDrop?: (groupId: string) => void;
}
```

**Renders**: Button with folder icon, title, count badge, chevron

### GroupedFavoriteSection

```typescript
interface GroupedFavoriteSectionProps {
  group: Group;
  items: Item[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  layout: LibraryView;
  bookmarkSize: BookmarkSize;
  // ... all FavoriteCard props pass-through
}
```

**Renders**: GroupHeader + (if expanded) nested groups + favorite cards

### FavoriteCard Enhancement

```typescript
interface FavoriteCardProps {
  // ... existing props
  groupLabel?: string; // NEW: optional group path
}
```

**Change**: Conditionally render badge overlay when `groupLabel` provided

---

## Storage Schema

### IndexedDB (synced settings)

```typescript
{
  key: 'groupingMode',
  value: 'hierarchical' | 'labeled' | 'flat'
}
```

### localStorage (session UI state)

```typescript
{
  'favoritepod:collapsedGroups': '["group-id-1", "group-id-2"]'
}
```

---

## Acceptance Criteria Summary

### Hierarchical Mode
- [x] Groups show collapsible headers
- [x] Count badges accurate
- [x] Collapsed state persists across reopens
- [x] Nested groups indent/visualize hierarchy
- [x] Drag-and-drop onto header moves items
- [x] Expand/collapse smooth (200ms transition)

### Labeled Mode
- [x] Group label badge on each card
- [x] Long paths truncate with ellipsis
- [x] Badge doesn't block interactions
- [x] Sort by group then orderKey

### Flat Mode
- [x] Existing behavior unchanged
- [x] No group indicators shown

### Cross-Mode
- [x] Mode persists across sessions
- [x] Search works in all modes
- [x] Bulk selection works across groups
- [x] Drag-and-drop works in all modes
- [x] Individual group views ignore mode setting
- [x] Empty groups show "(0 favorites)"

---

## Timeline

**Total**: 4.5 days (36 hours)

1. Storage & state setup - 0.5 day
2. GroupHeader component - 0.5 day
3. GroupedFavoriteSection component - 1 day
4. Flat view with labels - 0.5 day
5. Dashboard grouping logic - 1 day
6. Settings dialog integration - 0.5 day
7. Testing & polish - 0.5 day

---

## Testing Checklist

### Functional
- [ ] Switch between modes in settings
- [ ] Collapsed state persists
- [ ] Drag-and-drop works in all modes
- [ ] Search filters work
- [ ] Bulk actions work across groups
- [ ] Empty groups handled
- [ ] Nested groups render correctly

### Visual
- [ ] Light mode looks correct
- [ ] Dark mode looks correct
- [ ] Responsive on mobile
- [ ] Icons render correctly
- [ ] Animations smooth (60fps)

### Accessibility
- [ ] Keyboard navigation (Tab, Enter, Space, Escape)
- [ ] Screen reader announces states correctly
- [ ] Focus visible on all interactive elements
- [ ] ARIA attributes present

### Performance
- [ ] 100+ favorites render smoothly
- [ ] Collapse/expand responsive
- [ ] No memory leaks

---

## Migration Notes

**No breaking changes**:
- New `groupingMode` setting defaults to 'hierarchical'
- Existing users see grouped view by default
- Can switch to 'flat' in settings to restore old behavior
- Collapsed groups state is session-only (doesn't sync)

**Data changes**:
- Adds one IndexedDB settings record (`groupingMode`)
- Adds one localStorage key (`favoritepod:collapsedGroups`)
- No migration script needed

---

## Related Files

- **Full spec**: [PHASE_7.5_GROUPED_VIEW.md](PHASE_7.5_GROUPED_VIEW.md)
- **Design tokens**: [DESIGN_GUIDE.md](DESIGN_GUIDE.md)
- **Storage patterns**: [CODE_GUIDE.md](CODE_GUIDE.md) - Storage Layer section
- **Component patterns**: [DESIGN_GUIDE.md](DESIGN_GUIDE.md) - Components section

---

## Quick Commands

```bash
# Start development
npm run dev

# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint

# Build production
npm run build
```

---

## Questions & Decisions

### Why three modes instead of just two?
- Users have different preferences
- Some want hierarchical control (collapse)
- Some want context without collapsing (labels)
- Some want minimal UI (flat)
- Low cost to support all three

### Why localStorage for collapsed state instead of IndexedDB?
- Collapsed state is UI preference, not data
- Should reset on browser restart (fresh start each session)
- Faster access (synchronous)
- No sync overhead (doesn't need Drive sync)

### Why default to hierarchical instead of keeping flat?
- Better UX for users with many groups
- Easier to see organization structure
- Can collapse to reduce scroll
- Users who prefer flat can opt-out in settings

### What happens when searching?
- Search filters items across all groups
- Grouping mode still applies to results
- Empty groups hidden automatically
- User can still collapse/expand (hierarchical mode)

---

## Future Enhancements (Post-v1)

- Sync collapsed state via Google Drive
- "Expand all" / "Collapse all" quick actions
- Group color coding
- Sticky headers during scroll
- Animation when dragging between groups
- Keyboard shortcuts (Cmd+G to toggle grouping)
- Group statistics (size, last modified, etc.)
