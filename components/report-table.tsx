import Link from "next/link";
import { PrintButton } from "@/components/print-button";

export function ReportTable({ rows, csvHref }: { rows: Record<string, unknown>[]; csvHref?: string }) {
  return (
    <div>
      {csvHref && (
        <div className="mb-4 flex gap-3 print:hidden">
          <Link href={csvHref} className="btn-secondary">
            Download CSV
          </Link>
          <PrintButton />
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No data for this report yet.</p>
      ) : (
        <TableBody rows={rows} />
      )}
    </div>
  );
}

function TableBody({ rows }: { rows: Record<string, unknown>[] }) {
  const headers = Object.keys(rows[0]);

  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {headers.map((h) => (
                <td key={h}>{String(row[h] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
