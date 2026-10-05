const fs = require('fs');
const path = require('path');

/**
 * Lightweight, zero-dependency .env loader.
 * Loads variables into process.env from local or root .env files if not already defined.
 */
function loadEnv() {
  const candidatePaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
    path.join(__dirname, '.env')
  ];

  const seen = new Set();
  for (const envPath of candidatePaths) {
    const resolved = path.resolve(envPath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    if (fs.existsSync(resolved)) {
      try {
        const content = fs.readFileSync(resolved, 'utf8');
        content.split(/\r?\n/).forEach(line => {
          line = line.trim();
          if (!line || line.startsWith('#')) return;
          const eqIdx = line.indexOf('=');
          if (eqIdx !== -1) {
            const key = line.slice(0, eqIdx).trim();
            let val = line.slice(eqIdx + 1).trim();
            // Strip surrounding quotes
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (key && (process.env[key] === undefined || process.env[key] === '')) {
              process.env[key] = val;
            }
          }
        });
      } catch (e) {
        console.warn('[envLoader] Warning reading env file at', resolved, e.message);
      }
    }
  }
}

loadEnv();

module.exports = { loadEnv };
