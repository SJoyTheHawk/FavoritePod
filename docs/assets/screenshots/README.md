# Screenshot notes

These supporting screenshots were captured on November 6, 2026, using the FavoritePod
components at commit `4fa6de5`:

| Image                      | What it shows                                                                  |
| -------------------------- | ------------------------------------------------------------------------------ |
| `dashboard-grid.png`       | Eight sample favorites in the Favorites and Projects folders.                  |
| `dashboard-list.png`       | The same library in the compact list view.                                     |
| `popup.png`                | The Add bookmark dialog, including the preview, name, folder, and Done button. |
| `google-drive-sign-in.png` | The optional Google Drive connection dialog.                                   |

These are browser captures of the actual React components and existing app styles,
rendered in headless Chrome with an isolated temporary profile. Sample data and
illustrative preview images were stored in a temporary IndexedDB database. Chrome
extension APIs and the sample local-file availability response were stubbed for
the captures; no real Google account or personal library was used. The Drive image
shows the app's sign-in prompt, not a completed OAuth connection.

The dashboard captures use a 1200-pixel viewport; the popup uses its 320-pixel width.
Images are captured at double resolution for clear text. The Drive screenshot is
cropped around the dialog.

These earlier captures remain available for support and development documentation.
The root README now uses the five [store screenshots](../../publishing/screenshots/).

When refreshing these images, use sample content, keep personal emails and browser
tabs out of frame, and update the captions when the UI changes.
