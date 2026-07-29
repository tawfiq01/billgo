import { prisma } from "@/lib/db";
import { CLAIM_TYPES, STAGE_ROLE_LABELS, STAGE_ROLES, type StageRole } from "@/lib/constants";
import { ActionForm } from "@/components/action-form";
import { createApprovalRuleAction, deleteApprovalRuleAction } from "./actions";

const currency = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" });

export default async function AdminApprovalMatrixPage() {
  const [rules, departments, divisions] = prisma
    ? await Promise.all([
        prisma.approvalStageRule.findMany({
          include: { department: true, division: true },
          orderBy: [{ claimType: "asc" }, { stageOrder: "asc" }],
        }),
        prisma.department.findMany({ orderBy: { name: "asc" } }),
        prisma.division.findMany({ orderBy: { name: "asc" } }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-8">
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Approval matrix</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Claim type</th>
              <th>Min amount</th>
              <th>Max amount</th>
              <th>Department</th>
              <th>Division</th>
              <th>Stage</th>
              <th>Required role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.claimType}</td>
                <td>{currency.format(r.minAmount)}</td>
                <td>{r.maxAmount != null ? currency.format(r.maxAmount) : "—"}</td>
                <td>{r.department?.name ?? "Any"}</td>
                <td>{r.division?.name ?? "Any"}</td>
                <td>{r.stageOrder}</td>
                <td>{STAGE_ROLE_LABELS[r.requiredRole as StageRole] ?? r.requiredRole}</td>
                <td>
                  <ActionForm action={deleteApprovalRuleAction.bind(null, r.id)} confirmMessage="Delete this rule?">
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Delete
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted">
                  No approval rules configured — claims cannot be submitted until at least one exists.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Add approval rule</h2>
        <p className="mt-1 text-xs text-muted">
          Stages run in ascending order. A claim only routes through a stage if its total claimed amount falls
          within [min, max] and the department/division matches (or the rule applies to any). Division Head and
          Project Manager stages are skipped automatically for claims/employees without one — they only block
          submission if the division or project exists but has no head/manager configured.
        </p>
        <ActionForm action={createApprovalRuleAction} className="mt-3 grid gap-3 sm:grid-cols-7">
          <select name="claimType" className="field-input" defaultValue="ANY">
            <option value="ANY">Any</option>
            {CLAIM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input suppressHydrationWarning name="minAmount" type="number" step="0.01" className="field-input" placeholder="Min amount" defaultValue="0" />
          <input suppressHydrationWarning name="maxAmount" type="number" step="0.01" className="field-input" placeholder="Max amount (optional)" />
          <select name="departmentId" className="field-input" defaultValue="">
            <option value="">Any department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="divisionId" className="field-input" defaultValue="">
            <option value="">Any division</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input suppressHydrationWarning name="stageOrder" type="number" min="0" className="field-input" placeholder="Stage order" required />
          <select name="requiredRole" className="field-input" defaultValue="MANAGER">
            {STAGE_ROLES.map((r) => (
              <option key={r} value={r}>
                {STAGE_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <div className="sm:col-span-7">
            <button type="submit" className="btn-primary">
              Add rule
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
