# Galleria gestibile dal cliente (Supabase)

Lisa carica, riordina ed elimina le foto da `/admin/`. Il sito pubblico legge l'elenco dal database;
se il database non risponde o è vuoto, mostra le 20 foto scritte nella pagina.

Finché `public/gallery/config.js` è vuoto, tutto resta spento e il sito è identico a prima.

## Cosa serve fare a mano (una volta sola)

1. **Crea il progetto** su supabase.com (regione Europa). Annota l'URL (`https://xxxx.supabase.co`) e la chiave **anon / publishable** (Project Settings → API Keys). La chiave `service_role` / `secret` non va mai usata né incollata da nessuna parte del sito.
2. **SQL Editor** → incolla ed esegui, nell'ordine:
   1. `supabase/migrations/0001_gallery.sql` (tabelle, regole di sicurezza, bucket)
   2. `supabase/migrations/0002_seed_legacy.sql` (le 20 foto attuali nella tabella, così Lisa può riordinarle ed eliminarle)
3. **Authentication → Sign In / Providers → Email**: lascia attivo l'accesso con email e **spegni "Allow new users to sign up"**. Disattiva anche gli accessi anonimi, se presenti.
4. **Authentication → Users → Add user → Create new user**: email e password di Lisa, con "Auto Confirm User" attivo. Scegli una password lunga e unica.
5. **Rendi quell'utente amministratore** (SQL Editor, con l'email di Lisa):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-di-lisa@esempio.it';
   ```
   Le regole di sicurezza scrivono solo se l'utente è in `public.admins`: anche chi riuscisse a registrarsi non potrebbe toccare nulla.
6. **Collega il sito** (lo faccio io, basta mandarmi URL e chiave anon):
   ```
   supabase/configure.sh https://xxxx.supabase.co CHIAVE_ANON
   ```
   Scrive URL e chiave in `public/gallery/config.js` e apre la CSP (`_headers` e `netlify.toml`) solo verso quel dominio. Rifiuta le chiavi segrete.
7. Pubblica (commit e merge) e prova da fuori:
   ```
   supabase/verify.sh https://xxxx.supabase.co CHIAVE_ANON --con-signup
   ```
   Con la sola chiave pubblica prova a scrivere, caricare, eliminare ed elencare i file: deve ricevere sempre un rifiuto. `--con-signup` prova anche la registrazione (se fosse aperta crea un utente di prova non admin, innocuo).

## Come lo usa Lisa

- Dal sito preme **Area riservata** in fondo alla pagina (o apre `https://andrealisagarden.it/admin/`) ed entra con email e password.
- **Aggiungi foto**: sceglie una o più foto dal telefono; vengono ridotte e ripulite nel browser (anche dalla posizione GPS). Può aggiungere una didascalia e il tipo di lavoro. Le foto nuove vanno in cima.
- **Frecce su e giù** per l'ordine (su computer anche trascinamento). **Elimina** chiede conferma.
- Se elimina tutte le foto, il sito torna a mostrare quelle scritte nella pagina.
- Eliminare una delle 20 foto di partenza la toglie dalla galleria; il file resta nel sito ma non si vede.
- **Password**: dal pannello sceglie una password nuova che conosce solo lei (almeno 12 caratteri, meglio una frase). Cambiandola si esce da tutti gli altri dispositivi.
- **Si esce da soli** chiudendo il browser o dopo 30 minuti senza usare il pannello. Dopo 5 password sbagliate di fila l'accesso si ferma per 30 secondi, poi sempre più a lungo (fino a 15 minuti).

Password dimenticata: le email di recupero di Supabase senza un server di posta proprio arrivano solo ai membri del progetto, quindi la reimposti tu dallo SQL Editor con una password provvisoria, che Lisa poi cambia dal pannello:
```sql
update auth.users
set encrypted_password = extensions.crypt('PASSWORD-PROVVISORIA', extensions.gen_salt('bf'))
where email = 'email-di-lisa@esempio.it';
```

## Sicurezza: come è fatta

- **RLS attiva** su `gallery_photos` e `admins`. Lettura pubblica solo della galleria; inserimento, modifica ed eliminazione solo per `public.is_admin()`. `admins` è invisibile dall'API.
- Nello Storage il bucket `gallery` è pubblico in lettura via URL ma **non elencabile**; scrittura solo admin; il server rifiuta file oltre 3 MB e tipi diversi da WebP/JPEG.
- Nel sito c'è solo la chiave **anon**. La `service_role` non compare in nessun file.
- Contenuti del database inseriti nella pagina solo come testo (`textContent`), mai come HTML. L'elenco ricevuto viene comunque validato campo per campo.
- La CSP non ammette script inline né domini diversi dal tuo e da Supabase, e impone i **Trusted Types**: nessuno script può scrivere HTML nella pagina (`innerHTML` e simili sono bloccati in tutto il sito), quindi un testo arrivato da fuori non può diventare codice. `/admin/` ha `noindex` e `Cache-Control: no-store` (dopo l'uscita il tasto "indietro" non rimostra l'elenco).
- Il pannello tiene la sessione solo nella scheda (`sessionStorage`), esce da solo dopo 30 minuti di inattività, rallenta i tentativi sbagliati e scollega subito un utente che non è in `public.admins`.
- La libreria `supabase-js` è alla versione fissa 2.118.0, ospitata sul sito (`public/admin/vendor/`), non caricata da un CDN.
- Il Worker di Cloudflare risponde solo dal dominio: `workers_dev` e `preview_urls` sono spenti in `wrangler.jsonc`, così nessun indirizzo secondario aggira le regole del dominio.
- `public/.well-known/security.txt` dice a chi trova un problema dove scrivere. **Va rinnovato ogni anno** (riga `Expires`); `static.sh` fallisce quando è scaduto.

