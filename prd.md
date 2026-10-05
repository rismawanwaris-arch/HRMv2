# Blueprint Fitur — HRMv2: Sistem HRM & Payroll Terintegrasi

**Versi:** 2.0  
**Diperbarui:** 2026-09-29  
**Perusahaan:** CV. Asya Bisnis Indonesia  
**Stack:** Express.js + SQLite (backend) · React 19 + Vite (frontend) · Docker (deployment ZimaOS)

---

## Daftar Modul

| # | Modul | Status |
|---|-------|--------|
| M0 | Autentikasi & Keamanan | ✅ Selesai |
| M1 | Rekrutmen | ✅ Selesai |
| M2 | Manajemen Karyawan | ✅ Selesai |
| M3 | Manajemen Cabang | ✅ Selesai |
| M4 | Absensi Karyawan | ✅ Selesai |
| M5/M6 | Payroll (Frontliner & Staff) | ✅ Selesai |
| M7 | Laporan Keuangan Konter | ✅ Selesai |
| M8 | Laporan Keuangan Gudang | ✅ Selesai |
| M9 | Laporan Konsolidasi | ✅ Selesai |
| M10 | Disiplin & Pelanggaran | ✅ Selesai |
| M11 | Pengaturan Sistem | ✅ Selesai |
| M12 | Dashboard | ✅ Selesai |
| M13 | Portal Ujian Online | ✅ Selesai |
| M14 | Bank Soal | ✅ Selesai |
| M15 | Audit Log | ✅ Selesai |

---

## Alur Integrasi Antar Modul

```
[M1 Rekrutmen] → kandidat Hired
      │
      ▼
[M2 Karyawan] ──── branch_id ──── [M3 Cabang]
      │                                  │
      │                                  │ rent_amount → biaya sewa otomatis
      ▼                                  ▼
[M4 Absensi] ─── potongan otomatis ─── [M7/M8 Lap. Keuangan]
      │                                  │
      │ deduction_absent/late            │ payroll & ASBEN otomatis
      ▼                                  │
[M5/M6 Payroll] ──────────────────────►│
      │                                  ▼
      │                          [M9 Konsolidasi]
      ▼
[M10 Disiplin] ─── Riwayat per karyawan
```

---

## M0 — Autentikasi & Keamanan

### Deskripsi
Login berbasis token tanpa library JWT. Token ditandatangani dengan HMAC-SHA256.

### Fitur
- **Login** — POST `/api/login` → validasi username + bcrypt-hash password → kembalikan token
- **Token format** — `base64(payload).signature` di mana `payload = {username, role, exp}`
- **Middleware `authenticateToken`** — verifikasi signature + cek exp pada setiap request terproteksi
- **Middleware `requireRole(...roles)`** — cek role dari token, kembalikan 403 jika tidak ada akses
- **Ganti password** — endpoint terpisah, validasi minimal 8 karakter
- **Rate limiting** — `express-rate-limit` pada endpoint login
- **Helmet** — HTTP security headers
- **CORS** — dikonfigurasi via `CORS_ORIGIN` env var

### Role & Akses

| Role | Kode | Akses |
|------|------|-------|
| Master/Owner | `master` | Semua modul + audit log + settings |
| Finance/HRD | `finance` | Semua modul kecuali audit log & settings |
| Staff | `staff` | Dashboard + rekrutmen + absensi (baca) |

### Environment Variables
```
JWT_SECRET=<hex 64 char>           # REQUIRED — kunci signing token
ADMIN_INITIAL_PASSWORD=<password>  # Password akun admin saat pertama kali seeding
DATA_ENCRYPTION_KEY=<hex 64 char>  # Enkripsi kolom PII sensitif
```

### Database
```sql
admins (id, username, role, password_hash, created_at, updated_at)
```

---

## M1 — Rekrutmen

### Deskripsi
Manajemen seluruh siklus rekrutmen dari pelamar masuk hingga onboarding. Mendukung pipeline tahapan yang dapat dikonfigurasi.

### Sub-Fitur

#### 1.1 Daftar Kandidat
- Tabel kandidat dengan kolom: nama, posisi, tanggal daftar, tahap saat ini, status
- Filter: status (Active/Hired/Rejected), tahap, pencarian nama
- Aksi cepat: lihat detail, tandai tahap berikutnya

#### 1.2 Detail Kandidat
- Profil lengkap: data pribadi, pendidikan, riwayat kerja
- Timeline tahapan rekrutmen
- Upload & unduh dokumen (KTP, ijazah, dll)
- Catat evaluasi per tahap
- Tombol promosi ke tahap berikutnya atau reject

#### 1.3 Pipeline Tahapan (Stage Management)
Tahapan dapat ditambah, diedit, dinonaktifkan, diurutkan ulang.

**Tahapan default sistem:**
| # | Kode | Nama Tahap |
|---|------|-----------|
| 1 | `stage1` | Seleksi Administrasi |
| 2 | `stage2` | Tes Tertulis Online |
| 3 | `stage3` | Simulasi / Praktik |
| 4 | `stage4` | Wawancara HRD |
| 5 | `stage5` | Wawancara User |
| 6 | `stage6` | MCU & Referensi |
| 7 | `stage7` | Penawaran (Offering) |
| 8 | `onboarding` | Onboarding |

