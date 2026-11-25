# Panduan Integrasi & Refactoring Koneksi API Flutter (HRMv2 Mobile API v2.0)

Dokumen ini dirancang sebagai acuan tunggal untuk merapikan koneksi REST API di **project aplikasi Flutter** agar terhubung 100% stabil ke **Backend HRMv2** (versi 2.0, termasuk modul HRGA offline sync & modul adaptasi SunFish HR).

> **Catatan Keamanan:** Seluruh dokumen lain (`ANDROID_SECURITY_AND_SYNC_GUIDE.md` & `FLUTTER_HRGA_SPEC.md`) tetap relevan, namun **kontrak path & client API terbaru mengacu pada dokumen ini**.

---

## 1. Masalah Koneksi Lama & Aturan Wajib di Flutter

Agar koneksi API di Flutter tidak lagi berantakan atau terkena error `401`, `403`, `404`, maupun ID tidak cocok, ikuti 5 aturan baku ini:

1. **Satu Base URL Tunggal Berakhiran `/api` (Tanpa Trailing Slash `/`):**
   - Contoh benar: `http://100.103.255.45:5002/api` atau `http://10.0.2.2:5002/api` atau `https://hr.domainanda.com/api`.
   - Seluruh path endpoint di Dart selalu dimulai dengan `/mobile/...`.
   - Jangan lagi memanggil route web (`/employees`, `/assets`, `/leaves`, `/attendance`) karena route web terikat role/middleware yang berbeda.
2. **Normalisasi Base URL Dinamis:**
   - Selalu bersihkan spasi dan trailing `/` dari input pengaturan server (`url.trim().replaceAll(RegExp(r'/+$'), '')`), dan jika user lupa mengetik `/api` di ujung, tambahkan `/api` otomatis.
   - Tes koneksi ke server menggunakan `GET /mobile/health` (**tanpa token**).
3. **Verifikasi Sesi Saat Aplikasi Dibuka:**
   - Jika token JWT masih tersimpan di `FlutterSecureStorage`, panggil `GET /mobile/me` saat splash screen untuk cek validitas token sekaligus mengambil `role` & `permissions` (`can_approve`, `can_manage_loans`).
4. **Gunakan `employee_id`, Bukan `server_id` (Candidate ID), untuk Modul HR:**
   - Saat mendaftarkan karyawan baru via `POST /mobile/sync/employee`, response sekarang mengembalikan **`employee_id`** dan **`candidate_id`** sekaligus (`server_id` dipertahankan sebagai alias `candidate_id` untuk kompatibilitas mundur).
   - Gunakan `employee_id` (atau `id` dari `GET /mobile/employees`) untuk **Check-in Absensi, Pengajuan Cuti, Lembur, dan Reimbursement**.
5. **Android Cleartext HTTP & Flutter Web CORS:**
   - Untuk APK Android, daftarkan IP LAN / Tailscale di `android/app/src/main/res/xml/network_security_config.xml` (lihat `ANDROID_SECURITY_AND_SYNC_GUIDE.md`).
   - Jika debug memakai **Flutter Web (Chrome)** saat server HRMv2 berjalan dengan `NODE_ENV=production`, isi `CORS_ORIGIN` pada file `.env` server (misalnya `CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080`).

---

## 2. Kontrak Lengkap Endpoint Mobile API v2.0

Semua endpoint di bawah ini dipanggil relatif terhadap `<BASE_URL>` (yang sudah berakhir `/api`).

