import { prisma } from "./db";
import { writeAudit } from "./audit";
import { notify } from "./notifications";
import { saveAttachment } from "./storage";
import { buildApprovalSteps, reopenCurrentStage } from "./workflow";
import { calculateDA, calculateFA, calculateHA } from "./calculations";
import type { NewClaimInput } from "./validation";

export class ClaimError extends Error {}

const fullClaimInclude = {
  employee: { include: { department: true, manager: true } },
  travelSegments: true,
  expenseLines: true,
  daLines: true,
  faLines: true,
  haLines: true,
  attachments: true,
  approvalSteps: { include: { approver: true }, orderBy: { createdAt: "asc" as const } },
  payments: true,
} as const;

function assertHasComponent(input: NewClaimInput): void {
  const hasTravel = input.travelSegments.length > 0;
  const hasDA = input.daLines.length > 0;
  const hasFA = input.faLines.length > 0;
  const hasHA = input.haLines.length > 0;

  if (input.claimType === "TA" && !hasTravel) throw new ClaimError("A TA claim needs at least one travel segment.");
  if (input.claimType === "DA" && !hasDA) throw new ClaimError("A DA claim needs at least one DA line.");
  if (input.claimType === "FA" && !hasFA) throw new ClaimError("A Food Allowance claim needs at least one FA line.");
  if (input.claimType === "HA" && !hasHA) throw new ClaimError("An HA claim needs at least one HA line.");
  if (input.claimType === "COMBINED" && !hasTravel && !hasDA && !hasFA && !hasHA) {
    throw new ClaimError("A combined claim needs at least one TA, DA, FA, or HA component (BR-03).");
  }
}

function sumTotals(parts: {
  travelSegments: { fare: number }[];
  expenseLines: { amount: number }[];
  daLines: { entitledAmount: number }[];
  faLines: { entitledAmount: number }[];
  haLines: { payableAmount: number }[];
}): number {
  const travel = parts.travelSegments.reduce((s, t) => s + t.fare, 0);
  const expenses = parts.expenseLines.reduce((s, e) => s + e.amount, 0);
  const da = parts.daLines.reduce((s, d) => s + d.entitledAmount, 0);
  const fa = parts.faLines.reduce((s, f) => s + f.entitledAmount, 0);
  const ha = parts.haLines.reduce((s, h) => s + h.payableAmount, 0);
  return travel + expenses + da + fa + ha;
}

async function buildCalculatedLines(employeeId: string, input: NewClaimInput) {
  if (!prisma) throw new ClaimError("Database not configured");
  const employee = await prisma.user.findUniqueOrThrow({ where: { id: employeeId } });
  const grade = employee.grade ?? "UNGRADED";

  const daLines = await Promise.all(
    input.daLines.map((line) =>
      calculateDA({
        grade,
        locationCategory: line.locationCategory,
        fromDate: line.fromDate,
        toDate: line.toDate,
        deduction: line.deduction,
      }),
    ),
  );

  const faLines = await Promise.all(
    input.faLines.map((line) =>
      calculateFA({
        grade,
        locationCategory: line.locationCategory,
        fromDate: line.fromDate,
        toDate: line.toDate,
        deduction: line.deduction,
      }),
    ),
  );

  const haLines = await Promise.all(
    input.haLines.map(async (line) => {
      const entry = await prisma!.holidayCalendarEntry.findUniqueOrThrow({
        where: { id: line.holidayCalendarEntryId },
      });
      return calculateHA({
        grade,
        holidayDate: entry.date,
        holidayType: entry.type,
        workedHours: line.workedHours,
        isFullDay: line.isFullDay,
        evidenceNote: line.evidenceNote,
      });
    }),
  );

  return { daLines, faLines, haLines };
}

export async function createDraftClaim(employeeId: string, input: NewClaimInput) {
  if (!prisma) throw new ClaimError("Database not configured");
  assertHasComponent(input);
  const { daLines, faLines, haLines } = await buildCalculatedLines(employeeId, input);
  const totalClaimed = sumTotals({ ...input, daLines, faLines, haLines });

  const claim = await prisma.claim.create({
    data: {
      employeeId,
      projectId: input.projectId || null,
      claimType: input.claimType,
      purpose: input.purpose,
      advanceAmount: input.advanceAmount,
      totalClaimed,
      totalEligible: totalClaimed,
      travelSegments: { create: input.travelSegments },
      expenseLines: { create: input.expenseLines },
      daLines: { create: daLines },
      faLines: { create: faLines },
      haLines: { create: haLines },
    },
    include: fullClaimInclude,
  });

  await writeAudit({
    userId: employeeId,
    action: "CLAIM_DRAFT_CREATED",
    entityType: "Claim",
    entityId: claim.id,
    after: { claimType: claim.claimType, totalClaimed: claim.totalClaimed },
  });

  return claim;
}

