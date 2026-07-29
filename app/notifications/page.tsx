import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markAllNotificationsReadAction } from "@/app/actions";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = prisma
    ? await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <form action={markAllNotificationsReadAction}>
          <button type="submit" className="btn-secondary">
            Mark all as read
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-2">
        {notifications.length === 0 && <p className="text-sm text-muted">No notifications yet.</p>}
        {notifications.map((n) => (
          <div key={n.id} className={`card ${n.read ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm">{n.message}</p>
                <p className="mt-1 text-xs text-muted">{n.createdAt.toLocaleString()}</p>
              </div>
              {n.claimId && (
                <Link href={`/claims/${n.claimId}`} className="shrink-0 text-sm text-accent hover:underline">
                  View claim
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
