import { db } from './db';

const DRIVE_ACCOUNT_KEY = 'drive.account';
const DRIVE_METADATA_PREFIX = 'drive.';
const DRIVE_ABOUT_URL =
  'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,permissionId)';
const DRIVE_AUTH_REQUIRED_KEY = 'drive.authorizationRequired';
export const DRIVE_CONNECTION_CHANGED = 'favoritepod.drive.connection-changed';

export interface DriveAccount {
  emailAddress: string;
  permissionId: string;
}

export type DriveConnectionResult =
  | { status: 'connected'; account: DriveAccount }
  | {
      status: 'account-switch-required';
      previousAccount: DriveAccount;
      nextAccount: DriveAccount;
    };

export type DriveConnectionState =
  | { status: 'disconnected'; account: null }
  | { status: 'connected' | 'authorization-required'; account: DriveAccount };

export type DriveAuthErrorCode =
  'identity-error' | 'network-error' | 'authorization-required' | 'disconnected';

export class DriveAuthError extends Error {
  constructor(
    message: string,
    readonly code: DriveAuthErrorCode = 'identity-error',
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export class DriveAuthorizationRequiredError extends DriveAuthError {
  constructor(
    message = 'Google Drive needs authorization. Select Connect Google Drive to continue syncing.',
  ) {
    super(message, 'authorization-required');
    this.name = 'DriveAuthorizationRequiredError';
  }
}

/** Read persistent state without requesting a token. */
export async function getDriveConnectionState(): Promise<DriveConnectionState> {
  return db.transaction('r', db.syncMeta, async () => {
    const account = await getConnectedDriveAccount();
    if (!account) return { status: 'disconnected', account: null };
    const required = (await db.syncMeta.get(DRIVE_AUTH_REQUIRED_KEY))?.value === true;
    return { status: required ? 'authorization-required' : 'connected', account };
  });
}

async function notifyConnectionChanged(): Promise<void> {
  const connection = await getDriveConnectionState();
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    await chrome.runtime
      .sendMessage({ type: DRIVE_CONNECTION_CHANGED, status: connection.status })
      .catch(() => undefined);
  }
}

export async function markDriveAuthorizationRequired(): Promise<void> {
  await db.transaction('rw', db.syncMeta, async () => {
    if (await getConnectedDriveAccount()) {
      await db.syncMeta.put({ key: DRIVE_AUTH_REQUIRED_KEY, value: true });
    }
  });
  await notifyConnectionChanged();
}

export async function requireDriveConnection(): Promise<DriveAccount> {
  const connection = await getDriveConnectionState();
  if (connection.status === 'disconnected') {
    throw new DriveAuthError(
      'Connect Google Drive before syncing your library.',
      'disconnected',
    );
  }
  if (connection.status === 'authorization-required')
    throw new DriveAuthorizationRequiredError();
  return connection.account;
}

function isDriveAccount(value: unknown): value is DriveAccount {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<DriveAccount>;
  return (
    typeof candidate.emailAddress === 'string' &&
    candidate.emailAddress.length > 0 &&
    typeof candidate.permissionId === 'string' &&
    candidate.permissionId.length > 0
  );
}

function accountFromRecord(value: unknown): DriveAccount | null {
  return isDriveAccount(value) ? value : null;
}

async function acquireToken(interactive: boolean): Promise<string> {
  let result: chrome.identity.GetAuthTokenResult;
  try {
    result = await chrome.identity.getAuthToken({ interactive });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    // Chrome Identity exposes string errors; classify them here, never in UI.
    if (
      (typeof navigator !== 'undefined' && navigator.onLine === false) ||
      /network|connection failed|failed to fetch|service unavailable|timed? out|ERR_(?:INTERNET|NETWORK|CONNECTION|NAME)/i.test(
        message,
      )
    ) {
      throw new DriveAuthError(
        'Could not reach Google to authorize Drive. Check your connection and try again.',
        'network-error',
        true,
      );
    }
    if (
      !interactive &&
      /not granted|revoked|not signed in|not logged in|did not approve|user is not signed|interaction.?required|login.?required|invalid_grant|consent.?required/i.test(
        message,
      )
    ) {
      throw new DriveAuthorizationRequiredError();
    }
    throw new DriveAuthError(
      interactive
        ? 'Google Drive connection was not completed. Select Connect Google Drive to try again.'
        : 'Could not obtain Google Drive authorization. Try again or reconnect this profile.',
    );
  }
  if (!result.token) {
    throw new DriveAuthorizationRequiredError(
      interactive
        ? 'Google did not return an access token. Try connecting again.'
        : 'Google Drive needs you to reconnect your account.',
    );
  }
  return result.token;
}

async function fetchWithToken(
  input: RequestInfo | URL,
  init: RequestInit,
  token: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(input, { ...init, headers });
  } catch {
    throw new DriveAuthError(
      'Could not reach Google Drive. Check your connection and try again.',
      'network-error',
      true,
    );
  }
}

