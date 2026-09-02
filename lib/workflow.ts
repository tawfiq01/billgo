import { prisma } from "./db";
import { writeAudit } from "./audit";
import { notify } from "./notifications";
import { findActiveDelegate } from "./delegation";
import { getPolicyNumber } from "./calculations";
import { OPTIONAL_STAGE_ROLES, STAGE_ROLE_TO_STATUS, type StageRole } from "./constants";

const DEFAULT_BULK_APPROVE_MAX_AMOUNT = 5000;

// BR-19: if the resolved approver has an active Delegation on this date,
// the delegate takes over the step; delegatedFromId keeps the original
// approver visible in the approval history.
async function applyDelegation(
  baseApproverId: string,
  onDate: Date,
): Promise<{ approverId: string; delegatedFromId: string | null }> {
  const delegateId = await findActiveDelegate(baseApproverId, onDate);
  return delegateId ? { approverId: delegateId, delegatedFromId: baseApproverId } : { approverId: baseApproverId, delegatedFromId: null };
}

export class WorkflowError extends Error {}

// A claim reaching APPROVED is only ever notified to the claimant today —
// nothing tells the Payment Processor a claim is now waiting on them, so it
// only surfaces if they happen to browse All Claims and filter by status.
export async function notifyPaymentProcessors(claimId: string, claimNumber: string | null): Promise<void> {
  if (!prisma) return;
  const processors = await prisma.user.findMany({ where: { role: "PAYMENT_PROCESSOR", status: "ACTIVE" } });
  await Promise.all(
    processors.map((p) =>
      notify({
        userId: p.id,
        type: "CLAIM_READY_FOR_PAYMENT",
        message: `Claim ${claimNumber ?? claimId} is fully approved and ready for payment.`,
        claimId,
      }),
    ),
  );
}

type ApproverContext = {
  employee: { managerId: string | null; departmentId: string | null; divisionId: string | null };
  projectId: string | null;
};

type ResolveResult =
  | { kind: "resolved"; approverId: string }
  // The stage's dimension doesn't apply to this claim (no division / no
  // linked project) — routed around, not an error (only for OPTIONAL_STAGE_ROLES).
  | { kind: "skip" }
  // The dimension applies but resolution failed — a real misconfiguration.
  | { kind: "error"; message: string };

