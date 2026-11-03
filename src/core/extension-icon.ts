const lightIconPaths = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
};

const darkIconPaths = {
  16: 'icons/icon-16-dark.png',
  32: 'icons/icon-32-dark.png',
  48: 'icons/icon-48-dark.png',
};

export function bindActionIconToColorScheme(): void {
  if (typeof chrome === 'undefined' || !chrome.action?.setIcon) return;

  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const updateIcon = () => {
    const path = colorScheme.matches ? darkIconPaths : lightIconPaths;
    void chrome.action.setIcon({ path }).catch((error: unknown) => {
      console.error('Could not update the extension action icon.', error);
    });
  };

  updateIcon();
  colorScheme.addEventListener('change', updateIcon);
}
