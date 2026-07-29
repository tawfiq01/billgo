import { auditTrailReport } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function AuditTrailReportPage() {
  const rows = await auditTrailReport();

  return (
    <div>
      <p className="mb-4 text-sm text-muted print:hidden">
        Most recent 500 entries. For full search/filtering, see Admin → Audit Log.
      </p>
      <ReportTable rows={rows} csvHref="/api/reports/audit-trail" />
    </div>
  );
}
