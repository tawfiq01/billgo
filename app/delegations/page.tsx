import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { createDelegationAction, deleteDelegationAction } from "./actions";

export default async function DelegationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [given, received, users] = prisma
    ? await Promise.all([
        prisma.delegation.findMany({
          where: { delegatorId: user.id },
          include: { delegate: true },
          orderBy: { startDate: "desc" },
        }),
        prisma.delegation.findMany({
          where: { delegateId: user.id },
          include: { delegator: true },
          orderBy: { startDate: "desc" },
        }),
        prisma.user.findMany({ where: { id: { not: user.id }, status: "ACTIVE" }, orderBy: { name: "asc" } }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Delegations</h1>
        <p className="mt-1 text-sm text-muted">
          Delegate your approval authority to someone else for a period (e.g. while you&apos;re on leave). Any claim
          routed to you during that window goes to your delegate instead, and shows in their inbox.
        </p>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Delegate to someone</h2>
        <ActionForm action={createDelegationAction} className="mt-3 grid gap-3 sm:grid-cols-5">
          <select name="delegateId" className="field-input" required>
            <option value="">Choose a delegate…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.employeeId})
              </option>
            ))}
          </select>
          <input suppressHydrationWarning name="startDate" type="date" className="field-input" required />
          <input suppressHydrationWarning name="endDate" type="date" className="field-input" required />
          <input suppressHydrationWarning name="reason" className="field-input" placeholder="Reason (optional)" />
          <button type="submit" className="btn-primary">
            Delegate
          </button>
        </ActionForm>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Delegations you&apos;ve given</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Delegate</th>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {given.map((d) => (
              <tr key={d.id}>
                <td>{d.delegate.name}</td>
                <td>{d.startDate.toLocaleDateString()}</td>
                <td>{d.endDate.toLocaleDateString()}</td>
                <td>{d.reason ?? "—"}</td>
                <td>
                  <ActionForm action={deleteDelegationAction.bind(null, d.id)} confirmMessage="Revoke this delegation?">
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Revoke
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {given.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  You haven&apos;t delegated your authority to anyone.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Delegated to you</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>From</th>
              <th>Start</th>
              <th>End</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {received.map((d) => (
              <tr key={d.id}>
                <td>{d.delegator.name}</td>
                <td>{d.startDate.toLocaleDateString()}</td>
                <td>{d.endDate.toLocaleDateString()}</td>
                <td>{d.reason ?? "—"}</td>
              </tr>
            ))}
            {received.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  No one has delegated their authority to you.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
