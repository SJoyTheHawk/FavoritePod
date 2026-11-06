export const CONTEXT_MENU_ROOT_ID = 'favoritepod.save';

export interface ContextMenuEntry {
  id: string;
  title: string;
  contexts: ('page' | 'link')[];
}

export function buildContextMenuEntries(): ContextMenuEntry[] {
  return [
    {
      id: CONTEXT_MENU_ROOT_ID,
      title: 'Save to FavoritePod',
      contexts: ['page', 'link'],
    },
  ];
}