| Fitur | Method & Path | Auth | Role | Keterangan |
| :--- | :--- | :---: | :--- | :--- |
| **Health Check** | `GET /mobile/health` | Tidak | Publik | Tes konektivitas server & versi API (`2.0`) |
| **Login** | `POST /mobile/login` | Tidak | Publik | Body JSON `{ username, password }`. Limit 10x / 15 mnt |
| **Profil Sesi** | `GET /mobile/me` | Bearer | All | Ambil `id`, `username`, `role`, `permissions` |
| **Master Data** | `GET /mobile/master-data` | Bearer | All | Cabang (+ `latitude`, `longitude`, `geofence_radius_m`), dropdown aset/visit/insiden, `leave_types`, `reimbursement_categories`, `shift_cutoffs` |
| **Stream Foto** | `GET /mobile/photos/:filename` | Bearer / `?token=` | All | Ambil foto aset / kunjungan / insiden / struk |
| **Sync Aset** | `POST /mobile/sync/asset` | Bearer | All | Multipart `photos` (maks 5), `client_uuid`, `name`, `category`, `branch_id` |
| **Sync Visit GA** | `POST /mobile/sync/visit` | Bearer | All | Multipart `photos` (maks 5), `client_uuid`, `branch_id`, `visitor_name`, `purpose` |
| **Sync Insiden** | `POST /mobile/sync/incident` | Bearer | All | Multipart `photos` (maks 5), `client_uuid`, `branch_id`, `category`, `title`, `description`, `reported_by` |
| **Sync Karyawan** | `POST /mobile/sync/employee` | Bearer | All | JSON, idempotent via `client_uuid`, kembalikan `employee_id` & `candidate_id` |
| **Daftar Aset** | `GET /mobile/assets` | Bearer | All | Query optional: `branch_id`, `category`, `search`, `limit`, `offset` |
| **Daftar Karyawan** | `GET /mobile/employees` | Bearer | All | Query optional: `branch_id`, `search`, `limit`, `offset` (PII-minimized) |
| **Check-in Absen** | `POST /mobile/attendance/checkin` | Bearer | All | Multipart (`photo` opsional) / JSON. Validasi GPS Geofence cabang |
| **Absen Hari Ini** | `GET /mobile/attendance/today` | Bearer | All | Query optional: `date` (`YYYY-MM-DD`, default hari ini), `branch_id` |
| **Riwayat Absen** | `GET /mobile/attendance/history` | Bearer | All | Query wajib: `employee_id`, optional: `period` (`YYYY-MM`) |
| **Jenis Cuti** | `GET /mobile/leaves/types` | Bearer | All | Daftar jenis cuti aktif |
| **Saldo Cuti** | `GET /mobile/leaves/balances` | Bearer | All | Query optional: `year`, `branch_id`, `employee_id` |
| **Daftar Cuti** | `GET /mobile/leaves/requests` | Bearer | All | Query optional: `status`, `employee_id`, `branch_id`, `year` |
| **Ajukan Cuti** | `POST /mobile/leaves/requests` | Bearer | All | Body `{ employee_id, leave_type_id, start_date, end_date, reason }` |
| **Approve/Tolak Cuti** | `PUT /mobile/leaves/requests/:id/approve`<br>`PUT /mobile/leaves/requests/:id/reject` | Bearer | Finance / Master | Optional body `{ approval_notes }` |
| **Batal Cuti** | `PUT /mobile/leaves/requests/:id/cancel` | Bearer | Pending: All<br>Approved: Finance/Master | Batalkan cuti & kembalikan kuota/absensi |
| **Lembur** | `GET /mobile/overtime`<br>`POST /mobile/overtime` | Bearer | All | POST `{ employee_id, date, hours, day_type: 'weekday'|'holiday', reason }` |
| **Approve/Tolak Lembur** | `PUT /mobile/overtime/:id/approve`<br>`PUT /mobile/overtime/:id/reject` | Bearer | Finance / Master | Persetujuan lembur (PP 35/2021 otomatis ke Payroll) |
| **Reimbursement** | `GET /mobile/reimbursements`<br>`POST /mobile/reimbursements` | Bearer | All | POST Multipart (`receipt` foto struk opsional) / JSON: `employee_id`, `claim_date`, `category`, `amount`, `description` |
| **Approve/Tolak Klaim** | `PUT /mobile/reimbursements/:id/approve`<br>`PUT /mobile/reimbursements/:id/reject` | Bearer | Finance / Master | Approve mendukung optional `{ payroll_period: 'YYYY-MM' }` |

### Format Payload Penting (SunFish Mobile Endpoints)

