import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckSquare,
  Clock,
  CreditCard,
  FileText,
  GitCompare,
  LayoutDashboard,
  ListOrdered,
  RotateCcw,
  X,
} from 'lucide-react';
import type { RolePermissions, SubmenuKey } from '../types/payment';

interface SidebarProps {
  activeSubmenu: SubmenuKey;
  onSelect: (key: SubmenuKey) => void;
  pendingVerifyCount: number;
  permissions: RolePermissions;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavGroup {
  label: string;
  items: { key: SubmenuKey; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[];
}

export function Sidebar({
  activeSubmenu,
  onSelect,
  pendingVerifyCount,
  permissions,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const groups: NavGroup[] = [
    {
      label: 'Arus Kas & Transaksi',
      items: [
        { key: 'ringkasan', label: 'Ringkasan Pembayaran', icon: LayoutDashboard },
        { key: 'semua-transaksi', label: 'Semua Transaksi', icon: ListOrdered },
        { key: 'pembayaran-masuk', label: 'Pembayaran Masuk', icon: ArrowDownLeft },
        { key: 'pembayaran-keluar', label: 'Pembayaran Keluar', icon: ArrowUpRight },
      ],
    },
    {
      label: 'Franchise & Tagihan',
      items: [
        { key: 'pembayaran-franchise', label: 'Pembayaran Franchise', icon: Building2 },
        { key: 'tagihan-invoice', label: 'Tagihan / Invoice', icon: FileText },
        { key: 'pembayaran-tertunda', label: 'Pembayaran Tertunda', icon: Clock },
      ],
    },
    {
      label: 'Kontrol & Audit',
      items: [
        {
          key: 'verifikasi-pembayaran',
          label: 'Verifikasi Pembayaran',
          icon: CheckSquare,
          badge: pendingVerifyCount > 0 ? pendingVerifyCount : undefined,
        },
        { key: 'refund', label: 'Refund', icon: RotateCcw },
        { key: 'rekonsiliasi', label: 'Rekonsiliasi', icon: GitCompare },
      ],
    },
    {
      label: 'Konfigurasi & Laporan',
      items: [
        { key: 'metode-pembayaran', label: 'Metode Pembayaran', icon: CreditCard },
        { key: 'laporan-pembayaran', label: 'Laporan Pembayaran', icon: BarChart3 },
      ],
    },
  ];

  const handleSelect = (key: SubmenuKey) => {
    onSelect(key);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
          SajiPay
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu navigasi"
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Menu Pembayaran">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1.5 text-xs font-medium text-slate-500">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSubmenu === item.key;
                const isMuted =
                  (item.key === 'metode-pembayaran' && !permissions.canConfigureMethods) ||
                  (item.key === 'rekonsiliasi' && !permissions.canReconcile);

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelect(item.key)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[40px] ${
                      isActive
                        ? 'bg-teal-50 text-teal-800'
                        : isMuted
                        ? 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
