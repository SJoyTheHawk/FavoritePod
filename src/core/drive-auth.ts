import { db } from './db';

const DRIVE_ACCOUNT_KEY = 'drive.account';
const DRIVE_METADATA_PREFIX = 'drive.';
const DRIVE_ABOUT_URL =
  'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,permissionId)';
const DRIVE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

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

export interface DriveDisconnectResult {
  revocationConfirmed: boolean;
}

export class DriveAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveAuthError';
  }
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
  const result = await chrome.identity.getAuthToken({ interactive });
  if (!result.token) {
    throw new DriveAuthError(
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
  return fetch(input, { ...init, headers });
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
  }
  return retryResponse;
}

/** Make an authenticated Drive API request with automatic one-time 401 recovery. */
export function driveFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetchDriveApi(input, init);
}

async function fetchGoogleAccount(token: string): Promise<DriveAccount> {
  const response = await fetchDriveApi(DRIVE_ABOUT_URL, { method: 'GET' }, token);
  if (!response.ok) {
    if (response.status === 401) {
      throw new DriveAuthError(
        'Google rejected the refreshed token. Reconnect Google Drive.',
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
    async (): Promise<DriveConnectionResult> => {
      const existing = accountFromRecord(
        (await db.syncMeta.get(DRIVE_ACCOUNT_KEY))?.value,
      );
      if (existing && existing.permissionId !== account.permissionId) {
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
      return { status: 'connected', account };
    },
  );
}

/** Read the locally remembered account without prompting for Google access. */
export async function getConnectedDriveAccount(): Promise<DriveAccount | null> {
  const record = await db.syncMeta.get(DRIVE_ACCOUNT_KEY);
  return accountFromRecord(record?.value);
}

/** Start the user-initiated Chrome OAuth flow and identify its Google account. */
export async function connectGoogleDrive(): Promise<DriveConnectionResult> {
  const token = await acquireToken(true);
  const account = await fetchGoogleAccount(token);
  return persistIfAccountMatches(account);
}

/** Silently check the current Google account, without opening an OAuth prompt. */
export async function checkGoogleDriveAccount(): Promise<DriveConnectionResult> {
  const token = await acquireToken(false);
  const account = await fetchGoogleAccount(token);
  return persistIfAccountMatches(account);
}

async function clearDriveStateInTransaction(): Promise<void> {
  const driveMetadataKeys = await db.syncMeta
    .filter((record) => record.key.startsWith(DRIVE_METADATA_PREFIX))
    .primaryKeys();
  await Promise.all([db.syncMeta.bulkDelete(driveMetadataKeys), db.deviceFiles.clear()]);
}

/** Confirm an account switch and discard only account-specific sync bookkeeping. */
export async function switchGoogleDriveAccount(account: DriveAccount): Promise<void> {
  if (!isDriveAccount(account)) {
    throw new DriveAuthError(
      'The Google account details are invalid. Check the account again.',
    );
  }

  await db.transaction('rw', db.syncMeta, db.deviceFiles, async () => {
    await clearDriveStateInTransaction();
    await db.syncMeta.put({ key: DRIVE_ACCOUNT_KEY, value: account });
  });
}

/** Revoke Google authorization where possible and clear local Drive state. */
export async function disconnectGoogleDrive(): Promise<DriveDisconnectResult> {
  let token: string | undefined;
  let revocationConfirmed = false;

  try {
    token = await acquireToken(false);
    const response = await fetch(DRIVE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
    revocationConfirmed = response.ok;
  } catch {
    // Local disconnect should still complete if Google is unavailable.
  }

  if (token) {
    try {
      await chrome.identity.removeCachedAuthToken({ token });
    } catch {
      // The provider has already revoked this token if the request succeeded.
    }
  }

  await db.transaction('rw', db.syncMeta, db.deviceFiles, clearDriveStateInTransaction);
  return { revocationConfirmed };
}
