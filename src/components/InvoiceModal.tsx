import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../api/client';
import type { Branch, Partner, Supplier } from '../types/payment';
import { formatIDR } from '../utils/format';

interface InvoiceModalProps {
  open: boolean;
  branches: Branch[];
  partners: Partner[];
  suppliers: Supplier[];
  onClose: () => void;
  onCreated: () => void;
}

export function InvoiceModal({
  open,
  branches,
  partners,
  suppliers,
  onClose,
  onCreated,
}: InvoiceModalProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [category, setCategory] = useState<'sales' | 'supplier' | 'franchise_fee' | 'royalty'>('sales');
  const [billToName, setBillToName] = useState('');
  const [billToId, setBillToId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [allowPartial, setAllowPartial] = useState(true);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [publishNow, setPublishNow] = useState(true);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: branchId || branches[0]?.id,
          invoice_category: category,
          bill_from: category === 'supplier' ? billToName : 'PT Nusantara Kuliner Pusat',
          bill_to_type: category === 'supplier' ? 'branch' : category === 'sales' ? 'customer' : 'partner',
          bill_to_id: billToId || null,
          bill_to_name: billToName,
          discount: Number(discount) || 0,
          tax: Number(tax) || 0,
          allow_partial: allowPartial ? 1 : 0,
          due_date: dueDate,
          publish_now: publishNow,
          notes,
          items,
        }),
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal membuat tagihan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="font-display text-base font-bold text-slate-900">Buat Tagihan / Invoice Baru</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kategori Tagihan</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="sales">Penjualan / Catering</option>
                <option value="supplier">Tagihan Supplier</option>
                <option value="franchise_fee">Biaya Franchise</option>
                <option value="royalty">Royalti Mitra</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cabang Terkait</label>
              <select
                value={branchId || branches[0]?.id}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {category === 'supplier' ? 'Nama Supplier Penagih' : 'Pihak Ditagih'}
              </label>
              {(category === 'franchise_fee' || category === 'royalty') ? (
                <select
                  required
                  value={billToId}
                  onChange={(e) => {
                    setBillToId(e.target.value);
                    const ptr = partners.find((p) => p.id === e.target.value);
                    if (ptr) setBillToName(`${ptr.company_name} (${ptr.name})`);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— Pilih Mitra Franchise —</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.company_name} ({p.name})</option>
                  ))}
                </select>
              ) : category === 'supplier' ? (
                <select
                  required
                  value={billToId}
                  onChange={(e) => {
                    setBillToId(e.target.value);
                    const sup = suppliers.find((s) => s.id === e.target.value);
                    if (sup) setBillToName(sup.name);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— Pilih Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={billToName}
                  onChange={(e) => setBillToName(e.target.value)}
                  placeholder="Nama perusahaan / pelanggan"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Jatuh Tempo</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Rincian Item</label>
              <button
                type="button"
                onClick={() => setItems([...items, { description: '', quantity: 1, unit_price: 0 }])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Item</span>
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  required
                  placeholder="Deskripsi item..."
                  value={item.description}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].description = e.target.value;
                    setItems(next);
                  }}
                  className="col-span-6 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  required
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].quantity = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-mono tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  required
                  placeholder="Harga"
                  value={item.unit_price}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx].unit_price = Number(e.target.value);
                    setItems(next);
                  }}
                  className="col-span-3 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-mono tabular-nums"
                />
                <button
                  type="button"
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="col-span-1 p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Diskon (IDR)</label>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pajak / Biaya Tambahan (IDR)</label>
              <input
                type="number"
                min={0}
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />
                <span>Izinkan pembayaran parsial / cicilan</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
                <span>Langsung terbitkan (jika tidak dicentang, simpan sebagai Draft)</span>
              </label>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Tagihan</span>
              <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">{formatIDR(total)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Catatan</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruksi pembayaran atau keterangan..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold">
              {submitting ? 'Menyimpan...' : publishNow ? 'Terbitkan Invoice' : 'Simpan Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
