# Device-Only Drive Disconnect and Simpler Settings

> Historical reference. For current work, use the [implementation plan](../planning/implementation-plan.md) or [publishing checklist](../publishing/README.md).

## Summary

Make **Disconnect** stop syncing only in the current Chrome profile. Other profiles and devices using the same Google account must continue syncing without signing in again.

Remove **Check account** and **Reconnect or switch account**. Use the selected contextual recovery design: show **Connect Google Drive** when authorization needs attention.

## Connection and Disconnect Behavior

- Remove Google token revocation from ordinary disconnect. Clear FavoritePod’s locally cached Chrome Identity credentials and this profile’s Drive connection and sync bookkeeping. Do not acquire a token or make a network request to disconnect.
- Preserve local favorites, groups, thumbnails, snapshots, device identity, and logical clock. Leave files in Google Drive untouched.
- Perform disconnect under the existing sync lock. If sync is running, retain the current “wait for sync to finish” behavior.
- Commit local disconnection even if Chrome’s credential-cache cleanup fails. All automatic and manual sync entry points must check persisted connection state before requesting a token or accessing Drive.
- Notify other open FavoritePod dashboards in the same profile so they immediately show the disconnected state and cancel pending sync timers. Alarms must safely skip disconnected profiles.
- Full account-wide revocation remains available through Google Account settings; do not add another permanent button for it.

## Settings and Authorization Recovery

Keep the Google Drive section below Import and export, using existing colors, spacing, confirmation styling, and centered action layout.

| State | Display | Actions |
|---|---|---|
| Disconnected | “Not connected” beside Google Drive | Connect Google Drive |
| Connected | Account email and sync status | Sync now · Disconnect |
| Authorization required | Account email, “Connection needs attention,” and recovery explanation | Connect Google Drive · Disconnect |

- Change disconnect confirmation to: **“Disconnect Google Drive in this Chrome profile? Your saved favorites and Drive data will remain. Other profiles and devices will continue syncing.”**
- Continue silently refreshing rejected tokens once. Only a user click on **Connect Google Drive** may start interactive authorization.
- Preserve authentication errors through device-file and asset operations instead of converting them into “Could not reach Google Drive.” Genuine network failures retain network messaging and bounded retries; authorization-required errors are not retried as network failures.
- Persist authorization-required state in existing local sync metadata and propagate it to open dashboards. Background sync pauses until successful authorization; ordinary offline failures must not set this state.
- Successful authorization for the remembered account clears the recovery state and explicitly resumes sync, even when the email has not changed. Cancellation leaves local data and recovery state intact.
- Preserve account-identity confirmation when authorization returns a different account. After confirmation, clear account-specific bookkeeping and use the existing first-sync merge/replace flow. Disconnect followed by Connect remains the entry point for changing accounts, subject to Chrome’s account-selection behavior.

## Interfaces and Documentation

- Change `disconnectGoogleDrive()` and its UI callback to return `Promise<void>`; remove `revocationConfirmed` and revocation-specific messages.
- Introduce typed authorization-required errors and a persisted connection-status reader shared by the dashboard and service worker. Use structured status/error codes across runtime messages rather than parsing displayed messages.
- Remove the Check account UI callback and unused handlers. Retain internal account verification where needed for safe authorization.
- Remove the unused revocation endpoint and its host permission if no remaining feature uses that origin.
- Update the implementation plan, authentication documentation, and Phase 8.1/8.4 manual tests to explicitly replace the former revoke-on-disconnect requirement. Existing installations require no database schema migration; absent recovery metadata means the existing connection state applies.

## Verification

- **Three-profile acceptance:** connect A, B, and C to the same account; disconnect B; verify A and C still upload and download without authorization prompts. B remains disconnected after dashboard reload and browser restart.
- **Local isolation:** verify disconnect works offline, preserves local data and Drive files, and updates every open dashboard in that profile.
- **Recovery:** simulate rejected tokens and failed silent authorization; verify contextual Connect appears, automatic retries stop, and successful same-account authorization resumes sync with pending changes intact.
- **Failure distinctions:** verify network outages remain network errors, ordinary token expiration recovers silently, and cancelled consent does not erase data.
- **Account safety:** verify a different returned account requires confirmation and the existing merge/replace flow.
- Add focused automated coverage for disconnect isolation, error propagation, persisted recovery, and sync gating. Run tests, type-check, lint, and build; manually verify layout and real multi-profile OAuth behavior.
