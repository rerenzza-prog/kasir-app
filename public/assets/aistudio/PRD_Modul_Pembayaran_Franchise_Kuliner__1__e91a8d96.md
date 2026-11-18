# PRD -- Modul Pembayaran

## Franchise & Culinary Management System

**Status:** Draft\
**Versi:** 1.0\
**Modul:** Payment Management\
**Platform:** Responsive Web App / PWA (desktop, Android, dan tablet)

------------------------------------------------------------------------

## 1. Tujuan Modul

Modul Pembayaran digunakan untuk mencatat, memantau, memverifikasi, dan
melaporkan seluruh arus pembayaran yang berkaitan dengan operasional
usaha kuliner dan franchise.

Modul ini mencakup: - Pembayaran pelanggan atas transaksi penjualan. -
Pembayaran kepada supplier. - Pembayaran royalti franchise. - Pembayaran
biaya franchise.

Modul harus terhubung dengan POS, manajemen stok/pembelian, manajemen
franchise, cabang, dan laporan keuangan.

## 2. Ruang Lingkup dan Menu

Menu utama aplikasi: **Pembayaran**

  -----------------------------------------------------------------------
  Submenu                             Fungsi
  ----------------------------------- -----------------------------------
  Ringkasan Pembayaran                Menampilkan total pembayaran masuk,
                                      keluar, tertunda, dan transaksi
                                      yang perlu diverifikasi

  Semua Transaksi                     Menampilkan seluruh transaksi
                                      pembayaran dengan filter dan
                                      pencarian

  Pembayaran Masuk                    Mencatat pembayaran pelanggan dan
                                      penerimaan lain

  Pembayaran Keluar                   Mencatat pembayaran supplier dan
                                      pengeluaran yang relevan

  Pembayaran Franchise                Mengelola pembayaran biaya
                                      franchise dan royalti mitra

  Tagihan / Invoice                   Membuat, melihat, mengirim, dan
                                      memantau tagihan

  Pembayaran Tertunda                 Menampilkan tagihan atau pembayaran
                                      yang belum lunas

  Verifikasi Pembayaran               Memeriksa bukti transfer atau
                                      pembayaran manual

  Refund                              Mencatat dan memproses pengembalian
                                      dana sesuai hak akses

  Rekonsiliasi                        Mencocokkan catatan transaksi
                                      dengan mutasi atau laporan penyedia
                                      pembayaran

  Metode Pembayaran                   Mengatur metode pembayaran yang
                                      tersedia

  Laporan Pembayaran                  Menyajikan laporan berdasarkan
                                      tanggal, brand, cabang, jenis, dan
                                      status
  -----------------------------------------------------------------------

## 3. Metode Pembayaran

Metode yang dapat disediakan: 1. Tunai. 2. Transfer bank. 3. QRIS. 4.
E-wallet. 5. Kartu debit/kredit. 6. Payment gateway.

Metode yang aktif harus dapat dikonfigurasi oleh Super Admin atau Owner
sesuai hak akses. Integrasi gateway dan metode yang memerlukan kerja
sama pihak ketiga hanya boleh ditampilkan sebagai aktif setelah
kredensial, akun merchant, dan pengujian integrasi selesai.

## 4. Alur Pembayaran

### 4.1 Pembayaran pelanggan melalui POS

1.  Kasir membuat pesanan di POS.
2.  Sistem menghitung subtotal, diskon, pajak/biaya (jika berlaku), dan
    total akhir.
3.  Kasir memilih metode pembayaran.
4.  Sistem membuat catatan pembayaran dengan status awal sesuai metode.
5.  Untuk pembayaran tunai, kasir memasukkan nominal diterima dan sistem
    menghitung kembalian.
6.  Untuk transfer atau QRIS manual, kasir/admin memeriksa bukti atau
    konfirmasi pembayaran.
7.  Setelah pembayaran dinyatakan sah, status transaksi menjadi
    **Lunas**.
8.  Sistem menerbitkan struk dan memperbarui laporan penjualan serta
    kas.

### 4.2 Pembayaran manual melalui transfer atau QRIS

1.  Pembayar memilih metode dan menerima instruksi pembayaran.
2.  Pembayar mengirim bukti pembayaran jika diperlukan.
3.  Sistem mencatat transaksi sebagai **Menunggu Verifikasi**.
4.  Petugas yang berwenang memeriksa nominal, waktu, referensi, dan
    bukti.