#### 1.4 Ujian Tertulis Online (Stage 2)
- Kandidat akses via kode unik
- Soal multiple choice dari bank soal
- Timer per soal
- Otomatis hitung nilai saat submit
- Hasil tersimpan di `stage2_written_test`

#### 1.5 Portal Pelatihan Online (Stage 6)
- Ujian pasca-pelatihan via URL khusus
- Bank soal terpisah dari tes rekrutmen
- Alur: validasi kode → tampilkan soal → submit → skor tersimpan

### Database
```sql
candidates (id, name, phone, email, position, status, current_stage, access_code, candidate_id, ...)
recruitment_stages (id, name, code, order_num, is_active, stage_type)
stage_generic_evaluations (id, candidate_id, stage_id, passed, notes, evaluated_by, created_at)
stage1_admin / stage2_written_test / stage3_simulation / stage4_interview_hrd
stage5_interview_user / stage6_mcu_ref / stage7_offering / onboarding
candidate_documents (id, candidate_id, document_type, file_path, uploaded_at)
test_questions (id, question, options_json, correct_answer, difficulty, is_active)
training_questions (id, question, options_json, correct_answer, is_active)
```

### API Endpoints
```
GET    /api/candidates              # List kandidat (filter: status, stage, search)
POST   /api/candidates              # Tambah kandidat baru
GET    /api/candidates/:id          # Detail kandidat
PUT    /api/candidates/:id          # Update data kandidat
DELETE /api/candidates/:id          # Hapus kandidat
POST   /api/candidates/:id/advance  # Promosi ke tahap berikutnya
POST   /api/candidates/:id/reject   # Tolak kandidat
POST   /api/candidates/:id/hire     # Tandai Hired
GET    /api/stages                  # List tahapan
PUT    /api/stages/:id              # Update tahapan
POST   /api/stages/reorder          # Ubah urutan
GET    /api/test/validate/:code     # Validasi akses ujian
GET    /api/test/questions/:code    # Ambil soal ujian
POST   /api/test/submit             # Submit jawaban ujian
GET    /api/training-test/validate/:code
POST   /api/training-test/submit
```

---

## M2 — Manajemen Karyawan

### Deskripsi
CRUD data karyawan aktif. Terpisah dari tabel kandidat. Karyawan bisa diinput manual atau dipromosikan dari kandidat yang Hired.

### Sub-Fitur

#### 2.1 Daftar Karyawan
- Tabel dengan kolom: nama, NIK, jabatan, cabang, tipe, status, tanggal masuk
- Filter: cabang, tipe karyawan (Frontliner/Staff), status (Active/Resign/Terminated)
- Pencarian: nama atau NIK
- Import massal via Excel (template tersedia)

#### 2.2 Profil Karyawan (Detail)
Semua atribut dikelompokkan:
- **Pribadi:** nama, NIK, jenis kelamin, tempat/tanggal lahir, agama, status nikah, tanggungan, golongan darah, tinggi, berat, kondisi fisik, tes buta warna
- **Kontak:** HP, email, alamat KTP, alamat domisili, kontak darurat 1 & 2
- **Keluarga:** nama ayah, ibu, pasangan
- **Kesehatan:** riwayat penyakit, alergi, obat rutin
- **Pendidikan:** jenjang, institusi, jurusan, tahun, nilai
- **Keuangan & Admin:** NPWP, nama bank, nomor rekening, BPJS Kesehatan, BPJS Ketenagakerjaan *(dienkripsi di database)*
- **Pekerjaan:** jabatan, tipe karyawan, jenis kontrak, cabang, tanggal masuk, gaji pokok, tunjangan, ukuran seragam
- **Status:** Active / Resign / Terminated + tanggal resign

#### 2.3 Tambah / Edit Karyawan
- Form input lengkap semua atribut di atas
- Validasi wajib: nama, NIK (unik), jabatan, cabang, tipe, tanggal masuk

#### 2.4 Nonaktifkan Karyawan
- Ubah status ke Resign/Terminated + tanggal
- Tidak hard-delete (data historis tetap ada)

#### 2.5 Import Excel
- Download template `.xlsx` berisi 37 kolom header + 1 baris contoh
- Upload file → parse → upsert ke database (update jika NIK sudah ada, insert jika baru)
- Endpoint: `GET /api/employees/template` dan `POST /api/employees/import`

### Data yang Dienkripsi
Kolom berikut dienkripsi dengan AES-256-GCM saat `DATA_ENCRYPTION_KEY` dikonfigurasi:
`nik`, `npwp`, `bank_account`, `bpjs_health`, `bpjs_employment`, `health_history`, `allergies`, `medications`

