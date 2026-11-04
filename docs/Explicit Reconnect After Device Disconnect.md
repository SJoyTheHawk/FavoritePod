# Explicit Reconnect After Device Disconnect

## Problem

After device-only disconnect shipped, selecting **Connect Google Drive** reconnects immediately. No account chooser, consent screen, or password prompt appears.

## Root Cause

This is expected behavior for the current design, not a token leak.

- Google OAuth grants are stored per Google account and OAuth client, not per device or Chrome profile. The old disconnect called the revoke endpoint, which deleted the single shared grant. That is why every other profile had to sign in again, and why the next Connect showed consent.
- `chrome.identity.getAuthToken` mints tokens from the Chrome profile's signed-in account. Once a grant exists, `interactive: true` returns a token silently. Chrome shows UI only when consent is missing.
- `clearAllCachedAuthTokens()` only removes cached access tokens. The grant and Chrome's refresh credential stay in place.
- Password prompts are always Google's decision, based on session age and risk. Apps can't force them through `getAuthToken`.

## How Other Systems Handle It

| System | Local sign-out | Revoke everywhere | After local sign-out |
|---|---|---|---|
| Android Google Sign-In | `signOut()` | `revokeAccess()` | The next sign-in shows the account chooser. No consent or password. |
| Google Identity Services (web) | App clears its session and calls `disableAutoSelect()` | `google.accounts.oauth2.revoke()` | Auto sign-in is suppressed, so the user has to pick an account. |
| GitHub, Slack, Microsoft 365 | Deletes this device's session | "Sign out of all sessions" in account settings | A new device session is created, usually with no consent step. |
| Dropbox, Google Drive desktop | "Unlink this device" | Revoke the app from web account settings | Relinking reuses the existing Google session. |

These systems share three patterns:

1. Sign-out is local by default. Revoking access everywhere is a separate action, which FavoritePod leaves to Google Account settings.
2. Once a user has signed out, the app doesn't reconnect silently. The next connect shows a visible account confirmation.
3. Consent and password screens aren't the signal that sign-in worked. Google shows consent once per grant.

## Scope

In scope:

1. Suppress silent reconnect after a disconnect.
2. Add an explicit account-confirmation step to Connect.

Out of scope: an "all devices" revoke option and migrating to `launchWebAuthFlow`.

Decision: keep `chrome.identity.getAuthToken`. The Drive account belongs to the Chrome profile's signed-in account, so FavoritePod can't fully sign out or pick a different account. That limit comes from Chrome's identity model. `launchWebAuthFlow` would remove it, but it needs a Web OAuth client and gives only short-lived tokens with weaker silent renewal unless there's a backend. Revisit only if users need a Drive account different from their Chrome profile's.

## Behavior

### 1. Suppress silent reconnect

The persisted `disconnected` state is the "signed out by user" marker. No new metadata key is needed:

- The only ways to reach `disconnected` are a fresh install or a user disconnect. Both should require visible confirmation.
- `disconnectGoogleDrive()` already persists that state atomically, and every sync entry point already gates on it.
- A separate flag could drift out of sync with the connection state. It would also need special handling, because `clearDriveStateInTransaction` wipes all `drive.*` keys.

So: when the profile is `disconnected`, Connect never persists a connection without the user confirming the account.

### 2. Confirm the account before connecting

| Current state | Connect does |
|---|---|
| `disconnected` | Authorizes and identifies the account, then shows the confirmation. Nothing is persisted until the user confirms. |
| `authorization-required` | Unchanged: one-click reauthorization for the remembered account, with the existing account-switch check. |

Confirmation panel, shown inline in the Google Drive section with the existing confirmation styling:

> **Connect Google Drive as name@example.com?**
> FavoritePod uses the Google account signed in to this Chrome profile. To use a different account, change this Chrome profile's account first.
> [Cancel] [Connect]

- **Connect** re-verifies the account silently, persists it, and runs the existing first-sync merge/replace flow.
- **Cancel** clears cached tokens and leaves the profile disconnected. It makes no Drive requests and leaves local data unchanged.
- If another dashboard connects first, the panel closes because the connection status is no longer `disconnected`.
- If Google returns a different account at confirm time, show an error and ask the user to select Connect again. Persist nothing.

## Code Guide

### `src/core/drive-auth.ts`

Add a prepare/confirm/cancel trio. Keep `connectGoogleDrive()` for authorization-required recovery only.