5.  Petugas menyetujui atau menolak pembayaran dengan alasan.
6.  Sistem menyimpan identitas petugas, waktu keputusan, dan riwayat
    perubahan status.

**Catatan:** Unggahan bukti transfer saja tidak boleh otomatis dianggap
sebagai pembayaran berhasil.

### 4.3 Pembayaran supplier

1.  Admin membuat catatan tagihan supplier atau memilih tagihan yang
    sudah ada.
2.  Admin memasukkan nominal dan tanggal pembayaran.
3.  Sistem mencatat metode, referensi, dan lampiran bukti.
4.  Pembayaran dapat memerlukan persetujuan sesuai batas nominal dan
    kebijakan bisnis.
5.  Setelah disetujui, sistem memperbarui saldo utang/tagihan dan
    laporan pengeluaran.

### 4.4 Pembayaran franchise

1.  Sistem membuat tagihan biaya franchise atau royalti berdasarkan
    perjanjian.
2.  Tagihan dikaitkan dengan mitra, brand, dan outlet terkait.
3.  Mitra melakukan pembayaran.
4.  Admin memverifikasi pembayaran atau sistem menerima konfirmasi dari
    gateway jika integrasi tersedia.
5.  Sistem memperbarui status tagihan dan rekap pembayaran mitra.

## 5. Status Pembayaran

  -----------------------------------------------------------------------
  Status                              Arti
  ----------------------------------- -----------------------------------
  Draft                               Catatan/tagihan belum diterbitkan

  Menunggu Pembayaran                 Tagihan sudah diterbitkan dan belum
                                      dibayar

  Menunggu Verifikasi                 Bukti atau informasi pembayaran
                                      menunggu pemeriksaan

  Lunas                               Pembayaran telah dikonfirmasi

  Ditolak                             Bukti atau pembayaran tidak dapat
                                      diterima

  Gagal                               Proses pembayaran gagal

  Kedaluwarsa                         Batas waktu pembayaran telah lewat

  Dibatalkan                          Tagihan atau transaksi dibatalkan
                                      sesuai aturan

  Refund Diproses                     Pengembalian dana sedang diproses

  Direfund                            Pengembalian dana telah selesai
  -----------------------------------------------------------------------

Status harus memiliki timestamp dan riwayat perubahan. Status **Lunas**
tidak boleh diubah atau dihapus tanpa proses koreksi yang tercatat dalam
audit log.

## 6. Fitur dan Kebutuhan Fungsional

### 6.1 Ringkasan pembayaran

-   Total pembayaran masuk dan keluar pada periode terpilih.
-   Total pembayaran lunas, tertunda, gagal, dan menunggu verifikasi.
-   Ringkasan per brand dan cabang.
-   Grafik tren pembayaran.
-   Daftar transaksi terbaru dan transaksi yang membutuhkan tindakan.

### 6.2 Daftar transaksi

-   Pencarian berdasarkan nomor transaksi, invoice, pelanggan, supplier,
    mitra, atau referensi pembayaran.
-   Filter tanggal, brand, cabang, jenis transaksi, metode, dan status.
-   Detail transaksi dan riwayat status.
-   Ekspor laporan sesuai hak akses.

### 6.3 Verifikasi manual

-   Daftar pembayaran yang menunggu verifikasi.
-   Tampilan bukti pembayaran dan detail transaksi.
-   Tombol setujui atau tolak dengan alasan.
-   Pencatatan petugas dan waktu verifikasi.
-   Pencegahan verifikasi ganda untuk satu pembayaran.

### 6.4 Invoice dan tagihan

-   Nomor invoice unik.
-   Tanggal terbit dan jatuh tempo.
-   Pihak penagih dan pihak yang ditagih.
-   Rincian item, nominal, dan catatan.
-   Status pembayaran.
-   Cetak atau unduh PDF.

### 6.5 Refund

-   Pengajuan refund dengan alasan.
-   Persetujuan sesuai hak akses.
-   Pencatatan nominal refund dan referensi transaksi asal.
-   Riwayat proses refund.
-   Refund tidak boleh melebihi nominal yang sudah dibayar dikurangi
    refund sebelumnya.

### 6.6 Rekonsiliasi

-   Pencocokan transaksi internal dengan laporan bank atau penyedia
    pembayaran.
-   Penanda transaksi cocok, tidak cocok, atau belum ditemukan.
-   Catatan penyesuaian dengan alasan dan pengguna yang melakukan
    perubahan.
