# Panduan Perbaikan Keamanan Sesi & Koneksi Aplikasi Mobile Flutter (HRMv2 Security Hardening)

Dokumen ini adalah panduan perbaikan dan migrasi untuk **project aplikasi mobile Flutter** agar sesi login, penyimpanan kredensial, pemanggilan API, dan koneksi offline-first tetap terhubung penuh ke **Backend HRMv2** setelah penerapan pembaruan keamanan (`SEC-01` s.d. `SEC-08`).

---

## 1. Ringkasan Perubahan Keamanan Backend & Dampaknya ke Flutter

| Area | Perubahan di Backend HRMv2 | Dampak & Penyesuaian Wajib di Flutter |
| :--- | :--- | :--- |
| **Autentikasi Query `?token=` Dibatasi (`SEC-02`)** | `?token=` di URL hanya diterima pada endpoint GET media/download (`/api/mobile/photos/:filename`, `/api/outlet-activity/photos/:filename`, `/api/candidates/...`). Semua endpoint JSON **wajib** memakai header `Authorization: Bearer <token>`. | Pastikan Dio **selalu** mengirim header `Authorization: Bearer <token>`. Untuk widget gambar, disarankan mengirim header `Authorization` juga agar token tidak tercatat di log URL proxy. |
| **Pencabutan Sesi Instan / `SESSION_REVOKED` (`SEC-03`)** | Ditambahkan kolom `token_version` + endpoint `POST /api/mobile/logout`, pencabutan sesi otomatis saat `POST /api/change-password`, serta pencabutan sesi jarak jauh oleh Master (`POST /api/admins/:id/revoke-sessions`). Token mobile juga kini memiliki `expires_in` & `expires_at` (default 12 jam, konfigurabel via `MOBILE_TOKEN_TTL_HOURS`). | 1. Simpan `expires_at` & cek sebelum sync.<br>2. Saat tombol Logout ditekan, panggil `POST /mobile/logout` lebih dulu sebelum menghapus storage.<br>3. Tangani error `401` (`code: SESSION_REVOKED` / `ACCOUNT_INACTIVE` / `TOKEN_MISSING`) & `403` (`code: TOKEN_INVALID`) dengan meminta login ulang **tanpa menghapus antrean offline SQLite**. |
| **Atestasi Aplikasi Mobile Opsional `X-Mobile-App-Key` (`SEC-04`)** | Jika env `MOBILE_API_KEY` diisi di server, `/api/mobile/health` menampilkan `"app_key_required": true`, dan semua endpoint `/api/mobile/*` (kecuali `/health`) wajib menyertakan header `X-Mobile-App-Key` (jika salah/kosong dibalas `403 INVALID_APP_KEY`). | Baca kunci via `--dart-define=MOBILE_API_KEY=...` saat build, dan lampirkan di header interceptor **hanya jika target host sudah lolos Host Allowlist**. |
| **RBAC Registrasi Karyawan (`SEC-04`)** | `POST /api/mobile/sync/employee` & `POST /api/sync/employee` kini dibatasi khusus role **`finance` / `master`**. Endpoint `/api/mobile/me` mengembalikan flag baru `permissions.can_register_employee`. | Sembunyikan/nonaktifkan form input karyawan baru di Flutter bila `permissions['can_register_employee'] != true`, atau tampilkan pesan hak akses saat `403 FORBIDDEN_ROLE` (jangan logout user). |
| **Anti-Tamper Absensi (`SEC-04`)** | Untuk role `staff`, `POST /api/mobile/attendance/checkin` selalu memakai **tanggal dan jam server** (nilai `date`/`check_in_time` kiriman HP diabaikan) dan koordinat GPS divalidasi (`lat` `[-90,90]`, `lng` `[-180,180]`). | Jangan mengandalkan jam lokal HP sebagai status final `Hadir`/`Terlambat`—tampilkan data `date`, `check_in_time`, dan `status` yang dikembalikan server. |
| **Dokumentasi & Header Anti-Cache (`SEC-01`, `SEC-02`)** | Route `/docs` kini terkunci khusus admin `master` (`401`/`403` untuk publik/staff). Semua respons `/api/*` menyertakan `Cache-Control: no-store` dan `Referrer-Policy: no-referrer`. | Jangan pernah membuka URL `/docs/*` langsung dari WebView publik tanpa sesi Master. |

