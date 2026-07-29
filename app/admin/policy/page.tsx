import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { getApprovalSlaDays, getOverdueApprovalCount } from "@/lib/escalation";
import { upsertPolicyParameterAction, deletePolicyParameterAction, runSlaEscalationAction } from "./actions";

const KNOWN_KEYS: Record<string, string> = {
  DA_FULL_DAY_HOUR_THRESHOLD: "Hours needed for a trailing partial day to count as a full DA day (BR-06)",
  FA_FULL_DAY_HOUR_THRESHOLD: "Hours needed for a trailing partial day to count as a full FA day",
  BULK_APPROVE_MAX_AMOUNT: "Max claimed amount (BDT) eligible for bulk approval in the Approvals inbox (FR-017)",
  APPROVAL_SLA_DAYS: "Days a claim can sit at one approval stage before an SLA escalation reminder fires (FR-019)",
};

export default async function AdminPolicyPage() {
  const [params, slaDays] = prisma
    ? await Promise.all([prisma.policyParameter.findMany({ orderBy: { key: "asc" } }), getApprovalSlaDays()])
    : [[], 0];

  const overdueCount = await getOverdueApprovalCount();

  return (
    <div className="space-y-8">
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Policy parameters</h2>
        <p className="mt-1 text-xs text-muted">
          Generic key/value config knobs used by the calculation and workflow engines (FR-035 — no code changes
          needed to adjust them).
        </p>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Purpose</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.key}>
                <td className="font-mono text-xs">{p.key}</td>
                <td>{p.value}</td>
                <td className="text-xs text-muted">{KNOWN_KEYS[p.key] ?? ""}</td>
                <td>
                  <ActionForm action={deletePolicyParameterAction.bind(null, p.key)} confirmMessage="Delete this parameter?">
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Delete
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {params.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  No policy parameters configured — engines fall back to built-in defaults.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <ActionForm action={upsertPolicyParameterAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input suppressHydrationWarning name="key" list="known-keys" className="field-input" placeholder="Key" required />
          <datalist id="known-keys">
            {Object.keys(KNOWN_KEYS).map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <input suppressHydrationWarning name="value" className="field-input" placeholder="Value" required />
          <button type="submit" className="btn-primary">
            Set parameter
          </button>
        </ActionForm>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">SLA escalation</h2>
        <p className="mt-1 text-xs text-muted">
          There is no scheduled job runner in this phase, so escalation is triggered manually here — in production
          the same check would run on a recurring schedule (e.g. daily).
        </p>
        <p className="mt-3 text-sm">
          Currently <strong>{overdueCount}</strong> approval step(s) have been pending longer than the configured{" "}
          <strong>{slaDays}</strong>-day SLA and haven&apos;t been escalated yet.
        </p>
        <ActionForm action={runSlaEscalationAction} className="mt-3">
          <button type="submit" className="btn-primary">
            Send escalation reminders now
          </button>
        </ActionForm>
      </div>
    </div>
  );
}
