"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createDelegation, deleteDelegation } from "@/lib/delegation";
import { delegationFormSchema } from "@/lib/validation";
import { errorMessage, type ActionResult } from "@/lib/action-result";

export async function createDelegationAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };

    const parsed = delegationFormSchema.parse({
      delegateId: formData.get("delegateId"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      reason: formData.get("reason") || undefined,
    });

    await createDelegation(user.id, parsed);
    revalidatePath("/delegations");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteDelegationAction(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    await deleteDelegation(id, user.id, user.role);
    revalidatePath("/delegations");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
