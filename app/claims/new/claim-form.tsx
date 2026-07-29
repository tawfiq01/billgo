"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { CLAIM_TYPES, EXPENSE_CATEGORIES, type ClaimType } from "@/lib/constants";

type TravelRow = {
  origin: string;
  destination: string;
  departureAt: string;
  returnAt: string;
  mode: string;
  travelClass: string;
  distanceKm: string;
  ticketNumber: string;
  fare: string;
  remarks: string;
};

type ExpenseRow = {
  category: string;
  date: string;
  description: string;
  amount: string;
  taxAmount: string;
};

type DARow = {
  locationCategory: string;
  fromDate: string;
  toDate: string;
  deduction: string;
};

type FARow = DARow;

type HARow = {
  holidayCalendarEntryId: string;
  workedHours: string;
  isFullDay: boolean;
  evidenceNote: string;
};

export type ClaimFormInitial = {
  claimType: ClaimType;
  purpose: string;
  advanceAmount: string;
  projectId: string;
  travelSegments: TravelRow[];
  expenseLines: ExpenseRow[];
  daLines: DARow[];
  faLines: FARow[];
  haLines: HARow[];
};

const emptyTravel: TravelRow = {
  origin: "",
  destination: "",
  departureAt: "",
  returnAt: "",
  mode: "AIR",
  travelClass: "",
  distanceKm: "",
  ticketNumber: "",
  fare: "0",
  remarks: "",
};
const emptyExpense: ExpenseRow = { category: "OTHER", date: "", description: "", amount: "0", taxAmount: "0" };
const emptyDA: DARow = { locationCategory: "DOMESTIC", fromDate: "", toDate: "", deduction: "0" };
const emptyFA: FARow = { locationCategory: "DOMESTIC", fromDate: "", toDate: "", deduction: "0" };
const emptyHA: HARow = { holidayCalendarEntryId: "", workedHours: "8", isFullDay: true, evidenceNote: "" };

