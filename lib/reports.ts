import { prisma } from "./db";
import { CLAIM_STATUS_LABELS, type ClaimStatus } from "./constants";
import { getPolicyNumber } from "./calculations";

// Phase 1 covered 5 of the BRD's 15 reports (RP-01..RP-05); Phase 2 adds the
// remaining 10 (RP-06..RP-15). Each function returns plain rows ready for a
// table or toCSV().

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

// RP-01: Employee Claim Statement
export async function employeeClaimStatement(employeeId: string) {
  if (!prisma) return [];
  const claims = await prisma.claim.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    include: { payments: true },
  });
  return claims.map((c) => ({
    claimNumber: c.claimNumber ?? "(draft)",
    claimType: c.claimType,
    status: CLAIM_STATUS_LABELS[c.status as ClaimStatus] ?? c.status,
    submittedAt: c.submittedAt ? c.submittedAt.toISOString().slice(0, 10) : "",
    totalClaimed: round(c.totalClaimed),
    totalApproved: round(c.totalApproved),
    paidAmount: round(c.payments.reduce((s, p) => s + p.amount, 0)),
    payableAmount: round(c.payableAmount),
  }));
}

// RP-02: Department-wise Summary
export async function departmentSummary() {
  if (!prisma) return [];
  const departments = await prisma.department.findMany({
    include: { members: { include: { claims: true } } },
  });
  return departments.map((d) => {
    const claims = d.members.flatMap((m) => m.claims);
    return {
      department: d.name,
      claimCount: claims.length,
      totalClaimed: round(claims.reduce((s, c) => s + c.totalClaimed, 0)),
      totalApproved: round(claims.reduce((s, c) => s + c.totalApproved, 0)),
      pendingCount: claims.filter((c) => c.status.startsWith("PENDING")).length,
    };
  });
}

// RP-03: Monthly Summary
export async function monthlySummary() {
  if (!prisma) return [];
  const claims = await prisma.claim.findMany({ where: { submittedAt: { not: null } } });
  const byMonth = new Map<
    string,
    { claimed: number; approved: number; rejected: number; paid: number; outstanding: number }
  >();

  for (const c of claims) {
    const key = c.submittedAt!.toISOString().slice(0, 7); // YYYY-MM
    const bucket = byMonth.get(key) ?? { claimed: 0, approved: 0, rejected: 0, paid: 0, outstanding: 0 };
    bucket.claimed += c.totalClaimed;
    if (c.status === "REJECTED") bucket.rejected += c.totalClaimed;
    if (c.status === "PAID" || c.status === "CLOSED") bucket.paid += c.payableAmount;
    else if (!["REJECTED", "CANCELLED", "DRAFT"].includes(c.status)) bucket.outstanding += c.totalClaimed;
    if (["APPROVED", "PAYMENT_PROCESSING", "PAID", "CLOSED"].includes(c.status)) bucket.approved += c.totalApproved;
    byMonth.set(key, bucket);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      claimed: round(b.claimed),
      approved: round(b.approved),
      rejected: round(b.rejected),
      paid: round(b.paid),
      outstanding: round(b.outstanding),
    }));
}

// RP-04: Status Report
export async function statusReport() {
  if (!prisma) return [];
  const rows = await prisma.claim.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { totalClaimed: true },
  });
  return rows.map((row) => ({
    status: CLAIM_STATUS_LABELS[row.status as ClaimStatus] ?? row.status,
    count: row._count._all,
    totalClaimed: round(row._sum.totalClaimed ?? 0),
  }));
}

