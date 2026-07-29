"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { divisionFormSchema } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/constants";
import { errorMessage, type ActionResult } from "@/lib/action-result";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

export async function createDivisionAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = divisionFormSchema.parse({
      name: formData.get("name"),
      headUserId: formData.get("headUserId") || undefined,
    });

    const division = await prisma.division.create({
      data: { name: parsed.name, headUserId: parsed.headUserId || null },
    });

    await writeAudit({
      userId: admin.id,
      action: "DIVISION_CREATED",
      entityType: "Division",
      entityId: division.id,
      after: parsed,
    });
    revalidatePath("/admin/divisions");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
