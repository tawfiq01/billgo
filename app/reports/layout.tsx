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
];

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!REPORT_ROLES.includes(user.role)) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-muted">
        Phase 1 covers 5 of the BRD&apos;s 15 reports (RP-01..RP-05) — the rest are planned for Phase 2.
      </p>
      <nav className="mt-4 flex flex-wrap gap-4 border-b border-border pb-3 text-sm">
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
