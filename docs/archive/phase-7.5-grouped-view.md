# Phase 7.5: Grouped Favorites View

> Historical reference. For current work, use the [implementation plan](../planning/implementation-plan.md) or [publishing checklist](../publishing/README.md).

## Overview

Add three view modes for organizing favorites in the dashboard when viewing "All favorites" or groups with sub-groups:

1. **Flat View** (current default) - All favorites in a single flat list
2. **Hierarchical Grouped View** (new default) - Favorites grouped under collapsible group headers with nested structure
3. **Flat View with Group Labels** - Flat list with group label badges on each favorite

**Status**: Planning phase  
**Priority**: Medium (UX enhancement)  
**Estimated effort**: 3-4 days

---

## Goals

- Improve organization when viewing many favorites across multiple groups
- Provide clear visual hierarchy showing which group each favorite belongs to
- Allow users to collapse/expand group sections to reduce scroll length
- Maintain backward compatibility with existing features (drag-and-drop, search, selection, bulk actions)
- Give users choice between viewing modes based on their preference

---

## User Stories

### Story 1: Hierarchical Grouped View (Default)
**As a** user with favorites organized in multiple groups  
**I want** to see my favorites grouped under collapsible headers  
**So that** I can quickly collapse irrelevant groups and focus on what matters

**Acceptance Criteria**:
- When viewing "All favorites", favorites are grouped by their top-level parent group
- When viewing a parent group with children, favorites are grouped by immediate child groups
- Each group section shows:
  - Group icon + title
  - Favorite count badge
  - Collapse/expand chevron button
- Collapsed state persists across sessions (localStorage)
- Nested groups appear as sub-sections under their parent
- Drag-and-drop works (drop on group header = move to that group)
- Search and bulk selection work across all groups
- Empty groups are shown with "(0 favorites)" indicator

### Story 2: View Mode Toggle
**As a** user who prefers different organization styles  
**I want** to switch between flat, grouped, and labeled views  
**So that** I can choose the layout that works best for me

**Acceptance Criteria**:
- Settings dialog includes "Favorites grouping" option with three radio buttons
- Selected mode persists across sessions
- Mode change takes effect immediately
- Individual group views (single group selected) ignore this setting (always show flat list)

### Story 3: Flat View with Labels
**As a** user who wants group context without collapsing  
**I want** to see group labels on each favorite card  
**So that** I can see which group each favorite belongs to at a glance

**Acceptance Criteria**:
- Small badge above/on each favorite card shows group path (e.g., "Work › Documentation")
- Favorites are sorted by group, then by orderKey
- No collapsing (simpler, always expanded)
- Maintains current drag-and-drop behavior

---

## Design Specifications

### Hierarchical Grouped View

