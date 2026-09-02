// src/components/ui/Dialog.tsx
//
// Dialog primitive (owner: Yousef) — Module C.
//
// Native <dialog> with showModal(), not a hand-rolled overlay: focus trapping,
// Escape-to-close, inert background and a real top-layer backdrop all come for
// free, and each one is a thing a div-based modal gets subtly wrong.
//
// Not rendered at all until open, rather than rendered closed and hidden by
// the UA's `dialog:not([open])` rule. A closed dialog's children are still
// real DOM nodes, that rule is not applied by every environment — jsdom does
// not apply it — and content leaking out of a closed modal was a real bug here
// once already.
//
// Controlled: the parent owns `open`. WelcomeModal owns its own state and its
// own seen-flag; that logic stays there and does not belong in a primitive.

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the heading that names this dialog. */
  labelledBy: string;
  children: ReactNode;
}

export function Dialog({ open, onClose, labelledBy, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // showModal() only works once the element exists, which is after the render
  // that `open` turned on — hence an effect rather than a call during render.
  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={labelledBy}
      // The element's own close event, not the button's click: Escape closes a
      // native dialog without any handler of ours running, and a dismissal
      // that goes unrecorded is how a modal comes back after you closed it.
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}
