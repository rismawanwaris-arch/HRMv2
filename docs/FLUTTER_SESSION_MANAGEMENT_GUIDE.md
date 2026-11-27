# Panduan Manajemen Sesi, Idle Timeout & Cache Lokal Aman (Website HRMv2 → Flutter)

Dokumen ini menjadi panduan implementasi **manajemen sesi mobile end-to-end** yang terhubung langsung dengan pengaturan keamanan di **Website HRMv2** (`Pengaturan Sistem → Pusat Koneksi & Keamanan API Mobile`).

Arsitektur ini dirancang untuk pola **Online-First + Short-Lived Cache**:
- Aplikasi tetap responsif saat koneksi lambat atau terputus sesaat.
- Data lokal tidak lagi "nyangkut selamanya" saat HP berpindah tangan, hilang, atau lama tidak dipakai.
- Admin Master di Website dapat mengatur batas waktu sesi dan memutus akses perangkat mobile secara jarak jauh (*remote revoke*).

---

## 1. Apa yang Sudah Disiapkan di Website & Backend HRMv2

### A. Pengaturan Kebijakan Sesi Dinamis (Website → Mobile)
Admin `master` dapat mengubah kebijakan berikut di Website (`Pengaturan Sistem → Kebijakan Sesi & Cache Offline Aplikasi Mobile`), dan backend otomatis mengirimkannya ke Flutter melalui `POST /api/mobile/login`, `GET /api/mobile/me`, dan `POST /api/mobile/session/refresh` dalam objek `session_policy`:

| Field `session_policy` | Default | Rentang | Fungsi di Server / Flutter |
| :--- | :---: | :---: | :--- |
| `token_ttl_hours` | `12` | `1–168` jam | Masa berlaku token JWT mobile (diterapkan server). |
| `idle_timeout_minutes` | `30` | `1–1440` mnt | **Diterapkan di server**: jika perangkat tidak melakukan request melebihi batas ini, server otomatis mencabut sesi & membalas `401 SESSION_IDLE_TIMEOUT`. |
| `app_lock_minutes` | `5` | `1–60` mnt | **Diterapkan di Flutter**: jika app masuk *background* lebih dari X menit, kunci layar dengan Biometrik (`local_auth`) atau PIN lokal. |
| `offline_cache_ttl_hours` | `24` | `1–168` jam | **Diterapkan di Flutter**: batas maksimal data cache lokal boleh ditampilkan saat offline sebelum dikunci & wajib online ulang. |
| `require_app_lock` | `true` | `bool` | Wajibkan kunci layar Biometrik/PIN saat kembali dari *background*. |
| `wipe_cache_on_logout` | `true` | `bool` | Wajibkan hapus seluruh cache lokal (*wipe*) saat logout manual, `401 SESSION_REVOKED`, atau `SESSION_IDLE_TIMEOUT`. |
| `allow_offline_read` | `true` | `bool` | Izinkan menampilkan cache sementara saat koneksi lambat/putus sesaat. Jika `false`, wajib online penuh. |
| `single_device_mode` | `false` | `bool` | **Diterapkan di server**: jika `true`, login di perangkat baru otomatis mencabut sesi perangkat lama akun yang sama. |

### B. Pelacakan Perangkat & Pencabutan Jarak Jauh (*Remote Revoke*)
- Setiap `POST /api/mobile/login` tercatat di tabel `mobile_sessions` dengan `session_id` unik, nama perangkat, platform, versi aplikasi, IP, waktu aktif terakhir, dan waktu kedaluwarsa.
- Dari Website (`Pengaturan Sistem → Sesi Perangkat Mobile Terdaftar`), Admin Master dapat:
  - Melihat seluruh perangkat yang sedang aktif / idle / dicabut.
  - Menekan **Putus Sesi** pada 1 perangkat tertentu (`POST /api/mobile-sessions/:sessionId/revoke`).
  - Menekan **Putus Semua Sesi Mobile** sekaligus (`POST /api/mobile-sessions/revoke-all`).
  - Menekan **Cabut Sesi** pada akun admin tertentu (`POST /api/admins/:id/revoke-sessions`).

---

## 2. Kontrak Endpoint Sesi Mobile (Backend API v2.0)

Semua endpoint relatif terhadap `<BASE_URL>` (berakhiran `/api`, tanpa trailing slash).

### 1. Login Mobile + Metadata Perangkat
`POST /mobile/login`

Kirim metadata perangkat opsional agar tampil rapi di panel **Sesi Perangkat Mobile Terdaftar** di Website:
```json
{
  "username": "staff_ga",
  "password": "Password123!",
  "device_id": "android-uuid-per-install",
  "device_name": "Samsung Galaxy A54",
  "platform": "android",
  "app_version": "2.1.0"
}
```

