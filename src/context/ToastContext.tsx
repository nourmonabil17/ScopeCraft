// src/context/ToastContext.tsx
//
// Minimal toast queue. No dependency, no portal — the viewport container is
// rendered once at the end of the provider's tree and positioned with fixed
// CSS, which is enough for a single-page app and avoids the SSR hazards of
// createPortal against a document that doesn't exist yet.
//
// Accessibility: the announcement lives on each toast, not on the container.
// Until Point 5 the container was a single `role="status" aria-live="polite"`
// region wrapping every tone, which meant an error waited for a pause in
// speech. Each toast now carries its own role through the Toast primitive —
// `alert` for an error, `status` otherwise — and the container carries no
// live-region semantics, so those roles are never nested inside a politer
// ancestor. The trade against the older "region must pre-exist" reasoning is
// decision-log entry 36.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** How long a toast stays before auto-dismissing. */
const TOAST_TTL_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  // Tracked so every pending timer can be cleared on unmount — an un-cleared
  // timer firing after unmount is a setState-on-unmounted-component warning.
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((current) => [...current, { id, message, tone }]);

      const timer = setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        timers.current.delete(id);
      }, TOAST_TTL_MS);
      timers.current.set(id, timer);
    },
    []
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
