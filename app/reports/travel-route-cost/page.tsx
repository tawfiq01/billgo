import { travelRouteCostReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function TravelRouteCostReportPage() {
  const rows = await travelRouteCostReport();

  return <ReportTable rows={rows} csvHref="/api/reports/travel-route-cost" />;
}
