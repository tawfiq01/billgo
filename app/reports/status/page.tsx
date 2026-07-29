import Link from "next/link";
import { statusReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function StatusReportPage() {
  const rows = await statusReport();

  return (
    <div>
      <Link href="/api/reports/status" className="btn-secondary">
        Download CSV
      </Link>
      <div className="mt-6">
        <ReportTable rows={rows} />
      </div>
    </div>
  );
}
