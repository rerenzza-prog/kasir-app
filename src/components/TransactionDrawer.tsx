import { useEffect, useState } from 'react';
import { Check, Printer, RotateCcw, ShieldAlert, X, XCircle } from 'lucide-react';
import { apiFetch } from '../api/client';
import type { AppUser, PaymentDetailResponse, RolePermissions } from '../types/payment';
import { formatDateTimeWIB, formatIDR, getPaymentTypeLabel } from '../utils/format';
import { StatusBadge } from './StatusBadge';

interface TransactionDrawerProps {
  paymentId: string | null;
  currentUser: AppUser;
  permissions: RolePermissions;
  onClose: () => void;
  onUpdated: () => void;
}

export function TransactionDrawer({
  paymentId,
  currentUser,
  permissions,
  onClose,
  onUpdated,
}: TransactionDrawerProps) {
  const [detail, setDetail] = useState<PaymentDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [correctReason, setCorrectReason] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showCorrectForm, setShowCorrectForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = async () => {
    if (!paymentId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<PaymentDetailResponse>(`/api/payments/${paymentId}`);
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat detail transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paymentId) {
      setShowRefundForm(false);
      setShowCorrectForm(false);
      setActionNotes('');
      setRefundAmount('');
      setRefundReason('');
      setCorrectReason('');
      loadDetail();
    } else {
      setDetail(null);
    }
  }, [paymentId]);

  if (!paymentId) return null;

  const handleVerify = async (decision: 'approved' | 'rejected') => {
    if (!detail) return;
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/payments/${detail.payment.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: actionNotes }),
      });
      setActionNotes('');
      await loadDetail();
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verifikasi gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/api/refunds', {
        method: 'POST',
        body: JSON.stringify({
          payment_id: detail.payment.id,
          amount: Number(refundAmount),
          reason: refundReason,
        }),
      });
      setShowRefundForm(false);
      setRefundAmount('');
      setRefundReason('');
      await loadDetail();
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Pengajuan refund gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/payments/${detail.payment.id}/correct`, {
        method: 'POST',
        body: JSON.stringify({ reason: correctReason }),
      });
      setShowCorrectForm(false);
      setCorrectReason('');
      await loadDetail();
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Koreksi gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const p = detail?.payment;
  const maxRefundable = p ? Math.max(0, p.amount - (p.refunded_amount || 0)) : 0;
  const isMakerCheckerBlocked = Boolean(
    p && p.requires_approval === 1 && p.created_by === currentUser.id
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-2xl bg-white h-full overflow-y-auto border-l border-slate-200 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 bg-white z-10 no-print">
          <div>
            <p className="text-xs text-slate-500">Detail Transaksi Pembayaran</p>
            <h2 className="font-display text-base font-bold text-slate-900 font-mono">
              {p ? p.payment_number : 'Memuat...'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {p && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struk</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panel"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {loading && <div className="text-sm text-slate-500 py-8 text-center">Memuat detail transaksi...</div>}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {p && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <span>{p.brand_name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{p.branch_name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{getPaymentTypeLabel(p.payment_type)}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{p.party_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dibuat oleh {p.created_by_name || p.created_by} pada {formatDateTimeWIB(p.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={p.status} />
                  <div className={`font-mono text-2xl font-bold tabular-nums mt-1 ${p.direction === 'in' ? 'text-slate-900' : 'text-red-700'}`}>
                    {p.direction === 'out' ? '- ' : ''}
                    {formatIDR(p.amount)}
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Metode Pembayaran</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{p.method_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">No. Referensi</dt>
                  <dd className="font-mono text-xs font-medium text-slate-900 mt-0.5">{p.reference_number || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Waktu Lunas</dt>
                  <dd className="text-xs font-medium text-slate-900 mt-0.5">{formatDateTimeWIB(p.paid_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Subtotal / Diskon / Pajak</dt>
                  <dd className="font-mono text-xs text-slate-700 tabular-nums mt-0.5">
                    {formatIDR(p.subtotal)} / {formatIDR(p.discount)} / {formatIDR(p.tax)}
                  </dd>
                </div>
                {p.method_type === 'cash' && (
                  <div>
                    <dt className="text-xs text-slate-500">Diterima / Kembalian</dt>
                    <dd className="font-mono text-xs text-slate-700 tabular-nums mt-0.5">
                      {formatIDR(p.received_amount)} / {formatIDR(p.change_amount)}
                    </dd>
                  </div>
                )}
                {p.invoice_number && (
                  <div>
                    <dt className="text-xs text-slate-500">Nomor Invoice</dt>
                    <dd className="font-mono text-xs font-semibold text-teal-700 mt-0.5">{p.invoice_number}</dd>
                  </div>
                )}
              </dl>

              {p.notes && (
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  <span className="text-xs font-medium text-slate-500 block mb-0.5">Catatan Transaksi</span>
                  {p.notes}
                </div>
              )}

              {/* Attachments */}
              {detail.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-900">Bukti Pembayaran</h4>
                  <div className="space-y-3">
                    {detail.attachments.map((att) => (
                      <div key={att.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                          <span className="font-mono truncate">{att.file_name}</span>
                          <span>{formatDateTimeWIB(att.created_at)}</span>
                        </div>
                        <div className="p-3 flex justify-center bg-white">
                          <img
                            src={att.file_reference}
                            alt={att.file_name}
                            referrerPolicy="no-referrer"
                            className="max-h-72 rounded border border-slate-200 object-contain"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification Action Panel */}
              {p.status === 'Menunggu Verifikasi' && permissions.canVerifyManual && (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 space-y-3 no-print">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Tindakan Verifikasi Manual</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Periksa nominal, nomor referensi, dan bukti sebelum menyetujui atau menolak.
                      </p>
                    </div>
                  </div>
                  {isMakerCheckerBlocked ? (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Aturan maker-checker aktif: pembuat pengajuan tidak dapat menyetujui transaksinya sendiri.</span>
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        rows={2}
                        placeholder="Catatan verifikasi (wajib diisi jika menolak)..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleVerify('approved')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Setujui Pembayaran</span>
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleVerify('rejected')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Tolak Pembayaran</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Refund & Correction Actions for Settled Transactions */}
              {p.status === 'Lunas' && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 no-print">
                  {permissions.canRequestRefund && p.direction === 'in' && maxRefundable > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowRefundForm(!showRefundForm);
                        setShowCorrectForm(false);
                        setRefundAmount(String(maxRefundable));
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ajukan Refund</span>
                    </button>
                  )}
                  {permissions.canCorrectSettled && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCorrectForm(!showCorrectForm);
                        setShowRefundForm(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Jurnal Koreksi / Batalkan</span>
                    </button>
                  )}
                </div>
              )}

              {showRefundForm && (
                <form onSubmit={handleRefundSubmit} className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3 no-print">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Pengajuan Refund (Maks. {formatIDR(maxRefundable)})
                  </h4>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nominal Refund (IDR)</label>
                    <input
                      type="number"
                      min={1}
                      max={maxRefundable}
                      required
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Alasan Pengembalian Dana</label>
                    <textarea
                      required
                      rows={2}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Jelaskan alasan refund..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
                    >
                      Kirim Pengajuan Refund
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRefundForm(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}

              {showCorrectForm && (
                <form onSubmit={handleCorrection} className="p-4 rounded-lg border border-red-200 bg-red-50/50 space-y-3 no-print">
                  <h4 className="text-sm font-semibold text-red-900">Jurnal Koreksi Transaksi Lunas</h4>
                  <p className="text-xs text-red-700">
                    Transaksi lunas tidak dapat dihapus permanen. Tindakan ini membatalkan status transaksi dan tercatat dalam audit log.
                  </p>
                  <textarea
                    required
                    rows={2}
                    value={correctReason}
                    onChange={(e) => setCorrectReason(e.target.value)}
                    placeholder="Masukkan alasan koreksi resmi..."
                    className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold"
                    >
                      Konfirmasi Koreksi
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCorrectForm(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}

              {/* Status History Log */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900">Riwayat Perubahan Status</h4>
                <div className="space-y-2.5">
                  {detail.statusLogs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-4 text-xs pb-2.5 border-b border-slate-100 last:border-0">
                      <div>
                        <div className="font-medium text-slate-900">
                          {log.old_status ? `${log.old_status} → ${log.new_status}` : log.new_status}
                        </div>
                        <div className="text-slate-600 mt-0.5">{log.reason || '—'}</div>
                        <div className="text-slate-400 mt-0.5">Oleh {log.changed_by_name}</div>
                      </div>
                      <span className="font-mono text-slate-500 whitespace-nowrap shrink-0">
                        {formatDateTimeWIB(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
