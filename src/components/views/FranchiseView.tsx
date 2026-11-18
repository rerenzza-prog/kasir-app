import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { apiFetch } from '../../api/client';
import type { AppUser, Branch, Invoice, Partner, Payment, RolePermissions } from '../../types/payment';
import { formatDateWIB, formatIDR, getPaymentTypeLabel } from '../../utils/format';
import { StatusBadge } from '../StatusBadge';

interface FranchiseViewProps {
  currentUser: AppUser;
  permissions: RolePermissions;
  branches: Branch[];
  partners: Partner[];
  refreshKey: number;
  onPayInvoice: (invoice: Invoice) => void;
  onSelectPayment: (id: string) => void;
  onGenerated: () => void;
}

export function FranchiseView({
  currentUser,
  permissions,
  branches,
  partners,
  refreshKey,
  onPayInvoice,
  onSelectPayment,
  onGenerated,
}: FranchiseViewProps) {
  const franchiseBranches = branches.filter((b) => b.is_franchise === 1);
  const [selectedBranchId, setSelectedBranchId] = useState(franchiseBranches[0]?.id || '');
  const [grossSales, setGrossSales] = useState('140000000');
  const [periodLabel, setPeriodLabel] = useState('November 2026');
  const [dueDate, setDueDate] = useState('2026-11-30');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!selectedBranchId && franchiseBranches[0]) {
      setSelectedBranchId(franchiseBranches[0].id);
    }
  }, [franchiseBranches.length]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [invFee, invRoy, payRes] = await Promise.all([
        apiFetch<{ items: Invoice[] }>('/api/invoices?category=franchise_fee'),
        apiFetch<{ items: Invoice[] }>('/api/invoices?category=royalty'),
        apiFetch<{ items: Payment[] }>('/api/payments?limit=50'),
      ]);
      if (!active) return;
      setInvoices([...invFee.items, ...invRoy.items]);
      setPayments(
        payRes.items.filter((p) => p.payment_type === 'franchise_fee' || p.payment_type === 'franchise_royalty')
      );
    };
    load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const canGenerateRoyalty = permissions.canManageFranchise && currentUser.role !== 'Mitra Franchise';
  const activeBranch = franchiseBranches.find((b) => b.id === selectedBranchId);
  const activePartner = partners.find((p) => p.id === activeBranch?.partner_id);
  const calcSubtotal = Math.round((Number(grossSales) || 0) * (activePartner?.royalty_rate || 0));
  const calcTax = Math.round(calcSubtotal * 0.11);
  const calcTotal = calcSubtotal + calcTax;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr('');
    setMsg('');
    try {
      const res = await apiFetch<{ invoice_number: string }>('/api/franchise/generate-royalty', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: selectedBranchId,
          gross_sales: Number(grossSales),
          period_label: periodLabel,
          due_date: dueDate,
        }),
      });
      setMsg(`Tagihan royalti ${res.invoice_number} berhasil diterbitkan.`);
      onGenerated();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Gagal menerbitkan royalti.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900">Pembayaran Biaya Franchise & Royalti</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Kelola tagihan biaya kemitraan, perhitungan royalti outlet, dan rekap pembayaran mitra franchise.
        </p>
      </div>

      {/* Royalty Calculator for Admin/Finance/Owner */}
      {canGenerateRoyalty && franchiseBranches.length > 0 && (
        <form onSubmit={handleGenerate} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-teal-700" />
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Terbitkan Tagihan Royalti Mitra Berdasarkan Kontrak
            </h3>
          </div>
          {msg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>}
          {err && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{err}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Outlet Mitra</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                {franchiseBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Omzet Penjualan Periode (IDR)</label>
              <input
                type="number"
                min={1}
                required
                value={grossSales}
                onChange={(e) => setGrossSales(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Periode</label>
              <input
                type="text"
                required
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Jatuh Tempo</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs">
            <div className="text-slate-600">
              Tarif Kontrak: <span className="font-mono font-semibold text-slate-900">{((activePartner?.royalty_rate || 0) * 100).toFixed(1)}%</span>
              {' · '}Royalti Pokok: <span className="font-mono font-semibold text-slate-900">{formatIDR(calcSubtotal)}</span>
              {' · '}PPN 11%: <span className="font-mono font-semibold text-slate-900">{formatIDR(calcTax)}</span>
              {' · '}Total Tagihan: <span className="font-mono font-bold text-teal-800">{formatIDR(calcTotal)}</span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
            >
              {submitting ? 'Menerbitkan...' : 'Terbitkan Tagihan Royalti'}
            </button>
          </div>
        </form>
      )}

      {/* Franchise Invoices */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display text-sm font-semibold text-slate-900">Tagihan Biaya Franchise & Royalti</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2.5 px-4 text-left font-medium">No. Invoice</th>
                <th className="py-2.5 px-4 text-left font-medium">Mitra & Outlet</th>
                <th className="py-2.5 px-4 text-left font-medium">Jatuh Tempo</th>
                <th className="py-2.5 px-4 text-left font-medium">Status</th>
                <th className="py-2.5 px-4 text-right font-medium">Total</th>
                <th className="py-2.5 px-4 text-right font-medium">Sisa Tagihan</th>
                <th className="py-2.5 px-4 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => {
                const rem = Math.max(0, inv.total - inv.paid_amount);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{inv.invoice_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{inv.bill_to_name}</div>
                      <div className="text-[11px] text-slate-500">{inv.branch_name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{formatDateWIB(inv.due_date)}</td>
                    <td className="py-3 px-4"><StatusBadge status={inv.status} /></td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatIDR(inv.total)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-700">{formatIDR(rem)}</td>
                    <td className="py-3 px-4 text-right">
                      {rem > 0 && inv.status !== 'Dibatalkan' && permissions.canManageFranchise && (
                        <button
                          type="button"
                          onClick={() => onPayInvoice(inv)}
                          className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
                        >
                          Bayar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Belum ada tagihan franchise untuk akun Anda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Franchise Payment History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display text-sm font-semibold text-slate-900">Riwayat Pembayaran Mitra</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2.5 px-4 text-left font-medium">No. Pembayaran</th>
                <th className="py-2.5 px-4 text-left font-medium">Jenis</th>
                <th className="py-2.5 px-4 text-left font-medium">Mitra / Outlet</th>
                <th className="py-2.5 px-4 text-left font-medium">Status</th>
                <th className="py-2.5 px-4 text-right font-medium">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} onClick={() => onSelectPayment(p.id)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">{p.payment_number}</td>
                  <td className="py-3 px-4 text-slate-600">{getPaymentTypeLabel(p.payment_type)}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{p.party_name}</div>
                    <div className="text-[11px] text-slate-500">{p.branch_name}</div>
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">{formatIDR(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