```
┌────────────────────────────────────────────────────────────┐
│ All favorites                                              │
│ 12 favorites                                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📂 Work                                      (8) ▼   │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ [Favorite Card] [Favorite Card] [Favorite Card]           │
│ [Favorite Card] [Favorite Card] ...                       │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │   📂 Internal Tools                          (3) ▼   │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│   [Favorite Card] [Favorite Card] [Favorite Card]         │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📂 Personal                                  (4) ▶   │ │  [collapsed]
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Group Header Anatomy

```
┌────────────────────────────────────────────────────────────┐
│  [Icon] Group Title                     (count) [chevron]  │
│  ↓ drop zone when dragging favorites                       │
└────────────────────────────────────────────────────────────┘
```

**Spacing** (using design tokens):
- Header height: 48px (comfortable click target)
- Padding: `px-3 py-2` (12px horizontal, 8px vertical)
- Gap between header and favorites: `mt-3` (12px)
- Gap between sections: `space-y-8` (32px)
- Border radius: `rounded-lg` (--radius-md: 8px)

**Colors** (using existing design tokens from design-guide.md):
- Background: `bg-surface` (--color-surface)
- Hover: `bg-surface-hover` (--color-surface-hover)
- Border: `border-border` (--color-border)
- Text: `text-text-primary` (--color-text-primary)
- Count badge: `text-text-tertiary` (--color-text-tertiary) on `bg-surface-hover`
- Active drop zone: `border-primary` with `bg-primary-light/20` (--color-primary-light)

**Typography** (from design tokens):
- Group title: `text-sm font-medium` (14px, 500 weight)
- Count badge: `text-xs` (12px)

**Icons** (Heroicons):
- Folder: `FolderIcon` from `@heroicons/react/24/outline` - `w-5 h-5` (20px)
- Chevron: `ChevronDownIcon` / `ChevronRightIcon` - `w-4 h-4` (16px)

**Transitions** (from design tokens):
- Duration: `transition-all duration-200` (--transition-base)
- Easing: Default ease-out from Tailwind
- Collapse animation: `transition-all duration-200` for smooth height change

### Flat View with Labels

```
┌────────────────────────────────────────────────────────────┐
│ All favorites                                              │
│ 12 favorites                                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌──────────────────────────┐  ┌──────────────────────┐   │
│ │ Work › Documentation     │  │ Work › Internal      │   │
│ │ [preview thumbnail]      │  │ [preview thumbnail]  │   │
│ │ Page Title               │  │ Page Title           │   │
│ │ https://example.com      │  │ https://example.com  │   │
│ └──────────────────────────┘  └──────────────────────┘   │
│                                                            │
│ ┌──────────────────────────┐                              │
│ │ Personal › Shopping      │                              │
│ │ [preview thumbnail]      │                              │
│ │ Page Title               │                              │
│ │ https://example.com      │                              │
│ └──────────────────────────┘                              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Group Label Badge** (matching design tokens):
- Position: Top-left corner overlay on card, or label above card
- Padding: `px-2 py-1` (8px horizontal, 4px vertical)
- Border-radius: `rounded` (--radius-sm: 6px)
- Background: `bg-surface-hover/90` with `backdrop-blur-sm` (90% opacity)
- Text: `text-xs` (12px), `text-text-secondary` (--color-text-secondary)
- Max-width: `truncate` with ellipsis if too long
- Font: `font-medium` for clarity

### Settings Dialog Addition

```
┌────────────────────────────────────────────────────────────┐
│ Settings                                          [×]      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ View Preferences                                           │
│                                                            │
│ Default view                                               │
│ ○ Grid  ● List                                            │
│                                                            │
│ Favorites grouping                                         │
│ ● Hierarchical (with collapsible groups)                  │
│ ○ Flat with labels (shows group on each card)             │
│ ○ Flat (no grouping)                                      │
│                                                            │
│ Note: Applies only when viewing "All favorites" or        │
│ parent groups with sub-groups.                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     DashboardApp                            │
│                                                             │
│  State:                                                     │
│  - groupingMode: 'hierarchical' | 'labeled' | 'flat'       │
│  - collapsedGroups: Set<string>                            │
│                                                             │
│  Logic:                                                     │
│  - Load groupingMode from localStorage                     │
│  - Load collapsedGroups from localStorage                  │
│  - Compute groupedItems based on mode                      │
│                                                             │
│  ├─> Mode: 'flat'                                          │
│  │   └─> Render FavoriteCard[] (existing logic)           │
│  │                                                          │
│  ├─> Mode: 'hierarchical'                                  │
│  │   └─> Render GroupedFavoriteSection[] (new component)  │
│  │       ├─> GroupHeader (collapsible)                    │
│  │       └─> FavoriteCard[] (if expanded)                 │
│  │                                                          │
│  └─> Mode: 'labeled'                                       │
│      └─> Render FavoriteCardWithLabel[] (enhanced card)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State Management

**New storage keys**:
```typescript
// src/core/storage.ts additions

export type GroupingMode = 'hierarchical' | 'labeled' | 'flat';

export async function getGroupingMode(): Promise<GroupingMode> {
  const record = await db.settings.get('groupingMode');
  return (record?.value as GroupingMode) ?? 'hierarchical';
}

export async function setGroupingMode(mode: GroupingMode): Promise<void> {
  await db.settings.put({ key: 'groupingMode', value: mode });
}

