---
name: security-fix
description: >-
  Remediates confirmed security vulnerabilities and review findings using a
  strict reproduce-remediate-verify workflow: failing security regression test,
  codebase-wide variant sweep, defense-in-depth patch, full regression run,
  and mobile/client migration documentation. Use after security-bug-hunter or
  security-review identifies issues to fix.
metadata:
  version: "1.0.0"
  origin: "Adapted from affaan-m/ECC (common/security + security-reviewer + security-review + orch-fix-defect)"
---

# Security Fix

Disciplined remediation workflow for fixing confirmed vulnerabilities cleanly without introducing regressions or breaking legitimate web/mobile clients.

## When to Use

- Fixing confirmed issues discovered by `security-bug-hunter`, `security-review`, or `npm audit`.
- Hardening authentication, RBAC, mobile sync APIs, file serving, CORS, or outbound network calls.
- Closing security gaps while keeping web and mobile clients functioning safely.

## Core Principles

1. **Fix the Class, Not Just the Line**: Always sweep the codebase for sibling endpoints or helpers with the same flaw.
2. **Prove First, Patch Second**: Reproduce the vulnerability with a failing test before writing the fix, then prove the test turns green.
3. **Fail Closed**: When validation, auth, origin verification, or crypto checks fail or env config is missing in production, reject the request safely.
4. **Never Break Production Data or Leak Secrets**: Run tests strictly against isolated temporary/cloned DBs—never mutate production SQLite files or commit `.env`/secrets/DB binaries.

## 6-Step Remediation Workflow

### 1. Triage & Containment

- Order fixes strictly by severity: `CRITICAL` -> `HIGH` -> `MEDIUM`.
- If real credentials, JWT secrets, or API keys were exposed:
  1. Immediately flag the secret for **rotation** and git-history cleanup.
  2. Remove hardcoded values and require `process.env.*` loading.

### 2. Variant Analysis (Repo-Wide Sweep)

Before editing a single controller, search all routes, middleware, controllers, utils, and frontend views for identical unsafe patterns (e.g., all static mounts, all file downloads, all `cors` configs, all outbound `fetch`/`axios` calls, all mobile/legacy aliases).

### 3. Reproduce First (Red Security Test)

Write a minimal automated test that demonstrates the security flaw against an isolated test DB/app instance:

- Unauthenticated/unauthorized request returning `200` when `401`/`403` is required
- Cross-user or lower-role IDOR reading/modifying another user's resource
- Path traversal escaping an upload/document directory
- Untrusted `Origin` or unauthenticated static route exposing sensitive docs/data
- Missing magic-byte/MIME validation or leaky error stack trace

Run the new test and confirm it fails for the expected security reason.

### 4. Apply Defense-in-Depth Patch (Green)

Apply the appropriate remediation pattern:

- **Secrets & Env**: Move all secrets to env vars; fail fast on missing critical keys in `NODE_ENV === 'production'`; remove insecure default fallbacks.
- **Auth, RBAC & IDOR**: Attach `authenticateToken` + `requireRole(...)` at the router level **and** enforce ownership/branch scoping inside controllers (`req.user.id` / role checks). Never rely on client-supplied `employee_id` or `user_id` without verifying caller authority.
- **SQL Injection**: Replace any string interpolation with parameterized queries (`?` placeholders) and strict allowlists for dynamic `ORDER BY`/column names.
- **Command Injection / SSRF / Outbound Leak**: Replace shell commands with safe native APIs; validate outbound URLs against strict `https:` + host allowlists and block private/loopback IP ranges.
- **Path Traversal & File Uploads**: Use `path.basename` / strict `path.resolve` prefix checks; validate size, MIME, extension, magic bytes; clean up temp files on failure; never expose raw upload directories without auth.
- **CORS, Headers & Public Exposure**: Restrict `CORS_ORIGIN` to explicit allowlisted origins; disable sensitive public static routes (like internal architecture/API docs) in production or guard them behind auth; harden `helmet` headers and CSP.
- **Rate Limiting & PII Redaction**: Apply route-specific rate limiters (login, mobile sync, uploads); minimize PII in mobile list endpoints; redact passwords/tokens/PII in logs and 5xx responses.
- **Atomic Financial/Quota Updates**: Wrap leave balance, loan deduction, and approval transitions in DB transactions with status guards so duplicate/concurrent requests cannot double-apply.

### 5. Verify & Re-Audit

1. Run the new security regression test(s) and confirm **100% pass**.
2. Run the full project test suite, linter, and production frontend build to ensure zero regressions.
3. Inspect `git status` and `git diff` to verify no secrets, `.env`, upload files, or production DB mutations were introduced.
4. Perform a quick `security-review` pass on the final diff.

### 6. Client / Mobile Compatibility & Documentation

Whenever a security fix alters auth requirements, headers, rate limits, CORS, HTTPS/TLS rules, endpoint paths, or payload validation for mobile clients:

- Document the exact breaking/behavioral changes, required client headers/tokens, secure token storage (`flutter_secure_storage`), base-URL pinning/allowlisting, and error handling (`401`/`403`/`429`) in the mobile integration guide so the mobile app reconnects cleanly without weakening security.

## Fix Report Format

For each remediated vulnerability, report:

- **Finding ID & Severity**: e.g., `[SEC-01] HIGH`
- **Root Cause & Variant Scope**: What was vulnerable and every file checked/updated.
- **Files Changed**: Clickable file paths with concise summary of the guard added.
- **Security Regression Test**: Test file/name proving the exploit is now blocked.
- **Verification Output**: Observed test/lint/build command results after the final edit.
- **Required Ops / Mobile Actions**: Env vars to set/rotate, deployment flags, or Flutter client updates needed.
