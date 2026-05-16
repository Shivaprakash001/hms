"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/providers";

function inr(amount: string | number) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);
}

type Transfer = {
  id: string;
  amount: string;
  transferred_at: string;
  hostel_id: string;
  payout_method: string | null;
  payout_reference: string | null;
  settlement_status: string;
};

export default function OwnerTransfersPage() {
  const { user } = useAuth();
  const transfersQ = useQuery({
    queryKey: ["owner-finance-transfers"],
    queryFn: () => api.get<{ transfers: Transfer[] }>("/owner/finance/transfers", { limit: 100 }),
    enabled: !!user,
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transfers</h1>
          <p className="text-sm text-gray-500">
            Every settlement HMS has paid to your bank account. The reference
            number is your authoritative proof.
          </p>
        </div>
        <Link
          href="/owner/finance"
          className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
        >
          ← Back to Finance
        </Link>
      </header>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Transferred At</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Hostel</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Method</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Reference</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transfersQ.isLoading && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">Loading…</td></tr>
            )}
            {!transfersQ.isLoading && (transfersQ.data?.transfers?.length ?? 0) === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">No transfers yet.</td></tr>
            )}
            {transfersQ.data?.transfers.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-3 text-gray-700">{new Date(t.transferred_at).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.hostel_id.slice(0, 8)}…</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 border border-gray-200">
                    {t.payout_method ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-800">{t.payout_reference ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-700">{inr(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