// Resolution strategy per stage type. MANAGER/DEPT_HEAD/DIVISION_HEAD/
// PROJECT_MANAGER walk a relationship (employee's manager, employee's
// department/division head, the claim's project manager) so *any* user can
// fill them. FINANCE/FINAL_APPROVER instead look up whoever holds that Role.
async function resolveApprover(requiredRole: StageRole, ctx: ApproverContext): Promise<ResolveResult> {
  if (!prisma) return { kind: "error", message: "Database not configured" };

  if (requiredRole === "MANAGER") {
    return ctx.employee.managerId
      ? { kind: "resolved", approverId: ctx.employee.managerId }
      : { kind: "error", message: "the employee has no reporting manager configured" };
  }

  if (requiredRole === "DEPT_HEAD") {
    if (!ctx.employee.departmentId) return { kind: "error", message: "the employee has no department configured" };
    const dept = await prisma.department.findUnique({ where: { id: ctx.employee.departmentId } });
    return dept?.headUserId
      ? { kind: "resolved", approverId: dept.headUserId }
      : { kind: "error", message: `department "${dept?.name ?? ctx.employee.departmentId}" has no head configured` };
  }

  if (requiredRole === "DIVISION_HEAD") {
    if (!ctx.employee.divisionId) return { kind: "skip" };
    const division = await prisma.division.findUnique({ where: { id: ctx.employee.divisionId } });
    return division?.headUserId
      ? { kind: "resolved", approverId: division.headUserId }
      : { kind: "error", message: `division "${division?.name ?? ctx.employee.divisionId}" has no head configured` };
  }

  if (requiredRole === "PROJECT_MANAGER") {
    if (!ctx.projectId) return { kind: "skip" };
    const project = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    return project?.projectManagerId
      ? { kind: "resolved", approverId: project.projectManagerId }
      : { kind: "error", message: `project "${project?.name ?? ctx.projectId}" has no project manager configured` };
  }

  // FINANCE / FINAL_APPROVER: first active user holding that role (Phase 1 —
  // no per-department finance queues or delegation yet).
  const approver = await prisma.user.findFirst({
    where: { role: requiredRole, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  return approver
    ? { kind: "resolved", approverId: approver.id }
    : { kind: "error", message: `no active user holds the ${requiredRole} role` };
}

// Materializes the claim's approval path (FR-028/BR-10) at submission time so
// tracking/history (FR-023) is a plain query rather than reconstructed logic.
export async function buildApprovalSteps(claimId: string, actingUserId: string): Promise<void> {
  if (!prisma) throw new WorkflowError("Database not configured");

  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { employee: true },
  });

  const rules = await prisma.approvalStageRule.findMany({
    where: {
      claimType: { in: [claim.claimType, "ANY"] },
      minAmount: { lte: claim.totalClaimed },
      OR: [{ maxAmount: null }, { maxAmount: { gte: claim.totalClaimed } }],
    },
    orderBy: { stageOrder: "asc" },
  });

  // Keep the most specific rule per stageOrder — prefer a department/division
  // match over an "applies to any" rule (more scope filters matched wins).
  const specificity = (r: (typeof rules)[number]) => (r.departmentId ? 1 : 0) + (r.divisionId ? 1 : 0);
  const byStage = new Map<number, (typeof rules)[number]>();
  for (const rule of rules) {
    if (rule.departmentId && rule.departmentId !== claim.employee.departmentId) continue;
    if (rule.divisionId && rule.divisionId !== claim.employee.divisionId) continue;
    const existing = byStage.get(rule.stageOrder);
    if (!existing || specificity(rule) > specificity(existing)) {
      byStage.set(rule.stageOrder, rule);
    }
  }

  const orderedStages = [...byStage.values()].sort((a, b) => a.stageOrder - b.stageOrder);
  if (orderedStages.length === 0) {
    throw new WorkflowError(
      "No approval matrix rule matches this claim's type/amount/department/division — ask an administrator to configure one.",
    );
  }

  const ctx: ApproverContext = { employee: claim.employee, projectId: claim.projectId };
  const now = new Date();
  const steps: {
    stageOrder: number;
    requiredRole: StageRole;
    approverId: string | null;
    delegatedFromId: string | null;
    status: "PENDING" | "SKIPPED";
  }[] = [];
  for (const stage of orderedStages) {
    const requiredRole = stage.requiredRole as StageRole;
    const result = await resolveApprover(requiredRole, ctx);
    if (result.kind === "resolved") {
      const { approverId, delegatedFromId } = await applyDelegation(result.approverId, now);
      steps.push({ stageOrder: stage.stageOrder, requiredRole, approverId, delegatedFromId, status: "PENDING" });
    } else if (result.kind === "skip" && OPTIONAL_STAGE_ROLES.includes(requiredRole)) {
      steps.push({ stageOrder: stage.stageOrder, requiredRole, approverId: null, delegatedFromId: null, status: "SKIPPED" });
    } else {
      const reason = result.kind === "error" ? result.message : "this stage does not apply to the claim";
      throw new WorkflowError(`Cannot route the ${requiredRole} stage: ${reason}.`);
    }
  }

  await prisma.approvalStep.createMany({ data: steps.map((s) => ({ claimId, ...s })) });

  const firstActive = steps.find((s) => s.status === "PENDING");
  if (firstActive) {
    await prisma.claim.update({
      where: { id: claimId },
      data: { currentStageOrder: firstActive.stageOrder, status: STAGE_ROLE_TO_STATUS[firstActive.requiredRole] },
    });
    await notify({
      userId: firstActive.approverId!,
      type: "CLAIM_PENDING_APPROVAL",
      message: `Claim ${claim.claimNumber ?? claim.id} is awaiting your approval.`,
      claimId,
    });
  } else {
    // Every configured stage for this claim was an optional dimension that
    // didn't apply (e.g. only a PROJECT_MANAGER stage matched, but the claim
    // isn't linked to a project) — nothing left to approve.
    const approvedAmount = claim.totalEligible;
    await prisma.claim.update({
      where: { id: claimId },
      data: {
        status: "APPROVED",
        totalApproved: approvedAmount,
        payableAmount: Math.max(approvedAmount - claim.advanceAmount, 0),
      },
    });
    await notify({
      userId: claim.employeeId,
      type: "CLAIM_APPROVED",
      message: `Your claim ${claim.claimNumber ?? claim.id} has been auto-approved (no applicable approval stages) and is ready for payment.`,
      claimId,
    });
    await notifyPaymentProcessors(claimId, claim.claimNumber);
  }

  await writeAudit({
    userId: actingUserId,
    action: "WORKFLOW_STEPS_CREATED",
    entityType: "Claim",
    entityId: claimId,
    after: steps,
  });
}

export type ApprovalActionInput = {
  stepId: string;
  actingUserId: string;
  action: "APPROVE" | "RETURN" | "REJECT";
  comments?: string;
  financeAdjustedAmount?: number;
};

// Approve/return/reject a claim at its current stage (FR-016). Returning
// creates a fresh PENDING step for the same stage on resubmission (see
// resubmitClaim in lib/claims.ts) so the RETURNED row stays in history
// instead of being overwritten (BR-12).
export async function actOnApprovalStep(input: ApprovalActionInput): Promise<void> {
  if (!prisma) throw new WorkflowError("Database not configured");

  const step = await prisma.approvalStep.findUniqueOrThrow({
    where: { id: input.stepId },
    include: { claim: true },
  });

  if (step.status !== "PENDING") {
    throw new WorkflowError("This approval step has already been actioned.");
  }
  if (step.claim.currentStageOrder !== step.stageOrder) {
    throw new WorkflowError("This claim is no longer at this approval stage.");
  }
  if (step.approverId !== input.actingUserId) {
    throw new WorkflowError("You are not the assigned approver for this step.");
  }
  if ((input.action === "RETURN" || input.action === "REJECT") && !input.comments?.trim()) {
    throw new WorkflowError("Comments are required when returning or rejecting a claim.");
  }

  const before = { stepStatus: step.status, claimStatus: step.claim.status };

  if (input.action === "APPROVE") {
    await prisma.approvalStep.update({
      where: { id: step.id },
      data: { status: "APPROVED", comments: input.comments, actedAt: new Date() },
    });

    // Finance may adjust the approved amount at their stage (FR-020, BR-14/BR-15).
    if (step.requiredRole === "FINANCE" && input.financeAdjustedAmount !== undefined) {
      await prisma.claim.update({
        where: { id: step.claim.id },
        data: {
          totalApproved: input.financeAdjustedAmount,
          financeNotes: input.comments ?? step.claim.financeNotes,
        },
      });
    }

    // Skip over any SKIPPED stages (optional dimensions that didn't apply).
    const nextStep = await prisma.approvalStep.findFirst({
      where: { claimId: step.claim.id, stageOrder: { gt: step.stageOrder }, status: "PENDING" },
      orderBy: { stageOrder: "asc" },
    });

    if (nextStep) {
      await prisma.claim.update({
        where: { id: step.claim.id },
        data: {
          currentStageOrder: nextStep.stageOrder,
          status: STAGE_ROLE_TO_STATUS[nextStep.requiredRole as StageRole],
        },
      });
      await notify({
        userId: nextStep.approverId!,
        type: "CLAIM_PENDING_APPROVAL",
        message: `Claim ${step.claim.claimNumber ?? step.claim.id} is awaiting your approval.`,
        claimId: step.claim.id,
      });
    } else {
      const current = await prisma.claim.findUniqueOrThrow({ where: { id: step.claim.id } });
      const approvedAmount = current.totalApproved || current.totalEligible;
      const payable = Math.max(approvedAmount - current.advanceAmount, 0);
      await prisma.claim.update({
        where: { id: step.claim.id },
        data: { status: "APPROVED", totalApproved: approvedAmount, payableAmount: payable },
      });
      await notify({
        userId: step.claim.employeeId,
        type: "CLAIM_APPROVED",
        message: `Your claim ${step.claim.claimNumber ?? step.claim.id} has been fully approved and is ready for payment.`,
        claimId: step.claim.id,
      });
      await notifyPaymentProcessors(step.claim.id, step.claim.claimNumber);
    }
  } else if (input.action === "RETURN") {
    await prisma.approvalStep.update({
      where: { id: step.id },
      data: { status: "RETURNED", comments: input.comments, actedAt: new Date() },
    });
    await prisma.claim.update({ where: { id: step.claim.id }, data: { status: "RETURNED" } });
    await notify({
      userId: step.claim.employeeId,
      type: "CLAIM_RETURNED",
      message: `Your claim ${step.claim.claimNumber ?? step.claim.id} was returned: ${input.comments}`,
      claimId: step.claim.id,
    });
  } else {
    await prisma.approvalStep.update({
      where: { id: step.id },
      data: { status: "REJECTED", comments: input.comments, actedAt: new Date() },
    });
    await prisma.claim.update({ where: { id: step.claim.id }, data: { status: "REJECTED" } });
    await notify({
      userId: step.claim.employeeId,
      type: "CLAIM_REJECTED",
      message: `Your claim ${step.claim.claimNumber ?? step.claim.id} was rejected: ${input.comments}`,
      claimId: step.claim.id,
    });
  }

  const after = await prisma.approvalStep.findUniqueOrThrow({ where: { id: step.id }, include: { claim: true } });
  await writeAudit({
    userId: input.actingUserId,
    action: `APPROVAL_${input.action}`,
    entityType: "ApprovalStep",
    entityId: step.id,
    before,
    after: { stepStatus: after.status, claimStatus: after.claim.status },
  });
}

// Re-opens the currently active stage after the employee edits a RETURNED
// claim, as a new step row so the original RETURNED entry stays in history.
export async function reopenCurrentStage(claimId: string, actingUserId: string): Promise<void> {
  if (!prisma) throw new WorkflowError("Database not configured");

  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId }, include: { employee: true } });
  const lastStep = await prisma.approvalStep.findFirst({
    where: { claimId, stageOrder: claim.currentStageOrder },
    orderBy: { createdAt: "desc" },
  });
  if (!lastStep) throw new WorkflowError("No approval step found for the current stage.");

  const requiredRole = lastStep.requiredRole as StageRole;
  const result = await resolveApprover(requiredRole, { employee: claim.employee, projectId: claim.projectId });
  if (result.kind !== "resolved") {
    const reason = result.kind === "error" ? result.message : "this stage no longer applies to the claim";
    throw new WorkflowError(`Cannot route the ${requiredRole} stage: ${reason}.`);
  }
  const { approverId, delegatedFromId } = await applyDelegation(result.approverId, new Date());

  await prisma.approvalStep.create({
    data: {
      claimId,
      stageOrder: lastStep.stageOrder,
      requiredRole: lastStep.requiredRole,
      approverId,
      delegatedFromId,
      status: "PENDING",
    },
  });
  await prisma.claim.update({
    where: { id: claimId },
    data: { status: STAGE_ROLE_TO_STATUS[requiredRole] },
  });

  await notify({
    userId: approverId,
    type: "CLAIM_RESUBMITTED",
    message: `Claim ${claim.claimNumber ?? claim.id} was resubmitted and is awaiting your approval.`,
    claimId,
  });
  await writeAudit({ userId: actingUserId, action: "CLAIM_RESUBMITTED", entityType: "Claim", entityId: claimId });
}

