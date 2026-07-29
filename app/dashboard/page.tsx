import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDashboardStats, getRecentClaims } from "@/lib/queries";
import { CLAIM_STATUS_LABELS, type ClaimStatus } from "@/lib/constants";

const currency = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" });

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [stats, recentClaims] = await Promise.all([
    getDashboardStats(user.id),
    getRecentClaims(user.id, 8),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Welcome back, {user.name}.</p>
        </div>
        <Link href="/claims/new" className="btn-primary">
          + New Claim
        </Link>
      </div>

      {!prisma && (
        <p className="mt-6 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          No database connected — figures below are placeholders.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Drafts" value={String(stats.draftCount)} />
        <StatCard label="Pending approval" value={String(stats.pendingCount)} sub={currency.format(stats.pendingAmount)} />
        <StatCard label="Returned" value={String(stats.returnedCount)} />
        <StatCard
          label="Approved (unpaid)"
          value={String(stats.approvedCount)}
          sub={currency.format(stats.approvedAmount)}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Paid" value={String(stats.paidCount)} sub={currency.format(stats.paidAmount)} />
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent claims</h2>
          <Link href="/claims" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Type</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Claimed</th>
              </tr>
            </thead>
            <tbody>
              {recentClaims.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/claims/${c.id}`} className="text-accent hover:underline">
                      {c.claimNumber ?? "(draft)"}
                    </Link>
                  </td>
                  <td>{c.claimType}</td>
                  <td className="max-w-xs truncate">{c.purpose}</td>
                  <td>{CLAIM_STATUS_LABELS[c.status as ClaimStatus] ?? c.status}</td>
                  <td>{currency.format(c.totalClaimed)}</td>
                </tr>
              ))}
              {recentClaims.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No claims yet — create your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
