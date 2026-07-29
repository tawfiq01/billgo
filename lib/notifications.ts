import { prisma } from "./db";

// In-app notifications only for Phase 1 — email/SMS gateway integration is
// Phase 3 (see plan doc). Call sites are the same workflow/claims events the
// BRD's notification table lists (submit, return, reject, approve, pay).
export async function notify(params: {
  userId: string;
  type: string;
  message: string;
  claimId?: string | null;
}): Promise<void> {
  if (!prisma) return;
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      message: params.message,
      claimId: params.claimId ?? null,
    },
  });
}