-   Impor file rekonsiliasi dapat menjadi pengembangan lanjutan.

### 6.7 Laporan

-   Laporan pembayaran masuk dan keluar.
-   Laporan per metode pembayaran.
-   Laporan per cabang, brand, dan mitra franchise.
-   Laporan tagihan belum lunas dan jatuh tempo.
-   Laporan refund dan transaksi gagal.
-   Ekspor CSV/XLSX/PDF sesuai kebutuhan implementasi.

## 7. Peran dan Hak Akses

  -----------------------------------------------------------------------
  Peran                               Hak akses yang disarankan
  ----------------------------------- -----------------------------------
  Super Admin                         Mengelola konfigurasi seluruh
                                      tenant/brand dan memantau transaksi
                                      sesuai kebijakan platform

  Owner                               Melihat pembayaran seluruh outlet
                                      miliknya dan menyetujui transaksi
                                      sesuai kewenangan

  Admin Pusat                         Mengelola invoice, pembayaran
                                      franchise, laporan, dan verifikasi
                                      yang ditugaskan

  Mitra Franchise                     Melihat tagihan dan riwayat
                                      pembayaran milik mitra/outlet yang
                                      dikelolanya

  Manager Cabang                      Melihat transaksi cabang dan
                                      mengelola pembayaran sesuai batas
                                      otorisasi

  Kasir                               Menerima pembayaran POS dan melihat
                                      transaksi yang diizinkan; tidak
                                      dapat mengubah transaksi lunas

  Finance                             Mengelola pembayaran keluar,
                                      verifikasi, rekonsiliasi, dan
                                      laporan sesuai penugasan
  -----------------------------------------------------------------------

Prinsip akses: - Terapkan role-based access control (RBAC). - Setiap
pengguna hanya dapat mengakses data tenant, brand, dan cabang yang
menjadi kewenangannya. - Persetujuan pembayaran dan pengeluaran bernilai
besar dapat menggunakan alur maker-checker (pembuat berbeda dari
penyetuju). - Semua tindakan penting dicatat di audit log.

## 8. Aturan Bisnis

1.  Setiap pembayaran memiliki ID unik dan nomor referensi yang dapat
    ditelusuri.
2.  Nilai uang disimpan sebagai angka dengan presisi yang sesuai; mata
    uang default dapat menggunakan IDR.
3.  Semua waktu transaksi disimpan secara konsisten di server dan
    ditampilkan menurut zona waktu yang dikonfigurasi, misalnya
    Asia/Jakarta.
4.  Pembayaran manual berstatus menunggu verifikasi sampai diperiksa
    petugas berwenang.
5.  Satu invoice dapat dibayar sekali atau beberapa kali jika kebijakan
    cicilan/partial payment diaktifkan.
6.  Total pembayaran terkonfirmasi tidak boleh melebihi tagihan kecuali
    fitur kelebihan bayar memang dirancang.
7.  Pembatalan, koreksi, dan refund harus menyimpan alasan serta jejak
    audit.
8.  Transaksi yang sudah tercatat tidak dihapus permanen melalui
    antarmuka normal; gunakan pembatalan atau jurnal koreksi.
9.  Nomor transaksi, invoice, dan referensi gateway harus dicegah dari
    duplikasi.
10. Laporan keuangan harus membedakan transaksi penjualan, penerimaan
    kas, utang supplier, biaya, dan pembayaran franchise agar tidak
    terjadi penghitungan ganda.

## 9. Rancangan Data dan ERD Awal

Entitas inti yang disarankan:

  -----------------------------------------------------------------------
  Entitas                             Kolom penting
  ----------------------------------- -----------------------------------
  `payments`                          `id`, `tenant_id`, `branch_id`,
                                      `invoice_id`, `payment_number`,
                                      `payment_type`, `amount`,
                                      `currency`, `method_id`, `status`,
                                      `paid_at`, `reference_number`,
                                      `created_by`

  `payment_methods`                   `id`, `tenant_id`, `name`,
                                      `method_type`, `is_active`,
                                      `configuration_reference`

  `invoices`                          `id`, `tenant_id`, `branch_id`,
                                      `invoice_number`, `bill_to_type`,
                                      `bill_to_id`, `subtotal`,
                                      `discount`, `total`, `due_date`,
                                      `status`

  `invoice_items`                     `id`, `invoice_id`, `description`,
                                      `quantity`, `unit_price`,
                                      `line_total`

  `payment_verifications`             `id`, `payment_id`, `reviewer_id`,
                                      `decision`, `notes`, `reviewed_at`

  `payment_attachments`               `id`, `payment_id`,
                                      `file_reference`, `file_type`,
                                      `uploaded_by`, `created_at`

  `refunds`                           `id`, `payment_id`, `amount`,
                                      `reason`, `status`, `approved_by`,
                                      `processed_at`

  `reconciliations`                   `id`, `tenant_id`, `payment_id`,
                                      `external_reference`,
                                      `external_amount`, `match_status`,
                                      `reconciled_by`, `reconciled_at`

  `payment_status_logs`               `id`, `payment_id`, `old_status`,
                                      `new_status`, `changed_by`,
                                      `reason`, `created_at`
  -----------------------------------------------------------------------

