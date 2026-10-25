# Panduan Keamanan & Integrasi API untuk Repository Android (Flutter HRGA)

Dokumen ini adalah spesifikasi wajib yang harus diterapkan pada **repository aplikasi Android Flutter** agar selaras 100% dengan sistem keamanan terbaru di **Backend HRMv2 (Port 5002)** serta melindungi **Data Pribadi Karyawan (PII)** dari kebocoran di perangkat maupun di jaringan.

---

## 1. Perubahan Kebijakan Keamanan Backend yang Wajib Diketahui Android

Backend HRMv2 telah diperketat dengan lapisan keamanan berikut. Aplikasi Android **wajib** menyesuaikan perilakunya:

### A. Semua Endpoint Wajib Header `Authorization: Bearer <token>`
* Sebelumnya, `/api/mobile/master-data` (dan `/api/master-data`) dapat diakses tanpa token.
* **Sekarang:** Seluruh endpoint (termasuk `/master-data`, `/sync/*`, `/assets`, `/employees`) **WAJIB** mengirimkan header:
  ```http
  Authorization: Bearer <jwt_token>
  Accept: application/json
  ```
* Hanya endpoint `POST /api/login` dan `POST /api/mobile/login` yang dapat diakses tanpa token.
* **Alur di Flutter saat Login:**
  1. Panggil `POST /api/mobile/login` -> dapatkan `token`.
  2. Simpan `token` ke `flutter_secure_storage`.
  3. Baru panggil `GET /api/mobile/master-data` dengan menyertakan `Authorization: Bearer $token`.

### B. Aturan Validasi Input Ketat (Strict Input Validation)
Backend akan menolak request dengan status `400 Bad Request` apabila:
1. **`client_uuid`**: Tidak dikirim atau tidak sesuai format `^[a-zA-Z0-9_-]{8,64}$` (wajib gunakan UUID v4 standar, contoh: `e4b10b0a-7b3b-4177-8c54-47f6920d0f41`).
2. **`nik` (Data Karyawan)**: Jika diisi, wajib hanya berisi angka `8` hingga `20` digit (`^\d{8,20}$`). **Jangan** kirim spasi, tanda strip (`-`), atau titik. Pastikan input NIK di Flutter menggunakan `FilteringTextInputFormatter.digitsOnly`.
3. **`branch_id`**: Wajib berupa ID cabang valid yang ada di tabel `branches`.
4. **File Foto (`photos`)**:
   * Maksimal **5 file** per request, ukuran maksimal **10 MB** per file.
   * Ekstensi nama file wajib `.jpg`, `.jpeg`, `.png`, atau `.webp`.
   * Backend melakukan **Inspeksi Magic Bytes Biner** (header heksadesimal file). File yang bukan gambar asli (meskipun berekstensi `.jpg`) akan langsung ditolak (`400 Bad Request`) dan dihapus.

### C. Rate Limiting (Anti Brute-Force & Anti Flooding)
* **Login (`/api/login` & `/api/mobile/login`)**: Maksimal **10 percobaan gagal per 15 menit**. Jika menerima status `429 Too Many Requests`, tampilkan pesan dari `response.data['message']` dan kunci tombol login sementara.
* **Endpoint Sync (`/api/mobile/sync/*`)**: Maksimal **120 request per menit**. Di Flutter, lakukan pengiriman antrean offline secara **berurutan (sequential `for ... await`)**, jangan gunakan `Future.wait` paralel puluhan item sekaligus.

### D. Pencabutan Akses Instan (Instant Account Revocation)
* Backend memverifikasi keberadaan akun dan role secara *live* di database pada setiap request.
* Jika akun staf dihapus oleh Master Admin di web, atau token telah kedaluwarsa (masa aktif 24 jam), server akan merespons **`401 Unauthorized`** atau **`403 Forbidden`**.

---

## 2. Standar Keamanan Wajib di Sisi Aplikasi Android (Flutter)

Karena aplikasi ini menangani **data sensitif karyawan (NIK, gaji, nomor telepon, alamat)** dan berjalan di HP staf lapangan, terapkan 5 pengamanan berikut di codebase Flutter:

### 1. Batasi Cleartext HTTP Hanya ke IP Tailscale ZimaOS (`network_security_config.xml`)
**JANGAN** gunakan `android:usesCleartextTraffic="true"` secara polos di `AndroidManifest.xml` karena itu mengizinkan koneksi HTTP tidak terenkripsi ke seluruh internet.

Buat file `android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Matikan HTTP secara default untuk semua domain publik -->
    <base-config cleartextTrafficPermitted="false" />

    <!-- Izinkan HTTP HANYA untuk IP Tailscale ZimaOS & Local Emulator -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">100.103.255.45</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
    </domain-config>
</network-security-config>
```

Lalu daftarkan di `android/app/src/main/AndroidManifest.xml`:
```xml
<application
    android:label="HRGA Mobile"
    android:name="${applicationName}"
    android:icon="@mipmap/ic_launcher"
    android:allowBackup="false"
    android:fullBackupContent="false"
    android:networkSecurityConfig="@xml/network_security_config">
```
> **Penting:** Pastikan `android:allowBackup="false"` dan `android:fullBackupContent="false"` dipasang agar database SQLite lokal yang berisi NIK karyawan tidak bisa diekstrak melalui `adb backup` atau Google Drive backup!

---

