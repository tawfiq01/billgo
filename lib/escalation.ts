import { prisma } from "./db";
import { notify } from "./notifications";
import { writeAudit } from "./audit";
import { getPolicyNumber } from "./calculations";

const DEFAULT_APPROVAL_SLA_DAYS = 3;

export async function getApprovalSlaDays(): Promise<number> {
  return getPolicyNumber("APPROVAL_SLA_DAYS", DEFAULT_APPROVAL_SLA_DAYS);
}

// Count of PENDING steps past the SLA that haven't been escalated yet —
// pulled out of the admin page component so the Date.now() math doesn't run
// directly in a component's render body (impure-during-render lint rule).
export async function getOverdueApprovalCount(): Promise<number> {
  if (!prisma) return 0;
  const slaDays = await getApprovalSlaDays();
  const cutoff = new Date(Date.now() - slaDays * 24 * 60 * 60 * 1000);
  return prisma.approvalStep.count({ where: { status: "PENDING", escalatedAt: null, createdAt: { lt: cutoff } } });
}

// FR-019/BP-12: claims pending past the configured SLA get a reminder to
// their approver and an escalation notice to the approver's manager. There's
// no background job runner in Phase 1 (that's Phase 3/4 infra), so this is
// triggered manually by an administrator from /admin/policy — in production
// the same function would be called from a scheduled job on the same cadence.
export async function runSlaEscalation(actingUserId: string): Promise<{ escalatedCount: number }> {
  if (!prisma) return { escalatedCount: 0 };
  const slaDays = await getApprovalSlaDays();
  const cutoff = new Date(Date.now() - slaDays * 24 * 60 * 60 * 1000);

  const overdueSteps = await prisma.approvalStep.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff }, escalatedAt: null },
    include: { claim: true, approver: { include: { manager: true } } },
  });

  for (const step of overdueSteps) {
    if (!step.approver) continue;

    await notify({
      userId: step.approver.id,
      type: "APPROVAL_OVERDUE_REMINDER",
      message: `Claim ${step.claim.claimNumber ?? step.claim.id} has been awaiting your approval for over ${slaDays} day(s).`,
      claimId: step.claimId,
    });

    if (step.approver.managerId) {
      await notify({
        userId: step.approver.managerId,
        type: "APPROVAL_ESCALATED",
        message: `Claim ${step.claim.claimNumber ?? step.claim.id} has been pending with ${step.approver.name} for over ${slaDays} day(s) and needs attention.`,
        claimId: step.claimId,
      });
    }

    await prisma.approvalStep.update({ where: { id: step.id }, data: { escalatedAt: new Date() } });
  }

  await writeAudit({
    userId: actingUserId,
    action: "SLA_ESCALATION_RUN",
    entityType: "ApprovalStep",
    after: { slaDays, escalatedCount: overdueSteps.length },
  });

  return { escalatedCount: overdueSteps.length };
}