#### 1. `GET /mobile/health`
```json
{
  "success": true,
  "status": "ok",
  "api_version": "2.0",
  "server_time": "2026-11-25T16:30:00.000Z",
  "features": ["offline_sync", "geofence_checkin", "leaves", "overtime", "reimbursements"]
}
```

#### 2. `POST /mobile/sync/employee`
Request JSON:
```json
{
  "client_uuid": "e4b10b0a-7b3b-4177-8c54-47f6920d0f41",
  "name": "Rina Sari",
  "nik": "3201010101980001",
  "gender": "Perempuan",
  "phone": "081234567890",
  "branch_id": 1,
  "hire_date": "2026-11-25",
  "contract_type": "PKWT",
  "employee_type": "Frontliner",
  "position": "Kasir",
  "salary_offered": 3000000,
  "allowance": 200000
}
```
Response (`201 Created` / `200 OK`):
```json
{
  "success": true,
  "message": "Karyawan berhasil terdaftar di sistem.",
  "data": {
    "server_id": 45,
    "candidate_id": 45,
    "employee_id": 88,
    "access_code": "MAN-AB12CD34",
    "client_uuid": "e4b10b0a-7b3b-4177-8c54-47f6920d0f41"
  }
}
```

#### 3. `POST /mobile/attendance/checkin`
`multipart/form-data` (atau `application/json` jika tanpa foto):
- `employee_id`: `88` (wajib, ID tabel `employees`)
- `shift`: `"Pagi"` atau `"Siang"`
- `latitude`: `-6.200150` (wajib jika cabang memiliki koordinat GPS)
- `longitude`: `106.816700`
- `notes`: `"Shift pagi normal"` (opsional)
- `photo`: File JPEG/PNG/WEBP foto selfie (opsional)

Jika jarak di luar radius geofence cabang (`400 Bad Request`):
```json
{
  "success": false,
  "code": "OUTSIDE_GEOFENCE",
  "distance_m": 420,
  "max_radius_m": 100,
  "message": "Lokasi Anda berada 420 meter dari cabang Outlet Mawar (batas maksimal 100 meter)."
}
```

### Tabel Kode Error Standar (`response.data['code']`)
| HTTP Status | `code` | Penyebab | Tindakan di Flutter |
| :---: | :--- | :--- | :--- |
| `401` | `TOKEN_MISSING` | Header Authorization tidak terkirim | Cek SecureStorage, arahkan ke Login |
| `401` | `ACCOUNT_INACTIVE` | Akun admin dihapus/dinonaktifkan | Clear token & arahkan ke Login (jangan hapus data sync lokal!) |
| `403` | `TOKEN_INVALID` | JWT kadaluarsa (>24 jam) atau secret berubah | Clear token, minta login ulang, lalu lanjutkan sync queue |
| `403` | `FORBIDDEN_ROLE` | Akun `staff` mencoba aksi khusus `finance`/`master` | Tampilkan pesan hak akses tidak cukup (JANGAN logout user) |
| `400` | `OUTSIDE_GEOFENCE` | Posisi GPS melebihi radius cabang | Tampilkan jarak (`distance_m`) & tombol coba ambil lokasi ulang |
| `429` | *(rate limit)* | Melebihi 10x login / 15 menit atau 120 req / menit | Tahan request & tampilkan pesan cooldown |

---

## 3. Template Kode Dart Siap Pakai (`dio` + `flutter_secure_storage`)

Pastikan `pubspec.yaml` memiliki minimal dependensi:
```yaml
dependencies:
  dio: ^5.7.0
  flutter_secure_storage: ^9.2.2
  shared_preferences: ^2.3.2
  uuid: ^4.5.1
```

