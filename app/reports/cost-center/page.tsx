import { costCenterReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function CostCenterReportPage() {
  const rows = await costCenterReport();

  return <ReportTable rows={rows} csvHref="/api/reports/cost-center" />;
}
