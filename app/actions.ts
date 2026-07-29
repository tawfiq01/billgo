"use server";

import { redirect } from "next/navigation";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !prisma) return;
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
}
