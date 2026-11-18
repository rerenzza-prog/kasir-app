import { useEffect, useState } from 'react';
import { Check, ShieldAlert, XCircle } from 'lucide-react';
import { apiFetch } from '../../api/client';
import type { AppUser, Payment, PaymentDetailResponse, RolePermissions } from '../../types/payment';
import { formatDateTimeWIB, formatIDR, getPaymentTypeLabel } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

interface VerificationViewProps {
  currentUser: AppUser;
  permissions: RolePermissions;
  refreshKey: number;
  onUpdated: () => void;
}

export function VerificationView({
  currentUser,
  permissions,
  refreshKey,
  onUpdated,
}: VerificationViewProps) {
  const [queue, setQueue] = useState<Payment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaymentDetailResponse | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let active = true;
    const loadQueue = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ items: Payment[] }>('/api/payments?status=Menunggu%20Verifikasi&limit=50');
        if (!active) return;
        setQueue(res.items);
        if (res.items.length > 0 && (!selectedId || !res.items.some((i) => i.id === selectedId))) {
          setSelectedId(res.items[0].id);
        } else if (res.items.length === 0) {
          setSelectedId(null);
          setDetail(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadQueue();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    apiFetch<PaymentDetailResponse>(`/api/payments/${selectedId}`)
      .then((res) => {
        if (active) setDetail(res);
      })
      .catch(() => {
        if (active) setDetail(null);
      });
    return () => {
      active = false;
    };
  }, [selectedId, refreshKey]);

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    setFeedback('');
    try {
      await apiFetch(`/api/payments/${selectedId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      });
      setNotes('');
      setFeedback(decision === 'approved' ? 'Pembayaran berhasil disetujui (Lunas).' : 'Pembayaran ditolak dan dicatat ke log.');
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verifikasi gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const p = detail?.payment;
  const isMakerCheckerBlocked = Boolean(p && p.requires_approval === 1 && p.created_by === currentUser.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900">Antrean Verifikasi Manual</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Periksa bukti transfer, nominal, dan nomor referensi sebelum menyetujui pembayaran.
        </p>
      </div>

      {!permissions.canVerifyManual && (
        <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700">
          Peran Anda ({currentUser.role}) hanya dapat melihat antrean. Verifikasi hanya dapat dilakukan oleh Finance, Admin Pusat, Manager Cabang, Owner, atau Super Admin.
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Queue List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Menunggu Verifikasi</span>
            <span className="font-mono text-amber-700">{queue.length}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {loading && <div className="p-6 text-center text-xs text-slate-400">Memuat antrean...</div>}
            {!loading && queue.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                Semua pembayaran sudah terverifikasi. Tidak ada antrean tertunda.
              </div>
            )}
            {queue.map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setError('');
                    setFeedback('');
                  }}
                  className={`w-full text-left p-4 transition-colors ${active ? 'bg-teal-50/70' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900">{item.payment_number}</span>
                    <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                      {formatIDR(item.amount)}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-800 mt-1 truncate">{item.party_name}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {item.branch_name} · {item.method_name} · {formatDateTimeWIB(item.created_at)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Inspector */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          {!p ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Pilih transaksi di sebelah kiri untuk memeriksa detail dan bukti pembayaran.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">
                    {p.brand_name} · {p.branch_name} · {getPaymentTypeLabel(p.payment_type)}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{p.party_name}</h3>
                  <div className="font-mono text-xs text-slate-500 mt-0.5">
                    {p.payment_number} · Ref: {p.reference_number || '—'}
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge status={p.status} />
                  <div className="font-mono text-xl font-bold text-slate-900 tabular-nums mt-1">
                    {formatIDR(p.amount)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Metode Pembayaran</span>
                  <span className="font-medium text-slate-900">{p.method_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Diinput Oleh</span>
                  <span className="font-medium text-slate-900">{p.created_by_name} ({formatDateTimeWIB(p.created_at)})</span>
                </div>
              </div>

              {p.notes && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  {p.notes}
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Bukti Pembayaran Terlampir</h4>
                {detail && detail.attachments.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex justify-center">
                    <img
                      src={detail.attachments[0].file_reference}
                      alt={detail.attachments[0].file_name}
                      referrerPolicy="no-referrer"
                      className="max-h-72 rounded border border-slate-200 bg-white object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-6 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    Tidak ada lampiran gambar bukti transfer. Verifikasi berdasarkan nomor referensi atau mutasi rekening.
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
              )}

              {permissions.canVerifyManual && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  {isMakerCheckerBlocked ? (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Aturan maker-checker: Anda pembuat pengajuan ini, sehingga persetujuan harus dilakukan oleh pemeriksa lain.</span>
                    </div>
                  ) : (
                    <>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Catatan pemeriksaan (wajib diisi jika menolak)..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleDecision('approved')}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>Setujui & Tandai Lunas</span>
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleDecision('rejected')}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Tolak Pembayaran</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
