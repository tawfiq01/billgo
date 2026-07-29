import { advanceAdjustmentReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function AdvanceAdjustmentReportPage() {
  const rows = await advanceAdjustmentReport();

  return <ReportTable rows={rows} csvHref="/api/reports/advance-adjustment" />;
}
