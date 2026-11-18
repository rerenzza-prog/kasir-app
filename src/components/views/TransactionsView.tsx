import { useEffect, useState } from 'react';
import { Download, Plus, Search } from 'lucide-react';
import { apiFetch } from '../../api/client';
import {
  PAYMENT_STATUSES,
  type Branch,
  type Brand,
  type Payment,
  type PaymentMethod,
  type PaymentType,
  type RolePermissions,
} from '../../types/payment';
import { downloadCsv, formatDateTimeWIB, formatIDR, getPaymentTypeLabel } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

interface TransactionsViewProps {
  mode: 'all' | 'in' | 'out';
  brands: Brand[];
  branches: Branch[];
  methods: PaymentMethod[];
  permissions: RolePermissions;
  refreshKey: number;
  onSelectPayment: (id: string) => void;
  onOpenCreate: (defaultType: PaymentType) => void;
}

interface PaymentListResponse {
  items: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function TransactionsView({
  mode,
  brands,
  branches,
  methods,
  permissions,
  refreshKey,
  onSelectPayment,
  onOpenCreate,
}: TransactionsViewProps) {
  const [search, setSearch] = useState('');
  const [brandId, setBrandId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [status, setStatus] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaymentListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [mode, search, brandId, branchId, methodId, status, paymentType, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (mode !== 'all') params.set('direction', mode);
        if (search) params.set('search', search);
        if (brandId) params.set('brand_id', brandId);
        if (branchId) params.set('branch_id', branchId);
        if (methodId) params.set('method_id', methodId);
        if (status) params.set('status', status);
        if (paymentType) params.set('payment_type', paymentType);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        params.set('page', String(page));
        params.set('limit', '15');

        const res = await apiFetch<PaymentListResponse>(`/api/payments?${params.toString()}`);
        if (active) setData(res);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [mode, search, brandId, branchId, methodId, status, paymentType, dateFrom, dateTo, page, refreshKey]);

  const handleExportCsv = () => {
    if (!data) return;
    downloadCsv(
      `transaksi-pembayaran-${mode}.csv`,
      ['No. Transaksi', 'Tanggal', 'Brand', 'Cabang', 'Jenis', 'Pihak', 'Metode', 'Referensi', 'Nominal (IDR)', 'Status'],
      data.items.map((p) => [
        p.payment_number,
        formatDateTimeWIB(p.created_at),
        p.brand_name,
        p.branch_name,
        getPaymentTypeLabel(p.payment_type),
        p.party_name,
        p.method_name,
        p.reference_number || '',
        p.direction === 'out' ? -p.amount : p.amount,
        p.status,
      ])
    );
  };

  const title =
    mode === 'in'
      ? 'Pembayaran Masuk (POS & Penerimaan)'
      : mode === 'out'
      ? 'Pembayaran Keluar (Supplier & Pengeluaran)'
      : 'Semua Transaksi Pembayaran';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencarian nomor transaksi, invoice, pelanggan, supplier, mitra, atau referensi pembayaran.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permissions.canExportReports && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          )}
          {mode === 'in' && permissions.canCreatePosPayment && (
            <button
              type="button"
              onClick={() => onOpenCreate('incoming_pos')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pembayaran POS</span>
            </button>
          )}
          {mode === 'out' && permissions.canCreateOutgoing && (
            <button
              type="button"
              onClick={() => onOpenCreate('outgoing_supplier')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bayar Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. transaksi, invoice, nama pihak, referensi..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
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
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          >
            <option value="">Semua Status</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          >
            <option value="">Semua Metode</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          >
            <option value="">Semua Jenis</option>
            <option value="incoming_pos">Penjualan POS</option>
            <option value="incoming_other">Penerimaan Lain</option>
            <option value="outgoing_supplier">Bayar Supplier</option>
            <option value="outgoing_expense">Pengeluaran Operasional</option>
            <option value="franchise_fee">Biaya Franchise</option>
            <option value="franchise_royalty">Royalti Mitra</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Dari tanggal"
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Sampai tanggal"
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 text-left font-medium">No. Transaksi</th>
                <th className="py-3 px-4 text-left font-medium">Waktu (WIB)</th>
                <th className="py-3 px-4 text-left font-medium">Cabang & Jenis</th>
                <th className="py-3 px-4 text-left font-medium">Pihak / Referensi</th>
                <th className="py-3 px-4 text-left font-medium">Metode</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Memuat transaksi...
                  </td>
                </tr>
              )}
              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Tidak ada transaksi yang sesuai dengan filter atau hak akses Anda.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectPayment(tx.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {tx.payment_number}
                      {tx.invoice_number && (
                        <div className="text-[11px] font-normal text-teal-700">{tx.invoice_number}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {formatDateTimeWIB(tx.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{tx.branch_name}</div>
                      <div className="text-[11px] text-slate-500">{getPaymentTypeLabel(tx.payment_type)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{tx.party_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{tx.reference_number || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{tx.method_name}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${tx.direction === 'out' ? 'text-red-700' : 'text-slate-900'}`}>
                      {tx.direction === 'out' ? '- ' : ''}{formatIDR(tx.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Menampilkan halaman {data.page} dari {data.totalPages} ({data.total} transaksi)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
