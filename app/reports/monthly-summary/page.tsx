import { monthlySummary } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function MonthlySummaryReportPage() {
  const rows = await monthlySummary();

  return <ReportTable rows={rows} csvHref="/api/reports/monthly-summary" />;
}
