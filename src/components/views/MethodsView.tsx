import { useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { apiFetch } from '../../api/client';
import type { AppUser, PaymentMethod, RolePermissions } from '../../types/payment';

interface MethodsViewProps {
  currentUser: AppUser;
  permissions: RolePermissions;
  methods: PaymentMethod[];
  onUpdated: () => void;
}

export function MethodsView({ currentUser, permissions, methods, onUpdated }: MethodsViewProps) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const updateMethod = async (id: string, patch: Record<string, unknown>) => {
    setBusyId(id);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/payment-methods/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setSuccess('Konfigurasi metode pembayaran diperbarui.');
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui metode.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900">Pengaturan Metode Pembayaran</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Atur kanal pembayaran yang aktif. Integrasi pihak ketiga dan payment gateway hanya dapat diaktifkan setelah kredensial, akun merchant, dan uji integrasi selesai.
        </p>
      </div>

      {!permissions.canConfigureMethods && (
        <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0 text-slate-500" />
          <span>Mode baca saja: hanya Super Admin atau Owner yang dapat mengubah konfigurasi metode pembayaran (peran Anda: {currentUser.role}).</span>
        </div>
      )}

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map((m) => {
          const readyForActivation =
            m.requires_gateway_credentials === 0 ||
            (m.credentials_configured === 1 && m.merchant_verified === 1 && m.integration_tested === 1);

          return (
            <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">{m.name}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Ref: <span className="font-mono">{m.configuration_reference || '—'}</span>
                    {' · '}
                    {m.requires_verification === 1 ? 'Verifikasi manual' : 'Otomatis / Kasir'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!permissions.canConfigureMethods || busyId === m.id}
                  onClick={() => updateMethod(m.id, { is_active: m.is_active === 1 ? 0 : 1 })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                    m.is_active === 1
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {m.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              {m.instructions && (
                <p className="text-xs text-slate-600">{m.instructions}</p>
              )}

              {m.requires_gateway_credentials === 1 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Prasyarat Aktivasi Integrasi Pihak Ketiga
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!permissions.canConfigureMethods}
                        checked={m.credentials_configured === 1}
                        onChange={(e) => updateMethod(m.id, { credentials_configured: e.target.checked })}
                      />
                      <span>Kredensial Server</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!permissions.canConfigureMethods}
                        checked={m.merchant_verified === 1}
                        onChange={(e) => updateMethod(m.id, { merchant_verified: e.target.checked })}
                      />
                      <span>Akun Merchant</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!permissions.canConfigureMethods}
                        checked={m.integration_tested === 1}
                        onChange={(e) => updateMethod(m.id, { integration_tested: e.target.checked })}
                      />
                      <span>Uji Integrasi</span>
                    </label>
                  </div>
                  {readyForActivation && (
                    <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Siap diaktifkan</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
