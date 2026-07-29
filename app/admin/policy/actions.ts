"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { policyParameterFormSchema } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/constants";
import { runSlaEscalation } from "@/lib/escalation";
import { errorMessage, type ActionResult } from "@/lib/action-result";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

export async function upsertPolicyParameterAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = policyParameterFormSchema.parse({
      key: formData.get("key"),
      value: formData.get("value"),
    });

    await prisma.policyParameter.upsert({
      where: { key: parsed.key },
      create: parsed,
      update: { value: parsed.value },
    });

    await writeAudit({
      userId: admin.id,
      action: "POLICY_PARAMETER_SET",
      entityType: "PolicyParameter",
      entityId: parsed.key,
      after: parsed,
    });
    revalidatePath("/admin/policy");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deletePolicyParameterAction(key: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");
    await prisma.policyParameter.delete({ where: { key } });
    await writeAudit({ userId: admin.id, action: "POLICY_PARAMETER_DELETED", entityType: "PolicyParameter", entityId: key });
    revalidatePath("/admin/policy");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function runSlaEscalationAction(): Promise<ActionResult<{ escalatedCount: number }>> {
  try {
    const admin = await requireAdmin();
    const result = await runSlaEscalation(admin.id);
    revalidatePath("/admin/policy");
    return { ok: true, escalatedCount: result.escalatedCount };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
