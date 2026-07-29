import { holidayAllowanceReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function HolidayAllowanceReportPage() {
  const rows = await holidayAllowanceReport();

  return <ReportTable rows={rows} csvHref="/api/reports/holiday-allowance" />;
}
