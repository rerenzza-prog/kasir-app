import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'payments.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function makeSvgReceipt(title: string, bank: string, ref: string, amountText: string, sender: string, timeText: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="340" viewBox="0 0 520 340">
    <rect width="520" height="340" fill="#F8FAFC"/>
    <rect x="20" y="20" width="480" height="300" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
    <rect x="20" y="20" width="480" height="56" rx="12" fill="#0F766E"/>
    <rect x="20" y="64" width="480" height="12" fill="#0F766E"/>
    <text x="40" y="54" font-family="sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">${bank} — ${title}</text>
    <text x="40" y="110" font-family="sans-serif" font-size="13" fill="#64748B">Status Transaksi</text>
    <text x="480" y="110" font-family="sans-serif" font-size="13" font-weight="bold" fill="#16A34A" text-anchor="end">BERHASIL DIKIRIM</text>
    <line x1="40" y1="126" x2="480" y2="126" stroke="#E2E8F0" stroke-width="1"/>
    <text x="40" y="156" font-family="sans-serif" font-size="13" fill="#64748B">Nominal Transfer</text>
    <text x="480" y="156" font-family="monospace" font-size="18" font-weight="bold" fill="#0F172A" text-anchor="end">${amountText}</text>
    <text x="40" y="190" font-family="sans-serif" font-size="13" fill="#64748B">Pengirim</text>
    <text x="480" y="190" font-family="sans-serif" font-size="13" font-weight="600" fill="#0F172A" text-anchor="end">${sender}</text>
    <text x="40" y="220" font-family="sans-serif" font-size="13" fill="#64748B">No. Referensi</text>
    <text x="480" y="220" font-family="monospace" font-size="13" font-weight="600" fill="#0F172A" text-anchor="end">${ref}</text>
    <text x="40" y="250" font-family="sans-serif" font-size="13" fill="#64748B">Waktu Transaksi (WIB)</text>
    <text x="480" y="250" font-family="monospace" font-size="12" fill="#334155" text-anchor="end">${timeText}</text>
    <line x1="40" y1="274" x2="480" y2="274" stroke="#E2E8F0" stroke-dasharray="4 4"/>
    <text x="40" y="298" font-family="sans-serif" font-size="11" fill="#64748B">Bukti unggahan membutuhkan verifikasi petugas keuangan.</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      royalty_rate REAL NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL REFERENCES brands(id),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      is_franchise INTEGER NOT NULL DEFAULT 0,
      partner_id TEXT REFERENCES partners(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      bank_account TEXT NOT NULL,
      phone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      brand_id TEXT,
      branch_id TEXT,
      partner_id TEXT,
      max_approval_limit REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      method_type TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      requires_verification INTEGER NOT NULL DEFAULT 0,
      requires_gateway_credentials INTEGER NOT NULL DEFAULT 0,
      credentials_configured INTEGER NOT NULL DEFAULT 0,
      merchant_verified INTEGER NOT NULL DEFAULT 0,
      integration_tested INTEGER NOT NULL DEFAULT 0,
      configuration_reference TEXT,
      instructions TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL REFERENCES brands(id),
      branch_id TEXT NOT NULL REFERENCES branches(id),
      invoice_number TEXT NOT NULL UNIQUE,
      invoice_category TEXT NOT NULL,
      bill_from TEXT NOT NULL,
      bill_to_type TEXT NOT NULL,
      bill_to_id TEXT,
      bill_to_name TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      allow_partial INTEGER NOT NULL DEFAULT 1,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      brand_id TEXT NOT NULL REFERENCES brands(id),
      branch_id TEXT NOT NULL REFERENCES branches(id),
      invoice_id TEXT REFERENCES invoices(id),
      partner_id TEXT REFERENCES partners(id),
      supplier_id TEXT REFERENCES suppliers(id),
      payment_number TEXT NOT NULL UNIQUE,
      payment_type TEXT NOT NULL,
      direction TEXT NOT NULL,
      party_name TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL,
      received_amount REAL NOT NULL DEFAULT 0,
      change_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IDR',
      method_id TEXT NOT NULL REFERENCES payment_methods(id),
      status TEXT NOT NULL,
      paid_at TEXT,
      expires_at TEXT,
      reference_number TEXT UNIQUE,
      idempotency_key TEXT UNIQUE,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      approval_status TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_verifications (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL REFERENCES payments(id),
      reviewer_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      notes TEXT,
      reviewed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_attachments (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL REFERENCES payments(id),
      file_reference TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL REFERENCES payments(id),
      refund_number TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      approved_by TEXT,
      processed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reconciliations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      payment_id TEXT REFERENCES payments(id),
      statement_date TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      external_reference TEXT NOT NULL,
      external_amount REAL NOT NULL,
      match_status TEXT NOT NULL,
      adjustment_notes TEXT,
      reconciled_by TEXT,
      reconciled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_status_logs (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL REFERENCES payments(id),
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_by_name TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      payment_number TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );
  `);

  const existingBrands = db.prepare('SELECT COUNT(*) as cnt FROM brands').get() as { cnt: number };
  if (existingBrands.cnt === 0) {
    seedDatabase();
  }
}

function seedDatabase() {
  const tenantId = 'tenant-nusantara-group';

  const insertBrand = db.prepare('INSERT INTO brands (id, tenant_id, name, code) VALUES (?, ?, ?, ?)');
  insertBrand.run('brand-kopi', tenantId, 'Kopi Nusantara', 'KN');
  insertBrand.run('brand-bakmi', tenantId, 'Bakmi Sentosa', 'BS');

  const insertPartner = db.prepare('INSERT INTO partners (id, tenant_id, name, company_name, royalty_rate, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertPartner.run('partner-mitra-jkt', tenantId, 'Budi Santoso', 'PT Mitra Rasa Jakarta', 0.06, 'budi@mitrarasa.co.id', '0812-8890-1122');
  insertPartner.run('partner-mitra-bdg', tenantId, 'Siti Rahmawati', 'CV Kuliner Parahyangan', 0.055, 'siti@parahyangan.id', '0813-2244-9900');

  const insertBranch = db.prepare('INSERT INTO branches (id, tenant_id, brand_id, name, code, city, is_franchise, partner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertBranch.run('branch-jkt-sudirman', tenantId, 'brand-kopi', 'Kopi Nusantara Sudirman', 'KN-JKT-01', 'Jakarta Selatan', 0, null);
  insertBranch.run('branch-jkt-kemang', tenantId, 'brand-kopi', 'Kopi Nusantara Kemang (Mitra)', 'KN-JKT-02', 'Jakarta Selatan', 1, 'partner-mitra-jkt');
  insertBranch.run('branch-bdg-dago', tenantId, 'brand-bakmi', 'Bakmi Sentosa Dago (Mitra)', 'BS-BDG-01', 'Bandung', 1, 'partner-mitra-bdg');
  insertBranch.run('branch-sby-tunjungan', tenantId, 'brand-bakmi', 'Bakmi Sentosa Tunjungan', 'BS-SBY-01', 'Surabaya', 0, null);

  const insertSupplier = db.prepare('INSERT INTO suppliers (id, tenant_id, name, category, bank_account, phone) VALUES (?, ?, ?, ?, ?, ?)');
  insertSupplier.run('sup-roastery', tenantId, 'PT Roastery Arabika Gayo', 'Biji Kopi & Bahan Minuman', 'BCA 5201993811', '021-5591022');
  insertSupplier.run('sup-tepung', tenantId, 'CV Pangan Sejahtera', 'Tepung, Mie & Bumbu Dapur', 'Mandiri 130009918273', '022-4209182');
  insertSupplier.run('sup-kemasan', tenantId, 'PT Kemasan Ramah Indonesia', 'Cup, Lid & Box Takeaway', 'BNI 0881920192', '021-8890123');

  const insertUser = db.prepare('INSERT INTO users (id, name, email, role, tenant_id, brand_id, branch_id, partner_id, max_approval_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertUser.run('usr-superadmin', 'Rangga Pratama', 'rangga@kulinerpay.id', 'Super Admin', tenantId, null, null, null, 1000000000);
  insertUser.run('usr-owner', 'Hendra Wijaya', 'hendra@nusantaragroup.id', 'Owner', tenantId, null, null, null, 500000000);
  insertUser.run('usr-adminpusat', 'Dewi Lestari', 'dewi.pusat@nusantaragroup.id', 'Admin Pusat', tenantId, null, null, null, 25000000);
  insertUser.run('usr-mitra-jkt', 'Budi Santoso', 'budi@mitrarasa.co.id', 'Mitra Franchise', tenantId, 'brand-kopi', 'branch-jkt-kemang', 'partner-mitra-jkt', 0);
  insertUser.run('usr-manager-sudirman', 'Andi Kusuma', 'andi.sudirman@nusantaragroup.id', 'Manager Cabang', tenantId, 'brand-kopi', 'branch-jkt-sudirman', null, 5000000);
  insertUser.run('usr-kasir-sudirman', 'Nadia Putri', 'nadia.kasir@nusantaragroup.id', 'Kasir', tenantId, 'brand-kopi', 'branch-jkt-sudirman', null, 0);
  insertUser.run('usr-finance', 'Kartika Sari', 'kartika.fin@nusantaragroup.id', 'Finance', tenantId, null, null, null, 50000000);

  const insertMethod = db.prepare(`
    INSERT INTO payment_methods (
      id, tenant_id, name, method_type, is_active, requires_verification,
      requires_gateway_credentials, credentials_configured, merchant_verified,
      integration_tested, configuration_reference, instructions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMethod.run('mtd-cash', tenantId, 'Tunai (Kasir POS)', 'cash', 1, 0, 0, 1, 1, 1, 'POS-CASH-DRAWER', 'Terima uang tunai dan hitung kembalian di mesin kasir.');
  insertMethod.run('mtd-transfer', tenantId, 'Transfer Bank Manual (BCA / Mandiri)', 'bank_transfer', 1, 1, 0, 1, 1, 1, 'BCA 8820192831 a.n. PT Nusantara Kuliner', 'Transfer ke BCA 8820192831 dan unggah bukti transfer untuk verifikasi petugas.');
  insertMethod.run('mtd-qris', tenantId, 'QRIS Statis / Manual', 'qris', 1, 1, 0, 1, 1, 1, 'NMID-ID102938475612', 'Scan QRIS outlet, masukkan nominal sesuai tagihan, dan simpan bukti pembayaran.');
  insertMethod.run('mtd-ewallet', tenantId, 'E-Wallet (GoPay / OVO / Dana)', 'ewallet', 1, 1, 1, 1, 1, 1, 'EWALLET-MERCHANT-01', 'Konfirmasi bukti pembayaran aplikasi e-wallet di kasir.');
  insertMethod.run('mtd-card', tenantId, 'Kartu Debit / Kredit (EDC)', 'card', 1, 0, 1, 1, 1, 1, 'EDC-BCA-MERCHANT-991', 'Gesek/tap kartu di terminal EDC dan catat nomor approval trace.');
  insertMethod.run('mtd-gateway', tenantId, 'Payment Gateway (Midtrans / Xendit)', 'gateway', 0, 0, 1, 0, 0, 0, 'UNCONFIGURED', 'Aktifkan setelah API key server, akun merchant, dan uji webhook sandbox selesai.');

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      id, tenant_id, brand_id, branch_id, invoice_number, invoice_category,
      bill_from, bill_to_type, bill_to_id, bill_to_name, subtotal, discount, tax, total,
      paid_amount, allow_partial, issue_date, due_date, status, notes, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, line_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Invoices
  insertInvoice.run(
    'inv-1', tenantId, 'brand-kopi', 'branch-jkt-kemang', 'INV-FR-202611-001', 'royalty',
    'PT Nusantara Kuliner Pusat', 'partner', 'partner-mitra-jkt', 'PT Mitra Rasa Jakarta (Budi Santoso)',
    9000000, 0, 990000, 9990000, 9990000, 1, '2026-11-01', '2026-11-10', 'Lunas',
    'Royalti bulan Oktober 2026 (6% dari omzet Rp 150.000.000)', 'usr-adminpusat', '2026-11-01T02:00:00.000Z'
  );
  insertItem.run('item-1a', 'inv-1', 'Royalti Operasional Outlet Kemang (6% x Rp 150.000.000)', 1, 9000000, 9000000);

  insertInvoice.run(
    'inv-2', tenantId, 'brand-bakmi', 'branch-bdg-dago', 'INV-FR-202611-002', 'royalty',
    'PT Nusantara Kuliner Pusat', 'partner', 'partner-mitra-bdg', 'CV Kuliner Parahyangan (Siti Rahmawati)',
    6875000, 0, 756250, 7631250, 4000000, 1, '2026-11-05', '2026-11-20', 'Menunggu Pembayaran',
    'Royalti Oktober 2026 + cicilan awal terbayar Rp 4.000.000', 'usr-adminpusat', '2026-11-05T03:00:00.000Z'
  );
  insertItem.run('item-2a', 'inv-2', 'Royalti Outlet Dago (5,5% x Rp 125.000.000)', 1, 6875000, 6875000);

  insertInvoice.run(
    'inv-3', tenantId, 'brand-kopi', 'branch-jkt-kemang', 'INV-FR-202611-003', 'franchise_fee',
    'PT Nusantara Kuliner Pusat', 'partner', 'partner-mitra-jkt', 'PT Mitra Rasa Jakarta (Budi Santoso)',
    15000000, 1500000, 1485000, 14985000, 0, 1, '2026-11-10', '2026-11-25', 'Menunggu Pembayaran',
    'Biaya Perpanjangan Lisensi Brand & Dukungan Pemasaran Tahunan', 'usr-adminpusat', '2026-11-10T04:00:00.000Z'
  );
  insertItem.run('item-3a', 'inv-3', 'Renewal Fee Brand Kopi Nusantara 2026/2027', 1, 12000000, 12000000);
  insertItem.run('item-3b', 'inv-3', 'Paket Audit Kualitas & Pelatihan Barista', 1, 3000000, 3000000);

  insertInvoice.run(
    'inv-4', tenantId, 'brand-kopi', 'branch-jkt-sudirman', 'INV-SUP-202611-004', 'supplier',
    'PT Roastery Arabika Gayo', 'branch', 'branch-jkt-sudirman', 'Kopi Nusantara Sudirman',
    8400000, 0, 0, 8400000, 8400000, 0, '2026-11-08', '2026-11-15', 'Lunas',
    'Pengadaan 60 kg biji kopi Arabika Gayo Specialty', 'usr-finance', '2026-11-08T05:00:00.000Z'
  );
  insertItem.run('item-4a', 'inv-4', 'Biji Kopi Arabika Gayo Medium Roast (kg)', 60, 140000, 8400000);

  insertInvoice.run(
    'inv-5', tenantId, 'brand-bakmi', 'branch-sby-tunjungan', 'INV-SUP-202611-005', 'supplier',
    'CV Pangan Sejahtera', 'branch', 'branch-sby-tunjungan', 'Bakmi Sentosa Tunjungan',
    6250000, 250000, 0, 6000000, 0, 0, '2026-11-12', '2026-11-14', 'Kedaluwarsa',
    'Pasokan tepung terigu premium dan minyak wijen (sudah melewati jatuh tempo)', 'usr-finance', '2026-11-12T03:00:00.000Z'
  );
  insertItem.run('item-5a', 'inv-5', 'Tepung Protein Tinggi (karung 25kg)', 20, 250000, 5000000);
  insertItem.run('item-5b', 'inv-5', 'Minyak Wijen & Kecap Spesial (jerigen)', 10, 125000, 1250000);

  insertInvoice.run(
    'inv-6', tenantId, 'brand-kopi', 'branch-jkt-sudirman', 'INV-POS-202611-006', 'sales',
    'Kopi Nusantara Sudirman', 'customer', null, 'PT Karya Digital (Catering Meeting)',
    3200000, 200000, 330000, 3330000, 0, 0, '2026-11-16', '2026-11-18', 'Menunggu Verifikasi',
    'Pesanan Coffee Box & Pastry 40 Pax (menunggu verifikasi transfer)', 'usr-kasir-sudirman', '2026-11-16T03:30:00.000Z'
  );
  insertItem.run('item-6a', 'inv-6', 'Kopi Susu Nusantara 1 Liter', 16, 110000, 1760000);
  insertItem.run('item-6b', 'inv-6', 'Croissant Butter Box (isi 10)', 4, 360000, 1440000);

  const insertPayment = db.prepare(`
    INSERT INTO payments (
      id, tenant_id, brand_id, branch_id, invoice_id, partner_id, supplier_id,
      payment_number, payment_type, direction, party_name,
      subtotal, discount, tax, amount, received_amount, change_amount, currency,
      method_id, status, paid_at, expires_at, reference_number, idempotency_key,
      requires_approval, approval_status, created_by, created_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAttachment = db.prepare(`
    INSERT INTO payment_attachments (id, payment_id, file_reference, file_name, file_type, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVerification = db.prepare(`
    INSERT INTO payment_verifications (id, payment_id, reviewer_id, reviewer_name, decision, notes, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Settled POS Cash Payment (Sudirman)
  insertPayment.run(
    'pay-101', tenantId, 'brand-kopi', 'branch-jkt-sudirman', null, null, null,
    'PAY-20261114-0101', 'incoming_pos', 'in', 'Pelanggan Meja 04 (Walk-in)',
    250000, 0, 27500, 277500, 300000, 22500, 'IDR',
    'mtd-cash', 'Lunas', '2026-11-14T04:15:00.000Z', null, 'POS-KN-0101', 'idem-101',
    0, 'not_required', 'usr-kasir-sudirman', '2026-11-14T04:15:00.000Z', '2 Iced Latte, 3 Croissant, 2 Matcha'
  );
  insertLog.run('log-101a', 'pay-101', null, 'Lunas', 'usr-kasir-sudirman', 'Nadia Putri', 'Pembayaran tunai diterima di kasir POS', '2026-11-14T04:15:00.000Z');

  // 2. Settled POS EDC Card Payment (Surabaya)
  insertPayment.run(
    'pay-102', tenantId, 'brand-bakmi', 'branch-sby-tunjungan', null, null, null,
    'PAY-20261114-0102', 'incoming_pos', 'in', 'Rombongan Keluarga Bpk. Hendro',
    480000, 30000, 49500, 499500, 499500, 0, 'IDR',
    'mtd-card', 'Lunas', '2026-11-14T06:20:00.000Z', null, 'EDC-9981203', 'idem-102',
    0, 'not_required', 'usr-owner', '2026-11-14T06:20:00.000Z', 'Pembayaran EDC BCA Debit'
  );
  insertLog.run('log-102a', 'pay-102', null, 'Lunas', 'usr-owner', 'Hendra Wijaya', 'Transaksi EDC disetujui terminal', '2026-11-14T06:20:00.000Z');

  // 3. Settled Franchise Royalty Payment (Kemang Mitra)
  insertPayment.run(
    'pay-103', tenantId, 'brand-kopi', 'branch-jkt-kemang', 'inv-1', 'partner-mitra-jkt', null,
    'PAY-20261109-0103', 'franchise_royalty', 'in', 'PT Mitra Rasa Jakarta (Budi Santoso)',
    9000000, 0, 990000, 9990000, 9990000, 0, 'IDR',
    'mtd-transfer', 'Lunas', '2026-11-09T08:10:00.000Z', null, 'TRF-BCA-771209', 'idem-103',
    0, 'approved', 'usr-mitra-jkt', '2026-11-09T05:00:00.000Z', 'Pelunasan Royalti Oktober 2026'
  );
  insertLog.run('log-103a', 'pay-103', null, 'Menunggu Verifikasi', 'usr-mitra-jkt', 'Budi Santoso', 'Mitra mengunggah bukti transfer BCA', '2026-11-09T05:00:00.000Z');
  insertLog.run('log-103b', 'pay-103', 'Menunggu Verifikasi', 'Lunas', 'usr-finance', 'Kartika Sari', 'Mutasi BCA terkonfirmasi masuk sebesar Rp 9.990.000', '2026-11-09T08:10:00.000Z');
  insertVerification.run('ver-103', 'pay-103', 'usr-finance', 'Kartika Sari', 'approved', 'Sesuai mutasi rekening BCA tanggal 9 Nov', '2026-11-09T08:10:00.000Z');
  insertAttachment.run('att-103', 'pay-103', makeSvgReceipt('Bukti Transfer', 'BCA KlikBCA', 'TRF-BCA-771209', 'Rp 9.990.000', 'PT MITRA RASA JAKARTA', '09 Nov 2026 12:00 WIB'), 'bukti_royalti_okt.svg', 'image/svg+xml', 'usr-mitra-jkt', '2026-11-09T05:00:00.000Z');

  // 4. Settled Supplier Outgoing Payment (Sudirman)
  insertPayment.run(
    'pay-104', tenantId, 'brand-kopi', 'branch-jkt-sudirman', 'inv-4', null, 'sup-roastery',
    'PAY-20261111-0104', 'outgoing_supplier', 'out', 'PT Roastery Arabika Gayo',
    8400000, 0, 0, 8400000, 8400000, 0, 'IDR',
    'mtd-transfer', 'Lunas', '2026-11-11T07:45:00.000Z', null, 'OUT-BCA-55210', 'idem-104',
    1, 'approved', 'usr-adminpusat', '2026-11-11T04:00:00.000Z', 'Pembayaran PO Biji Kopi 60kg'
  );
  insertLog.run('log-104a', 'pay-104', null, 'Menunggu Verifikasi', 'usr-adminpusat', 'Dewi Lestari', 'Pengajuan pembayaran supplier >= Rp 5.000.000 (butuh persetujuan Finance/Owner)', '2026-11-11T04:00:00.000Z');
  insertLog.run('log-104b', 'pay-104', 'Menunggu Verifikasi', 'Lunas', 'usr-finance', 'Kartika Sari', 'Disetujui dan ditransfer ke BCA PT Roastery Arabika Gayo', '2026-11-11T07:45:00.000Z');

  // 5. Partial Franchise Royalty Payment (Bandung Mitra)
  insertPayment.run(
    'pay-105', tenantId, 'brand-bakmi', 'branch-bdg-dago', 'inv-2', 'partner-mitra-bdg', null,
    'PAY-20261112-0105', 'franchise_royalty', 'in', 'CV Kuliner Parahyangan (Siti Rahmawati)',
    4000000, 0, 0, 4000000, 4000000, 0, 'IDR',
    'mtd-transfer', 'Lunas', '2026-11-12T09:00:00.000Z', null, 'TRF-MDR-88412', 'idem-105',
    0, 'approved', 'usr-adminpusat', '2026-11-12T06:00:00.000Z', 'Pembayaran termin 1 tagihan INV-FR-202611-002'
  );
  insertLog.run('log-105a', 'pay-105', null, 'Menunggu Verifikasi', 'usr-adminpusat', 'Dewi Lestari', 'Bukti transfer termin 1 diunggah', '2026-11-12T06:00:00.000Z');
  insertLog.run('log-105b', 'pay-105', 'Menunggu Verifikasi', 'Lunas', 'usr-finance', 'Kartika Sari', 'Dana termin 1 Rp 4.000.000 masuk rekening', '2026-11-12T09:00:00.000Z');

  // 6. Pending Verification #1: Catering Transfer (Sudirman)
  insertPayment.run(
    'pay-106', tenantId, 'brand-kopi', 'branch-jkt-sudirman', 'inv-6', null, null,
    'PAY-20261116-0106', 'incoming_pos', 'in', 'PT Karya Digital (Catering Meeting)',
    3200000, 200000, 330000, 3330000, 3330000, 0, 'IDR',
    'mtd-transfer', 'Menunggu Verifikasi', null, '2026-11-17T03:30:00.000Z', 'TRF-BCA-990441', 'idem-106',
    0, 'pending', 'usr-kasir-sudirman', '2026-11-16T03:35:00.000Z', 'Transfer BCA untuk pesanan 40 pax Coffee Box'
  );
  insertLog.run('log-106a', 'pay-106', null, 'Menunggu Verifikasi', 'usr-kasir-sudirman', 'Nadia Putri', 'Bukti transfer diunggah oleh kasir untuk pemeriksaan admin/finance', '2026-11-16T03:35:00.000Z');
  insertAttachment.run('att-106', 'pay-106', makeSvgReceipt('Bukti Transfer', 'BCA Mobile', 'TRF-BCA-990441', 'Rp 3.330.000', 'PT KARYA DIGITAL', '16 Nov 2026 10:32 WIB'), 'bukti_catering_karyadigital.svg', 'image/svg+xml', 'usr-kasir-sudirman', '2026-11-16T03:35:00.000Z');

  // 7. Pending Verification #2: QRIS Manual POS (Sudirman)
  insertPayment.run(
    'pay-107', tenantId, 'brand-kopi', 'branch-jkt-sudirman', null, null, null,
    'PAY-20261116-0107', 'incoming_pos', 'in', 'Dimas Pratama (Takeaway)',
    185000, 0, 20350, 205350, 205350, 0, 'IDR',
    'mtd-qris', 'Menunggu Verifikasi', null, '2026-11-16T12:00:00.000Z', 'QRIS-44901288', 'idem-107',
    0, 'pending', 'usr-kasir-sudirman', '2026-11-16T05:12:00.000Z', 'Pembayaran QRIS statis pesanan takeaway'
  );
  insertLog.run('log-107a', 'pay-107', null, 'Menunggu Verifikasi', 'usr-kasir-sudirman', 'Nadia Putri', 'Foto struk QRIS pelanggan diunggah', '2026-11-16T05:12:00.000Z');
  insertAttachment.run('att-107', 'pay-107', makeSvgReceipt('Struk QRIS', 'QRIS GoPay', 'QRIS-44901288', 'Rp 205.350', 'DIMAS PRATAMA', '16 Nov 2026 12:10 WIB'), 'bukti_qris_dimas.svg', 'image/svg+xml', 'usr-kasir-sudirman', '2026-11-16T05:12:00.000Z');

  // 8. Pending Verification #3: Outgoing Supplier (Maker-Checker) (Kemang)
  insertPayment.run(
    'pay-108', tenantId, 'brand-kopi', 'branch-jkt-kemang', null, null, 'sup-kemasan',
    'PAY-20261116-0108', 'outgoing_supplier', 'out', 'PT Kemasan Ramah Indonesia',
    7200000, 0, 0, 7200000, 7200000, 0, 'IDR',
    'mtd-transfer', 'Menunggu Verifikasi', null, null, 'REQ-OUT-7200', 'idem-108',
    1, 'pending', 'usr-adminpusat', '2026-11-16T06:00:00.000Z', 'Pengajuan bayar 10.000 cup & lid logo baru (Maker-Checker)'
  );
  insertLog.run('log-108a', 'pay-108', null, 'Menunggu Verifikasi', 'usr-adminpusat', 'Dewi Lestari', 'Membutuhkan persetujuan maker-checker (>= Rp 5.000.000)', '2026-11-16T06:00:00.000Z');
  insertAttachment.run('att-108', 'pay-108', makeSvgReceipt('Faktur Proforma Supplier', 'Bank BNI', 'INV-KRI-1126', 'Rp 7.200.000', 'PT KEMASAN RAMAH INDONESIA', '16 Nov 2026 13:00 WIB'), 'faktur_kemasan.svg', 'image/svg+xml', 'usr-adminpusat', '2026-11-16T06:00:00.000Z');

  // 9. Rejected Payment (Ditolak)
  insertPayment.run(
    'pay-109', tenantId, 'brand-kopi', 'branch-jkt-kemang', 'inv-3', 'partner-mitra-jkt', null,
    'PAY-20261113-0109', 'franchise_fee', 'in', 'PT Mitra Rasa Jakarta (Budi Santoso)',
    14985000, 0, 0, 14985000, 14985000, 0, 'IDR',
    'mtd-transfer', 'Ditolak', null, null, 'TRF-BCA-000192', 'idem-109',
    0, 'rejected', 'usr-mitra-jkt', '2026-11-13T04:00:00.000Z', 'Percobaan pembayaran renewal fee'
  );
  insertLog.run('log-109a', 'pay-109', null, 'Menunggu Verifikasi', 'usr-mitra-jkt', 'Budi Santoso', 'Unggah bukti transfer', '2026-11-13T04:00:00.000Z');
  insertLog.run('log-109b', 'pay-109', 'Menunggu Verifikasi', 'Ditolak', 'usr-finance', 'Kartika Sari', 'Nominal pada bukti transfer hanya Rp 1.498.500 (kurang satu digit nol)', '2026-11-13T06:15:00.000Z');
  insertVerification.run('ver-109', 'pay-109', 'usr-finance', 'Kartika Sari', 'rejected', 'Nominal pada bukti transfer tidak sesuai (hanya Rp 1.498.500)', '2026-11-13T06:15:00.000Z');

  // 10. Settled POS Payment eligible for Refund (Sudirman)
  insertPayment.run(
    'pay-110', tenantId, 'brand-kopi', 'branch-jkt-sudirman', null, null, null,
    'PAY-20261115-0110', 'incoming_pos', 'in', 'Rina Oktaviani (E-Wallet)',
    360000, 0, 39600, 399600, 399600, 0, 'IDR',
    'mtd-ewallet', 'Lunas', '2026-11-15T08:30:00.000Z', null, 'GOPAY-77182910', 'idem-110',
    0, 'not_required', 'usr-kasir-sudirman', '2026-11-15T08:30:00.000Z', 'Pesanan 12 cup kopi susu untuk acara kantor'
  );
  insertLog.run('log-110a', 'pay-110', null, 'Lunas', 'usr-kasir-sudirman', 'Nadia Putri', 'Pembayaran GoPay terkonfirmasi di kasir', '2026-11-15T08:30:00.000Z');

  // 11. Already Refunded (Direfund)
  insertPayment.run(
    'pay-111', tenantId, 'brand-bakmi', 'branch-sby-tunjungan', null, null, null,
    'PAY-20261110-0111', 'incoming_pos', 'in', 'Agus Salim',
    180000, 0, 19800, 199800, 199800, 0, 'IDR',
    'mtd-qris', 'Direfund', '2026-11-10T05:00:00.000Z', null, 'QRIS-1192019', 'idem-111',
    0, 'approved', 'usr-owner', '2026-11-10T05:00:00.000Z', 'Pesanan dibatalkan karena stok menu habis'
  );
  insertLog.run('log-111a', 'pay-111', null, 'Lunas', 'usr-owner', 'Hendra Wijaya', 'Pembayaran QRIS terkonfirmasi', '2026-11-10T05:00:00.000Z');
  insertLog.run('log-111b', 'pay-111', 'Lunas', 'Refund Diproses', 'usr-finance', 'Kartika Sari', 'Pengajuan refund penuh karena bahan habis', '2026-11-10T05:20:00.000Z');
  insertLog.run('log-111c', 'pay-111', 'Refund Diproses', 'Direfund', 'usr-owner', 'Hendra Wijaya', 'Dana dikembalikan ke pelanggan via transfer balik', '2026-11-10T07:00:00.000Z');

  // 12. Failed / Gagal & Expired / Kedaluwarsa for Reports completeness
  insertPayment.run(
    'pay-112', tenantId, 'brand-bakmi', 'branch-sby-tunjungan', null, null, null,
    'PAY-20261115-0112', 'incoming_pos', 'in', 'Meja 11 (EDC Timeout)',
    145000, 0, 15950, 160950, 0, 0, 'IDR',
    'mtd-card', 'Gagal', null, null, 'EDC-FAIL-019', 'idem-112',
    0, 'not_required', 'usr-owner', '2026-11-15T11:00:00.000Z', 'Koneksi terminal EDC terputus saat otorisasi kartu'
  );
  insertLog.run('log-112a', 'pay-112', null, 'Gagal', 'usr-owner', 'Hendra Wijaya', 'Otorisasi kartu gagal (timeout)', '2026-11-15T11:00:00.000Z');

  // Refunds
  const insertRefund = db.prepare(`
    INSERT INTO refunds (id, payment_id, refund_number, amount, reason, status, requested_by, approved_by, processed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRefund.run('ref-1', 'pay-111', 'RFD-20261110-001', 199800, 'Stok menu spesial habis setelah pembayaran QRIS dilakukan', 'Direfund', 'usr-finance', 'usr-owner', '2026-11-10T07:00:00.000Z', '2026-11-10T05:20:00.000Z');
  insertRefund.run('ref-2', 'pay-110', 'RFD-20261116-002', 66600, '2 cup kopi tertumpah saat pengantaran kurir internal', 'Menunggu Persetujuan', 'usr-manager-sudirman', null, null, '2026-11-16T04:00:00.000Z');

  // Reconciliations
  const insertRecon = db.prepare(`
    INSERT INTO reconciliations (id, tenant_id, payment_id, statement_date, provider_name, external_reference, external_amount, match_status, adjustment_notes, reconciled_by, reconciled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRecon.run('rec-1', tenantId, 'pay-103', '2026-11-09', 'Bank BCA Corporate', 'TRF-BCA-771209', 9990000, 'Cocok', 'Cocok otomatis berdasarkan nomor referensi dan nominal', 'usr-finance', '2026-11-10T02:00:00.000Z');
  insertRecon.run('rec-2', tenantId, 'pay-102', '2026-11-14', 'EDC BCA Settlement', 'EDC-9981203', 494505, 'Tidak Cocok', 'Selisih MDR bank Rp 4.995 (1%), menunggu jurnal biaya MDR', 'usr-finance', '2026-11-15T03:00:00.000Z');
  insertRecon.run('rec-3', tenantId, 'pay-105', '2026-11-12', 'Bank Mandiri Giro', 'TRF-MDR-88412', 4000000, 'Cocok', 'Nominal sesuai mutasi masuk', 'usr-finance', '2026-11-13T04:00:00.000Z');
  insertRecon.run('rec-4', tenantId, null, '2026-11-15', 'Bank BCA Corporate', 'CR-BCA-889120', 550000, 'Belum Ditemukan', 'Setoran masuk tidak dikenal di mutasi rekening koran BCA', null, null);

  // Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, tenant_id, user_id, user_name, user_role, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run('aud-1', tenantId, 'usr-finance', 'Kartika Sari', 'Finance', 'VERIFY_APPROVE', 'payment', 'pay-103', 'Menyetujui pembayaran PAY-20261109-0103 sebesar Rp 9.990.000', '2026-11-09T08:10:00.000Z');
  insertAudit.run('aud-2', tenantId, 'usr-finance', 'Kartika Sari', 'Finance', 'VERIFY_REJECT', 'payment', 'pay-109', 'Menolak pembayaran PAY-20261113-0109: Nominal tidak sesuai bukti transfer', '2026-11-13T06:15:00.000Z');
  insertAudit.run('aud-3', tenantId, 'usr-owner', 'Hendra Wijaya', 'Owner', 'REFUND_APPROVE', 'refund', 'ref-1', 'Menyetujui refund penuh RFD-20261110-001 sebesar Rp 199.800', '2026-11-10T07:00:00.000Z');
}
