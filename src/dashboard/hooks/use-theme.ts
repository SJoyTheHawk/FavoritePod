import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../../core/storage';

export type Theme = ThemePreference;

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('auto');
  const [appliedTheme, setAppliedTheme] = useState<'light' | 'dark'>('light');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const subscription = liveQuery(getThemePreference).subscribe({
      next: (savedTheme) => {
        setThemeState(savedTheme);
        setReady(true);
        setError(undefined);
      },
      error: () => {
        setReady(true);
        setError(
          'Could not load your appearance preference. Reopen FavoritePod to retry.',
        );
      },
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolvedTheme =
        theme === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      document.documentElement.setAttribute('data-theme', resolvedTheme);
      setAppliedTheme(resolvedTheme);
    };

    applyTheme();
    window.addEventListener('focus', applyTheme);
    if (theme === 'auto') mediaQuery.addEventListener('change', applyTheme);
    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
      window.removeEventListener('focus', applyTheme);
    };
  }, [theme]);

  const saveTheme = async (nextTheme: Theme) => {
    const previousTheme = theme;
    setThemeState(nextTheme);
    setSaving(true);
    try {
      await setThemePreference(nextTheme);
      setError(undefined);
    } catch (cause) {
      setThemeState(previousTheme);
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  return {
    theme,
    appliedTheme,
    ready,
    saving,
    error,
    setTheme: saveTheme,
  };
}
