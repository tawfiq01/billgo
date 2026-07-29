import { managementDashboardKPIs, managementDashboardTopCategories } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function ManagementDashboardReportPage() {
  const [kpis, topCategories] = await Promise.all([
    managementDashboardKPIs(),
    managementDashboardTopCategories(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <ReportTable rows={kpis} csvHref="/api/reports/management-dashboard" />
      </div>

      <div>
        <h2 className="text-sm font-semibold">Top expense categories</h2>
        <div className="mt-2">
          <ReportTable rows={topCategories} />
        </div>
      </div>
    </div>
  );
}
