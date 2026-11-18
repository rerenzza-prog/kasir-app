import { useEffect, useState } from 'react';
import { GitCompare, Webhook } from 'lucide-react';
import { apiFetch } from '../../api/client';
import type { ReconciliationMatchStatus, ReconciliationRecord, RolePermissions } from '../../types/payment';
import { formatDateTimeWIB, formatDateWIB, formatIDR } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

interface UnreconciledPayment {
  id: string;
  payment_number: string;
  party_name: string;
  amount: number;
  reference_number: string | null;
}

interface ReconciliationViewProps {
  permissions: RolePermissions;
  refreshKey: number;
  onUpdated: () => void;
}

export function ReconciliationView({ permissions, refreshKey, onUpdated }: ReconciliationViewProps) {
  const [items, setItems] = useState<ReconciliationRecord[]>([]);
  const [unreconciled, setUnreconciled] = useState<UnreconciledPayment[]>([]);
  const [statementDate, setStatementDate] = useState('2026-11-16');
  const [providerName, setProviderName] = useState('Bank BCA Corporate');
  const [extRef, setExtRef] = useState('');
  const [extAmt, setExtAmt] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjStatus, setAdjStatus] = useState<ReconciliationMatchStatus>('Cocok');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjPaymentId, setAdjPaymentId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Webhook idempotency simulation state
  const [whEventId, setWhEventId] = useState('evt-midtrans-1001');
  const [whPayNum, setWhPayNum] = useState('PAY-20261116-0106');
  const [whResult, setWhResult] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{ items: ReconciliationRecord[]; unreconciledPayments: UnreconciledPayment[] }>('/api/reconciliations').then((res) => {
      if (!active) return;
      setItems(res.items);
      setUnreconciled(res.unreconciledPayments);
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const res = await apiFetch<{ match_status: string }>('/api/reconciliations/import', {
        method: 'POST',
        body: JSON.stringify({
          statement_date: statementDate,
          provider_name: providerName,
          external_reference: extRef,
          external_amount: Number(extAmt),
        }),
      });
      setExtRef('');
      setExtAmt('');
      setMsg(`Baris mutasi dicatat dengan hasil pencocokan: ${res.match_status}.`);
      onUpdated();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Gagal mencatat mutasi.');
    }
  };

  const handleSaveAdjust = async (id: string) => {
    setErr('');
    setMsg('');
    try {
      await apiFetch(`/api/reconciliations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          payment_id: adjPaymentId || null,
          match_status: adjStatus,
          adjustment_notes: adjNotes,
        }),
      });
      setEditingId(null);
      setAdjNotes('');
      setMsg('Penyesuaian rekonsiliasi berhasil disimpan.');
      onUpdated();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Gagal menyimpan penyesuaian.');
    }
  };

  const handleTestWebhook = async () => {
    setWhResult('');
    try {
      const res = await fetch('/api/webhooks/gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': 'SANDBOX_VERIFIED_SIG',
        },
        body: JSON.stringify({
          event_id: whEventId,
          payment_number: whPayNum,
          status: 'Lunas',
          provider: 'Midtrans Sandbox',
        }),
      });
      const json = await res.json();
      setWhResult(json.message || json.error || 'Selesai');
      onUpdated();
    } catch {
      setWhResult('Gagal menghubungi endpoint webhook.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900">Rekonsiliasi Mutasi & Penyedia Pembayaran</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Cocokkan catatan transaksi internal dengan mutasi rekening bank atau laporan gateway.
        </p>
      </div>

      {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}
      {err && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{err}</div>}

      {permissions.canReconcile && (
        <form onSubmit={handleImport} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-teal-700" />
            <h3 className="font-display text-sm font-semibold text-slate-900">Catat & Cocokkan Mutasi Eksternal</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tanggal Mutasi</label>
              <input
                type="date"
                required
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bank / Penyedia</label>
              <input
                type="text"
                required
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Referensi Eksternal / Transaksi</label>
              <input
                type="text"
                required
                value={extRef}
                onChange={(e) => setExtRef(e.target.value)}
                placeholder="Contoh: POS-KN-0101"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nominal Mutasi (IDR)</label>
              <input
                type="number"
                required
                value={extAmt}
                onChange={(e) => setExtAmt(e.target.value)}
                placeholder="277500"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
            >
              Cocokkan Mutasi
            </button>
          </div>
        </form>
      )}

      {/* Reconciliation Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display text-sm font-semibold text-slate-900">Daftar Hasil Rekonsiliasi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2.5 px-4 text-left font-medium">Tanggal / Penyedia</th>
                <th className="py-2.5 px-4 text-left font-medium">Ref. Eksternal</th>
                <th className="py-2.5 px-4 text-left font-medium">Transaksi Internal</th>
                <th className="py-2.5 px-4 text-right font-medium">Nominal Mutasi</th>
                <th className="py-2.5 px-4 text-left font-medium">Status</th>
                <th className="py-2.5 px-4 text-left font-medium">Catatan Penyesuaian</th>
                <th className="py-2.5 px-4 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 align-top">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-mono text-slate-900">{formatDateWIB(row.statement_date)}</div>
                    <div className="text-[11px] text-slate-500">{row.provider_name}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-800">{row.external_reference}</td>
                  <td className="py-3 px-4">
                    {row.payment_number ? (
                      <>
                        <div className="font-mono font-semibold text-teal-700">{row.payment_number}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.party_name} ({formatIDR(row.payment_amount)})
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">Belum terhubung</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {formatIDR(row.external_amount)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <StatusBadge status={row.match_status} />
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs">
                    {editingId === row.id ? (
                      <div className="space-y-2">
                        <select
                          value={adjStatus}
                          onChange={(e) => setAdjStatus(e.target.value as ReconciliationMatchStatus)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="Cocok">Cocok</option>
                          <option value="Tidak Cocok">Tidak Cocok</option>
                          <option value="Belum Ditemukan">Belum Ditemukan</option>
                        </select>
                        <select
                          value={adjPaymentId}
                          onChange={(e) => setAdjPaymentId(e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">— Hubungkan transaksi internal —</option>
                          {unreconciled.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.payment_number} — {formatIDR(u.amount)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={adjNotes}
                          onChange={(e) => setAdjNotes(e.target.value)}
                          placeholder="Alasan penyesuaian..."
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : (
                      <div>
                        <div>{row.adjustment_notes || '—'}</div>
                        {row.reconciled_by_name && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Oleh {row.reconciled_by_name} · {formatDateTimeWIB(row.reconciled_at)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {permissions.canReconcile && (
                      editingId === row.id ? (
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveAdjust(row.id)}
                            className="px-2.5 py-1 rounded bg-teal-700 text-white font-semibold"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 rounded border border-slate-300 text-slate-600"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(row.id);
                            setAdjStatus(row.match_status);
                            setAdjNotes(row.adjustment_notes || '');
                            setAdjPaymentId(row.payment_id || '');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                        >
                          Sesuaikan
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook Idempotency Verification Tool */}
      {permissions.canReconcile && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-teal-700" />
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Simulasi & Uji Deduplikasi Webhook Gateway
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Uji pengiriman webhook dengan ID event yang sama berulang kali untuk memastikan sistem idempoten dan tidak menggandakan pembayaran.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Webhook Event ID</label>
              <input
                type="text"
                value={whEventId}
                onChange={(e) => setWhEventId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nomor Transaksi Target</label>
              <input
                type="text"
                value={whPayNum}
                onChange={(e) => setWhPayNum(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleTestWebhook}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              Kirim Webhook Lunas
            </button>
          </div>
          {whResult && (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono">
              {whResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
