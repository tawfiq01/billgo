import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ADMIN_ROLES,
  CLAIM_STATUS_LABELS,
  ORG_WIDE_CLAIM_VIEW_ROLES,
  STAGE_ROLE_LABELS,
  type ClaimStatus,
  type StageRole,
} from "@/lib/constants";
import { ActionForm } from "@/components/action-form";
import {
  approvalActionOnStep,
  cancelClaimAction,
  copyClaimAction,
  recordPaymentAction,
  reopenClaimAction,
  submitClaimAction,
  uploadAttachmentAction,
  withdrawClaimAction,
} from "@/app/claims/actions";
import { NavigateOnSuccessButton } from "./navigate-on-success-button";
import { PrintButton } from "@/components/print-button";

const currency = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" });
const dateFmt = (d: Date) => d.toLocaleDateString();
const dateTimeFmt = (d: Date) => d.toLocaleString();

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!prisma) notFound();

  const { id } = await params;
  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true, division: true, manager: true } },
      project: true,
      travelSegments: true,
      expenseLines: true,
      daLines: true,
      faLines: true,
      haLines: true,
      attachments: { include: { uploadedBy: true } },
      approvalSteps: { include: { approver: true, delegatedFrom: true }, orderBy: { createdAt: "asc" } },
      payments: { include: { recordedBy: true } },
    },
  });
  if (!claim) notFound();

  const isOwner = claim.employeeId === user.id;
  const myPendingStep = claim.approvalSteps.find((s) => s.approverId === user.id && s.status === "PENDING");
  // Any step ever assigned to this user (not just PENDING) — an approver
  // must keep read access to a claim after acting on it, not lose it the
  // moment their own step stops being pending.
  const hasAnyStep = claim.approvalSteps.some((s) => s.approverId === user.id);
  const canViewOrgWide = ORG_WIDE_CLAIM_VIEW_ROLES.includes(user.role);
  if (!isOwner && !hasAnyStep && !canViewOrgWide) notFound();

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const noApprovalYet = claim.approvalSteps.every((s) => s.status !== "APPROVED");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{claim.claimNumber ?? "Draft claim"}</h1>
          <p className="mt-1 text-sm text-muted">
            {claim.claimType} · {claim.employee.name} ({claim.employee.employeeId}) ·{" "}
            {claim.employee.department?.name ?? "No department"}
            {claim.employee.division && ` · ${claim.employee.division.name} division`}
            {claim.project && ` · Project: ${claim.project.name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge bg-accent/15 text-accent">
            {CLAIM_STATUS_LABELS[claim.status as ClaimStatus] ?? claim.status}
          </span>
          <PrintButton />
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Summary</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-4">
          <Field label="Purpose" value={claim.purpose} />
          <Field label="Claimed" value={currency.format(claim.totalClaimed)} />
          <Field label="Eligible" value={currency.format(claim.totalEligible)} />
          <Field label="Approved" value={currency.format(claim.totalApproved)} />
          <Field label="Advance" value={currency.format(claim.advanceAmount)} />
          <Field label="Payable" value={currency.format(claim.payableAmount)} />
          <Field label="Submitted" value={claim.submittedAt ? dateFmt(claim.submittedAt) : "—"} />
          {claim.financeNotes && <Field label="Finance notes" value={claim.financeNotes} />}
        </dl>
      </div>

      {claim.travelSegments.length > 0 && (
        <TableCard title="Travel segments (TA)">
          <thead>
            <tr>
              <th>Origin</th>
              <th>Destination</th>
              <th>Departure</th>
              <th>Return</th>
              <th>Mode</th>
              <th>Fare</th>
            </tr>
          </thead>
          <tbody>
            {claim.travelSegments.map((t) => (
              <tr key={t.id}>
                <td>{t.origin}</td>
                <td>{t.destination}</td>
                <td>{dateTimeFmt(t.departureAt)}</td>
                <td>{dateTimeFmt(t.returnAt)}</td>
                <td>{t.mode}</td>
                <td>{currency.format(t.fare)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {claim.expenseLines.length > 0 && (
        <TableCard title="Expense lines">
          <thead>
            <tr>
              <th>Category</th>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {claim.expenseLines.map((e) => (
              <tr key={e.id}>
                <td>{e.category}</td>
                <td>{dateFmt(e.date)}</td>
                <td>{e.description}</td>
                <td>{currency.format(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {claim.daLines.length > 0 && (
        <TableCard title="Daily Allowance (DA)">
          <thead>
            <tr>
              <th>Location</th>
              <th>From</th>
              <th>To</th>
              <th>Days</th>
              <th>Rate</th>
              <th>Entitled</th>
            </tr>
          </thead>
          <tbody>
            {claim.daLines.map((d) => (
              <tr key={d.id}>
                <td>{d.locationCategory}</td>
                <td>{dateTimeFmt(d.fromDate)}</td>
                <td>{dateTimeFmt(d.toDate)}</td>
                <td>{d.durationDays}</td>
                <td>{currency.format(d.rateApplied)}</td>
                <td>{currency.format(d.entitledAmount)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {claim.faLines.length > 0 && (
        <TableCard title="Food Allowance (FA)">
          <thead>
            <tr>
              <th>Location</th>
              <th>From</th>
              <th>To</th>
              <th>Days</th>
              <th>Rate</th>
              <th>Entitled</th>
            </tr>
          </thead>
          <tbody>
            {claim.faLines.map((f) => (
              <tr key={f.id}>
                <td>{f.locationCategory}</td>
                <td>{dateTimeFmt(f.fromDate)}</td>
                <td>{dateTimeFmt(f.toDate)}</td>
                <td>{f.durationDays}</td>
                <td>{currency.format(f.rateApplied)}</td>
                <td>{currency.format(f.entitledAmount)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {claim.haLines.length > 0 && (
        <TableCard title="Holiday Allowance (HA)">
          <thead>
            <tr>
              <th>Holiday</th>
              <th>Hours</th>
              <th>Full day</th>
              <th>Rate</th>
              <th>Payable</th>
            </tr>
          </thead>
          <tbody>
            {claim.haLines.map((h) => (
              <tr key={h.id}>
                <td>
                  {dateFmt(h.holidayDate)} ({h.holidayType})
                </td>
                <td>{h.workedHours}</td>
                <td>{h.isFullDay ? "Yes" : "No"}</td>
                <td>{currency.format(h.rateApplied)}</td>
                <td>{currency.format(h.payableAmount)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <div className="card">
        <h2 className="text-sm font-semibold">Attachments</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {claim.attachments.map((a) => (
            <li key={a.id}>
              <a href={`/api/attachments/${a.id}`} className="text-accent hover:underline">
                {a.filename}
              </a>{" "}
              <span className="text-xs text-muted">
                uploaded by {a.uploadedBy.name} on {dateFmt(a.createdAt)}
              </span>
            </li>
          ))}
          {claim.attachments.length === 0 && <li className="text-muted">No attachments yet.</li>}
        </ul>

        {isOwner && claim.status === "DRAFT" && (
          <ActionForm
            action={uploadAttachmentAction.bind(null, claim.id)}
            className="mt-4 flex items-center gap-3 print:hidden"
          >
            <input suppressHydrationWarning type="file" name="file" required className="text-sm" />
            <button type="submit" className="btn-secondary">
              Upload
            </button>
          </ActionForm>
        )}
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Approval history</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {claim.approvalSteps.map((s) => (
            <li key={s.id} className="border-b border-border pb-2 last:border-0">
              <span className="font-medium">{STAGE_ROLE_LABELS[s.requiredRole as StageRole] ?? s.requiredRole}</span>{" "}
              — {s.status === "SKIPPED" ? "not applicable for this claim" : (s.approver?.name ?? "unassigned")}
              {s.delegatedFrom && (
                <span className="text-muted"> (delegate for {s.delegatedFrom.name})</span>
              )}{" "}
              — <span className="badge bg-background text-muted">{s.status}</span>
              {s.comments && <p className="mt-1 text-muted">&ldquo;{s.comments}&rdquo;</p>}
              {s.actedAt && <p className="mt-1 text-xs text-muted">{dateTimeFmt(s.actedAt)}</p>}
            </li>
          ))}
          {claim.approvalSteps.length === 0 && <li className="text-muted">Not yet submitted.</li>}
        </ul>
      </div>

      {claim.payments.length > 0 && (
        <TableCard title="Payments">
          <thead>
            <tr>
              <th>Method</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Paid on</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {claim.payments.map((p) => (
              <tr key={p.id}>
                <td>{p.method}</td>
                <td>{p.reference ?? "—"}</td>
                <td>{currency.format(p.amount)}</td>
                <td>{p.paidAt ? dateFmt(p.paidAt) : "—"}</td>
                <td>{p.recordedBy.name}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <div className="flex flex-wrap gap-4 print:hidden">
        {isOwner && claim.status === "DRAFT" && (
          <>
            <Link href={`/claims/${claim.id}/edit`} className="btn-secondary">
              Edit draft
            </Link>
            <ActionForm action={submitClaimAction.bind(null, claim.id)}>
              <button type="submit" className="btn-primary">
                Submit claim
              </button>
            </ActionForm>
            <ActionForm action={withdrawClaimAction.bind(null, claim.id)} confirmMessage="Discard this draft?">
              <button type="submit" className="btn-danger">
                Discard draft
              </button>
            </ActionForm>
          </>
        )}

        {isOwner && claim.status === "RETURNED" && (
          <Link href={`/claims/${claim.id}/edit`} className="btn-primary">
            Edit &amp; resubmit
          </Link>
        )}

        {isOwner &&
          noApprovalYet &&
          ["SUBMITTED", "PENDING_MANAGER", "PENDING_DEPT_HEAD"].includes(claim.status) && (
            <ActionForm action={withdrawClaimAction.bind(null, claim.id)} confirmMessage="Withdraw this claim?">
              <button type="submit" className="btn-danger">
                Withdraw claim
              </button>
            </ActionForm>
          )}

        {isOwner && claim.status === "REJECTED" && (
          <NavigateOnSuccessButton action={copyClaimAction.bind(null, claim.id)} label="Copy as new draft" />
        )}
      </div>

      {myPendingStep && (
        <div className="card print:hidden">
          <h2 className="text-sm font-semibold">Your approval</h2>
          <ActionForm action={approvalActionOnStep.bind(null, myPendingStep.id)} className="mt-3 space-y-3">
            <textarea name="comments" className="field-input" placeholder="Comments (required for return/reject)" />
            {myPendingStep.requiredRole === "FINANCE" && (
              <div>
                <label className="field-label">Adjusted approved amount (optional)</label>
                <input suppressHydrationWarning
                  name="financeAdjustedAmount"
                  type="number"
                  step="0.01"
                  className="field-input"
                  placeholder={String(claim.totalEligible)}
                />
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" name="action" value="APPROVE" className="btn-primary">
                Approve
              </button>
              <button type="submit" name="action" value="RETURN" className="btn-secondary">
                Return
              </button>
              <button type="submit" name="action" value="REJECT" className="btn-danger">
                Reject
              </button>
            </div>
          </ActionForm>
        </div>
      )}

      {claim.status === "APPROVED" && (user.role === "PAYMENT_PROCESSOR" || isAdmin) && (
        <div className="card print:hidden">
          <h2 className="text-sm font-semibold">Record payment</h2>
          <ActionForm action={recordPaymentAction.bind(null, claim.id)} className="mt-3 grid gap-3 sm:grid-cols-4">
            <select name="method" className="field-input">
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="MOBILE_BANKING">Mobile banking</option>
              <option value="OTHER">Other</option>
            </select>
            <input suppressHydrationWarning name="reference" className="field-input" placeholder="Reference / transaction #" />
            <input suppressHydrationWarning name="batch" className="field-input" placeholder="Payroll/bank batch (optional)" />
            <input suppressHydrationWarning
              name="amount"
              type="number"
              step="0.01"
              className="field-input"
              defaultValue={claim.payableAmount}
              required
            />
            <div className="sm:col-span-4">
              <button type="submit" className="btn-primary">
                Record payment
              </button>
            </div>
          </ActionForm>
        </div>
      )}

      {(isAdmin || user.role === "FINANCE") && !["PAID", "CLOSED", "CANCELLED"].includes(claim.status) && (
        <div className="card print:hidden">
          <h2 className="text-sm font-semibold">Administrative cancellation</h2>
          <ActionForm action={cancelClaimAction.bind(null, claim.id)} className="mt-3 flex gap-3" confirmMessage="Cancel this claim?">
            <input suppressHydrationWarning name="reason" className="field-input" placeholder="Cancellation reason" required />
            <button type="submit" className="btn-danger">
              Cancel claim
            </button>
          </ActionForm>
        </div>
      )}

      {(isAdmin || user.role === "FINANCE") && ["PAID", "CLOSED"].includes(claim.status) && (
        <div className="card print:hidden">
          <h2 className="text-sm font-semibold">Reopen claim</h2>
          <p className="mt-1 text-xs text-muted">
            For example, if the recorded payment was reversed and needs to be re-issued. The prior payment stays in
            the Payment Register, marked failed.
          </p>
          <ActionForm
            action={reopenClaimAction.bind(null, claim.id)}
            className="mt-3 flex gap-3"
            confirmMessage="Reopen this claim? It will return to Approved status."
          >
            <input suppressHydrationWarning name="reason" className="field-input" placeholder="Reason for reopening" required />
            <button type="submit" className="btn-danger">
              Reopen claim
            </button>
          </ActionForm>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <h2 className="text-sm font-semibold">{title}</h2>
      <table className="table-base mt-2">{children}</table>
    </div>
  );
}