/** Fetch a Drive API resource and retry once after evicting a rejected token. */
async function fetchDriveApi(
  input: RequestInfo | URL,
  init: RequestInit = {},
  initialToken?: string,
): Promise<Response> {
  const token = initialToken ?? (await acquireToken(false));
  const response = await fetchWithToken(input, init, token);
  if (response.status !== 401) return response;

  await chrome.identity.removeCachedAuthToken({ token });
  const refreshedToken = await acquireToken(false);
  const retryResponse = await fetchWithToken(input, init, refreshedToken);
  if (retryResponse.status === 401) {
    await chrome.identity.removeCachedAuthToken({ token: refreshedToken });
    throw new DriveAuthorizationRequiredError();
  }
  return retryResponse;
}

/** Make an authenticated Drive API request with automatic one-time 401 recovery. */
export async function driveFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  await requireDriveConnection();
  try {
    return await fetchDriveApi(input, init);
  } catch (cause) {
    if (cause instanceof DriveAuthorizationRequiredError)
      await markDriveAuthorizationRequired();
    throw cause;
  }
}

async function fetchGoogleAccount(token: string): Promise<DriveAccount> {
  const response = await fetchDriveApi(DRIVE_ABOUT_URL, { method: 'GET' }, token);
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      throw new DriveAuthError(
        'Google Drive is temporarily unavailable. Try again later.',
        'network-error',
        true,
      );
    }
    if (response.status === 403) {
      throw new DriveAuthError(
        'Google denied access to Drive. Check that the Drive API is enabled and FavoritePod is authorized.',
      );
    }
    throw new DriveAuthError(
      `Could not read the Google account (HTTP ${response.status}).`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DriveAuthError('Google returned an unreadable account response.');
  }

  if (typeof payload !== 'object' || payload === null || !('user' in payload)) {
    throw new DriveAuthError('Google did not return account details.');
  }
  const user = payload.user;
  if (typeof user !== 'object' || user === null) {
    throw new DriveAuthError('Google did not return account details.');
  }
  const candidate = user as Partial<DriveAccount>;
  if (!isDriveAccount(candidate)) {
    throw new DriveAuthError('Google returned incomplete account details.');
  }
  return {
    emailAddress: candidate.emailAddress,
    permissionId: candidate.permissionId,
  };
}

async function persistIfAccountMatches(
  account: DriveAccount,
): Promise<DriveConnectionResult> {
  return db.transaction(
    'rw',
    db.syncMeta,
    db.deviceFiles,
    db.driveAssets,
    async (): Promise<DriveConnectionResult> => {
      const existing = accountFromRecord(
        (await db.syncMeta.get(DRIVE_ACCOUNT_KEY))?.value,
      );
      if (existing && existing.permissionId !== account.permissionId) {
        await db.syncMeta.put({ key: DRIVE_AUTH_REQUIRED_KEY, value: true });
        return {
          status: 'account-switch-required',
          previousAccount: existing,
          nextAccount: account,
        };
      }

      if (!existing) {
        await clearDriveStateInTransaction();
      }
      await db.syncMeta.put({ key: DRIVE_ACCOUNT_KEY, value: account });
      await db.syncMeta.delete(DRIVE_AUTH_REQUIRED_KEY);
      return { status: 'connected', account };
    },
  );
}