### Database
```sql
employees (
  id, candidate_id (FK nullable), name, nik, nik_bidx (HMAC blind index),
  gender, birth_place, birth_date, religion, marital_status, dependents,
  blood_type, phone, email, address_ktp, address_domicile,
  emergency_contact_1, emergency_contact_2, father_name, mother_name, spouse_name,
  height, weight, physical_condition, color_blind_test,
  health_history*, allergies*, medications*,
  education_level, education_institution, education_major, education_years, education_grade,
  npwp*, bank_name, bank_account*, bpjs_health*, bpjs_employment*,
  position, employee_type (Frontliner|Staff), contract_type (PKWT|PKWTT|Magang),
  branch_id (FK), hire_date, salary, allowance,
  status (Active|Resign|Terminated), resign_date, uniform_size,
  created_at, updated_at
)
-- * = dienkripsi
```

### API Endpoints
```
GET    /api/employees               # List + filter + search
POST   /api/employees               # Tambah karyawan
GET    /api/employees/:id           # Detail karyawan
PUT    /api/employees/:id           # Update
DELETE /api/employees/:id           # Soft delete (ubah status)
GET    /api/employees/template      # Download template Excel
POST   /api/employees/import        # Import dari Excel
GET    /api/staff                   # List ringkas (untuk dropdown absensi/payroll)
```

---

## M3 — Manajemen Cabang

### Deskripsi
CRUD lokasi kerja (konter & gudang). Data cabang digunakan di karyawan, absensi, payroll, dan laporan keuangan.

### Sub-Fitur

#### 3.1 Daftar Cabang
- Tabel: kode, nama, kota, tipe lokasi, petshop, status, jumlah karyawan aktif
- Filter: tipe lokasi (Konter/Gudang), status (aktif/nonaktif)

#### 3.2 Tambah / Edit Cabang
Form input:
- **Kode** — unik, contoh: `ALF1`, `GDG` (dipakai di laporan)
- **Nama** — nama lengkap cabang
- **Kota** — lokasi
- **Alamat** — alamat lengkap
- **Tipe Lokasi** — `Konter` atau `Gudang` (menentukan format laporan keuangan)
- **Has Petshop** — boolean; jika true, komponen petshop muncul di laporan keuangan
- **Biaya Sewa (rent_amount)** — nominal sewa per bulan, otomatis masuk komponen biaya di laporan
- **Status aktif**

#### 3.3 Import Excel
- Download template `.xlsx` berisi kolom cabang + catatan format
- Upload → upsert berdasarkan kode cabang (UPDATE jika ada, INSERT jika baru)
- Endpoint: `GET /api/branches/template` dan `POST /api/branches/import`

### Database
```sql
branches (
  id, name, code (UNIQUE), city, address,
  location_type (Konter|Gudang), has_petshop (0|1),
  is_active (0|1), rent_amount,
  created_at
)
```

### API Endpoints
```
GET    /api/branches                # List cabang
POST   /api/branches                # Tambah
GET    /api/branches/:id            # Detail
PUT    /api/branches/:id            # Edit
DELETE /api/branches/:id            # Nonaktifkan (cek karyawan aktif dulu)
GET    /api/branches/template       # Download template Excel
POST   /api/branches/import         # Import Excel
```

---

## M4 — Absensi Karyawan

### Deskripsi
Input rekap absensi per karyawan per periode penggajian. Data absensi menjadi dasar perhitungan potongan gaji dan ASBEN (pendapatan dari denda keterlambatan).

### Konsep Periode
Periode ditentukan oleh `payroll_period_start_day` dan `payroll_period_end_day` di `system_settings`.
Contoh: Start=29, End=28 → "29 Juni – 28 Juli 2026".

### Sub-Fitur

#### 4.1 Input Absensi
Form per karyawan per periode:
| Field | Tipe | Keterangan |
|-------|------|-----------|
| `days_absent` | integer | Jumlah hari tidak masuk |
| `late_count` | integer | Jumlah kejadian terlambat |
| `cash_advance` | integer | Kasbon yang dipotong periode ini |
| `fake_money` | integer | Uang palsu yang jadi tanggungan karyawan |

#### 4.2 Perhitungan Otomatis
Sistem hitung otomatis saat data disimpan:

```
working_days  = system_settings['working_days_per_month']  (default: 25)
daily_rate    = salary / working_days

deduction_absent = days_absent × daily_rate

# Denda keterlambatan pakai tabel late_penalty_rules:
deduction_late = Σ(penalty_per_occurrence) untuk setiap kejadian berdasarkan aturan denda

# Kontribusi ASBEN cabang (pendapatan dari denda karyawan):
asben_contribution = deduction_late
```

#### 4.3 Aturan Denda (late_penalty_rules)
Tabel aturan yang bisa dikonfigurasi di M11-Settings:

| Keterlambatan ke- | s/d | Denda per Kejadian |
|-------------------|-----|-------------------|
| 1 | 3 | Rp 0 |
| 4 | 5 | Rp 25.000 |
| 6 | ∞ | Rp 50.000 |

#### 4.4 Rekap Absensi
- Tampilan rekap per periode: semua karyawan, total potongan, total ASBEN per cabang

