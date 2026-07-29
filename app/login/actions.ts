"use server";

import { redirect } from "next/navigation";
import { createSession, verifyCredentials } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { loginSchema } from "@/lib/validation";

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);
  await writeAudit({ userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
}
