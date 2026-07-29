"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { bulkApproveSteps } from "@/lib/workflow";
import { errorMessage, type ActionResult } from "@/lib/action-result";

export async function bulkApproveAction(
  formData: FormData,
): Promise<ActionResult<{ approvedCount: number; failedCount: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };

    const stepIds = formData.getAll("stepIds").map(String).filter(Boolean);
    if (stepIds.length === 0) {
      return { ok: false, error: "Select at least one claim to bulk approve." };
    }

    const result = await bulkApproveSteps(stepIds, user.id);
    revalidatePath("/approvals");

    if (result.approved.length === 0) {
      return { ok: false, error: result.failed[0]?.error ?? "None of the selected claims could be bulk approved." };
    }
    return { ok: true, approvedCount: result.approved.length, failedCount: result.failed.length };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