### Database
```sql
attendance_records (
  id, employee_id (FK), period (YYYY-MM),
  days_absent, late_count, cash_advance, fake_money,
  deduction_absent, deduction_late, asben_contribution,  -- computed, cached
  created_at, updated_at,
  UNIQUE(employee_id, period)
)

late_penalty_rules (
  id, min_count, max_count (NULL = tak terbatas),
  penalty_per_occurrence, effective_from, created_at
)
```

### API Endpoints
```
GET    /api/attendance              # List absensi (filter: period, branch_id, employee_id)
POST   /api/attendance              # Input/update absensi
GET    /api/attendance/:id          # Detail satu record
DELETE /api/attendance/:id          # Hapus record absensi
```

---

## M5/M6 — Payroll (Frontliner & Staff)

### Deskripsi
Pengelolaan penggajian dua tipe karyawan dalam satu sistem payroll. Frontliner bertugas di konter, Staff/Direksi di gudang/kantor.

### Sub-Fitur

#### 5.1 Periode Payroll
- Setiap periode + tipe karyawan membentuk satu `payroll_period`
- Status: `Draft` → `Submitted` → `Approved` / `Rejected`
- Setelah Approved: data terkunci, tidak bisa diedit

#### 5.2 Entry Slip Gaji
Untuk setiap karyawan dalam periode:

**PENGHASILAN**
| Komponen | Sumber |
|----------|--------|
| Gaji Pokok | Dari data karyawan (dapat di-override) |
| Tunjangan | Dari data karyawan (dapat di-override) |

**BONUS**
| Komponen | Sumber |
|----------|--------|
| Bonus Penjualan | Input manual Finance |
| Bonus Tartun (Tarik Tunai) | Input manual Finance |
| Bonus Lain (label bebas) | Input manual Finance |
| Bonus Ditahan | Input manual — tidak muncul di slip, hanya di laporan keuangan |

**POTONGAN**
| Komponen | Sumber |
|----------|--------|
| Kasbon | Otomatis dari `attendance_records.cash_advance` |
| Tidak Masuk (N hari) | Otomatis dari `attendance_records.deduction_absent` |
| Terlambat | Otomatis dari `attendance_records.deduction_late` |
| Uang Palsu | Otomatis dari `attendance_records.fake_money` |

**TAKE HOME PAY**
```
THP = (Gaji Pokok + Tunjangan) + Total Bonus − Total Potongan
```

#### 5.3 Cetak Slip Gaji
- Cetak PDF per karyawan via browser (jsPDF)
- Format slip: header periode & cabang, tabel penghasilan, bonus, potongan, THP, info/catatan

#### 5.4 Rekap Payroll
```
REKAP PAYROLL — PERIODE: [BULAN TAHUN]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Payroll Frontliner
  Alfa 1     : N karyawan  Rp xxx
  Alfa 2     : N karyawan  Rp xxx
  SUBTOTAL FRONTLINER      Rp xxx

Payroll Staff & Direksi
  Gudang     : N karyawan  Rp xxx
  SUBTOTAL STAFF           Rp xxx

GRAND TOTAL PAYROLL        Rp xxx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 5.5 Alur Pengajuan ke Owner
```
Draft → [Finance: Ajukan] → Submitted → [Master/Owner: Approve / Reject] → Approved / Rejected
```
- Owner dapat menambahkan catatan sebelum approve/reject
- Setelah Approved: semua entry di periode tersebut terkunci

### Database
```sql
payroll_periods (
  id, period (YYYY-MM), payroll_type (Frontliner|Staff|All),
  status (Draft|Submitted|Approved|Rejected),
  submitted_at, submitted_by, approved_at, approved_by, owner_notes,
  created_at, updated_at,
  UNIQUE(period, payroll_type)
)

payroll_entries (
  id, payroll_period_id (FK), employee_id (FK), branch_id (FK),
  salary, allowance,
  bonus_penjualan, bonus_tartun, bonus_lain, bonus_lain_label,
  bonus_ditahan,
  deduction_kasbon, deduction_absent, deduction_late, deduction_fake_money,
  take_home_pay,  -- computed: (salary+allowance+bonuses) - deductions
  notes, created_at, updated_at,
  UNIQUE(payroll_period_id, employee_id)
)
```

### API Endpoints
```
GET    /api/payroll/periods         # List periode payroll
POST   /api/payroll/periods         # Buat periode baru (sekaligus generate entries dari absensi)
GET    /api/payroll/periods/:id     # Detail + semua entries periode ini
PUT    /api/payroll/periods/:id     # Update status (submit/approve/reject)
GET    /api/payroll/entries/:id     # Detail satu entry
PUT    /api/payroll/entries/:id     # Update entry (bonus, override gaji)
GET    /api/payroll/summary         # Rekap per cabang per periode
```

---

## M7 — Laporan Keuangan Konter

### Deskripsi
Laporan P&L per cabang bertipe `Konter` per periode. Beberapa komponen ditarik otomatis dari modul lain.

### Format Laporan

```
LAPORAN KEUANGAN KONTER
Cabang  : [Nama Konter]
Periode : [tgl mulai] – [tgl akhir]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PENDAPATAN
  Penjualan Konter              : Rp xxx  ← input manual
  Pendapatan Server             : Rp xxx  ← input manual
  Retur Penjualan               :(Rp xxx) ← input manual (pengurang)
  Pendapatan Lain-lain          : Rp xxx  ← input manual
  Pendapatan ASBEN              : Rp xxx  ← otomatis (Σ deduction_late karyawan cabang ini)
  ─────────────────────────────────────────────
  TOTAL PENDAPATAN              : Rp xxx

