import { prisma } from "@/lib/db";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { ActionForm } from "@/components/action-form";
import { createUserAction, toggleUserStatusAction } from "./actions";

export default async function AdminUsersPage() {
  const [users, departments, divisions] = prisma
    ? await Promise.all([
        prisma.user.findMany({ include: { department: true, division: true, manager: true }, orderBy: { employeeId: "asc" } }),
        prisma.department.findMany({ orderBy: { name: "asc" } }),
        prisma.division.findMany({ orderBy: { name: "asc" } }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-8">
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Users</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Division</th>
              <th>Manager</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.employeeId}</td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</td>
                <td>{u.department?.name ?? "—"}</td>
                <td>{u.division?.name ?? "—"}</td>
                <td>{u.manager?.name ?? "—"}</td>
                <td>
                  <span className={`badge ${u.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                    {u.status}
                  </span>
                </td>
                <td>
                  <ActionForm action={toggleUserStatusAction.bind(null, u.id)}>
                    <button type="submit" className="text-sm text-accent hover:underline">
                      {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Add user</h2>
        <ActionForm action={createUserAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input suppressHydrationWarning name="employeeId" className="field-input" placeholder="Employee ID" required />
          <input suppressHydrationWarning name="name" className="field-input" placeholder="Full name" required />
          <input suppressHydrationWarning name="email" type="email" className="field-input" placeholder="Email" required />
          <input suppressHydrationWarning name="password" type="password" className="field-input" placeholder="Password" required />
          <select name="role" className="field-input" required defaultValue="EMPLOYEE">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select name="departmentId" className="field-input" defaultValue="">
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="divisionId" className="field-input" defaultValue="">
            <option value="">No division</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="managerId" className="field-input" defaultValue="">
            <option value="">No manager</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.employeeId})
              </option>
            ))}
          </select>
          <input suppressHydrationWarning name="designation" className="field-input" placeholder="Designation" />
          <input suppressHydrationWarning name="grade" className="field-input" placeholder="Grade (e.g. G3)" />
          <input suppressHydrationWarning name="costCenter" className="field-input" placeholder="Cost center" />
          <input suppressHydrationWarning name="location" className="field-input" placeholder="Location" />
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary">
              Create user
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
