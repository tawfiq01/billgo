import { prisma } from "./db";
import type { ClaimStatus } from "./constants";

export type DashboardStats = {
  draftCount: number;
  pendingCount: number;
  pendingAmount: number;
  returnedCount: number;
  approvedCount: number;
  approvedAmount: number;
  paidCount: number;
  paidAmount: number;
};

const EMPTY_STATS: DashboardStats = {
  draftCount: 0,
  pendingCount: 0,
  pendingAmount: 0,
  returnedCount: 0,
  approvedCount: 0,
  approvedAmount: 0,
  paidCount: 0,
  paidAmount: 0,
};

const PENDING_STATUSES: ClaimStatus[] = [
  "SUBMITTED",
  "PENDING_MANAGER",
  "PENDING_DEPT_HEAD",
  "PENDING_FINANCE",
  "PENDING_FINAL_APPROVAL",
];

// FR-002: employee dashboard counts/amounts by status. Every user is a
// potential claimant regardless of role, so this is scoped to the viewer.
export async function getDashboardStats(employeeId: string): Promise<DashboardStats> {
  if (!prisma) return EMPTY_STATS;
  try {
    const claims = await prisma.claim.findMany({ where: { employeeId } });

    const pending = claims.filter((c) => PENDING_STATUSES.includes(c.status as ClaimStatus));
    const approved = claims.filter((c) => c.status === "APPROVED");
    const paid = claims.filter((c) => c.status === "PAID" || c.status === "CLOSED");

    return {
      draftCount: claims.filter((c) => c.status === "DRAFT").length,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, c) => s + c.totalClaimed, 0),
      returnedCount: claims.filter((c) => c.status === "RETURNED").length,
      approvedCount: approved.length,
      approvedAmount: approved.reduce((s, c) => s + c.totalApproved, 0),
      paidCount: paid.length,
      paidAmount: paid.reduce((s, c) => s + c.payableAmount, 0),
    };
  } catch (error) {
    console.error("Dashboard query failed, serving empty stats:", error);
    return EMPTY_STATS;
  }
}

export async function getRecentClaims(employeeId: string, take = 5) {
  if (!prisma) return [];
  try {
    return await prisma.claim.findMany({
      where: { employeeId },
      orderBy: { updatedAt: "desc" },
      take,
    });
  } catch (error) {
    console.error("Recent claims query failed:", error);
    return [];
  }
}

export async function getPendingApprovalCount(userId: string): Promise<number> {
  if (!prisma) return 0;
  try {
    return await prisma.approvalStep.count({ where: { approverId: userId, status: "PENDING" } });
  } catch {
    return 0;
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!prisma) return 0;
  try {
    return await prisma.notification.count({ where: { userId, read: false } });
  } catch {
    return 0;
  }
}
