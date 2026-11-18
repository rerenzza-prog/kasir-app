import { Download, Printer, X } from 'lucide-react';
import type { Invoice } from '../types/payment';
import { formatDateWIB, formatIDR } from '../utils/format';
import { StatusBadge } from './StatusBadge';

interface InvoicePrintModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export function InvoicePrintModal({ invoice, onClose }: InvoicePrintModalProps) {
  if (!invoice) return null;

  const remaining = Math.max(0, invoice.total - invoice.paid_amount);

  const handleDownloadHtml = () => {
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"/><title>${invoice.invoice_number}</title>
    <style>body{font-family:sans-serif;padding:40px;color:#0f172a;max-width:780px;margin:auto}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border-bottom:1px solid #e2e8f0;padding:10px 8px;text-align:left}th{font-size:12px;color:#64748b}.num{text-align:right;font-family:monospace}</style>
    </head><body>
    <h1>INVOICE ${invoice.invoice_number}</h1>
    <p>Status: <strong>${invoice.status}</strong> | Terbit: ${formatDateWIB(invoice.issue_date)} | Jatuh Tempo: ${formatDateWIB(invoice.due_date)}</p>
    <p><strong>Penagih:</strong> ${invoice.bill_from}<br/><strong>Ditagihkan Kepada:</strong> ${invoice.bill_to_name}</p>
    <table><thead><tr><th>Deskripsi</th><th class="num">Qty</th><th class="num">Harga Satuan</th><th class="num">Jumlah</th></tr></thead><tbody>
    ${(invoice.items || []).map((i) => `<tr><td>${i.description}</td><td class="num">${i.quantity}</td><td class="num">${formatIDR(i.unit_price)}</td><td class="num">${formatIDR(i.line_total)}</td></tr>`).join('')}
    </tbody></table>
    <div style="margin-top:24px;text-align:right">
      <p>Subtotal: ${formatIDR(invoice.subtotal)}</p>
      <p>Diskon: -${formatIDR(invoice.discount)} | Pajak: ${formatIDR(invoice.tax)}</p>
      <h2>Total: ${formatIDR(invoice.total)}</h2>
      <p>Sudah Dibayar: ${formatIDR(invoice.paid_amount)} | Sisa Tagihan: <strong>${formatIDR(remaining)}</strong></p>
    </div></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoice_number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 no-print" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between no-print">
          <h2 className="font-display text-base font-bold text-slate-900">Dokumen Tagihan</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Dokumen</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-medium text-slate-500">SajiPay — Dokumen Tagihan Resmi</p>
              <h3 className="font-mono text-xl font-bold text-slate-900 mt-1">{invoice.invoice_number}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {invoice.brand_name} · {invoice.branch_name}
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={invoice.status} />
              <div className="text-xs text-slate-500 mt-2">
                Terbit: <span className="font-mono text-slate-800">{formatDateWIB(invoice.issue_date)}</span>
              </div>
              <div className="text-xs text-slate-500">
                Jatuh Tempo: <span className="font-mono text-slate-800">{formatDateWIB(invoice.due_date)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs text-slate-500">Pihak Penagih</p>
              <p className="font-semibold text-slate-900 mt-0.5">{invoice.bill_from}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Ditagihkan Kepada</p>
              <p className="font-semibold text-slate-900 mt-0.5">{invoice.bill_to_name}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 text-left font-medium">Deskripsi</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Harga Satuan</th>
                <th className="py-2 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((it) => (
                <tr key={it.id} className="border-b border-slate-100">
                  <td className="py-2.5 text-slate-800">{it.description}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">{it.quantity}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">{formatIDR(it.unit_price)}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">{formatIDR(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end space-y-1.5 text-sm pt-2">
            <div className="flex justify-between w-64 text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatIDR(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between w-64 text-slate-600">
              <span>Diskon</span>
              <span className="font-mono tabular-nums">- {formatIDR(invoice.discount)}</span>
            </div>
            <div className="flex justify-between w-64 text-slate-600">
              <span>Pajak</span>
              <span className="font-mono tabular-nums">{formatIDR(invoice.tax)}</span>
            </div>
            <div className="flex justify-between w-64 pt-2 border-t border-slate-200 font-bold text-slate-900">
              <span>Total Tagihan</span>
              <span className="font-mono tabular-nums">{formatIDR(invoice.total)}</span>
            </div>
            <div className="flex justify-between w-64 text-emerald-700">
              <span>Sudah Terbayar</span>
              <span className="font-mono tabular-nums">{formatIDR(invoice.paid_amount)}</span>
            </div>
            <div className="flex justify-between w-64 font-semibold text-amber-700">
              <span>Sisa Tagihan</span>
              <span className="font-mono tabular-nums">{formatIDR(remaining)}</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Catatan: {invoice.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
