import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ClaimForm } from "./claim-form";
import { createDraftClaimAction } from "@/app/claims/actions";

export default async function NewClaimPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [holidays, projects] = prisma
    ? await Promise.all([
        prisma.holidayCalendarEntry.findMany({ orderBy: { date: "asc" } }),
        prisma.project.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
      ])
    : [[], []];

  return (
    <div>
      <h1 className="text-xl font-semibold">New Claim</h1>
      <p className="mt-1 text-sm text-muted">
        Save as a draft first, then attach supporting documents and submit from the claim page.
      </p>
      <div className="mt-6">
        <ClaimForm
          holidays={holidays.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), name: h.name }))}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          onSubmitAction={createDraftClaimAction}
        />
      </div>
    </div>
  );
}
