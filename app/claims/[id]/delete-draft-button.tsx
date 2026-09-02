"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";

// Deleting a draft removes the record entirely, so unlike the other actions
// on this page it navigates back to the claims list on success instead of
// refreshing in place — the current route would 404 on the next fetch.
export function DeleteDraftButton({ action }: { action: () => Promise<ActionResult> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        className="btn-danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this draft? This cannot be undone.")) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (!result.ok) setError(result.error);
            else router.push("/claims");
          });
        }}
      >
        {pending ? "Deleting…" : "Delete draft"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
