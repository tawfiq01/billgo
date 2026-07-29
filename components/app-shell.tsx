import Image from "next/image";
import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { ADMIN_ROLES, REPORT_ROLES, ROLE_LABELS } from "@/lib/constants";
import { getPendingApprovalCount, getUnreadNotificationCount } from "@/lib/queries";
import { logoutAction } from "@/app/actions";

export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [pendingApprovals, unreadNotifications] = await Promise.all([
    getPendingApprovalCount(user.id),
    getUnreadNotificationCount(user.id),
  ]);

  // Approvers are resolved by relationship (manager/dept/division/project
  // head) or Role, not by the viewer's own formal role — so show the link
  // whenever they actually have something pending, not by role membership.
  const isApprover = pendingApprovals > 0;
  const isAdmin = ADMIN_ROLES.includes(user.role);
  const canViewReports = REPORT_ROLES.includes(user.role);

  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Billgo" width={101} height={72} priority className="h-8 w-auto" />
            <span className="text-lg font-semibold tracking-tight">Billgo</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-5 text-sm text-muted">
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/claims" className="hover:text-foreground">
              My Claims
            </Link>
            <Link href="/claims/new" className="hover:text-foreground">
              New Claim
            </Link>
            {isApprover && (
              <Link href="/approvals" className="hover:text-foreground">
                Approvals
                {pendingApprovals > 0 && (
                  <span className="badge ml-1 bg-accent/15 text-accent">{pendingApprovals}</span>
                )}
              </Link>
            )}
            {canViewReports && (
              <Link href="/reports" className="hover:text-foreground">
                Reports
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/users" className="hover:text-foreground">
                Admin
              </Link>
            )}
            <Link href="/notifications" className="hover:text-foreground">
              Notifications
              {unreadNotifications > 0 && (
                <span className="badge ml-1 bg-danger/15 text-danger">{unreadNotifications}</span>
              )}
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
