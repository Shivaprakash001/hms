"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/providers";

// Owner-facing settlement labels (mirror service constants exactly).
const STATUS_LABEL: Record<string, string> = {
  PENDING_SETTLEMENT: "Pending Settlement",
  TRANSFER_IN_PROGRESS: "Transfer In Progress",
  SETTLED: "Settled",
  SETTLEMENT_DELAYED: "Settlement Delayed",
};
const STATUS_CLASS: Record<string, string> = {
  PENDING_SETTLEMENT: "bg-amber-100 text-amber-800 border-amber-200",
  TRANSFER_IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  SETTLED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  SETTLEMENT_DELAYED: "bg-rose-100 text-rose-800 border-rose-200",
};

function inr(amount: string | number) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);
}

type Summary = {
  total_collected: { amount: string; collection_count: number };
  pending_settlement: { amount: string };
  settled_payouts: { amount: string; transfer_count: number };
  recent_transfers: { amount: string; transfer_count: number; window_days: number };
  hostel_count: number;
};
type Collection = {
  id: string;
  amount: string;
  collected_at: string;
  hostel_id: string;
  payment_id: string | null;
  settlement_status: string;
};
type HostelRow = {
  hostel_id: string;
  lifetime_collected: string;
  lifetime_settled: string;
  pending: string;
  uncovered_credit_count: number;
  in_progress_credit_count: number;
};

export default function OwnerFinancePage() {
  const { user } = useAuth();

  const summaryQ = useQuery({
    queryKey: ["owner-finance-summary"],
    queryFn: () => api.get<{ summary: Summary }>("/owner/finance/summary"),
    enabled: !!user,
  });
  const collectionsQ = useQuery({
    queryKey: ["owner-finance-collections"],
    queryFn: () => api.get<{ collections: Collection[] }>("/owner/finance/collections", { limit: 25 }),
    enabled: !!user,
  });
  const byHostelQ = useQuery({
    queryKey: ["owner-finance-by-hostel"],
    queryFn: () => api.get<{ hostels: HostelRow[] }>("/owner/finance/by-hostel"),
    enabled: !!user,
  });

  const s = summaryQ.data?.summary;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Finance</h1>
          <p className="text-sm text-gray-500">
            Money collected from tenants, what's pending settlement to you, and
            what HMS has already transferred.
          </p>
        </div>
        <Link
          href="/owner/finance/transfers"
          className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
        >
          View transfers →
        </Link>
      </header>

      {/* Summary tiles */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          label="Total Collected"
          value={s ? inr(s.total_collected.amount) : "—"}
          sub={s ? `${s.total_collected.collection_count} collections` : ""}
          loading={summaryQ.isLoading}
          accent="text-gray-900"
        />
        <Tile
          label="Pending Settlement"
          value={s ? inr(s.pending_settlement.amount) : "—"}
          sub="To be transferred to you"
          loading={summaryQ.isLoading}
          accent="text-amber-700"
        />
        <Tile
          label="Settled Payouts"
          value={s ? inr(s.settled_payouts.amount) : "—"}
          sub={s ? `${s.settled_payouts.transfer_count} transfers` : ""}
          loading={summaryQ.isLoading}
          accent="text-emerald-700"
        />
        <Tile
          label={`Last ${s?.recent_transfers.window_days ?? 30} days`}
          value={s ? inr(s.recent_transfers.amount) : "—"}
          sub={s ? `${s.recent_transfers.transfer_count} recent transfers` : ""}
          loading={summaryQ.isLoading}
          accent="text-blue-700"
        />
      </section>

      {/* By-hostel breakdown */}
      <section>
        <h2 className="text-lg font-semibold mb-3">By Hostel</h2>
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Hostel</Th>
                <Th align="right">Collected</Th>
                <Th align="right">Settled</Th>
                <Th align="right">Pending</Th>
                <Th align="right">In Progress</Th>
              </tr>
            </thead>
            <tbody>
              {byHostelQ.isLoading && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">Loading…</td></tr>
              )}
              {!byHostelQ.isLoading && (byHostelQ.data?.hostels?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">No financial activity yet.</td></tr>
              )}
              {byHostelQ.data?.hostels.map((h) => (
                <tr key={h.hostel_id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{h.hostel_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-right">{inr(h.lifetime_collected)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{inr(h.lifetime_settled)}</td>
                  <td className="px-4 py-3 text-right text-amber-700 font-medium">{inr(h.pending)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{h.in_progress_credit_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent collections */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Collections</h2>
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Collected At</Th>
                <Th>Hostel</Th>
                <Th align="right">Amount</Th>
                <Th>Settlement Status</Th>
              </tr>
            </thead>
            <tbody>
              {collectionsQ.isLoading && (
                <tr><td colSpan={4} className="p-6 text-center text-gray-500">Loading…</td></tr>
              )}
              {!collectionsQ.isLoading && (collectionsQ.data?.collections?.length ?? 0) === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-gray-500">No collections yet.</td></tr>
              )}
              {collectionsQ.data?.collections.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 text-gray-700">{new Date(c.collected_at).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.hostel_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-right font-medium">{inr(c.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded border ${STATUS_CLASS[c.settlement_status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                      {STATUS_LABEL[c.settlement_status] ?? c.settlement_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, sub, loading, accent }: {
  label: string; value: string; sub: string; loading: boolean; accent: string;
}) {
  return (
    <div className="bg-white rounded-lg border p-5">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold mt-2 ${accent}`}>
        {loading ? <span className="text-gray-300">···</span> : value}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 py-2 text-xs font-medium uppercase tracking-wide text-${align}`}>
      {children}
    </th>
  );
}