---

## 2. Pencegahan Kebocoran API ke Sumber Tidak Dikenal

Kesalahan paling umum pada aplikasi mobile yang bisa mengubah Base URL di layar Pengaturan adalah mengirimkan `Authorization: Bearer <jwt_token>` atau `X-Mobile-App-Key` ke URL sembarangan (misal host tidak dikenal, `http://` di internet publik, atau redirect berbahaya).

Terapkan **`ApiHostGuard`** dan **`SecureDioClient`** berikut pada project Flutter:

### A. `lib/core/security/api_host_guard.dart`

```dart
class ApiHostGuard {
  /// Daftarkan HANYA host resmi server HRMv2 milik perusahaan Anda.
  static const Set<String> _allowedPublicHttpsHosts = {
    'hr.domainperusahaananda.com', // Ganti dengan domain HTTPS produksi jika sudah ada
  };

  static const Set<String> _allowedPrivateOrTailscaleHosts = {
    '100.103.255.45', // IP Tailscale server ZimaOS HRMv2
    '10.0.2.2',       // Android Emulator host loopback
    '127.0.0.1',
    'localhost',
  };

  /// Validasi & normalisasi URL agar selalu berakhir dengan `/api`
  /// dan memblokir host tak dikenal / HTTP cleartext ke domain publik.
  static Uri normalizeAndValidateBaseUrl(String rawInput) {
    var trimmed = rawInput.trim().replaceAll(RegExp(r'/+$'), '');
    if (trimmed.isEmpty) {
      trimmed = 'http://100.103.255.45:5002/api';
    }
    if (!trimmed.endsWith('/api')) {
      trimmed = '$trimmed/api';
    }

    final uri = Uri.tryParse(trimmed);
    if (uri == null || !uri.hasAuthority || uri.host.isEmpty) {
      throw const FormatException('URL server tidak valid.');
    }
    if (uri.userInfo.isNotEmpty) {
      throw const FormatException('URL server tidak boleh mengandung username/password.');
    }

    if (!isTrustedUri(uri)) {
      throw SecurityException(
        'Koneksi diblokir: host "${uri.host}" atau skema "${uri.scheme}" tidak termasuk sumber server resmi.',
      );
    }
    return uri;
  }

  /// Pastikan setiap request keluar hanya menuju host resmi dengan protokol aman.
  static bool isTrustedUri(Uri uri) {
    final host = uri.host.toLowerCase();
    if (uri.scheme == 'https') {
      return _allowedPublicHttpsHosts.contains(host) ||
          _allowedPrivateOrTailscaleHosts.contains(host);
    }
    if (uri.scheme == 'http') {
      // HTTP hanya diizinkan ke jaringan privat/Tailscale/emulator yang terdaftar eksplisit
      return _allowedPrivateOrTailscaleHosts.contains(host);
    }
    return false;
  }
}

class SecurityException implements Exception {
  final String message;
  const SecurityException(this.message);
  @override
  String toString() => message;
}
```

### B. `lib/core/network/secure_dio_client.dart`

