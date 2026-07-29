import { prisma } from "@/lib/db";
import { HOLIDAY_TYPES } from "@/lib/constants";
import { ActionForm } from "@/components/action-form";
import { createHolidayAction, deleteHolidayAction } from "./actions";

export default async function AdminHolidaysPage() {
  const holidays = prisma ? await prisma.holidayCalendarEntry.findMany({ orderBy: { date: "asc" } }) : [];

  return (
    <div className="space-y-8">
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold">Holiday calendar</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id}>
                <td>{h.date.toLocaleDateString()}</td>
                <td>{h.name}</td>
                <td>{h.type}</td>
                <td>
                  <ActionForm action={deleteHolidayAction.bind(null, h.id)} confirmMessage="Remove this holiday?">
                    <button type="submit" className="text-sm text-danger hover:underline">
                      Delete
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {holidays.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  No holidays configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold">Add holiday</h2>
        <ActionForm action={createHolidayAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input suppressHydrationWarning name="date" type="date" className="field-input" required />
          <input suppressHydrationWarning name="name" className="field-input" placeholder="Holiday name" required />
          <select name="type" className="field-input" defaultValue="NATIONAL">
            {HOLIDAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary">
              Add holiday
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
