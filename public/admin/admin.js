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
    $('logout').hidden = nome !== 'vista-gestione' && nome !== 'vista-negato';
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

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url || '') || !cfg.anonKey) { vista('vista-spenta'); return; }
  var sb = supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  var bucket = sb.storage.from('gallery');
  var foto = [];            // righe della tabella, in ordine
  var coda = [];            // foto preparate e non ancora caricate
  var occupato = false;

  function urlFoto(p) {
    if (p.legacy_key) return '../assets/img/' + p.legacy_key + '-480.webp';
    return bucket.getPublicUrl(p.storage_path + '-800.' + p.ext).data.publicUrl;
  }

  // ── accesso ──
  $('accesso').addEventListener('submit', function (e) {
    e.preventDefault();
    var b = $('entra');
    b.disabled = true; stato('Accesso in corso…');
    sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value })
      .then(function (r) {
        $('password').value = '';
        if (r.error) { stato('Email o password non corretti.', true); return; }
        stato(''); return controllaAdmin();
      })
      .catch(function () { stato('Non riesco a collegarmi. Controlla la connessione e riprova.', true); })
      .then(function () { b.disabled = false; });
  });
  $('logout').addEventListener('click', function () {
    sb.auth.signOut().then(function () { foto = []; coda = []; stato(''); vista('vista-accesso'); });
  });

  function controllaAdmin() {
    return sb.rpc('is_admin').then(function (r) {
      if (r.error || r.data !== true) { vista('vista-negato'); return; }
      vista('vista-gestione');
      return carica();
    });
  }

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
