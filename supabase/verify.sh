#!/usr/bin/env bash
# Prova dall'esterno, con la sola chiave "anon", che un estraneo non possa scrivere né elencare nulla.
# Uso: supabase/verify.sh https://xxxx.supabase.co CHIAVE_ANON [--con-signup]
# Le prove di scrittura usano id inesistenti: non toccano le foto vere nemmeno se la sicurezza fosse rotta
# (l'unica eccezione e' l'inserimento di prova gal-999, che in quel caso resterebbe da cancellare).
# --con-signup prova anche la registrazione: se fosse aperta, crea un utente di prova (non admin, innocuo).
set -uo pipefail
URL=${1:-}; KEY=${2:-}; SIGNUP=${3:-}
[[ $URL =~ ^https://[a-z0-9-]+\.supabase\.co$ && -n $KEY ]] || { echo "Uso: $0 https://xxxx.supabase.co CHIAVE_ANON [--con-signup]"; exit 2; }
case $KEY in sb_secret_*) echo "Questa e' una chiave segreta: usa quella anon."; exit 2;; esac
H=(-H "apikey: $KEY"); [[ $KEY == eyJ* ]] && H+=(-H "Authorization: Bearer $KEY")
FAIL=0
# richiesta(metodo, percorso, corpo, [intestazioni...]) -> imposta CODE e BODY
richiesta() {
  local m=$1 p=$2 b=$3; shift 3
  local out; out=$(curl -sS -m 20 -X "$m" "$URL$p" "${H[@]}" -H 'Content-Type: application/json' "$@" ${b:+-d "$b"} -w '\n%{http_code}')
  CODE=${out##*$'\n'}; BODY=${out%$'\n'*}
}
passa() { echo "OK     $1"; }
fallisce() { echo "ERRORE $1  (HTTP $CODE: ${BODY:0:140})"; FAIL=1; }
# rifiutato = codice 4xx, oppure 200 con elenco vuoto (RLS filtra tutte le righe)
rifiutato() { [[ $CODE =~ ^4 ]] || [[ $CODE == 200 && $BODY =~ ^\[\]$ ]]; }

richiesta GET '/rest/v1/gallery_photos?select=id&limit=1' ''
[[ $CODE == 200 ]] && passa "lettura pubblica della galleria" || fallisce "la lettura pubblica non funziona"

richiesta POST '/rest/v1/gallery_photos' '{"position":0,"legacy_key":"gal-999"}' -H 'Prefer: return=representation'
rifiutato && passa "anon NON puo' inserire foto" || fallisce "anon ha inserito una riga!"

# Modifica ed eliminazione puntano a un id che non esiste: se la sicurezza fosse rotta non toccano nessuna foto,
# ma anon deve comunque ricevere un rifiuto (permesso negato), non un "0 righe".
IDNULLO=00000000-0000-0000-0000-000000000000
richiesta PATCH "/rest/v1/gallery_photos?id=eq.$IDNULLO" '{"caption":"x"}' -H 'Prefer: return=representation'
[[ $CODE =~ ^4 ]] && passa "anon NON puo' modificare foto" || fallisce "anon puo' modificare (nessun rifiuto)"

richiesta DELETE "/rest/v1/gallery_photos?id=eq.$IDNULLO" '' -H 'Prefer: return=representation'
[[ $CODE =~ ^4 ]] && passa "anon NON puo' eliminare foto" || fallisce "anon puo' eliminare (nessun rifiuto)"

richiesta POST '/rest/v1/rpc/reorder_gallery' '{"p_ids":[]}'
[[ $CODE =~ ^4 ]] && passa "anon NON puo' riordinare" || fallisce "anon puo' chiamare reorder_gallery"

richiesta POST '/rest/v1/rpc/is_admin' '{}'
[[ $CODE =~ ^4 ]] && passa "anon NON puo' chiamare is_admin" || fallisce "anon puo' chiamare is_admin"

richiesta GET '/rest/v1/admins?select=user_id' ''
rifiutato && passa "anon NON vede la tabella admins" || fallisce "anon legge la tabella admins!"

richiesta POST '/rest/v1/admins' '{"user_id":"00000000-0000-0000-0000-000000000000"}'
[[ $CODE =~ ^4 ]] && passa "anon NON puo' aggiungersi come admin" || fallisce "anon ha scritto su admins!"

richiesta POST '/storage/v1/object/gallery/verifica-anon.webp' 'x' -H 'Content-Type: image/webp'
[[ $CODE =~ ^4 ]] && passa "anon NON puo' caricare file" || fallisce "anon ha caricato un file!"

richiesta POST '/storage/v1/object/list/gallery' '{"prefix":"","limit":5}'
rifiutato && passa "anon NON puo' elencare il bucket" || fallisce "anon elenca i file del bucket!"

richiesta DELETE '/storage/v1/object/gallery' '{"prefixes":["verifica-anon.webp"]}'
rifiutato && passa "anon NON puo' eliminare file" || fallisce "anon ha eliminato file!"

if [[ $SIGNUP == --con-signup ]]; then
  richiesta POST '/auth/v1/signup' '{"email":"verifica-sicurezza@example.invalid","password":"Verifica-Sicurezza-123!"}'
  [[ $CODE =~ ^4 ]] && passa "le registrazioni pubbliche sono chiuse" \
    || fallisce "le registrazioni sono APERTE: spegni Authentication > Sign In / Providers > Allow new users to sign up"
else
  echo "salta  registrazioni pubbliche (usa --con-signup; se fossero aperte crea un utente di prova non admin)"
fi

echo; [[ $FAIL == 0 ]] && echo "Tutte le prove superate." || echo "ATTENZIONE: almeno una prova e' fallita."
exit $FAIL
