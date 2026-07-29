import { policyExceptionReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function PolicyExceptionReportPage() {
  const rows = await policyExceptionReport();

  return <ReportTable rows={rows} csvHref="/api/reports/policy-exception" />;
}