HPP
  HPP Konter                    : Rp xxx  ← input manual
  HPP Lain                      : Rp xxx  ← input manual
  [jika has_petshop = true:]
  Potongan Laba Petshop         : Rp xxx  ← input manual
  ─────────────────────────────────────────────
  TOTAL HPP                     : Rp xxx

LABA KOTOR = Total Pendapatan − Total HPP

BIAYA / PENGELUARAN
  Payroll                       : Rp xxx  ← otomatis (Σ THP karyawan cabang ini)
  Operasional                   : Rp xxx  ← input manual
  Sewa Tempat                   : Rp xxx  ← otomatis dari branch.rent_amount
  Bonus Penjualan               : Rp xxx  ← input manual
  Bonus Server                  : Rp xxx  ← input manual
  Bonus Ditahan                 : Rp xxx  ← input manual
  [jika has_petshop = true:]
  Bagi Hasil Petshop            : Rp xxx  ← input manual
  Potongan 17%                  : Rp xxx  ← otomatis: (LK − Laba Petshop − Operasional) × 17%
  ─────────────────────────────────────────────
  TOTAL BIAYA                   : Rp xxx

SELISIH = Laba Kotor − Total Biaya
```

### Status Laporan
`Draft` → `Finalized` (setelah finalisasi, tidak bisa diedit)

### Database
```sql
outlet_financials (
  id, branch_id (FK), period (YYYY-MM),
  penjualan_konter, pendapatan_server, retur_penjualan,
  pendapatan_lain, pendapatan_asben,  -- auto dari attendance
  hpp_konter, hpp_lain, potongan_laba_petshop,
  biaya_operasional, biaya_sewa,      -- auto dari branch.rent_amount
  biaya_bonus_penjualan, biaya_bonus_server, biaya_bonus_ditahan,
  biaya_payroll,                      -- auto dari payroll_entries
  bagi_hasil_petshop, laba_petshop_ref,
  status (Draft|Finalized), created_at, updated_at,
  UNIQUE(branch_id, period)
)
```

### API Endpoints
```
GET    /api/financial/konter              # List laporan konter (filter: period, branch_id)
POST   /api/financial/konter             # Buat/update laporan
GET    /api/financial/konter/:id         # Detail laporan
PUT    /api/financial/konter/:id         # Update
POST   /api/financial/konter/:id/finalize # Finalisasi
```

---

## M8 — Laporan Keuangan Gudang

### Deskripsi
Laporan P&L untuk lokasi `Gudang` (kantor pusat + gudang). Format berbeda dari konter karena ada komponen grosir internal.

### Format Laporan

```
LAPORAN KEUANGAN GUDANG
Periode : [tgl mulai] – [tgl akhir]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PENDAPATAN
  Penjualan Gudang              : Rp xxx  ← penjualan ke konter (grosir internal)
  Pendapatan Lain-lain          : Rp xxx  ← input manual
  Retur Penjualan               :(Rp xxx) ← pengurang
  Pend. Konter All              : Rp xxx  ← pendapatan gudang dari semua konter
  Pendapatan ASBEN              : Rp xxx  ← otomatis dari denda terlambat staff/direksi
  ─────────────────────────────────────────────────
  JUMLAH PENDAPATAN             : Rp xxx

HPP
  HPP Gudang                    : Rp xxx  ← input manual
  Potongan Laba Petshop         : Rp xxx  ← input manual
  ─────────────────────────────────────────────────
  JUMLAH HPP                    : Rp xxx

LABA KOTOR = Jumlah Pendapatan − Jumlah HPP

BIAYA
  Operasional                   : Rp xxx  ← input manual
  Potongan 17%                  : Rp xxx  ← otomatis: (LK − Laba Petshop − OP) × 17%
  Payroll Staff & Direksi       : Rp xxx  ← otomatis Σ THP staff gudang
  Bonus Penjualan               : Rp xxx  ← input manual
  Bagi Hasil Petshop            : Rp xxx  ← input manual
  Penyusutan                    : Rp xxx  ← input manual
  ─────────────────────────────────────────────────
  JUMLAH BIAYA                  : Rp xxx

