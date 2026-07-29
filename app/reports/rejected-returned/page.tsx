import { rejectedReturnedAnalysis } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function RejectedReturnedReportPage() {
  const rows = await rejectedReturnedAnalysis();

  return <ReportTable rows={rows} csvHref="/api/reports/rejected-returned" />;
}
