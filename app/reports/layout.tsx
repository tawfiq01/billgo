import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { REPORT_ROLES } from "@/lib/constants";

const TABS = [
  { href: "/reports/employee-statement", label: "Employee Claim Statement" },
  { href: "/reports/department-summary", label: "Department-wise Summary" },
  { href: "/reports/monthly-summary", label: "Monthly Summary" },
  { href: "/reports/status", label: "Status Report" },
  { href: "/reports/approval-aging", label: "Approval Aging" },
  { href: "/reports/policy-exception", label: "Policy Exception" },
  { href: "/reports/payment-register", label: "Payment Register" },
  { href: "/reports/advance-adjustment", label: "Advance Adjustment" },
  { href: "/reports/holiday-allowance", label: "Holiday Allowance" },
  { href: "/reports/travel-route-cost", label: "Travel Route & Cost" },
  { href: "/reports/cost-center", label: "Cost Center" },
  { href: "/reports/audit-trail", label: "Audit Trail" },
  { href: "/reports/rejected-returned", label: "Rejected/Returned Analysis" },
  { href: "/reports/tax-vat", label: "Tax/VAT" },
  { href: "/reports/management-dashboard", label: "Management Dashboard" },
];

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!REPORT_ROLES.includes(user.role)) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-xl font-semibold print:hidden">Reports</h1>
      <p className="mt-1 text-sm text-muted print:hidden">
        All 15 of the BRD&apos;s reports (RP-01..RP-15), each exportable to CSV.
      </p>
      <nav className="mt-4 flex flex-wrap gap-4 border-b border-border pb-3 text-sm print:hidden">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="text-muted hover:text-foreground">
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
