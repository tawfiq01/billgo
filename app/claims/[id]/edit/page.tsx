import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ClaimType } from "@/lib/constants";
import { ClaimForm, type ClaimFormInitial } from "@/app/claims/new/claim-form";
import { resubmitClaimAction, updateDraftClaimAction } from "@/app/claims/actions";

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function EditClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!prisma) notFound();

  const { id } = await params;
  const claim = await prisma.claim.findUnique({
    where: { id },
    include: { travelSegments: true, expenseLines: true, daLines: true, faLines: true, haLines: true },
  });
  if (!claim) notFound();
  if (claim.employeeId !== user.id) notFound();
  if (!["DRAFT", "RETURNED"].includes(claim.status)) redirect(`/claims/${id}`);

  const [holidays, projects] = await Promise.all([
    prisma.holidayCalendarEntry.findMany({ orderBy: { date: "asc" } }),
    // Not filtered to ACTIVE here (unlike the new-claim form) so an already-linked
    // project still shows correctly if it's since been deactivated.
    prisma.project.findMany({ orderBy: { name: "asc" } }),
  ]);
  const holidayIdByTime = new Map(holidays.map((h) => [h.date.getTime(), h.id]));

  const initial: ClaimFormInitial = {
    claimType: claim.claimType as ClaimType,
    purpose: claim.purpose,
    advanceAmount: String(claim.advanceAmount),
    projectId: claim.projectId ?? "",
    travelSegments: claim.travelSegments.map((t) => ({
      origin: t.origin,
      destination: t.destination,
      departureAt: toDatetimeLocal(t.departureAt),
      returnAt: toDatetimeLocal(t.returnAt),
      mode: t.mode,
      travelClass: t.travelClass ?? "",
      distanceKm: t.distanceKm != null ? String(t.distanceKm) : "",
      ticketNumber: t.ticketNumber ?? "",
      fare: String(t.fare),
      remarks: t.remarks ?? "",
    })),
    expenseLines: claim.expenseLines.map((e) => ({
      category: e.category,
      date: toDateInput(e.date),
      description: e.description ?? "",
      amount: String(e.amount),
      taxAmount: String(e.taxAmount),
    })),
    daLines: claim.daLines.map((d) => ({
      locationCategory: d.locationCategory,
      fromDate: toDatetimeLocal(d.fromDate),
      toDate: toDatetimeLocal(d.toDate),
      deduction: String(d.deduction),
    })),
    faLines: claim.faLines.map((f) => ({
      locationCategory: f.locationCategory,
      fromDate: toDatetimeLocal(f.fromDate),
      toDate: toDatetimeLocal(f.toDate),
      deduction: String(f.deduction),
    })),
    haLines: claim.haLines.map((h) => ({
      holidayCalendarEntryId: holidayIdByTime.get(h.holidayDate.getTime()) ?? "",
      workedHours: String(h.workedHours),
      isFullDay: h.isFullDay,
      evidenceNote: h.evidenceNote ?? "",
    })),
  };

  const isResubmit = claim.status === "RETURNED";
  const action = isResubmit ? resubmitClaimAction.bind(null, id) : updateDraftClaimAction.bind(null, id);

  return (
    <div>
      <h1 className="text-xl font-semibold">{isResubmit ? "Edit & Resubmit Claim" : "Edit Draft Claim"}</h1>
      <div className="mt-6">
        <ClaimForm
          holidays={holidays.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), name: h.name }))}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          initial={initial}
          onSubmitAction={action}
          submitLabel={isResubmit ? "Resubmit claim" : "Save changes"}
        />
      </div>
    </div>
  );
}