```dart
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../security/api_host_guard.dart';
import '../security/secure_session_manager.dart';

class SecureDioClient {
  static const String _mobileAppKey = String.fromEnvironment('MOBILE_API_KEY', defaultValue: '');

  final Dio dio;
  final SecureSessionManager sessionManager;
  final VoidCallback onSessionExpired;

  SecureDioClient({
    required Uri verifiedBaseUri,
    required this.sessionManager,
    required this.onSessionExpired,
  }) : dio = Dio(
          BaseOptions(
            baseUrl: verifiedBaseUri.toString(),
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 30),
            sendTimeout: const Duration(seconds: 30),
            // Matikan auto-redirect agar token Bearer tidak pernah diteruskan ke lokasi redirect asing
            followRedirects: false,
            validateStatus: (status) => status != null && status >= 200 && status < 300,
            headers: const {'Accept': 'application/json'},
          ),
        ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final targetUri = options.uri;

          // 1. Blokir mutlak jika tujuan request bukan server resmi HRMv2
          if (!ApiHostGuard.isTrustedUri(targetUri)) {
            return handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.cancel,
                error: SecurityException(
                  'Permintaan diblokir: tidak boleh mengirim data API ke ${targetUri.host}',
                ),
              ),
            );
          }

          // 2. Lampirkan kunci app opsional (hanya ke server resmi)
          if (_mobileAppKey.isNotEmpty) {
            options.headers['X-Mobile-App-Key'] = _mobileAppKey;
          }

          // 3. Lampirkan JWT Bearer kecuali endpoint publik
          final path = targetUri.path;
          final isPublicAuth = path.endsWith('/mobile/health') || path.endsWith('/mobile/login');
          if (!isPublicAuth) {
            final token = await sessionManager.getValidToken();
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }

          return handler.next(options);
        },
        onError: (e, handler) async {
          final status = e.response?.statusCode;
          final data = e.response?.data;
          final code = data is Map ? data['code']?.toString() : null;

          // Bedakan token invalid/revoked vs role ditolak vs app key salah
          final isTokenInvalid =
              status == 401 ||
              (status == 403 && code != 'FORBIDDEN_ROLE' && code != 'INVALID_APP_KEY');

          if (isTokenInvalid) {
            // PENTING: Hanya hapus sesi lokal, JANGAN hapus antrean pending_sync di SQLite!
            await sessionManager.clearLocalSessionOnly();
            onSessionExpired();
          }

          return handler.next(e);
        },
      ),
    );
  }
}
```

---

## 3. Pengamanan Sesi, Pencabutan Token & Data Lokal di Flutter

### A. `lib/core/security/secure_session_manager.dart`

```dart
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureSessionManager {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _kToken = 'hrm_jwt_token';
  static const _kExpiresAt = 'hrm_token_expires_at';
  static const _kUser = 'hrm_user_json';
  static const _kPermissions = 'hrm_permissions_json';

  Future<void> saveLoginSession(Map<String, dynamic> loginBody) async {
    final token = loginBody['token']?.toString() ?? '';
    final expiresAt = loginBody['expires_at']?.toString() ?? '';
    final user = loginBody['user'];

    await _storage.write(key: _kToken, value: token);
    if (expiresAt.isNotEmpty) {
      await _storage.write(key: _kExpiresAt, value: expiresAt);
    }
    if (user is Map) {
      await _storage.write(key: _kUser, value: jsonEncode(user));
    }
  }

  Future<void> savePermissions(Map<String, dynamic> permissions) async {
    await _storage.write(key: _kPermissions, value: jsonEncode(permissions));
  }

  Future<String?> getValidToken() async {
    final token = await _storage.read(key: _kToken);
    if (token == null || token.isEmpty) return null;

    final expiresRaw = await _storage.read(key: _kExpiresAt);
    if (expiresRaw != null && expiresRaw.isNotEmpty) {
      final exp = DateTime.tryParse(expiresRaw);
      // Anggap habis 60 detik lebih awal untuk menghindari race saat request dikirim
      if (exp != null && DateTime.now().toUtc().isAfter(exp.toUtc().subtract(const Duration(seconds: 60)))) {
        await clearLocalSessionOnly();
        return null;
      }
    }
    return token;
  }

  /// Logout penuh: cabut token di server via POST /mobile/logout lalu bersihkan Keystore/Keychain.
  Future<void> logout(Dio dio) async {
    try {
      await dio.post('/mobile/logout');
    } catch (_) {
      // Tetap lanjut bersihkan sesi lokal walau perangkat sedang offline
    } finally {
      await clearLocalSessionOnly();
    }
  }

  Future<void> clearLocalSessionOnly() async {
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kExpiresAt);
    await _storage.delete(key: _kUser);
    await _storage.delete(key: _kPermissions);
  }
}
```