export async function updateDraftClaim(claimId: string, employeeId: string, input: NewClaimInput) {
  if (!prisma) throw new ClaimError("Database not configured");
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.employeeId !== employeeId) throw new ClaimError("You can only edit your own claims.");
  if (claim.status !== "DRAFT") throw new ClaimError("Only draft claims can be edited.");

  assertHasComponent(input);
  const { daLines, faLines, haLines } = await buildCalculatedLines(employeeId, input);
  const totalClaimed = sumTotals({ ...input, daLines, faLines, haLines });

  await prisma.$transaction([
    prisma.travelSegment.deleteMany({ where: { claimId } }),
    prisma.expenseLine.deleteMany({ where: { claimId } }),
    prisma.dACalculationLine.deleteMany({ where: { claimId } }),
    prisma.fACalculationLine.deleteMany({ where: { claimId } }),
    prisma.hACalculationLine.deleteMany({ where: { claimId } }),
  ]);

  const updated = await prisma.claim.update({
    where: { id: claimId },
    data: {
      projectId: input.projectId || null,
      claimType: input.claimType,
      purpose: input.purpose,
      advanceAmount: input.advanceAmount,
      totalClaimed,
      totalEligible: totalClaimed,
      travelSegments: { create: input.travelSegments },
      expenseLines: { create: input.expenseLines },
      daLines: { create: daLines },
      faLines: { create: faLines },
      haLines: { create: haLines },
    },
    include: fullClaimInclude,
  });

  await writeAudit({
    userId: employeeId,
    action: "CLAIM_DRAFT_UPDATED",
    entityType: "Claim",
    entityId: claimId,
    after: { totalClaimed },
  });

  return updated;
}

