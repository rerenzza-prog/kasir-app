import { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { apiFetch } from '../api/client';
import type {
  AppUser,
  Branch,
  Invoice,
  Partner,
  PaymentMethod,
  PaymentType,
  RolePermissions,
  Supplier,
} from '../types/payment';
import { formatIDR } from '../utils/format';

interface CreatePaymentModalProps {
  open: boolean;
  defaultMode?: PaymentType;
  prefillInvoice?: Invoice | null;
  currentUser: AppUser;
  permissions: RolePermissions;
  branches: Branch[];
  methods: PaymentMethod[];
  suppliers: Supplier[];
  partners: Partner[];
  makerCheckerThreshold: number;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePaymentModal({
  open,
  defaultMode = 'incoming_pos',
  prefillInvoice = null,
  permissions,
  branches,
  methods,
  suppliers,
  partners,
  makerCheckerThreshold,
  onClose,
  onCreated,
}: CreatePaymentModalProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>(defaultMode);
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [partyName, setPartyName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [subtotal, setSubtotal] = useState('150000');
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('11');
  const [directAmount, setDirectAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeMethods = methods.filter((m) => m.is_active === 1);

  useEffect(() => {
    if (!open) return;
    setError('');
    setIdempotencyKey(`idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setAttachmentUrl(null);
    setAttachmentName(null);
    setReferenceNumber('');

    if (prefillInvoice) {
      const rem = Math.max(0, prefillInvoice.total - prefillInvoice.paid_amount);
      setBranchId(prefillInvoice.branch_id);
      setPartyName(prefillInvoice.bill_to_name);
      setDirectAmount(String(rem));
      setReceivedAmount(String(rem));
      if (prefillInvoice.invoice_category === 'supplier') setPaymentType('outgoing_supplier');
      else if (prefillInvoice.invoice_category === 'franchise_fee') setPaymentType('franchise_fee');
      else if (prefillInvoice.invoice_category === 'royalty') setPaymentType('franchise_royalty');
      else setPaymentType('incoming_other');
      setNotes(`Pembayaran tagihan ${prefillInvoice.invoice_number}`);
    } else {
      setPaymentType(defaultMode);
      setBranchId(branches[0]?.id || '');
      setPartyName(defaultMode === 'incoming_pos' ? 'Pelanggan Walk-in' : '');
      setSubtotal('150000');
      setDiscount('0');
      setTaxRate(defaultMode === 'incoming_pos' ? '11' : '0');
      setDirectAmount('');
      setReceivedAmount('200000');
      setNotes('');
    }

    const firstMethod = activeMethods[0];
    if (firstMethod) setMethodId(firstMethod.id);
  }, [open, defaultMode, prefillInvoice, branches.length]);

  if (!open) return null;

  const isPosMode = paymentType === 'incoming_pos' && !prefillInvoice;
  const direction = paymentType === 'outgoing_supplier' || paymentType === 'outgoing_expense' ? 'out' : 'in';

  const numSub = Math.max(0, Number(subtotal) || 0);
  const numDisc = Math.max(0, Number(discount) || 0);
  const numTax = isPosMode ? Math.round(Math.max(0, numSub - numDisc) * ((Number(taxRate) || 0) / 100)) : 0;
  const computedTotal = isPosMode ? Math.max(0, numSub - numDisc + numTax) : Math.max(0, Number(directAmount) || 0);

  const selectedMethod = activeMethods.find((m) => m.id === methodId);
  const isCash = selectedMethod?.method_type === 'cash';
  const numReceived = isCash ? Number(receivedAmount) || 0 : computedTotal;
  const change = isCash ? Math.max(0, numReceived - computedTotal) : 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: branchId,
          invoice_id: prefillInvoice?.id || null,
          supplier_id: supplierId || null,
          partner_id: partnerId || null,
          payment_type: paymentType,
          direction,
          party_name: partyName,
          subtotal: isPosMode ? numSub : computedTotal,
          discount: isPosMode ? numDisc : 0,
          tax: isPosMode ? numTax : 0,
          amount: computedTotal,
          received_amount: numReceived,
          method_id: methodId,
          reference_number: referenceNumber || null,
          idempotency_key: idempotencyKey,
          notes,
          attachment_data_url: attachmentUrl,
          attachment_name: attachmentName,
        }),
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pembayaran.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xl bg-white rounded-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="font-display text-base font-bold text-slate-900">
            {prefillInvoice ? `Bayar Tagihan ${prefillInvoice.invoice_number}` : 'Catat Pembayaran Baru'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jenis Transaksi</label>
              <select
                value={paymentType}
                disabled={Boolean(prefillInvoice)}
                onChange={(e) => {
                  const t = e.target.value as PaymentType;
                  setPaymentType(t);
                  if (t === 'incoming_pos') setPartyName('Pelanggan Walk-in');
                  else setPartyName('');
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                {permissions.canCreatePosPayment && <option value="incoming_pos">Pembayaran POS Pelanggan</option>}
                {permissions.canCreateIncomingOther && <option value="incoming_other">Penerimaan Masuk Lainnya</option>}
                {permissions.canCreateOutgoing && <option value="outgoing_supplier">Pembayaran Supplier</option>}
                {permissions.canCreateOutgoing && <option value="outgoing_expense">Pengeluaran Operasional</option>}
                {permissions.canManageFranchise && <option value="franchise_royalty">Pembayaran Royalti Franchise</option>}
                {permissions.canManageFranchise && <option value="franchise_fee">Pembayaran Biaya Franchise</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cabang / Outlet</label>
              <select
                value={branchId}
                disabled={Boolean(prefillInvoice)}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {paymentType === 'outgoing_supplier' && !prefillInvoice && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pilih Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSupplierId(id);
                  const sup = suppliers.find((s) => s.id === id);
                  if (sup) setPartyName(sup.name);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">— Pilih supplier atau ketik manual di bawah —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          {(paymentType === 'franchise_fee' || paymentType === 'franchise_royalty') && !prefillInvoice && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mitra Franchise</label>
              <select
                value={partnerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPartnerId(id);
                  const ptr = partners.find((p) => p.id === id);
                  if (ptr) setPartyName(`${ptr.company_name} (${ptr.name})`);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">— Pilih mitra franchise —</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {direction === 'in' ? 'Nama Pembayar / Pelanggan / Mitra' : 'Nama Penerima / Supplier'}
            </label>
            <input
              type="text"
              required
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Contoh: Pelanggan Meja 05 / PT Roastery..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {isPosMode ? (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>Kalkulasi Pesanan POS</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubtotal('85000');
                      setDiscount('0');
                      setTaxRate('11');
                    }}
                    className="text-teal-700 hover:underline"
                  >
                    + Paket Kopi & Pastry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubtotal('240000');
                      setDiscount('20000');
                      setTaxRate('11');
                    }}
                    className="text-teal-700 hover:underline"
                  >
                    + Paket Bakmi Rombongan
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Subtotal</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Diskon</label>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Pajak (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
                <span className="font-medium text-slate-700">Total Akhir (termasuk pajak {formatIDR(numTax)})</span>
                <span className="font-mono text-base font-bold text-slate-900 tabular-nums">{formatIDR(computedTotal)}</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nominal Pembayaran (IDR)
                {prefillInvoice && (
                  <span className="text-slate-400 font-normal ml-1">
                    — Sisa tagihan: {formatIDR(Math.max(0, prefillInvoice.total - prefillInvoice.paid_amount))}
                  </span>
                )}
              </label>
              <input
                type="number"
                min={1}
                required
                value={directAmount}
                onChange={(e) => setDirectAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          )}

          {direction === 'out' && computedTotal >= makerCheckerThreshold && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Nominal mencapai batas maker-checker ({formatIDR(makerCheckerThreshold)}). Transaksi akan masuk antrean verifikasi dan harus disetujui oleh pengguna lain yang berwenang.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Metode Pembayaran</label>
              <select
                value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {activeMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">No. Referensi (Opsional)</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Contoh: TRF-BCA-99102"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          {selectedMethod?.instructions && (
            <p className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              {selectedMethod.instructions}
            </p>
          )}

          {isCash && (
            <div className="grid grid-cols-2 gap-4 p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Uang Tunai Diterima</label>
                <input
                  type="number"
                  min={computedTotal}
                  required
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1">Kembalian</span>
                <div className="font-mono text-base font-bold text-emerald-800 tabular-nums py-1">
                  {formatIDR(change)}
                </div>
              </div>
            </div>
          )}

          {selectedMethod && selectedMethod.requires_verification === 1 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">
                Unggah Bukti Transfer / QRIS (Status otomatis masuk Menunggu Verifikasi)
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-slate-300 hover:border-teal-600 cursor-pointer text-xs text-slate-600 bg-slate-50">
                <Upload className="w-4 h-4 text-slate-400" />
                <span>{attachmentName || 'Pilih file gambar bukti pembayaran (PNG/JPG)'}</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Catatan</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keterangan tambahan..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || computedTotal <= 0}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Simpan Pembayaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