LABA BERSIH = Laba Kotor − Jumlah Biaya
```

### Database
```sql
warehouse_reports (
  id, branch_id (FK), period (YYYY-MM),
  penj_gudang, pendapatan_lain, retur_penjualan, pend_konter_all, pendapatan_asben,
  hpp_gudang, potongan_laba_petshop,
  biaya_operasional, laba_petshop_ref,
  biaya_payroll,   -- auto
  biaya_bonus_penjualan, bagi_hasil_petshop, penyusutan,
  status (Draft|Finalized), created_at, updated_at,
  UNIQUE(branch_id, period)
)
```

### API Endpoints
```
GET    /api/financial/gudang             # List laporan gudang
POST   /api/financial/gudang            # Buat/update
GET    /api/financial/gudang/:id        # Detail
PUT    /api/financial/gudang/:id        # Update
POST   /api/financial/gudang/:id/finalize
```

---

## M9 — Laporan Konsolidasi

### Deskripsi
Ringkasan semua laporan keuangan (konter + gudang) dalam satu periode.

### Format Laporan

```
LAPORAN KONSOLIDASI — PERIODE: [BULAN TAHUN]
═══════════════════════════════════════════════════════════════════
Lokasi     | Pendapatan | HPP     | Laba Kotor | Biaya   | Laba Bersih
───────────────────────────────────────────────────────────────────
Alfa 1     | Rp xxx     | Rp xxx  | Rp xxx     | Rp xxx  | Rp xxx
Alfa 2     | Rp xxx     | Rp xxx  | Rp xxx     | Rp xxx  | Rp xxx
Gudang     | Rp xxx     | Rp xxx  | Rp xxx     | Rp xxx  | Rp xxx
───────────────────────────────────────────────────────────────────
TOTAL      | Rp xxx     | Rp xxx  | Rp xxx     | Rp xxx  | Rp xxx
═══════════════════════════════════════════════════════════════════
```

### Fitur
- Filter periode
- Klik baris → buka detail laporan masing-masing cabang
- Export PDF (jsPDF + autotable)
- Hanya tampil cabang yang sudah ada laporan untuk periode tersebut

### API Endpoints
```
GET    /api/financial/konsolidasi        # Semua laporan per periode → diformat konsolidasi
```

---

## M10 — Disiplin & Pelanggaran

### Deskripsi
Pencatatan sanksi dan peringatan tertulis untuk karyawan. Terhubung ke profil karyawan. Mendukung eskalasi SP-1 → SP-2 → SP-3.

### Jenis Sanksi
| Kode | Label |
|------|-------|
| `Teguran Lisan` | Peringatan verbal, tidak formal |
| `Teguran Tertulis` | Peringatan formal tertulis |
| `SP-1` | Surat Peringatan Pertama |
| `SP-2` | Surat Peringatan Kedua |
| `SP-3` | Surat Peringatan Ketiga (dapat berujung PHK) |

### Sub-Fitur

#### 10.1 Daftar Sanksi
- Tabel: karyawan, cabang, jenis sanksi, tanggal, status, diterbitkan oleh
- Filter: karyawan, jenis sanksi, status (Aktif/Resolved)
- Badge warna per jenis sanksi (Teguran Lisan = kuning → SP-3 = merah tua)

#### 10.2 Statistik
Kartu ringkasan di bagian atas:
- Total Sanksi Aktif
- Total Diselesaikan
- Jumlah SP-3 Aktif (indikator kritis)

#### 10.3 Catat Sanksi Baru
Form modal:
- Pilih karyawan (dropdown hanya karyawan Active)
- Jenis sanksi
- Tanggal kejadian
- Deskripsi pelanggaran
- Diterbitkan oleh

#### 10.4 Selesaikan (Resolve) Sanksi
- Tombol Resolve → modal input catatan penyelesaian
- Status berubah ke `Resolved`, dicatat tanggal selesai

#### 10.5 Hapus Sanksi
- Hapus record (hanya jika sanksi masih Draft/salah input)

### Database
```sql
discipline_records (
  id, employee_id (FK), type (Teguran Lisan|Teguran Tertulis|SP-1|SP-2|SP-3),
  date (YYYY-MM-DD), description, issued_by,
  status (Aktif|Resolved),
  resolution_note, resolved_at,
  created_at, updated_at
)
```

### API Endpoints
```
GET    /api/discipline              # List sanksi (filter: employee_id, status, type)
POST   /api/discipline              # Catat sanksi baru
PUT    /api/discipline/:id/resolve  # Selesaikan sanksi (wajib ada resolution_note)
DELETE /api/discipline/:id          # Hapus sanksi
GET    /api/discipline/stats        # Statistik ringkasan (total per tipe & status)
```

### Akses
- `finance` dan `master` dapat melihat, membuat, menyelesaikan, dan menghapus
- `staff` tidak punya akses modul ini

---

## M11 — Pengaturan Sistem

### Deskripsi
Konfigurasi global sistem yang dapat diubah oleh role `master`. Semua nilai disimpan di tabel `system_settings` dengan format key-value.

### Pengaturan yang Tersedia

#### 11.1 Periode Penggajian
```
payroll_period_start_day  = [angka]  (mis: 29)
payroll_period_end_day    = [angka]  (mis: 28)
```
Contoh: Start=29, End=28 → periode "29 Juni – 28 Juli 2026"

#### 11.2 Hari Kerja Standar
```
working_days_per_month = [angka]  (default: 25)
```
Digunakan: `potongan_absen = days_absent × (salary / working_days_per_month)`

#### 11.3 Jam Batas Masuk Shift
```
shift_pagi_cutoff  = [HH:MM]  (batas terlambat shift pagi)
shift_siang_cutoff = [HH:MM]  (batas terlambat shift siang)
```

#### 11.4 Aturan Denda Keterlambatan
Tabel `late_penalty_rules` — bisa tambah/edit/hapus via UI:

| Min | Max | Denda per Kejadian |
|-----|-----|--------------------|
| 1 | 3 | Rp 0 |
| 4 | 5 | Rp 25.000 |
| 6 | ∞ | Rp 50.000 |

### Database
```sql
system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME)
-- Contoh rows:
-- ('payroll_period_start_day', '29', ...)
-- ('payroll_period_end_day', '28', ...)
-- ('working_days_per_month', '25', ...)
-- ('shift_pagi_cutoff', '08:00', ...)
-- ('shift_siang_cutoff', '13:00', ...)

