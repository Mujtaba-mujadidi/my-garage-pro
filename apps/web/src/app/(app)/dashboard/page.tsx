import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusChip } from "@/components/dashboard/status-chip";

const DEMO_JOBS = [
  { reg: "AB12 CDE", customer: "A. Khan", job: "Brake pads", status: "progress" as const },
  { reg: "LM71 XYZ", customer: "City Cabs", job: "Service", status: "parts" as const },
  { reg: "YK20 ABC", customer: "S. Ali", job: "Diagnostics", status: "ready" as const },
];

export default function DashboardPage() {
  return (
    <>
      <p className="mb-2 text-xs text-[var(--muted)]">
        Home / <span className="text-accent">Dashboard</span>
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
        >
          This week ▾
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Today's profit" value="£2,840" delta="+12%" deltaTone="up" />
        <KpiCard label="Open repair jobs" value="14" delta="4 awaiting parts" deltaTone="warn" />
        <KpiCard label="Unpaid invoices" value="£6,200" delta="3 overdue" deltaTone="down" />
        <KpiCard label="Cars in stock" value="9" delta="2 sold this week" deltaTone="up" />
        <KpiCard label="Expenses to approve" value="5" delta="Needs you" deltaTone="warn" />
        <KpiCard label="Low stock alerts" value="7" delta="Tyres & parts" deltaTone="warn" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Open repair jobs</h2>
            <span className="text-xs font-semibold text-accent">See all</span>
          </div>
          <table className="w-full text-sm text-[var(--foreground)]">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase text-[var(--muted)]">
                <th className="px-4 py-2">Reg</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_JOBS.map((row) => (
                <tr key={row.reg} className="border-b border-[var(--border)]">
                  <td className="px-4 py-2.5 font-mono font-semibold">{row.reg}</td>
                  <td className="px-4 py-2.5">{row.customer}</td>
                  <td className="px-4 py-2.5">{row.job}</td>
                  <td className="px-4 py-2.5">
                    <StatusChip variant={row.status}>
                      {row.status === "progress"
                        ? "In progress"
                        : row.status === "parts"
                          ? "Awaiting parts"
                          : "Ready"}
                    </StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            This week — income vs expenses
          </h2>
          <div className="flex h-28 items-end justify-between gap-2">
            {[
              { a: 72, b: 48 },
              { a: 85, b: 55 },
              { a: 60, b: 70 },
              { a: 90, b: 42 },
              { a: 78, b: 50 },
            ].map((bar, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 items-end gap-0.5">
                  <div
                    className="w-3 rounded-t bg-[var(--chart-a)]"
                    style={{ height: `${bar.a}%` }}
                  />
                  <div
                    className="w-3 rounded-t bg-[var(--chart-b)]"
                    style={{ height: `${bar.b}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--muted)]">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"][i]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-[var(--muted)]">
            <span>
              <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--chart-a)]" />
              Income
            </span>
            <span>
              <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--chart-b)]" />
              Expenses
            </span>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-[var(--muted)]">
        Demo data — live KPIs connect in Phase 13. API health:{" "}
        <a href="/api/backend/health" className="text-accent hover:underline">
          /api/backend/health
        </a>
      </p>
    </>
  );
}
