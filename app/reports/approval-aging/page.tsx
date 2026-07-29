import Link from "next/link";
import { approvalAgingReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function ApprovalAgingReportPage() {
  const rows = await approvalAgingReport();

  return (
    <div>
      <Link href="/api/reports/approval-aging" className="btn-secondary">
        Download CSV
      </Link>
      <div className="mt-6">
        <ReportTable rows={rows} />
      </div>
    </div>
  );
}
