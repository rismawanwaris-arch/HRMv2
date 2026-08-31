const { query } = require('../db');

const VERB = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };
const SENSITIVE_KEYS = new Set(['password', 'oldPassword', 'newPassword', 'token']);

/**
 * Express middleware that records mutating requests to the audit_log table.
 * Read requests (GET/HEAD/OPTIONS) are ignored. The entry is written after the
 * response finishes and never blocks or fails the request.
 *
 * To avoid copying candidate PII into a second table we store the list of
 * field names touched, not their values.
 */
function auditLog(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const startedAt = Date.now();

  // Capture a created entity's id from the response body (POSTs have no :id param).
  let responseId = null;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object') {
      const candidate = body.candidateId ?? body.id ?? (body.data && body.data.id);
      if (/^\d+$/.test(String(candidate))) responseId = parseInt(candidate, 10);
    }
    return originalJson(body);
  };

  res.on('finish', () => {
    // Only log successful or client-error mutations we actually attempted.
    const entity = (req.baseUrl || '').split('/').filter(Boolean).pop() || 'unknown';
    const paramId = Object.values(req.params || {}).find((v) => /^\d+$/.test(String(v)));
    const idParam = paramId != null ? paramId : responseId;
    const bodyKeys = req.body && typeof req.body === 'object'
      ? Object.keys(req.body).filter((k) => !SENSITIVE_KEYS.has(k))
      : [];

    const detail = JSON.stringify({
      params: req.params || {},
      bodyKeys,
      durationMs: Date.now() - startedAt,
    }).slice(0, 2000);

    query.run(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, method, path, status_code, ip, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        (req.user && req.user.username) || null,
        `${entity}.${VERB[req.method] || req.method.toLowerCase()}`,
        entity,
        idParam ? parseInt(idParam, 10) : null,
        req.method,
        (req.originalUrl || req.url || '').slice(0, 500),
        res.statusCode,
        req.ip || null,
        detail,
      ]
    ).catch((err) => console.error('audit_log insert failed:', err.message));
  });

  next();
}

module.exports = { auditLog };