```ts
/** Authorize and identify the account without connecting this profile. */
export async function prepareGoogleDriveConnection(): Promise<DriveAccount> {
  // May complete silently if the account already granted FavoritePod access.
  const token = await acquireToken(true);
  return fetchGoogleAccount(token);
}

/** Connect this profile after the user confirms the identified account. */
export async function confirmGoogleDriveConnection(
  expected: DriveAccount,
): Promise<DriveConnectionResult> {
  if (!isDriveAccount(expected)) {
    throw new DriveAuthError('The Google account details are invalid. Try connecting again.');
  }
  // Re-verify: the Chrome profile account may have changed while the panel was open.
  const actual = await fetchGoogleAccount(await acquireToken(false));
  if (actual.permissionId !== expected.permissionId) {
    throw new DriveAuthError(
      'Google returned a different account. Select Connect Google Drive to review it.',
    );
  }
  const result = await persistIfAccountMatches(actual);
  await notifyConnectionChanged();
  return result;
}

/** Abandon a prepared connection; the profile stays disconnected. */
export async function cancelGoogleDriveConnection(): Promise<void> {
  try {
    await chrome.identity.clearAllCachedAuthTokens();
  } catch {
    // Persisted disconnected state already blocks every Drive request.
  }
}
```

Notes:

- `fetchDriveApi` can throw `DriveAuthorizationRequiredError` during prepare or confirm. Don't call `markDriveAuthorizationRequired()` here. It's already a no-op without a remembered account, and prepare/confirm never mark state.
- `persistIfAccountMatches` still returns `account-switch-required` if another dashboard connected a different account in between. Keep that result type so the UI can reuse the existing switch panel.
- Restrict `connectGoogleDrive()` to recovery so a disconnected profile can't bypass confirmation:

```ts
/** Reauthorize the remembered account after authorization-required. */
export async function connectGoogleDrive(): Promise<DriveConnectionResult> {
  if (!(await getConnectedDriveAccount())) {
    throw new DriveAuthError(
      'Connect Google Drive from Settings to choose an account.',
      'disconnected',
    );
  }
  const token = await acquireToken(true);
  // ...unchanged
}
```

### `src/dashboard/DashboardApp.tsx`

Extract the shared post-connect step from `handleConnectDrive`, then add the three handlers. Prepare runs outside the sync lock because it writes nothing. Confirm runs inside the lock, like the other connection handlers.

```ts
const applyDriveConnectionResult = async (result: DriveConnectionResult) => {
  if (result.status === 'connected') {
    initialDriveSyncAccount.current = result.account.emailAddress;
    setDriveConnection({ status: 'connected', account: result.account });
    await runDriveSync();
  }
  return result;
};

const handlePrepareDriveConnection = () => prepareGoogleDriveConnection();

const handleConfirmDriveConnection = async (account: DriveAccount) => {
  const result = await withGoogleDriveSyncLock(() =>
    confirmGoogleDriveConnection(account),
  );
  if (result === null) {
    throw new Error('Google Drive is syncing. Wait for sync to finish, then connect.');
  }
  return applyDriveConnectionResult(result);
};

const handleCancelDriveConnection = () => cancelGoogleDriveConnection();
```

`handleConnectDrive` keeps its lock and error message and returns `applyDriveConnectionResult(result)`. Pass the new handlers to `SettingsDialog` next to `onConnectDrive`.

### `src/dashboard/components/SettingsDialog.tsx`

Props:

```ts
onPrepareDriveConnection: () => Promise<DriveAccount>;
onConfirmDriveConnection: (account: DriveAccount) => Promise<DriveConnectionResult>;
onCancelDriveConnection: () => Promise<void>;
```

State and effect. Clear the candidate whenever the status leaves `disconnected`, for example when another dashboard connects. Keep the existing reset on entering `disconnected`, but don't let it clear a candidate that is set while the profile is disconnected.

```ts
const [connectCandidate, setConnectCandidate] = useState<DriveAccount>();

useEffect(() => {
  if (driveConnectionStatus !== 'disconnected') setConnectCandidate(undefined);
}, [driveConnectionStatus]);
```

Route the Connect button by state. The authorization-required button keeps calling `connectDrive()`.