## Impostazioni da fare nei pannelli (una volta sola)

Il codice non può impostarle da solo: vanno fatte a mano dagli account del sito.

**Supabase** (progetto `kpwmjngzsgjniontminj`)
- Authentication → Sign In / Providers → Email: *Minimum password length* **12**, *Password Requirements* **Letters and digits** (almeno), *Secure password change* attivo. Valgono per le password nuove: quella attuale di Lisa continua a funzionare finché non la cambia.
- Authentication → Rate Limits: *sign-ups and sign-ins* a **10** ogni 5 minuti per indirizzo IP (Lisa entra di rado).
- Authentication → URL Configuration: *Site URL* `https://andrealisagarden.it`, nessun altro indirizzo nei *Redirect URLs*.
- Authentication → Users: deve esserci solo l'utente di Lisa; eventuali utenti di prova vanno eliminati.
- Database → Advisors → Security Advisor: nessun avviso rosso.

**Cloudflare** (zona `andrealisagarden.it`) — fatte il 28 ottobre 2026: TLS minimo 1.2, Bot Fight Mode, regola `/admin`, SPF.
- SSL/TLS → Edge Certificates: *Minimum TLS Version* **TLS 1.2**, *TLS 1.3* attivo, *Always Use HTTPS* attivo.
- Security → Bots: *Bot Fight Mode* attivo. **Spegni *JavaScript Detections***: Cloudflare inietta uno script in ogni pagina, ma la CSP (`script-src 'self'`) lo blocca giustamente e a ogni visita compare un errore in console; il Bot Fight Mode funziona lo stesso.
- Analytics & Logs → Web Analytics → `andrealisagarden.it`: **spegni l'impostazione automatica**. Anche questa inietta uno script (`static.cloudflareinsights.com`) che la CSP blocca; il sito non usa strumenti di analisi e l'informativa privacy dice proprio questo ("non usa strumenti di analisi, pubblicità o profilazione").
- Security → WAF → Custom rules → regola "Pannello solo dall'Italia", azione **Block**:
  ```
  (starts_with(http.request.uri.path, "/admin") and ip.src.country ne "IT")
  ```
  Se Lisa è all'estero e deve usare il pannello, va messa in pausa.
- Workers & Pages → marea-demos → Settings → Domains & Routes: dopo il primo deploy con questo `wrangler.jsonc`, *workers.dev* e *Preview URLs* risultano spenti e `andrealisagarden.it` resta collegato.
- DNS: record **TXT** su `@` con `v=spf1 -all` (dal dominio non parte posta; `v=spf1 ~all` va bene lo stesso, il DMARC `p=reject` fa il resto). Se un giorno si usa la casella IONOS per spedire, il valore diventa `v=spf1 include:_spf-eu.ionos.com -all`.

**Account**
- Verifica in due passaggi (app di autenticazione) su GitHub, Cloudflare, Netlify, Supabase e IONOS: chi entra in uno di questi account controlla il sito.
- GitHub → Settings del repository → *Change visibility* → **Private**: oggi chiunque può leggere codice e cronologia. Netlify e Cloudflare continuano a pubblicare anche da un repository privato.

## Prove automatiche

| Comando | Cosa prova |
|---|---|
| `supabase/tests/run-local.sh` | Le policy su un Postgres locale: anon, utente non admin e admin (serve Postgres installato). |
| `supabase/tests/static.sh` | Controlli sul codice: nessuna chiave segreta, nessuna `innerHTML`, CSP, noindex, nessuna registrazione. |
| `supabase/verify.sh` | Dall'esterno, contro il progetto vero, con la sola chiave pubblica. |

## Da sapere

- Un progetto Supabase gratuito va in **pausa dopo 7 giorni senza attività**. In quel caso il pannello smette di funzionare e il sito mostra le foto scritte nella pagina. Per un cliente reale conviene il piano a pagamento, oppure un'attività periodica.
- Le immagini non passano dalle trasformazioni di Supabase (a pagamento): le due misure, 800 e 1920 px, le prepara il browser di Lisa prima del caricamento.
- Il pannello è una pagina del sito: non gestisce utenti multipli. Per aggiungere un altro amministratore, crea l'utente e inserisci il suo id in `public.admins`.
