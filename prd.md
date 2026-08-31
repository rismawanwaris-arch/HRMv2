# PRD — HRMv2: Sistem HRM & Payroll Terintegrasi

**Versi:** 1.1  
**Tanggal:** 2026-09-01  
**Status:** Draft untuk Review

---

## 1. Latar Belakang & Tujuan

CV. Asya Bisnis Indonesia mengoperasikan 20+ cabang konter pulsa + 1 gudang dengan 50+ karyawan aktif. Saat ini proses rekrutmen sudah berjalan di sistem HRMv2, namun pengelolaan karyawan, absensi, dan penggajian masih dilakukan secara manual (Excel).

Tujuan proyek ini adalah menyambungkan seluruh siklus SDM dalam satu sistem:

```
Rekrutmen → Karyawan Aktif → Absensi Harian → Payroll Bulanan → Laporan Keuangan Cabang/Gudang
```

---

## 2. Ruang Lingkup (Scope)

| Modul | Status |
|---|---|
| M1 — Rekrutmen | ✅ Sudah ada |
| M2 — Manajemen Karyawan (CRUD, tabel employees) | 🔲 Baru |
| M3 — Manajemen Cabang (CRUD) | 🔲 Baru |
| M4 — Absensi Karyawan | 🔲 Baru |
| M5 — Payroll Frontliner | 🔲 Baru |
| M6 — Payroll Staff & Direksi | 🔲 Baru |
| M7 — Rekap & Pengajuan Payroll ke Owner | 🔲 Baru |
| M8 — Laporan Keuangan Konter | 🔲 Baru |
| M9 — Laporan Keuangan Gudang | 🔲 Baru |
| M10 — Laporan Konsolidasi Semua Lokasi | 🔲 Baru |
| M11 — Pengaturan Sistem (periode, aturan denda) | 🔲 Baru |

---

## 3. Peran Pengguna (User Roles)

| Role | Akses |
|---|---|
| **Owner** | Lihat semua laporan, approve/reject pengajuan payroll |
| **Finance / HRD** | CRUD karyawan, cabang, input absensi, input payroll, buat rekap, pengajuan ke owner |

> **v1.0:** Dua role (Finance/HRD dan Owner). Role tambahan (kepala cabang) bisa ditambahkan di v2.

---

## 4. Modul 2 — Manajemen Karyawan

### 4.1 Tabel `employees` (Terpisah dari `candidates`)
Karyawan disimpan di tabel `employees` sendiri, bukan di `candidates`. Alur:
- Kandidat yang lulus rekrutmen (status Hired) **dipindahkan/disalin** ke tabel `employees`
- Karyawan lama bisa diinput langsung ke `employees` tanpa lewat rekrutmen

### 4.2 Atribut Karyawan

```
Informasi Pribadi:
  name, nik, gender, birth_place, birth_date, religion, marital_status,
  dependents, blood_type, phone, email, address_ktp, address_domicile,
  emergency_contact_1, emergency_contact_2, father_name, mother_name, spouse_name,
  height, weight, physical_condition, color_blind_test,
  health_history, allergies, medications

Informasi Pendidikan:
  education_level, education_institution, education_major,
  education_years, education_grade

Informasi Keuangan & Administrasi:
  npwp, bank_name, bank_account, bpjs_health, bpjs_employment

Informasi Kerja:
  position           (Jabatan: Frontliner / Kasir / SPV / Staff / Direksi / dll)
  employee_type      (Frontliner | Staff)
  contract_type      (PKWT | PKWTT | Magang)
  branch_id          (cabang/gudang penempatan)
  hire_date          (tanggal mulai kerja)
  salary             (gaji pokok)
  allowance          (tunjangan tetap)
  status             (Active | Resign | Terminated)
  resign_date
  candidate_id       (FK ke candidates, nullable — null jika input manual)

Administrasi:
  uniform_size
```

### 4.3 Fitur CRUD
- **List:** tabel karyawan dengan filter cabang, tipe, status; search by nama/NIK
- **Detail:** halaman profil lengkap
- **Tambah:** form entry manual atau promosi dari rekrutmen
- **Edit:** update semua data
- **Nonaktifkan:** ubah status ke Resign/Terminated + tanggal (tidak hard-delete)
- **Import Excel:** upload massal karyawan lama

---

## 5. Modul 3 — Manajemen Cabang

### 5.1 Tipe Lokasi
| Tipe | Keterangan |
|---|---|
| `Konter` | Cabang penjualan pulsa (laporan keuangan format konter) |
| `Gudang` | Kantor pusat + gudang + non-outlet (laporan keuangan format gudang) |