/** Read the locally remembered account without prompting for Google access. */
export async function getConnectedDriveAccount(): Promise<DriveAccount | null> {
  const record = await db.syncMeta.get(DRIVE_ACCOUNT_KEY);
  return accountFromRecord(record?.value);
}

/** Authorize and identify the Google account without connecting this profile. */
export async function prepareGoogleDriveConnection(): Promise<DriveAccount> {
  const token = await acquireToken(true);
  return fetchGoogleAccount(token);
}

/** Connect this profile after the user confirms the identified account. */
export async function confirmGoogleDriveConnection(
  expected: DriveAccount,
): Promise<DriveConnectionResult> {
  if (!isDriveAccount(expected)) {
    throw new DriveAuthError(
      'The Google account details are invalid. Try connecting again.',
    );
  }

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

/** Abandon a prepared connection while keeping this profile disconnected. */
export async function cancelGoogleDriveConnection(): Promise<void> {
  try {
    await chrome.identity.clearAllCachedAuthTokens();
  } catch {
    // Persisted disconnection blocks Drive requests even if cache cleanup fails.
  }
}

/** Reauthorize a remembered account after an authorization failure. */
export async function connectGoogleDrive(): Promise<DriveConnectionResult> {
  if (!(await getConnectedDriveAccount())) {
    throw new DriveAuthError(
      'Connect Google Drive from Settings to choose an account.',
      'disconnected',
    );
  }

  const token = await acquireToken(true);
  const account = await fetchGoogleAccount(token);
  const result = await persistIfAccountMatches(account);
  await notifyConnectionChanged();
  return result;
}

/** Verify identity before sync without silently switching the saved account. */
export async function verifyGoogleDriveAccount(): Promise<void> {
  const expected = await requireDriveConnection();
  try {
    const actual = await fetchGoogleAccount(await acquireToken(false));
    if (actual.permissionId !== expected.permissionId) {
      throw new DriveAuthorizationRequiredError(
        'Google returned a different account. Select Connect Google Drive to review the account change.',
      );
    }
  } catch (cause) {
    if (cause instanceof DriveAuthorizationRequiredError)
      await markDriveAuthorizationRequired();
    throw cause;
  }
}

async function clearDriveStateInTransaction(): Promise<void> {
  const driveMetadataKeys = await db.syncMeta
    .filter((record) => record.key.startsWith(DRIVE_METADATA_PREFIX))
    .primaryKeys();
  await Promise.all([
    db.syncMeta.bulkDelete(driveMetadataKeys),
    db.deviceFiles.clear(),
    db.driveAssets.clear(),
  ]);
}

/** Confirm an account switch and discard only account-specific sync bookkeeping. */
export async function switchGoogleDriveAccount(account: DriveAccount): Promise<void> {
  if (!(await getConnectedDriveAccount())) {
    throw new DriveAuthError(
      'Connect Google Drive before changing accounts.',
      'disconnected',
    );
  }
  if (!isDriveAccount(account)) {
    throw new DriveAuthError(
      'The Google account details are invalid. Check the account again.',
    );
  }

  const current = await fetchGoogleAccount(await acquireToken(false));
  if (current.permissionId !== account.permissionId) {
    throw new DriveAuthorizationRequiredError(
      'The Google account changed again. Select Connect Google Drive to review it.',
    );
  }
  await db.transaction('rw', db.syncMeta, db.deviceFiles, db.driveAssets, async () => {
    await clearDriveStateInTransaction();
    await db.syncMeta.put({ key: DRIVE_ACCOUNT_KEY, value: account });
  });
  await notifyConnectionChanged();
}

/** Disconnect only this profile, without revoking the Google account grant. */
export async function disconnectGoogleDrive(): Promise<void> {
  await db.transaction(
    'rw',
    db.syncMeta,
    db.deviceFiles,
    db.driveAssets,
    clearDriveStateInTransaction,
  );
  await notifyConnectionChanged();
  try {
    await chrome.identity.clearAllCachedAuthTokens();
  } catch {
    // Persisted disconnection prevents sync even if local cache cleanup fails.
  }
}
