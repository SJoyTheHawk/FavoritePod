import type { Group } from '../core/types';
import { isGroupDeleted } from '../core/merge';
import { getGroupLabels } from '../dashboard/group-labels';

export const CONTEXT_MENU_ROOT_ID = 'favoritepod.save';
export const CONTEXT_MENU_PAGE_ID = 'favoritepod.save.page';
export const CONTEXT_MENU_LINK_ID = 'favoritepod.save.link';
export const CONTEXT_MENU_GROUPS_ID = 'favoritepod.save.groups';
export const CONTEXT_MENU_GROUP_PREFIX = 'favoritepod.save.group:';

export interface ContextMenuEntry {
  id: string;
  title: string;
  contexts: ('page' | 'link')[];
  parentId?: string;
}

export function buildContextMenuEntries(groups: readonly Group[]): ContextMenuEntry[] {
  const activeGroups = groups.filter((group) => !isGroupDeleted(group));
  const labels = getGroupLabels(activeGroups);
  return [
    {
      id: CONTEXT_MENU_ROOT_ID,
      title: 'Save to FavoritePod',
      contexts: ['page', 'link'],
    },
    {
      id: CONTEXT_MENU_PAGE_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: 'Save this page',
      contexts: ['page'],
    },
    {
      id: CONTEXT_MENU_LINK_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: 'Save this link',
      contexts: ['link'],
    },
    ...(activeGroups.length
      ? [
          {
            id: CONTEXT_MENU_GROUPS_ID,
            parentId: CONTEXT_MENU_ROOT_ID,
            title: 'Save to group',
            contexts: ['page', 'link'] as ('page' | 'link')[],
          },
        ]
      : []),
    ...activeGroups.map((group) => ({
      id: `${CONTEXT_MENU_GROUP_PREFIX}${group.id}`,
      parentId: CONTEXT_MENU_GROUPS_ID,
      title: labels.get(group.id) ?? group.title,
      contexts: ['page', 'link'] as ('page' | 'link')[],
    })),
  ];
}