Response (`200 OK`):
```json
{
  "success": true,
  "message": "Login berhasil.",
  "token": "<signed-token>",
  "session_id": "f6b3a7f2-...",
  "expires_in": 43200,
  "expires_at": "2026-11-28T03:00:00.000Z",
  "session_policy": {
    "token_ttl_hours": 12,
    "idle_timeout_minutes": 30,
    "app_lock_minutes": 5,
    "offline_cache_ttl_hours": 24,
    "require_app_lock": true,
    "wipe_cache_on_logout": true,
    "allow_offline_read": true,
    "single_device_mode": false
  },
  "role": "staff",
  "username": "staff_ga",
  "user": {
    "id": 2,
    "username": "staff_ga",
    "name": "staff_ga",
    "role": "staff"
  }
}
```

### 2. Verifikasi Sesi & Ambil Kebijakan Terbaru (Saat Startup / Resume)
`GET /mobile/me` *(Header: `Authorization: Bearer <token>`)*

Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "staff_ga",
    "role": "staff",
    "session_id": "f6b3a7f2-...",
    "session_expires_at": "2026-11-28T03:00:00.000Z",
    "server_time": "2026-11-27T15:10:00.000Z",
    "session_policy": { "...": "..." },
    "permissions": {
      "can_approve": false,
      "can_register_employee": false,
      "can_manage_loans": false,
      "can_manage_settings": false
    }
  }
}
```

### 3. Perpanjang Sesi Aktif (*Sliding Refresh*)
`POST /mobile/session/refresh` *(Header: `Authorization: Bearer <token>`)*

Panggil endpoint ini secara senyap ketika user masih aktif menggunakan aplikasi dan sisa masa berlaku token tinggal `< 30 menit`. Server akan menerbitkan token baru + `expires_at` baru + `session_policy` terbaru tanpa memaksa user mengetik ulang password.

### 4. Logout Eksplisit
`POST /mobile/logout` *(Header: `Authorization: Bearer <token>`)*

Mencabut sesi secara instan di server. **Wajib dipanggil sebelum menghapus storage lokal** (jika sedang offline, tangkap error jaringan lalu tetap lanjutkan pembersihan lokal).

### 5. Daftar Kode Error Sesi yang Wajib Ditangani Flutter

| HTTP | `code` | Arti | Aksi Wajib di Flutter |
| :---: | :--- | :--- | :--- |
| `401` | `SESSION_IDLE_TIMEOUT` | Tidak ada aktivitas melebihi `idle_timeout_minutes` | Hapus token & **wipe cache baca lokal** (jika `wipe_cache_on_logout == true`), tampilkan pesan sesi idle habis, arahkan ke Login. |
| `401` | `SESSION_REVOKED` | Sesi dicabut admin di Website, password berubah, atau login di perangkat lain (`single_device_mode`) | Hapus token & **wipe cache baca lokal**, arahkan ke Login. |
| `401` | `TOKEN_INVALID` | Token expired (`expires_at` lewat) atau tidak valid | Hapus token & **wipe cache baca lokal**, arahkan ke Login. |
| `401` | `ACCOUNT_INACTIVE` | Akun dihapus/dinonaktifkan dari sistem | Hapus token & **wipe seluruh data lokal**, arahkan ke Login. |
| `403` | `FORBIDDEN_ROLE` | Role tidak cukup (mis. `staff` akses menu `finance`) | Tampilkan pesan hak akses (**JANGAN logout**). |

> **Catatan Antrean Offline (`pending_sync`):**
> Jika aplikasi masih memakai antrean kirim offline untuk data lapangan (aset/visit/insiden yang belum sempat terkirim karena sinyal putus), pisahkan tabelnya dari **cache baca (*read cache*)**:
> - **Cache baca** (daftar karyawan, jadwal, master data, profil) → **WAJIB DIHAPUS (*wipe*)** saat logout / `401` / melewati `offline_cache_ttl_hours`.
> - **Antrean kirim (`pending_sync`)** → simpan terenkripsi dan hanya bisa diakses kembali setelah user yang sama login ulang, atau hapus jika akun berganti / `ACCOUNT_INACTIVE`.

---

## 3. Panduan Implementasi di Flutter

### Dependensi `pubspec.yaml` yang Disarankan
```yaml
dependencies:
  dio: ^5.7.0
  flutter_secure_storage: ^9.2.2
  local_auth: ^2.3.0
  device_info_plus: ^11.1.0
  package_info_plus: ^8.1.0
  uuid: ^4.5.1
  # Jika memakai cache disk terenkripsi:
  hive_flutter: ^1.1.0