### 5.2 Atribut Cabang

```sql
id, name, code (mis: ALF1, GDG), city, address,
location_type (Konter | Gudang),
has_petshop (boolean),   ← jika true, komponen petshop muncul di laporan keuangan cabang ini
is_active,
rent_amount (biaya sewa per bulan, untuk otomatis masuk laporan biaya),
created_at
```

### 5.3 Fitur CRUD
- List cabang + jumlah karyawan aktif per cabang
- Tambah, edit, nonaktifkan
- Assign karyawan ke cabang (relasi many-to-one)

---

## 6. Modul 11 — Pengaturan Sistem

Halaman Settings yang bisa diedit oleh admin:

### 6.1 Pengaturan Periode Penggajian
```
Tanggal Mulai Periode : [angka] (mis: 29 → artinya mulai tgl 29 setiap bulan)
Tanggal Akhir Periode : [angka] (mis: 28 → artinya berakhir tgl 28 bulan berikutnya)
```
Contoh: Start=29, End=28 → "29 Juni – 28 Juli 2026"

### 6.2 Aturan Denda Keterlambatan (ASBEN)
Tabel aturan yang bisa ditambah/edit/hapus:

| Keterlambatan ke- (dari) | Keterlambatan ke- (sampai) | Denda per Kejadian |
|---|---|---|
| 1 | 3 | Rp 0 |
| 4 | 5 | Rp 25.000 |
| 6 | ∞ | Rp 50.000 |

> Aturan ini berlaku global untuk semua cabang.

### 6.3 Hari Kerja Standar
```
Hari Kerja per Bulan : [angka] (default: 25)
```
Digunakan untuk menghitung potongan per hari absen: `gaji_pokok / hari_kerja_standar`

---

## 7. Modul 4 — Absensi Karyawan

### 7.1 Konsep
Absensi diinput per periode penggajian, bukan real-time. Finance/HRD merekap dari tiap cabang.

| Field | Keterangan |
|---|---|
| `days_absent` | Jumlah hari tidak masuk |
| `late_count` | Jumlah kejadian terlambat |
| `cash_advance` | Kasbon yang dipotong periode ini |
| `fake_money` | Uang palsu yang jadi tanggungan karyawan |

### 7.2 Perhitungan Otomatis dari Absensi
Sistem menghitung otomatis dari data absensi dan diteruskan ke payroll:

```
potongan_absen = days_absent × (salary / hari_kerja_standar)
potongan_telat = jumlah_denda berdasarkan late_count × aturan denda
pendapatan_asben_cabang = total potongan_telat semua karyawan di cabang tersebut
```

---

## 8. Modul 5 & 6 — Payroll Frontliner & Staff

### 8.1 Dua Jenis Payroll
| Payroll | Karyawan |
|---|---|
| **Payroll Frontliner** | `employee_type = Frontliner` (bertugas di konter) |
| **Payroll Staff & Direksi** | `employee_type = Staff` (bertugas di gudang/kantor) |

### 8.2 Komponen Slip Gaji

```
HEADER
  Periode  : [tgl mulai] – [tgl akhir]
  Lokasi   : [nama cabang]
  Nama     : [nama karyawan]
  Jabatan  : [position]

PENGHASILAN
  Gaji Pokok                          : Rp xxx
  Tunjangan                           : Rp xxx
  ────────────────────────────────────────────
  TOTAL                               : Rp xxx

BONUS
  Bonus Penjualan                     : Rp xxx
  Bonus Tarik Tunai (Tartun)          : Rp xxx  ← input manual (hasil perhitungan tersendiri)
  ────────────────────────────────────────────
  TOTAL BONUS                         : Rp xxx

POTONGAN
  Kasbon                              : Rp xxx  ← dari data absensi
  Tidak Masuk ([N] hari)              : Rp xxx  ← otomatis dari absensi
  Terlambat                           : Rp xxx  ← otomatis dari absensi + aturan denda
  Uang Palsu                          : Rp xxx  ← dari data absensi
  ────────────────────────────────────────────
  TOTAL POTONGAN                      : Rp xxx

TAKE HOME PAY
  Amount = TOTAL + TOTAL BONUS − TOTAL POTONGAN : Rp xxx

INFO / Catatan
```

> **Tartun (Tarik Tunai):** Persentase fee dari transaksi tarik tunai. Perhitungan dilakukan di luar sistem; Finance tinggal input nominal bonusnya.

> **Bonus Ditahan:** Jika karyawan tidak mencapai target, sebagian bonus ditahan. Nilainya diinput manual oleh Finance dan **tidak muncul di slip** — hanya dicatat di sistem sebagai komponen laporan keuangan cabang.

