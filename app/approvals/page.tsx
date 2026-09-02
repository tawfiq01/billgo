import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CLAIM_TYPES, STAGE_ROLES, STAGE_ROLE_LABELS, type StageRole } from "@/lib/constants";
import { getBulkApproveThreshold } from "@/lib/workflow";
import { ActionForm } from "@/components/action-form";
import { bulkApproveAction } from "./actions";

const currency = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" });

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; claimType?: string; stage?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const where: Prisma.ApprovalStepWhereInput = { approverId: user.id, status: "PENDING" };
  if (params.stage) where.requiredRole = params.stage;
  const claimFilters: Prisma.ClaimWhereInput = {};
  if (params.claimType) claimFilters.claimType = params.claimType;
  if (params.q) {
    claimFilters.OR = [
      { claimNumber: { contains: params.q } },
      { purpose: { contains: params.q } },
      { employee: { name: { contains: params.q } } },
    ];
  }
  if (Object.keys(claimFilters).length > 0) where.claim = claimFilters;
  const hasFilters = Boolean(params.q || params.claimType || params.stage);

  // Approvers are resolved by relationship (reporting manager, department/
  // division head, project manager) or by Role (Finance/Final Approver), so
  // whether someone has anything to approve is a plain query — not gated on
  // their own User.role, which a Division Head/Project Manager need not hold.
  const [steps, bulkThreshold] = prisma
    ? await Promise.all([
        prisma.approvalStep.findMany({
          where,
          include: { claim: { include: { employee: true } } },
          orderBy: { createdAt: "asc" },
        }),
        getBulkApproveThreshold(),
      ])
    : [[], 0];

  return (
    <div>
      <h1 className="text-xl font-semibold">Approvals</h1>
      <p className="mt-1 text-sm text-muted">Claims currently awaiting your review.</p>

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        <input suppressHydrationWarning
          name="q"
          placeholder="Search claim #, employee, or purpose"
          defaultValue={params.q ?? ""}
          className="field-input w-auto"
        />
        <select name="claimType" defaultValue={params.claimType ?? ""} className="field-input w-auto">
          <option value="">All types</option>
          {CLAIM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="stage" defaultValue={params.stage ?? ""} className="field-input w-auto">
          <option value="">All stages</option>
          {STAGE_ROLES.map((s) => (
            <option key={s} value={s}>
              {STAGE_ROLE_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <ActionForm action={bulkApproveAction} className="mt-6 overflow-x-auto">
        <p className="mb-2 text-xs text-muted">
          Claims of {currency.format(bulkThreshold)} or less (FR-017 &quot;low-risk&quot;) can be selected and
          bulk-approved below; larger claims must be reviewed individually.
        </p>
        <table className="table-base">
          <thead>
            <tr>
              <th></th>
              <th>Claim #</th>
              <th>Employee</th>
              <th>Type</th>
              <th>Stage</th>
              <th>Purpose</th>
              <th>Claimed</th>
              <th>Waiting since</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => {
              const eligible = s.claim.totalClaimed <= bulkThreshold;
              return (
                <tr key={s.id}>
                  <td>
                    <input
                      suppressHydrationWarning
                      type="checkbox"
                      name="stepIds"
                      value={s.id}
                      disabled={!eligible}
                      title={eligible ? undefined : "Above the bulk-approve limit — review individually"}
                    />
                  </td>
                  <td>{s.claim.claimNumber ?? s.claim.id}</td>
                  <td>{s.claim.employee.name}</td>
                  <td>{s.claim.claimType}</td>
                  <td>{STAGE_ROLE_LABELS[s.requiredRole as StageRole] ?? s.requiredRole}</td>
                  <td className="max-w-xs truncate">{s.claim.purpose}</td>
                  <td>{currency.format(s.claim.totalClaimed)}</td>
                  <td>{s.createdAt.toLocaleDateString()}</td>
                  <td>
                    <Link href={`/claims/${s.claim.id}`} className="text-accent hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
            {steps.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-muted">
                  {hasFilters ? "No approvals match your filters." : "Nothing pending — you're all caught up."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {steps.length > 0 && (
          <button type="submit" className="btn-primary mt-4">
            Bulk approve selected
          </button>
        )}
      </ActionForm>
    </div>
  );
}
