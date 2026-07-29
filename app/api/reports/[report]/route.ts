import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { REPORT_ROLES } from "@/lib/constants";
import {
  approvalAgingReport,
  departmentSummary,
  employeeClaimStatement,
  monthlySummary,
  statusReport,
  toCSV,
} from "@/lib/reports";

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const user = await getCurrentUser();
  if (!user || !REPORT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { report } = await params;
  const { searchParams } = new URL(request.url);

  let rows: Record<string, unknown>[];
  switch (report) {
    case "employee-statement": {
      const employeeId = searchParams.get("employeeId");
      if (!employeeId) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
      rows = await employeeClaimStatement(employeeId);
      break;
    }
    case "department-summary":
      rows = await departmentSummary();
      break;
    case "monthly-summary":
      rows = await monthlySummary();
      break;
    case "status":
      rows = await statusReport();
      break;
    case "approval-aging":
      rows = await approvalAgingReport();
      break;
    default:
      return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }

  return new NextResponse(toCSV(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report}.csv"`,
    },
  });
}
