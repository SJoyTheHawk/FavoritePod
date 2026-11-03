import { useState } from 'react';
import {
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface FileAccessHintProps {
  settingsUrl: string;
  onDismiss: () => void;
}

export function FileAccessHint({ settingsUrl, onDismiss }: FileAccessHintProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copySettingsUrl = async () => {
    setCopied(false);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(settingsUrl);
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <aside
      aria-label="Local file access required"
      className="mb-5 flex items-start gap-3 rounded-md border border-warning/40 bg-warning-light/40 p-4"
      role="alert"
    >
      <ExclamationTriangleIcon
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 shrink-0 text-warning"
      />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-text-primary">
          File access is turned off
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Enable &quot;Allow access to file URLs&quot; on this extension&apos;s Chrome
          settings page to open and check local files.
        </p>
        <p className="mt-2 break-all font-mono text-xs text-text-tertiary">
          {settingsUrl}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            className="inline-flex min-h-8 items-center gap-1.5 rounded px-1 text-sm font-medium text-primary hover:bg-background/60"
            onClick={() => void copySettingsUrl()}
            type="button"
          >
            <ClipboardDocumentIcon aria-hidden="true" className="h-4 w-4" />
            Copy settings URL
          </button>
          <button
            className="inline-flex min-h-8 items-center gap-1.5 rounded px-1 text-sm text-text-secondary hover:bg-background/60 hover:text-text-primary"
            onClick={onDismiss}
            type="button"
          >
            Dismiss
          </button>
        </div>
        {copyError && (
          <p className="mt-2 text-xs text-danger" role="status">
            Could not copy the settings URL. Select and copy it above.
          </p>
        )}
        {copied && (
          <p className="mt-2 text-xs text-text-secondary" role="status">
            Settings URL copied.
          </p>
        )}
      </div>
    </aside>
  );
}
