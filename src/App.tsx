import { useCallback, useEffect, useState } from 'react';
import { apiFetch, setActiveUserId } from './api/client';
import { CreatePaymentModal } from './components/CreatePaymentModal';
import { InvoiceModal } from './components/InvoiceModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TransactionDrawer } from './components/TransactionDrawer';
import { DashboardView } from './components/views/DashboardView';
import { FranchiseView } from './components/views/FranchiseView';
import { InvoicesView } from './components/views/InvoicesView';
import { MethodsView } from './components/views/MethodsView';
import { ReconciliationView } from './components/views/ReconciliationView';
import { RefundView } from './components/views/RefundView';
import { ReportsView } from './components/views/ReportsView';
import { TransactionsView } from './components/views/TransactionsView';
import { VerificationView } from './components/views/VerificationView';
import type {
  AppUser,
  Branch,
  Brand,
  Invoice,
  Partner,
  PaymentMethod,
  PaymentType,
  RolePermissions,
  SubmenuKey,
  Supplier,
} from './types/payment';

interface BootstrapData {
  user: AppUser;
  permissions: RolePermissions;
  users: AppUser[];
  brands: Brand[];
  branches: Branch[];
  partners: Partner[];
  suppliers: Supplier[];
  paymentMethods: PaymentMethod[];
  makerCheckerThreshold: number;
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuKey>('ringkasan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingVerifyCount, setPendingVerifyCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false);
  const [createPaymentDefaultMode, setCreatePaymentDefaultMode] = useState<PaymentType>('incoming_pos');
  const [prefillInvoice, setPrefillInvoice] = useState<Invoice | null>(null);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [loadError, setLoadError] = useState('');

  const loadAppData = useCallback(async () => {
    try {
      setLoadError('');
      const [boot, summary] = await Promise.all([
        apiFetch<BootstrapData>('/api/bootstrap'),
        apiFetch<{ kpis: { pendingVerificationCount: number } }>('/api/summary'),
      ]);
      setBootstrap(boot);
      setPendingVerifyCount(summary.kpis.pendingVerificationCount);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat sistem pembayaran.');
    }
  }, []);

  useEffect(() => {
    loadAppData();
  }, [loadAppData, refreshKey]);

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleSwitchUser = (userId: string) => {
    setActiveUserId(userId);
    setSelectedPaymentId(null);
    triggerRefresh();
  };

  const openCreatePayment = (mode: PaymentType = 'incoming_pos', invoice: Invoice | null = null) => {
    setPrefillInvoice(invoice);
    setCreatePaymentDefaultMode(mode);
    setCreatePaymentOpen(true);
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 space-y-3">
          <h1 className="font-display text-base font-bold text-red-800">Gagal Memuat Modul Pembayaran</h1>
          <p className="text-sm text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={() => loadAppData()}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Memuat Modul Pembayaran SajiPay...
      </div>
    );
  }

