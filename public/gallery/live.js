/* Galleria "Lavori fatti" gestita dal database: legge l'elenco con la sola chiave pubblica,
   riordina le foto già nella pagina e aggiunge quelle caricate dal cliente.
   Se la richiesta fallisce, o l'elenco è vuoto o non valido, la pagina resta com'è. */
(function () {
  'use strict';
  var cfg = window.GALLERY_CONFIG || {};
  var grid = document.getElementById('galGrid');
  if (!grid || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url || '') || !cfg.anonKey) return;

  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var CATS = ['prati', 'montagna', 'preparazione', 'recinzioni', 'corten', 'commerciale'];
  var SIZES = '(min-width: 900px) 540px, calc(100vw - 3rem)';
  var FALLBACK_ALT = 'Lavoro di Lisa Garden';

  function fileUrl(path, size, ext) {
    return cfg.url + '/storage/v1/object/public/gallery/' + path + '-' + size + '.' + ext;
  }
  function clean(r) {
    if (!r || typeof r !== 'object' || !UUID.test(r.id)) return null;
    var cat = CATS.indexOf(r.category) >= 0 ? r.category : null;
    var cap = typeof r.caption === 'string' ? r.caption.slice(0, 140) : '';
    if (typeof r.legacy_key === 'string' && /^gal-\d{1,3}$/.test(r.legacy_key)) {
      return { id: r.id, key: r.legacy_key, cat: cat };
    }
    if (typeof r.storage_path === 'string' && UUID.test(r.storage_path) && (r.ext === 'webp' || r.ext === 'jpg') &&
        Number.isInteger(r.width) && Number.isInteger(r.height) && r.width > 0 && r.height > 0 && r.width <= 8000 && r.height <= 8000) {
      return { id: r.id, path: r.storage_path, ext: r.ext, w: r.width, h: r.height, cat: cat, cap: cap };
    }
    return null;
  }

  function card(p) {
    var alt = p.cap || FALLBACK_ALT;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gal-item pop is-tall';
    if (p.cat) b.dataset.cat = p.cat;
    b.dataset.lb = '';
    b.dataset.photo = p.id;
    b.setAttribute('aria-label', 'Ingrandisci: ' + alt);
    var pic = document.createElement('picture');
    var img = document.createElement('img');
    img.src = fileUrl(p.path, 1920, p.ext);
    img.srcset = fileUrl(p.path, 800, p.ext) + ' 800w, ' + fileUrl(p.path, 1920, p.ext) + ' 1920w';
    img.sizes = SIZES;
    img.width = p.w; img.height = p.h;
    img.loading = 'lazy'; img.decoding = 'async';
    img.alt = alt;
    img.draggable = false;
    pic.appendChild(img);
    b.appendChild(pic);
    if (p.cap) {
      var s = document.createElement('span');
      s.className = 'gal-cap';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = p.cap;
      b.appendChild(s);
    }
    return b;
  }

  function setCount(el, n) {
    var span = el.querySelector('span');
    if (span) span.textContent = String(n);
  }

  function apply(rows) {
    var legacy = {};
    Array.prototype.forEach.call(grid.querySelectorAll('.gal-item[data-key]'), function (el) { legacy[el.dataset.key] = el; });
    var ordered = [];
    rows.forEach(function (p) {
      var el = p.key ? legacy[p.key] : card(p);
      if (!el) return;
      if (p.key && p.cat) el.dataset.cat = p.cat;
      ordered.push(el);
    });
    if (!ordered.length) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    ordered.forEach(function (el) { grid.appendChild(el); });

    var counts = {};
    ordered.forEach(function (el) { var c = el.dataset.cat; if (c) counts[c] = (counts[c] || 0) + 1; });
    Array.prototype.forEach.call(document.querySelectorAll('.gal-filter'), function (btn) {
      var f = btn.dataset.filter;
      var n = f === 'tutti' ? ordered.length : (counts[f] || 0);
      setCount(btn, n);
      btn.hidden = f !== 'tutti' && n === 0;
    });
    var more = document.getElementById('galMore');
    if (more) setCount(more, ordered.length);
    document.dispatchEvent(new CustomEvent('gallery:updated'));
  }

  var ctl = new AbortController();
  var timer = setTimeout(function () { ctl.abort(); }, 4000);
  fetch(cfg.url + '/rest/v1/gallery_photos?select=id,position,storage_path,ext,legacy_key,width,height,caption,category&order=position.asc', {
    headers: /^eyJ/.test(cfg.anonKey) ? { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey } : { apikey: cfg.anonKey },
    signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function (data) {
    if (!Array.isArray(data)) return;
    var rows = data.map(clean).filter(Boolean);
    window.__galleryDone = true;
    apply(rows);
  }).catch(function () { /* la galleria scritta nella pagina resta */ })
    .then(function () { clearTimeout(timer); });
})();
