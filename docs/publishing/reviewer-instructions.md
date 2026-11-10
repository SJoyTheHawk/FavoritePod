# FavoritePod — review instructions

## Publisher checks before copying

- Verify the final store extension ID matches the configured Google OAuth client.
- Set up production OAuth access and test with a non-test-user Google account.
- Host the policy and support pages and check them while signed out.
- Complete the manual production-build checks, including native context menus.

The instructions below describe expected behavior for version 1.0.0. They do not
claim that those external release checks have already been completed.

## Copy into the dashboard's Test instructions field

```text
FavoritePod 1.0.0 is a visual bookmark launcher. Core features require no account, subscription, payment, license key, or developer-supplied test credentials.

Basic save and organization:
1. Pin FavoritePod in Chrome's toolbar and open a normal HTTPS page.
2. Click FavoritePod, then Add bookmark. The page is initially saved with a preview when capture succeeds. Edit the name/folder and click Save.
3. Select Open launcher. Confirm the saved favorite appears, can be searched, and opens the destination.
4. Create a folder and a subfolder, move a favorite, and try grid/list views. Use Settings to change appearance.
5. Settings > Import & export provides ZIP backup/import and Chrome-compatible HTML import/export. For a repeat import, choose Import a copy to avoid replacing the test library.

Local tools:
1. In chrome://extensions, open FavoritePod's Details and enable Allow access to file URLs.
2. Open a local HTML file in Chrome and save it through the toolbar, or add its file:// address in the launcher.
3. Open the favorite. File Locations Remap in Settings > Local files can map a saved path to its location on another computer. The original file must exist locally; Drive sync does not copy it.

Optional frequently visited shortcuts:
Enable Settings > Behavior > Permission control > Frequently visited access and accept Top sites permission. Enable the relevant Show frequently visited visibility option. Chrome supplies the list and order; a fresh profile may have few or no shortcuts. Hide a shortcut or turn off visibility/access to verify the controls. No History permission is requested.

Optional context menu:
Enable Right-click save menu in Settings > Behavior and grant the optional permission. Right-click an HTTPS page or link, then choose Save to FavoritePod. The save form opens for that page/link. A clicked link does not capture the containing page as its preview.

Optional Google Drive sync:
Use Settings > Google Drive > Connect Google Drive, or the launcher cloud button, then Sign in with Google and confirm the account. Use a Google account controlled by the reviewer; there is no shared test password. Authorization uses only drive.appdata, for FavoritePod's own hidden app-data folder.
Connect a second Chrome profile to the same account and confirm that a saved favorite and preview synchronize. If both libraries contain data, use Merge local and Drive data. Disconnect on one profile and confirm that its library remains available and the other profile can continue syncing. Disconnect is profile-specific and does not erase Drive data or revoke the account-wide grant.

Data handling:
Titles, URLs, folders, previews, settings, and operational metadata are stored locally. Optional Drive sync sends library data and preview assets directly to Google. Google account email and permission ID identify the connected account. Top sites and hidden-shortcut preferences remain local unless a shortcut is explicitly saved as a favorite. Website favicon requests may reach the icon provider. The extension has no analytics, ads, remotely executed code, or automatic error-reporting service.

All features are free. The listing and product website include an optional Buy Me a Coffee link; contributions do not unlock features and payment is handled on that external site.

Publisher: Rocky Road Studio
Contact: rockyroadstudio@outlook.com
Privacy: https://rockyroad.studio/favoritepod/privacy/
Support: https://rockyroad.studio/favoritepod/support/
```
