import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { createProjectAction, toggleProjectStatusAction } from "./actions";

export default async function AdminProjectsPage() {
  const [projects, users] = prisma
    ? await Promise.all([
        prisma.project.findMany({ include: { projectManager: true }, orderBy: { name: "asc" } }),
        prisma.user.findMany({ orderBy: { name: "asc" } }),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        Each project has one project manager. Claims can optionally be tied to a project (see New Claim), which
        enables a Project Manager approval stage in the matrix — routed to that project&apos;s manager, and skipped
        automatically for claims not linked to any project.
      </p>

      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Projects</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Project Manager</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.code ?? "—"}</td>
                <td>{p.projectManager.name}</td>
                <td>
                  <span
                    className={`badge ${p.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td>
                  <ActionForm action={toggleProjectStatusAction.bind(null, p.id)}>
                    <button type="submit" className="text-sm text-accent hover:underline">
                      {p.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  No projects configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Add project</h2>
        <ActionForm action={createProjectAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input suppressHydrationWarning name="name" className="field-input" placeholder="Project name" required />
          <input suppressHydrationWarning name="code" className="field-input" placeholder="Project code (optional)" />
          <select name="projectManagerId" className="field-input" defaultValue="" required>
            <option value="" disabled>
              Select project manager
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.employeeId})
              </option>
            ))}
          </select>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary">
              Create project
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
