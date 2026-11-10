# FavoritePod — dashboard privacy practices

Prepared November 10, 2026 from the version 1.0.0 source. These are publisher
instructions and proposed dashboard answers, not public marketing copy.

## Single purpose

```text
FavoritePod is a visual bookmark launcher for saving, organizing, finding, and opening favorite websites and local file links, with previews, import/export, and optional synchronization through the user's Google Drive.
```

## Permission justifications

Paste each explanation into its corresponding dashboard field. For the separate
**Host permission justification** field, use the combined answer below the table.

| Permission                     | Explanation                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                    | When the user invokes FavoritePod to save a page, read that tab's title, URL, and favicon and capture its visible content for the bookmark preview. It is used for the user-initiated save/refresh action.                                           |
| `favicon`                      | Read Chrome's favicon endpoint to display recognizable website icons alongside saved bookmarks and optional frequently visited shortcuts, including when no usable icon URL was supplied by the tab.                                                 |
| `unlimitedStorage`             | Store the user's bookmark library and compressed preview images locally in IndexedDB, including larger libraries and local recovery snapshots.                                                                                                       |
| `identity`                     | Obtain Google OAuth authorization only when the user chooses optional Google Drive sync, and obtain/refresh access tokens to perform that sync while connected. Local bookmark features work without Google sign-in.                                 |
| `alarms`                       | Schedule background synchronization and retry work for the user's connected Google Drive library.                                                                                                                                                    |
| `file:///*`                    | Open saved local-file links and check whether their remapped targets are available. Local-page capture also requires Chrome's separate Allow access to file URLs switch. FavoritePod does not scan arbitrary folders or upload original local files. |
| `https://www.googleapis.com/*` | Call Google's Drive API for account identification, and read/write FavoritePod's library state and preview assets in the user's appDataFolder. These requests use the drive.appdata OAuth scope.                                                     |
| Optional `topSites`            | When the user grants Frequently visited access, obtain Chrome's top-site titles and URLs to show launcher shortcuts in Chrome's order. Hidden shortcuts and visibility preferences stay local; only explicitly saved favorites join the library.     |
| Optional `contextMenus`        | When the user enables Right-click save menu, add Save to FavoritePod to page/link context menus and open the bookmark form for the selected destination.                                                                                             |

### Host permission justification

Paste this entire answer into **Host permission justification**:

```text
file:///*: FavoritePod checks whether saved local-file links are available, including targets adjusted by the user's path remapping. Local-page previews require Chrome's separate Allow access to file URLs setting. File locations are chosen by the user and can be anywhere on their device, so access cannot be limited to one folder. The extension does not scan arbitrary folders or upload original local files.

https://www.googleapis.com/*: When the user connects Google Drive, FavoritePod calls the Drive API to identify the connected account and synchronize library data and preview images in its own hidden appDataFolder. This host covers both /drive/v3/ and /upload/drive/v3/ endpoints. File access uses the drive.appdata OAuth scope; local bookmark features work without Google sign-in.
```

### Google OAuth scope

`https://www.googleapis.com/auth/drive.appdata` limits Drive file access to
FavoritePod's own hidden application-data folder. Account information is read to
identify the connected account. Do not describe this as full Google Drive access
or claim that Google account data is never handled.

## Remote code

Select **No, I am not using remote code** for the production build.

```text
All extension JavaScript is included in the uploaded package. Google Drive responses are data, and downloaded preview/favicon images are displayed as images; they are not executed as code. Opening a saved website or local HTML tool navigates a normal browser tab to that destination.
```

Verify the final production package does not include development-server scripts.

## Data categories

Suggested selections under Google's current dashboard definitions are below.
Read the live field descriptions before certifying them. Handling locally stored
data and using Google rather than a developer backend still require disclosure.

| Data category                       | Suggested selection      | Reason                                                                                                                                                                |
| ----------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | Yes                      | Optional Drive connection reads the Google email address and account permission ID; sync uses a generated profile/device identifier.                                  |
| Authentication information          | Yes                      | Google OAuth access tokens authorize Drive requests. FavoritePod does not receive the Google password.                                                                |
| Web history                         | Yes                      | Saved/active-page URLs and optional Top sites URLs describe websites the user visits. This declaration does not mean the extension requests Chrome's History API.     |
| Website content                     | Yes                      | Saved titles, screenshot previews, uploaded preview images, icons, bookmark imports, and file-link information form the user's library.                               |
| Health information                  | No dedicated collection  | No health-specific feature or API. Visible content the user chooses to capture can incidentally contain sensitive information.                                        |
| Financial and payment information   | No dedicated collection  | No extension payment form or payment API. Voluntary contributions use the external Buy Me a Coffee site. Captures can incidentally include visible financial content. |
| Personal communications             | No dedicated collection  | No email/chat API or message-reading feature. User-selected page previews may show communications. Support email is separately disclosed in the policy.               |
| Location                            | No dedicated collection  | No geolocation feature. Saved URLs, paths, or captured content may incidentally reveal location.                                                                      |
| User activity                       | No behavioral monitoring | No analytics, keystroke logging, mouse recording, or general browsing-event tracking. Local preferences and operational sync history support the disclosed features.  |

Incidental content is still user data. The policy describes what previews can
contain; confirm any additional categories required by the dashboard's live
definitions for screenshot handling. Do **not** select “does not collect or use
user data.”

The prepared disclosure reflects these practices: data is not sold, used for
advertising, used for credit/lending decisions, or used for purposes unrelated to
FavoritePod's features. The publisher must personally confirm the dashboard's
certification statements, including any website/support/payment practices.

## Privacy-policy URL

After hosting the prepared page, use:

`https://rockyroad.studio/favoritepod/privacy/`

The November 10, 2026 link check found that this URL redirects to the studio-wide
privacy page. Fix it to serve the FavoritePod policy before entering it in the
dashboard. Also use the verified policy in Google OAuth branding and make it
accessible in the extension UI.

## Implementation evidence

- `public/manifest.json`: requested and optional permissions, OAuth scope.
- `src/core/drive-auth.ts`: account email/permission ID, tokens, profile-only disconnect.
- `src/core/drive-files.ts` and `drive-assets.ts`: synced state, images, delayed cleanup.
- `src/core/storage.ts`: local settings, snapshots, soft-deleted records.
- `src/core/favicon.ts`: local Chrome endpoint and site-supplied icon requests.
- `src/core/file-links.ts`: local-file availability checks and path remapping.
- `src/core/discovery.ts` and `optional-features.ts`: opt-in top sites and context menus.

## Official references

- [Privacy dashboard fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [User-data handling FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