```ts
const startDriveConnection = async () => {
  setDriveBusy(true);
  setDriveError(undefined);
  setDriveMessage(undefined);
  try {
    setConnectCandidate(await onPrepareDriveConnection());
  } catch (cause) {
    setDriveError(
      cause instanceof Error ? cause.message : 'Could not connect to Google Drive.',
    );
  } finally {
    setDriveBusy(false);
  }
};

const confirmDriveConnection = async () => {
  if (!connectCandidate) return;
  setDriveBusy(true);
  setDriveError(undefined);
  try {
    const result = await onConfirmDriveConnection(connectCandidate);
    setConnectCandidate(undefined);
    if (result.status === 'account-switch-required') {
      setPendingDriveAccount(result.nextAccount);
    }
  } catch (cause) {
    setConnectCandidate(undefined);
    setDriveError(
      cause instanceof Error ? cause.message : 'Could not connect to Google Drive.',
    );
  } finally {
    setDriveBusy(false);
  }
};

const cancelDriveConnection = async () => {
  setDriveBusy(true);
  try {
    await onCancelDriveConnection();
  } finally {
    setConnectCandidate(undefined);
    setDriveBusy(false);
  }
};
```

Markup in the disconnected branch:

- With no candidate, show the existing centered button wired to `startDriveConnection`.
- With a candidate, show a confirmation panel in place of the button.
- Reuse the switch-account panel classes (`border-warning/40` is for warnings, so use `border-border` here) and its Cancel/primary button pair.
- Give the panel `role="group"`, an `aria-labelledby` heading, and `autoFocus` on Connect.

```tsx
<div aria-labelledby="drive-connect-confirm-title" className="rounded-md border border-border bg-background p-3" role="group">
  <p className="text-sm font-medium text-text-primary" id="drive-connect-confirm-title">
    Connect Google Drive as {connectCandidate.emailAddress}?
  </p>
  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
    FavoritePod uses the Google account signed in to this Chrome profile. To use a
    different account, change this Chrome profile’s account first.
  </p>
  <div className="mt-3 flex justify-center gap-2">
    {/* Cancel → cancelDriveConnection, Connect (autoFocus) → confirmDriveConnection */}
  </div>
</div>
```

If the dialog closes while the panel is open, the candidate is discarded with the component state. That is safe, because nothing was persisted and every sync entry point gates on `disconnected`.

### `src/background/service-worker.ts`

No change. Alarms already skip anything that isn't `connected`.

### Tests: `src/core/__tests__/drive-auth.test.ts`

Use the existing `identity`, `fetch`, `aboutResponse`, `alice`, and `bob` fixtures.

- `prepareGoogleDriveConnection` calls `getAuthToken({ interactive: true })` and returns the account. It writes no `drive.*` keys, sends no `DRIVE_CONNECTION_CHANGED` message, and leaves the state `disconnected`.
- `confirmGoogleDriveConnection(alice)` re-acquires the token with `interactive: false`, persists `alice`, notifies `connected`, and leaves `deviceId` and `lastHlc` untouched.
- If confirm gets `bob` from `about`, it rejects with `identity-error`, persists nothing, and leaves the state `disconnected`.
- If another connection persisted `bob` before confirm, confirm returns `account-switch-required` and sets authorization-required, matching the existing switch test.
- `cancelGoogleDriveConnection` clears cached tokens, makes no `fetch` calls, and leaves the state `disconnected`. It resolves even if `clearAllCachedAuthTokens` rejects.
- `connectGoogleDrive` while disconnected rejects with `disconnected` and never calls `getAuthToken`.
- Update the existing "connects interactively…" test to use prepare and confirm. Keep the recovery tests on `connectGoogleDrive`.

## Documentation

- `docs/phase-8.1-manual-test.md` and `docs/phase-8.4-manual-test.md`: after disconnect or on a fresh install, Connect shows the in-app confirmation. Google consent appears only on the first grant for the account, or after access is revoked in Google Account settings.
- `docs/IMPLEMENTATION_PLAN.md` auth section: add the local sign-out model and the rule that a disconnected profile requires account confirmation before connecting.

## Verification

- Run `npm test`, `npm run lint`, and `npm run build` (the build includes `tsc -b`).
- Manual, single profile: Disconnect, then Connect shows the confirmation with the correct email. Cancel survives a dashboard reload in the disconnected state. Connect starts sync and runs the first-sync merge/replace choice where applicable.
- Manual, two dashboards: open the confirmation in dashboard 1 and connect from dashboard 2. Dashboard 1's panel closes.
- Manual, recovery: in authorization-required, Connect reauthorizes in one click with no confirmation panel.
- Manual, three profiles: connect A, B, and C, then disconnect B and reconnect it through the confirmation. A and C never see a prompt.
- Keyboard and screen reader: focus lands on Connect, Tab reaches Cancel, and the heading is announced with the group.
