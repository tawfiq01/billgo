import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const where: Prisma.AuditLogWhereInput = q
    ? { OR: [{ action: { contains: q } }, { entityType: { contains: q } }, { entityId: { contains: q } }] }
    : {};

  const logs = prisma
    ? await prisma.auditLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    : [];

  return (
    <div>
      <h2 className="text-sm font-semibold">Audit log</h2>
      <form method="get" className="mt-3 flex gap-3">
        <input suppressHydrationWarning name="q" defaultValue={q ?? ""} placeholder="Search action / entity type / entity ID" className="field-input w-auto" />
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {logs.map((log) => (
          <details key={log.id} className="card">
            <summary className="cursor-pointer text-sm">
              <span className="font-medium">{log.action}</span> on {log.entityType}
              {log.entityId ? ` (${log.entityId})` : ""} by {log.user?.name ?? "system"} —{" "}
              <span className="text-xs text-muted">{log.createdAt.toLocaleString()}</span>
            </summary>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
              {log.beforeJson && (
                <pre className="overflow-x-auto rounded bg-background p-2">{log.beforeJson}</pre>
              )}
              {log.afterJson && <pre className="overflow-x-auto rounded bg-background p-2">{log.afterJson}</pre>}
            </div>
          </details>
        ))}
        {logs.length === 0 && <p className="text-sm text-muted">No audit entries found.</p>}
      </div>
    </div>
  );
}
