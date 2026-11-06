import { AnimatedDialog, useDialogTransition } from '../../components/AnimatedDialog';
import { useState } from 'react';
import { DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { CloudIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type {
  DriveAccount,
  DriveConnectionResult,
  DriveConnectionState,
} from '../../core/drive-auth';

interface GoogleDriveSignInDialogProps {
  driveAccount: DriveAccount | null;
  driveConnectionStatus: DriveConnectionState['status'];
  online: boolean;
  onClose: () => void;
  onConnectDrive: () => Promise<DriveConnectionResult>;
  onPrepareDriveConnection: () => Promise<DriveAccount>;
  onConfirmDriveConnection: (account: DriveAccount) => Promise<DriveConnectionResult>;
  onCancelDriveConnection: () => Promise<void>;
  onSwitchDriveAccount: (account: DriveAccount) => Promise<void>;
}

export function GoogleDriveSignInDialog({
  driveAccount,
  driveConnectionStatus,
  online,
  onClose: onClosed,
  onConnectDrive,
  onPrepareDriveConnection,
  onConfirmDriveConnection,
  onCancelDriveConnection,
  onSwitchDriveAccount,
}: GoogleDriveSignInDialogProps) {
  const dialogTransition = useDialogTransition(onClosed);
  const onClose = dialogTransition.close;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [candidate, setCandidate] = useState<DriveAccount>();
  const [pendingAccount, setPendingAccount] = useState<DriveAccount>();

  const startSignIn = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (driveConnectionStatus === 'disconnected') {
        setCandidate(await onPrepareDriveConnection());
        return;
      }
      const result = await onConnectDrive();
      if (result.status === 'account-switch-required') {
        setPendingAccount(result.nextAccount);
      } else {
        onClose();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not connect Google Drive.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmSignIn = async () => {
    if (!candidate) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await onConfirmDriveConnection(candidate);
      setCandidate(undefined);
      if (result.status === 'account-switch-required') {
        setPendingAccount(result.nextAccount);
      } else {
        onClose();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not connect Google Drive.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmAccountSwitch = async () => {
    if (!pendingAccount) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSwitchDriveAccount(pendingAccount);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not switch Google accounts.',
      );
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    if (candidate) {
      setBusy(true);
      setError(undefined);
      void onCancelDriveConnection()
        .catch((cause) => {
          setError(
            cause instanceof Error ? cause.message : 'Could not cancel the sign-in.',
          );
        })
        .finally(() => {
          setCandidate(undefined);
          setBusy(false);
          onClose();
        });
      return;
    }
    onClose();
  };

  const title =
    driveConnectionStatus === 'authorization-required'
      ? 'Reconnect Google Drive'
      : 'Connect Google Drive';

  return (
    <AnimatedDialog
      className="relative z-[60]"
      onClose={close}
      open={dialogTransition.open}
      afterLeave={dialogTransition.afterLeave}
    >
      <DialogBackdrop transition className="dialog-backdrop fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          transition
          className="dialog-panel w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CloudIcon aria-hidden="true" className="mt-0.5 h-6 w-6 text-primary" />
              <div>
                <DialogTitle className="text-lg font-semibold text-text-primary">
                  {title}
                </DialogTitle>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {driveConnectionStatus === 'authorization-required'
                    ? 'Sign in again to resume syncing your favorites.'
                    : 'Sign in with Google to sync your favorites across your devices.'}
                </p>
              </div>
            </div>
            <button
              aria-label="Close Google Drive sign-in"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
              onClick={close}
              title="Close"
              type="button"
            >
              <XMarkIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          {!online && (
            <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary">
              You’re offline. Reconnect to the internet before signing in to Google Drive.
            </p>
          )}

          {driveAccount &&
            driveConnectionStatus === 'authorization-required' &&
            !pendingAccount && (
              <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary">
                FavoritePod is connected as{' '}
                <span className="font-medium">{driveAccount.emailAddress}</span>.
              </p>
            )}

          {candidate && (
            <div className="mt-4 rounded-md border border-border bg-surface p-3">
              <p className="text-sm text-text-primary">
                Signed in using{' '}
                <span className="font-medium">{candidate.emailAddress}</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Confirm to connect Google Drive and sync your favorites.
              </p>
            </div>
          )}

          {pendingAccount && (
            <div className="mt-4 rounded-md border border-warning/40 bg-surface p-3">
              <p className="text-sm text-text-primary">
                Google returned{' '}
                <span className="font-medium">{pendingAccount.emailAddress}</span>.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Switching accounts clears this profile’s Drive sync records. Your local
                favorites stay here.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              className="min-h-9 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-60"
              disabled={busy}
              onClick={close}
              type="button"
            >
              Cancel
            </button>
            {candidate ? (
              <button
                autoFocus
                className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                disabled={busy}
                onClick={() => void confirmSignIn()}
                type="button"
              >
                {busy ? 'Connecting…' : 'Confirm'}
              </button>
            ) : pendingAccount ? (
              <button
                className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                disabled={busy}
                onClick={() => void confirmAccountSwitch()}
                type="button"
              >
                {busy ? 'Switching…' : 'Switch account'}
              </button>
            ) : (
              <button
                autoFocus
                className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                disabled={busy || !online}
                onClick={() => void startSignIn()}
                type="button"
              >
                {busy
                  ? 'Connecting…'
                  : driveConnectionStatus === 'authorization-required'
                    ? 'Reconnect Google Drive'
                    : 'Sign in with Google'}
              </button>
            )}
          </div>
        </DialogPanel>
      </div>
    </AnimatedDialog>
  );
}
