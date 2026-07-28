import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/queries";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function Home() {
  const stats = await getDashboardStats();

  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="font-semibold">Enterprise Bill Management System</p>
          <nav className="flex gap-6 text-sm text-muted">
            <span>Dashboard</span>
            <span>Customers</span>
            <span>Bills</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Overview of customers, outstanding bills and recent payments.</p>

        {!prisma && (
          <p className="mt-6 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            No database connected yet — figures below are placeholders. Set DATABASE_URL to start tracking real data.
          </p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total customers" value={String(stats.customerCount)} />
          <StatCard label="Outstanding" value={currency.format(stats.outstandingTotal)} />
          <StatCard label="Paid this month" value={currency.format(stats.paidThisMonthTotal)} />
          <StatCard label="Overdue bills" value={String(stats.overdueCount)} />
        </div>
      </main>
    </div>
  );
}
