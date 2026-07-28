import { prisma } from "./db";

export type DashboardStats = {
  customerCount: number;
  outstandingTotal: number;
  paidThisMonthTotal: number;
  overdueCount: number;
};

const EMPTY_STATS: DashboardStats = {
  customerCount: 0,
  outstandingTotal: 0,
  paidThisMonthTotal: 0,
  overdueCount: 0,
};

function billTotal(items: { quantity: number; unitPrice: number }[], taxRate: number): number {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return subtotal * (1 + taxRate);
}

// Zeroed placeholder when the database isn't configured yet, so the
// dashboard renders instead of crashing before a DATABASE_URL exists.
export async function getDashboardStats(): Promise<DashboardStats> {
  if (!prisma) return EMPTY_STATS;
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [customerCount, openBills, overdueCount, paidThisMonth] = await Promise.all([
      prisma.customer.count(),
      prisma.bill.findMany({
        where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
        include: { items: true, payments: true },
      }),
      prisma.bill.count({ where: { status: "OVERDUE" } }),
      prisma.payment.aggregate({
        where: { paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
    ]);

    const outstandingTotal = openBills.reduce((sum, bill) => {
      const total = billTotal(bill.items, bill.taxRate);
      const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
      return sum + Math.max(total - paid, 0);
    }, 0);

    return {
      customerCount,
      outstandingTotal,
      paidThisMonthTotal: paidThisMonth._sum.amount ?? 0,
      overdueCount,
    };
  } catch (error) {
    console.error("Database query failed, serving empty dashboard:", error);
    return EMPTY_STATS;
  }
}