```

### A. Model `MobileSessionPolicy` (`lib/core/security/mobile_session_policy.dart`)
```dart
class MobileSessionPolicy {
  final int tokenTtlHours;
  final int idleTimeoutMinutes;
  final int appLockMinutes;
  final int offlineCacheTtlHours;
  final bool requireAppLock;
  final bool wipeCacheOnLogout;
  final bool allowOfflineRead;
  final bool singleDeviceMode;

  const MobileSessionPolicy({
    this.tokenTtlHours = 12,
    this.idleTimeoutMinutes = 30,
    this.appLockMinutes = 5,
    this.offlineCacheTtlHours = 24,
    this.requireAppLock = true,
    this.wipeCacheOnLogout = true,
    this.allowOfflineRead = true,
    this.singleDeviceMode = false,
  });

  factory MobileSessionPolicy.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const MobileSessionPolicy();
    return MobileSessionPolicy(
      tokenTtlHours: (json['token_ttl_hours'] as num?)?.toInt() ?? 12,
      idleTimeoutMinutes: (json['idle_timeout_minutes'] as num?)?.toInt() ?? 30,
      appLockMinutes: (json['app_lock_minutes'] as num?)?.toInt() ?? 5,
      offlineCacheTtlHours: (json['offline_cache_ttl_hours'] as num?)?.toInt() ?? 24,
      requireAppLock: json['require_app_lock'] != false,
      wipeCacheOnLogout: json['wipe_cache_on_logout'] != false,
      allowOfflineRead: json['allow_offline_read'] != false,
      singleDeviceMode: json['single_device_mode'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'token_ttl_hours': tokenTtlHours,
        'idle_timeout_minutes': idleTimeoutMinutes,
        'app_lock_minutes': appLockMinutes,
        'offline_cache_ttl_hours': offlineCacheTtlHours,
        'require_app_lock': requireAppLock,
        'wipe_cache_on_logout': wipeCacheOnLogout,
        'allow_offline_read': allowOfflineRead,
        'single_device_mode': singleDeviceMode,
      };
}
```

### B. Session Manager + TTL Cache Offline (`lib/core/security/session_manager.dart`)
```dart
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'mobile_session_policy.dart';

class SessionManager {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _kToken = 'hrm_jwt_token';
  static const _kExpiresAt = 'hrm_token_expires_at';
  static const _kLastSyncAt = 'hrm_last_online_sync_at';
  static const _kLastActiveAt = 'hrm_last_active_at';
  static const _kPolicy = 'hrm_session_policy';
  static const _kUser = 'hrm_user_json';

  /// Callback untuk membersihkan cache baca lokal (Hive/SQLite/RAM)
  final Future<void> Function() onWipeReadCache;

  SessionManager({required this.onWipeReadCache});

  Future<void> saveLoginResponse(Map<String, dynamic> body) async {
    final nowIso = DateTime.now().toUtc().toIso8601String();
    await _storage.write(key: _kToken, value: body['token']?.toString() ?? '');
    if (body['expires_at'] != null) {
      await _storage.write(key: _kExpiresAt, value: body['expires_at'].toString());
    }
    if (body['session_policy'] is Map) {
      await _storage.write(key: _kPolicy, value: jsonEncode(body['session_policy']));
    }
    if (body['user'] is Map) {
      await _storage.write(key: _kUser, value: jsonEncode(body['user']));
    }
    await _storage.write(key: _kLastSyncAt, value: nowIso);
    await _storage.write(key: _kLastActiveAt, value: nowIso);
  }

  Future<void> updatePolicyAndSyncTime(Map<String, dynamic>? policyJson) async {
    final nowIso = DateTime.now().toUtc().toIso8601String();
    if (policyJson != null) {
      await _storage.write(key: _kPolicy, value: jsonEncode(policyJson));
    }
    await _storage.write(key: _kLastSyncAt, value: nowIso);
    await _storage.write(key: _kLastActiveAt, value: nowIso);
  }

  Future<MobileSessionPolicy> getPolicy() async {
    final raw = await _storage.read(key: _kPolicy);
    if (raw == null || raw.isEmpty) return const MobileSessionPolicy();
    try {
      return MobileSessionPolicy.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const MobileSessionPolicy();
    }
  }

  Future<void> touchActivity() async {
    await _storage.write(key: _kLastActiveAt, value: DateTime.now().toUtc().toIso8601String());
  }

