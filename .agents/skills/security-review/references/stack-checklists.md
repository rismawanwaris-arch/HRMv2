# Stack-Specific Security Checklists

Reference patterns adapted for Node.js/Express backends, Web/React frontends, and Flutter/Dart mobile apps.

---

## 1. Node.js / Express / SQL Backend

### Secrets & Startup Validation

```js
// FAIL: Hardcoded secret or silent weak fallback in production
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-123';

// PASS: Require env secrets explicitly in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable must be configured.');
}
```

### Parameterized SQL Queries

```js
// FAIL: String interpolation -> SQL injection
const user = await query.get(`SELECT * FROM users WHERE username = '${username}'`);

// PASS: Bound parameters ("?" for SQLite/MySQL; numbered parameters in Postgres drivers)
const user = await query.get('SELECT * FROM users WHERE username = ?', [username]);
```

### CORS & Outbound API Trust

```js
// FAIL: Allow any origin in production or send outbound requests to arbitrary URLs
app.use(cors({ origin: true, credentials: true }));
await fetch(req.body.webhookUrl, { method: 'POST', body: JSON.stringify(payload) });

// PASS: Explicit allowlist for both CORS and outbound targets
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : false }));

const ALLOWED_OUTBOUND_HOSTS = new Set(['generativelanguage.googleapis.com']);
const parsed = new URL(targetUrl);
if (parsed.protocol !== 'https:' || !ALLOWED_OUTBOUND_HOSTS.has(parsed.hostname)) {
  throw new Error('Blocked untrusted outbound API host');
}
```

### File Upload Hardening

- Enforce max file size (`limits.fileSize`), file count (`limits.files`), allowed MIME types, and allowlisted extensions.
- Verify magic bytes (`verifyImageMagicBytes`) after upload—reject mismatched files and delete rejected temp/uploaded files immediately.
- Serve private photos/documents only through authenticated controllers with path-traversal protection (`path.basename` + `path.resolve` containment check), never open directory browsing.

### Rate Limiting, Errors & Logging

- Configure `app.set('trust proxy', ...)` when running behind nginx/Tailscale/ingress so `express-rate-limit` tracks real client IPs.
- Never log `Authorization` headers, JWTs, passwords, or raw PII (`nik`, `bank_account`, `npwp`).
- Return generic messages (`'Terjadi kesalahan internal pada server.'`) on `500` responses—never expose `err.stack` or raw SQLite errors.

---

## 2. Web / React Frontend

### XSS & HTML Safety

- Never pass unescaped user input to `innerHTML` or `dangerouslySetInnerHTML`.
- If rich HTML is unavoidable, sanitize first with `DOMPurify.sanitize(html, { ALLOWED_TAGS: [...], ALLOWED_ATTR: [] })`.
- Validate any external URL before rendering `<a href>` (block `javascript:` and `data:` schemes).

### CSP & Perimeter Headers

Recommended production header baseline (tighten CSP once inline styles/scripts are eliminated or nonced):

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
```

---

## 3. Flutter / Dart Mobile Client

### Secrets & Local Token Storage

- **Never** hardcode API keys, shared secrets, or credentials in Dart source.
- Store JWTs, session identity, and sensitive PII **only** in `flutter_secure_storage` (Keychain on iOS, EncryptedSharedPreferences/Keystore on Android)—never `SharedPreferences` or plaintext local JSON.
- On logout or `401` expiry, wipe `flutter_secure_storage` keys and clear cached sensitive records/cookies.
- Never call `print(token)` or `debugPrint(password)` (use redacted debug logs only in `kDebugMode`).

### Network & TLS Security (Preventing API Leaks to Unknown Hosts)

- Enforce HTTPS (`https://`) in release builds—never ship `http://` base URLs in production.
- Configure Android `network_security_config.xml` (`cleartextTrafficPermitted="false"`) and iOS `NSAppTransportSecurity` (`NSAllowsArbitraryLoads = false`).
- Pin or strictly validate the expected API domain (and reject unexpected redirects or untrusted custom base URLs entered by unprivileged users).
- Always set explicit HTTP timeouts (`connectTimeout`, `receiveTimeout`) on Dio/http clients.
- Attach `Authorization: Bearer <token>` **only** when the request target matches the verified API origin—never forward auth headers to third-party URLs.

```dart
final dio = Dio(BaseOptions(
  baseUrl: 'https://api.example.com',
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 30),
  followRedirects: false,
));
```

### Local SQLite, Deep Links & WebViews

- Use parameterized `sqflite` / `drift` queries (`where: 'id = ?', whereArgs: [id]`)—never interpolate user strings into `rawQuery`.
- Validate deep links with `Uri.tryParse` against allowlisted `scheme`, `host`, and `_allowedPaths`.
- If using `webview_flutter` v4+, disable JS (`JavaScriptMode.disabled`) unless required and lock navigation via `NavigationDelegate.onNavigationRequest` to trusted hosts only.

### Android / iOS Platform Hardening & Release Builds

- In `AndroidManifest.xml`, request only necessary permissions and set `android:exported="false"` on non-launcher activities, services, and receivers.
- Consider `FLAG_SECURE` on screens showing salary/PII data.
- Build releases with obfuscation and static checks clean:
  - `flutter analyze`
  - `flutter build apk --obfuscate --split-debug-info=./debug-info/` (keep `debug-info/` out of git).
