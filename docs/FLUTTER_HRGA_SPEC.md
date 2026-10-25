# PRD & Technical Specification: HRMv2 Mobile (Flutter Android)
**Versi:** 1.0.0  
**Tipe Arsitektur:** Offline-First Android Client + Express.js REST API  
**Fokus Modul:** Monitoring & Input Aset, Aktivitas GA (Kunjungan & Insiden), Cabang Outlet, dan Data Karyawan.

---

## 1. Arsitektur & Prinsip Kerja (Offline-First)

Aplikasi Flutter ini dirancang khusus untuk tim lapangan HRGA agar operasional tetap berjalan 100% tanpa hambatan sinyal di outlet/cabang.

```
       [ TIM LAPANGAN (FLUTTER ANDROID) ]
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
   [ MODE ONLINE ]               [ MODE OFFLINE ]
   - Cache Master Data           - Input Aset & Foto
   - Auto Sync Antrean           - Catat Kunjungan/Insiden
   - Download Data Terkini       - Input Karyawan Baru
                                 - Simpan SQLite + File Foto HP
                                 - Status: 'pending_sync'
                                         │
                                         ▼ (Ketika Online)
                       [ SYNC ENGINE / QUEUE ]
                                 │
                                 ▼ (Multipart HTTP REST API)
                    [ BACKEND EXPRESS.JS HRMV2 ]
                                 │
                                 ▼
                    [ DATABASE RECRUITMENT.DB ]
                                 │
                                 ▼
                    [ DASHBOARD WEB HRMV2 ]
```

### Aturan Utama Sinkronisasi:
1. **Identitas Unik (`client_uuid`)**: Setiap data baru yang dibuat di Flutter wajib di-generate menggunakan UUID v4. Nilai ini menjadi `Idempotency Key` di backend agar data tidak duplikat meskipun di-sync berkali-kali.
2. **Penanganan Foto**:
   - Foto kamera dikompres menggunakan `flutter_image_compress` (target ~300KB - 500KB per foto).
   - Path lokal disimpan di SQLite lokal.
   - Dikirim ke backend sebagai form-data multipart (`photos`).
3. **Status Siklus Sync (Sync State Machine)**:
   - `draft`: Masih dalam pengisian user.
   - `pending_sync`: Sudah disimpan di HP, menunggu internet untuk dikirim.
   - `syncing`: Sedang dalam proses upload HTTP.
   - `synced`: Berhasil diterima backend, server mengembalikan `server_id`.
   - `conflict`: Ditolak karena bentrok nomor/aturan, butuh tinjauan user.

---

## 2. Modul Fitur & Kamus Data (1:1 dengan Web HRMv2)

### MODUL 1: Monitoring & Manajemen Aset
Memungkinkan tim GA menginventarisasi aset di cabang, mencatat servis, mutasi antar cabang, atau penggantian aset rusak.

#### Tabel SQLite Lokal: `local_assets`
```sql
CREATE TABLE local_assets (
  client_uuid TEXT PRIMARY KEY,
  server_id INTEGER,
  asset_code TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  branch_id INTEGER NOT NULL,
  condition TEXT NOT NULL DEFAULT 'Baik',
  status TEXT NOT NULL DEFAULT 'Aktif',
  brand TEXT,
  serial_number TEXT,
  vendor_supplier TEXT,
  purchase_date TEXT,
  purchase_cost REAL DEFAULT 0,
  local_photo_paths TEXT,      -- Format JSON string: '["path/to/img1.jpg"]'
  notes TEXT,
  sync_status TEXT DEFAULT 'pending_sync', -- pending_sync | syncing | synced | conflict
  error_message TEXT,
  created_at_local TEXT NOT NULL,
  updated_at_local TEXT NOT NULL
);
```

#### Standar Nilai Dropdown (Enum):
- **category**: `'Elektronik'`, `'Furniture'`, `'Peralatan'`, `'Kendaraan'`, `'Lainnya'`
- **condition**: `'Baik'`, `'Rusak Ringan'`, `'Rusak Berat'`
- **status**: `'Aktif'`, `'Dalam Perbaikan'`, `'Dipensiunkan'`, `'Dimutasi'`

---

### MODUL 2: Aktivitas GA (Kunjungan Outlet & Insiden)
Mencatat hasil inspeksi berkala tim GA ke cabang, checklist SOP, kejadian darurat/rusak, dan tindak lanjut (action items).