### Relasi utama

``` mermaid
erDiagram
    PAYMENT_METHODS ||--o{ PAYMENTS : digunakan_oleh
    INVOICES ||--o{ PAYMENTS : dibayar_dengan
    INVOICES ||--|{ INVOICE_ITEMS : memiliki
    PAYMENTS ||--o{ PAYMENT_VERIFICATIONS : diverifikasi
    PAYMENTS ||--o{ PAYMENT_ATTACHMENTS : memiliki_bukti
    PAYMENTS ||--o{ REFUNDS : dapat_direfund
    PAYMENTS ||--o{ PAYMENT_STATUS_LOGS : memiliki_riwayat
    PAYMENTS ||--o{ RECONCILIATIONS : direkonsiliasi

    PAYMENT_METHODS {
      string id PK
      string tenant_id
      string name
      string method_type
      boolean is_active
    }
    PAYMENTS {
      string id PK
      string tenant_id
      string branch_id
      string invoice_id FK
      string method_id FK
      string payment_number
      decimal amount
      string status
      datetime paid_at
    }
    INVOICES {
      string id PK
      string tenant_id
      string invoice_number
      decimal total
      string status
      date due_date
    }
    INVOICE_ITEMS {
      string id PK
      string invoice_id FK
      string description
      decimal quantity
      decimal line_total
    }
    PAYMENT_VERIFICATIONS {
      string id PK
      string payment_id FK
      string reviewer_id
      string decision
      datetime reviewed_at
    }
    PAYMENT_ATTACHMENTS {
      string id PK
      string payment_id FK
      string file_reference
      string uploaded_by
    }
    REFUNDS {
      string id PK
      string payment_id FK
      decimal amount
      string status
    }
    RECONCILIATIONS {
      string id PK
      string payment_id FK
      string external_reference
      string match_status
    }
    PAYMENT_STATUS_LOGS {
      string id PK
      string payment_id FK
      string old_status
      string new_status
      string changed_by
    }
```

**Catatan desain database:** ERD di atas merupakan rancangan awal. Saat
implementasi, relasi ke order POS, supplier, mitra franchise, tenant,
brand, cabang, pengguna, dan jurnal keuangan perlu disesuaikan dengan
ERD utama aplikasi. Jangan menyimpan nomor kartu, CVV, password bank,
atau kredensial rahasia payment gateway dalam tabel biasa. Simpan secret
di secret manager atau konfigurasi server yang aman.

## 10. Rekomendasi Teknologi

-   Frontend: React + TypeScript.
-   Backend: Node.js dengan API tervalidasi.
-   Database: PostgreSQL/Supabase atau Firebase sesuai keputusan
    arsitektur keseluruhan. Untuk transaksi finansial dan relasi yang
    kompleks, PostgreSQL merupakan pilihan kuat.
-   Autentikasi: Firebase Auth atau Supabase Auth.
-   Penyimpanan bukti: object storage dengan URL akses terbatas.
-   Grafik laporan: Recharts.
-   Deployment: Google Cloud Run atau layanan hosting yang sesuai.
-   Integrasi payment gateway: melalui backend; jangan pernah menaruh
    secret key di frontend.

## 11. Kebutuhan Non-Fungsional

-   Tampilan responsif untuk desktop, Android, dan tablet.
-   Validasi nominal dan status di sisi server.
-   Otorisasi setiap endpoint berdasarkan pengguna dan tenant.
-   Audit log untuk perubahan status, persetujuan, refund, dan
    rekonsiliasi.
-   Proteksi dari request ganda menggunakan idempotency key pada proses
    pembayaran yang relevan.
