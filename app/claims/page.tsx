import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CLAIM_STATUSES, CLAIM_STATUS_LABELS, CLAIM_TYPES, ORG_WIDE_CLAIM_VIEW_ROLES, type ClaimStatus } from "@/lib/constants";

const currency = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" });

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; status?: string; claimType?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const canViewAll = ORG_WIDE_CLAIM_VIEW_ROLES.includes(user.role);
  const scope = canViewAll && params.scope === "all" ? "all" : "mine";

  const where: Prisma.ClaimWhereInput = {};
  if (scope === "mine") where.employeeId = user.id;
  if (params.status) where.status = params.status;
  if (params.claimType) where.claimType = params.claimType;
  if (params.q) {
    where.OR = [{ claimNumber: { contains: params.q } }, { purpose: { contains: params.q } }];
  }

  const claims = prisma
    ? await prisma.claim.findMany({
        where,
        include: { employee: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{scope === "all" ? "All Claims" : "My Claims"}</h1>
        <Link href="/claims/new" className="btn-primary">
          + New Claim
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        {canViewAll && (
          <select name="scope" defaultValue={scope} className="field-input w-auto">
            <option value="mine">My claims</option>
            <option value="all">All claims</option>
          </select>
        )}
        <input suppressHydrationWarning
          name="q"
          placeholder="Search claim # or purpose"
          defaultValue={params.q ?? ""}
          className="field-input w-auto"
        />
        <select name="status" defaultValue={params.status ?? ""} className="field-input w-auto">
          <option value="">All statuses</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLAIM_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="claimType" defaultValue={params.claimType ?? ""} className="field-input w-auto">
          <option value="">All types</option>
          {CLAIM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button className="btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Claim #</th>
              {scope === "all" && <th>Employee</th>}
              <th>Type</th>
              <th>Purpose</th>
              <th>Status</th>
              <th>Claimed</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/claims/${c.id}`} className="text-accent hover:underline">
                    {c.claimNumber ?? "(draft)"}
                  </Link>
                </td>
                {scope === "all" && <td>{c.employee.name}</td>}
                <td>{c.claimType}</td>
                <td className="max-w-xs truncate">{c.purpose}</td>
                <td>{CLAIM_STATUS_LABELS[c.status as ClaimStatus] ?? c.status}</td>
                <td>{currency.format(c.totalClaimed)}</td>
                <td>{c.submittedAt ? c.submittedAt.toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={scope === "all" ? 7 : 6} className="py-6 text-center text-muted">
                  No claims found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