### A. `lib/core/network/api_config.dart`
```dart
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String _prefKeyBaseUrl = 'hrm_api_base_url';

  // Default fallback saat aplikasi pertama kali di-install
  static const String defaultBaseUrl = 'http://100.103.255.45:5002/api';
  static const String emulatorBaseUrl = 'http://10.0.2.2:5002/api';

  // --- Endpoint Canonical v2.0 (selalu relatif terhadap Base URL /api) ---
  static const String health = '/mobile/health';
  static const String login = '/mobile/login';
  static const String me = '/mobile/me';
  static const String masterData = '/mobile/master-data';
  static const String assets = '/mobile/assets';
  static const String employees = '/mobile/employees';

  static const String syncAsset = '/mobile/sync/asset';
  static const String syncVisit = '/mobile/sync/visit';
  static const String syncIncident = '/mobile/sync/incident';
  static const String syncEmployee = '/mobile/sync/employee';

  static const String attendanceCheckin = '/mobile/attendance/checkin';
  static const String attendanceToday = '/mobile/attendance/today';
  static const String attendanceHistory = '/mobile/attendance/history';

  static const String leaveTypes = '/mobile/leaves/types';
  static const String leaveBalances = '/mobile/leaves/balances';
  static const String leaveRequests = '/mobile/leaves/requests';

  static const String overtime = '/mobile/overtime';
  static const String reimbursements = '/mobile/reimbursements';

  static String photoUrl(String filename, String token) {
    final cleanName = Uri.encodeComponent(filename);
    final cleanToken = Uri.encodeQueryComponent(token);
    return '/mobile/photos/$cleanName?token=$cleanToken';
  }

  /// Normalisasi URL input pengguna agar selalu berakhiran `/api` tanpa slash penutup.
  static String normalizeBaseUrl(String raw) {
    var url = raw.trim().replaceAll(RegExp(r'/+$'), '');
    if (url.isEmpty) return defaultBaseUrl;
    if (!url.endsWith('/api')) {
      url = '$url/api';
    }
    return url;
  }

  static Future<String> getSavedBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefKeyBaseUrl);
    if (saved == null || saved.trim().isEmpty) return defaultBaseUrl;
    return normalizeBaseUrl(saved);
  }

  static Future<String> saveBaseUrl(String raw) async {
    final normalized = normalizeBaseUrl(raw);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKeyBaseUrl, normalized);
    return normalized;
  }
}
```

### B. `lib/core/network/api_exception.dart`
```dart
import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;
  final Map<String, dynamic>? rawData;

  ApiException(this.message, {this.statusCode, this.code, this.rawData});

  bool get isAuthExpired =>
      statusCode == 401 ||
      (statusCode == 403 && code != 'FORBIDDEN_ROLE');

  bool get isForbiddenRole => statusCode == 403 && code == 'FORBIDDEN_ROLE';
  bool get isOutsideGeofence => code == 'OUTSIDE_GEOFENCE';

  factory ApiException.fromDioError(DioException e) {
    final status = e.response?.statusCode;
    final data = e.response?.data;

    if (data is Map<String, dynamic>) {
      return ApiException(
        data['message']?.toString() ?? 'Permintaan gagal ($status)',
        statusCode: status,
        code: data['code']?.toString(),
        rawData: data,
      );
    }

    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException('Koneksi ke server timeout. Periksa jaringan/VPN Tailscale.', statusCode: status);
      case DioExceptionType.connectionError:
        return ApiException('Tidak dapat terhubung ke server HRMv2. Pastikan server aktif dan Base URL benar.');
      default:
        return ApiException(e.message ?? 'Terjadi kesalahan jaringan.', statusCode: status);
    }
  }

  @override
  String toString() => message;
}
```

