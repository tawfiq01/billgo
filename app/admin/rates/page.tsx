import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import {
  createAllowanceRateAction,
  createFoodAllowanceRateAction,
  createHolidayRateAction,
  deleteAllowanceRateAction,
  deleteFoodAllowanceRateAction,
  deleteHolidayRateAction,
} from "./actions";

const currency = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" });

export default async function AdminRatesPage() {
  const [allowanceRates, foodAllowanceRates, holidayRates] = prisma
    ? await Promise.all([
        prisma.allowanceRate.findMany({ orderBy: [{ grade: "asc" }, { effectiveFrom: "desc" }] }),
        prisma.foodAllowanceRate.findMany({ orderBy: [{ grade: "asc" }, { effectiveFrom: "desc" }] }),
        prisma.holidayRate.findMany({ orderBy: [{ effectiveFrom: "desc" }] }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-8">
      <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        Rates below are illustrative examples — replace with ERA InfoTech&apos;s approved policy figures once the
        rate tables are finalized (BRD Appendix C).
      </p>

      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Daily Allowance (DA) rates</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Location</th>
              <th>Daily rate</th>
              <th>Effective from</th>
              <th>Effective to</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allowanceRates.map((r) => (
              <tr key={r.id}>
                <td>{r.grade}</td>
                <td>{r.locationCategory}</td>
                <td>{currency.format(r.dailyRate)}</td>
                <td>{r.effectiveFrom.toLocaleDateString()}</td>
                <td>{r.effectiveTo ? r.effectiveTo.toLocaleDateString() : "—"}</td>
                <td>
                  <ActionForm action={deleteAllowanceRateAction.bind(null, r.id)} confirmMessage="Delete this rate?">
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Delete
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ActionForm action={createAllowanceRateAction} className="mt-4 grid gap-3 sm:grid-cols-5">
          <input suppressHydrationWarning name="grade" className="field-input" placeholder="Grade (e.g. G4)" required />
          <select name="locationCategory" className="field-input" defaultValue="DOMESTIC">
            <option value="DOMESTIC">Domestic</option>
            <option value="INTERNATIONAL">International</option>
          </select>
          <input suppressHydrationWarning name="dailyRate" type="number" step="0.01" className="field-input" placeholder="Daily rate" required />
          <input suppressHydrationWarning name="effectiveFrom" type="date" className="field-input" required />
          <input suppressHydrationWarning name="effectiveTo" type="date" className="field-input" />
          <div className="sm:col-span-5">
            <button type="submit" className="btn-primary">
              Add DA rate
            </button>
          </div>
        </ActionForm>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Food Allowance (FA) rates</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Location</th>
              <th>Daily rate</th>
              <th>Effective from</th>
              <th>Effective to</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {foodAllowanceRates.map((r) => (
              <tr key={r.id}>
                <td>{r.grade}</td>
                <td>{r.locationCategory}</td>
                <td>{currency.format(r.dailyRate)}</td>
                <td>{r.effectiveFrom.toLocaleDateString()}</td>
                <td>{r.effectiveTo ? r.effectiveTo.toLocaleDateString() : "—"}</td>
                <td>
                  <ActionForm action={deleteFoodAllowanceRateAction.bind(null, r.id)} confirmMessage="Delete this rate?">
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Delete
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ActionForm action={createFoodAllowanceRateAction} className="mt-4 grid gap-3 sm:grid-cols-5">
          <input suppressHydrationWarning name="grade" className="field-input" placeholder="Grade (e.g. G4)" required />
          <select name="locationCategory" className="field-input" defaultValue="DOMESTIC">
            <option value="DOMESTIC">Domestic</option>
            <option value="INTERNATIONAL">International</option>
          </select>
          <input suppressHydrationWarning name="dailyRate" type="number" step="0.01" className="field-input" placeholder="Daily rate" required />
          <input suppressHydrationWarning name="effectiveFrom" type="date" className="field-input" required />
          <input suppressHydrationWarning name="effectiveTo" type="date" className="field-input" />
          <div className="sm:col-span-5">
            <button type="submit" className="btn-primary">
              Add FA rate
            </button>
          </div>
        </ActionForm>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Holiday Allowance (HA) rates</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Rate</th>
              <th>Multiplier</th>
              <th>Effective from</th>
              <th>Effective to</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holidayRates.map((r) => (
              <tr key={r.id}>
                <td>{r.grade ?? "Any"}</td>
                <td>{currency.format(r.rate)}</td>
                <td>{r.multiplier}x</td>
                <td>{r.effectiveFrom.toLocaleDateString()}</td>
                <td>{r.effectiveTo ? r.effectiveTo.toLocaleDateString() : "—"}</td>
                <td>
                  <ActionForm action={deleteHolidayRateAction.bind(null, r.id)} confirmMessage="Delete this rate?">
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Delete
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ActionForm action={createHolidayRateAction} className="mt-4 grid gap-3 sm:grid-cols-5">
          <input suppressHydrationWarning name="grade" className="field-input" placeholder="Grade (blank = any)" />
          <input suppressHydrationWarning name="rate" type="number" step="0.01" className="field-input" placeholder="Rate" required />
          <input suppressHydrationWarning name="multiplier" type="number" step="0.01" className="field-input" placeholder="Multiplier" defaultValue="1" />
          <input suppressHydrationWarning name="effectiveFrom" type="date" className="field-input" required />
          <input suppressHydrationWarning name="effectiveTo" type="date" className="field-input" />
          <div className="sm:col-span-5">
            <button type="submit" className="btn-primary">
              Add HA rate
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