late_penalty_rules (
  id, min_count, max_count (NULL = tak terbatas),
  penalty_per_occurrence, effective_from, created_at
)
```

### API Endpoints
```
GET    /api/settings                # Semua settings + aturan denda
PUT    /api/settings                # Batch update settings
POST   /api/settings/late-rules     # Tambah aturan denda
PUT    /api/settings/late-rules/:id # Edit aturan denda
DELETE /api/settings/late-rules/:id # Hapus aturan denda
```

### Akses
Hanya `master` yang bisa mengakses halaman Settings.

---

## M12 — Dashboard

### Deskripsi
Halaman beranda setelah login. Berbeda tampilan berdasarkan role.

### HRD Dashboard (role: staff, finance)
- **Kartu ringkasan:** Total kandidat aktif, Proses rekrutmen hari ini, Karyawan aktif, Cabang aktif
- **Pipeline rekrutmen:** Jumlah kandidat per tahap (bar/card per stage)
- **Rekrutmen terbaru:** 5 kandidat terakhir masuk
- **Shortcut:** Tombol cepat ke fitur utama

### Master Dashboard (role: master)
- **Semua data di HRD Dashboard**
- **Ringkasan payroll:** Status periode payroll berjalan (Draft/Submitted/Approved)
- **Ringkasan keuangan:** Total laba bersih semua cabang periode terakhir
- **Alert:** Payroll menunggu approval, Laporan belum finalisasi

### API Endpoints
```
GET    /api/dashboard               # Data ringkasan untuk dashboard
```

---

## M13 — Portal Ujian Online

### Deskripsi
Halaman publik (tanpa login) untuk kandidat mengakses ujian rekrutmen atau ujian pasca-pelatihan.

### Alur Ujian Rekrutmen (Stage 2)
1. Kandidat masuk ke URL portal ujian
2. Masukkan kode akses unik (dari kartu akses rekrutmen)
3. Sistem validasi: apakah kode valid, apakah sudah pernah mengerjakan, apakah kandidat di tahap 2
4. Tampilkan soal satu per satu (dari `test_questions`)
5. Submit → sistem hitung skor → simpan ke `stage2_written_test`
6. Tampilkan hasil kepada kandidat

### Alur Ujian Pelatihan (Stage 6)
1. Masukkan kode akses pelatihan
2. Sistem validasi kandidat di tahap 6
3. Soal dari `training_questions` (bank soal terpisah)
4. Submit → simpan ke `stage6_mcu_ref.training_score`

### Fitur
- Tidak perlu login akun admin
- Timer per soal (dikonfigurasi di bank soal)
- Tidak bisa kembali ke soal sebelumnya
- Anti-submit ganda (cek `completed_at`)

---

## M14 — Bank Soal

### Deskripsi
Pengelolaan soal untuk ujian rekrutmen (stage 2) dan ujian pelatihan (stage 6). Dua bank soal terpisah.

### Sub-Fitur

#### 14.1 Bank Soal Rekrutmen
- CRUD soal pilihan ganda (4 pilihan + 1 kunci jawaban)
- Field: pertanyaan, opsi A–D, jawaban benar, tingkat kesulitan, status aktif
- Hanya soal aktif yang ditampilkan di ujian

#### 14.2 Bank Soal Pelatihan
- CRUD soal terpisah khusus ujian pasca-pelatihan
- Format sama dengan bank soal rekrutmen

### Database
```sql
test_questions (
  id, question, options_json (JSON array 4 opsi),
  correct_answer (A|B|C|D), difficulty (Easy|Medium|Hard),
  is_active (0|1), created_at, updated_at
)

