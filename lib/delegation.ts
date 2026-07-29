import { prisma } from "./db";
import { writeAudit } from "./audit";
import { notify } from "./notifications";
import { ADMIN_ROLES, type Role } from "./constants";

export class DelegationError extends Error {}

export type DelegationInput = {
  delegateId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
};

// FR-018/BR-19: delegate approval authority to another user for a bounded
// period. Resolution against pending/new approval steps happens in
// lib/workflow.ts, not here — this module is just CRUD + validation.
export async function createDelegation(delegatorId: string, input: DelegationInput) {
  if (!prisma) throw new DelegationError("Database not configured");
  if (input.delegateId === delegatorId) {
    throw new DelegationError("You cannot delegate to yourself.");
  }

  const delegator = await prisma.user.findUniqueOrThrow({ where: { id: delegatorId } });
  const delegation = await prisma.delegation.create({
    data: {
      delegatorId,
      delegateId: input.delegateId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
    },
  });

  const reasonSuffix = input.reason ? ` (${input.reason})` : "";
  await notify({
    userId: input.delegateId,
    type: "DELEGATION_RECEIVED",
    message: `${delegator.name} delegated their approval authority to you from ${input.startDate.toDateString()} to ${input.endDate.toDateString()}${reasonSuffix}.`,
  });
  await writeAudit({
    userId: delegatorId,
    action: "DELEGATION_CREATED",
    entityType: "Delegation",
    entityId: delegation.id,
    after: { delegateId: input.delegateId, startDate: input.startDate, endDate: input.endDate },
  });

  return delegation;
}

export async function deleteDelegation(id: string, actingUserId: string, actingUserRole: Role): Promise<void> {
  if (!prisma) throw new DelegationError("Database not configured");
  const delegation = await prisma.delegation.findUniqueOrThrow({ where: { id } });
  if (delegation.delegatorId !== actingUserId && !ADMIN_ROLES.includes(actingUserRole)) {
    throw new DelegationError("You can only revoke your own delegations.");
  }

  await prisma.delegation.delete({ where: { id } });
  await writeAudit({
    userId: actingUserId,
    action: "DELEGATION_REVOKED",
    entityType: "Delegation",
    entityId: id,
  });
}

// The active delegate for a given approver on a given date, if any. Ties
// (more than one overlapping delegation) resolve to the most recently
// created one — an edge case admins should avoid via revoking the old one.
export async function findActiveDelegate(delegatorId: string, onDate: Date): Promise<string | null> {
  if (!prisma) return null;
  const delegation = await prisma.delegation.findFirst({
    where: { delegatorId, startDate: { lte: onDate }, endDate: { gte: onDate } },
    orderBy: { createdAt: "desc" },
  });
  return delegation?.delegateId ?? null;
}
