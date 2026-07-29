import { prisma } from "./db";
import { CLAIM_STATUS_LABELS, type ClaimStatus } from "./constants";

// Phase 1 covers 5 of the BRD's 15 reports (RP-01..RP-05); the rest are
// Phase 2. Each function returns plain rows ready for a table or toCSV().

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
