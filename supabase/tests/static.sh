#!/usr/bin/env bash
# Controlli statici sul codice del sito e del pannello. Esce con codice != 0 se uno fallisce.
cd "$(dirname "$0")/../.."
FAIL=0
ok()  { echo "OK     $1"; }
ko()  { echo "ERRORE $1"; FAIL=1; }
chk() { local desc=$1; shift; if "$@" >/dev/null 2>&1; then ok "$desc"; else ko "$desc"; fi; }
no()  { local desc=$1; shift; if "$@" >/dev/null 2>&1; then ko "$desc"; else ok "$desc"; fi; }

PUB='public'
no "nessuna chiave service_role/segreta nel repository (escluso questo file)" \
  grep -rIEn "service_role|sb_secret_|SUPABASE_SERVICE|serviceRole" . --exclude-dir=.git --exclude-dir=node_modules --exclude=static.sh --exclude=configure.sh --exclude=verify.sh --exclude=README.md --exclude=supabase.2.118.0.js
no "nessuna chiave JWT incollata nel sito (solo config.js, e solo ruolo anon)" \
  bash -c "grep -rIlE 'eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}' $PUB --exclude=supabase.2.118.0.js | grep -v gallery/config.js"
no "nessun innerHTML/outerHTML/insertAdjacentHTML/document.write nel codice galleria e admin" \
  grep -nE "innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function" $PUB/gallery/live.js $PUB/admin/admin.js $PUB/admin/image-tools.js
no "nessuno script inline nelle pagine (solo JSON-LD)" \
  bash -c "grep -nE '<script(\\s[^>]*)?>' $PUB/index.html $PUB/admin/index.html $PUB/404.html $PUB/privacy.html | grep -v 'src=' | grep -v 'application/ld+json'"
no "nessun gestore inline (onclick=...) nelle pagine" \
  grep -nE "\son[a-z]+=\"" $PUB/index.html $PUB/admin/index.html
chk "CSP: script-src 'self' senza unsafe-inline/unsafe-eval" \
  bash -c "grep -E 'Content-Security-Policy' $PUB/_headers | grep -q \"script-src 'self';\" && ! grep -E 'Content-Security-Policy' $PUB/_headers | grep -qE \"script-src[^;]*unsafe\""
chk "CSP: frame-ancestors 'none' e connect-src limitato" \
  bash -c "grep -E 'Content-Security-Policy' $PUB/_headers | grep -q \"frame-ancestors 'none'\" && ! grep -E 'Content-Security-Policy' $PUB/_headers | grep -qE \"connect-src[^;]*(\\*|http:)\""
chk "netlify.toml ha la stessa CSP di _headers (senza differenze negli host)" \
  bash -c "diff <(grep -oE \"(img|connect)-src[^;]*\" $PUB/_headers) <(grep -oE \"(img|connect)-src[^;]*\" netlify.toml)"
chk "admin: noindex nell'HTML, in _headers e in robots.txt" \
  bash -c "grep -q 'noindex' $PUB/admin/index.html && grep -A3 '^/admin/' $PUB/_headers | grep -q noindex && grep -q 'Disallow: /admin/' $PUB/robots.txt"
no "admin: nessun modulo di registrazione (signUp/signup)" \
  grep -rniE "signUp|sign_up|signup|registrati" $PUB/admin/admin.js $PUB/admin/index.html
chk "admin: libreria con versione fissa e ospitata sul sito" \
  bash -c "grep -q 'vendor/supabase.2.118.0.js' $PUB/admin/index.html && test -f $PUB/admin/vendor/supabase.2.118.0.js"
no "nessuno script esterno caricato da altri domini" \
  bash -c "grep -nE '<script[^>]+src=\"https?://' $PUB/index.html $PUB/admin/index.html"
chk "RLS attiva su gallery_photos e admins" \
  bash -c "grep -q 'alter table public.gallery_photos enable row level security' supabase/migrations/0001_gallery.sql && grep -q 'alter table public.admins enable row level security' supabase/migrations/0001_gallery.sql"
no "nessuna policy di scrittura per anon nelle migrazioni" \
  grep -nE "for (insert|update|delete|all) to (anon|public)" supabase/migrations/0001_gallery.sql
chk "config.js contiene solo url e anonKey" \
  bash -c "grep -c 'window.GALLERY_CONFIG' $PUB/gallery/config.js | grep -q 1"
chk "le 20 foto di partenza hanno data-key e il seed ne ha 20" \
  bash -c "test \$(grep -c 'data-key=\"gal-' $PUB/index.html) -eq 20 && test \$(grep -c \"^  (\" supabase/migrations/0002_seed_legacy.sql) -eq 20"
[ $FAIL = 0 ] && echo && echo "Tutti i controlli statici superati." || { echo; echo "ATTENZIONE: controlli falliti."; }
exit $FAIL
