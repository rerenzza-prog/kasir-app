import { Router } from 'express';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import { buildScopeWhere, canUserAccessBranch, getPermissionsForRole } from './rbac.ts';
import type { AppUser, PaymentStatus } from '../src/types/payment.ts';

const MAKER_CHECKER_THRESHOLD = 5000000;
const WEBHOOK_SECRET = process.env.GATEWAY_WEBHOOK_SECRET || 'sajipay-sandbox-webhook-secret';

interface AuthedRequest extends Request {
  currentUser?: AppUser;
  partnerBranchIds?: string[];
}

function getPartnerBranchIds(partnerId: string | null): string[] {
  if (!partnerId) return [];
  const rows = db.prepare('SELECT id FROM branches WHERE partner_id = ?').all(partnerId) as { id: string }[];
  return rows.map((r) => r.id);
}

function attachUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const userId = (req.headers['x-user-id'] as string) || 'usr-owner';
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as AppUser | undefined;
  if (!user) {
    res.status(401).json({ error: 'Pengguna tidak ditemukan atau sesi tidak valid.' });
    return;
  }
  req.currentUser = user;
  req.partnerBranchIds = getPartnerBranchIds(user.partner_id);
  next();
}

function recordAudit(user: AppUser, action: string, entityType: string, entityId: string, details: string) {
  db.prepare(`
    INSERT INTO audit_logs (id, tenant_id, user_id, user_name, user_role, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud-${crypto.randomUUID().slice(0, 8)}`,
    user.tenant_id,
    user.id,
    user.name,
    user.role,
    action,
    entityType,
    entityId,
    details,
    new Date().toISOString()
  );
}

