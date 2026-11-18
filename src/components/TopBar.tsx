import { Menu, Plus } from 'lucide-react';
import type { AppUser, RolePermissions, SubmenuKey } from '../types/payment';

const SUBMENU_TITLES: Record<SubmenuKey, string> = {
  'ringkasan': 'Ringkasan Pembayaran',
  'semua-transaksi': 'Semua Transaksi',
  'pembayaran-masuk': 'Pembayaran Masuk',
  'pembayaran-keluar': 'Pembayaran Keluar',
  'pembayaran-franchise': 'Pembayaran Franchise',
  'tagihan-invoice': 'Tagihan / Invoice',
  'pembayaran-tertunda': 'Pembayaran Tertunda',
  'verifikasi-pembayaran': 'Verifikasi Pembayaran',
  'refund': 'Refund',
  'rekonsiliasi': 'Rekonsiliasi',
  'metode-pembayaran': 'Metode Pembayaran',
  'laporan-pembayaran': 'Laporan Pembayaran',
};

interface TopBarProps {
  activeSubmenu: SubmenuKey;
  currentUser: AppUser;
  users: AppUser[];
  permissions: RolePermissions;
  onSwitchUser: (userId: string) => void;
  onOpenMobileMenu: () => void;
  onOpenCreatePayment: () => void;
}

export function TopBar({
  activeSubmenu,
  currentUser,
  users,
  permissions,
  onSwitchUser,
  onOpenMobileMenu,
  onOpenCreatePayment,
}: TopBarProps) {
  const canCreateAny =
    permissions.canCreatePosPayment ||
    permissions.canCreateIncomingOther ||
    permissions.canCreateOutgoing ||
    permissions.canManageFranchise;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Buka menu navigasi"
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 whitespace-nowrap hidden sm:inline">Pembayaran</span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {SUBMENU_TITLES[activeSubmenu]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <label htmlFor="rbac-user-select" className="sr-only">
            Peran Pengguna Aktif
          </label>
          <select
            id="rbac-user-select"
            value={currentUser.id}
            onChange={(e) => onSwitchUser(e.target.value)}
            className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600 max-w-[180px] sm:max-w-[260px] truncate"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.role} — {u.name}
              </option>
            ))}
          </select>
        </div>

        {canCreateAny && (
          <button
            type="button"
            onClick={onOpenCreatePayment}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Catat Pembayaran</span>
          </button>
        )}
      </div>
    </header>
  );
}
