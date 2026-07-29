import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { createDepartmentAction } from "./actions";

export default async function AdminDepartmentsPage() {
  const [departments, users] = prisma
    ? await Promise.all([
        prisma.department.findMany({ include: { head: true, members: true }, orderBy: { name: "asc" } }),
        prisma.user.findMany({ orderBy: { name: "asc" } }),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Departments</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Name</th>
              <th>Head</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.head?.name ?? "—"}</td>
                <td>{d.members.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Add department</h2>
        <ActionForm action={createDepartmentAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input suppressHydrationWarning name="name" className="field-input" placeholder="Department name" required />
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
              Create department
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