export async function getBulkApproveThreshold(): Promise<number> {
  return getPolicyNumber("BULK_APPROVE_MAX_AMOUNT", DEFAULT_BULK_APPROVE_MAX_AMOUNT);
}

export type BulkApproveResult = {
  approved: string[];
  failed: { stepId: string; error: string }[];
};

// FR-017: bulk approval for "eligible low-risk claims" — re-checks the
// amount threshold per step server-side (not just trusting which
// checkboxes the client sent) and still runs every claim through the
// ordinary single-step approval path, so nothing about audit/notification/
// next-stage-routing is special-cased for the bulk case.
export async function bulkApproveSteps(stepIds: string[], actingUserId: string): Promise<BulkApproveResult> {
  if (!prisma) throw new WorkflowError("Database not configured");
  const threshold = await getBulkApproveThreshold();

  const result: BulkApproveResult = { approved: [], failed: [] };
  for (const stepId of stepIds) {
    try {
      const step = await prisma.approvalStep.findUniqueOrThrow({ where: { id: stepId }, include: { claim: true } });
      if (step.claim.totalClaimed > threshold) {
        throw new WorkflowError(
          `Above the bulk-approve limit (${threshold}) — review individually.`,
        );
      }
      await actOnApprovalStep({ stepId, actingUserId, action: "APPROVE", comments: "Bulk approved." });
      result.approved.push(stepId);
    } catch (err) {
      result.failed.push({ stepId, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  await writeAudit({
    userId: actingUserId,
    action: "BULK_APPROVE",
    entityType: "ApprovalStep",
    after: result,
  });

  return result;
}