### 2. Simpan Token dengan `flutter_secure_storage` (Hardware Keystore)
Jangan pernah menyimpan token JWT atau kredensial di `SharedPreferences`. Gunakan `flutter_secure_storage` dengan opsi `EncryptedSharedPreferences`:

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureTokenStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
  );

  static const _keyToken = 'auth_jwt_token';
  static const _keyUser = 'auth_user_json';

  static Future<void> saveToken(String token) =>
      _storage.write(key: _keyToken, value: token);

  static Future<String?> getToken() =>
      _storage.read(key: _keyToken);

  static Future<void> clearSession() =>
      _storage.deleteAll();
}
```

---

### 3. Pembersihan Otomatis Data Pribadi Karyawan (PII Scrubbing) Setelah Sync
Data karyawan seperti **NIK, Gaji (`salary_offered`), Tunjangan (`allowance`), dan Alamat** sangat sensitif. Jika HP staf hilang atau dicuri, data yang sudah selesai disinkronkan **tidak boleh** terus menumpuk dalam bentuk plaintext di SQLite HP.

**Aturan Wajib di Flutter Sync Service:**
1. Gunakan `sqflite_sqlcipher` untuk mengenkripsi database lokal SQLite di HP, **ATAU**:
2. Segera setelah `POST /api/mobile/sync/employee` mengembalikan `201 Created` / `200 OK`:
   - Hapus record tersebut dari tabel `local_employees` di HP, atau kosongkan kolom sensitif (`nik = NULL, salary_offered = 0, allowance = 0, address_domicile = NULL`) dan hanya sisakan `name`, `access_code`, dan `sync_status = 'synced'`.
3. Segera setelah foto aset/kunjungan/insiden berhasil di-sync (`201`/`200`), hapus file foto kompresi sementara di folder cache HP (`File(path).delete()`) agar memori HP tidak penuh dan foto audit tidak tercecer di galeri HP.

---

### 4. Penanganan Token Kedaluwarsa (`401` / `403`) Saat Sinkronisasi Offline
Token JWT memiliki masa berlaku **24 jam**. Jika staf menginput data secara offline di hari Sabtu dan baru melakukan sinkronisasi di hari Senin:

* **JANGAN** menghapus data di tabel lokal (`pending_sync`) saat menerima respons `401 Unauthorized` atau `403 Forbidden`!
* **Alur yang Benar di Dio Interceptor / Sync Engine:**
  ```dart
  if (response?.statusCode == 401 || response?.statusCode == 403) {
    // 1. Hentikan loop sinkronisasi sementara (data lokal tetap berstatus 'pending_sync')
    // 2. Hapus token lama yang sudah expired dari SecureTokenStorage
    await SecureTokenStorage.clearSession();
    // 3. Tampilkan halaman/modal Login Ulang dengan pesan:
    //    "Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan sinkronisasi data."
    // 4. Setelah login berhasil, otomatis jalankan kembali SyncService.syncAllPending()
  }
  ```

---

### 5. Proteksi Layar & Input Sensitif
* Pada halaman **Form Input Karyawan Baru**:
  - Gunakan `FilteringTextInputFormatter.digitsOnly` pada input `nik`, `phone`, `salary_offered`, dan `allowance`.
  - Pastikan tidak ada log `print()` atau `debugPrint()` di mode rilis (`kReleaseMode`) yang mencetak payload JSON karyawan (NIK/Gaji) atau token JWT ke `logcat` Android.

---

## 3. Ringkasan Endpoint & Status Keamanan Server Saat Ini

| Endpoint | Method | Auth Wajib? | Rate Limit | Proteksi Tambahan |
| :--- | :--- | :---: | :--- | :--- |
| `/api/mobile/login`<br>`/api/login` | `POST` | Tidak | 10 req / 15 mnt | PBKDF2-HMAC-SHA512 (210k iterasi) + Timing-Safe Equal |
| `/api/mobile/master-data`<br>`/api/master-data` | `GET` | **YA (`Bearer`)** | 120 req / mnt | Live Account & Role Verification |
| `/api/mobile/sync/asset`<br>`/api/sync/asset` | `POST` | **YA (`Bearer`)** | 120 req / mnt | UUID Regex + Magic Bytes Image Check + Orphan File Cleanup + Audit Log |
| `/api/mobile/sync/visit`<br>`/api/sync/visit` | `POST` | **YA (`Bearer`)** | 120 req / mnt | UUID Regex + Score Clamping (0-100) + Magic Bytes Check + Audit Log |
| `/api/mobile/sync/incident`<br>`/api/sync/incident` | `POST` | **YA (`Bearer`)** | 120 req / mnt | UUID Regex + Enum Whitelist + Magic Bytes Check + Audit Log |
| `/api/mobile/sync/employee`<br>`/api/sync/employee` | `POST` | **YA (`Bearer`)** | 120 req / mnt | NIK Digit Check + **AES-256-GCM Encryption at Rest** + Blind Index + Audit Log |
| `/api/mobile/assets`<br>`/api/assets` | `GET` | **YA (`Bearer`)** | 120 req / mnt | Parameterized SQL + Limit 100 |
| `/api/mobile/employees`<br>`/api/employees` | `GET` | **YA (`Bearer`)** | 120 req / mnt | **PII Minimized** (Tidak pernah mengembalikan NIK, Gaji, Rekening, atau Alamat KTP) |