### C. `lib/core/network/api_client.dart`
```dart
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_config.dart';

class SecureTokenStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const _keyToken = 'hrm_jwt_token';
  static const _keyUserJson = 'hrm_user_json';

  static Future<void> saveToken(String token) => _storage.write(key: _keyToken, value: token);
  static Future<String?> getToken() => _storage.read(key: _keyToken);
  static Future<void> saveUserJson(String jsonStr) => _storage.write(key: _keyUserJson, value: jsonStr);
  static Future<String?> getUserJson() => _storage.read(key: _keyUserJson);
  static Future<void> clearSession() async {
    await _storage.delete(key: _keyToken);
    await _storage.delete(key: _keyUserJson);
  }
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  Dio? _dio;
  VoidCallback? onSessionExpired;

  Future<Dio> get dio async {
    if (_dio != null) return _dio!;
    final baseUrl = await ApiConfig.getSavedBaseUrl();
    _dio = _buildDio(baseUrl);
    return _dio!;
  }

  Future<void> updateBaseUrl(String rawUrl) async {
    final normalized = await ApiConfig.saveBaseUrl(rawUrl);
    _dio = _buildDio(normalized);
  }

  Dio _buildDio(String baseUrl) {
    final d = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: const {'Accept': 'application/json'},
    ));

    d.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Endpoint publik tanpa header token wajib
        final path = options.path;
        if (path != ApiConfig.health && path != ApiConfig.login) {
          final token = await SecureTokenStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
        }
        handler.next(options);
      },
      onError: (err, handler) async {
        final status = err.response?.statusCode;
        final data = err.response?.data;
        final code = data is Map ? data['code']?.toString() : null;
        final isLoginCall = err.requestOptions.path == ApiConfig.login;

        // Jangan logout pada 403 FORBIDDEN_ROLE atau login gagal; hanya pada token invalid/expired
        final sessionInvalid = !isLoginCall &&
            (status == 401 || (status == 403 && code != 'FORBIDDEN_ROLE'));
        if (sessionInvalid) {
          await SecureTokenStorage.clearSession();
          onSessionExpired?.call();
        }
        handler.next(err);
      },
    ));

    return d;
  }
}
```

### D. `lib/services/auth_service.dart`
```dart
import 'dart:convert';
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_config.dart';
import '../core/network/api_exception.dart';

class AuthService {
  final ApiClient _client = ApiClient.instance;

  /// Cek apakah server hidup dan versi API sesuai (tanpa auth).
  Future<Map<String, dynamic>> checkHealth({String? testBaseUrl}) async {
    try {
      final d = testBaseUrl != null
          ? Dio(BaseOptions(
              baseUrl: ApiConfig.normalizeBaseUrl(testBaseUrl),
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 8),
            ))
          : await _client.dio;
      final res = await d.get(ApiConfig.health);
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final d = await _client.dio;
      final res = await d.post(ApiConfig.login, data: {
        'username': username.trim(),
        'password': password,
      });
      final body = Map<String, dynamic>.from(res.data as Map);
      final token = body['token']?.toString();
      if (token == null || token.isEmpty) {
        throw ApiException('Token tidak diterima dari server.');
      }
      await SecureTokenStorage.saveToken(token);
      if (body['user'] != null) {
        await SecureTokenStorage.saveUserJson(jsonEncode(body['user']));
      }
      return body;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  /// Validasi token saat buka aplikasi & ambil permissions terbaru.
  Future<Map<String, dynamic>> getMe() async {
    try {
      final d = await _client.dio;
      final res = await d.get(ApiConfig.me);
      return Map<String, dynamic>.from(res.data['data'] as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> logout() => SecureTokenStorage.clearSession();
}
```

### E. `lib/services/sync_service.dart` (Sequential Offline Sync + Idempotent)
```dart
import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../core/network/api_client.dart';
import '../core/network/api_config.dart';
import '../core/network/api_exception.dart';

class SyncService {
  static const _uuid = Uuid();
  final ApiClient _client = ApiClient.instance;

  static String generateClientUuid() => _uuid.v4();

  Future<Map<String, dynamic>> syncAsset({
    required Map<String, dynamic> fields,
    List<String> photoPaths = const [],
  }) async {
    return _postMultipart(ApiConfig.syncAsset, 'photos', fields, photoPaths);
  }

  Future<Map<String, dynamic>> syncVisit({
    required Map<String, dynamic> fields,
    List<String> photoPaths = const [],
  }) async {
    return _postMultipart(ApiConfig.syncVisit, 'photos', fields, photoPaths);
  }

  Future<Map<String, dynamic>> syncIncident({
    required Map<String, dynamic> fields,
    List<String> photoPaths = const [],
  }) async {
    return _postMultipart(ApiConfig.syncIncident, 'photos', fields, photoPaths);
  }

  /// Kembalikan `data` berisi `employee_id`, `candidate_id`, `server_id`, `access_code`.
  /// Setelah sukses, scrub kolom sensitif (NIK/gaji/alamat) di SQLite lokal!
  Future<Map<String, dynamic>> syncEmployee(Map<String, dynamic> payload) async {
    try {
      final d = await _client.dio;
      final res = await d.post(ApiConfig.syncEmployee, data: {
        ...payload,
        'client_uuid': payload['client_uuid'] ?? generateClientUuid(),
      });
      return Map<String, dynamic>.from(res.data['data'] as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> _postMultipart(
    String path,
    String fileField,
    Map<String, dynamic> fields,
    List<String> photoPaths,
  ) async {
    try {
      final d = await _client.dio;
      final map = Map<String, dynamic>.from(fields);
      map['client_uuid'] ??= generateClientUuid();

      if (photoPaths.isNotEmpty) {
        final files = <MultipartFile>[];
        for (final p in photoPaths.take(5)) {
          files.add(await MultipartFile.fromFile(p));
        }
        map[fileField] = files;
      }

      final res = await d.post(path, data: FormData.fromMap(map));
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}
```