// Collapsed groups stored in localStorage (not synced)
const COLLAPSED_GROUPS_KEY = 'favoritepod:collapsedGroups';

export function getCollapsedGroups(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function setCollapsedGroups(groupIds: Set<string>): void {
  localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...groupIds]));
}
```

### Component Structure

**New components**:

1. **`GroupedFavoriteSection.tsx`** - Renders one collapsible group section
2. **`GroupHeader.tsx`** - Collapsible header with icon, title, count, chevron
3. **`FavoriteCardWithLabel.tsx`** - Wrapper that adds group label badge

**Modified components**:

1. **`DashboardApp.tsx`** - Add grouping logic and mode switching
2. **`SettingsDialog.tsx`** - Add grouping mode radio buttons
3. **`FavoriteCard.tsx`** - Optionally add `groupLabel` prop for labeled mode

---

## Implementation Tasks

### Task 7.5.1: Storage and State Setup

**Goal**: Add persistence for grouping mode and collapsed groups

**Files to create/modify**:
- `src/core/storage.ts` - Add `getGroupingMode`, `setGroupingMode`, collapsed group helpers
- `src/core/types.ts` - Add `GroupingMode` type if needed

**Steps**:
1. Add `GroupingMode` type definition
2. Implement storage functions with IndexedDB for grouping mode
3. Implement localStorage helpers for collapsed groups (session-local, not synced)
4. Write unit tests for storage functions

**Acceptance**:
- `getGroupingMode()` returns default 'hierarchical'
- `setGroupingMode()` persists across page reloads
- Collapsed groups persist across dashboard reopens (but reset on browser close, using localStorage)

**Estimated time**: 0.5 day

---

### Task 7.5.2: Group Header Component

**Goal**: Create collapsible group header with proper styling and interactions

**Files to create**:
- `src/dashboard/components/GroupHeader.tsx`

**Interface**:
```typescript
interface GroupHeaderProps {
  group: Group;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  isDragOver: boolean;  // For drop zone highlight
  onDrop?: (groupId: string) => void;
}

