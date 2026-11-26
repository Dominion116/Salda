"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, CloseIcon } from "./icons";

type Toast = { id: number; tone: "success" | "error"; message: string };
type ShowToast = (toast: Omit<Toast, "id">) => void;

const LIFETIME_MS = 5000;
const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((toast) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-(--z-toast) flex flex-col items-center gap-2 pb-[env(safe-area-inset-bottom)] sm:start-auto sm:items-end">
        <div role="status" className="flex flex-col items-center gap-2 sm:items-end">
          {toasts.map((toast) =>
            toast.tone === "success" ? <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} /> : null,
          )}
        </div>
        <div role="alert" className="flex flex-col items-center gap-2 sm:items-end">
          {toasts.map((toast) =>
            toast.tone === "error" ? <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} /> : null,
          )}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

/** Success closes itself after 5s unless hovered, focused or in a hidden tab. Errors stay. */
function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (toast.tone === "error" || held) return;
    let timer: number | undefined;
    const start = () => {
      window.clearTimeout(timer);
      if (!document.hidden) timer = window.setTimeout(() => onDismiss(toast.id), LIFETIME_MS);
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [toast.id, toast.tone, held, onDismiss]);

  return (
    <div
      className="toast-enter pointer-events-auto flex max-w-[360px] items-center gap-3 rounded-lg bg-inverse py-2 ps-4 pe-2 text-body-sm text-on-inverse"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {toast.tone === "success" ? <CheckIcon className="shrink-0" /> : <AlertIcon className="shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="hit-44 inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-inverse-hover focus-visible:outline-on-inverse"
        onClick={() => onDismiss(toast.id)}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