### F. `lib/services/hr_mobile_service.dart` (Master Data, Geofence Check-in, Cuti, Lembur, Klaim)
```dart
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_config.dart';
import '../core/network/api_exception.dart';

class HrMobileService {
  final ApiClient _client = ApiClient.instance;

  Future<Map<String, dynamic>> getMasterData() async {
    try {
      final d = await _client.dio;
      final res = await d.get(ApiConfig.masterData);
      return Map<String, dynamic>.from(res.data['data'] as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<dynamic>> getEmployees({int? branchId, String? search, int limit = 100}) async {
    try {
      final d = await _client.dio;
      final res = await d.get(ApiConfig.employees, queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        'limit': limit,
      });
      return List<dynamic>.from(res.data['data'] as List);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<dynamic>> getAssets({int? branchId, String? category, String? search}) async {
    try {
      final d = await _client.dio;
      final res = await d.get(ApiConfig.assets, queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        if (category != null && category.isNotEmpty) 'category': category,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      });
      return List<dynamic>.from(res.data['data'] as List);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  /// Check-in absensi dengan GPS Geofence cabang & foto selfie opsional.
  Future<Map<String, dynamic>> checkInAttendance({
    required int employeeId,
    required String shift, // 'Pagi' | 'Siang'
    double? latitude,
    double? longitude,
    String? notes,
    String? selfiePath,
  }) async {
    try {
      final d = await _client.dio;
      final map = <String, dynamic>{
        'employee_id': employeeId,
        'shift': shift,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      };
      if (selfiePath != null && selfiePath.isNotEmpty) {
        map['photo'] = await MultipartFile.fromFile(selfiePath);
      }
      final res = await d.post(
        ApiConfig.attendanceCheckin,
        data: selfiePath != null ? FormData.fromMap(map) : map,
      );
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<dynamic>> getAttendanceToday({int? branchId}) async {
    try {
      final d = await _client.dio;
      final res = await d.get(ApiConfig.attendanceToday, queryParameters: {
        if (branchId != null) 'branch_id': branchId,
      });
      return List<dynamic>.from(res.data['data'] as List);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<dynamic>> getAttendanceHistory(int employeeId, {String? period}) async {
    try {
      final d = await _client.dio;
      final res = await d.get(ApiConfig.attendanceHistory, queryParameters: {
        'employee_id': employeeId,
        if (period != null) 'period': period,
      });
      return List<dynamic>.from(res.data['data'] as List);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<dynamic>> getLeaveRequests({int? employeeId, String? status}) async {
    try {
      final d = await _client.dio;
      final res = await d.get(ApiConfig.leaveRequests, queryParameters: {
        if (employeeId != null) 'employee_id': employeeId,
        if (status != null) 'status': status,
      });
      return List<dynamic>.from(res.data['data'] as List);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> submitLeave({
    required int employeeId,
    required int leaveTypeId,
    required String startDate,
    required String endDate,
    String reason = '',
  }) async {
    try {
      final d = await _client.dio;
      final res = await d.post(ApiConfig.leaveRequests, data: {
        'employee_id': employeeId,
        'leave_type_id': leaveTypeId,
        'start_date': startDate,
        'end_date': endDate,
        'reason': reason,
      });
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> submitOvertime({
    required int employeeId,
    required String date,
    required double hours,
    String dayType = 'weekday',
    String reason = '',
  }) async {
    try {
      final d = await _client.dio;
      final res = await d.post(ApiConfig.overtime, data: {
        'employee_id': employeeId,
        'date': date,
        'hours': hours,
        'day_type': dayType,
        'reason': reason,
      });
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> submitReimbursement({
    required int employeeId,
    required String claimDate,
    required String category,
    required num amount,
    String description = '',
    String? receiptPath,
  }) async {
    try {
      final d = await _client.dio;
      final map = <String, dynamic>{
        'employee_id': employeeId,
        'claim_date': claimDate,
        'category': category,
        'amount': amount,
        'description': description,
      };
      if (receiptPath != null && receiptPath.isNotEmpty) {
        map['receipt'] = await MultipartFile.fromFile(receiptPath);
      }
      final res = await d.post(
        ApiConfig.reimbursements,
        data: receiptPath != null ? FormData.fromMap(map) : map,
      );
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}
```

