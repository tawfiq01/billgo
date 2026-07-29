import { statusReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function StatusReportPage() {
  const rows = await statusReport();

  return <ReportTable rows={rows} csvHref="/api/reports/status" />;
}
