import { departmentSummary } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function DepartmentSummaryReportPage() {
  const rows = await departmentSummary();

  return <ReportTable rows={rows} csvHref="/api/reports/department-summary" />;
}
