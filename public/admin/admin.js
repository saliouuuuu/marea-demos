/* Pannello del cliente: accesso, elenco, caricamento, eliminazione e riordino delle foto.
   Tutto il contenuto dinamico entra con textContent, mai come HTML. */
(function () {
  'use strict';
  var cfg = window.GALLERY_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var VISTE = ['vista-accesso', 'vista-gestione', 'vista-negato', 'vista-spenta'];
  var CATEGORIE = {
    prati: 'Prati, aiuole e siepi',
    montagna: 'Lavori case di montagna',
    preparazione: 'Preparazione terreno e semine autunnali',
    recinzioni: 'Recinzioni e staccionate in castagno',
    corten: 'Ghiaia e corten',
    commerciale: 'Commerciali'
  };

  function vista(nome) {
    VISTE.forEach(function (v) { $(v).hidden = v !== nome; });
    $('logout').hidden = nome !== 'vista-gestione';
    aperta = nome === 'vista-gestione';
  }
  function stato(testo, errore) {
    var el = $('stato');
    el.textContent = testo || '';
    el.classList.toggle('errore', !!errore);
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function bottone(testo, cls, label, onclick) {
    var b = el('button', 'btn ' + cls, testo);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', onclick);
    return b;
  }

  var aperta = false;        // il pannello di gestione è a schermo (c'è una sessione dell'amministratore)
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url || '') || !cfg.anonKey) { vista('vista-spenta'); return; }

  // La sessione vive solo in questa scheda (sessionStorage): chiudendo il browser si esce, e su un
  // computer usato anche da altri non resta niente. Le sessioni salvate prima in localStorage si cancellano.
  var archivio = null;
  try { sessionStorage.setItem('lg-prova', '1'); sessionStorage.removeItem('lg-prova'); archivio = sessionStorage; } catch (e) {}
  try { Object.keys(localStorage).forEach(function (k) { if (/^sb-.+-auth-token/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
  var sb = supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: !!archivio, storage: archivio || undefined, autoRefreshToken: true, detectSessionInUrl: false }
  });
  var bucket = sb.storage.from('gallery');
  var foto = [];            // righe della tabella, in ordine
  var coda = [];            // foto preparate e non ancora caricate
  var occupato = false;

  function urlFoto(p) {
    if (p.legacy_key) return '../assets/img/' + p.legacy_key + '-480.webp';
    return bucket.getPublicUrl(p.storage_path + '-800.' + p.ext).data.publicUrl;
  }

  // ── tentativi sbagliati ──
  // Dopo 5 errori di fila l'accesso da questa pagina si ferma: 30 secondi, poi 1, 2, 4 minuti… fino a 15.
  // Il limite vero lo mette il server di Supabase (per indirizzo IP); questo ferma chi prova a indovinare dalla pagina.
  var CHIAVE_BLOCCO = 'lg-accesso';
  function blocco() {
    var b;
    try { b = JSON.parse(localStorage.getItem(CHIAVE_BLOCCO)); } catch (e) {}
    if (!b || typeof b.n !== 'number' || Date.now() - (b.t || 0) > 3600000) b = { n: 0, fino: 0, t: 0 };   // dopo un'ora si riparte da zero
    return b;
  }
  function salvaBlocco(b) { try { localStorage.setItem(CHIAVE_BLOCCO, JSON.stringify(b)); } catch (e) {} }
  function attesa(ms) {
    if (ms < 60000) return Math.ceil(ms / 1000) + ' secondi';
    var m = Math.ceil(ms / 60000);
    return m === 1 ? 'un minuto' : m + ' minuti';
  }

  // ── accesso ──
  $('accesso').addEventListener('submit', function (e) {
    e.preventDefault();
    var fermo = blocco().fino - Date.now();
    if (fermo > 0) { stato('Troppi tentativi sbagliati. Riprova tra ' + attesa(fermo) + '.', true); return; }
    var b = $('entra');
    b.disabled = true; stato('Accesso in corso…');
    sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value })
      .then(function (r) {
        $('password').value = '';
        if (r.error) {
          if (r.error.status === 429) { stato('Troppi tentativi in poco tempo. Aspetta qualche minuto e riprova.', true); return; }
          if (!r.error.status || r.error.status >= 500) { stato('Non riesco a collegarmi. Controlla la connessione e riprova.', true); return; }
          var k = blocco();
          k.n++; k.t = Date.now();
          if (k.n >= 5) k.fino = k.t + Math.min(15 * 60000, 30000 * Math.pow(2, k.n - 5));
          salvaBlocco(k);
          stato(k.fino > k.t ? 'Troppi tentativi sbagliati. Riprova tra ' + attesa(k.fino - k.t) + '.' : 'Email o password non corretti.', true);
          return;
        }
        salvaBlocco({ n: 0, fino: 0, t: 0 });
        stato(''); return controllaAdmin();
      })
      .catch(function () { stato('Non riesco a collegarmi. Controlla la connessione e riprova.', true); })
      .then(function () { b.disabled = false; });
  });

  // Esci: chiude la sessione di questo dispositivo e toglie dalla pagina tutto quello che si vedeva.
  function esci(messaggio) {
    aperta = false;
    return sb.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () {
      foto = []; coda = []; disegna(); disegnaCoda();
      $('nuova').value = ''; $('ripeti').value = ''; $('utente').value = ''; statoPw('');
      vista('vista-accesso'); stato(messaggio || '', !!messaggio);
    });
  }
  $('logout').addEventListener('click', function () { esci(''); });
  $('torna').addEventListener('click', function () { stato(''); vista('vista-accesso'); });

  function controllaAdmin() {
    return sb.rpc('is_admin').then(function (r) {
      if (r.error || r.data !== true) {
        // chi non è l'amministratore non resta collegato nemmeno per un attimo
        return sb.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () { vista('vista-negato'); });
      }
      vista('vista-gestione'); attivita();
      sb.auth.getSession().then(function (s) { var u = s.data && s.data.session && s.data.session.user; $('utente').value = (u && u.email) || ''; });
      return carica();
    });
  }

  // ── uscita automatica dopo 30 minuti senza usare il pannello ──
  var INATTIVITA = 30 * 60000, ultimo = Date.now();
  function attivita() { ultimo = Date.now(); }
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input'].forEach(function (ev) { document.addEventListener(ev, attivita, { passive: true, capture: true }); });
  function controllaInattivita() {
    if (!aperta) return;
    if (occupato) { attivita(); return; }   // durante un caricamento lungo non si esce
    if (Date.now() - ultimo >= INATTIVITA) esci('Sessione chiusa dopo 30 minuti senza attività: accedi di nuovo.');
  }
  setInterval(controllaInattivita, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) controllaInattivita(); });

  // ── cambio password ──
  function statoPw(testo, errore) {
    var el = $('stato-pw');
    el.textContent = testo || '';
    el.classList.toggle('errore', !!errore);
  }
  $('cambio').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = $('nuova').value, b = $('ripeti').value, nome = $('utente').value.toLowerCase().split('@')[0];
    if (a.length < 12) { statoPw('Serve una password di almeno 12 caratteri.', true); return; }
    if (a !== b) { statoPw('Le due password non coincidono.', true); return; }
    if (/^(.)\1+$/.test(a) || (nome.length >= 4 && a.toLowerCase().indexOf(nome) >= 0)) { statoPw('Troppo facile da indovinare: scegline un\'altra.', true); return; }
    var btn = $('salva-pw');
    btn.disabled = true; statoPw('Salvo la nuova password…');
    sb.auth.updateUser({ password: a }).then(function (r) {
      if (r.error) {
        var c = r.error.code || '';
        if (c === 'same_password') statoPw('È uguale a quella di prima: scegline una nuova.', true);
        else if (c === 'weak_password') statoPw('Password troppo debole: allungala o aggiungi numeri e simboli.', true);
        else if (c === 'reauthentication_needed' || r.error.status === 401) statoPw('Per sicurezza esci, rientra e riprova.', true);
        else statoPw('Non è stato possibile cambiare la password. Riprova.', true);
        return;
      }
      $('nuova').value = ''; $('ripeti').value = '';
      statoPw('Password cambiata. Da ora si entra con quella nuova.');
      return sb.auth.signOut({ scope: 'others' }).catch(function () {});   // gli altri dispositivi devono rientrare
    }).catch(function () { statoPw('Non riesco a collegarmi. Controlla la connessione e riprova.', true); })
      .then(function () { btn.disabled = false; });
  });

  // ── elenco ──
  function carica() {
    return sb.from('gallery_photos')
      .select('id,position,storage_path,ext,legacy_key,width,height,caption,category')
      .order('position', { ascending: true })
      .then(function (r) {
        if (r.error) { stato('Non riesco a leggere l\'elenco delle foto.', true); return; }
        foto = r.data || [];
        disegna();
      });
  }

  function disegna(focus) {
    var ol = $('elenco');
    while (ol.firstChild) ol.removeChild(ol.firstChild);
    $('conteggio').textContent = foto.length ? '(' + foto.length + ')' : '';
    $('vuoto').hidden = foto.length > 0;
    foto.forEach(function (p, i) { ol.appendChild(riga(p, i)); });
    if (focus) {
      var b = ol.querySelector('[data-id="' + focus.id + '"][data-az="' + focus.az + '"]:not(:disabled)') ||
              ol.querySelector('[data-id="' + focus.id + '"]:not(:disabled)');
      if (b) b.focus();
    }
  }

  function riga(p, i) {
    var li = el('li', 'foto');
    li.dataset.index = String(i);
    var img = el('img');
    img.src = urlFoto(p); img.alt = ''; img.loading = 'lazy'; img.width = 96; img.height = 128;
    li.appendChild(img);
    var info = el('div', 'info');
    info.appendChild(el('p', 'titolo', p.caption || 'Senza didascalia'));
    info.appendChild(el('p', 'meta', (i + 1) + '° · ' + (CATEGORIE[p.category] || 'Senza categoria') + (p.legacy_key ? ' · già nel sito' : '')));
    var az = el('div', 'azioni');
    az.appendChild(freccia(p, i, -1));
    az.appendChild(freccia(p, i, 1));
    az.appendChild(bottone('Elimina', 'btn-ghost btn-piccolo', 'Elimina la foto ' + (i + 1), function () { chiedi(az, p, i); }));
    info.appendChild(az);
    li.appendChild(info);
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) trascinabile(li);
    return li;
  }
  function freccia(p, i, d) {
    var b = bottone(d < 0 ? '↑' : '↓', 'btn-ghost btn-piccolo',
      (d < 0 ? 'Sposta su' : 'Sposta giù') + ' la foto ' + (i + 1), function () { sposta(i, i + d, d < 0 ? 'su' : 'giu'); });
    b.dataset.id = p.id; b.dataset.az = d < 0 ? 'su' : 'giu';
    b.disabled = i + d < 0 || i + d >= foto.length;
    return b;
  }

  function chiedi(az, p, i) {
    while (az.firstChild) az.removeChild(az.firstChild);
    az.className = 'azioni conferma';
    az.appendChild(el('span', null, 'Eliminare questa foto?'));
    var si = bottone('Sì, elimina', 'btn-peric btn-piccolo', null, function () { elimina(p); });
    var no = bottone('No', 'btn-ghost btn-piccolo', null, function () { disegna(); });
    az.appendChild(si); az.appendChild(no);
    no.focus();
  }

  function elimina(p) {
    if (occupato) return;
    occupato = true; stato('Elimino la foto…');
    sb.from('gallery_photos').delete().eq('id', p.id).select('id').then(function (r) {
      if (r.error || !r.data || !r.data.length) throw new Error('riga');
      if (p.storage_path) return bucket.remove([p.storage_path + '-800.' + p.ext, p.storage_path + '-1920.' + p.ext]).then(function () {});
    }).then(function () { stato('Foto eliminata.'); return carica(); })
      .catch(function () { stato('Non sono riuscito a eliminare la foto.', true); return carica(); })
      .then(function () { occupato = false; });
  }

  function sposta(da, a, az) {
    if (occupato || a < 0 || a >= foto.length || da === a) return;
    occupato = true;
    var prima = foto.slice();
    var m = foto.splice(da, 1)[0];
    foto.splice(a, 0, m);
    disegna({ id: m.id, az: az || 'su' });
    sb.rpc('reorder_gallery', { p_ids: foto.map(function (p) { return p.id; }) }).then(function (r) {
      if (r.error) throw new Error('ordine');
      stato('Ordine salvato.');
    }).catch(function () {
      foto = prima; disegna(); stato('Non sono riuscito a salvare il nuovo ordine.', true);
    }).then(function () { occupato = false; });
  }

  function trascinabile(li) {
    li.draggable = true;
    li.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', li.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
      li.classList.add('trascinata');
    });
    li.addEventListener('dragend', function () { li.classList.remove('trascinata'); });
    li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('sopra'); });
    li.addEventListener('dragleave', function () { li.classList.remove('sopra'); });
    li.addEventListener('drop', function (e) {
      e.preventDefault(); li.classList.remove('sopra');
      var da = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(da)) sposta(da, parseInt(li.dataset.index, 10));
    });
  }

  // ── caricamento ──
  $('scegli').addEventListener('click', function () { $('file').click(); });
  $('file').addEventListener('change', function () {
    var files = Array.prototype.slice.call($('file').files, 0, 20);
    $('file').value = '';
    if (!files.length) return;
    stato('Preparo le foto…');
    var falliti = [];
    files.reduce(function (p, f) {
      return p.then(function () {
        return window.ImageTools.prepare(f).then(function (prep) {
          coda.push({ prep: prep, caption: '', cat: '' });
        }).catch(function () { falliti.push(f.name); });
      });
    }, Promise.resolve()).then(function () {
      disegnaCoda();
      stato(falliti.length ? 'Non riesco a usare: ' + falliti.join(', ') + '.' : '', falliti.length > 0);
    });
  });

  function disegnaCoda() {
    var ul = $('coda');
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    coda.forEach(function (q, i) {
      var li = el('li', 'foto');
      var img = el('img'); img.src = q.prep.thumb; img.alt = ''; img.width = 96; img.height = 128;
      li.appendChild(img);
      var info = el('div', 'info');
      var lc = el('label', null, 'Didascalia (facoltativa)'); lc.htmlFor = 'dida-' + i;
      var ic = el('input'); ic.type = 'text'; ic.id = 'dida-' + i; ic.maxLength = 140; ic.value = q.caption;
      ic.addEventListener('input', function () { q.caption = ic.value; });
      var ls = el('label', null, 'Tipo di lavoro (facoltativo)'); ls.htmlFor = 'cat-' + i;
      var sel = el('select'); sel.id = 'cat-' + i;
      var o0 = el('option', null, 'Nessuno'); o0.value = ''; sel.appendChild(o0);
      Object.keys(CATEGORIE).forEach(function (k) { var o = el('option', null, CATEGORIE[k]); o.value = k; sel.appendChild(o); });
      sel.value = q.cat;
      sel.addEventListener('change', function () { q.cat = sel.value; });
      info.appendChild(lc); info.appendChild(ic); info.appendChild(ls); info.appendChild(sel);
      info.appendChild(bottone('Togli', 'btn-ghost btn-piccolo', 'Togli la foto ' + (i + 1) + ' dalla coda', function () { coda.splice(i, 1); disegnaCoda(); }));
      li.appendChild(info);
      ul.appendChild(li);
    });
    ul.hidden = !coda.length;
    $('coda-azioni').hidden = !coda.length;
    $('carica').textContent = coda.length > 1 ? 'Carica ' + coda.length + ' foto' : 'Carica la foto';
  }
  $('svuota').addEventListener('click', function () { coda = []; disegnaCoda(); stato(''); });

  $('carica').addEventListener('click', function () {
    if (occupato || !coda.length) return;
    occupato = true;
    var pos = foto.length ? Math.min.apply(null, foto.map(function (p) { return p.position; })) : 1;
    var base = pos - coda.length;
    var lavoro = coda.slice(), fatte = 0, errori = 0;
    var barra = $('avanzamento'); barra.hidden = false; barra.value = 0;
    ['carica', 'svuota', 'scegli'].forEach(function (id) { $(id).disabled = true; });
    stato('Carico le foto…');

    lavoro.reduce(function (p, q, k) {
      return p.then(function () {
        var id = crypto.randomUUID();
        var f800 = id + '-800.' + q.prep.ext, f1920 = id + '-1920.' + q.prep.ext;
        var ct = q.prep.ext === 'webp' ? 'image/webp' : 'image/jpeg';
        var opt = { contentType: ct, upsert: false, cacheControl: '31536000' };
        return bucket.upload(f800, q.prep.small, opt).then(function (r) {
          if (r.error) throw new Error('file');
          return bucket.upload(f1920, q.prep.big, opt);
        }).then(function (r) {
          if (r.error) throw new Error('file');
          return sb.from('gallery_photos').insert({
            position: base + k, storage_path: id, ext: q.prep.ext, width: q.prep.w, height: q.prep.h,
            caption: q.caption.trim() || null, category: q.cat || null
          });
        }).then(function (r) {
          if (r.error) throw new Error('riga');
          coda.splice(coda.indexOf(q), 1);
          fatte++;
        }).catch(function () {
          errori++;
          return bucket.remove([f800, f1920]).catch(function () {});   // niente file orfani se l'inserimento fallisce
        }).then(function () { barra.value = (fatte + errori) / lavoro.length * 100; });
      });
    }, Promise.resolve()).then(function () {
      barra.hidden = true;
      ['carica', 'svuota', 'scegli'].forEach(function (id) { $(id).disabled = false; });
      disegnaCoda();
      stato(errori ? 'Caricate ' + fatte + ' foto, ' + errori + ' non sono riuscite: riprova.' : (fatte === 1 ? 'Foto caricata.' : fatte + ' foto caricate.'), errori > 0);
      occupato = false;
      return carica();
    });
  });

  // ── avvio ──
  sb.auth.getSession().then(function (r) {
    if (r.data && r.data.session) return controllaAdmin();
    vista('vista-accesso');
  }).catch(function () { vista('vista-accesso'); });
})();
