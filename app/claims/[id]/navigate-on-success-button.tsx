"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";

// For one-off actions (e.g. "copy as new draft") that take no form fields
// but need to navigate to a newly created record on success.
export function NavigateOnSuccessButton({
  action,
  label,
  className = "btn-secondary",
}: {
  action: () => Promise<ActionResult<{ claimId: string }>>;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (!result.ok) setError(result.error);
            else router.push(`/claims/${result.claimId}`);
          });
        }}
      >
        {pending ? "Working…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
