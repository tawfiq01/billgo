import { taxVatReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function TaxVatReportPage() {
  const rows = await taxVatReport();

  return <ReportTable rows={rows} csvHref="/api/reports/tax-vat" />;
}
