import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../../api/client';
import type { Branch, Brand, Invoice, Payment, SubmenuKey } from '../../types/payment';
import { formatDateTimeWIB, formatDateWIB, formatIDR, getPaymentTypeLabel } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

interface SummaryResponse {
  kpis: {
    totalInSettled: number;
    totalOutSettled: number;
    netCashflow: number;
    totalPendingAmount: number;
    pendingVerificationCount: number;
    pendingPaymentCount: number;
    settledCount: number;
    failedOrRejectedCount: number;
    refundedTotal: number;
    unpaidInvoiceCount: number;
  };
  trend: { date: string; masuk: number; keluar: number }[];
  branchSummary: { branch_id: string; branch_name: string; brand_name: string; masuk: number; keluar: number; tertunda: number }[];
  actionQueue: Payment[];
  recentTransactions: Payment[];
  unpaidInvoices: Invoice[];
}

interface DashboardViewProps {
  brands: Brand[];
  branches: Branch[];
  refreshKey: number;
  onSelectPayment: (id: string) => void;
  onNavigate: (submenu: SubmenuKey) => void;
}

export function DashboardView({
  brands,
  branches,
  refreshKey,
  onSelectPayment,
  onNavigate,
}: DashboardViewProps) {
  const [brandId, setBrandId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (brandId) params.set('brand_id', brandId);
        if (branchId) params.set('branch_id', branchId);
        const res = await apiFetch<SummaryResponse>(`/api/summary?${params.toString()}`);
        if (active) setData(res);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [brandId, branchId, refreshKey]);

  const filteredBranches = brandId ? branches.filter((b) => b.brand_id === brandId) : branches;

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">Ringkasan Arus Pembayaran</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau total penerimaan, pengeluaran, tagihan tertunda, dan antrean verifikasi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setBranchId('');
            }}
            className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2"
          >
            <option value="">Semua Brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2"
          >
            <option value="">Semua Cabang</option>
            {filteredBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Pembayaran Masuk (Lunas)</div>
          <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {loading || !data ? '—' : formatIDR(data.kpis.totalInSettled)}
          </div>
          <div className="text-xs text-emerald-700 mt-1.5 font-medium">
            {data ? `${data.kpis.settledCount} transaksi terkonfirmasi` : 'Memuat...'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Pembayaran Keluar (Lunas)</div>
          <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {loading || !data ? '—' : formatIDR(data.kpis.totalOutSettled)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            {data ? `Arus kas bersih: ${formatIDR(data.kpis.netCashflow)}` : 'Memuat...'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Pembayaran Tertunda</div>
          <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {loading || !data ? '—' : formatIDR(data.kpis.totalPendingAmount)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            {data ? `${data.kpis.unpaidInvoiceCount} tagihan belum lunas` : 'Memuat...'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Perlu Verifikasi Manual</div>
          <div className="font-mono text-2xl font-bold text-amber-700 tabular-nums mt-2">
            {loading || !data ? '—' : `${data.kpis.pendingVerificationCount} Transaksi`}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('verifikasi-pembayaran')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 mt-1.5 inline-block"
          >
            Buka antrean verifikasi →
          </button>
        </div>
      </div>

      {/* Chart + Action Required Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">Tren Pembayaran Masuk & Keluar</h3>
              <p className="text-xs text-slate-500">Transaksi berstatus Lunas berdasarkan tanggal penyelesaian</p>
            </div>
          </div>
          <div className="h-64 w-full">
            {data && data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000000)}jt`}
                  />
                  <Tooltip
                    formatter={(value: unknown) => formatIDR(Number(value))}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  />
                  <Area type="monotone" dataKey="masuk" name="Pembayaran Masuk" stroke="#0F766E" fill="#CCFBF1" strokeWidth={2} />
                  <Area type="monotone" dataKey="keluar" name="Pembayaran Keluar" stroke="#DC2626" fill="#FEE2E2" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada data tren pada filter terpilih.
              </div>
            )}
          </div>
        </div>

        {/* Action Required Queue */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-slate-900">Membutuhkan Tindakan</h3>
            <button
              type="button"
              onClick={() => onNavigate('verifikasi-pembayaran')}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Lihat semua
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {data && data.actionQueue.length > 0 ? (
              data.actionQueue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectPayment(item.id)}
                  className="w-full py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{item.party_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      <span className="font-mono">{item.payment_number}</span> · {item.method_name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                      {formatIDR(item.amount)}
                    </div>
                    <div className="text-[11px] font-medium text-amber-700 mt-0.5">Verifikasi</div>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-slate-400">
                Tidak ada transaksi yang menunggu verifikasi.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branch Summary + Recent Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-display text-sm font-semibold text-slate-900">Ringkasan per Brand & Cabang</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium">Cabang</th>
                  <th className="py-2.5 px-4 text-right font-medium">Masuk</th>
                  <th className="py-2.5 px-4 text-right font-medium">Keluar</th>
                  <th className="py-2.5 px-4 text-right font-medium">Tertunda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.branchSummary.map((row) => (
                  <tr key={row.branch_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{row.branch_name}</div>
                      <div className="text-[11px] text-slate-500">{row.brand_name}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                      {formatIDR(row.masuk)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatIDR(row.keluar)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {formatIDR(row.tertunda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900">Transaksi Terbaru</h3>
            <button
              type="button"
              onClick={() => onNavigate('semua-transaksi')}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Semua transaksi
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium">Transaksi</th>
                  <th className="py-2.5 px-4 text-left font-medium">Status</th>
                  <th className="py-2.5 px-4 text-right font-medium">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectPayment(tx.id)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{tx.party_name}</div>
                      <div className="text-[11px] text-slate-500">
                        <span className="font-mono">{tx.payment_number}</span> · {getPaymentTypeLabel(tx.payment_type)} · {formatDateTimeWIB(tx.created_at)}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${tx.direction === 'out' ? 'text-red-700' : 'text-slate-900'}`}>
                      {tx.direction === 'out' ? '- ' : ''}{formatIDR(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Overdue / Unpaid Notice */}
      {data && data.unpaidInvoices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-slate-900">Tagihan Belum Lunas & Mendekati Jatuh Tempo</h3>
            <button
              type="button"
              onClick={() => onNavigate('pembayaran-tertunda')}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Kelola tagihan tertunda
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.unpaidInvoices.slice(0, 3).map((inv) => (
              <div key={inv.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-900">{inv.invoice_number}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="text-xs font-medium text-slate-800 mt-1.5 truncate">{inv.bill_to_name}</div>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <span>Jatuh tempo {formatDateWIB(inv.due_date)}</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatIDR(Math.max(0, inv.total - inv.paid_amount))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
