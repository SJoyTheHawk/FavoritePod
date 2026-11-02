import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { getRecentItems, listGroups, listItems } from './storage';
import type { Group, Item } from './types';

export function useLibrary() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [nextGroups, nextItems] = await Promise.all([listGroups(), listItems()]);
      return { groups: nextGroups, items: nextItems };
    }).subscribe({
      next: (library) => {
        setGroups(library.groups);
        setItems(library.items);
        setLoading(false);
        setError(undefined);
      },
      error: (cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : 'Could not read the local library.',
        );
        setLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return { groups, items, loading, error };
}

export function useRecentItems(limit = 5) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = liveQuery(() => getRecentItems(limit)).subscribe({
      next: (nextItems) => {
        setItems(nextItems);
        setLoading(false);
      },
      error: () => setLoading(false),
    });
    return () => subscription.unsubscribe();
  }, [limit]);

  return { items, loading };
}