  /// Cek apakah cache baca lokal masih boleh ditampilkan saat offline
  Future<bool> isOfflineReadCacheValid() async {
    final policy = await getPolicy();
    if (!policy.allowOfflineRead) return false;
    final raw = await _storage.read(key: _kLastSyncAt);
    if (raw == null) return false;
    final lastSync = DateTime.tryParse(raw);
    if (lastSync == null) return false;
    final diff = DateTime.now().toUtc().difference(lastSync.toUtc());
    return diff.inHours < policy.offlineCacheTtlHours;
  }

  /// Cek apakah sesi lokal sudah melewati batas idle_timeout_minutes
  Future<bool> isLocallyIdleExpired() async {
    final policy = await getPolicy();
    final raw = await _storage.read(key: _kLastActiveAt);
    if (raw == null) return false;
    final lastActive = DateTime.tryParse(raw);
    if (lastActive == null) return false;
    final diff = DateTime.now().toUtc().difference(lastActive.toUtc());
    return diff.inMinutes >= policy.idleTimeoutMinutes;
  }

  Future<String?> getToken() => _storage.read(key: _kToken);

  Future<bool> shouldRefreshToken() async {
    final raw = await _storage.read(key: _kExpiresAt);
    if (raw == null) return false;
    final exp = DateTime.tryParse(raw);
    if (exp == null) return false;
    final remaining = exp.toUtc().difference(DateTime.now().toUtc());
    return remaining.inMinutes > 0 && remaining.inMinutes <= 30;
  }

  /// Logout penuh: cabut di server lalu bersihkan token & cache lokal
  Future<void> logout(Dio dio) async {
    try {
      await dio.post('/mobile/logout');
    } catch (_) {
      // Tetap lanjutkan pembersihan lokal walau sedang offline
    } finally {
      await forceLocalLogout(reason: 'user_logout');
    }
  }

  Future<void> forceLocalLogout({required String reason}) async {
    final policy = await getPolicy();
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kExpiresAt);
    await _storage.delete(key: _kLastSyncAt);
    await _storage.delete(key: _kLastActiveAt);
    await _storage.delete(key: _kUser);
    if (policy.wipeCacheOnLogout || reason == 'ACCOUNT_INACTIVE') {
      await onWipeReadCache();
    }
  }
}
```

### C. App Lifecycle Guard (`App Lock` Biometrik/PIN + Auto-Check Idle)
Pasang `WidgetsBindingObserver` di root widget aplikasi Flutter (`AppLifecycleGuard`):

```dart
import 'package:flutter/widgets.dart';
import 'package:local_auth/local_auth.dart';
import 'session_manager.dart';

class AppLifecycleGuard extends StatefulWidget {
  final Widget child;
  final SessionManager sessionManager;
  final VoidCallback onForceLogin;

  const AppLifecycleGuard({
    super.key,
    required this.child,
    required this.sessionManager,
    required this.onForceLogin,
  });

  @override
  State<AppLifecycleGuard> createState() => _AppLifecycleGuardState();
}

