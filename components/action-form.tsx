"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

// Generic client wrapper for one-click / small forms (approve, withdraw,
// cancel, upload, record payment) whose Server Action returns ActionResult
// instead of throwing — so a business-rule rejection shows inline instead of
// crashing to the route's error boundary.
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        // Pass the submitter so forms with multiple same-name submit buttons
        // (e.g. Approve/Return/Reject) include the clicked button's value —
        // preventDefault() suppresses the native submit that would do this
        // automatically.
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const formData = new FormData(e.currentTarget, submitter ?? undefined);
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error);
          } else {
            onSuccess?.();
          }
        });
      }}
    >
      {children}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {pending && <p className="mt-2 text-xs text-muted">Working…</p>}
    </form>
  );
}