function GroupHeader({ group, count, collapsed, onToggle, isDragOver }: GroupHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className={`
        w-full px-3 py-2
        bg-surface
        border border-border
        rounded-lg
        transition-all duration-200
        hover:bg-surface-hover
        focus:outline-none
        focus:ring-2
        focus:ring-primary
        focus:ring-offset-2
        flex items-center justify-between gap-3
        ${isDragOver ? 'border-primary bg-primary-light/20' : ''}
      `}
      aria-expanded={!collapsed}
      aria-controls={`group-section-${group.id}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FolderIcon className="w-5 h-5 text-text-secondary shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium text-text-primary truncate">
          {group.title}
        </span>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-text-tertiary px-2 py-0.5 bg-surface-hover rounded">
          {count}
        </span>
        {collapsed ? (
          <ChevronRightIcon className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
        )}
      </div>
    </button>
  );
}
```

**Features**:
- Folder icon + group title (using Heroicons)
- Count badge showing number of favorites
- Chevron button (down = expanded, right = collapsed)
- Hover state using `hover:bg-surface-hover`
- Drop zone highlight when dragging favorites over it
- Keyboard accessible (Enter/Space to toggle) - native button behavior
- ARIA attributes for screen readers (`aria-expanded`, `aria-controls`)
- Smooth transitions using `transition-all duration-200`

**Styling** (matches design-guide.md patterns):
- Use existing design tokens via Tailwind classes
- Height: Auto (padding controls it) - `py-2` gives ~40px
- Rounded corners: `rounded-lg` (8px from --radius-md)
- Border: `border border-border`
- Focus ring: `focus:ring-2 focus:ring-primary focus:ring-offset-2`

**Acceptance**:
- Clicking toggles collapse state
- Keyboard navigation works (Tab, Enter, Space)
- Drop zone highlights when dragging favorites
- Count badge shows correct number
- Renders correctly in light/dark mode

**Estimated time**: 0.5 day

---

### Task 7.5.3: Grouped Favorite Section Component

**Goal**: Render a collapsible section containing group header and favorites

**Files to create**:
- `src/dashboard/components/GroupedFavoriteSection.tsx`

**Interface**:
```typescript
interface GroupedFavoriteSectionProps {
  group: Group;
  items: Item[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  layout: LibraryView;
  bookmarkSize: BookmarkSize;
  // ... pass through all FavoriteCard props
  // (selection, drag-and-drop, edit, delete, etc.)
}
```

**Features**:
- Renders `GroupHeader`
- Conditionally renders grid/list of `FavoriteCard` components (when expanded)
- Smooth expand/collapse animation
- Maintains existing drag-and-drop behavior for favorites
- Drop zone on header to move favorites into this group
- Handles nested groups (recursively render child `GroupedFavoriteSection`)

**Layout Logic**:
```typescript
// Component structure following design-guide.md patterns
function GroupedFavoriteSection({
  group,
  items,
  collapsed,
  onToggleCollapse,
  layout,
  bookmarkSize,
  // ... other props
}: GroupedFavoriteSectionProps) {
  const directItems = items.filter(item => item.groupId === group.id);
  const childGroups = groups.filter(g => g.parentId === group.id);
  
  return (
    <section className="space-y-3">
      <GroupHeader 
        group={group}
        count={items.length}
        collapsed={collapsed}
        onToggle={onToggleCollapse}
        isDragOver={/* drag state */}
      />
      
      {!collapsed && (
        <div 
          id={`group-section-${group.id}`}
          className="space-y-8 animate-fade-in"
        >
          {/* Nested child groups first */}
          {childGroups.length > 0 && (
            <div className="pl-4 border-l-2 border-border space-y-8">
              {childGroups.map(child => {
                const childItems = items.filter(item => 
                  item.groupId === child.id || isDescendantOf(item.groupId, child.id)
                );
                return (
                  <GroupedFavoriteSection
                    key={child.id}
                    group={child}
                    items={childItems}
                    collapsed={collapsedGroups.has(child.id)}
                    onToggleCollapse={() => toggleCollapse(child.id)}
                    layout={layout}
                    bookmarkSize={bookmarkSize}
                    {...otherProps}
                  />
                );
              })}
            </div>
          )}
          
          {/* Direct favorites in this group */}
          {directItems.length > 0 && (
            <div 
              className="bookmark-collection"
              data-layout={layout}
              data-size={bookmarkSize}
            >
              {directItems.map(item => (
                <FavoriteCard key={item.id} item={item} {...cardProps} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

**Acceptance**:
- Collapsed sections hide favorites (smooth animation)
- Expanded sections show favorites in correct layout (grid/list)
- Nested groups render correctly (indentation or visual hierarchy)
- Drag-and-drop onto header moves favorites to that group
- All existing favorite interactions work (edit, delete, select, etc.)

**Estimated time**: 1 day

---

### Task 7.5.4: Flat View with Labels

**Goal**: Add group label badge to favorite cards in labeled mode

**Files to modify**:
- `src/dashboard/components/FavoriteCard.tsx` - Add optional `groupLabel` prop
- Or create `src/dashboard/components/FavoriteCardWithLabel.tsx` - Wrapper component

**Approach A: Modify FavoriteCard** (Recommended - follows design-guide.md overlay pattern)
```typescript
interface FavoriteCardProps {
  // ... existing props
  groupLabel?: string;  // Group path like "Work › Documentation"
}

// In FavoriteCard render (add overlay similar to hover actions):
{groupLabel && (
  <div className="absolute top-2 left-2 z-10">
    <span className="
      inline-block px-2 py-1 
      bg-surface-hover/90 backdrop-blur-sm
      rounded text-xs font-medium text-text-secondary
      max-w-[200px] truncate
    ">
      {groupLabel}
    </span>
  </div>
)}
```

**Approach B: Above Card Label**
```typescript
export function FavoriteCardWithLabel({ 
  item, 
  groupLabel, 
  ...cardProps 
}: FavoriteCardProps & { groupLabel: string }) {
  return (
    <div className="space-y-1">
      <div className="px-2 py-1 text-xs font-medium text-text-secondary truncate">
        {groupLabel}
      </div>
      <FavoriteCard item={item} {...cardProps} />
    </div>
  );
}
```

**Features**:
- Group label shown as badge (overlay or above card)
- Truncates long paths with ellipsis
- Uses full path with › separator (e.g., "Work › Internal › Documentation")
- Only shown in 'labeled' mode

**Acceptance**:
- Label is visible and readable
- Doesn't interfere with card interactions
- Truncates gracefully when too long
- Matches design specifications

**Estimated time**: 0.5 day

---

### Task 7.5.5: Dashboard Grouping Logic

**Goal**: Implement the grouping algorithm and mode switching in DashboardApp

**Files to modify**:
- `src/dashboard/DashboardApp.tsx`

**State additions**:
```typescript
const [groupingMode, setGroupingMode] = useState<GroupingMode>('hierarchical');
const [collapsedGroups, setCollapsedGroupsState] = useState<Set<string>>(
  () => getCollapsedGroups()
);
```

**Load settings on mount**:
```typescript
useEffect(() => {
  void getGroupingMode()
    .then((mode) => setGroupingMode(mode))
    .catch((error) => notifyError(errorMessage(error)));
}, [notifyError]);
```

**Grouping algorithm**:
```typescript
const groupedFavorites = useMemo(() => {
  if (!selectedGroupId) {
    // "All favorites" view
    if (groupingMode === 'flat') {
      return { mode: 'flat', items: visibleItems };
    }
    
    // Group by top-level groups
    const topLevelGroups = groups.filter(g => !g.parentId);
    const sections = topLevelGroups.map(group => ({
      group,
      items: visibleItems.filter(item => {
        // Include items from this group and all descendants
        const scope = new Set([group.id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const g of groups) {
            if (g.parentId && scope.has(g.parentId) && !scope.has(g.id)) {
              scope.add(g.id);
              changed = true;
            }
          }
        }
        return scope.has(item.groupId);
      }),
    }));
    
    return { 
      mode: groupingMode, 
      sections: sections.filter(s => s.items.length > 0) 
    };
  }
  
  // Viewing specific group with children
  const hasChildren = groups.some(g => g.parentId === selectedGroupId);
  if (!hasChildren || groupingMode === 'flat') {
    return { mode: 'flat', items: visibleItems };
  }
  
  // Group by immediate child groups
  const childGroups = groups.filter(g => g.parentId === selectedGroupId);
  const sections = childGroups.map(group => ({
    group,
    items: visibleItems.filter(item => {
      // Include items from this child and its descendants
      const scope = new Set([group.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const g of groups) {
          if (g.parentId && scope.has(g.parentId) && !scope.has(g.id)) {
            scope.add(g.id);
            changed = true;
          }
        }
      }
      return scope.has(item.groupId);
    }),
  }));
  
  // Also include items directly in the parent group
  const directItems = visibleItems.filter(item => item.groupId === selectedGroupId);
  
  return {
    mode: groupingMode,
    sections: sections.filter(s => s.items.length > 0),
    directItems: directItems.length > 0 ? directItems : undefined,
  };
}, [groups, visibleItems, selectedGroupId, groupingMode]);
```

**Rendering logic**:
```typescript
{groupedFavorites.mode === 'flat' ? (
  // Existing flat render logic
  <div className="bookmark-collection" ...>
    {visibleItems.map(item => (
      <FavoriteCard key={item.id} item={item} ... />
    ))}
  </div>
) : groupedFavorites.mode === 'hierarchical' ? (
  // Hierarchical grouped view
  <div className="space-y-8">
    {groupedFavorites.sections?.map(({ group, items }) => (
      <GroupedFavoriteSection
        key={group.id}
        group={group}
        items={items}
        collapsed={collapsedGroups.has(group.id)}
        onToggleCollapse={() => {
          const next = new Set(collapsedGroups);
          if (next.has(group.id)) next.delete(group.id);
          else next.add(group.id);
          setCollapsedGroupsState(next);
          setCollapsedGroups(next);
        }}
        layout={layout}
        bookmarkSize={bookmarkSize}
        // ... pass through all other props
      />
    ))}
    
    {groupedFavorites.directItems && (
      <div className="bookmark-collection" ...>
        {groupedFavorites.directItems.map(item => (
          <FavoriteCard key={item.id} item={item} ... />
        ))}
      </div>
    )}
  </div>
) : (
  // Labeled view
  <div className="bookmark-collection" ...>
    {groupedFavorites.sections?.flatMap(({ group, items }) =>
      items.map(item => (
        <FavoriteCard
          key={item.id}
          item={item}
          groupLabel={getGroupLabels(groups).get(group.id)}
          ...
        />
      ))
    )}
  </div>
)}
```

**Acceptance**:
- Flat mode shows all favorites in one list (existing behavior)
- Hierarchical mode groups favorites under collapsible headers
- Labeled mode shows group badge on each card
- Mode persists across page reloads
- Collapsed state persists across dashboard reopens
- Individual group views always show flat list (ignore mode)
- Search works across all modes
- Drag-and-drop works in all modes

**Estimated time**: 1 day

---

### Task 7.5.6: Settings Dialog Integration

**Goal**: Add grouping mode selector to settings dialog

**Files to modify**:
- `src/dashboard/components/SettingsDialog.tsx`

**UI additions** (following design-guide.md form patterns):
```tsx
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-text-secondary mb-2">
      Favorites grouping
    </label>
    <p className="text-xs text-text-tertiary mb-3">
      Choose how to organize favorites when viewing all or parent groups.
    </p>
  </div>
  
  <div className="space-y-2">
    <label className="
      flex items-start gap-3 p-3 rounded-lg border border-border
      cursor-pointer transition-colors hover:bg-surface-hover
      has-[:checked]:border-primary has-[:checked]:bg-primary-light
    ">
      <input
        type="radio"
        name="groupingMode"
        checked={groupingMode === 'hierarchical'}
        onChange={() => onSaveGroupingMode('hierarchical')}
        className="mt-0.5 accent-primary"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">
          Hierarchical (default)
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          Collapsible group sections with nested structure
        </div>
      </div>
    </label>
    
    <label className="
      flex items-start gap-3 p-3 rounded-lg border border-border
      cursor-pointer transition-colors hover:bg-surface-hover
      has-[:checked]:border-primary has-[:checked]:bg-primary-light
    ">
      <input
        type="radio"
        name="groupingMode"
        checked={groupingMode === 'labeled'}
        onChange={() => onSaveGroupingMode('labeled')}
        className="mt-0.5 accent-primary"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">
          Flat with labels
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          Group badge on each favorite card
        </div>
      </div>
    </label>
    
    <label className="
      flex items-start gap-3 p-3 rounded-lg border border-border
      cursor-pointer transition-colors hover:bg-surface-hover
      has-[:checked]:border-primary has-[:checked]:bg-primary-light
    ">
      <input
        type="radio"
        name="groupingMode"
        checked={groupingMode === 'flat'}
        onChange={() => onSaveGroupingMode('flat')}
        className="mt-0.5 accent-primary"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">
          Flat
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          Simple list without grouping (classic view)
        </div>
      </div>
    </label>
  </div>
</div>
```

**Props additions**:
```typescript
interface SettingsDialogProps {
  // ... existing props
  groupingMode: GroupingMode;
  onSaveGroupingMode: (mode: GroupingMode) => Promise<void>;
}
```

**Acceptance**:
- Radio buttons reflect current mode
- Changing mode persists to storage
- Mode change takes effect immediately (no dialog close required)
- Description text explains each mode clearly

**Estimated time**: 0.5 day

---

### Task 7.5.7: Testing and Polish

**Goal**: Test all modes, edge cases, and interactions

**Test scenarios**:

**Functional**:
- [ ] Switch between all three modes in settings
- [ ] Collapsed state persists across dashboard reopens
- [ ] Grouping mode persists across browser restarts
- [ ] Drag-and-drop works in hierarchical mode (drop on header)
- [ ] Drag-and-drop works in labeled mode
- [ ] Drag-and-drop works in flat mode (unchanged)
- [ ] Search works across all modes
- [ ] Bulk selection works across all modes (can select across groups)
- [ ] Bulk actions work (move, delete)
- [ ] Empty groups show correctly with "(0 favorites)"
- [ ] Nested groups render with proper indentation/hierarchy

**Edge cases**:
- [ ] Group with no favorites shows empty state
- [ ] All groups collapsed - still shows group headers
- [ ] Search with grouped view - filtered results stay grouped
- [ ] Delete last favorite in group - group updates count
- [ ] Move favorite to different group - both groups update
- [ ] Undo/redo works across modes
- [ ] Very long group names truncate properly
- [ ] Deep nesting (3+ levels) renders correctly

**Performance**:
- [ ] 100+ favorites render smoothly in hierarchical mode
- [ ] Collapse/expand animations are smooth (60fps)
- [ ] No unnecessary re-renders when toggling collapse

**Accessibility**:
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Screen reader announces group headers correctly
- [ ] ARIA attributes present and correct
- [ ] Focus management works when expanding/collapsing

**Visual**:
- [ ] Light mode looks good
- [ ] Dark mode looks good
- [ ] Responsive on mobile (group headers stack properly)
- [ ] Icons render correctly
- [ ] Drop zones highlight properly

**Acceptance**:
- All test scenarios pass
- No console errors
- Smooth animations
- Accessible keyboard navigation
- Works on mobile viewport

**Estimated time**: 0.5 day

---

## Total Estimated Time

- Task 7.5.1: Storage and State Setup - 0.5 day
- Task 7.5.2: Group Header Component - 0.5 day
- Task 7.5.3: Grouped Favorite Section Component - 1 day
- Task 7.5.4: Flat View with Labels - 0.5 day
- Task 7.5.5: Dashboard Grouping Logic - 1 day
- Task 7.5.6: Settings Dialog Integration - 0.5 day
- Task 7.5.7: Testing and Polish - 0.5 day

**Total: 4.5 days**

---

## Manual Testing Checklist

### Before Implementation
- [ ] Review existing code for similar patterns
- [ ] Confirm design tokens match specification
- [ ] Verify no conflicting localStorage keys

### After Each Task
- [ ] Load dashboard and verify no console errors
- [ ] Check light mode styling
- [ ] Check dark mode styling
- [ ] Test keyboard navigation
- [ ] Test with existing favorites

### Final Acceptance
- [ ] Switch between all three modes successfully
- [ ] Collapsed groups persist after dashboard reopen
- [ ] Drag favorite onto group header moves it to that group
- [ ] Search filters work in all modes
- [ ] Bulk selection and actions work in all modes
- [ ] Empty groups display correctly
- [ ] Long group names truncate properly
- [ ] Mobile responsive (320px width minimum)
- [ ] No performance issues with 100+ favorites
- [ ] Undo/redo works correctly
- [ ] Export/import preserves grouping (collapsed state is session-only)

---

## Migration Notes

**Backward Compatibility**:
- New `groupingMode` setting defaults to 'hierarchical'
- Existing users will see grouped view by default
- Can switch back to 'flat' in settings to restore old behavior
- No data migration needed (only adds new setting key)
- Collapsed groups are session-only (localStorage, not IndexedDB)

**Future Considerations**:
- Could sync collapsed groups state via Google Drive (Phase 9+)
- Could add "expand all" / "collapse all" quick action buttons
- Could add group color coding
- Could make group headers sticky during scroll
- Could add animation when moving favorites between groups

---

## Code Guide Reference

### Component Patterns

All components follow the established patterns from design-guide.md:

**1. Use design tokens via Tailwind classes**
```tsx
// ✅ Good - uses design tokens
<div className="bg-surface border-border rounded-lg">

// ❌ Bad - hardcoded values
<div style={{ background: '#f8f9fa', borderRadius: '8px' }}>
```

**2. Follow animation guidelines**
```tsx
// ✅ Good - smooth transitions
<div className="transition-all duration-200 hover:bg-surface-hover">

// ❌ Bad - instant changes
<div className="hover:bg-surface-hover">
```

**3. Use semantic HTML and ARIA**
```tsx
// ✅ Good - accessible
<button aria-expanded={!collapsed} aria-controls="section-id">

// ❌ Bad - div button
<div onClick={toggle}>
```

**4. Follow icon sizing conventions**
```tsx
// Small actions: w-4 h-4 (16px)
<ChevronDownIcon className="w-4 h-4" />

// Medium UI elements: w-5 h-5 (20px)
<FolderIcon className="w-5 h-5" />

// Large feature icons: w-6 h-6 (24px)
<BookmarkIcon className="w-6 h-6" />
```

### State Management Patterns

Follow existing storage patterns from src/core/storage.ts:

```typescript
// ✅ IndexedDB for settings that should sync
export async function getGroupingMode(): Promise<GroupingMode> {
  const record = await db.settings.get('groupingMode');
  return (record?.value as GroupingMode) ?? 'hierarchical';
}

// ✅ localStorage for session-only UI state
export function getCollapsedGroups(): Set<string> {
  const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
  return stored ? new Set(JSON.parse(stored)) : new Set();
}
```

### Component Structure

Follow the existing component patterns:

```tsx
// ✅ Good - reusable, props-driven, type-safe
interface GroupHeaderProps {
  group: Group;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function GroupHeader({ group, count, collapsed, onToggle }: GroupHeaderProps) {
  return (
    <button onClick={onToggle} className="...">
      {/* content */}
    </button>
  );
}

// ❌ Bad - too much internal state, tightly coupled
function GroupHeader() {
  const [collapsed, setCollapsed] = useState(false);
  const group = useContext(GroupContext);
  // ...
}
```

### Performance Considerations

```tsx
// ✅ Memoize expensive computations
const groupedFavorites = useMemo(() => {
  // Complex grouping logic
  return computeGroups(items, groups, selectedGroupId);
}, [items, groups, selectedGroupId]);

// ✅ Use stable callbacks
const toggleCollapse = useCallback((groupId: string) => {
  setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    return next;
  });
}, []);
```

### Testing Approach

Follow the project's manual testing approach:

1. **Unit tests** for pure functions (grouping logic, state helpers)
2. **Manual browser testing** for UI interactions
3. **Checklist-driven acceptance** for each task

```typescript
// ✅ Unit test pure grouping logic
describe('groupFavoritesByParent', () => {
  it('groups items by their direct parent', () => {
    const items = [
      { id: '1', groupId: 'a' },
      { id: '2', groupId: 'b' },
    ];
    const result = groupFavoritesByParent(items, groups);
    expect(result.get('a')).toHaveLength(1);
  });
});
```

### Error Handling

Follow existing error patterns:

```tsx
// ✅ Show user-friendly error with toast
try {
  await setGroupingMode(mode);
  notify('View mode updated');
} catch (cause) {
  notifyError(errorMessage(cause));
}

// ✅ Provide fallback values
const groupingMode = await getGroupingMode().catch(() => 'hierarchical');
```

---

## Related Documentation

- **design-guide.md** - See "Component Library" for button and card patterns
- **code-guide.md** - See "Storage Layer" for IndexedDB patterns
- **implementation-plan.md** - Phases 1-7 for context
- **docs/archive/development-handoff.md** - Integration with overall project roadmap

---

## Dependencies

**Must be completed first**:
- Phase 2: Core data layer (Groups, Items) ✅
- Phase 3: Dashboard UI ✅
- Phase 4: Nested groups and drag-and-drop ✅

**Can be done in parallel with**:
- Phase 9: Polish (themes, accessibility)
- Phase 10: Google Drive sync (grouping is local feature)

**Blocks**:
- None (this is an optional enhancement)
