"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { approvalStageRuleFormSchema } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/constants";
import { errorMessage, type ActionResult } from "@/lib/action-result";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

export async function createApprovalRuleAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = approvalStageRuleFormSchema.parse({
      claimType: formData.get("claimType"),
      minAmount: formData.get("minAmount") || undefined,
      maxAmount: formData.get("maxAmount") || undefined,
      departmentId: formData.get("departmentId") || undefined,
      divisionId: formData.get("divisionId") || undefined,
      stageOrder: formData.get("stageOrder"),
      requiredRole: formData.get("requiredRole"),
    });

    const rule = await prisma.approvalStageRule.create({
      data: { ...parsed, departmentId: parsed.departmentId || null, divisionId: parsed.divisionId || null },
    });
    await writeAudit({
      userId: admin.id,
      action: "APPROVAL_RULE_CREATED",
      entityType: "ApprovalStageRule",
      entityId: rule.id,
      after: parsed,
    });
    revalidatePath("/admin/approval-matrix");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteApprovalRuleAction(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");
    await prisma.approvalStageRule.delete({ where: { id } });
    await writeAudit({ userId: admin.id, action: "APPROVAL_RULE_DELETED", entityType: "ApprovalStageRule", entityId: id });
    revalidatePath("/admin/approval-matrix");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
