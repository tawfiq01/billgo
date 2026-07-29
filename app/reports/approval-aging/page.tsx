import { approvalAgingReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function ApprovalAgingReportPage() {
  const rows = await approvalAgingReport();

  return <ReportTable rows={rows} csvHref="/api/reports/approval-aging" />;
}
