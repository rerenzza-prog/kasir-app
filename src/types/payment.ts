export type PaymentStatus =
  | 'Draft'
  | 'Menunggu Pembayaran'
  | 'Menunggu Verifikasi'
  | 'Lunas'
  | 'Ditolak'
  | 'Gagal'
  | 'Kedaluwarsa'
  | 'Dibatalkan'
  | 'Refund Diproses'
  | 'Direfund';

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'Draft',
  'Menunggu Pembayaran',
  'Menunggu Verifikasi',
  'Lunas',
  'Ditolak',
  'Gagal',
  'Kedaluwarsa',
  'Dibatalkan',
  'Refund Diproses',
  'Direfund',
];

export type UserRole =
  | 'Super Admin'
  | 'Owner'
  | 'Admin Pusat'
  | 'Mitra Franchise'
  | 'Manager Cabang'
  | 'Kasir'
  | 'Finance';

export type PaymentType =
  | 'incoming_pos'
  | 'incoming_other'
  | 'outgoing_supplier'
  | 'outgoing_expense'
  | 'franchise_fee'
  | 'franchise_royalty';

export type PaymentDirection = 'in' | 'out';

export type MethodType =
  | 'cash'
  | 'bank_transfer'
  | 'qris'
  | 'ewallet'
  | 'card'
  | 'gateway';

export type ReconciliationMatchStatus =
  | 'Cocok'
  | 'Tidak Cocok'
  | 'Belum Ditemukan';

export type SubmenuKey =
  | 'ringkasan'
  | 'semua-transaksi'
  | 'pembayaran-masuk'
  | 'pembayaran-keluar'
  | 'pembayaran-franchise'
  | 'tagihan-invoice'
  | 'pembayaran-tertunda'
  | 'verifikasi-pembayaran'
  | 'refund'
  | 'rekonsiliasi'
  | 'metode-pembayaran'
  | 'laporan-pembayaran';

export interface Brand {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  brand_id: string;
  brand_name?: string;
  name: string;
  code: string;
  city: string;
  is_franchise: number;
  partner_id: string | null;
}

export interface Partner {
  id: string;
  tenant_id: string;
  name: string;
  company_name: string;
  royalty_rate: number;
  email: string;
  phone: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  bank_account: string;
  phone: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  brand_id: string | null;
  branch_id: string | null;
  partner_id: string | null;
  max_approval_limit: number;
}

export interface PaymentMethod {
  id: string;
  tenant_id: string;
  name: string;
  method_type: MethodType;
  is_active: number;
  requires_verification: number;
  requires_gateway_credentials: number;
  credentials_configured: number;
  merchant_verified: number;
  integration_tested: number;
  configuration_reference: string | null;
  instructions: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  brand_id: string;
  brand_name?: string;
  branch_id: string;
  branch_name?: string;
  invoice_number: string;
  invoice_category: 'sales' | 'supplier' | 'franchise_fee' | 'royalty';
  bill_from: string;
  bill_to_type: 'customer' | 'supplier' | 'partner' | 'branch';
  bill_to_id: string | null;
  bill_to_name: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  remaining_amount?: number;
  allow_partial: number;
  issue_date: string;
  due_date: string;
  status: PaymentStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  items?: InvoiceItem[];
}

export interface Payment {
  id: string;
  tenant_id: string;
  brand_id: string;
  brand_name?: string;
  branch_id: string;
  branch_name?: string;
  invoice_id: string | null;
  invoice_number?: string | null;
  partner_id: string | null;
  supplier_id: string | null;
  payment_number: string;
  payment_type: PaymentType;
  direction: PaymentDirection;
  party_name: string;
  subtotal: number;
  discount: number;
  tax: number;
  amount: number;
  received_amount: number;
  change_amount: number;
  currency: string;
  method_id: string;
  method_name?: string;
  method_type?: MethodType;
  status: PaymentStatus;
  paid_at: string | null;
  expires_at: string | null;
  reference_number: string | null;
  idempotency_key: string | null;
  requires_approval: number;
  approval_status: string | null;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  notes: string | null;
  refunded_amount?: number;
}

export interface PaymentVerification {
  id: string;
  payment_id: string;
  reviewer_id: string;
  reviewer_name: string;
  decision: 'approved' | 'rejected';
  notes: string | null;
  reviewed_at: string;
}

export interface PaymentAttachment {
  id: string;
  payment_id: string;
  file_reference: string;
  file_name: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

export interface RefundRecord {
  id: string;
  payment_id: string;
  payment_number?: string;
  party_name?: string;
  payment_amount?: number;
  branch_name?: string;
  refund_number: string;
  amount: number;
  reason: string;
  status: 'Menunggu Persetujuan' | 'Refund Diproses' | 'Direfund' | 'Ditolak';
  requested_by: string;
  requested_by_name?: string;
  approved_by: string | null;
  approved_by_name?: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface ReconciliationRecord {
  id: string;
  tenant_id: string;
  payment_id: string | null;
  payment_number?: string | null;
  payment_amount?: number | null;
  party_name?: string | null;
  method_name?: string | null;
  statement_date: string;
  provider_name: string;
  external_reference: string;
  external_amount: number;
  match_status: ReconciliationMatchStatus;
  adjustment_notes: string | null;
  reconciled_by: string | null;
  reconciled_by_name?: string | null;
  reconciled_at: string | null;
}

export interface PaymentStatusLog {
  id: string;
  payment_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  changed_by_name: string;
  reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

export interface PaymentDetailResponse {
  payment: Payment;
  verifications: PaymentVerification[];
  attachments: PaymentAttachment[];
  refunds: RefundRecord[];
  statusLogs: PaymentStatusLog[];
  reconciliation: ReconciliationRecord | null;
  invoice: Invoice | null;
}

export interface RolePermissions {
  canViewAllBranches: boolean;
  canCreatePosPayment: boolean;
  canCreateIncomingOther: boolean;
  canCreateOutgoing: boolean;
  canManageInvoices: boolean;
  canManageFranchise: boolean;
  canVerifyManual: boolean;
  canRequestRefund: boolean;
  canApproveRefund: boolean;
  canReconcile: boolean;
  canConfigureMethods: boolean;
  canCorrectSettled: boolean;
  canExportReports: boolean;
}