training_questions (
  id, question, options_json,
  correct_answer (A|B|C|D), is_active (0|1),
  created_at, updated_at
)
```

### API Endpoints
```
GET/POST/PUT/DELETE  /api/admin/questions           # CRUD soal rekrutmen
GET/POST/PUT/DELETE  /api/admin/training-questions  # CRUD soal pelatihan
```

---

## M15 — Audit Log

### Deskripsi
Pencatatan semua aksi create/update/delete yang dilakukan pengguna. Hanya bisa dilihat oleh role `master`.

### Data yang Dicatat
Setiap request yang melewati middleware `auditLog`:
- **user** — username yang melakukan aksi
- **method** — HTTP method (POST, PUT, DELETE)
- **path** — endpoint yang diakses
- **body** — request body (disanitasi: field password dihapus)
- **ip** — IP address client
- **timestamp**

### Sub-Fitur
- Tabel log dengan filter: user, method, tanggal
- Pencarian per path/endpoint
- Tidak bisa dihapus dari UI

### Database
```sql
audit_log (
  id, user, method, path, body (JSON), ip, created_at
)
```

### API Endpoints
```
GET    /api/audit-log               # List log (filter: user, method, date range)
```

---

## Arsitektur Teknis

### Stack
| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, Vite 8, jsPDF + autotable |
| Backend | Node.js, Express 4, SQLite3 |
| Auth | HMAC-SHA256 custom token (tanpa library JWT) |
| Enkripsi PII | AES-256-GCM via `backend/utils/fieldCrypto.js` |
| File Upload | Multer (xlsx/xls/csv, max 10MB, tmpdir) |
| Excel | SheetJS (xlsx package) |
| Deployment | Docker multi-stage, single container port 5000 |

### Struktur Direktori
```
HRMv2/
├── backend/
│   ├── app.js              # Express app, semua routes dimount di sini
│   ├── server.js           # HTTP listen, baca PORT dari env
│   ├── db.js               # Init SQLite, semua CREATE TABLE IF NOT EXISTS
│   ├── controllers/        # Logic per modul
│   ├── routes/             # Route definitions
│   ├── middleware/
│   │   ├── auth.js         # authenticateToken
│   │   ├── roleCheck.js    # requireRole
│   │   └── audit.js        # auditLog middleware
│   └── utils/
│       ├── crypto.js       # Token sign/verify (HMAC-SHA256)
│       └── fieldCrypto.js  # AES-256-GCM encrypt/decrypt kolom PII
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Router utama, sidebar, canAccess
│   │   ├── views/          # Satu file per halaman/modul
│   │   └── services/
│   │       └── api.js      # Semua fungsi fetch ke backend
│   └── package.json
├── Dockerfile              # Multi-stage: build frontend → serve via Express
├── docker-compose.yml      # Port 5000, volume ./data:/app/data
├── .env                    # Secrets (gitignored)
├── .env.example            # Template tanpa nilai
├── run.js                  # Dev runner: spawn backend + frontend serentak
└── package.json            # Root: npm start → node run.js
```

### Role Constants (backend/app.js)
```js
const STAFF   = ['staff', 'finance', 'master'];  // Semua role
const FINANCE = ['finance', 'master'];            // Finance ke atas
const MASTER  = ['master'];                       // Hanya owner/master
```

### canAccess (frontend/src/App.jsx)
```js
const canAccess = {
  rekrutmen : ['staff', 'finance', 'master'].includes(currentRole),
  karyawan  : ['finance', 'master'].includes(currentRole),
  cabang    : ['finance', 'master'].includes(currentRole),
  payroll   : ['finance', 'master'].includes(currentRole),
  laporan   : ['finance', 'master'].includes(currentRole),
  disiplin  : ['finance', 'master'].includes(currentRole),
  settings  : ['master'].includes(currentRole),
  audit     : ['master'].includes(currentRole),
};
```

---

## Deployment

### Development
```bash
npm start          # dari root → jalankan backend (5001) + frontend (5173) serentak
npm run backend    # hanya backend
npm run frontend   # hanya frontend
```

### Production (Docker / ZimaOS)
```bash
# Build + jalankan
sudo DOCKER_CONFIG=/DATA/.docker docker compose up -d --build

# Update aplikasi dari GitHub
git pull
sudo DOCKER_CONFIG=/DATA/.docker docker compose build --no-cache
sudo DOCKER_CONFIG=/DATA/.docker docker compose up -d --force-recreate
```

**Port:** `5000` (satu port untuk frontend + backend, frontend di-serve oleh Express sebagai static file)

**Data persisten:** Volume `./data:/app/data` → database SQLite tersimpan di `data/recruitment.db`

### Environment Variables Lengkap
```
JWT_SECRET=<hex 64 char>            # REQUIRED
DATA_ENCRYPTION_KEY=<hex 64 char>   # Recommended: enkripsi PII
ADMIN_INITIAL_PASSWORD=<password>   # Default admin123 jika kosong
PORT=5000                           # Port aplikasi
TRUST_PROXY=1                       # Aktifkan jika di belakang reverse proxy
DATA_DIR=/app/data                  # Direktori data persisten
CORS_ORIGIN=                        # Kosong = same-origin (frontend dari Express)
```

---

## Keamanan

- Semua endpoint (kecuali login & portal ujian) butuh token valid
- Role checked di middleware, bukan di controller
- PII sensitif dienkripsi at-rest (AES-256-GCM)
- HMAC blind index untuk pencarian NIK terenkripsi
- Helmet untuk HTTP security headers
- Rate limiting pada endpoint login
- Audit log mencatat semua aksi write
- `.env` tidak pernah di-commit ke git
- Password di-hash dengan bcrypt

---

*Blueprint v2.0 — Semua modul berstatus ✅ Selesai per 2026-09-29*
