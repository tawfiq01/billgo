import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

const TABS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/divisions", label: "Divisions" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/holidays", label: "Holiday Calendar" },
  { href: "/admin/rates", label: "Allowance Rates" },
  { href: "/admin/approval-matrix", label: "Approval Matrix" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ADMIN_ROLES.includes(user.role)) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-xl font-semibold">Administration</h1>
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