-   Penanganan webhook dengan verifikasi tanda tangan, deduplikasi
    event, dan pencatatan hasil.
-   Backup database dan prosedur pemulihan.
-   Informasi error yang jelas tanpa membocorkan data sensitif.
-   Performa daftar transaksi menggunakan pagination dan filter
    server-side.

## 12. Integrasi Payment Gateway

Integrasi payment gateway merupakan opsi yang dapat diaktifkan setelah
penyedia dipilih dan akun merchant tersedia.

Alur umum: 1. Backend membuat permintaan pembayaran ke penyedia. 2.
Penyedia mengembalikan instruksi atau URL pembayaran. 3. Pengguna
menyelesaikan pembayaran pada kanal penyedia. 4. Penyedia mengirim
webhook ke backend. 5. Backend memvalidasi keaslian webhook dan
memeriksa status transaksi. 6. Backend memperbarui status pembayaran
secara idempoten. 7. Sistem mencatat hasil dan memperbarui invoice serta
laporan.

Contoh penyedia yang dapat dievaluasi: Midtrans dan Xendit. Pemilihan
akhir perlu mempertimbangkan biaya, metode yang didukung, proses
onboarding, dokumentasi, dan ketentuan merchant terbaru.

## 13. Prioritas Pengembangan

### MVP -- wajib untuk versi pertama

-   Ringkasan pembayaran.
-   Pembayaran masuk dari POS.
-   Pembayaran keluar sederhana.
-   Metode tunai dan transfer manual.
-   Invoice dan status pembayaran.
-   Verifikasi manual.
-   Riwayat transaksi dan filter.
-   Hak akses dasar.
-   Laporan pembayaran dasar.
-   Audit log perubahan status.

### Tahap 2

-   QRIS melalui penyedia yang dipilih.
-   Integrasi payment gateway.
-   Pembayaran franchise dan royalti otomatis berdasarkan aturan
    kontrak.
-   Refund terkontrol.
-   Rekonsiliasi.
-   Ekspor laporan lanjutan.
-   Notifikasi pembayaran.

### Tahap 3

-   Persetujuan berjenjang berdasarkan nominal.
-   Pembayaran parsial dan cicilan.
-   Analitik arus kas lintas cabang.
-   Integrasi akuntansi dan jurnal otomatis.
-   Deteksi anomali transaksi.

## 14. Kriteria Penerimaan

Modul dinyatakan siap untuk MVP apabila: 1. Kasir dapat mencatat
pembayaran POS dan sistem menghasilkan nomor transaksi unik. 2.
Pembayaran manual dapat masuk ke antrean verifikasi. 3. Petugas
berwenang dapat menyetujui atau menolak pembayaran dengan alasan. 4.
Perubahan status tercatat di riwayat dan audit log. 5. Invoice
menampilkan jumlah terbayar dan sisa tagihan secara benar. 6. Pengguna
cabang tidak dapat melihat transaksi cabang lain tanpa izin. 7. Laporan
dapat difilter berdasarkan tanggal, cabang, metode, dan status. 8.
Transaksi yang sudah lunas tidak dapat dihapus atau diubah tanpa proses
koreksi yang tercatat. 9. Antarmuka dapat digunakan pada desktop dan
Android. 10. Pengujian memastikan webhook atau permintaan berulang tidak
menggandakan pembayaran.

## 15. Keputusan yang Masih Perlu Dikonfirmasi

  -----------------------------------------------------------------------
  Keputusan                           Pilihan
  ----------------------------------- -----------------------------------
  Integrasi pembayaran                Manual QRIS/transfer; gateway
                                      otomatis; atau gabungan

  Verifikasi                          Manual; otomatis melalui gateway;
                                      atau gabungan

  Metode aktif saat MVP               Tunai, transfer bank, QRIS,
                                      dan/atau lainnya

  Pembayaran parsial                  Aktif atau tidak

  Refund                              Memerlukan persetujuan atau tidak

  Pembayaran franchise                Tagihan manual atau perhitungan
                                      royalti otomatis

  Penyedia gateway                    Ditentukan setelah evaluasi biaya
                                      dan kebutuhan
  -----------------------------------------------------------------------

**Rekomendasi awal:** mulai dengan pembayaran tunai dan transfer manual
serta verifikasi admin. Setelah alur transaksi stabil, tambahkan QRIS
dan payment gateway. Keputusan akhir tetap perlu dikonfirmasi sebelum
menjadi spesifikasi final.
