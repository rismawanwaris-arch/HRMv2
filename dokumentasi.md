Berikut adalah rangkuman dari seluruh perjalanan *deployment* dan *troubleshooting* kita, disusun rapi dalam format teks murni Markdown.

Kamu bisa langsung menyalin seluruh isi di dalam kotak di bawah ini, lalu menempelkannya (*paste*) di Notepad, VS Code, atau aplikasi teks editor di komputermu, dan menyimpannya dengan nama file **`Riwayat_Deploy_HRMv2.md`**.

```markdown
# 🚀 Jurnal & Panduan Lengkap Deployment HRMv2 di ZimaOS

Dokumen ini adalah rangkuman langkah-langkah, penyelesaian masalah, dan prosedur standar operasional (SOP) untuk aplikasi HRMv2 yang di-deploy menggunakan Docker di ekosistem ZimaOS.

---

## 1. Penyelesaian Masalah Izin Akses (Permission Denied)
Sistem ZimaOS memproteksi partisi `root` (read-only), sehingga perintah standar Docker sering mengalami error gagal membuat folder konfigurasi (`/root/.docker`).

**Solusi:**
Gunakan environment variable untuk memindahkan lokasi baca/tulis konfigurasi Docker ke partisi yang diizinkan (folder `/DATA`).
* **Perintah Dasar:**
  ```bash
  sudo DOCKER_CONFIG=/DATA/.docker docker compose up -d --build

```

---

## 2. Pengaturan Akses Jarak Jauh (Tailscale)

Aplikasi frontend yang dibangun dengan **Vite** secara default hanya dapat diakses melalui `localhost` (127.0.0.1) saat mode *preview*, sehingga gagal diakses dari jaringan luar atau Tailscale.

**Solusi:**
Mengubah konfigurasi `package.json` di frontend agar server mendengarkan ke semua antarmuka jaringan (`0.0.0.0`).

* **Perubahan pada `package.json`:**
```json
"scripts": {
  "preview": "vite preview --host 0.0.0.0 --port 5000"
}

```



---

## 3. Pengamanan Database & File (Docker Volumes)

Agar data persisten (database, log, unggahan file) tidak hilang saat container dihapus atau di-build ulang, aplikasi diikat dengan Docker Volume.

**Konfigurasi pada `docker-compose.yml`:**

```yaml
services:
  hrmv2:
    volumes:
      - hrmv2-data:/app/data
    environment:
      - DATA_DIR=/app/data

volumes:
  hrmv2-data:
    driver: local

```

*Dengan setup ini, perintah rebuild tidak akan menyentuh apalagi menghapus data lama yang sudah tersimpan di `/app/data`.*

---

## 4. Menghubungkan ZimaOS dengan GitHub

Karena kebijakan keamanan terbaru, GitHub tidak lagi menerima password akun untuk operasi Git dari terminal, melainkan menggunakan **Personal Access Token (PAT)**.

**Cara Akses Repository Private/Public:**

1. Buat token di GitHub melalui **Settings** -> **Developer settings** -> **Personal access tokens (classic)**.
2. Pastikan mencentang izin/scope **`repo`**.
3. Lakukan *clone* menggunakan URL yang sudah disisipi token untuk mencegah *error 403 Forbidden*:
```bash

```



---

## 5. SOP Update Aplikasi (Standar Operasional)

Ini adalah langkah yang wajib dilakukan ketika ada penambahan fitur baru di GitHub dan ingin memperbarui aplikasi di server ZimaOS tanpa kehilangan data.

**Langkah-langkah Eksekusi:**

1. Masuk ke direktori aplikasi:
```bash
cd ~/Documents/HRMv2

```


2. Tarik update terbaru dari GitHub:
```bash
git pull

```


3. Bangun ulang container tanpa menggunakan *cache* (agar fitur baru benar-benar ter-compile):
```bash
sudo DOCKER_CONFIG=/DATA/.docker docker compose build --no-cache

```


4. Jalankan kembali container yang baru (volume data akan otomatis tersambung):
```bash
sudo DOCKER_CONFIG=/DATA/.docker docker compose up -d --force-recreate

```


5. Buka web HRMv2 di browser, lalu lakukan **Hard Refresh** (`Ctrl + F5` atau `Cmd + Shift + R`) untuk membersihkan *cache* tampilan lama.

---

## 6. Struktur Database (SQLite) & Skema Pipeline

Aplikasi menggunakan database SQLite (`recruitment.db`) yang disimpan secara persisten di volume Docker `/app/data/recruitment.db`.

### Tabel-tabel Utama:
1. **`candidates`**: Data biodata kandidat pelamar kerja.
   - Kolom penting: `id`, `name`, `status` (Active, Hired, Rejected), `current_stage` (merujuk ke ID `recruitment_stages`).
2. **`branches`**: Daftar kantor cabang/outlet penempatan karyawan.
   - Kolom penting: `id`, `code` (Unique), `name`, `city`, `address`.
3. **`recruitment_stages`**: Konfigurasi tahapan rekrutmen dinamis yang dapat disesuaikan.
   - Kolom penting: `id`, `name`, `code` (Unique), `order_num`, `is_active` (1 = Aktif, 0 = Nonaktif).
4. **`stage_generic_evaluations`**: Catatan evaluasi kelulusan untuk tahapan custom/generic.
   - Kolom penting: `id`, `candidate_id`, `stage_id`, `passed`, `notes`.
5. **Tabel Tahap Spesifik**:
   - `stage1_admin`, `stage2_written_test`, `stage3_simulation`, `stage4_interview_hrd`, `stage5_interview_user`, `stage6_mcu_ref`, `stage7_offering`, `onboarding`

---

## 7. Dokumentasi REST API (OpenAPI)

Spesifikasi lengkap dari seluruh REST endpoint dapat dilihat pada file spesifikasi OpenAPI:
- Lokasi file: [openapi.yaml]

Spesifikasi ini mencakup endpoint autentikasi, manajemen kandidat, CRUD cabang, konfigurasi pipeline tahap seleksi, dan portal ujian.

---

*Dokumentasi dibuat pada: Juli 2026*
```

```