### 8.3 Input Payroll
- Gaji pokok & tunjangan ditarik otomatis dari data karyawan (bisa di-override per periode)
- Bonus Penjualan & Tartun: input manual
- Potongan: ditarik otomatis dari data absensi
- Sistem menghitung Take Home Pay

### 8.4 Cetak Slip Gaji
- Cetak per karyawan
- Cetak massal per cabang/periode

---

## 9. Modul 7 — Rekap & Pengajuan Payroll

### 9.1 Rekap Payroll

```
REKAP PAYROLL — PERIODE: [BULAN TAHUN]
══════════════════════════════════════════════════
Payroll Frontliner
  Alfa 1     : N karyawan  Rp xxx
  Alfa 2     : N karyawan  Rp xxx
  ...
  SUBTOTAL FRONTLINER      Rp xxx

Payroll Staff & Direksi
  Gudang     : N karyawan  Rp xxx
  SUBTOTAL STAFF           Rp xxx

GRAND TOTAL PAYROLL        Rp xxx
══════════════════════════════════════════════════
```

### 9.2 Alur Pengajuan
```
Draft → [Finance: Ajukan] → Diajukan → [Owner: Approve/Reject] → Disetujui / Ditolak
```
- Setelah **Disetujui**: payroll terkunci, tidak bisa diedit
- Owner bisa tambah catatan sebelum approve/reject

---

## 10. Modul 8 — Laporan Keuangan Konter

Format untuk setiap cabang dengan `location_type = Konter`:

```
LAPORAN KEUANGAN KONTER
Cabang  : [Nama Konter]
Periode : [tgl mulai] – [tgl akhir]
══════════════════════════════════════════════════

PENDAPATAN
  Penjualan Konter                  : Rp xxx  ← input manual
  Pendapatan Server                 : Rp xxx  ← input manual
  Retur Penjualan                   :(Rp xxx) ← input manual, pengurang
  Pendapatan Lain-lain              : Rp xxx  ← input manual
  Pendapatan ASBEN                  : Rp xxx  ← otomatis dari total denda terlambat karyawan cabang ini
  ──────────────────────────────────────────
  TOTAL PENDAPATAN                  : Rp xxx

HPP
  HPP Konter                        : Rp xxx  ← input manual
  HPP Lain                          : Rp xxx  ← input manual
  ──────────────────────────────────────────
  TOTAL HPP                         : Rp xxx

LABA KOTOR = Total Pendapatan − Total HPP : Rp xxx

BIAYA / PENGELUARAN
  Payroll              : Rp xxx  ← otomatis dari total THP karyawan di cabang ini
  Operasional          : Rp xxx  ← input manual
  Sewa Tempat          : Rp xxx  ← otomatis dari data cabang (rent_amount)
  Bonus Penjualan      : Rp xxx  ← input manual (atau otomatis dari total bonus penjualan payroll)
  Bonus Server         : Rp xxx  ← input manual
  Bonus Ditahan        : Rp xxx  ← input manual (bonus yang tidak dibayar karena tidak achieve target)
  [jika has_petshop = true:]
  Potongan Laba Petshop: Rp xxx  ← input manual (di sisi HPP, bukan biaya)
  Bagi Hasil Petshop   : Rp xxx  ← input manual
  Potongan 17%         : Rp xxx  ← otomatis: (Laba Kotor − Laba Petshop − Operasional) × 17%
  ──────────────────────────────────────────
  TOTAL BIAYA          : Rp xxx

SELISIH = Laba Kotor − Total Biaya : Rp xxx
```

---

## 11. Modul 9 — Laporan Keuangan Gudang

Format khusus untuk lokasi dengan `location_type = Gudang`:

