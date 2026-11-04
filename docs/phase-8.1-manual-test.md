# Phase 8.1: Google Drive authorization manual test

Automated tests cover token handling, account identification, 401 recovery, account
switch confirmation, and local cleanup. The browser OAuth consent flow still needs a
real Chrome profile with a Google account listed as an OAuth test user.

## Before testing

1. Run `npm run build` and load the generated `dist` directory from `chrome://extensions`
   with Developer mode enabled.
2. Confirm the loaded extension ID matches the ID registered on the Google OAuth
   client, and that the client ID in `public/manifest.json` is that client.
3. In Google Cloud, confirm the Drive API is enabled and this Google account is listed
   under the OAuth consent screen's test users while the app is in Testing mode.
4. Open FavoritePod's dashboard, choose Settings, and check that the Google Drive
   section says “Not connected.”

## Connect and verify

1. Click **Connect Google Drive**. The consent flow should start from this button.
2. Review the requested access. It should be limited to FavoritePod's private Drive
   app-data folder.
3. Approve access. Settings should show **Connected as** followed by the account email.
4. Reload the dashboard and reopen Settings. The connection state should remain.
5. Click **Check account**. The saved Google account should be verified without opening
   a new consent prompt.
6. Click **Reconnect or switch account** and approve if Chrome asks. If Google returns
   a different account, FavoritePod should show a confirmation naming both accounts.
   Cancel must leave the saved account unchanged. Confirming the switch must update the
   connected email and clear only Drive file records; local favorites and the local
   device ID remain.

## Disconnect

1. Add a favorite, then choose **Disconnect** and read the confirmation.
2. Confirm. Settings should show **Not connected**, while the favorite remains after a
   dashboard reload.
3. If Google is offline during disconnect, FavoritePod should still clear its local
   connection and show that Google did not confirm revocation.

The confirmation explains that Google can revoke authorization for other FavoritePod
OAuth clients registered to the same Cloud project. Google documents this project-wide
effect in its [OAuth token revocation guidance](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke).

## Automated coverage

Run `npm test -- --run src/core/__tests__/drive-auth.test.ts` for the local tests. A
Drive API 401 is simulated there: FavoritePod removes the rejected cached token and
retries once. A second 401 fails cleanly and removes the rejected replacement token.
