import { prisma } from "./db";

// Single write path for AuditLog (BP-11) — every mutation in lib/claims.ts,
// lib/workflow.ts, and the admin config actions calls this so nothing
// bypasses the audit trail.
export async function writeAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  if (!prisma) return;
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      beforeJson: params.before !== undefined ? JSON.stringify(params.before) : null,
      afterJson: params.after !== undefined ? JSON.stringify(params.after) : null,
    },
  });
}