```
LAPORAN KEUANGAN GUDANG
Periode : [tgl mulai] – [tgl akhir]
══════════════════════════════════════════════════════════════════

PENDAPATAN
  Penjualan Gudang                  : Rp xxx  ← penjualan ke konter (grosir internal)
  Pendapatan Lain-lain              : Rp xxx
  Retur Penjualan                   :(Rp xxx) ← pengurang
  Pend. Konter All                  : Rp xxx  ← pendapatan gudang dari semua konter (grosir internal)
  Pendapatan ASBEN                  : Rp xxx  ← otomatis dari denda terlambat staff/direksi
  ──────────────────────────────────────────────────────────────
  JUMLAH PENDAPATAN                 : Rp xxx

HPP
  HPP Gudang                        : Rp xxx  ← input manual
  Potongan Laba Petshop             : Rp xxx  ← input manual (bagian laba petshop yang jadi HPP)
  ──────────────────────────────────────────────────────────────
  JUMLAH HPP                        : Rp xxx

LABA KOTOR = Jumlah Pendapatan − Jumlah HPP : Rp xxx

BIAYA
  Operasional                       : Rp xxx  ← input manual
  Potongan (LK−Lab.Petshop−OP) 17% : Rp xxx  ← otomatis: (Laba Kotor − Laba Petshop − Operasional) × 17%
  Payroll Staff & Direksi           : Rp xxx  ← otomatis dari total THP karyawan gudang
  Bonus Penjualan                   : Rp xxx  ← input manual
  Bagi Hasil Petshop                : Rp xxx  ← input manual
  Penyusutan                        : Rp xxx  ← input manual
  ──────────────────────────────────────────────────────────────
  JUMLAH BIAYA                      : Rp xxx

LABA BERSIH = Laba Kotor − Jumlah Biaya : Rp xxx
```

> **Petshop:** Bisa ada di semua lokasi (konter maupun gudang). Komponen petshop di laporan keuangan muncul/tersembunyi berdasarkan flag `has_petshop` di data cabang. Komponen: Potongan Laba Petshop (di HPP), Bagi Hasil Petshop (di Biaya), dan Potongan (LK−Lab.Petshop−OP) 17% (di Biaya).

---

## 12. Modul 10 — Laporan Konsolidasi Semua Lokasi

```
LAPORAN KONSOLIDASI — PERIODE: [BULAN TAHUN]
═══════════════════════════════════════════════════════════════════════
Lokasi        | Jml Pend. | Jml HPP | Laba Kotor | Jml Biaya | Laba Bersih
──────────────────────────────────────────────────────────────────────
Alfa 1        | Rp xxx    | Rp xxx  | Rp xxx     | Rp xxx    | Rp xxx
Alfa 2        | Rp xxx    | Rp xxx  | Rp xxx     | Rp xxx    | Rp xxx
...
Gudang        | Rp xxx    | Rp xxx  | Rp xxx     | Rp xxx    | Rp xxx
──────────────────────────────────────────────────────────────────────
TOTAL         | Rp xxx    | Rp xxx  | Rp xxx     | Rp xxx    | Rp xxx
═══════════════════════════════════════════════════════════════════════
```

---

## 13. Model Data Baru (Tabel Database)

### `employees`
```sql
id, candidate_id (FK, nullable), name, nik, gender, birth_place, birth_date,
religion, marital_status, dependents, blood_type, phone, email,
address_ktp, address_domicile, emergency_contact_1, emergency_contact_2,
father_name, mother_name, spouse_name, height, weight, physical_condition,
color_blind_test, health_history, allergies, medications,
education_level, education_institution, education_major, education_years, education_grade,
npwp, bank_name, bank_account, bpjs_health, bpjs_employment,
position, employee_type (Frontliner|Staff), contract_type,
branch_id (FK), hire_date, salary, allowance,
status (Active|Resign|Terminated), resign_date,
uniform_size, created_at, updated_at
-- PII columns (nik, npwp, bank_account, bpjs_*, health_*) encrypted same as candidates
-- nik_bidx: HMAC blind index (same pattern)
```

### `attendance_records`
```sql
id, employee_id (FK), period (YYYY-MM),
days_absent, late_count, cash_advance, fake_money,
-- computed fields (cached):
deduction_absent, deduction_late, asben_contribution,
created_at, updated_at
UNIQUE(employee_id, period)
```

### `payroll_periods`
```sql
id, period (YYYY-MM), payroll_type (Frontliner|Staff|All),
status (Draft|Submitted|Approved|Rejected),
submitted_at, submitted_by, approved_at, approved_by, owner_notes,
created_at, updated_at
UNIQUE(period, payroll_type)
```

### `payroll_entries`
```sql
id, payroll_period_id (FK), employee_id (FK), branch_id (FK),
salary, allowance,
bonus_penjualan, bonus_tartun, bonus_lain, bonus_lain_label,
bonus_ditahan,
deduction_kasbon, deduction_absent, deduction_late, deduction_fake_money,
take_home_pay (computed),
notes, created_at, updated_at
UNIQUE(payroll_period_id, employee_id)
```

### `branch_reports` — format konter
```sql
id, branch_id (FK), period (YYYY-MM),
penjualan_konter, pendapatan_server, retur_penjualan,
pendapatan_lain, pendapatan_asben (auto),
hpp_konter, hpp_lain,
biaya_operasional, biaya_sewa (auto from branch.rent_amount),
biaya_bonus_penjualan, biaya_bonus_server, biaya_bonus_ditahan,
biaya_payroll (auto from payroll_entries),
-- computed:
total_pendapatan, total_hpp, laba_kotor, total_biaya, selisih,
status (Draft|Finalized), created_at, updated_at
UNIQUE(branch_id, period)
```