  const { user, permissions, users, brands, branches, partners, suppliers, paymentMethods, makerCheckerThreshold } = bootstrap;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeSubmenu={activeSubmenu}
        onSelect={setActiveSubmenu}
        pendingVerifyCount={pendingVerifyCount}
        permissions={permissions}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSubmenu={activeSubmenu}
          currentUser={user}
          users={users}
          permissions={permissions}
          onSwitchUser={handleSwitchUser}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCreatePayment={() =>
            openCreatePayment(
              permissions.canCreatePosPayment
                ? 'incoming_pos'
                : permissions.canCreateOutgoing
                ? 'outgoing_supplier'
                : 'franchise_royalty'
            )
          }
        />

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSubmenu === 'ringkasan' && (
            <DashboardView
              brands={brands}
              branches={branches}
              refreshKey={refreshKey}
              onSelectPayment={setSelectedPaymentId}
              onNavigate={setActiveSubmenu}
            />
          )}

          {activeSubmenu === 'semua-transaksi' && (
            <TransactionsView
              mode="all"
              brands={brands}
              branches={branches}
              methods={paymentMethods}
              permissions={permissions}
              refreshKey={refreshKey}
              onSelectPayment={setSelectedPaymentId}
              onOpenCreate={(mode) => openCreatePayment(mode)}
            />
          )}

          {activeSubmenu === 'pembayaran-masuk' && (
            <TransactionsView
              mode="in"
              brands={brands}
              branches={branches}
              methods={paymentMethods}
              permissions={permissions}
              refreshKey={refreshKey}
              onSelectPayment={setSelectedPaymentId}
              onOpenCreate={(mode) => openCreatePayment(mode)}
            />
          )}

          {activeSubmenu === 'pembayaran-keluar' && (
            <TransactionsView
              mode="out"
              brands={brands}
              branches={branches}
              methods={paymentMethods}
              permissions={permissions}
              refreshKey={refreshKey}
              onSelectPayment={setSelectedPaymentId}
              onOpenCreate={(mode) => openCreatePayment(mode)}
            />
          )}

          {activeSubmenu === 'pembayaran-franchise' && (
            <FranchiseView
              currentUser={user}
              permissions={permissions}
              branches={branches}
              partners={partners}
              refreshKey={refreshKey}
              onPayInvoice={(inv) => openCreatePayment('franchise_royalty', inv)}
              onSelectPayment={setSelectedPaymentId}
              onGenerated={triggerRefresh}
            />
          )}

          {activeSubmenu === 'tagihan-invoice' && (
            <InvoicesView
              pendingOnly={false}
              permissions={permissions}
              refreshKey={refreshKey}
              onOpenCreateInvoice={() => setCreateInvoiceOpen(true)}
              onPayInvoice={(inv) => openCreatePayment('incoming_other', inv)}
              onPrintInvoice={setPrintInvoice}
              onUpdated={triggerRefresh}
            />
          )}

          {activeSubmenu === 'pembayaran-tertunda' && (
            <InvoicesView
              pendingOnly={true}
              permissions={permissions}
              refreshKey={refreshKey}
              onOpenCreateInvoice={() => setCreateInvoiceOpen(true)}
              onPayInvoice={(inv) => openCreatePayment('incoming_other', inv)}
              onPrintInvoice={setPrintInvoice}
              onUpdated={triggerRefresh}
            />
          )}

          {activeSubmenu === 'verifikasi-pembayaran' && (
            <VerificationView
              currentUser={user}
              permissions={permissions}
              refreshKey={refreshKey}
              onUpdated={triggerRefresh}
            />
          )}

          {activeSubmenu === 'refund' && (
            <RefundView
              currentUser={user}
              permissions={permissions}
              refreshKey={refreshKey}
              onUpdated={triggerRefresh}
            />
          )}

          {activeSubmenu === 'rekonsiliasi' && (
            <ReconciliationView
              permissions={permissions}
              refreshKey={refreshKey}
              onUpdated={triggerRefresh}
            />
          )}

          {activeSubmenu === 'metode-pembayaran' && (
            <MethodsView
              currentUser={user}
              permissions={permissions}
              methods={paymentMethods}
              onUpdated={triggerRefresh}
            />
          )}

          {activeSubmenu === 'laporan-pembayaran' && (
            <ReportsView
              brands={brands}
              branches={branches}
              permissions={permissions}
              refreshKey={refreshKey}
            />
          )}
        </main>
      </div>

      <TransactionDrawer
        paymentId={selectedPaymentId}
        currentUser={user}
        permissions={permissions}
        onClose={() => setSelectedPaymentId(null)}
        onUpdated={triggerRefresh}
      />

      <CreatePaymentModal
        open={createPaymentOpen}
        defaultMode={createPaymentDefaultMode}
        prefillInvoice={prefillInvoice}
        currentUser={user}
        permissions={permissions}
        branches={branches}
        methods={paymentMethods}
        suppliers={suppliers}
        partners={partners}
        makerCheckerThreshold={makerCheckerThreshold}
        onClose={() => setCreatePaymentOpen(false)}
        onCreated={triggerRefresh}
      />

      <InvoiceModal
        open={createInvoiceOpen}
        branches={branches}
        partners={partners}
        suppliers={suppliers}
        onClose={() => setCreateInvoiceOpen(false)}
        onCreated={triggerRefresh}
      />

      <InvoicePrintModal
        invoice={printInvoice}
        onClose={() => setPrintInvoice(null)}
      />
    </div>
  );
}
