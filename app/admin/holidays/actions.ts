"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { holidayFormSchema } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/constants";
import { errorMessage, type ActionResult } from "@/lib/action-result";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

export async function createHolidayAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = holidayFormSchema.parse({
      date: formData.get("date"),
      name: formData.get("name"),
      type: formData.get("type"),
    });

    const entry = await prisma.holidayCalendarEntry.create({ data: parsed });
    await writeAudit({
      userId: admin.id,
      action: "HOLIDAY_CREATED",
      entityType: "HolidayCalendarEntry",
      entityId: entry.id,
      after: parsed,
    });
    revalidatePath("/admin/holidays");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    await prisma.holidayCalendarEntry.delete({ where: { id } });
    await writeAudit({ userId: admin.id, action: "HOLIDAY_DELETED", entityType: "HolidayCalendarEntry", entityId: id });
    revalidatePath("/admin/holidays");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
