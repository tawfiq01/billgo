"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { projectFormSchema } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/constants";
import { errorMessage, type ActionResult } from "@/lib/action-result";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = projectFormSchema.parse({
      name: formData.get("name"),
      code: formData.get("code") || undefined,
      projectManagerId: formData.get("projectManagerId"),
    });

    const project = await prisma.project.create({
      data: { name: parsed.name, code: parsed.code || null, projectManagerId: parsed.projectManagerId },
    });

    await writeAudit({
      userId: admin.id,
      action: "PROJECT_CREATED",
      entityType: "Project",
      entityId: project.id,
      after: parsed,
    });
    revalidatePath("/admin/projects");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function toggleProjectStatusAction(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const target = await prisma.project.findUniqueOrThrow({ where: { id } });
    const nextStatus = target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await prisma.project.update({ where: { id }, data: { status: nextStatus } });

    await writeAudit({
      userId: admin.id,
      action: "PROJECT_STATUS_CHANGED",
      entityType: "Project",
      entityId: id,
      before: { status: target.status },
      after: { status: nextStatus },
    });
    revalidatePath("/admin/projects");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