---

## 4. Langkah Eksekusi Refactor di Project Flutter

### Urutan Pengerjaan Manual
1. Hapus semua `baseUrl` yang di-hardcode di berbagai screen/provider (`http://localhost:5002`, `/api/employees`, `/api/login`, dll.) dan satukan ke `ApiConfig` + `ApiClient`.
2. Pasang callback `ApiClient.instance.onSessionExpired` pada root widget (`MyApp` / Riverpod / Bloc) untuk mengarahkan user ke layar Login jika JWT expired (`401`/`403 TOKEN_INVALID`) **tanpa menghapus data queue offline di SQLite**.
3. Pastikan Sync Queue di Flutter memproses antrean secara **berurutan** (`for (final item in queue) { await ... }`), bukan `Future.wait`, agar tidak terkena rate limit 120 req/menit.
4. Pada sinkronisasi karyawan (`syncEmployee`), simpan baik `candidate_id` maupun `employee_id` (dan hapus NIK/gaji dari SQLite lokal segera setelah `200`/`201`).
5. Tambahkan menu **Pengaturan Server** di layar Login & Pengaturan untuk menguji `AuthService().checkHealth(testBaseUrl: ...)` sebelum user login.

### Prompt Siap Pakai untuk Project Flutter
Jika Anda membuka project Flutter di editor/agent lain, copy-paste seluruh file ini (`FLUTTER_API_INTEGRATION_GUIDE.md`) atau berikan instruksi berikut:

> *"Rapikan seluruh lapisan koneksi API di project Flutter ini mengikuti spesifikasi dan template pada `docs/FLUTTER_API_INTEGRATION_GUIDE.md` dari repo HRMv2:*
> *1. Audit semua pemanggilan `http`, `Dio`, dan konstanta URL di seluruh folder `lib/`. Kumpulkan semua hardcode URL, endpoint tanpa prefix `/mobile/`, dan duplikasi client.*
> *2. Terapkan `ApiConfig`, `ApiException`, `SecureTokenStorage`, dan `ApiClient` berbasis Dio tunggal dengan baseUrl dinamis berakhiran `/api` (tanpa trailing slash).*
> *3. Migrasikan semua repository/service autentikasi, master-data, offline sync (asset, visit, incident, employee), serta fitur HR (absensi GPS checkin, cuti, lembur, reimbursement) menggunakan `AuthService`, `SyncService`, dan `HrMobileService`.*
> *4. Pastikan setiap upload offline menyertakan `client_uuid` v4, diproses berurutan (sequential), tidak menghapus queue SQLite lokal saat mendapat 401/403 token expired, dan membersihkan PII sensitif setelah `sync/employee` sukses.*
> *5. Simpan `employee_id` (bukan `server_id` kandidat) dari response `sync/employee` untuk transaksi absensi/cuti/lembur.*
> *6. Tambahkan tes koneksi `GET /mobile/health` pada pengaturan IP server di layar login & settings, lalu jalankan `flutter analyze` dan tes."*
