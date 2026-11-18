import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../../api/client';
import type { AuditLog, Branch, Brand, Invoice, Payment, RolePermissions } from '../../types/payment';
import { downloadCsv, formatDateTimeWIB, formatDateWIB, formatIDR, getPaymentTypeLabel } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

interface ReportsResponse {
  byMethod: { method_name: string; tx_count: number; total_in: number; total_out: number }[];
  byBranch: { brand_name: string; branch_name: string; tx_count: number; sales_in: number; franchise_in: number; supplier_out: number }[];
  byType: { payment_type: string; direction: string; tx_count: number; settled_total: number; pending_total: number }[];
  failedAndRefunds: Payment[];
  unpaidInvoices: Invoice[];
}

interface ReportsViewProps {
  brands: Brand[];
  branches: Branch[];
  permissions: RolePermissions;
  refreshKey: number;
}

export function ReportsView({ brands, branches, permissions, refreshKey }: ReportsViewProps) {
  const [brandId, setBrandId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'unpaid' | 'failed' | 'audit'>('overview');
  const [report, setReport] = useState<ReportsResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (brandId) params.set('brand_id', brandId);
    if (branchId) params.set('branch_id', branchId);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    Promise.all([
      apiFetch<ReportsResponse>(`/api/reports?${params.toString()}`),
      apiFetch<{ items: AuditLog[] }>('/api/audit-logs'),
    ]).then(([rep, aud]) => {
      if (!active) return;
      setReport(rep);
      setAuditLogs(aud.items);
    });
    return () => {
      active = false;
    };
  }, [brandId, branchId, dateFrom, dateTo, refreshKey]);

  const handleExportSummary = () => {
    if (!report) return;
    downloadCsv(
      'laporan-pembayaran-cabang.csv',
      ['Brand', 'Cabang', 'Jumlah Transaksi', 'Penjualan Masuk', 'Franchise Masuk', 'Supplier Keluar'],
      report.byBranch.map((r) => [r.brand_name, r.branch_name, r.tx_count, r.sales_in, r.franchise_in, r.supplier_out])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">Laporan & Audit Pembayaran</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Memisahkan penjualan POS, pembayaran franchise, pengeluaran supplier, tagihan jatuh tempo, dan jejak audit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permissions.canExportReports && (
            <button
              type="button"
              onClick={handleExportSummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
        <select
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setBranchId('');
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
        >
          <option value="">Semua Brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
        >
          <option value="">Semua Cabang</option>
          {(brandId ? branches.filter((b) => b.brand_id === brandId) : branches).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
        />
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit no-print">
        {[
          { key: 'overview', label: 'Metode, Jenis & Cabang' },
          { key: 'unpaid', label: 'Tagihan Belum Lunas' },
          { key: 'failed', label: 'Refund & Transaksi Gagal' },
          { key: 'audit', label: 'Audit Log Aktivitas' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && report && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-display text-sm font-semibold text-slate-900 mb-4">Volume Pembayaran per Metode</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.byMethod} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="method_name" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${Math.round(Number(v) / 1000000)}jt`} />
                  <Tooltip formatter={(val: unknown) => formatIDR(Number(val))} contentStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="total_in" name="Masuk (Lunas)" fill="#0F766E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_out" name="Keluar (Lunas)" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Separated Financial Categories (Rule 10: no double counting) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Pemisahan Kategori Keuangan (Penjualan, Supplier, & Franchise)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2.5 px-4 text-left font-medium">Jenis Transaksi</th>
                    <th className="py-2.5 px-4 text-left font-medium">Arah</th>
                    <th className="py-2.5 px-4 text-right font-medium">Jumlah</th>
                    <th className="py-2.5 px-4 text-right font-medium">Total Lunas</th>
                    <th className="py-2.5 px-4 text-right font-medium">Total Tertunda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.byType.map((row) => (
                    <tr key={row.payment_type}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{getPaymentTypeLabel(row.payment_type)}</td>
                      <td className="py-2.5 px-4 text-slate-600">{row.direction === 'in' ? 'Penerimaan' : 'Pengeluaran'}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{row.tx_count}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">{formatIDR(row.settled_total)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">{formatIDR(row.pending_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-display text-sm font-semibold text-slate-900">Laporan per Brand & Cabang</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2.5 px-4 text-left font-medium">Brand / Cabang</th>
                    <th className="py-2.5 px-4 text-right font-medium">Transaksi</th>
                    <th className="py-2.5 px-4 text-right font-medium">Penjualan POS</th>
                    <th className="py-2.5 px-4 text-right font-medium">Franchise & Royalti</th>
                    <th className="py-2.5 px-4 text-right font-medium">Keluar Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.byBranch.map((b) => (
                    <tr key={b.branch_name}>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{b.branch_name}</div>
                        <div className="text-[11px] text-slate-500">{b.brand_name}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{b.tx_count}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700">{formatIDR(b.sales_in)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-teal-700">{formatIDR(b.franchise_in)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-red-700">{formatIDR(b.supplier_out)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'unpaid' && report && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium">No. Invoice</th>
                  <th className="py-2.5 px-4 text-left font-medium">Pihak & Cabang</th>
                  <th className="py-2.5 px-4 text-left font-medium">Jatuh Tempo</th>
                  <th className="py-2.5 px-4 text-left font-medium">Status</th>
                  <th className="py-2.5 px-4 text-right font-medium">Sisa Tagihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.unpaidInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{inv.invoice_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{inv.bill_to_name}</div>
                      <div className="text-[11px] text-slate-500">{inv.branch_name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{formatDateWIB(inv.due_date)}</td>
                    <td className="py-3 px-4"><StatusBadge status={inv.status} /></td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatIDR(Math.max(0, inv.total - inv.paid_amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'failed' && report && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium">No. Transaksi</th>
                  <th className="py-2.5 px-4 text-left font-medium">Cabang / Pihak</th>
                  <th className="py-2.5 px-4 text-left font-medium">Metode</th>
                  <th className="py-2.5 px-4 text-left font-medium">Status</th>
                  <th className="py-2.5 px-4 text-right font-medium">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.failedAndRefunds.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{p.payment_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{p.party_name}</div>
                      <div className="text-[11px] text-slate-500">{p.branch_name}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.method_name}</td>
                    <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">{formatIDR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium">Waktu (WIB)</th>
                  <th className="py-2.5 px-4 text-left font-medium">Pengguna & Peran</th>
                  <th className="py-2.5 px-4 text-left font-medium">Aksi</th>
                  <th className="py-2.5 px-4 text-left font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">{formatDateTimeWIB(log.created_at)}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{log.user_name}</div>
                      <div className="text-[11px] text-slate-500">{log.user_role}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">{log.action}</td>
                    <td className="py-2.5 px-4 text-slate-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
