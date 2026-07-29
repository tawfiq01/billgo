"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { departmentFormSchema } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/constants";
import { errorMessage, type ActionResult } from "@/lib/action-result";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

export async function createDepartmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = departmentFormSchema.parse({
      name: formData.get("name"),
      headUserId: formData.get("headUserId") || undefined,
    });

    const dept = await prisma.department.create({
      data: { name: parsed.name, headUserId: parsed.headUserId || null },
    });

    await writeAudit({ userId: admin.id, action: "DEPARTMENT_CREATED", entityType: "Department", entityId: dept.id, after: parsed });
    revalidatePath("/admin/departments");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