### B. Menampilkan Foto Tanpa Membocorkan Token ke URL (`?token=`)

Hindari menaruh JWT ke URL gambar di widget bila memungkinkan; kirim lewat HTTP header `Authorization`:

```dart
Image.network(
  '$baseUrl/mobile/photos/${Uri.encodeComponent(filename)}',
  headers: {
    'Authorization': 'Bearer $token',
    if (mobileAppKey.isNotEmpty) 'X-Mobile-App-Key': mobileAppKey,
  },
)
```

### C. Hardening Platform Android, iOS & Build Rilis

1. **`android/app/src/main/res/xml/network_security_config.xml`**:
   - Set `<base-config cleartextTrafficPermitted="false" />` untuk memblokir HTTP cleartext ke semua domain publik.
   - Izinkan `cleartextTrafficPermitted="true"` **hanya** untuk IP Tailscale `100.103.255.45` dan emulator `10.0.2.2` selama belum memakai HTTPS domain.
2. **`android/app/src/main/AndroidManifest.xml`**:
   - Pasang `android:allowBackup="false"` & `android:fullBackupContent="false"` agar SQLite offline tidak terambil `adb backup` / cloud backup.
   - Pasang `android:exported="false"` pada seluruh activity/service/receiver selain launcher `MainActivity`.
3. **PII Scrubbing & Layar Sensitif**:
   - Jangan pernah `print(token)` atau mencetak JSON pegawai ke console di mode rilis (`kDebugMode` guard saja, selalu redact token).
   - Kosongkan atau hapus record sensitif setelah sync sukses `200`/`201`, dan hapus file foto temp dari cache HP.
4. **Obfuscation Build Rilis**:
   ```bash
   flutter analyze
   flutter build apk --release \
     --obfuscate \
     --split-debug-info=./build/debug-info \
     --dart-define=MOBILE_API_KEY=<isi-jika-server-mengaktifkan-MOBILE_API_KEY>
   ```
   *(Simpan folder `debug-info` di luar git repository.)*

---

## 4. Checklist & Alur Uji Koneksi Mobile (Verifikasi Pasca-Perbaikan)

Jalankan urutan verifikasi berikut di aplikasi Flutter sebelum rilis:

1. **Test Host Guard (Negative Test)**: Coba masukkan URL `http://example.com/api` di Pengaturan Server -> aplikasi **wajib menolak** sebelum request keluar.
2. **Health Check**: Panggil `GET /mobile/health` ke server resmi -> pastikan status `ok`, `api_version: "2.0"`, dan cek flag `app_key_required`.
3. **Login & Cek `/mobile/me`**: Login lewat `POST /mobile/login` -> verifikasi `expires_at` tersimpan di `FlutterSecureStorage`, lalu panggil `GET /mobile/me` -> pastikan `permissions.can_register_employee` dan `permissions.can_approve` ter-apply ke UI.
4. **Offline Sync Queue + PII Check**: Kirim visit/aset lewat `POST /mobile/sync/visit` & `POST /mobile/sync/asset` dengan header `Authorization: Bearer` -> verifikasi `201 Created`, lalu pastikan `GET /mobile/employees` tidak memuat NIK/gaji/rekening.
5. **Uji Pencabutan Sesi (`SESSION_REVOKED`)**: Tekan Logout (memanggil `POST /mobile/logout`) atau ubah password / klik *Revoke Sessions* dari admin Master -> request berikutnya dengan token lama harus mendapat `401 SESSION_REVOKED`, menghapus token lokal, memunculkan layar login ulang, **tetapi tetap mempertahankan data `pending_sync` SQLite**.
6. **Uji RBAC Role `staff`**: Login sebagai `staff` dan pastikan `POST /mobile/sync/employee` ditolak `403 FORBIDDEN_ROLE` tanpa mengeluarkan user dari aplikasi.
