"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { userFormSchema } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/constants";
import { errorMessage, type ActionResult } from "@/lib/action-result";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

export async function createUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = userFormSchema.parse({
      employeeId: formData.get("employeeId"),
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
      departmentId: formData.get("departmentId") || undefined,
      divisionId: formData.get("divisionId") || undefined,
      designation: formData.get("designation") || undefined,
      grade: formData.get("grade") || undefined,
      costCenter: formData.get("costCenter") || undefined,
      location: formData.get("location") || undefined,
      managerId: formData.get("managerId") || undefined,
    });
    if (!parsed.password) throw new Error("Password is required when creating a user.");

    const user = await prisma.user.create({
      data: {
        employeeId: parsed.employeeId,
        name: parsed.name,
        email: parsed.email,
        passwordHash: await hashPassword(parsed.password),
        role: parsed.role,
        departmentId: parsed.departmentId || null,
        divisionId: parsed.divisionId || null,
        designation: parsed.designation,
        grade: parsed.grade,
        costCenter: parsed.costCenter,
        location: parsed.location,
        managerId: parsed.managerId || null,
      },
    });

    await writeAudit({
      userId: admin.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      after: { role: user.role, email: user.email },
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function toggleUserStatusAction(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const nextStatus = target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await prisma.user.update({ where: { id: userId }, data: { status: nextStatus } });

    await writeAudit({
      userId: admin.id,
      action: "USER_STATUS_CHANGED",
      entityType: "User",
      entityId: userId,
      before: { status: target.status },
      after: { status: nextStatus },
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