### `warehouse_reports` — format gudang
```sql
id, branch_id (FK), period (YYYY-MM),
penj_gudang, pendapatan_lain, retur_penjualan, pend_konter_all, pendapatan_asben (auto),
hpp_gudang, potongan_laba_petshop,
biaya_operasional,
-- potongan_17pct dihitung otomatis: (laba_kotor - laba_petshop_ref - operasional) * 0.17
laba_petshop_ref,
biaya_payroll (auto),
biaya_bonus_penjualan, bagi_hasil_petshop, penyusutan,
-- computed:
jumlah_pendapatan, jumlah_hpp, laba_kotor, jumlah_biaya, laba_bersih,
status (Draft|Finalized), created_at, updated_at
UNIQUE(branch_id, period)
```

### `system_settings`
```sql
key (PK), value, updated_at
-- contoh rows:
-- payroll_period_start_day = 29
-- payroll_period_end_day   = 28
-- working_days_per_month   = 25
```

### `late_penalty_rules`
```sql
id, min_count, max_count (nullable = tak terbatas),
penalty_per_occurrence, effective_from, created_at
```

---

## 14. Alur Integrasi Antar Modul

```
[M1 Rekrutmen]
      │ kandidat Hired
      ▼
[M2 Karyawan] ──── assign ke ──── [M3 Cabang]
      │                                  │
      │                                  │ rent_amount → biaya sewa otomatis
      ▼                                  ▼
[M4 Absensi] ──────────────────── [M8/M9 Lap. Keuangan]
      │                                  │
      │ potongan otomatis                │ payroll otomatis
      ▼                                  │ ASBEN otomatis
[M5/M6 Payroll] ───────────────────────►│
      │                                  ▼
      ▼                          [M10 Konsolidasi]
[M7 Rekap & Pengajuan]
      │
      ▼
[Owner Approve]
```

---

## 15. Pertanyaan Terbuka (Belum Dikonfirmasi)

| # | Pertanyaan |
|---|---|
| 1 | **Petshop:** ✅ Dikonfirmasi — semua cabang (konter dan gudang) bisa punya komponen petshop. Dikontrol via flag `has_petshop` per cabang. |
| 2 | **Kasbon:** Hanya input nominal potongan bulan ini, atau perlu kelola riwayat pinjam-cicil kasbon? |
| 3 | **Owner login:** Apakah owner perlu login ke sistem untuk approve, atau cukup Finance print rekap dan owner tanda tangan manual? |
| 4 | **Absensi mobile:** Apakah input absensi perlu bisa dari HP, atau desktop/laptop sudah cukup? |

---

## 16. Prioritas Implementasi

### Fase 1 — Fondasi Karyawan & Cabang
1. M11: Pengaturan sistem (periode, hari kerja, aturan denda)
2. M3: CRUD Cabang (lengkapi: tipe Konter/Gudang, rent_amount)
3. M2: CRUD Karyawan (tabel `employees` baru, migrasi dari candidates.Hired)

### Fase 2 — Absensi & Payroll
4. M4: Input absensi per karyawan per periode
5. M5/M6: Input payroll, hitung otomatis, cetak slip gaji
6. M7: Rekap payroll + pengajuan ke owner

### Fase 3 — Laporan Keuangan
7. M8: Laporan keuangan konter
8. M9: Laporan keuangan gudang (dengan komponen petshop)
9. M10: Laporan konsolidasi semua lokasi

---

## 17. Non-Functional Requirements

- **Keamanan:** Data gaji sensitif — semua endpoint butuh login; PII dienkripsi (sudah ada di modul rekrutmen, akan diterapkan sama di tabel employees)
- **Performa:** Laporan konsolidasi 20+ cabang < 3 detik
- **Cetak:** Slip gaji dan laporan harus bisa dicetak / export PDF dari browser
- **Backup:** Volume Docker `./data` sudah persistent; perlu SOP backup rutin
- **Offline:** Berjalan di jaringan lokal ZimaOS, tidak butuh internet

---

*Versi 1.1 — mencakup konfirmasi: Tartun=Tarik Tunai, bonus ditahan input manual, periode dapat dikonfigurasi, tabel employees terpisah, staff non-outlet masuk laporan gudang, PEND KONTER ALL=grosir internal gudang ke konter.*
