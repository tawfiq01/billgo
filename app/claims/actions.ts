"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  addAttachment,
  cancelClaim,
  copyClaimAsDraft,
  createDraftClaim,
  deleteAttachment,
  deleteDraftClaim,
  deleteDraftClaims,
  recordPayment,
  reopenClaim,
  resubmitClaim,
  submitClaim,
  updateDraftClaim,
  withdrawClaim,
} from "@/lib/claims";
import { actOnApprovalStep } from "@/lib/workflow";
import { approvalActionSchema, newClaimSchema, paymentSchema } from "@/lib/validation";
import { errorMessage, type ActionResult } from "@/lib/action-result";
import { ADMIN_ROLES } from "@/lib/constants";

export async function createDraftClaimAction(input: unknown): Promise<ActionResult<{ claimId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    const parsed = newClaimSchema.parse(input);
    if (!parsed.projectId) return { ok: false, error: "Project is required." };
    const claim = await createDraftClaim(user.id, parsed);
    revalidatePath("/claims");
    return { ok: true, claimId: claim.id };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateDraftClaimAction(
  claimId: string,
  input: unknown,
): Promise<ActionResult<{ claimId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    const parsed = newClaimSchema.parse(input);
    if (!parsed.projectId) return { ok: false, error: "Project is required." };
    await updateDraftClaim(claimId, user.id, parsed);
    revalidatePath(`/claims/${claimId}`);
    return { ok: true, claimId };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function resubmitClaimAction(
  claimId: string,
  input: unknown,
): Promise<ActionResult<{ claimId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    const parsed = newClaimSchema.parse(input);
    if (!parsed.projectId) return { ok: false, error: "Project is required." };
    await resubmitClaim(claimId, user.id, parsed);
    revalidatePath(`/claims/${claimId}`);
    return { ok: true, claimId };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function submitClaimAction(claimId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    await submitClaim(claimId, user.id);
    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/claims");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteClaimAction(claimId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    await deleteDraftClaim(claimId, user.id);
    revalidatePath("/claims");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteClaimsAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    const ids = formData.getAll("ids").map(String).filter(Boolean);
    if (ids.length === 0) return { ok: false, error: "Select at least one draft to delete." };
    const { deleted } = await deleteDraftClaims(ids, user.id);
    if (deleted === 0) return { ok: false, error: "Could not delete the selected drafts." };
    revalidatePath("/claims");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function withdrawClaimAction(claimId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    await withdrawClaim(claimId, user.id);
    revalidatePath(`/claims/${claimId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function cancelClaimAction(claimId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    // Server-side check — the page only hides this form from other roles,
    // it doesn't stop a direct call to this action.
    if (!ADMIN_ROLES.includes(user.role) && user.role !== "FINANCE") {
      return { ok: false, error: "Only Finance or an Administrator can cancel a claim." };
    }
    const reason = String(formData.get("reason") ?? "");
    await cancelClaim(claimId, user.id, reason);
    revalidatePath(`/claims/${claimId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function reopenClaimAction(claimId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    if (!ADMIN_ROLES.includes(user.role) && user.role !== "FINANCE") {
      return { ok: false, error: "Only Finance or an Administrator can reopen a claim." };
    }
    const reason = String(formData.get("reason") ?? "");
    await reopenClaim(claimId, user.id, reason);
    revalidatePath(`/claims/${claimId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function copyClaimAction(claimId: string): Promise<ActionResult<{ claimId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    const copy = await copyClaimAsDraft(claimId, user.id);
    revalidatePath("/claims");
    return { ok: true, claimId: copy.id };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function uploadAttachmentAction(claimId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a file to upload." };
    }
    await addAttachment(claimId, user.id, file);
    revalidatePath(`/claims/${claimId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteAttachmentAction(attachmentId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    const { claimId } = await deleteAttachment(attachmentId, user.id);
    revalidatePath(`/claims/${claimId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function approvalActionOnStep(stepId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    const parsed = approvalActionSchema.parse({
      action: formData.get("action"),
      comments: formData.get("comments") ?? undefined,
      financeAdjustedAmount: formData.get("financeAdjustedAmount") || undefined,
    });
    const step = await prisma?.approvalStep.findUnique({ where: { id: stepId }, select: { claimId: true } });
    await actOnApprovalStep({
      stepId,
      actingUserId: user.id,
      action: parsed.action,
      comments: parsed.comments,
      financeAdjustedAmount: parsed.financeAdjustedAmount,
    });
    revalidatePath("/approvals");
    if (step) revalidatePath(`/claims/${step.claimId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function recordPaymentAction(claimId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    if (!ADMIN_ROLES.includes(user.role) && user.role !== "PAYMENT_PROCESSOR") {
      return { ok: false, error: "Only the Payment Processor or an Administrator can record a payment." };
    }
    const parsed = paymentSchema.parse({
      method: formData.get("method"),
      reference: formData.get("reference") ?? undefined,
      batch: formData.get("batch") ?? undefined,
      amount: formData.get("amount"),
    });
    await recordPayment({ claimId, recordedById: user.id, ...parsed });
    revalidatePath(`/claims/${claimId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
