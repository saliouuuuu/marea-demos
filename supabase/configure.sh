#!/usr/bin/env bash
# Collega il sito al progetto Supabase: scrive URL e chiave "anon" in public/gallery/config.js
# e apre le regole di sicurezza (CSP) solo verso quel dominio.
# Uso: supabase/configure.sh https://xxxx.supabase.co CHIAVE_ANON
set -euo pipefail
cd "$(dirname "$0")/.."
URL=${1:-}; KEY=${2:-}
[[ $URL =~ ^https://[a-z0-9-]+\.supabase\.co$ ]] || { echo "URL non valido: deve essere https://<progetto>.supabase.co (senza / finale)"; exit 1; }
[[ -n $KEY ]] || { echo "Manca la chiave anon"; exit 1; }
python3 - "$URL" "$KEY" <<'PY'
import sys, re, json, base64
url, key = sys.argv[1:3]
if key.startswith('sb_secret_'):
    sys.exit('Questa e\' una chiave SEGRETA: non va mai messa nel sito. Serve la chiave "anon" / "publishable".')
if key.startswith('eyJ'):
    try:
        part = key.split('.')[1]; part += '=' * (-len(part) % 4)
        role = json.loads(base64.urlsafe_b64decode(part)).get('role')
    except Exception:
        sys.exit('La chiave non sembra valida.')
    if role != 'anon':
        sys.exit('Questa chiave ha il ruolo "%s": nel sito va solo la chiave "anon".' % role)
if not re.fullmatch(r'[A-Za-z0-9_.-]+', key):
    sys.exit('La chiave contiene caratteri non validi.')
host = re.compile(r'https://[A-Za-z0-9-]+\.supabase\.co')
def sub(path, fn):
    s = open(path, encoding='utf-8').read(); n = fn(s); open(path, 'w', encoding='utf-8').write(n)
sub('public/gallery/config.js', lambda s: re.sub(r"window\.GALLERY_CONFIG = \{[^}]*\};", "window.GALLERY_CONFIG = { url: '%s', anonKey: '%s' };" % (url, key), s))
for f in ('public/_headers', 'netlify.toml'):
    sub(f, lambda s: re.sub(r"((?:img|connect)-src [^;]*?)" + host.pattern, lambda m: m.group(1) + url, s))
print('Configurato:', url)
PY
grep -c "$URL" public/_headers netlify.toml public/gallery/config.js
