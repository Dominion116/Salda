"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "./button";
import type { ButtonSize, ButtonVariant } from "./button-class";
import { CheckIcon } from "./icons";

/**
 * A native modal dialog: Escape closes it and focus returns to the trigger.
 * The content is a form, so Enter confirms. Return false from onConfirm to keep it open.
 */
export function ConfirmDialog({
  trigger,
  triggerVariant,
  triggerSize,
  title,
  description,
  confirm,
  confirmVariant = "primary",
  onConfirm,
  onOpen,
  children,
}: {
  trigger: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  title: string;
  description: string;
  /** Repeat the consequence: "Sign and pay 2.00 tUSD8", never "OK". */
  confirm: string;
  confirmVariant?: ButtonVariant;
  onConfirm?: () => void | boolean | Promise<void | boolean>;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if ((await onConfirm?.()) !== false) dialog.current?.close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        onClick={() => {
          onOpen?.();
          dialog.current?.showModal();
        }}
      >
        {trigger}
      </Button>
      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClick={(event) => {
          if (event.target !== event.currentTarget || busy) return;
          const box = event.currentTarget.getBoundingClientRect();
          const inside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
          if (!inside) event.currentTarget.close();
        }}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 id={`${id}-title`} className="text-title text-ink-strong">
              {title}
            </h2>
            <p id={`${id}-description`} className="text-body-sm text-ink-subtle">
              {description}
            </p>
          </div>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button size="lg" onClick={() => dialog.current?.close()}>
              Cancel
            </Button>
            <Button size="lg" type="submit" variant={confirmVariant} icon={<CheckIcon />} loading={busy}>
              {confirm}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
