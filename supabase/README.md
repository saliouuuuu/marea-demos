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
6. **Collega il sito** (sul tuo computer, nella cartella del repository):
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

- Apre `https://andrealisagarden.it/admin/` ed entra con email e password.
- **Aggiungi foto**: sceglie una o più foto dal telefono; vengono ridotte e ripulite nel browser (anche dalla posizione GPS). Può aggiungere una didascalia e il tipo di lavoro. Le foto nuove vanno in cima.
- **Frecce su e giù** per l'ordine (su computer anche trascinamento). **Elimina** chiede conferma.
- Se elimina tutte le foto, il sito torna a mostrare quelle scritte nella pagina.
- Eliminare una delle 20 foto di partenza la toglie dalla galleria; il file resta nel sito ma non si vede.

Password dimenticata: la reimposti tu da Authentication → Users.

## Sicurezza: come è fatta

- **RLS attiva** su `gallery_photos` e `admins`. Lettura pubblica solo della galleria; inserimento, modifica ed eliminazione solo per `public.is_admin()`. `admins` è invisibile dall'API.
- Nello Storage il bucket `gallery` è pubblico in lettura via URL ma **non elencabile**; scrittura solo admin; il server rifiuta file oltre 3 MB e tipi diversi da WebP/JPEG.
- Nel sito c'è solo la chiave **anon**. La `service_role` non compare in nessun file.
- Contenuti del database inseriti nella pagina solo come testo (`textContent`), mai come HTML. L'elenco ricevuto viene comunque validato campo per campo.
- La CSP non ammette script inline né domini diversi dal tuo e da Supabase. `/admin/` ha `noindex`.
- La libreria `supabase-js` è alla versione fissa 2.118.0, ospitata sul sito (`public/admin/vendor/`), non caricata da un CDN.

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
