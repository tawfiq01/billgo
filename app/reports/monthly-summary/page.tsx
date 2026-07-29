import Link from "next/link";
import { monthlySummary } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function MonthlySummaryReportPage() {
  const rows = await monthlySummary();

  return (
    <div>
      <Link href="/api/reports/monthly-summary" className="btn-secondary">
        Download CSV
      </Link>
      <div className="mt-6">
        <ReportTable rows={rows} />
      </div>
    </div>
  );
}
