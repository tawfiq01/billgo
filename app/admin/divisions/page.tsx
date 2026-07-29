import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { createDivisionAction } from "./actions";

export default async function AdminDivisionsPage() {
  const [divisions, users] = prisma
    ? await Promise.all([
        prisma.division.findMany({ include: { head: true, members: true }, orderBy: { name: "asc" } }),
        prisma.user.findMany({ orderBy: { name: "asc" } }),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        A second organizational axis alongside Department — the approval matrix can route a stage by division too
        (e.g. Division Head), independent of which department an employee sits in.
      </p>

      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Divisions</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Name</th>
              <th>Head</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {divisions.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.head?.name ?? "—"}</td>
                <td>{d.members.length}</td>
              </tr>
            ))}
            {divisions.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-muted">
                  No divisions configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Add division</h2>
        <ActionForm action={createDivisionAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input suppressHydrationWarning name="name" className="field-input" placeholder="Division name" required />
          <select name="headUserId" className="field-input" defaultValue="">
            <option value="">No head assigned yet</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.employeeId})
              </option>
            ))}
          </select>
          <div>
            <button type="submit" className="btn-primary">
              Create division
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