class _AppLifecycleGuardState extends State<AppLifecycleGuard> with WidgetsBindingObserver {
  final _localAuth = LocalAuthentication();
  DateTime? _pausedAt;
  bool _isLocked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) async {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _pausedAt ??= DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      final token = await widget.sessionManager.getToken();
      if (token == null || token.isEmpty) {
        _pausedAt = null;
        return;
      }

      // 1. Cek apakah idle sudah melebihi batas server (idle_timeout_minutes)
      if (await widget.sessionManager.isLocallyIdleExpired()) {
        await widget.sessionManager.forceLocalLogout(reason: 'SESSION_IDLE_TIMEOUT');
        _pausedAt = null;
        widget.onForceLogin();
        return;
      }

      // 2. Cek apakah perlu App Lock (Biometrik / PIN) karena di-background > app_lock_minutes
      final policy = await widget.sessionManager.getPolicy();
      if (policy.requireAppLock && _pausedAt != null) {
        final awayMinutes = DateTime.now().difference(_pausedAt!).inMinutes;
        if (awayMinutes >= policy.appLockMinutes) {
          await _unlockWithBiometricOrPin();
        }
      }
      _pausedAt = null;
    }
  }

  Future<void> _unlockWithBiometricOrPin() async {
    if (_isLocked) return;
    setState(() => _isLocked = true);
    try {
      final ok = await _localAuth.authenticate(
        localizedReason: 'Verifikasi identitas untuk melanjutkan sesi HRMv2',
        options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
      );
      if (ok) {
        await widget.sessionManager.touchActivity();
        if (mounted) setState(() => _isLocked = false);
      } else {
        await widget.sessionManager.forceLocalLogout(reason: 'APP_LOCK_FAILED');
        if (mounted) setState(() => _isLocked = false);
        widget.onForceLogin();
      }
    } catch (_) {
      // Jika perangkat tidak mendukung biometrik/PIN, fallback ke layar login ulang
      await widget.sessionManager.forceLocalLogout(reason: 'APP_LOCK_UNAVAILABLE');
      if (mounted) setState(() => _isLocked = false);
      widget.onForceLogin();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Saat _isLocked == true, tutup tampilan dengan overlay/blur agar data tidak terlihat
    return Stack(
      children: [
        widget.child,
        if (_isLocked)
          const Positioned.fill(
            child: ColoredBox(
              color: Color(0xEE0F172A),
              child: Center(
                child: Text(
                  'Aplikasi Terkunci — Verifikasi Identitas',
                  style: TextStyle(color: Color(0xFFFFFFFF), fontSize: 15),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
```

### D. Integrasi Interceptor `Dio` (Auto-Refresh + Auto-Wipe saat `401`)
Pada `InterceptorsWrapper`:
1. **`onRequest`**:
   - Panggil `sessionManager.touchActivity()`.
   - Jika `await sessionManager.shouldRefreshToken()` bernilai `true` (sisa `< 30 menit`) dan request bukan `/mobile/session/refresh`, panggil `POST /mobile/session/refresh` lebih dulu untuk memperbarui token secara senyap.
2. **`onError`**:
   - Jika `status == 401` (kode `SESSION_IDLE_TIMEOUT`, `SESSION_REVOKED`, `TOKEN_INVALID`, `ACCOUNT_INACTIVE`), panggil `await sessionManager.forceLocalLogout(reason: code ?? 'UNAUTHORIZED')` lalu arahkan ke layar Login.

---

## 4. Strategi Data Lokal di Flutter (Agar Tidak Memberatkan Server & Tetap Aman)

| Kategori Data | Penyimpanan Disarankan | Perilaku Saat Offline | Saat Logout / `401` |
| :--- | :--- | :--- | :--- |
| **Token JWT & `session_policy`** | `flutter_secure_storage` (Keystore/Keychain) | Tidak dipakai jika `isLocallyIdleExpired()` | Hapus langsung |
| **Data Sensitif** (slip gaji, NIK, detail finansial) | **RAM saja** (Riverpod/Bloc/Provider) | Tidak tersedia offline (wajib online) | Otomatis hilang saat app ditutup / logout |
| **Cache Baca Ringan** (nama cabang, jadwal hari ini, dropdown) | **Hive AES-256** (key di `flutter_secure_storage`) | Boleh dibaca hanya jika `isOfflineReadCacheValid() == true` | **Wipe total** (`onWipeReadCache`) |
| **Antrean Kirim Offline** (`pending_sync` foto/form lapangan) | SQLCipher / Hive AES terenkripsi | Disimpan sementara sampai sinyal kembali | Jangan hapus jika hanya sesi expired; hapus jika ganti akun / `ACCOUNT_INACTIVE` |

---

## 5. Checklist Pengujian End-to-End (Website ↔ Flutter)

1. **Ubah kebijakan di Website:** Masuk ke `Pengaturan Sistem → Kebijakan Sesi & Cache Offline Aplikasi Mobile`, ubah *Batas Idle Server* ke `2` menit, lalu simpan.
2. **Login dari Flutter:** Kirim `POST /mobile/login` dengan `device_name`, `platform`, `app_version`. Pastikan perangkat langsung muncul di daftar **Sesi Perangkat Mobile Terdaftar** di Website dengan status `Aktif`.
3. **Uji Remote Revoke:** Klik tombol **Putus Sesi** di Website → panggil `GET /mobile/me` dari Flutter → pastikan server membalas `401 SESSION_REVOKED` dan Flutter otomatis menghapus cache baca & kembali ke layar Login.
4. **Uji Idle Timeout:** Login lagi, diamkan aplikasi tanpa request melebihi *Batas Idle Server* → panggil API apa pun → server membalas `401 SESSION_IDLE_TIMEOUT` dan Flutter otomatis logout + bersihkan cache.
5. **Uji App Lock:** Minimize aplikasi Flutter melebihi *Kunci Layar Background* (`app_lock_minutes`) → buka kembali → pastikan layar terkunci dan meminta Biometrik/PIN.
6. **Uji Mode 1 Perangkat (`single_device_mode`):** Aktifkan checkbox di Website → login di HP A, lalu login dengan akun sama di HP B → pastikan HP A langsung ditolak `401 SESSION_REVOKED` pada request berikutnya.
