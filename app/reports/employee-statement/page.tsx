import Link from "next/link";
import { prisma } from "@/lib/db";
import { employeeClaimStatement } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function EmployeeStatementReportPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const { employeeId } = await searchParams;
  const employees = prisma ? await prisma.user.findMany({ orderBy: { name: "asc" } }) : [];
  const selected = employeeId || employees[0]?.id;
  const rows = selected ? await employeeClaimStatement(selected) : [];

  return (
    <div>
      <form method="get" className="flex flex-wrap items-center gap-3">
        <select name="employeeId" defaultValue={selected} className="field-input w-auto">
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.employeeId})
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          View
        </button>
        {selected && (
          <Link href={`/api/reports/employee-statement?employeeId=${selected}`} className="btn-secondary">
            Download CSV
          </Link>
        )}
      </form>
      <div className="mt-6">
        <ReportTable rows={rows} />
      </div>
    </div>
  );
}