// RP-05: Approval Aging
export async function approvalAgingReport() {
  if (!prisma) return [];
  const steps = await prisma.approvalStep.findMany({
    where: { status: "PENDING" },
    include: { claim: { include: { employee: true } }, approver: true },
    orderBy: { createdAt: "asc" },
  });
  const now = Date.now();
  return steps.map((s) => ({
    claimNumber: s.claim.claimNumber ?? s.claim.id,
    employee: s.claim.employee.name,
    stage: s.requiredRole,
    approver: s.approver?.name ?? "(unassigned)",
    ageDays: round((now - s.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

// RP-06: Policy Exception Report — claims where Finance adjusted the
// approved amount away from the eligible amount (the one exception signal
// Phase 1 actually tracks; there's no separate "exception flag" field).
export async function policyExceptionReport() {
  if (!prisma) return [];
  const claims = await prisma.claim.findMany({
    where: { submittedAt: { not: null } },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
  return claims
    .filter((c) => Math.abs(c.totalApproved - c.totalEligible) > 0.01)
    .map((c) => ({
      claimNumber: c.claimNumber ?? c.id,
      employee: c.employee.name,
      claimType: c.claimType,
      status: CLAIM_STATUS_LABELS[c.status as ClaimStatus] ?? c.status,
      totalClaimed: round(c.totalClaimed),
      totalEligible: round(c.totalEligible),
      totalApproved: round(c.totalApproved),
      variance: round(c.totalApproved - c.totalEligible),
      financeNotes: c.financeNotes ?? "",
    }));
}

// RP-07: Payment Register
export async function paymentRegister() {
  if (!prisma) return [];
  const payments = await prisma.payment.findMany({
    include: { claim: { include: { employee: true } }, recordedBy: true },
    orderBy: { createdAt: "desc" },
  });
  return payments.map((p) => ({
    claimNumber: p.claim.claimNumber ?? p.claim.id,
    employee: p.claim.employee.name,
    amount: round(p.amount),
    method: p.method,
    reference: p.reference ?? "",
    batch: p.batch ?? "",
    status: p.status,
    paidAt: p.paidAt ? p.paidAt.toISOString().slice(0, 10) : "",
    recordedBy: p.recordedBy.name,
  }));
}

// RP-08: Advance Adjustment Report — claims with a travel advance to
// reconcile against the final approved amount.
export async function advanceAdjustmentReport() {
  if (!prisma) return [];
  const claims = await prisma.claim.findMany({
    where: { advanceAmount: { gt: 0 } },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
  return claims.map((c) => ({
    claimNumber: c.claimNumber ?? c.id,
    employee: c.employee.name,
    status: CLAIM_STATUS_LABELS[c.status as ClaimStatus] ?? c.status,
    advanceIssued: round(c.advanceAmount),
    totalApproved: round(c.totalApproved),
    payableAfterAdjustment: round(c.payableAmount),
    recoverableFromEmployee: round(Math.max(c.advanceAmount - c.totalApproved, 0)),
  }));
}

// RP-09: Holiday Allowance Report
export async function holidayAllowanceReport() {
  if (!prisma) return [];
  const lines = await prisma.hACalculationLine.findMany({
    include: { claim: { include: { employee: { include: { department: true } } } } },
    orderBy: { holidayDate: "desc" },
  });
  return lines.map((h) => ({
    holidayDate: h.holidayDate.toISOString().slice(0, 10),
    holidayType: h.holidayType,
    employee: h.claim.employee.name,
    department: h.claim.employee.department?.name ?? "",
    workedHours: h.workedHours,
    isFullDay: h.isFullDay ? "Yes" : "No",
    rateApplied: round(h.rateApplied),
    payableAmount: round(h.payableAmount),
    claimNumber: h.claim.claimNumber ?? h.claim.id,
    claimStatus: CLAIM_STATUS_LABELS[h.claim.status as ClaimStatus] ?? h.claim.status,
  }));
}

// RP-10: Travel Route and Cost Report
export async function travelRouteCostReport() {
  if (!prisma) return [];
  const segments = await prisma.travelSegment.findMany({
    include: { claim: { include: { employee: { include: { department: true } } } } },
    orderBy: { departureAt: "desc" },
  });
  return segments.map((t) => ({
    origin: t.origin,
    destination: t.destination,
    mode: t.mode,
    employee: t.claim.employee.name,
    department: t.claim.employee.department?.name ?? "",
    departureAt: t.departureAt.toISOString().slice(0, 10),
    fare: round(t.fare),
    claimNumber: t.claim.claimNumber ?? t.claim.id,
    claimStatus: CLAIM_STATUS_LABELS[t.claim.status as ClaimStatus] ?? t.claim.status,
  }));
}

// RP-11: Budget / Cost Center Report — no external budget integration yet
// (Phase 3), so this reports actual spend per cost center for comparison
// against a budget tracked outside the system.
export async function costCenterReport() {
  if (!prisma) return [];
  const claims = await prisma.claim.findMany({
    where: { submittedAt: { not: null } },
    include: { employee: true },
  });
  const byCostCenter = new Map<string, { claimed: number; approved: number; paid: number; count: number }>();
  for (const c of claims) {
    const key = c.employee.costCenter ?? "(unassigned)";
    const bucket = byCostCenter.get(key) ?? { claimed: 0, approved: 0, paid: 0, count: 0 };
    bucket.claimed += c.totalClaimed;
    bucket.approved += c.totalApproved;
    if (c.status === "PAID" || c.status === "CLOSED") bucket.paid += c.payableAmount;
    bucket.count += 1;
    byCostCenter.set(key, bucket);
  }
  return [...byCostCenter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([costCenter, b]) => ({
      costCenter,
      claimCount: b.count,
      totalClaimed: round(b.claimed),
      totalApproved: round(b.approved),
      totalPaid: round(b.paid),
    }));
}

// RP-12: Audit Trail Report (the same data as Admin → Audit Log, exposed
// here too for report-style CSV export alongside the other reports).
export async function auditTrailReport() {
  if (!prisma) return [];
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return logs.map((l) => ({
    createdAt: l.createdAt.toISOString(),
    user: l.user?.name ?? "(system)",
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId ?? "",
  }));
}

// RP-13: Rejected/Returned Analysis
export async function rejectedReturnedAnalysis() {
  if (!prisma) return [];
  const steps = await prisma.approvalStep.findMany({
    where: { status: { in: ["REJECTED", "RETURNED"] } },
    include: { claim: { include: { employee: { include: { department: true } } } }, approver: true },
    orderBy: { actedAt: "desc" },
  });
  return steps.map((s) => ({
    claimNumber: s.claim.claimNumber ?? s.claim.id,
    employee: s.claim.employee.name,
    department: s.claim.employee.department?.name ?? "",
    stage: s.requiredRole,
    approver: s.approver?.name ?? "",
    outcome: s.status,
    reason: s.comments ?? "",
    actedAt: s.actedAt ? s.actedAt.toISOString().slice(0, 10) : "",
  }));
}

// RP-14: Tax/VAT Report — expense lines carrying a tax/VAT amount.
export async function taxVatReport() {
  if (!prisma) return [];
  const lines = await prisma.expenseLine.findMany({
    where: { taxAmount: { gt: 0 } },
    include: { claim: { include: { employee: true } } },
    orderBy: { date: "desc" },
  });
  return lines.map((e) => ({
    claimNumber: e.claim.claimNumber ?? e.claim.id,
    employee: e.claim.employee.name,
    category: e.category,
    date: e.date.toISOString().slice(0, 10),
    amount: round(e.amount),
    taxAmount: round(e.taxAmount),
    claimStatus: CLAIM_STATUS_LABELS[e.claim.status as ClaimStatus] ?? e.claim.status,
  }));
}

// RP-15: Management Dashboard — headline KPIs as metric/value rows (same
// shape as every other report, so it reuses ReportTable/toCSV unchanged).
export async function managementDashboardKPIs() {
  if (!prisma) return [];
  const submitted = await prisma.claim.findMany({ where: { submittedAt: { not: null } } });
  const paidOrClosed = submitted.filter((c) => c.status === "PAID" || c.status === "CLOSED");
  const exceptions = submitted.filter((c) => Math.abs(c.totalApproved - c.totalEligible) > 0.01);
  const pendingCount = submitted.filter((c) => c.status.startsWith("PENDING") || c.status === "SUBMITTED").length;

  const cycleTimes = paidOrClosed
    .filter((c) => c.closedAt)
    .map((c) => (c.closedAt!.getTime() - c.submittedAt!.getTime()) / (1000 * 60 * 60 * 24));
  const avgCycleDays = cycleTimes.length ? cycleTimes.reduce((s, d) => s + d, 0) / cycleTimes.length : 0;

  const slaThresholdDays = await getPolicyNumber("APPROVAL_SLA_DAYS", 3);
  const now = Date.now();
  const overdueSteps = await prisma.approvalStep.count({
    where: { status: "PENDING", createdAt: { lt: new Date(now - slaThresholdDays * 24 * 60 * 60 * 1000) } },
  });

  return [
    { metric: "Claims submitted", value: submitted.length },
    { metric: "Total amount claimed", value: round(submitted.reduce((s, c) => s + c.totalClaimed, 0)) },
    { metric: "Total amount paid", value: round(paidOrClosed.reduce((s, c) => s + c.payableAmount, 0)) },
    { metric: "Claims currently pending", value: pendingCount },
    { metric: `Approvals overdue (> ${slaThresholdDays}d)`, value: overdueSteps },
    { metric: "Average approval-to-payment cycle (days)", value: round(avgCycleDays) },
    { metric: "Exception rate (%)", value: submitted.length ? round((exceptions.length / submitted.length) * 100) : 0 },
  ];
}

// Supporting breakdown for the Management Dashboard page — top expense
// categories by spend. Displayed alongside the KPIs but not its own CSV route.
export async function managementDashboardTopCategories() {
  if (!prisma) return [];
  const lines = await prisma.expenseLine.findMany();
  const byCategory = new Map<string, { amount: number; count: number }>();
  for (const e of lines) {
    const bucket = byCategory.get(e.category) ?? { amount: 0, count: 0 };
    bucket.amount += e.amount;
    bucket.count += 1;
    byCategory.set(e.category, bucket);
  }
  return [...byCategory.entries()]
    .sort(([, a], [, b]) => b.amount - a.amount)
    .map(([category, b]) => ({ category, totalAmount: round(b.amount), count: b.count }));
}
