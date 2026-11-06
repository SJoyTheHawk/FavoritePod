import { useState, type ReactNode, type RefObject } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface AnimatedDialogProps {
  open: boolean;
  onClose: () => void;
  afterLeave?: () => void;
  initialFocus?: RefObject<HTMLElement>;
  className?: string;
  children: ReactNode;
}

/** Keep conditionally mounted editors alive until their closing transition ends. */
export function useDialogTransition(afterLeave: () => void) {
  const [open, setOpen] = useState(true);
  return { open, afterLeave, close: () => setOpen(false) };
}

export function AnimatedDialog({
  open,
  onClose,
  afterLeave,
  initialFocus,
  className,
  children,
}: AnimatedDialogProps) {
  return (
    <Transition appear show={open} afterLeave={afterLeave}>
      <Dialog className={className} initialFocus={initialFocus} onClose={onClose}>
        {children}
      </Dialog>
    </Transition>
  );
}
