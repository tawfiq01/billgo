import Link from "next/link";
import { departmentSummary } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function DepartmentSummaryReportPage() {
  const rows = await departmentSummary();

  return (
    <div>
      <Link href="/api/reports/department-summary" className="btn-secondary">
        Download CSV
      </Link>
      <div className="mt-6">
        <ReportTable rows={rows} />
      </div>
    </div>
  );
}
