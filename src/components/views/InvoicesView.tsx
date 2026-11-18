import { useEffect, useState } from 'react';
import { FileText, Plus, Search } from 'lucide-react';
import { apiFetch } from '../../api/client';
import type { Invoice, RolePermissions } from '../../types/payment';
import { formatDateWIB, formatIDR } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

interface InvoicesViewProps {
  pendingOnly: boolean;
  permissions: RolePermissions;
  refreshKey: number;
  onOpenCreateInvoice: () => void;
  onPayInvoice: (invoice: Invoice) => void;
  onPrintInvoice: (invoice: Invoice) => void;
  onUpdated: () => void;
}

export function InvoicesView({
  pendingOnly,
  permissions,
  refreshKey,
  onOpenCreateInvoice,
  onPayInvoice,
  onPrintInvoice,
  onUpdated,
}: InvoicesViewProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (pendingOnly) params.set('status', 'pending_all');
        if (category) params.set('category', category);
        if (search) params.set('search', search);
        const res = await apiFetch<{ items: Invoice[] }>(`/api/invoices?${params.toString()}`);
        if (active) setInvoices(res.items);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [pendingOnly, category, search, refreshKey]);

  const handlePublish = async (id: string) => {
    await apiFetch(`/api/invoices/${id}/publish`, { method: 'POST' });
    onUpdated();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            {pendingOnly ? 'Pembayaran Tertunda & Belum Lunas' : 'Tagihan / Invoice'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {pendingOnly
              ? 'Daftar tagihan aktif yang belum lunas, cicilan berjalan, dan melewati jatuh tempo.'
              : 'Buat, terbitkan, cetak PDF, dan pantau pembayaran penuh atau parsial pada tagihan.'}
          </p>
        </div>
        {!pendingOnly && permissions.canManageInvoices && (
          <button
            type="button"
            onClick={onOpenCreateInvoice}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Invoice</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor invoice atau pihak tertagih..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
        >
          <option value="">Semua Kategori</option>
          <option value="sales">Penjualan / Catering</option>
          <option value="supplier">Supplier</option>
          <option value="franchise_fee">Biaya Franchise</option>
          <option value="royalty">Royalti Mitra</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 text-left font-medium">No. Invoice</th>
                <th className="py-3 px-4 text-left font-medium">Pihak & Cabang</th>
                <th className="py-3 px-4 text-left font-medium">Terbit / Jatuh Tempo</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Total</th>
                <th className="py-3 px-4 text-right font-medium">Terbayar</th>
                <th className="py-3 px-4 text-right font-medium">Sisa Tagihan</th>
                <th className="py-3 px-4 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">Memuat daftar tagihan...</td>
                </tr>
              )}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">Tidak ada tagihan ditemukan.</td>
                </tr>
              )}
              {!loading &&
                invoices.map((inv) => {
                  const remaining = Math.max(0, inv.total - inv.paid_amount);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{inv.bill_to_name}</div>
                        <div className="text-[11px] text-slate-500">{inv.branch_name}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        <div>{formatDateWIB(inv.issue_date)}</div>
                        <div className="text-[11px] text-slate-400">JT: {formatDateWIB(inv.due_date)}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap"><StatusBadge status={inv.status} /></td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatIDR(inv.total)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                        {formatIDR(inv.paid_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatIDR(remaining)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onPrintInvoice(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                          {inv.status === 'Draft' && permissions.canManageInvoices && (
                            <button
                              type="button"
                              onClick={() => handlePublish(inv.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
                            >
                              Terbitkan
                            </button>
                          )}
                          {remaining > 0 && inv.status !== 'Draft' && inv.status !== 'Dibatalkan' && (
                            <button
                              type="button"
                              onClick={() => onPayInvoice(inv)}
                              className="px-2.5 py-1.5 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800"
                            >
                              Bayar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