async function generateClaimNumber(): Promise<string> {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `CLM-${yyyymm}-`;
  const count = await prisma!.claim.count({ where: { claimNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

async function assertNoOverlap(
  employeeId: string,
  segments: { departureAt: Date; returnAt: Date }[],
  excludeClaimId: string,
): Promise<void> {
  if (!prisma || segments.length === 0) return;
  const others = await prisma.claim.findMany({
    where: { employeeId, status: { notIn: ["REJECTED", "CANCELLED"] }, id: { not: excludeClaimId } },
    include: { travelSegments: true },
  });
  for (const seg of segments) {
    for (const other of others) {
      for (const existing of other.travelSegments) {
        if (seg.departureAt < existing.returnAt && existing.departureAt < seg.returnAt) {
          throw new ClaimError(
            `Travel dates overlap with an existing claim (${other.claimNumber ?? other.id}) — FR-012.`,
          );
        }
      }
    }
  }
}

// BP-03/BP-04: validate, assign the claim number, and route into the
// approval matrix. Draft -> Submitted -> first pending stage, all in one step.
export async function submitClaim(claimId: string, employeeId: string) {
  if (!prisma) throw new ClaimError("Database not configured");
  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { travelSegments: true, attachments: true },
  });
  if (claim.employeeId !== employeeId) throw new ClaimError("You can only submit your own claims.");
  if (claim.status !== "DRAFT") throw new ClaimError("This claim has already been submitted.");
  if (claim.attachments.length === 0) {
    throw new ClaimError("At least one supporting document is required before submission (FR-004/BR-04).");
  }

  await assertNoOverlap(employeeId, claim.travelSegments, claimId);

  const claimNumber = await generateClaimNumber();
  await prisma.claim.update({
    where: { id: claimId },
    data: { claimNumber, submittedAt: new Date(), status: "SUBMITTED" },
  });

  await buildApprovalSteps(claimId, employeeId);

  await writeAudit({
    userId: employeeId,
    action: "CLAIM_SUBMITTED",
    entityType: "Claim",
    entityId: claimId,
    after: { claimNumber },
  });

  return claimNumber;
}

// FR-010: withdraw before the first approval.
export async function withdrawClaim(claimId: string, employeeId: string): Promise<void> {
  if (!prisma) throw new ClaimError("Database not configured");
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.employeeId !== employeeId) throw new ClaimError("You can only withdraw your own claims.");

  const approvedSteps = await prisma.approvalStep.count({ where: { claimId, status: "APPROVED" } });
  if (approvedSteps > 0) {
    throw new ClaimError("This claim has already received an approval and can no longer be withdrawn.");
  }
  if (!["DRAFT", "SUBMITTED", "PENDING_MANAGER", "PENDING_DEPT_HEAD", "RETURNED"].includes(claim.status)) {
    throw new ClaimError("This claim can no longer be withdrawn.");
  }

  await prisma.claim.update({ where: { id: claimId }, data: { status: "CANCELLED", closedAt: new Date() } });
  await writeAudit({ userId: employeeId, action: "CLAIM_WITHDRAWN", entityType: "Claim", entityId: claimId });
}

// Administrative cancellation with reason, at any pre-payment stage.
export async function cancelClaim(claimId: string, actingUserId: string, reason: string): Promise<void> {
  if (!prisma) throw new ClaimError("Database not configured");
  if (!reason.trim()) throw new ClaimError("A cancellation reason is required.");
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
  if (["PAID", "CLOSED", "CANCELLED"].includes(claim.status)) {
    throw new ClaimError("This claim can no longer be cancelled.");
  }

  await prisma.claim.update({
    where: { id: claimId },
    data: { status: "CANCELLED", closedAt: new Date(), financeNotes: reason },
  });
  await notify({
    userId: claim.employeeId,
    type: "CLAIM_CANCELLED",
    message: `Your claim ${claim.claimNumber ?? claim.id} was cancelled: ${reason}`,
    claimId,
  });
  await writeAudit({
    userId: actingUserId,
    action: "CLAIM_CANCELLED",
    entityType: "Claim",
    entityId: claimId,
    after: { reason },
  });
}

// Employee edits a RETURNED claim and sends it back to the same stage (BR-12).
export async function resubmitClaim(claimId: string, employeeId: string, input: NewClaimInput) {
  if (!prisma) throw new ClaimError("Database not configured");
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.employeeId !== employeeId) throw new ClaimError("You can only resubmit your own claims.");
  if (claim.status !== "RETURNED") throw new ClaimError("Only returned claims can be resubmitted.");

  assertHasComponent(input);
  const { daLines, faLines, haLines } = await buildCalculatedLines(employeeId, input);
  const totalClaimed = sumTotals({ ...input, daLines, faLines, haLines });

  await prisma.$transaction([
    prisma.travelSegment.deleteMany({ where: { claimId } }),
    prisma.expenseLine.deleteMany({ where: { claimId } }),
    prisma.dACalculationLine.deleteMany({ where: { claimId } }),
    prisma.fACalculationLine.deleteMany({ where: { claimId } }),
    prisma.hACalculationLine.deleteMany({ where: { claimId } }),
  ]);

  await prisma.claim.update({
    where: { id: claimId },
    data: {
      projectId: input.projectId || null,
      claimType: input.claimType,
      purpose: input.purpose,
      advanceAmount: input.advanceAmount,
      totalClaimed,
      totalEligible: totalClaimed,
      travelSegments: { create: input.travelSegments },
      expenseLines: { create: input.expenseLines },
      daLines: { create: daLines },
      faLines: { create: faLines },
      haLines: { create: haLines },
    },
  });

  await reopenCurrentStage(claimId, employeeId);
}

// BR-13: a rejected claim is read-only, but the employee may copy it into a
// fresh draft to resubmit as a new claim.
export async function copyClaimAsDraft(claimId: string, employeeId: string) {
  if (!prisma) throw new ClaimError("Database not configured");
  const source = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { travelSegments: true, expenseLines: true, daLines: true, faLines: true, haLines: true },
  });
  if (source.employeeId !== employeeId) throw new ClaimError("You can only copy your own claims.");

  const copy = await prisma.claim.create({
    data: {
      employeeId,
      projectId: source.projectId,
      claimType: source.claimType,
      purpose: source.purpose,
      advanceAmount: source.advanceAmount,
      totalClaimed: source.totalClaimed,
      totalEligible: source.totalClaimed,
      travelSegments: {
        create: source.travelSegments.map((t) => ({
          origin: t.origin,
          destination: t.destination,
          departureAt: t.departureAt,
          returnAt: t.returnAt,
          mode: t.mode,
          travelClass: t.travelClass,
          distanceKm: t.distanceKm,
          ticketNumber: t.ticketNumber,
          fare: t.fare,
          remarks: t.remarks,
        })),
      },
      expenseLines: {
        create: source.expenseLines.map((e) => ({
          category: e.category,
          date: e.date,
          description: e.description,
          amount: e.amount,
          taxAmount: e.taxAmount,
          eligibleAmount: e.eligibleAmount,
          approvedAmount: e.approvedAmount,
        })),
      },
      daLines: {
        create: source.daLines.map((d) => ({
          locationCategory: d.locationCategory,
          fromDate: d.fromDate,
          toDate: d.toDate,
          durationDays: d.durationDays,
          rateApplied: d.rateApplied,
          deduction: d.deduction,
          entitledAmount: d.entitledAmount,
        })),
      },
      faLines: {
        create: source.faLines.map((f) => ({
          locationCategory: f.locationCategory,
          fromDate: f.fromDate,
          toDate: f.toDate,
          durationDays: f.durationDays,
          rateApplied: f.rateApplied,
          deduction: f.deduction,
          entitledAmount: f.entitledAmount,
        })),
      },
      haLines: {
        create: source.haLines.map((h) => ({
          holidayDate: h.holidayDate,
          holidayType: h.holidayType,
          workedHours: h.workedHours,
          isFullDay: h.isFullDay,
          rateApplied: h.rateApplied,
          multiplier: h.multiplier,
          payableAmount: h.payableAmount,
          evidenceNote: h.evidenceNote,
        })),
      },
    },
    include: fullClaimInclude,
  });

  await writeAudit({
    userId: employeeId,
    action: "CLAIM_COPIED",
    entityType: "Claim",
    entityId: copy.id,
    before: { sourceClaimId: claimId },
  });

  return copy;
}

