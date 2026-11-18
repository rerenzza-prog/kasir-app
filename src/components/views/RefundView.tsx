import { useEffect, useState } from 'react';
import { Check, RotateCcw, XCircle } from 'lucide-react';
import { apiFetch } from '../../api/client';
import type { AppUser, RefundRecord, RolePermissions } from '../../types/payment';
import { formatDateTimeWIB, formatIDR } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

interface EligiblePayment {
  id: string;
  payment_number: string;
  party_name: string;
  amount: number;
  refunded_amount: number;
  branch_name: string;
}

interface RefundViewProps {
  currentUser: AppUser;
  permissions: RolePermissions;
  refreshKey: number;
  onUpdated: () => void;
}

export function RefundView({
  currentUser,
  permissions,
  refreshKey,
  onUpdated,
}: RefundViewProps) {
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [eligible, setEligible] = useState<EligiblePayment[]>([]);
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{ refunds: RefundRecord[]; eligiblePayments: EligiblePayment[] }>('/api/refunds').then((res) => {
      if (!active) return;
      setRefunds(res.refunds);
      setEligible(res.eligiblePayments);
      if (res.eligiblePayments[0] && !paymentId) {
        setPaymentId(res.eligiblePayments[0].id);
        setAmount(String(res.eligiblePayments[0].amount - res.eligiblePayments[0].refunded_amount));
      }
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const selectedEligible = eligible.find((p) => p.id === paymentId);
  const maxRefundable = selectedEligible ? selectedEligible.amount - selectedEligible.refunded_amount : 0;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiFetch<{ refund_number: string }>('/api/refunds', {
        method: 'POST',
        body: JSON.stringify({ payment_id: paymentId, amount: Number(amount), reason }),
      });
      setReason('');
      setSuccess(`Pengajuan refund ${res.refund_number} berhasil dicatat.`);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Pengajuan refund gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcess = async (id: string, decision: 'approve' | 'reject') => {
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/refunds/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      setSuccess(decision === 'approve' ? 'Refund disetujui dan diproses.' : 'Pengajuan refund ditolak.');
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memproses refund.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900">Pengembalian Dana (Refund)</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Ajukan dan setujui refund dengan kontrol batas nominal terbayar dikurangi refund sebelumnya.
        </p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{success}</div>}

      {permissions.canRequestRefund && (
        <form onSubmit={handleRequest} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-teal-700" />
            <h3 className="font-display text-sm font-semibold text-slate-900">Ajukan Refund Baru</h3>
          </div>
          {eligible.length === 0 ? (
            <p className="text-xs text-slate-500">Tidak ada transaksi masuk berstatus Lunas yang tersedia untuk direfund.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Transaksi Asal (Lunas)</label>
                <select
                  value={paymentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPaymentId(id);
                    const found = eligible.find((p) => p.id === id);
                    if (found) setAmount(String(found.amount - found.refunded_amount));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  {eligible.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.payment_number} — {p.party_name} ({formatIDR(p.amount - p.refunded_amount)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Nominal Refund (Maks: {formatIDR(maxRefundable)})
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxRefundable}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Alasan Refund</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Pesanan dibatalkan / selisih item"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>
          )}
          {eligible.length > 0 && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
              >
                {submitting ? 'Mengirim...' : 'Ajukan Refund'}
              </button>
            </div>
          )}
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display text-sm font-semibold text-slate-900">Riwayat & Antrean Persetujuan Refund</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2.5 px-4 text-left font-medium">No. Refund / Asal</th>
                <th className="py-2.5 px-4 text-left font-medium">Pihak & Cabang</th>
                <th className="py-2.5 px-4 text-left font-medium">Alasan</th>
                <th className="py-2.5 px-4 text-left font-medium">Status</th>
                <th className="py-2.5 px-4 text-right font-medium">Nominal Refund</th>
                <th className="py-2.5 px-4 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {refunds.map((r) => {
                const isSelf = r.requested_by === currentUser.id;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono">
                      <div className="font-semibold text-slate-900">{r.refund_number}</div>
                      <div className="text-[11px] text-slate-500">{r.payment_number}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{r.party_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.branch_name} · Pengaju: {r.requested_by_name}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs">{r.reason}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} />
                      {r.processed_at && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{formatDateTimeWIB(r.processed_at)}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatIDR(r.amount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {r.status === 'Menunggu Persetujuan' && permissions.canApproveRefund && (
                        isSelf ? (
                          <span className="text-[11px] text-slate-400">Butuh penyetuju lain</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleProcess(r.id, 'approve')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Setujui</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProcess(r.id, 'reject')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {refunds.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">Belum ada pengajuan refund.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
