"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { allowanceRateFormSchema, foodAllowanceRateFormSchema, holidayRateFormSchema } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/constants";
import { errorMessage, type ActionResult } from "@/lib/action-result";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

export async function createAllowanceRateAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = allowanceRateFormSchema.parse({
      grade: formData.get("grade"),
      locationCategory: formData.get("locationCategory"),
      dailyRate: formData.get("dailyRate"),
      effectiveFrom: formData.get("effectiveFrom"),
      effectiveTo: formData.get("effectiveTo") || undefined,
    });

    const rate = await prisma.allowanceRate.create({ data: parsed });
    await writeAudit({ userId: admin.id, action: "ALLOWANCE_RATE_CREATED", entityType: "AllowanceRate", entityId: rate.id, after: parsed });
    revalidatePath("/admin/rates");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteAllowanceRateAction(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");
    await prisma.allowanceRate.delete({ where: { id } });
    await writeAudit({ userId: admin.id, action: "ALLOWANCE_RATE_DELETED", entityType: "AllowanceRate", entityId: id });
    revalidatePath("/admin/rates");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createFoodAllowanceRateAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = foodAllowanceRateFormSchema.parse({
      grade: formData.get("grade"),
      locationCategory: formData.get("locationCategory"),
      dailyRate: formData.get("dailyRate"),
      effectiveFrom: formData.get("effectiveFrom"),
      effectiveTo: formData.get("effectiveTo") || undefined,
    });

    const rate = await prisma.foodAllowanceRate.create({ data: parsed });
    await writeAudit({
      userId: admin.id,
      action: "FOOD_ALLOWANCE_RATE_CREATED",
      entityType: "FoodAllowanceRate",
      entityId: rate.id,
      after: parsed,
    });
    revalidatePath("/admin/rates");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteFoodAllowanceRateAction(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");
    await prisma.foodAllowanceRate.delete({ where: { id } });
    await writeAudit({
      userId: admin.id,
      action: "FOOD_ALLOWANCE_RATE_DELETED",
      entityType: "FoodAllowanceRate",
      entityId: id,
    });
    revalidatePath("/admin/rates");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createHolidayRateAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");

    const parsed = holidayRateFormSchema.parse({
      grade: formData.get("grade") || undefined,
      rate: formData.get("rate"),
      multiplier: formData.get("multiplier") || undefined,
      effectiveFrom: formData.get("effectiveFrom"),
      effectiveTo: formData.get("effectiveTo") || undefined,
    });

    const rate = await prisma.holidayRate.create({ data: { ...parsed, grade: parsed.grade || null } });
    await writeAudit({ userId: admin.id, action: "HOLIDAY_RATE_CREATED", entityType: "HolidayRate", entityId: rate.id, after: parsed });
    revalidatePath("/admin/rates");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteHolidayRateAction(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (!prisma) throw new Error("Database not configured.");
    await prisma.holidayRate.delete({ where: { id } });
    await writeAudit({ userId: admin.id, action: "HOLIDAY_RATE_DELETED", entityType: "HolidayRate", entityId: id });
    revalidatePath("/admin/rates");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