#### Tabel SQLite Lokal: `local_outlet_visits`
```sql
CREATE TABLE local_outlet_visits (
  client_uuid TEXT PRIMARY KEY,
  server_id INTEGER,
  branch_id INTEGER NOT NULL,
  visit_date TEXT NOT NULL,          -- Format: YYYY-MM-DD
  visit_time TEXT,                   -- Format: HH:mm
  visitor_name TEXT NOT NULL,
  purpose TEXT NOT NULL,             -- Contoh: 'Audit Rutin', 'Perbaikan Listrik'
  score_cleanliness INTEGER DEFAULT 0,
  score_security INTEGER DEFAULT 0,
  score_display INTEGER DEFAULT 0,
  score_sop INTEGER DEFAULT 0,
  overall_score INTEGER DEFAULT 0,
  notes TEXT,
  action_plan TEXT,
  staff_present TEXT,
  local_photo_paths TEXT,            -- Format JSON string list path
  sync_status TEXT DEFAULT 'pending_sync',
  created_at_local TEXT NOT NULL
);
```

#### Tabel SQLite Lokal: `local_outlet_incidents`
```sql
CREATE TABLE local_outlet_incidents (
  client_uuid TEXT PRIMARY KEY,
  server_id INTEGER,
  branch_id INTEGER NOT NULL,
  incident_date TEXT NOT NULL,
  category TEXT NOT NULL,            -- 'Fasilitas', 'Kehilangan', 'Operasional', 'Lainnya'
  severity TEXT DEFAULT 'Medium',    -- 'Low', 'Medium', 'High', 'Critical'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_taken TEXT,
  reported_by TEXT NOT NULL,
  status TEXT DEFAULT 'Open',        -- 'Open', 'In Progress', 'Resolved'
  local_photo_paths TEXT,
  sync_status TEXT DEFAULT 'pending_sync',
  created_at_local TEXT NOT NULL
);
```

---

### MODUL 3: Data Cabang Outlet
Data cabang bersifat **Read-Only** di HP (di-cache dari server) untuk dijadikan referensi pemilihan lokasi saat input aset, kunjungan, maupun karyawan.

#### Tabel SQLite Lokal: `cached_branches`
```sql
CREATE TABLE cached_branches (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  status TEXT DEFAULT 'Active'
);
```

---

### MODUL 4: Data Karyawan
Menampilkan daftar karyawan aktif per cabang untuk verifikasi lapangan, serta memungkinkan input data karyawan baru secara offline saat ada perekrutan langsung di cabang.

#### Tabel SQLite Lokal: `local_employees`
```sql
CREATE TABLE local_employees (
  client_uuid TEXT PRIMARY KEY,
  server_id INTEGER,
  name TEXT NOT NULL,
  nik TEXT,
  gender TEXT,                       -- 'L' / 'P'
  phone TEXT,
  email TEXT,
  branch_id INTEGER NOT NULL,
  hire_date TEXT,                    -- YYYY-MM-DD
  contract_type TEXT DEFAULT 'PKWT', -- 'PKWT', 'PKWTT', 'Freelance', 'Magang'
  salary_offered REAL DEFAULT 0,
  allowance REAL DEFAULT 0,
  address_domicile TEXT,
  sync_status TEXT DEFAULT 'pending_sync',
  created_at_local TEXT NOT NULL
);
```

---

## 3. Spesifikasi Kontrak REST API (Backend HRMv2)

Base URL: `http://<IP_SERVER_ATAU_DOMAIN>:5002/api`