export function ClaimForm({
  holidays,
  projects,
  initial,
  onSubmitAction,
  submitLabel = "Save Draft",
}: {
  holidays: { id: string; date: string; name: string }[];
  projects: { id: string; name: string }[];
  initial?: ClaimFormInitial;
  onSubmitAction: (input: unknown) => Promise<ActionResult<{ claimId: string }>>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [claimType, setClaimType] = useState<ClaimType>(initial?.claimType ?? "TA");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [advanceAmount, setAdvanceAmount] = useState(initial?.advanceAmount ?? "0");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [travelSegments, setTravelSegments] = useState<TravelRow[]>(initial?.travelSegments ?? []);
  const [expenseLines, setExpenseLines] = useState<ExpenseRow[]>(initial?.expenseLines ?? []);
  const [daLines, setDaLines] = useState<DARow[]>(initial?.daLines ?? []);
  const [faLines, setFaLines] = useState<FARow[]>(initial?.faLines ?? []);
  const [haLines, setHaLines] = useState<HARow[]>(initial?.haLines ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const input = {
        claimType,
        purpose,
        advanceAmount,
        projectId: projectId || undefined,
        travelSegments,
        expenseLines,
        daLines,
        faLines,
        haLines: haLines.map((h) => ({ ...h, evidenceNote: h.evidenceNote || undefined })),
      };
      const result = await onSubmitAction(input);
      if (!result.ok) {
        setError(result.error);
      } else {
        router.push(`/claims/${result.claimId}`);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="card grid gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label">Claim type</label>
          <select
            className="field-input"
            value={claimType}
            onChange={(e) => setClaimType(e.target.value as ClaimType)}
          >
            {CLAIM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Purpose</label>
          <input suppressHydrationWarning
            className="field-input"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            placeholder="e.g. Client workshop in Chattogram"
          />
        </div>
        <div>
          <label className="field-label">Advance already received</label>
          <input suppressHydrationWarning
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            value={advanceAmount}
            onChange={(e) => setAdvanceAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Project (optional)</label>
          <select className="field-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Linking a project enables a Project Manager approval stage, if configured in the approval matrix.
          </p>
        </div>
      </div>

      <Section title="Travel segments (TA)">
        {travelSegments.map((row, i) => (
          <div key={i} className="grid gap-2 border-b border-border py-3 sm:grid-cols-8">
            <input suppressHydrationWarning
              className="field-input sm:col-span-2"
              placeholder="Origin"
              value={row.origin}
              onChange={(e) => updateRow(setTravelSegments, i, { origin: e.target.value })}
              required
            />
            <input suppressHydrationWarning
              className="field-input sm:col-span-2"
              placeholder="Destination"
              value={row.destination}
              onChange={(e) => updateRow(setTravelSegments, i, { destination: e.target.value })}
              required
            />
            <input suppressHydrationWarning
              className="field-input"
              type="datetime-local"
              value={row.departureAt}
              onChange={(e) => updateRow(setTravelSegments, i, { departureAt: e.target.value })}
              required
            />
            <input suppressHydrationWarning
              className="field-input"
              type="datetime-local"
              value={row.returnAt}
              onChange={(e) => updateRow(setTravelSegments, i, { returnAt: e.target.value })}
              required
            />
            <select
              className="field-input"
              value={row.mode}
              onChange={(e) => updateRow(setTravelSegments, i, { mode: e.target.value })}
            >
              {["AIR", "TRAIN", "BUS", "CAR", "OTHER"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input suppressHydrationWarning
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Fare"
              value={row.fare}
              onChange={(e) => updateRow(setTravelSegments, i, { fare: e.target.value })}
            />
            <button type="button" className="btn-secondary" onClick={() => removeRow(setTravelSegments, i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary mt-3" onClick={() => setTravelSegments((r) => [...r, { ...emptyTravel }])}>
          + Add travel segment
        </button>
      </Section>

      <Section title="Expense lines">
        {expenseLines.map((row, i) => (
          <div key={i} className="grid gap-2 border-b border-border py-3 sm:grid-cols-6">
            <select
              className="field-input"
              value={row.category}
              onChange={(e) => updateRow(setExpenseLines, i, { category: e.target.value })}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input suppressHydrationWarning
              className="field-input"
              type="date"
              value={row.date}
              onChange={(e) => updateRow(setExpenseLines, i, { date: e.target.value })}
              required
            />
            <input suppressHydrationWarning
              className="field-input sm:col-span-2"
              placeholder="Description"
              value={row.description}
              onChange={(e) => updateRow(setExpenseLines, i, { description: e.target.value })}
            />
            <input suppressHydrationWarning
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              value={row.amount}
              onChange={(e) => updateRow(setExpenseLines, i, { amount: e.target.value })}
              required
            />
            <button type="button" className="btn-secondary" onClick={() => removeRow(setExpenseLines, i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary mt-3" onClick={() => setExpenseLines((r) => [...r, { ...emptyExpense }])}>
          + Add expense line
        </button>
      </Section>

      <Section title="Daily Allowance (DA) lines">
        {daLines.map((row, i) => (
          <div key={i} className="grid gap-2 border-b border-border py-3 sm:grid-cols-6">
            <select
              className="field-input"
              value={row.locationCategory}
              onChange={(e) => updateRow(setDaLines, i, { locationCategory: e.target.value })}
            >
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
            </select>
            <input suppressHydrationWarning
              className="field-input sm:col-span-2"
              type="datetime-local"
              value={row.fromDate}
              onChange={(e) => updateRow(setDaLines, i, { fromDate: e.target.value })}
              required
            />
            <input suppressHydrationWarning
              className="field-input sm:col-span-2"
              type="datetime-local"
              value={row.toDate}
              onChange={(e) => updateRow(setDaLines, i, { toDate: e.target.value })}
              required
            />
            <button type="button" className="btn-secondary" onClick={() => removeRow(setDaLines, i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary mt-3" onClick={() => setDaLines((r) => [...r, { ...emptyDA }])}>
          + Add DA line
        </button>
        <p className="mt-2 text-xs text-muted">
          The daily rate and entitlement are calculated automatically from the admin-configured allowance rates once saved.
        </p>
      </Section>

      <Section title="Food Allowance (FA) lines">
        {faLines.map((row, i) => (
          <div key={i} className="grid gap-2 border-b border-border py-3 sm:grid-cols-6">
            <select
              className="field-input"
              value={row.locationCategory}
              onChange={(e) => updateRow(setFaLines, i, { locationCategory: e.target.value })}
            >
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
            </select>
            <input suppressHydrationWarning
              className="field-input sm:col-span-2"
              type="datetime-local"
              value={row.fromDate}
              onChange={(e) => updateRow(setFaLines, i, { fromDate: e.target.value })}
              required
            />
            <input suppressHydrationWarning
              className="field-input sm:col-span-2"
              type="datetime-local"
              value={row.toDate}
              onChange={(e) => updateRow(setFaLines, i, { toDate: e.target.value })}
              required
            />
            <button type="button" className="btn-secondary" onClick={() => removeRow(setFaLines, i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary mt-3" onClick={() => setFaLines((r) => [...r, { ...emptyFA }])}>
          + Add FA line
        </button>
        <p className="mt-2 text-xs text-muted">
          The daily food allowance rate and entitlement are calculated automatically from the admin-configured rates once saved.
        </p>
      </Section>

      <Section title="Holiday Allowance (HA) lines">
        {haLines.map((row, i) => (
          <div key={i} className="grid gap-2 border-b border-border py-3 sm:grid-cols-6">
            <select
              className="field-input sm:col-span-2"
              value={row.holidayCalendarEntryId}
              onChange={(e) => updateRow(setHaLines, i, { holidayCalendarEntryId: e.target.value })}
              required
            >
              <option value="">Select a configured holiday…</option>
              {holidays.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.date} — {h.name}
                </option>
              ))}
            </select>
            <input suppressHydrationWarning
              className="field-input"
              type="number"
              min="0"
              max="24"
              placeholder="Hours worked"
              value={row.workedHours}
              onChange={(e) => updateRow(setHaLines, i, { workedHours: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input suppressHydrationWarning
                type="checkbox"
                checked={row.isFullDay}
                onChange={(e) => updateRow(setHaLines, i, { isFullDay: e.target.checked })}
              />
              Full day
            </label>
            <input suppressHydrationWarning
              className="field-input sm:col-span-2"
              placeholder="Evidence / attendance note"
              value={row.evidenceNote}
              onChange={(e) => updateRow(setHaLines, i, { evidenceNote: e.target.value })}
            />
            <button type="button" className="btn-secondary" onClick={() => removeRow(setHaLines, i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary mt-3" onClick={() => setHaLines((r) => [...r, { ...emptyHA }])}>
          + Add HA line
        </button>
        {holidays.length === 0 && (
          <p className="mt-2 text-xs text-warning">
            No holiday calendar entries are configured yet — ask an administrator to add one under Admin → Holidays.
          </p>
        )}
      </Section>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function updateRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) {
  setter((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
}

function removeRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) {
  setter((rows) => rows.filter((_, i) => i !== index));
}