export async function addAttachment(claimId: string, uploadedById: string, file: File) {
  if (!prisma) throw new ClaimError("Database not configured");
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.employeeId !== uploadedById || claim.status !== "DRAFT") {
    // Phase 1: only the claimant can attach documents, and only while drafting.
    throw new ClaimError("Attachments can only be added by the claimant while the claim is a draft.");
  }

  const stored = await saveAttachment(file);
  const attachment = await prisma.attachment.create({
    data: { claimId, uploadedById, ...stored },
  });

  await writeAudit({
    userId: uploadedById,
    action: "ATTACHMENT_ADDED",
    entityType: "Claim",
    entityId: claimId,
    after: { filename: stored.filename },
  });

  return attachment;
}

export type RecordPaymentInput = {
  claimId: string;
  recordedById: string;
  method: string;
  reference?: string;
  batch?: string;
  amount: number;
};

// FR-022: Payment Processor records payment and closes out the claim.
export async function recordPayment(input: RecordPaymentInput) {
  if (!prisma) throw new ClaimError("Database not configured");
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: input.claimId } });
  if (claim.status !== "APPROVED") {
    throw new ClaimError("Only fully approved claims are ready for payment.");
  }

  const payment = await prisma.payment.create({
    data: {
      claimId: input.claimId,
      method: input.method,
      reference: input.reference,
      batch: input.batch,
      amount: input.amount,
      status: "PAID",
      paidAt: new Date(),
      recordedById: input.recordedById,
    },
  });

  await prisma.claim.update({
    where: { id: input.claimId },
    data: { status: "PAID", closedAt: new Date() },
  });

  await notify({
    userId: claim.employeeId,
    type: "CLAIM_PAID",
    message: `Your claim ${claim.claimNumber ?? claim.id} has been paid (${input.method}).`,
    claimId: input.claimId,
  });

  await writeAudit({
    userId: input.recordedById,
    action: "PAYMENT_RECORDED",
    entityType: "Claim",
    entityId: input.claimId,
    after: { amount: input.amount, method: input.method, reference: input.reference },
  });

  return payment;
}

// FR-037: Finance/Admin may reopen a Paid/Closed claim under controlled
// authorization (e.g. a payment was reversed and needs re-recording). The
// prior payment is marked FAILED rather than deleted, so it stays in the
// Payment Register / audit trail instead of silently disappearing.
export async function reopenClaim(claimId: string, actingUserId: string, reason: string): Promise<void> {
  if (!prisma) throw new ClaimError("Database not configured");
  if (!reason.trim()) throw new ClaimError("A reason is required to reopen a claim.");

  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId }, include: { payments: true } });
  if (!["PAID", "CLOSED"].includes(claim.status)) {
    throw new ClaimError("Only paid or closed claims can be reopened.");
  }

  const lastPayment = claim.payments.at(-1);
  await prisma.$transaction([
    ...(lastPayment
      ? [prisma.payment.update({ where: { id: lastPayment.id }, data: { status: "FAILED" } })]
      : []),
    prisma.claim.update({
      where: { id: claimId },
      data: { status: "APPROVED", closedAt: null, financeNotes: reason },
    }),
  ]);

  await notify({
    userId: claim.employeeId,
    type: "CLAIM_REOPENED",
    message: `Your claim ${claim.claimNumber ?? claim.id} was reopened: ${reason}`,
    claimId,
  });
  await writeAudit({
    userId: actingUserId,
    action: "CLAIM_REOPENED",
    entityType: "Claim",
    entityId: claimId,
    before: { status: claim.status },
    after: { status: "APPROVED", reason },
  });
}

export { fullClaimInclude };
