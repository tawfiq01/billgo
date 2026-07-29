import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STAGE_ROLE_LABELS, type StageRole } from "@/lib/constants";

const currency = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" });

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Approvers are resolved by relationship (reporting manager, department/
  // division head, project manager) or by Role (Finance/Final Approver), so
  // whether someone has anything to approve is a plain query — not gated on
  // their own User.role, which a Division Head/Project Manager need not hold.
  const steps = prisma
    ? await prisma.approvalStep.findMany({
        where: { approverId: user.id, status: "PENDING" },
        include: { claim: { include: { employee: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div>
      <h1 className="text-xl font-semibold">Approvals</h1>
      <p className="mt-1 text-sm text-muted">Claims currently awaiting your review.</p>

      <div className="mt-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
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
            {steps.map((s) => (
              <tr key={s.id}>
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
            ))}
            {steps.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted">
                  Nothing pending — you&apos;re all caught up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