### 1. Master Data Cache (Dipanggil saat HP Terhubung Internet)
* **Endpoint**: `GET /api/mobile/master-data`
* **Headers**: `Authorization: Bearer <TOKEN>`
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "branches": [
      { "id": 1, "code": "KNT-01", "name": "Outlet Mawar", "city": "Jakarta", "status": "Active" }
    ],
    "categories": ["Elektronik", "Furniture", "Peralatan", "Kendaraan", "Lainnya"],
    "asset_conditions": ["Baik", "Rusak Ringan", "Rusak Berat"],
    "asset_statuses": ["Aktif", "Dalam Perbaikan", "Dipensiunkan", "Dimutasi"],
    "contract_types": ["PKWT", "PKWTT", "Freelance", "Magang"]
  }
}
```

### 2. Sinkronisasi Aset Baru (Input Aset Offline)
* **Endpoint**: `POST /api/mobile/sync/asset`
* **Content-Type**: `multipart/form-data`
* **Payload Fields**:
  - `client_uuid` (string, required): UUID dari HP
  - `name` (string, required): "Printer Kasir Epson"
  - `category` (string, required): "Elektronik"
  - `branch_id` (number, required): 1
  - `asset_code` (string, optional): "AST-KNT01-8891"
  - `condition` (string): "Baik"
  - `status` (string): "Aktif"
  - `brand` (string): "Epson"
  - `serial_number` (string): "SN987214"
  - `purchase_cost` (number): 1500000
  - `purchase_date` (string): "2026-10-25"
  - `notes` (string): "Unit baru kasir 1"
  - `created_at_client` (string): "2026-10-25T08:30:00Z"
  - `photos` (file binary, multiple): Foto-foto bukti aset (maks 5 file)
* **Response `201 Created` / `200 OK` (Idempotent)**:
```json
{
  "success": true,
  "message": "Aset berhasil disinkronkan.",
  "data": {
    "server_id": 42,
    "client_uuid": "e4b10b0a-7b3b-4177-8c54-47f6920d0f41",
    "asset_code": "AST-KNT01-8891"
  }
}
```

### 3. Sinkronisasi Kunjungan Outlet GA
* **Endpoint**: `POST /api/mobile/sync/visit`
* **Content-Type**: `multipart/form-data`
* **Payload Fields**:
  - `client_uuid` (string, required)
  - `branch_id` (number, required)
  - `visit_date` (string): "2026-10-25"
  - `visit_time` (string): "09:30"
  - `visitor_name` (string): "Budi (GA)"
  - `purpose` (string): "Audit Kebersihan & Aset"
  - `score_cleanliness` (number): 85
  - `score_security` (number): 90
  - `score_display` (number): 80
  - `score_sop` (number): 85
  - `overall_score` (number): 85
  - `notes` (string): "Semua aset elektronik berfungsi baik."
  - `action_plan` (string): "Ganti lampu neon kasir."
  - `staff_present` (string): "Siti (Kasir), Joko (Pramuniaga)"
  - `photos` (file binary, multiple)
* **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "server_id": 18,
    "client_uuid": "7a329fa2-8b77-4b13-a4e9-1582e308f23a"
  }
}
```

### 4. Sinkronisasi Data Karyawan Baru
* **Endpoint**: `POST /api/mobile/sync/employee`
* **Content-Type**: `application/json`
* **Payload Body**:
```json
{
  "client_uuid": "c0182f71-2b02-4c22-b58f-22f37c357f12",
  "name": "Ahmad Fauzi",
  "nik": "3201234567890001",
  "gender": "L",
  "phone": "081234567890",
  "email": "ahmad.fauzi@example.com",
  "branch_id": 1,
  "hire_date": "2026-10-25",
  "contract_type": "PKWT",
  "salary_offered": 3500000,
  "allowance": 500000,
  "address_domicile": "Jl. Kamboja No. 12, Jakarta"
}
```
* **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "server_id": 105,
    "access_code": "MAN-8821",
    "client_uuid": "c0182f71-2b02-4c22-b58f-22f37c357f12"
  }
}
```

---

## 4. Rekomendasi Setup Project Flutter

### Dependencies di `pubspec.yaml`
```yaml
dependencies:
  flutter:
    sdk: flutter

  # Local Storage & Database
  sqflite: ^2.3.0
  path: ^1.9.0
  flutter_secure_storage: ^9.0.0

  # Networking & Sync
  dio: ^5.4.0
  connectivity_plus: ^5.0.2

  # Media & Hardware
  image_picker: ^1.0.7
  flutter_image_compress: ^2.1.0

  # Utilities & UUID
  uuid: ^4.3.3
  intl: ^0.19.0
```

### Contoh Kode Service Sync di Flutter (Dio FormData)
```dart
Future<bool> syncSingleAsset(LocalAsset asset) async {
  final dio = Dio();
  final formData = FormData.fromMap({
    'client_uuid': asset.clientUuid,
    'name': asset.name,
    'category': asset.category,
    'branch_id': asset.branchId,
    'condition': asset.condition,
    'status': asset.status,
    'brand': asset.brand,
    'serial_number': asset.serialNumber,
    'purchase_cost': asset.purchaseCost,
    'purchase_date': asset.purchaseDate,
    'notes': asset.notes,
  });

  // Tambahkan foto dari storage lokal
  for (String path in asset.photoPaths) {
    formData.files.add(MapEntry(
      'photos',
      await MultipartFile.fromFile(path, filename: path.split('/').last),
    ));
  }

  try {
    final response = await dio.post(
      'http://YOUR_SERVER_IP:5002/api/mobile/sync/asset',
      data: formData,
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      // Update local db: sync_status = 'synced', server_id = response.data['data']['server_id']
      return true;
    }
  } catch (e) {
    print('Sync failed: $e');
  }
  return false;
}
```