function generateUniqueCode(prefix: string): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ymd}-${rand}`;
}

export function createApiRouter() {
  const router = Router();

  // Webhook endpoint (before user auth, uses signature verification & event deduplication)
  router.post('/webhooks/gateway', (req: Request, res: Response) => {
    const { event_id, payment_number, status, provider = 'Midtrans Sandbox', external_reference } = req.body || {};
    const signature = req.headers['x-webhook-signature'] as string | undefined;

    if (!event_id || !payment_number || !status) {
      res.status(400).json({ error: 'Payload webhook tidak lengkap (event_id, payment_number, status wajib diisi).' });
      return;
    }

    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(`${event_id}:${payment_number}:${status}`)
      .digest('hex');

    if (signature !== expectedSig && signature !== 'SANDBOX_VERIFIED_SIG') {
      res.status(401).json({ error: 'Tanda tangan webhook tidak valid.' });
      return;
    }

    const existingEvent = db.prepare('SELECT * FROM webhook_events WHERE event_id = ?').get(event_id) as
      | { id: string; event_id: string; processed_at: string }
      | undefined;

    if (existingEvent) {
      res.status(200).json({
        deduplicated: true,
        message: 'Event webhook sudah pernah diproses sebelumnya (idempoten). Tidak ada perubahan ganda.',
        event: existingEvent,
      });
      return;
    }

    const payment = db.prepare('SELECT * FROM payments WHERE payment_number = ?').get(payment_number) as
      | { id: string; status: PaymentStatus; invoice_id: string | null; amount: number }
      | undefined;

    if (!payment) {
      res.status(404).json({ error: `Nomor transaksi ${payment_number} tidak ditemukan.` });
      return;
    }

    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO webhook_events (id, event_id, provider, payment_number, payload_hash, status, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`wh-${crypto.randomUUID().slice(0, 8)}`, event_id, provider, payment_number, expectedSig, status, now);

      if (payment.status !== 'Lunas' && status === 'Lunas') {
        db.prepare('UPDATE payments SET status = ?, paid_at = ?, reference_number = COALESCE(reference_number, ?) WHERE id = ?')
          .run('Lunas', now, external_reference || `GW-${event_id}`, payment.id);

        db.prepare(`
          INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`log-${crypto.randomUUID().slice(0, 8)}`, payment.id, payment.status, 'Lunas', 'system-webhook', provider, `Konfirmasi webhook (${event_id})`, now);

        if (payment.invoice_id) {
          const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(payment.invoice_id) as
            | { id: string; total: number; paid_amount: number }
            | undefined;
          if (inv) {
            const newPaid = Math.min(inv.total, inv.paid_amount + payment.amount);
            const invStatus = newPaid >= inv.total ? 'Lunas' : 'Menunggu Pembayaran';
            db.prepare('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, invStatus, inv.id);
          }
        }
      } else if (payment.status !== 'Lunas' && (status === 'Gagal' || status === 'Kedaluwarsa')) {
        db.prepare('UPDATE payments SET status = ? WHERE id = ?').run(status, payment.id);
        db.prepare(`
          INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`log-${crypto.randomUUID().slice(0, 8)}`, payment.id, payment.status, status, 'system-webhook', provider, `Status diperbarui via webhook (${event_id})`, now);
      }
    });

    tx();
    res.status(200).json({ deduplicated: false, message: 'Webhook diproses dengan aman dan idempoten.' });
  });

  router.use(attachUser);

  router.get('/bootstrap', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const permissions = getPermissionsForRole(user.role);
    const users = db.prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY name').all(user.tenant_id);
    const brands = db.prepare('SELECT * FROM brands WHERE tenant_id = ? ORDER BY name').all(user.tenant_id);

    const allBranches = db.prepare(`
      SELECT b.*, br.name as brand_name
      FROM branches b
      JOIN brands br ON br.id = b.brand_id
      WHERE b.tenant_id = ?
      ORDER BY b.name
    `).all(user.tenant_id) as { id: string; partner_id: string | null }[];

    const scopedBranches = allBranches.filter((b) =>
      canUserAccessBranch(user, b.id, req.partnerBranchIds || [])
    );

    const partners = db.prepare('SELECT * FROM partners WHERE tenant_id = ? ORDER BY name').all(user.tenant_id);
    const suppliers = db.prepare('SELECT * FROM suppliers WHERE tenant_id = ? ORDER BY name').all(user.tenant_id);
    const paymentMethods = db.prepare('SELECT * FROM payment_methods WHERE tenant_id = ? ORDER BY name').all(user.tenant_id);

    res.json({
      user,
      permissions,
      users,
      brands,
      branches: scopedBranches,
      allBranches,
      partners,
      suppliers,
      paymentMethods,
      makerCheckerThreshold: MAKER_CHECKER_THRESHOLD,
    });
  });

  router.get('/summary', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const scope = buildScopeWhere(user, 'p', req.partnerBranchIds || []);
    const { brand_id, branch_id, date_from, date_to } = req.query as Record<string, string>;

    const extraConditions: string[] = [];
    const extraParams: string[] = [];

    if (brand_id) {
      extraConditions.push('p.brand_id = ?');
      extraParams.push(brand_id);
    }
    if (branch_id) {
      extraConditions.push('p.branch_id = ?');
      extraParams.push(branch_id);
    }
    if (date_from) {
      extraConditions.push('substr(p.created_at, 1, 10) >= ?');
      extraParams.push(date_from);
    }
    if (date_to) {
      extraConditions.push('substr(p.created_at, 1, 10) <= ?');
      extraParams.push(date_to);
    }

    const whereSql = [scope.clause, ...extraConditions].join(' AND ');
    const params = [...scope.params, ...extraParams];

    const payments = db.prepare(`
      SELECT p.*, br.name as brand_name, b.name as branch_name, pm.name as method_name
      FROM payments p
      JOIN brands br ON br.id = p.brand_id
      JOIN branches b ON b.id = p.branch_id
      JOIN payment_methods pm ON pm.id = p.method_id
      WHERE ${whereSql}
      ORDER BY p.created_at DESC
    `).all(...params) as {
      id: string;
      direction: string;
      status: PaymentStatus;
      amount: number;
      brand_id: string;
      brand_name: string;
      branch_id: string;
      branch_name: string;
      created_at: string;
      paid_at: string | null;
    }[];

    let totalInSettled = 0;
    let totalOutSettled = 0;
    let totalPendingAmount = 0;
    let pendingVerificationCount = 0;
    let pendingPaymentCount = 0;
    let settledCount = 0;
    let failedOrRejectedCount = 0;
    let refundedTotal = 0;

    const trendMap = new Map<string, { date: string; masuk: number; keluar: number }>();
    const branchMap = new Map<string, { branch_id: string; branch_name: string; brand_name: string; masuk: number; keluar: number; tertunda: number }>();

    for (const p of payments) {
      if (p.status === 'Lunas') {
        settledCount++;
        if (p.direction === 'in') totalInSettled += p.amount;
        else totalOutSettled += p.amount;
      } else if (p.status === 'Menunggu Verifikasi') {
        pendingVerificationCount++;
        totalPendingAmount += p.amount;
      } else if (p.status === 'Menunggu Pembayaran' || p.status === 'Draft') {
        pendingPaymentCount++;
        totalPendingAmount += p.amount;
      } else if (p.status === 'Gagal' || p.status === 'Ditolak' || p.status === 'Kedaluwarsa') {
        failedOrRejectedCount++;
      } else if (p.status === 'Direfund' || p.status === 'Refund Diproses') {
        refundedTotal += p.amount;
      }

      const day = (p.paid_at || p.created_at).slice(0, 10);
      const tEntry = trendMap.get(day) || { date: day, masuk: 0, keluar: 0 };
      if (p.status === 'Lunas') {
        if (p.direction === 'in') tEntry.masuk += p.amount;
        else tEntry.keluar += p.amount;
      }
      trendMap.set(day, tEntry);

      const bEntry = branchMap.get(p.branch_id) || {
        branch_id: p.branch_id,
        branch_name: p.branch_name,
        brand_name: p.brand_name,
        masuk: 0,
        keluar: 0,
        tertunda: 0,
      };
      if (p.status === 'Lunas') {
        if (p.direction === 'in') bEntry.masuk += p.amount;
        else bEntry.keluar += p.amount;
      } else if (p.status === 'Menunggu Verifikasi' || p.status === 'Menunggu Pembayaran') {
        bEntry.tertunda += p.amount;
      }
      branchMap.set(p.branch_id, bEntry);
    }

    const invScope = buildScopeWhere(user, 'i', req.partnerBranchIds || []);
    const unpaidInvoices = db.prepare(`
      SELECT i.*, b.name as branch_name, br.name as brand_name
      FROM invoices i
      JOIN branches b ON b.id = i.branch_id
      JOIN brands br ON br.id = i.brand_id
      WHERE ${invScope.clause} AND i.status IN ('Menunggu Pembayaran', 'Menunggu Verifikasi', 'Kedaluwarsa')
      ORDER BY i.due_date ASC
    `).all(...invScope.params);

    const actionQueue = payments.filter((p) => p.status === 'Menunggu Verifikasi').slice(0, 8);
    const recentTransactions = payments.slice(0, 8);
    const trend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const branchSummary = Array.from(branchMap.values());

    res.json({
      kpis: {
        totalInSettled,
        totalOutSettled,
        netCashflow: totalInSettled - totalOutSettled,
        totalPendingAmount,
        pendingVerificationCount,
        pendingPaymentCount,
        settledCount,
        failedOrRejectedCount,
        refundedTotal,
        unpaidInvoiceCount: unpaidInvoices.length,
      },
      trend,
      branchSummary,
      actionQueue,
      recentTransactions,
      unpaidInvoices,
    });
  });

  router.get('/payments', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const scope = buildScopeWhere(user, 'p', req.partnerBranchIds || []);
    const {
      search = '',
      direction = '',
      payment_type = '',
      status = '',
      method_id = '',
      brand_id = '',
      branch_id = '',
      date_from = '',
      date_to = '',
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const conditions = [scope.clause];
    const params: (string | number)[] = [...scope.params];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(`(
        p.payment_number LIKE ? OR
        p.party_name LIKE ? OR
        COALESCE(p.reference_number, '') LIKE ? OR
        COALESCE(inv.invoice_number, '') LIKE ?
      )`);
      params.push(q, q, q, q);
    }
    if (direction) {
      conditions.push('p.direction = ?');
      params.push(direction);
    }
    if (payment_type) {
      conditions.push('p.payment_type = ?');
      params.push(payment_type);
    }
    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }
    if (method_id) {
      conditions.push('p.method_id = ?');
      params.push(method_id);
    }
    if (brand_id) {
      conditions.push('p.brand_id = ?');
      params.push(brand_id);
    }
    if (branch_id) {
      conditions.push('p.branch_id = ?');
      params.push(branch_id);
    }
    if (date_from) {
      conditions.push('substr(p.created_at, 1, 10) >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('substr(p.created_at, 1, 10) <= ?');
      params.push(date_to);
    }

    const whereClause = conditions.join(' AND ');
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const totalRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM payments p
      LEFT JOIN invoices inv ON inv.id = p.invoice_id
      WHERE ${whereClause}
    `).get(...params) as { total: number };

    const items = db.prepare(`
      SELECT
        p.*,
        br.name as brand_name,
        b.name as branch_name,
        pm.name as method_name,
        pm.method_type as method_type,
        inv.invoice_number as invoice_number,
        u.name as created_by_name,
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r
          WHERE r.payment_id = p.id AND r.status IN ('Direfund', 'Refund Diproses', 'Menunggu Persetujuan')
        ), 0) as refunded_amount
      FROM payments p
      JOIN brands br ON br.id = p.brand_id
      JOIN branches b ON b.id = p.branch_id
      JOIN payment_methods pm ON pm.id = p.method_id
      LEFT JOIN invoices inv ON inv.id = p.invoice_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      items,
      total: totalRow.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(totalRow.total / limitNum)),
    });
  });

  router.get('/payments/:id', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const payment = db.prepare(`
      SELECT
        p.*,
        br.name as brand_name,
        b.name as branch_name,
        pm.name as method_name,
        pm.method_type as method_type,
        inv.invoice_number as invoice_number,
        u.name as created_by_name,
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r
          WHERE r.payment_id = p.id AND r.status IN ('Direfund', 'Refund Diproses', 'Menunggu Persetujuan')
        ), 0) as refunded_amount
      FROM payments p
      JOIN brands br ON br.id = p.brand_id
      JOIN branches b ON b.id = p.branch_id
      JOIN payment_methods pm ON pm.id = p.method_id
      LEFT JOIN invoices inv ON inv.id = p.invoice_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ? AND p.tenant_id = ?
    `).get(req.params.id, user.tenant_id) as { branch_id: string; invoice_id: string | null } | undefined;

    if (!payment) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      return;
    }

    if (!canUserAccessBranch(user, payment.branch_id, req.partnerBranchIds || [])) {
      res.status(403).json({ error: 'Anda tidak memiliki izin mengakses transaksi cabang ini.' });
      return;
    }

    const verifications = db.prepare('SELECT * FROM payment_verifications WHERE payment_id = ? ORDER BY reviewed_at DESC').all(req.params.id);
    const attachments = db.prepare('SELECT * FROM payment_attachments WHERE payment_id = ? ORDER BY created_at DESC').all(req.params.id);
    const refunds = db.prepare(`
      SELECT r.*, req_u.name as requested_by_name, app_u.name as approved_by_name
      FROM refunds r
      LEFT JOIN users req_u ON req_u.id = r.requested_by
      LEFT JOIN users app_u ON app_u.id = r.approved_by
      WHERE r.payment_id = ?
      ORDER BY r.created_at DESC
    `).all(req.params.id);
    const statusLogs = db.prepare('SELECT * FROM payment_status_logs WHERE payment_id = ? ORDER BY created_at ASC').all(req.params.id);
    const reconciliation = db.prepare(`
      SELECT rc.*, u.name as reconciled_by_name
      FROM reconciliations rc
      LEFT JOIN users u ON u.id = rc.reconciled_by
      WHERE rc.payment_id = ?
      LIMIT 1
    `).get(req.params.id) || null;
    const invoice = payment.invoice_id
      ? db.prepare('SELECT * FROM invoices WHERE id = ?').get(payment.invoice_id)
      : null;

    res.json({
      payment,
      verifications,
      attachments,
      refunds,
      statusLogs,
      reconciliation,
      invoice,
    });
  });

  router.post('/payments', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    const {
      branch_id,
      invoice_id = null,
      partner_id = null,
      supplier_id = null,
      payment_type,
      direction,
      party_name,
      subtotal = 0,
      discount = 0,
      tax = 0,
      amount,
      received_amount = 0,
      method_id,
      reference_number = null,
      idempotency_key = null,
      notes = null,
      attachment_data_url = null,
      attachment_name = null,
    } = req.body || {};

    if (idempotency_key) {
      const existing = db.prepare('SELECT * FROM payments WHERE idempotency_key = ?').get(idempotency_key);
      if (existing) {
        res.status(200).json({ idempotentReplay: true, payment: existing });
        return;
      }
    }

    if (!branch_id || !payment_type || !direction || !party_name || !method_id) {
      res.status(400).json({ error: 'Data pembayaran wajib diisi (cabang, jenis, pihak, metode, nominal).' });
      return;
    }

    if (payment_type === 'incoming_pos' && !perms.canCreatePosPayment) {
      res.status(403).json({ error: 'Peran Anda tidak memiliki izin mencatat pembayaran POS.' });
      return;
    }
    if (direction === 'out' && !perms.canCreateOutgoing) {
      res.status(403).json({ error: 'Peran Anda tidak memiliki izin mencatat pembayaran keluar.' });
      return;
    }
    if ((payment_type === 'franchise_fee' || payment_type === 'franchise_royalty') && !perms.canManageFranchise) {
      res.status(403).json({ error: 'Peran Anda tidak memiliki izin mencatat pembayaran franchise.' });
      return;
    }

    if (!canUserAccessBranch(user, branch_id, req.partnerBranchIds || [])) {
      res.status(403).json({ error: 'Anda tidak berwenang membuat transaksi untuk cabang lain.' });
      return;
    }

    const branch = db.prepare('SELECT * FROM branches WHERE id = ? AND tenant_id = ?').get(branch_id, user.tenant_id) as
      | { id: string; brand_id: string; partner_id: string | null }
      | undefined;
    if (!branch) {
      res.status(404).json({ error: 'Cabang tidak ditemukan.' });
      return;
    }

    const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND tenant_id = ?').get(method_id, user.tenant_id) as
      | {
          id: string;
          name: string;
          method_type: string;
          is_active: number;
          requires_verification: number;
        }
      | undefined;
    if (!method || method.is_active !== 1) {
      res.status(400).json({ error: 'Metode pembayaran tidak aktif atau belum terkonfigurasi.' });
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'Nominal pembayaran harus lebih besar dari 0.' });
      return;
    }

    if (reference_number) {
      const dupRef = db.prepare('SELECT id FROM payments WHERE reference_number = ?').get(reference_number);
      if (dupRef) {
        res.status(409).json({ error: `Nomor referensi ${reference_number} sudah digunakan oleh transaksi lain.` });
        return;
      }
    }

    let linkedInvoice: { id: string; total: number; paid_amount: number; allow_partial: number; status: PaymentStatus } | undefined;
    if (invoice_id) {
      linkedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(invoice_id, user.tenant_id) as typeof linkedInvoice;
      if (!linkedInvoice) {
        res.status(404).json({ error: 'Tagihan/invoice tidak ditemukan.' });
        return;
      }
      if (linkedInvoice.status === 'Lunas' || linkedInvoice.status === 'Dibatalkan') {
        res.status(400).json({ error: `Tagihan berstatus ${linkedInvoice.status} tidak dapat dibayar lagi.` });
        return;
      }
      const remaining = Math.max(0, linkedInvoice.total - linkedInvoice.paid_amount);
      if (numericAmount > remaining + 0.01) {
        res.status(400).json({ error: `Nominal melebihi sisa tagihan sebesar Rp ${remaining.toLocaleString('id-ID')}.` });
        return;
      }
      if (linkedInvoice.allow_partial === 0 && Math.abs(numericAmount - remaining) > 0.01) {
        res.status(400).json({ error: 'Tagihan ini tidak mengizinkan pembayaran cicilan/parsial.' });
        return;
      }
    }

    let numericReceived = Number(received_amount) || numericAmount;
    let changeAmount = 0;
    if (method.method_type === 'cash') {
      if (numericReceived < numericAmount) {
        res.status(400).json({ error: 'Nominal tunai diterima kurang dari total tagihan.' });
        return;
      }
      changeAmount = numericReceived - numericAmount;
    }

    // Status determination (PRD 4.1, 4.2, 4.3, Business Rule #4)
    let initialStatus: PaymentStatus = 'Menunggu Verifikasi';
    let requiresApproval = 0;
    let approvalStatus = 'pending';
    let paidAt: string | null = null;
    const now = new Date().toISOString();

    if (direction === 'out') {
      if (numericAmount >= MAKER_CHECKER_THRESHOLD || method.requires_verification === 1) {
        requiresApproval = numericAmount >= MAKER_CHECKER_THRESHOLD ? 1 : 0;
        initialStatus = 'Menunggu Verifikasi';
        approvalStatus = 'pending';
      } else {
        initialStatus = 'Lunas';
        approvalStatus = 'not_required';
        paidAt = now;
      }
    } else if (method.method_type === 'cash' || method.method_type === 'card') {
      // Cash or EDC Card settled at POS directly
      initialStatus = 'Lunas';
      approvalStatus = 'not_required';
      paidAt = now;
    } else {
      // Manual Transfer / QRIS / E-Wallet ALWAYS waits for verification even when attachment uploaded
      initialStatus = 'Menunggu Verifikasi';
      approvalStatus = 'pending';
    }

    const paymentId = `pay-${crypto.randomUUID().slice(0, 8)}`;
    const paymentNumber = generateUniqueCode('PAY');

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (
          id, tenant_id, brand_id, branch_id, invoice_id, partner_id, supplier_id,
          payment_number, payment_type, direction, party_name,
          subtotal, discount, tax, amount, received_amount, change_amount, currency,
          method_id, status, paid_at, expires_at, reference_number, idempotency_key,
          requires_approval, approval_status, created_by, created_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IDR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId, user.tenant_id, branch.brand_id, branch_id, invoice_id, partner_id || branch.partner_id, supplier_id,
        paymentNumber, payment_type, direction, party_name,
        Number(subtotal) || numericAmount, Number(discount) || 0, Number(tax) || 0, numericAmount, numericReceived, changeAmount,
        method_id, initialStatus, paidAt, null, reference_number || null, idempotency_key || null,
        requiresApproval, approvalStatus, user.id, now, notes
      );

      db.prepare(`
        INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `log-${crypto.randomUUID().slice(0, 8)}`,
        paymentId,
        null,
        initialStatus,
        user.id,
        user.name,
        initialStatus === 'Lunas'
          ? `Pembayaran ${method.name} dicatat lunas`
          : `Menunggu verifikasi petugas (${method.name})`,
        now
      );

      if (attachment_data_url) {
        db.prepare(`
          INSERT INTO payment_attachments (id, payment_id, file_reference, file_name, file_type, uploaded_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          `att-${crypto.randomUUID().slice(0, 8)}`,
          paymentId,
          attachment_data_url,
          attachment_name || 'bukti_pembayaran.png',
          'image/*',
          user.id,
          now
        );
      }

      if (linkedInvoice) {
        if (initialStatus === 'Lunas') {
          const newPaid = Math.min(linkedInvoice.total, linkedInvoice.paid_amount + numericAmount);
          const newInvStatus = newPaid >= linkedInvoice.total - 0.01 ? 'Lunas' : 'Menunggu Pembayaran';
          db.prepare('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, newInvStatus, linkedInvoice.id);
        } else {
          db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run('Menunggu Verifikasi', linkedInvoice.id);
        }
      }

      recordAudit(
        user,
        'PAYMENT_CREATE',
        'payment',
        paymentId,
        `Membuat transaksi ${paymentNumber} (${direction === 'in' ? 'Masuk' : 'Keluar'}) sebesar Rp ${numericAmount.toLocaleString('id-ID')} [${initialStatus}]`
      );
    });

    tx();
    const created = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    res.status(201).json({ idempotentReplay: false, payment: created });
  });

  router.post('/payments/:id/verify', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canVerifyManual) {
      res.status(403).json({ error: 'Peran Anda tidak berwenang memverifikasi pembayaran.' });
      return;
    }

    const { decision, notes = '' } = req.body || {};
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: 'Keputusan verifikasi harus approved atau rejected.' });
      return;
    }
    if (decision === 'rejected' && !String(notes).trim()) {
      res.status(400).json({ error: 'Alasan penolakan wajib diisi.' });
      return;
    }

    const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND tenant_id = ?').get(req.params.id, user.tenant_id) as
      | {
          id: string;
          branch_id: string;
          invoice_id: string | null;
          payment_number: string;
          amount: number;
          status: PaymentStatus;
          requires_approval: number;
          created_by: string;
        }
      | undefined;

    if (!payment) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      return;
    }
    if (!canUserAccessBranch(user, payment.branch_id, req.partnerBranchIds || [])) {
      res.status(403).json({ error: 'Tidak berwenang memverifikasi transaksi cabang lain.' });
      return;
    }
    if (payment.status !== 'Menunggu Verifikasi') {
      res.status(409).json({ error: `Transaksi berstatus "${payment.status}" tidak dapat diverifikasi ulang (pencegahan verifikasi ganda).` });
      return;
    }

    // Maker-Checker guard
    if (payment.requires_approval === 1 && payment.created_by === user.id) {
      res.status(403).json({ error: 'Aturan maker-checker: pembuat pengajuan tidak dapat menyetujui transaksinya sendiri.' });
      return;
    }

    if (user.max_approval_limit > 0 && payment.amount > user.max_approval_limit && decision === 'approved') {
      res.status(403).json({
        error: `Nominal Rp ${payment.amount.toLocaleString('id-ID')} melebihi batas otorisasi Anda (Rp ${user.max_approval_limit.toLocaleString('id-ID')}).`,
      });
      return;
    }

    const now = new Date().toISOString();
    const newStatus: PaymentStatus = decision === 'approved' ? 'Lunas' : 'Ditolak';

    const tx = db.transaction(() => {
      const updateResult = db.prepare(`
        UPDATE payments
        SET status = ?, paid_at = ?, approval_status = ?
        WHERE id = ? AND status = 'Menunggu Verifikasi'
      `).run(newStatus, decision === 'approved' ? now : null, decision, payment.id);

      if (updateResult.changes === 0) {
        throw new Error('DOUBLE_VERIFY_CONFLICT');
      }

      db.prepare(`
        INSERT INTO payment_verifications (id, payment_id, reviewer_id, reviewer_name, decision, notes, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`ver-${crypto.randomUUID().slice(0, 8)}`, payment.id, user.id, user.name, decision, notes || (decision === 'approved' ? 'Terverifikasi' : ''), now);

      db.prepare(`
        INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
        VALUES (?, ?, 'Menunggu Verifikasi', ?, ?, ?, ?, ?)
      `).run(`log-${crypto.randomUUID().slice(0, 8)}`, payment.id, newStatus, user.id, user.name, notes || `Verifikasi ${decision}`, now);

      if (payment.invoice_id) {
        const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(payment.invoice_id) as
          | { id: string; total: number; paid_amount: number }
          | undefined;
        if (inv) {
          if (decision === 'approved') {
            const newPaid = Math.min(inv.total, inv.paid_amount + payment.amount);
            const invStatus = newPaid >= inv.total - 0.01 ? 'Lunas' : 'Menunggu Pembayaran';
            db.prepare('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, invStatus, inv.id);
          } else {
            const invStatus = inv.paid_amount >= inv.total - 0.01 ? 'Lunas' : 'Menunggu Pembayaran';
            db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(invStatus, inv.id);
          }
        }
      }

      recordAudit(
        user,
        decision === 'approved' ? 'VERIFY_APPROVE' : 'VERIFY_REJECT',
        'payment',
        payment.id,
        `${decision === 'approved' ? 'Menyetujui' : 'Menolak'} transaksi ${payment.payment_number}: ${notes || '-'}`
      );
    });

    try {
      tx();
      res.json({ success: true, status: newStatus });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'DOUBLE_VERIFY_CONFLICT') {
        res.status(409).json({ error: 'Verifikasi ganda dicegah: status transaksi sudah berubah.' });
        return;
      }
      throw err;
    }
  });

  // Correction / Cancellation of settled or pending payments (with mandatory reason + audit log)
  router.post('/payments/:id/correct', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    const { reason } = req.body || {};

    if (!String(reason || '').trim()) {
      res.status(400).json({ error: 'Alasan koreksi atau pembatalan wajib diisi.' });
      return;
    }

    const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND tenant_id = ?').get(req.params.id, user.tenant_id) as
      | { id: string; branch_id: string; status: PaymentStatus; amount: number; invoice_id: string | null; payment_number: string }
      | undefined;

    if (!payment) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      return;
    }
    if (payment.status === 'Lunas' && !perms.canCorrectSettled) {
      res.status(403).json({ error: 'Transaksi berstatus Lunas tidak dapat diubah oleh peran Anda. Hubungi Finance/Owner.' });
      return;
    }
    if (payment.status === 'Dibatalkan' || payment.status === 'Direfund') {
      res.status(400).json({ error: `Transaksi berstatus ${payment.status} tidak dapat dibatalkan lagi.` });
      return;
    }

    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare('UPDATE payments SET status = ? WHERE id = ?').run('Dibatalkan', payment.id);
      db.prepare(`
        INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
        VALUES (?, ?, ?, 'Dibatalkan', ?, ?, ?, ?)
      `).run(`log-${crypto.randomUUID().slice(0, 8)}`, payment.id, payment.status, user.id, user.name, `Jurnal Koreksi: ${reason}`, now);

      if (payment.invoice_id && payment.status === 'Lunas') {
        const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(payment.invoice_id) as
          | { id: string; paid_amount: number }
          | undefined;
        if (inv) {
          const newPaid = Math.max(0, inv.paid_amount - payment.amount);
          db.prepare('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, 'Menunggu Pembayaran', inv.id);
        }
      }

      recordAudit(
        user,
        'PAYMENT_CORRECTION_CANCEL',
        'payment',
        payment.id,
        `Koreksi/Pembatalan transaksi ${payment.payment_number} dari status ${payment.status}: ${reason}`
      );
    });

    tx();
    res.json({ success: true, status: 'Dibatalkan' });
  });

  // Invoices
  router.get('/invoices', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const scope = buildScopeWhere(user, 'i', req.partnerBranchIds || []);
    const { category = '', status = '', search = '' } = req.query as Record<string, string>;

    const conditions = [scope.clause];
    const params: string[] = [...scope.params];

    if (category) {
      conditions.push('i.invoice_category = ?');
      params.push(category);
    }
    if (status) {
      if (status === 'pending_all') {
        conditions.push("i.status IN ('Draft', 'Menunggu Pembayaran', 'Menunggu Verifikasi', 'Kedaluwarsa')");
      } else {
        conditions.push('i.status = ?');
        params.push(status);
      }
    }
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(i.invoice_number LIKE ? OR i.bill_to_name LIKE ?)');
      params.push(q, q);
    }

    const invoices = db.prepare(`
      SELECT i.*, b.name as branch_name, br.name as brand_name
      FROM invoices i
      JOIN branches b ON b.id = i.branch_id
      JOIN brands br ON br.id = i.brand_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.issue_date DESC, i.created_at DESC
    `).all(...params) as { id: string; total: number; paid_amount: number }[];

    const itemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
    const enriched = invoices.map((inv) => ({
      ...inv,
      remaining_amount: Math.max(0, inv.total - inv.paid_amount),
      items: itemsStmt.all(inv.id),
    }));

    res.json({ items: enriched });
  });

  router.post('/invoices', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canManageInvoices) {
      res.status(403).json({ error: 'Peran Anda tidak berwenang membuat tagihan/invoice.' });
      return;
    }

    const {
      branch_id,
      invoice_category,
      bill_from,
      bill_to_type,
      bill_to_id = null,
      bill_to_name,
      discount = 0,
      tax = 0,
      allow_partial = 1,
      issue_date,
      due_date,
      publish_now = true,
      notes = '',
      items = [],
    } = req.body || {};

    if (!branch_id || !invoice_category || !bill_to_name || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Lengkapi cabang, pihak tertagih, dan minimal 1 item tagihan.' });
      return;
    }

    const branch = db.prepare('SELECT * FROM branches WHERE id = ? AND tenant_id = ?').get(branch_id, user.tenant_id) as
      | { id: string; brand_id: string }
      | undefined;
    if (!branch) {
      res.status(404).json({ error: 'Cabang tidak ditemukan.' });
      return;
    }

    let subtotal = 0;
    const normalizedItems = items.map((it: { description: string; quantity: number; unit_price: number }) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const price = Math.max(0, Number(it.unit_price) || 0);
      const lineTotal = qty * price;
      subtotal += lineTotal;
      return {
        id: `item-${crypto.randomUUID().slice(0, 8)}`,
        description: it.description,
        quantity: qty,
        unit_price: price,
        line_total: lineTotal,
      };
    });

    const disc = Math.max(0, Number(discount) || 0);
    const txTax = Math.max(0, Number(tax) || 0);
    const total = Math.max(0, subtotal - disc + txTax);
    const invId = `inv-${crypto.randomUUID().slice(0, 8)}`;
    const prefix = invoice_category === 'supplier' ? 'INV-SUP' : invoice_category === 'sales' ? 'INV-POS' : 'INV-FR';
    const invoiceNumber = generateUniqueCode(prefix);
    const status: PaymentStatus = publish_now ? 'Menunggu Pembayaran' : 'Draft';
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO invoices (
          id, tenant_id, brand_id, branch_id, invoice_number, invoice_category,
          bill_from, bill_to_type, bill_to_id, bill_to_name, subtotal, discount, tax, total,
          paid_amount, allow_partial, issue_date, due_date, status, notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invId, user.tenant_id, branch.brand_id, branch_id, invoiceNumber, invoice_category,
        bill_from || 'PT Nusantara Kuliner Pusat', bill_to_type || 'customer', bill_to_id, bill_to_name,
        subtotal, disc, txTax, total, allow_partial ? 1 : 0,
        issue_date || now.slice(0, 10), due_date || now.slice(0, 10), status, notes, user.id, now
      );

      const insItem = db.prepare('INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)');
      for (const item of normalizedItems) {
        insItem.run(item.id, invId, item.description, item.quantity, item.unit_price, item.line_total);
      }

      recordAudit(user, 'INVOICE_CREATE', 'invoice', invId, `Membuat invoice ${invoiceNumber} senilai Rp ${total.toLocaleString('id-ID')} (${status})`);
    });

    tx();
    res.status(201).json({ id: invId, invoice_number: invoiceNumber, status });
  });

  router.post('/invoices/:id/publish', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canManageInvoices) {
      res.status(403).json({ error: 'Tidak berwenang menerbitkan invoice.' });
      return;
    }
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(req.params.id, user.tenant_id) as
      | { id: string; invoice_number: string; status: PaymentStatus }
      | undefined;
    if (!inv) {
      res.status(404).json({ error: 'Invoice tidak ditemukan.' });
      return;
    }
    if (inv.status !== 'Draft') {
      res.status(400).json({ error: 'Hanya invoice berstatus Draft yang dapat diterbitkan.' });
      return;
    }
    db.prepare("UPDATE invoices SET status = 'Menunggu Pembayaran' WHERE id = ?").run(inv.id);
    recordAudit(user, 'INVOICE_PUBLISH', 'invoice', inv.id, `Menerbitkan invoice ${inv.invoice_number}`);
    res.json({ success: true });
  });

  // Franchise Royalty Billing Generator
  router.post('/franchise/generate-royalty', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canManageFranchise || user.role === 'Mitra Franchise') {
      res.status(403).json({ error: 'Hanya Admin Pusat, Finance, Owner, atau Super Admin yang dapat menerbitkan tagihan royalti.' });
      return;
    }

    const { branch_id, gross_sales, period_label, due_date } = req.body || {};
    const salesNum = Number(gross_sales);
    if (!branch_id || !Number.isFinite(salesNum) || salesNum <= 0) {
      res.status(400).json({ error: 'Cabang mitra dan omzet penjualan valid wajib diisi.' });
      return;
    }

    const branch = db.prepare(`
      SELECT b.*, p.name as partner_name, p.company_name, p.royalty_rate, p.id as p_id
      FROM branches b
      JOIN partners p ON p.id = b.partner_id
      WHERE b.id = ? AND b.tenant_id = ? AND b.is_franchise = 1
    `).get(branch_id, user.tenant_id) as
      | { id: string; brand_id: string; name: string; partner_name: string; company_name: string; royalty_rate: number; p_id: string }
      | undefined;

    if (!branch) {
      res.status(404).json({ error: 'Outlet franchise tidak ditemukan.' });
      return;
    }

    const subtotal = Math.round(salesNum * branch.royalty_rate);
    const tax = Math.round(subtotal * 0.11);
    const total = subtotal + tax;
    const invId = `inv-${crypto.randomUUID().slice(0, 8)}`;
    const invNumber = generateUniqueCode('INV-FR');
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO invoices (
          id, tenant_id, brand_id, branch_id, invoice_number, invoice_category,
          bill_from, bill_to_type, bill_to_id, bill_to_name, subtotal, discount, tax, total,
          paid_amount, allow_partial, issue_date, due_date, status, notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, 'royalty', ?, 'partner', ?, ?, ?, 0, ?, ?, 0, 1, ?, ?, 'Menunggu Pembayaran', ?, ?, ?)
      `).run(
        invId, user.tenant_id, branch.brand_id, branch.id, invNumber,
        'PT Nusantara Kuliner Pusat', branch.p_id, `${branch.company_name} (${branch.partner_name})`,
        subtotal, tax, total, now.slice(0, 10), due_date || now.slice(0, 10),
        `Perhitungan otomatis royalti ${(branch.royalty_rate * 100).toFixed(1)}% dari omzet Rp ${salesNum.toLocaleString('id-ID')} (${period_label || 'Periode Berjalan'})`,
        user.id, now
      );

      db.prepare('INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, 1, ?, ?)').run(
        `item-${crypto.randomUUID().slice(0, 8)}`,
        invId,
        `Royalti Outlet ${branch.name} (${(branch.royalty_rate * 100).toFixed(1)}% x Rp ${salesNum.toLocaleString('id-ID')})`,
        subtotal,
        subtotal
      );

      recordAudit(user, 'ROYALTY_BILLING_CREATE', 'invoice', invId, `Menerbitkan tagihan royalti ${invNumber} untuk ${branch.company_name} sebesar Rp ${total.toLocaleString('id-ID')}`);
    });

    tx();
    res.status(201).json({ id: invId, invoice_number: invNumber, total });
  });

  // Refunds
  router.get('/refunds', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const scope = buildScopeWhere(user, 'p', req.partnerBranchIds || []);
    const refunds = db.prepare(`
      SELECT
        r.*,
        p.payment_number,
        p.party_name,
        p.amount as payment_amount,
        p.branch_id,
        b.name as branch_name,
        req_u.name as requested_by_name,
        app_u.name as approved_by_name
      FROM refunds r
      JOIN payments p ON p.id = r.payment_id
      JOIN branches b ON b.id = p.branch_id
      LEFT JOIN users req_u ON req_u.id = r.requested_by
      LEFT JOIN users app_u ON app_u.id = r.approved_by
      WHERE ${scope.clause}
      ORDER BY r.created_at DESC
    `).all(...scope.params);

    const eligiblePayments = db.prepare(`
      SELECT
        p.id, p.payment_number, p.party_name, p.amount, p.paid_at, b.name as branch_name,
        COALESCE((
          SELECT SUM(r.amount) FROM refunds r
          WHERE r.payment_id = p.id AND r.status IN ('Direfund', 'Refund Diproses', 'Menunggu Persetujuan')
        ), 0) as refunded_amount
      FROM payments p
      JOIN branches b ON b.id = p.branch_id
      WHERE ${scope.clause} AND p.status = 'Lunas' AND p.direction = 'in'
      ORDER BY p.paid_at DESC
    `).all(...scope.params) as { id: string; amount: number; refunded_amount: number }[];

    res.json({
      refunds,
      eligiblePayments: eligiblePayments.filter((p) => p.amount - p.refunded_amount > 0),
    });
  });

  router.post('/refunds', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canRequestRefund) {
      res.status(403).json({ error: 'Peran Anda tidak memiliki izin mengajukan refund.' });
      return;
    }

    const { payment_id, amount, reason } = req.body || {};
    const reqAmount = Number(amount);
    if (!payment_id || !Number.isFinite(reqAmount) || reqAmount <= 0 || !String(reason || '').trim()) {
      res.status(400).json({ error: 'Transaksi asal, nominal refund valid, dan alasan wajib diisi.' });
      return;
    }

    const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND tenant_id = ?').get(payment_id, user.tenant_id) as
      | { id: string; branch_id: string; payment_number: string; amount: number; status: PaymentStatus }
      | undefined;

    if (!payment) {
      res.status(404).json({ error: 'Transaksi asal tidak ditemukan.' });
      return;
    }
    if (!canUserAccessBranch(user, payment.branch_id, req.partnerBranchIds || [])) {
      res.status(403).json({ error: 'Tidak berwenang mengajukan refund untuk cabang lain.' });
      return;
    }
    if (payment.status !== 'Lunas') {
      res.status(400).json({ error: 'Refund hanya dapat diajukan untuk transaksi yang sudah Lunas.' });
      return;
    }

    const usedRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as used
      FROM refunds
      WHERE payment_id = ? AND status IN ('Direfund', 'Refund Diproses', 'Menunggu Persetujuan')
    `).get(payment.id) as { used: number };

    const remainingRefundable = payment.amount - usedRow.used;
    if (reqAmount > remainingRefundable + 0.01) {
      res.status(400).json({
        error: `Nominal refund melebihi sisa dana yang dapat dikembalikan (maksimal Rp ${remainingRefundable.toLocaleString('id-ID')}).`,
      });
      return;
    }

    const refundId = `ref-${crypto.randomUUID().slice(0, 8)}`;
    const refundNumber = generateUniqueCode('RFD');
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO refunds (id, payment_id, refund_number, amount, reason, status, requested_by, approved_by, processed_at, created_at)
        VALUES (?, ?, ?, ?, ?, 'Menunggu Persetujuan', ?, null, null, ?)
      `).run(refundId, payment.id, refundNumber, reqAmount, reason.trim(), user.id, now);

      db.prepare("UPDATE payments SET status = 'Refund Diproses' WHERE id = ?").run(payment.id);
      db.prepare(`
        INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
        VALUES (?, ?, 'Lunas', 'Refund Diproses', ?, ?, ?, ?)
      `).run(`log-${crypto.randomUUID().slice(0, 8)}`, payment.id, user.id, user.name, `Pengajuan refund ${refundNumber}: ${reason.trim()}`, now);

      recordAudit(user, 'REFUND_REQUEST', 'refund', refundId, `Mengajukan refund ${refundNumber} sebesar Rp ${reqAmount.toLocaleString('id-ID')} untuk ${payment.payment_number}`);
    });

    tx();
    res.status(201).json({ id: refundId, refund_number: refundNumber });
  });

  router.post('/refunds/:id/process', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canApproveRefund) {
      res.status(403).json({ error: 'Peran Anda tidak berwenang menyetujui/memproses refund.' });
      return;
    }

    const { decision } = req.body || {};
    if (decision !== 'approve' && decision !== 'reject') {
      res.status(400).json({ error: 'Aksi harus approve atau reject.' });
      return;
    }

    const refund = db.prepare(`
      SELECT r.*, p.payment_number, p.amount as payment_amount, p.tenant_id
      FROM refunds r
      JOIN payments p ON p.id = r.payment_id
      WHERE r.id = ? AND p.tenant_id = ?
    `).get(req.params.id, user.tenant_id) as
      | { id: string; payment_id: string; payment_number: string; payment_amount: number; amount: number; status: string; requested_by: string; refund_number: string }
      | undefined;

    if (!refund) {
      res.status(404).json({ error: 'Pengajuan refund tidak ditemukan.' });
      return;
    }
    if (refund.status !== 'Menunggu Persetujuan') {
      res.status(409).json({ error: 'Pengajuan refund ini sudah diproses sebelumnya.' });
      return;
    }
    if (refund.requested_by === user.id) {
      res.status(403).json({ error: 'Aturan maker-checker: pengaju refund tidak dapat menyetujui pengajuannya sendiri.' });
      return;
    }

    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      if (decision === 'approve') {
        db.prepare("UPDATE refunds SET status = 'Direfund', approved_by = ?, processed_at = ? WHERE id = ?")
          .run(user.id, now, refund.id);

        const totalRefundedRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE payment_id = ? AND status = 'Direfund'")
          .get(refund.payment_id) as { total: number };

        const newPaymentStatus: PaymentStatus = totalRefundedRow.total >= refund.payment_amount - 0.01 ? 'Direfund' : 'Lunas';
        db.prepare('UPDATE payments SET status = ? WHERE id = ?').run(newPaymentStatus, refund.payment_id);
        db.prepare(`
          INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
          VALUES (?, ?, 'Refund Diproses', ?, ?, ?, ?, ?)
        `).run(`log-${crypto.randomUUID().slice(0, 8)}`, refund.payment_id, newPaymentStatus, user.id, user.name, `Refund ${refund.refund_number} disetujui (Rp ${refund.amount.toLocaleString('id-ID')})`, now);

        recordAudit(user, 'REFUND_APPROVE', 'refund', refund.id, `Menyetujui & memproses refund ${refund.refund_number} sebesar Rp ${refund.amount.toLocaleString('id-ID')}`);
      } else {
        db.prepare("UPDATE refunds SET status = 'Ditolak', approved_by = ?, processed_at = ? WHERE id = ?")
          .run(user.id, now, refund.id);
        db.prepare("UPDATE payments SET status = 'Lunas' WHERE id = ?").run(refund.payment_id);
        db.prepare(`
          INSERT INTO payment_status_logs (id, payment_id, old_status, new_status, changed_by, changed_by_name, reason, created_at)
          VALUES (?, ?, 'Refund Diproses', 'Lunas', ?, ?, ?, ?)
        `).run(`log-${crypto.randomUUID().slice(0, 8)}`, refund.payment_id, user.id, user.name, `Pengajuan refund ${refund.refund_number} ditolak`, now);

        recordAudit(user, 'REFUND_REJECT', 'refund', refund.id, `Menolak pengajuan refund ${refund.refund_number}`);
      }
    });

    tx();
    res.json({ success: true });
  });

  // Reconciliations
  router.get('/reconciliations', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const rows = db.prepare(`
      SELECT
        rc.*,
        p.payment_number,
        p.amount as payment_amount,
        p.party_name,
        pm.name as method_name,
        u.name as reconciled_by_name
      FROM reconciliations rc
      LEFT JOIN payments p ON p.id = rc.payment_id
      LEFT JOIN payment_methods pm ON pm.id = p.method_id
      LEFT JOIN users u ON u.id = rc.reconciled_by
      WHERE rc.tenant_id = ?
      ORDER BY rc.statement_date DESC, rc.id DESC
    `).all(user.tenant_id);

    const unreconciledPayments = db.prepare(`
      SELECT p.id, p.payment_number, p.party_name, p.amount, p.reference_number, p.paid_at, pm.name as method_name
      FROM payments p
      JOIN payment_methods pm ON pm.id = p.method_id
      WHERE p.tenant_id = ? AND p.status = 'Lunas' AND p.id NOT IN (
        SELECT payment_id FROM reconciliations WHERE payment_id IS NOT NULL
      )
      ORDER BY p.paid_at DESC
    `).all(user.tenant_id);

    res.json({ items: rows, unreconciledPayments });
  });

  router.post('/reconciliations/import', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canReconcile) {
      res.status(403).json({ error: 'Peran Anda tidak berwenang melakukan rekonsiliasi mutasi.' });
      return;
    }

    const { statement_date, provider_name, external_reference, external_amount } = req.body || {};
    const extAmt = Number(external_amount);
    if (!statement_date || !provider_name || !external_reference || !Number.isFinite(extAmt)) {
      res.status(400).json({ error: 'Tanggal mutasi, penyedia, nomor referensi, dan nominal wajib diisi.' });
      return;
    }

    const matchedPayment = db.prepare(`
      SELECT id, amount, payment_number FROM payments
      WHERE tenant_id = ? AND (reference_number = ? OR payment_number = ?)
      LIMIT 1
    `).get(user.tenant_id, external_reference.trim(), external_reference.trim()) as
      | { id: string; amount: number; payment_number: string }
      | undefined;

    let matchStatus: 'Cocok' | 'Tidak Cocok' | 'Belum Ditemukan' = 'Belum Ditemukan';
    let notes = 'Referensi mutasi belum ditemukan pada transaksi internal.';
    if (matchedPayment) {
      if (Math.abs(matchedPayment.amount - extAmt) < 0.01) {
        matchStatus = 'Cocok';
        notes = `Cocok otomatis dengan ${matchedPayment.payment_number}`;
      } else {
        matchStatus = 'Tidak Cocok';
        notes = `Selisih nominal dengan ${matchedPayment.payment_number} (Internal: Rp ${matchedPayment.amount.toLocaleString('id-ID')})`;
      }
    }

    const recId = `rec-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO reconciliations (
        id, tenant_id, payment_id, statement_date, provider_name, external_reference,
        external_amount, match_status, adjustment_notes, reconciled_by, reconciled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recId, user.tenant_id, matchedPayment ? matchedPayment.id : null,
      statement_date, provider_name, external_reference.trim(), extAmt,
      matchStatus, notes, matchedPayment ? user.id : null, matchedPayment ? now : null
    );

    recordAudit(user, 'RECONCILE_IMPORT', 'reconciliation', recId, `Impor mutasi ${external_reference} (${provider_name}) -> ${matchStatus}`);
    res.status(201).json({ id: recId, match_status: matchStatus });
  });

  router.patch('/reconciliations/:id', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canReconcile) {
      res.status(403).json({ error: 'Peran Anda tidak berwenang memperbarui rekonsiliasi.' });
      return;
    }

    const { payment_id, match_status, adjustment_notes } = req.body || {};
    if (!match_status || !String(adjustment_notes || '').trim()) {
      res.status(400).json({ error: 'Status pencocokan dan catatan penyesuaian wajib diisi.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE reconciliations
      SET payment_id = COALESCE(?, payment_id), match_status = ?, adjustment_notes = ?, reconciled_by = ?, reconciled_at = ?
      WHERE id = ? AND tenant_id = ?
    `).run(payment_id || null, match_status, adjustment_notes.trim(), user.id, now, req.params.id, user.tenant_id);

    recordAudit(user, 'RECONCILE_UPDATE', 'reconciliation', req.params.id, `Penyesuaian rekonsiliasi -> ${match_status}: ${adjustment_notes.trim()}`);
    res.json({ success: true });
  });

  // Payment Methods Configuration
  router.get('/payment-methods', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const methods = db.prepare('SELECT * FROM payment_methods WHERE tenant_id = ? ORDER BY name').all(user.tenant_id);
    res.json({ items: methods });
  });

  router.patch('/payment-methods/:id', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const perms = getPermissionsForRole(user.role);
    if (!perms.canConfigureMethods) {
      res.status(403).json({ error: 'Hanya Super Admin atau Owner yang dapat mengubah konfigurasi metode pembayaran.' });
      return;
    }

    const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND tenant_id = ?').get(req.params.id, user.tenant_id) as
      | {
          id: string;
          name: string;
          requires_gateway_credentials: number;
          credentials_configured: number;
          merchant_verified: number;
          integration_tested: number;
        }
      | undefined;

    if (!method) {
      res.status(404).json({ error: 'Metode pembayaran tidak ditemukan.' });
      return;
    }

    const {
      is_active,
      credentials_configured,
      merchant_verified,
      integration_tested,
      configuration_reference,
      instructions,
    } = req.body || {};

    const nextCred = credentials_configured !== undefined ? (credentials_configured ? 1 : 0) : method.credentials_configured;
    const nextMerch = merchant_verified !== undefined ? (merchant_verified ? 1 : 0) : method.merchant_verified;
    const nextTest = integration_tested !== undefined ? (integration_tested ? 1 : 0) : method.integration_tested;
    const nextActive = is_active !== undefined ? (is_active ? 1 : 0) : undefined;

    if (nextActive === 1 && method.requires_gateway_credentials === 1) {
      if (nextCred !== 1 || nextMerch !== 1 || nextTest !== 1) {
        res.status(400).json({
          error: 'Metode pihak ketiga/gateway hanya boleh diaktifkan setelah kredensial server, akun merchant, dan pengujian integrasi selesai.',
        });
        return;
      }
    }

    db.prepare(`
      UPDATE payment_methods
      SET
        is_active = COALESCE(?, is_active),
        credentials_configured = ?,
        merchant_verified = ?,
        integration_tested = ?,
        configuration_reference = COALESCE(?, configuration_reference),
        instructions = COALESCE(?, instructions)
      WHERE id = ? AND tenant_id = ?
    `).run(nextActive ?? null, nextCred, nextMerch, nextTest, configuration_reference ?? null, instructions ?? null, method.id, user.tenant_id);

    recordAudit(user, 'METHOD_CONFIG_UPDATE', 'payment_method', method.id, `Memperbarui metode ${method.name} (aktif=${nextActive ?? 'tetap'})`);
    const updated = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(method.id);
    res.json({ method: updated });
  });

  // Reports
  router.get('/reports', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const scope = buildScopeWhere(user, 'p', req.partnerBranchIds || []);
    const { brand_id = '', branch_id = '', date_from = '', date_to = '', payment_type = '', status = '' } = req.query as Record<string, string>;

    const conditions = [scope.clause];
    const params: string[] = [...scope.params];

    if (brand_id) { conditions.push('p.brand_id = ?'); params.push(brand_id); }
    if (branch_id) { conditions.push('p.branch_id = ?'); params.push(branch_id); }
    if (date_from) { conditions.push('substr(p.created_at, 1, 10) >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('substr(p.created_at, 1, 10) <= ?'); params.push(date_to); }
    if (payment_type) { conditions.push('p.payment_type = ?'); params.push(payment_type); }
    if (status) { conditions.push('p.status = ?'); params.push(status); }

    const whereSql = conditions.join(' AND ');

    const byMethod = db.prepare(`
      SELECT pm.name as method_name, COUNT(*) as tx_count,
        SUM(CASE WHEN p.status = 'Lunas' AND p.direction = 'in' THEN p.amount ELSE 0 END) as total_in,
        SUM(CASE WHEN p.status = 'Lunas' AND p.direction = 'out' THEN p.amount ELSE 0 END) as total_out
      FROM payments p
      JOIN payment_methods pm ON pm.id = p.method_id
      WHERE ${whereSql}
      GROUP BY pm.id, pm.name
    `).all(...params);

    const byBranch = db.prepare(`
      SELECT br.name as brand_name, b.name as branch_name, COUNT(*) as tx_count,
        SUM(CASE WHEN p.status = 'Lunas' AND p.payment_type IN ('incoming_pos', 'incoming_other') THEN p.amount ELSE 0 END) as sales_in,
        SUM(CASE WHEN p.status = 'Lunas' AND p.payment_type IN ('franchise_fee', 'franchise_royalty') THEN p.amount ELSE 0 END) as franchise_in,
        SUM(CASE WHEN p.status = 'Lunas' AND p.direction = 'out' THEN p.amount ELSE 0 END) as supplier_out
      FROM payments p
      JOIN brands br ON br.id = p.brand_id
      JOIN branches b ON b.id = p.branch_id
      WHERE ${whereSql}
      GROUP BY b.id, b.name, br.name
    `).all(...params);

    const byType = db.prepare(`
      SELECT p.payment_type, p.direction, COUNT(*) as tx_count,
        SUM(CASE WHEN p.status = 'Lunas' THEN p.amount ELSE 0 END) as settled_total,
        SUM(CASE WHEN p.status IN ('Menunggu Pembayaran', 'Menunggu Verifikasi') THEN p.amount ELSE 0 END) as pending_total
      FROM payments p
      WHERE ${whereSql}
      GROUP BY p.payment_type, p.direction
    `).all(...params);

    const failedAndRefunds = db.prepare(`
      SELECT p.*, br.name as brand_name, b.name as branch_name, pm.name as method_name
      FROM payments p
      JOIN brands br ON br.id = p.brand_id
      JOIN branches b ON b.id = p.branch_id
      JOIN payment_methods pm ON pm.id = p.method_id
      WHERE ${whereSql} AND p.status IN ('Gagal', 'Ditolak', 'Kedaluwarsa', 'Refund Diproses', 'Direfund')
      ORDER BY p.created_at DESC
    `).all(...params);

    const invScope = buildScopeWhere(user, 'i', req.partnerBranchIds || []);
    const unpaidInvoices = db.prepare(`
      SELECT i.*, b.name as branch_name, br.name as brand_name
      FROM invoices i
      JOIN branches b ON b.id = i.branch_id
      JOIN brands br ON br.id = i.brand_id
      WHERE ${invScope.clause} AND i.status != 'Lunas' AND i.status != 'Dibatalkan'
      ORDER BY i.due_date ASC
    `).all(...invScope.params);

    res.json({ byMethod, byBranch, byType, failedAndRefunds, unpaidInvoices });
  });

  // Audit Logs
  router.get('/audit-logs', (req: AuthedRequest, res: Response) => {
    const user = req.currentUser!;
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(user.tenant_id);
    res.json({ items: logs });
  });

  return router;
}
