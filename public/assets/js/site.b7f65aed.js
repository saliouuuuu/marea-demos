(function() {
  // ── Elementi creati dallo script: sempre con il DOM, mai come testo HTML ──
  // La CSP del sito impone i Trusted Types: innerHTML e simili sono bloccati ovunque,
  // così nessun testo (nemmeno uno arrivato dal database) può diventare codice nella pagina.
  var SVGNS = 'http://www.w3.org/2000/svg';
  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function svg(viewBox, attrs, shapes) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', viewBox); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    Object.keys(attrs).forEach(function(k) { s.setAttribute(k, attrs[k]); });
    shapes.forEach(function(sh) {
      var n = document.createElementNS(SVGNS, sh[0]);
      Object.keys(sh[1]).forEach(function(k) { n.setAttribute(k, sh[1][k]); });
      s.appendChild(n);
    });
    return s;
  }

  // ── Scroll reveal ──
  var reveals = document.querySelectorAll('.reveal, .pop');
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach(function(el) { observer.observe(el); });

  // ── Animazioni ambientali solo nelle sezioni sullo schermo ──
  // Il margine di -2px: una sezione che tocca appena il bordo dello schermo (come "Chi siamo" sotto
  // l'hero) conta come fuori. Altrimenti le sue animazioni restano accese fuori vista e il browser
  // le aggiorna sul thread principale, ricalcolando lo stile di tutta la pagina a ogni giro.
  var ambientObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { e.target.classList.toggle('is-offscreen', !e.isIntersecting); });
  }, { rootMargin: '-2px 0px' });
  document.querySelectorAll('main > section').forEach(function(sec) { ambientObserver.observe(sec); });

  // ── Un solo giro per fotogramma durante lo scorrimento ──
  // Ogni effetto legato allo scorrimento registra una lettura (misure) e una scrittura (stili).
  // Prima si leggono tutte le misure, poi si scrive: così il browser ricalcola la pagina una volta
  // sola per fotogramma invece di una volta per effetto.
  var scrollJobs = [], scrollQueued = false;
  function onScrollFrame(read, write) { scrollJobs.push([read, write]); }
  function runScrollFrame() {
    scrollQueued = false;
    var y = window.scrollY, vh = window.innerHeight;
    var vals = scrollJobs.map(function(j) { return j[0](y, vh); });
    scrollJobs.forEach(function(j, k) { j[1](vals[k], y, vh); });
  }
  function queueScrollFrame() { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(runScrollFrame); } }
  window.addEventListener('scroll', queueScrollFrame, { passive: true });
  window.addEventListener('resize', queueScrollFrame, { passive: true });
  // dove il browser sa legare le animazioni allo scorrimento (CSS animation-timeline), i movimenti
  // di hero, galleria e ritratto li fa il CSS sul compositore e qui non si calcolano
  var cssScrollFx = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));
  if (cssScrollFx) document.documentElement.classList.add('sfx');

  // ── Nav scroll ──
  // sopra l'hero scuro la barra resta trasparente; diventa chiara quando si esce
  var nav = document.getElementById('nav');
  var heroEl = document.querySelector('.hero'), heroEnd = 50;
  function measureHero() { heroEnd = heroEl ? heroEl.offsetTop + heroEl.offsetHeight - 60 : 50; queueScrollFrame(); }
  measureHero();
  window.addEventListener('resize', measureHero);
  window.addEventListener('load', measureHero);
  onScrollFrame(function() { return 0; }, function(_, y) {
    nav.classList.toggle('scrolled', y > heroEnd);
    nav.classList.toggle('over-hero', y > 50 && y <= heroEnd);
  });

  // ── Menu mobile ──
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  function closeMenu() {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Apri il menu');
  }
  function openMenu() {
    navLinks.classList.add('open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Chiudi il menu');
  }
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function() {
      if (navLinks.classList.contains('open')) closeMenu(); else openMenu();
    });
    navLinks.querySelectorAll('a').forEach(function(a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) { closeMenu(); navToggle.focus(); }
    });
    document.addEventListener('click', function(e) {
      if (navLinks.classList.contains('open') && !navLinks.contains(e.target) && !navToggle.contains(e.target)) closeMenu();
    });
  }

  // ── WhatsApp flottante: nascondilo quando il wizard è a schermo ──
  // così non copre mai i controlli "Avanti/Invia" del form.
  var waFloat = document.querySelector('.wa-float');
  var prevSection = document.getElementById('preventivo');
  if (waFloat && prevSection && 'IntersectionObserver' in window) {
    var waObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        waFloat.classList.toggle('is-hidden', e.isIntersecting);
      });
    }, { threshold: 0.12 });
    waObserver.observe(prevSection);
  }

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Hero: scorrendo, le piante si allargano verso i bordi ──
  (function() {
    var hero = document.querySelector('.hero');
    if (!hero || prefersReduced || cssScrollFx) return;
    var last = -1;
    onScrollFrame(function(y) { return Math.min(1, Math.max(0, y / (hero.offsetHeight || window.innerHeight))); },
      function(p) { if (p > 1 && last >= 1) return; var v = p.toFixed(3); if (v !== last) { last = v; hero.style.setProperty('--s', v); } });
  })();



  // ── Dall'hero al prima e dopo ──
  // Il confronto si avvicina mentre la sezione entra; se si smette di
  // scorrere a metà strada dall'hero, la pagina accompagna fino alla
  // sezione; i link alla sezione aprono la tendina «prima e dopo».
  var pdWipe = null;
  (function() {
    var sec = document.getElementById('prima-dopo');
    var hero = document.querySelector('.hero');
    var wipe = document.getElementById('pdWipe');
    if (!sec || !hero || prefersReduced) return;
    var root = document.documentElement;
    function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
    function tween(ms, fn) {
      return new Promise(function(res) {
        var t0 = performance.now();
        (function f(now) {
          var k = Math.min(1, (now - t0) / ms);
          fn(ease(k));
          if (k < 1) requestAnimationFrame(f); else res();
        })(t0);
      });
    }
    function targetY() { return Math.round(sec.getBoundingClientRect().top + window.scrollY); }
    var intro = document.getElementById('chi-siamo');
    function introY() { return Math.round(intro.getBoundingClientRect().top + window.scrollY); }
    function jump(y) { root.style.scrollBehavior = 'auto'; window.scrollTo(0, y); root.style.scrollBehavior = ''; }

    // dove il browser lo sa fare, l'avvicinamento lo fa il CSS legato allo scorrimento (.sfx):
    // qui solo il ripiego, e la variabile va sul palco, non su tutta la sezione
    var stage = sec.querySelector('.pd-stage'), lastE = '';
    if (!cssScrollFx && stage) onScrollFrame(function(y, vh) { var t = sec.getBoundingClientRect().top; return Math.min(1, Math.max(0, (vh - t) / (vh * 0.85))); },
      function(e) { var v = e.toFixed(3); if (v !== lastE) { lastE = v; stage.style.setProperty('--e', v); } });

    // accompagnamento: solo scendendo, a scorrimento fermo, dita sollevate.
    // Lo scorrimento morbido è quello del browser (gira fuori dal JavaScript, non scatta);
    // un nuovo gesto lo interrompe da solo.
    var glide = 0, lastY = window.scrollY, down = false, idle = 0, touching = false;
    function stopGlide() { if (glide) { clearTimeout(glide); glide = 0; } }
    function glideTo(y) {
      glide = setTimeout(function() { glide = 0; }, 1200);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    window.addEventListener('scrollend', function() { if (glide) stopGlide(); });
    function check() {
      if (touching || glide || !down || (wipe && wipe.classList.contains('is-on'))) return;
      var y = window.scrollY, t = introY();
      if (y > hero.offsetHeight * 0.12 && y < t - 8) glideTo(t);
    }
    window.addEventListener('scroll', function() {
      var y = window.scrollY;
      if (glide) { lastY = y; return; }
      if (y !== lastY) down = y > lastY;
      lastY = y;
      clearTimeout(idle); idle = setTimeout(check, 160);
    }, { passive: true });
    ['wheel', 'keydown', 'pointerdown'].forEach(function(ev) { window.addEventListener(ev, stopGlide, { passive: true }); });
    window.addEventListener('touchstart', function() { touching = true; stopGlide(); }, { passive: true });
    window.addEventListener('touchend', function() { touching = false; clearTimeout(idle); idle = setTimeout(check, 160); }, { passive: true });

    // tendina: copre lo schermo come il cursore del confronto, porta alla
    // sezione e la scopre; poi il confronto parte da solo
    if (!wipe) return;
    function set(l, r, line) { wipe.style.setProperty('--lft', l + '%'); wipe.style.setProperty('--r', r + '%'); wipe.style.setProperty('--l', line + '%'); }
    pdWipe = function() {
      if (wipe.classList.contains('is-on')) return;
      stopGlide();
      set(0, 100, 0);
      wipe.classList.add('is-on');
      tween(560, function(e) { set(0, 100 - 100 * e, 100 * e); })
        .then(function() { jump(targetY()); return new Promise(function(r) { setTimeout(r, 380); }); })
        .then(function() { return tween(640, function(e) { set(100 * e, 0, 100 * e); }); })
        .then(function() { wipe.classList.remove('is-on'); set(0, 100, 0); });
    };
  })();

  // ════ ANIMAZIONI "VIVE" ════
  // titoli: divide in parole (il testo resta lo stesso per i lettori di schermo)
  document.querySelectorAll('.split').forEach(function(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function(n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function(part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span'); w.className = 'w';
            var inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
  });
  var inView = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('is-in'); inView.unobserve(e.target); } });
  }, { threshold: 0.35 });
  document.querySelectorAll('.split').forEach(function(el) { inView.observe(el); });
  // texture (foglie, terra) scaricate solo quando la sezione si avvicina
  var nearIO = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('is-near'); nearIO.unobserve(e.target); } });
  }, { rootMargin: '700px 0px' });
  document.querySelectorAll('.tex-hedge, .tex-grass, .quals').forEach(function(el) { nearIO.observe(el); });
  // carta strappata: si strappa quando il bordo entra nello schermo
  var tearIO = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll(':scope > .tear').forEach(function(t) {
        var r = t.getBoundingClientRect();
        if (r.top < innerHeight * 0.92 && r.bottom > 0) t.classList.add('is-in');
      });
    });
  }, { threshold: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1] });
  document.querySelectorAll('.tear').forEach(function(t) { tearIO.observe(t.parentElement); });
  window.addEventListener('scroll', function onTear() {
    var left = document.querySelectorAll('.tear:not(.is-in)');
    if (!left.length) { window.removeEventListener('scroll', onTear); return; }
    left.forEach(function(t) { var r = t.getBoundingClientRect(); if (r.top < innerHeight * 0.92 && r.bottom > 0) t.classList.add('is-in'); });
  }, { passive: true });

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // pietre che seguono il mouse (profondità diverse)
  if (finePointer && !prefersReduced) {
    var floaters = document.querySelectorAll('[data-depth]');
    var fx = 0, fy = 0, ftick = false;
    window.addEventListener('pointermove', function(e) {
      fx = e.clientX / innerWidth - 0.5; fy = e.clientY / innerHeight - 0.5;
      if (ftick) return; ftick = true;
      requestAnimationFrame(function() {
        ftick = false;
        floaters.forEach(function(el) {
          var d = parseFloat(el.dataset.depth) || 0;
          el.style.setProperty('--mx', (fx * d).toFixed(1) + 'px');
          el.style.setProperty('--my', (fy * d).toFixed(1) + 'px');
        });
      });
    }, { passive: true });

    // passi: inclinazione 3D
    document.querySelectorAll('.step').forEach(function(card) {
      card.addEventListener('pointermove', function(e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (((e.clientY - r.top) / r.height - 0.5) * -12).toFixed(2) + 'deg');
      });
      card.addEventListener('pointerleave', function() { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });

    // cursore ad anello
    var ring = document.createElement('div'); ring.className = 'cursor-ring'; ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);
    var cx = -100, cy = -100, rx = -100, ry = -100, ringOn = false;
    window.addEventListener('pointermove', function(e) {
      cx = e.clientX; cy = e.clientY;
      if (!ringOn) { ringOn = true; ring.classList.add('is-on'); requestAnimationFrame(follow); }
      ring.classList.toggle('is-link', !!(e.target.closest && e.target.closest('a, button, [role="slider"]')));
    }, { passive: true });
    document.addEventListener('pointerleave', function() { ring.classList.remove('is-on'); });
    function follow() {
      rx += (cx - rx) * 0.2; ry += (cy - ry) * 0.2;
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      if (Math.abs(cx - rx) > 0.1 || Math.abs(cy - ry) > 0.1) requestAnimationFrame(follow); else ringOn = false;
    }
  }

  // ── Formazione: dalla terra al prato ──
  // Su una maschera si disegnano "cespi" che crescono; il prato vero
  // (foto) compare solo dove la maschera è piena.
  (function() {
    var panel = document.getElementById('quals');
    var cv = document.getElementById('qualsMoss');
    if (!panel || !cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var mask = document.createElement('canvas'), mctx = mask.getContext('2d');
    var grass = new Image();
    function loadGrass() { if (!grass.src) grass.src = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'assets/img/texture-prato.webp' : 'assets/img/texture-prato.jpg'; }
    new IntersectionObserver(function(e, o) { if (e[0].isIntersecting) { loadGrass(); o.disconnect(); } }, { rootMargin: '600px 0px' }).observe(panel);
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var tufts = [], running = false, visible = false, lastX = -999, lastY = -999;
    function size() {
      var r = panel.getBoundingClientRect();
      W = Math.round(r.width); H = Math.round(r.height);
      cv.width = mask.width = Math.round(W * dpr); cv.height = mask.height = Math.round(H * dpr);
      redrawAll();
    }
    function add(x, y, big) {
      var R = (big ? 90 : 46) * (0.7 + Math.random() * 0.6);
      var blades = [];
      for (var k = 0; k < 52; k++) blades.push({ a: Math.random() * Math.PI * 2, d: Math.random(), s: Math.random() });
      tufts.push({ x: x, y: y, R: R, t: 0, blades: blades });
      if (tufts.length > 400) tufts.splice(0, 1);
      panel.classList.add('has-grown');
      if (!running) { running = true; requestAnimationFrame(tick); }
    }
    function drawTuft(t) {
      var g = 1 - Math.pow(1 - Math.min(1, t.t), 3);
      var r = t.R * g;
      if (r < 1) return;
      mctx.save(); mctx.scale(dpr, dpr); mctx.fillStyle = '#000';
      // cespo pieno con bordo irregolare
      mctx.beginPath();
      for (var k = 0; k <= 24; k++) {
        var a = k / 24 * Math.PI * 2, j = 0.78 + 0.22 * Math.sin(a * 3 + t.R) * Math.cos(a * 5 + t.x);
        var px = t.x + Math.cos(a) * r * j, py = t.y + Math.sin(a) * r * j;
        if (k) mctx.lineTo(px, py); else mctx.moveTo(px, py);
      }
      mctx.closePath(); mctx.fill();
      // fili d'erba sul bordo, più lunghi verso l'alto
      t.blades.forEach(function(bl) {
        var a = bl.a, up = Math.max(0, -Math.sin(a));
        var x0 = t.x + Math.cos(a) * r * 0.7, y0 = t.y + Math.sin(a) * r * 0.7;
        var len = r * (0.35 + bl.s * 0.5 + up * 0.5);
        var tx = x0 + Math.cos(a) * len * 0.5 + (bl.d - 0.5) * r * 0.3, ty = y0 + Math.sin(a) * len - up * len * 0.4;
        var wv = r * 0.035 + 0.9, nx = -Math.sin(a) * wv, ny = Math.cos(a) * wv;
        mctx.beginPath(); mctx.moveTo(x0 + nx, y0 + ny); mctx.quadraticCurveTo((x0 + tx) / 2 + nx, (y0 + ty) / 2, tx, ty); mctx.lineTo(x0 - nx, y0 - ny); mctx.fill();
      });
      mctx.restore();
    }
    // ricompone il prato solo nel rettangolo che è cambiato (in pixel del canvas)
    function compose(x, y, w, h) {
      if (x === undefined) { x = 0; y = 0; w = cv.width; h = cv.height; }
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(x, y, w, h);
      if (grass.complete && grass.naturalWidth) {
        var sc = Math.max(cv.width / grass.naturalWidth, cv.height / grass.naturalHeight);
        var gw = grass.naturalWidth * sc, gh = grass.naturalHeight * sc;
        ctx.drawImage(grass, (cv.width - gw) / 2, (cv.height - gh) / 2, gw, gh);
      } else { ctx.fillStyle = '#4f7f35'; ctx.fillRect(x, y, w, h); }
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      ctx.restore();
    }
    function redrawAll() { mctx.clearRect(0, 0, mask.width, mask.height); tufts.forEach(drawTuft); compose(); }
    // i cespi crescono soltanto: a ogni fotogramma si disegnano sopra solo quelli che stanno crescendo,
    // senza cancellare e ridisegnare tutto il prato
    function tick() {
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      tufts.forEach(function(t) {
        if (t.t >= 1) return;
        t.t = Math.min(1, t.t + 0.035);
        drawTuft(t);
        var m = t.R * 2.3;
        x0 = Math.min(x0, t.x - m); y0 = Math.min(y0, t.y - m); x1 = Math.max(x1, t.x + m); y1 = Math.max(y1, t.y + m);
      });
      if (x1 > x0) {
        var px = Math.max(0, Math.floor(x0 * dpr)), py = Math.max(0, Math.floor(y0 * dpr));
        compose(px, py, Math.min(cv.width, Math.ceil(x1 * dpr)) - px, Math.min(cv.height, Math.ceil(y1 * dpr)) - py);
      }
      if (x1 > x0 && visible) requestAnimationFrame(tick); else running = false;
    }
    function local(e) { var r = panel.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    panel.addEventListener('pointermove', function(e) {
      if (e.pointerType !== 'mouse') return;
      var p = local(e);
      if (Math.hypot(p[0] - lastX, p[1] - lastY) < 26) return;
      lastX = p[0]; lastY = p[1]; add(p[0], p[1], false);
    });
    function burst(e) {
      var p = local(e);
      add(p[0], p[1], true);
      for (var k = 0; k < 5; k++) add(p[0] + (Math.random() - 0.5) * 120, p[1] + (Math.random() - 0.5) * 90, false);
    }
    // col mouse cresce alla pressione; col dito solo con un tocco vero (click), non quando si appoggia il dito per scorrere
    var lastPointer = 'mouse';
    panel.addEventListener('pointerdown', function(e) { lastPointer = e.pointerType || 'mouse'; if (lastPointer === 'mouse') burst(e); });
    panel.addEventListener('click', function(e) { if (lastPointer !== 'mouse') burst(e); });
    grass.onload = function() { if (W) compose(); };
    window.addEventListener('resize', function() { if (W) size(); });
    var seeded = false;
    new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        visible = e.isIntersecting;
        if (!visible) return;
        if (!W) size();
        if (!seeded) {
          seeded = true;
          if (prefersReduced) {
            for (var k = 0; k < 6; k++) { add(Math.random() * W, H * (0.75 + Math.random() * 0.3), true); }
            tufts.forEach(function(t) { t.t = 1; }); redrawAll();
            return;
          }
          // il prato parte dagli angoli in basso, da solo
          var seq = [[0.04, 0.96], [0.96, 0.98], [0.2, 1.02], [0.8, 1.04], [0.5, 1.06], [0.08, 0.7], [0.92, 0.72]];
          seq.forEach(function(q, k) { setTimeout(function() { add(q[0] * W, q[1] * H, true); }, 350 + k * 220); });
        } else if (!running) { running = true; requestAnimationFrame(tick); }
      });
    }, { threshold: 0.2 }).observe(panel);
  })();


  // ── Come lavoriamo: il passo al centro dello schermo si accende ──
  (function() {
    var list = document.getElementById('stepsList');
    if (!list) return;
    var steps = Array.prototype.slice.call(list.querySelectorAll('.step'));
    var wide = window.matchMedia('(min-width: 1000px)');
    var cycle = null, inViewNow = false;
    function setActive(k, frac) {
      steps.forEach(function(st, j) { st.classList.toggle('is-active', j === k); st.classList.toggle('is-done', j < k); });
      list.style.setProperty('--sp', frac.toFixed(3));
    }
    if (prefersReduced) { steps.forEach(function(st) { st.classList.add('is-done'); }); list.style.setProperty('--sp', 1); return; }
    function onScroll() {
      if (wide.matches) return;
      var mid = innerHeight * 0.55, best = 0, bd = 1e9;
      steps.forEach(function(st, j) { var r = st.getBoundingClientRect(); var d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = j; } });
      var r0 = steps[0].getBoundingClientRect(), r1 = steps[steps.length - 1].getBoundingClientRect();
      var frac = Math.min(1, Math.max(0, (mid - (r0.top + r0.height / 2)) / ((r1.top + r1.height / 2) - (r0.top + r0.height / 2))));
      setActive(best, frac);
    }
    onScrollFrame(function(y, vh) {
      if (!inViewNow || wide.matches) return null;
      return steps.map(function(st) { var r = st.getBoundingClientRect(); return r.top + r.height / 2; });
    }, function(c, y, vh) {
      if (!c) return;
      var mid = vh * 0.55, best = 0, bd = 1e9;
      c.forEach(function(v, j) { var d = Math.abs(v - mid); if (d < bd) { bd = d; best = j; } });
      setActive(best, Math.min(1, Math.max(0, (mid - c[0]) / (c[c.length - 1] - c[0]))));
    });
    new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        inViewNow = e.isIntersecting;
        list.classList.toggle('is-live', inViewNow);
        clearInterval(cycle);
        if (!inViewNow) return;
        if (wide.matches) {
          var k = 0; setActive(0, 0);
          cycle = setInterval(function() { k = (k + 1) % steps.length; setActive(k, k / (steps.length - 1)); }, 2200);
        } else onScroll();
      });
    }, { threshold: 0.15 }).observe(list);
    steps.forEach(function(st, j) {
      st.addEventListener('pointerenter', function() { if (!wide.matches) return; clearInterval(cycle); setActive(j, j / (steps.length - 1)); });
    });
  })();

  // ── Galleria: parallasse delle foto dentro la cornice ──
  (function() {
    if (prefersReduced) return;
    var grid = document.getElementById('galGrid');
    if (!grid) return;
    if (cssScrollFx) return;
    var on = false;
    onScrollFrame(function(y, vh) {
      if (!on) return null;
      var out = [];
      grid.querySelectorAll('.gal-item.visible:not([hidden])').forEach(function(it) {
        var r = it.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) return;
        out.push([it, (r.top + r.height / 2 - vh / 2) / vh]);
      });
      return out;
    }, function(list) {
      if (list) list.forEach(function(x) { x[0].querySelector('img').style.setProperty('--py', (x[1] * -9).toFixed(2) + '%'); });
    });
    new IntersectionObserver(function(e) { on = e[0].isIntersecting; if (on) queueScrollFrame(); }).observe(grid);
  })();


  // ── Ritratto che scorre piano; pulsanti "magnetici" col mouse ──
  (function() {
    if (prefersReduced) return;
    var fr = document.querySelector('.about-portrait .about-frame img');
    if (fr && !cssScrollFx) {
      onScrollFrame(function(y, vh) {
        var r = fr.parentNode.getBoundingClientRect();
        return (r.bottom < 0 || r.top > vh) ? null : ((r.top + r.height / 2 - vh / 2) * -0.06).toFixed(1) + 'px';
      }, function(v) { if (v !== null) fr.style.setProperty('--ap', v); });
    }
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('.hero-cta, .prev-next, .nav-cta-link').forEach(function(btn) {
      btn.addEventListener('pointermove', function(e) {
        var r = btn.getBoundingClientRect();
        btn.style.setProperty('--mgx', ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px');
        btn.style.setProperty('--mgy', ((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1) + 'px');
      });
      btn.addEventListener('pointerleave', function() { btn.style.setProperty('--mgx', '0px'); btn.style.setProperty('--mgy', '0px'); });
    });
  })();

  // ── Servizi: un servizio aperto alla volta, la foto grande lo segue ──
  (function() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.svc-item'));
    if (!items.length) return;
    var shots = document.querySelectorAll('.svc-shot');
    var caps = document.querySelectorAll('.svc-cap');
    var desk = window.matchMedia('(min-width: 1000px)');
    var current = 0;
    function show(i) {
      Array.prototype.forEach.call(shots, function(el, k) {
        el.classList.toggle('was-on', k === current && k !== i);
        el.classList.toggle('is-on', k === i);
        if (k !== i && k !== current) el.classList.remove('was-on');
      });
      Array.prototype.forEach.call(caps, function(el, k) { el.classList.toggle('is-on', k === i); });
      document.querySelectorAll('.svc-amb').forEach(function(el, k) { el.classList.toggle('is-on', k === i); });
      current = i;
    }
    function open(i, toggle) {
      items.forEach(function(it, k) {
        var on = k === i ? (toggle && !desk.matches ? !it.classList.contains('is-open') : true) : false;
        it.classList.toggle('is-open', on);
        it.querySelector('.svc-toggle').setAttribute('aria-expanded', on ? 'true' : 'false');
      });
      if (i !== current) show(i);
    }
    items.forEach(function(it, k) {
      var btn = it.querySelector('.svc-toggle');
      btn.addEventListener('click', function() {
        open(k, true);
        // su telefono, se chiudendo quello sopra il titolo scappa in alto, lo riporta in vista
        if (!desk.matches) setTimeout(function() {
          var top = it.getBoundingClientRect().top;
          if (top < 70) window.scrollBy({ top: top - 80, behavior: prefersReduced ? 'auto' : 'smooth' });
        }, 720);
      });
      // con il mouse basta passarci sopra (con un attimo di pausa, per non far ballare le foto)
      var t = null;
      btn.addEventListener('mouseenter', function() {
        if (!desk.matches) return;
        t = setTimeout(function() { open(k, false); }, 140);
      });
      btn.addEventListener('mouseleave', function() { clearTimeout(t); });
    });
    // senza script restano tutti aperti; con lo script si parte dal primo
    open(0, false);
    desk.addEventListener('change', function() {
      var openOne = items.filter(function(it) { return it.classList.contains('is-open'); })[0];
      open(openOne ? items.indexOf(openOne) : current, false);
    });
  })();

  // ── Prima e dopo: confronto a più fasi ──
  // Ogni lavoro ha le sue fasi, tutte riprese e allineate sulla stessa
  // inquadratura. A sinistra del cursore la fase scelta, a destra il finito.
  var PROJECTS = [
    {
      "id": "vialetto",
      "title": "Aiuola lungo il vialetto",
      "kind": "Giardino privato",
      "desc": "Dalle erbe spontanee alla ghiaia decorativa: infestanti tolte, terreno livellato, bordure scure e ghiaia in quattro colori disegnata a curve, con corteccia attorno alle piante che c'erano già.",
      "w": [
        480,
        720,
        960
      ],
      "stages": [
        {
          "key": "prima",
          "label": "Prima",
          "alt": "aiuola lungo il vialetto in pietra invasa da erbe spontanee, con terreno scoperto"
        },
        {
          "key": "durante",
          "label": "Durante",
          "alt": "terreno ripulito, livellato e rastrellato, con il bordo verso il vialetto tracciato"
        },
        {
          "key": "finito",
          "label": "Dopo",
          "alt": "aiuola con ghiaia decorativa rosa, bianca, nera e verde disegnata a curve, bordure scure e corteccia attorno alle piante"
        }
      ]
    },
    {
      "id": "corten",
      "title": "Ciottolato e fioriere in Corten",
      "kind": "Giardino residenziale",
      "desc": "Da terreno scavato a giardino in ghiaia lungo muro e recinzione: scavo con mini escavatore, telo antierba, irrigazione a goccia, ghiaia chiara e vasche in acciaio corten piantate.",
      "w": [
        480,
        720
      ],
      "stages": [
        {
          "key": "scavo",
          "label": "Scavo",
          "alt": "terreno scavato con il mini escavatore e piante in vaso in attesa"
        },
        {
          "key": "telo",
          "label": "Telo",
          "alt": "telo antierba steso e piante disposte nei vasi"
        },
        {
          "key": "ghiaia",
          "label": "Irrigazione",
          "alt": "impianto a goccia sul telo e prima ghiaia"
        },
        {
          "key": "finito",
          "label": "Finito",
          "alt": "aiuola in ghiaia chiara con piante e vasche in corten lungo il muro e la recinzione"
        }
      ]
    },
    {
      "id": "barbecue",
      "title": "Angolo barbecue",
      "kind": "Giardino in montagna",
      "desc": "Angolo invaso dalle erbacce recuperato: pulizia e livellamento del terreno, muretto in tufo con aiuola piantata, prato nuovo davanti alla piazzola del barbecue.",
      "w": [
        480,
        720
      ],
      "stages": [
        {
          "key": "prima",
          "label": "Prima",
          "alt": "angolo del giardino invaso dalle erbacce"
        },
        {
          "key": "muretto",
          "label": "Muretto",
          "alt": "muretto in tufo in costruzione su terra livellata"
        },
        {
          "key": "aiuola",
          "label": "Aiuola",
          "alt": "aiuola nel muretto piantata e piazzola del barbecue pronta"
        },
        {
          "key": "finito",
          "label": "Finito",
          "alt": "prato nuovo, muretto in tufo con aiuola e piazzola del barbecue"
        }
      ]
    },
    {
      "id": "scalini",
      "title": "Da erbacce a prato",
      "kind": "Giardino in montagna",
      "desc": "Superficie coperta di erbacce riportata a giardino: prato nuovo, vialetto in pietra e bordure in corteccia, nella stessa inquadratura dagli scalini.",
      "w": [
        480,
        720
      ],
      "stages": [
        {
          "key": "prima",
          "label": "Prima",
          "alt": "giardino coperto di erbacce visto dagli scalini in pietra"
        },
        {
          "key": "finito",
          "label": "Dopo",
          "alt": "prato nuovo con vialetto in pietra e bordure in corteccia visto dagli scalini"
        }
      ]
    },
    {
      "id": "aiuola",
      "title": "Aiuola curva",
      "kind": "Giardino in montagna",
      "desc": "Dal prato secco a un'aiuola disegnata: bordura curva posata sulla terra lavorata, prato nuovo e pacciamatura attorno a rose e peonie lungo la recinzione.",
      "w": [
        480,
        720,
        960
      ],
      "stages": [
        {
          "key": "prima",
          "label": "Prima",
          "alt": "prato secco accanto al vialetto in pietra"
        },
        {
          "key": "bordura",
          "label": "Bordura",
          "alt": "bordura curva posata sulla terra lavorata"
        },
        {
          "key": "finito",
          "label": "Finito",
          "alt": "prato nuovo con bordura curva e aiuola pacciamata con rose e peonie"
        }
      ]
    },
    {
      "id": "recinto",
      "title": "Aiuola lungo la recinzione",
      "kind": "Giardino residenziale",
      "desc": "Terra smossa lungo la recinzione trasformata in aiuola: scavo con mini escavatore, vasca in acciaio corten piantata e ghiaia di finitura.",
      "w": [
        480,
        720,
        960
      ],
      "stages": [
        {
          "key": "scavo",
          "label": "Scavo",
          "alt": "mini escavatore al lavoro sulla terra smossa lungo la recinzione"
        },
        {
          "key": "finito",
          "label": "Dopo",
          "alt": "vasca in corten piantata lungo la recinzione e aiuola in ghiaia"
        }
      ]
    },
    {
      "id": "commerciale",
      "title": "Area verde commerciale",
      "kind": "Spazio commerciale",
      "desc": "Striscia di prato davanti alle vetrine sostituita da un'aiuola con cippato e corteccia e piante ornamentali.",
      "w": [
        480,
        720,
        960
      ],
      "stages": [
        {
          "key": "prima",
          "label": "Prima",
          "alt": "striscia di prato davanti alle vetrine di un edificio commerciale"
        },
        {
          "key": "finito",
          "label": "Dopo",
          "alt": "aiuola con cippato e corteccia e piante ornamentali davanti alle vetrine"
        }
      ]
    }
  ];
  var PD_SIZES = '(min-width: 900px) 470px, calc(100vw - 3rem)';
  var slider = document.getElementById('baSlider');
  var layersBox = document.getElementById('pdLayers');
  var tagBefore = document.getElementById('baTagBefore');
  var tagAfter = document.getElementById('baTagAfter');
  var timeline = document.getElementById('pdTimeline');
  var playBtn = document.getElementById('pdPlay');
  var playLabel = document.getElementById('pdPlayLabel');
  var picks = document.querySelectorAll('.pd-pick');
  var pdKind = document.getElementById('pdKind');
  var pdTitle = document.getElementById('pdTitle');
  var pdDesc = document.getElementById('pdDesc');

  var proj = PROJECTS[0];
  var layers = [];          // un <picture> per fase
  var cmp = 0;              // fase a sinistra del cursore
  var frac = 0.5;           // posizione del cursore (0 = tutto finito, 1 = tutta la fase)
  var animToken = 0;
  var playing = false;
  var seenIntro = false;

  function srcset(id, key, ext) {
    return proj.w.map(function(w) { return 'assets/img/pd-' + id + '-' + key + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', ');
  }
  function buildLayers() {
    var n = proj.stages.length;
    empty(layersBox);
    proj.stages.forEach(function(st, i) {
      var pre = i === n - 1 ? 'Dopo: ' : (i === 0 ? 'Prima: ' : st.label + ': ');
      var pic = make('picture', 'pd-layer');
      pic.dataset.i = String(i);
      ['avif', 'webp'].forEach(function(ext) {
        var so = document.createElement('source');
        so.type = 'image/' + ext; so.srcset = srcset(proj.id, st.key, ext); so.sizes = PD_SIZES;
        pic.appendChild(so);
      });
      var img = document.createElement('img');
      img.width = 720; img.height = 900; img.loading = 'lazy'; img.decoding = 'async';
      img.alt = pre + st.alt; img.draggable = false;
      img.src = 'assets/img/pd-' + proj.id + '-' + st.key + '-720.jpg';
      pic.appendChild(img);
      layersBox.appendChild(pic);
    });
    layers = Array.prototype.slice.call(layersBox.children);
  }
  function ready(i) {
    var img = layers[i] && layers[i].querySelector('img');
    if (!img) return Promise.resolve();
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise(function(res) {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    });
  }
  // Mostra la fase b a sinistra e la fase a a destra del cursore
  function showPair(b, a) {
    layers.forEach(function(l, i) {
      l.classList.toggle('is-before', i === b);
      l.classList.toggle('is-after', i === a);
    });
    tagBefore.textContent = proj.stages[b].label;
    tagAfter.textContent = proj.stages[a].label;
  }
  function setFraction(p) {
    frac = Math.max(0, Math.min(1, p));
    var pct = frac * 100;
    slider.style.setProperty('--p', pct + '%');
    tagBefore.style.opacity = frac < 0.18 ? 0 : 1;
    tagAfter.style.opacity = frac > 0.82 ? 0 : 1;
    var val = Math.round(100 - pct);
    slider.setAttribute('aria-valuenow', String(val));
    slider.setAttribute('aria-valuetext', val + '% visibile il dopo');
  }
  function fractionAt(x) {
    var r = slider.getBoundingClientRect();
    return (x - r.left) / r.width;
  }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function animateTo(target, dur) {
    var token = ++animToken;
    if (prefersReduced || !dur) { setFraction(target); return Promise.resolve(true); }
    var from = frac, start = null;
    return new Promise(function(res) {
      function step(t) {
        if (token !== animToken) return res(false);
        if (start === null) start = t;
        var k = Math.min(1, (t - start) / dur);
        setFraction(from + (target - from) * ease(k));
        if (k < 1) requestAnimationFrame(step); else res(true);
      }
      requestAnimationFrame(step);
    });
  }
  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function renderTimeline(current) {
    var n = proj.stages.length;
    timeline.hidden = n < 3;
    if (n < 3) return;
    if (timeline.children.length !== n || timeline.dataset.project !== proj.id) {
      timeline.dataset.project = proj.id;
      empty(timeline);
      proj.stages.forEach(function(st, i) {
        var b = make('button', 'pd-step');
        b.type = 'button'; b.dataset.i = String(i); b.setAttribute('aria-pressed', 'false');
        var dot = make('span', 'pd-step-dot'); dot.setAttribute('aria-hidden', 'true');
        b.appendChild(dot); b.appendChild(document.createTextNode(st.label));
        timeline.appendChild(b);
      });
    }
    Array.prototype.forEach.call(timeline.children, function(b, i) {
      b.classList.toggle('is-current', i === current);
      b.classList.toggle('is-done', i < current);
      b.setAttribute('aria-pressed', i === current ? 'true' : 'false');
    });
    timeline.style.setProperty('--fill', String(current / (n - 1)));
  }

  // Confronta la fase i con il finito; i = ultima mostra tutto il finito
  function compare(i) {
    stopPlay();
    var last = proj.stages.length - 1;
    if (i >= last) {
      renderTimeline(last);
      animateTo(0, 700);
      return;
    }
    var changed = i !== cmp;
    cmp = i;
    showPair(cmp, last);
    renderTimeline(cmp);
    ready(cmp).then(function() {
      if (changed && !prefersReduced) { setFraction(1); animateTo(0.5, 900); }
      else animateTo(0.5, 500);
    });
  }

  // La trasformazione completa: ogni fase lascia il posto alla successiva
  function setPlaying(on) {
    playing = on;
    playBtn.classList.toggle('is-playing', on);
    playLabel.textContent = on ? 'Ferma' : 'Guarda la trasformazione';
    playBtn.querySelector('path').setAttribute('d', on ? 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' : 'M8 5.5v13l10.5-6.5z');
  }
  function stopPlay() {
    if (!playing) return;
    setPlaying(false);
    animToken++;
  }
  function play() {
    if (typeof hideUpNext === 'function') hideUpNext();
    if (playing) { stopPlay(); showPair(cmp, proj.stages.length - 1); renderTimeline(cmp); animateTo(0.5, 500); return; }
    setPlaying(true);
    var p0 = proj, last = proj.stages.length - 1, i = 0;
    var alive = function() { return playing && proj === p0; };
    showPair(0, 1); renderTimeline(0); setFraction(1);
    function next() {
      if (!alive()) return;
      if (i >= last) {
        // fine: torna al confronto con il cursore a metà
        cmp = 0; showPair(0, last); setFraction(0); renderTimeline(0);
        wait(900).then(function() {
          if (!alive()) return;
          animateTo(0.5, 1000).then(function() { if (alive()) { setPlaying(false); markSeen(); offerNext(true); } });
        });
        return;
      }
      Promise.all([ready(i), ready(i + 1)]).then(function() { return wait(i === 0 ? 700 : 350); }).then(function() {
        if (!alive()) return;
        return animateTo(0, 1500).then(function(done) {
          if (!done || !alive()) return;
          i++;
          renderTimeline(i);
          if (i < last) { showPair(i, i + 1); setFraction(1); }
          next();
        });
      });
    }
    next();
  }
  playBtn.addEventListener('click', play);
  // ── Prima e dopo: frecce, puntini, "guarda anche" con avvio automatico ──
  var pdPrev = document.getElementById('pdPrev'), pdNext = document.getElementById('pdNext');
  var pdCount = document.getElementById('pdCount'), pdDots = document.getElementById('pdDots');
  var upNext = document.getElementById('pdUpNext'), upImg = document.getElementById('pdUpImg'), upTitle = document.getElementById('pdUpTitle');
  var ambA = document.getElementById('pdAmbA'), ambB = document.getElementById('pdAmbB');
  var pdInfo = document.querySelector('.pd-info');
  var seen = {}; var upTimer = null, playTimer = null, swapTimer = null; var pdVisible = false;
  PROJECTS.forEach(function() { pdDots.appendChild(document.createElement('i')); });
  function idx() { return PROJECTS.indexOf(proj); }
  function nextProj() { return PROJECTS[(idx() + 1) % PROJECTS.length]; }
  function markSeen() {
    seen[proj.id] = true;
    picks.forEach(function(b) { b.classList.toggle('is-seen', !!seen[b.dataset.project] && b.dataset.project !== proj.id); });
  }
  function refreshNav() {
    var i = idx();
    pdCount.textContent = (i + 1) + ' / ' + PROJECTS.length;
    picks.forEach(function(b) { b.classList.toggle('is-seen', !!seen[b.dataset.project] && b.dataset.project !== proj.id); });
    Array.prototype.forEach.call(pdDots.children, function(d, k) { d.classList.toggle('is-on', k === i); d.classList.toggle('is-seen', !!seen[PROJECTS[k].id]); });
    var cur = ambA.classList.contains('is-on') ? ambA : ambB, other = cur === ambA ? ambB : ambA;
    var src = 'assets/img/amb-pd-' + proj.id + '-' + proj.stages[proj.stages.length - 1].key + '.webp';   // già sfocata
    if (cur.getAttribute('src') !== src) { other.removeAttribute('loading'); other.src = src; other.classList.add('is-on'); cur.classList.remove('is-on'); }
    // tieni visibile il lavoro scelto nella riga dei lavori (telefono)
    var pk = document.querySelector('.pd-pick[data-project="' + proj.id + '"]');
    if (pk && pk.parentNode.scrollWidth > pk.parentNode.clientWidth) pk.parentNode.scrollTo({ left: pk.offsetLeft - 24, behavior: prefersReduced ? 'auto' : 'smooth' });
  }
  function hideUpNext() { clearTimeout(upTimer); clearTimeout(playTimer); upNext.hidden = true; upNext.classList.remove('is-counting'); }
  function offerNext(countdown) {
    var n = nextProj();
    upImg.src = 'assets/img/pd-' + n.id + '-thumb.webp';
    upTitle.textContent = n.title;
    upNext.dataset.project = n.id;
    upNext.setAttribute('aria-label', 'Guarda anche: ' + n.title);
    upNext.hidden = false; upNext.classList.remove('is-counting');
    clearTimeout(upTimer);
    if (countdown && !prefersReduced && pdVisible) {
      void upNext.offsetWidth; upNext.classList.add('is-counting');
      upTimer = setTimeout(function() { if (pdVisible) goTo(n.id, true); }, 7000);
    }
  }
  function goTo(id, andPlay) {
    hideUpNext();
    pdInfo.classList.add('is-swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(function() {
      selectProject(id);
      pdInfo.classList.remove('is-swapping');
      if (andPlay) playTimer = setTimeout(function() { if (!playing) play(); }, 1100);
    }, 220);
  }
  upNext.addEventListener('click', function() { goTo(upNext.dataset.project, true); });
  pdPrev.addEventListener('click', function() { goTo(PROJECTS[(idx() - 1 + PROJECTS.length) % PROJECTS.length].id, false); });
  pdNext.addEventListener('click', function() { goTo(nextProj().id, false); });
  // qualsiasi gesto sul confronto ferma il conto alla rovescia
  slider.addEventListener('pointerdown', function() { slider.classList.add('was-touched'); });
  // qualsiasi tocco nel componente (tranne sulla scheda stessa) ferma l'avvio automatico
  document.getElementById('pd').addEventListener('pointerdown', function(e) {
    clearTimeout(playTimer);
    if (!e.target.closest('#pdUpNext, #pdPrev, #pdNext')) { clearTimeout(swapTimer); pdInfo.classList.remove('is-swapping'); }
    if (upNext.classList.contains('is-counting') && !e.target.closest('#pdUpNext')) offerNext(false);
  }, true);
  slider.addEventListener('keydown', function() { slider.classList.add('was-touched'); });
  new IntersectionObserver(function(e) { pdVisible = e[0].isIntersecting; if (!pdVisible && upNext.classList.contains('is-counting')) offerNext(false); }, { threshold: 0.25 }).observe(slider);
  // dopo un trascinamento ampio, suggerisci il lavoro successivo (senza avvio automatico)
  var dragMin = 1, dragMax = 0;
  slider.addEventListener('pointermove', function() { dragMin = Math.min(dragMin, frac); dragMax = Math.max(dragMax, frac); });
  slider.addEventListener('pointerup', function() { if (dragMax - dragMin > 0.55) { markSeen(); offerNext(false); } dragMin = 1; dragMax = 0; });
  refreshNav();


  // Cambio lavoro
  function selectProject(id) {
    var p = PROJECTS.filter(function(x) { return x.id === id; })[0];
    if (!p || p === proj) return;
    stopPlay();
    proj = p;
    picks.forEach(function(b) { b.setAttribute('aria-pressed', b.dataset.project === id ? 'true' : 'false'); });
    pdKind.textContent = p.kind; pdTitle.textContent = p.title; pdDesc.textContent = p.desc;
    if (typeof refreshNav === 'function') { hideUpNext(); refreshNav(); }
    slider.classList.add('is-loading');
    buildLayers();
    cmp = 0;
    var last = p.stages.length - 1;
    showPair(0, last); renderTimeline(0); setFraction(1);
    Promise.all([ready(0), ready(last)]).then(function() {
      if (proj !== p) return;
      slider.classList.remove('is-loading');
      animateTo(0.5, 900);
    });
  }
  picks.forEach(function(b) {
    b.addEventListener('click', function() { hideUpNext(); selectProject(b.dataset.project); });
  });
  timeline.addEventListener('click', function(e) {
    var b = e.target.closest('.pd-step');
    if (b) compare(parseInt(b.dataset.i, 10));
  });

  // Trascinamento: su telefono parte solo con un gesto orizzontale,
  // così lo scorrimento verticale della pagina resta libero
  var ptr = null;
  slider.addEventListener('pointerdown', function(e) {
    stopPlay(); animToken++;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false };
    if (e.pointerType === 'mouse') {
      ptr.drag = true;
      slider.setPointerCapture(e.pointerId);
      slider.classList.add('is-dragging');
      setFraction(fractionAt(e.clientX));
    }
  });
  slider.addEventListener('pointermove', function(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (!ptr.drag) {
      var dx = Math.abs(e.clientX - ptr.x), dy = Math.abs(e.clientY - ptr.y);
      if (dx > 6 && dx > dy) {
        ptr.drag = true;
        try { slider.setPointerCapture(e.pointerId); } catch (err) {}
        slider.classList.add('is-dragging');
      } else if (dy > 10) { ptr = null; return; }
    }
    if (ptr.drag) setFraction(fractionAt(e.clientX));
  });
  function endPtr(e) {
    if (ptr && !ptr.drag && e.type === 'pointerup') animateTo(fractionAt(e.clientX), 350);
    ptr = null;
    slider.classList.remove('is-dragging');
  }
  slider.addEventListener('pointerup', endPtr);
  slider.addEventListener('pointercancel', endPtr);
  slider.addEventListener('keydown', function(e) {
    var step = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step = -0.05;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step = 0.05;
    if (step !== null) { e.preventDefault(); stopPlay(); animToken++; setFraction(frac - step); }
    else if (e.key === 'Home') { e.preventDefault(); stopPlay(); setFraction(1); }
    else if (e.key === 'End') { e.preventDefault(); stopPlay(); setFraction(0); }
  });

  // Avvio: costruisce le fasi e, la prima volta che il confronto è ben
  // visibile, mostra da solo la trasformazione (non con «riduci movimento»)
  buildLayers();
  showPair(0, proj.stages.length - 1);
  renderTimeline(0);
  setFraction(0.5);
  if (!prefersReduced && 'IntersectionObserver' in window) {
    var introObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting && !seenIntro) {
          seenIntro = true; introObserver.disconnect();
          setTimeout(function() { if (!playing && frac === 0.5) play(); }, 400);
        }
      });
    }, { threshold: 0.6 });
    introObserver.observe(slider);
  }

  // ── Preventivo form ──
  var step = 1;
  var totalSteps = 4;
  var answers = {};
  var submitting = false;
  var steps = document.querySelectorAll('.prev-step');
  var dots = document.querySelectorAll('.prev-dot');
  var backBtn = document.getElementById('prevBack');
  var nextBtn = document.getElementById('prevNext');
  var prevForm = document.getElementById('prevForm');
  var prevError = document.getElementById('prevError');
  var prevErrorText = document.getElementById('prevErrorText');
  var prevStatus = document.getElementById('prevStatus');
  var WA_NUMBER = '393209517477';
  var WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';
  function waIcon() { return svg('0 0 24 24', { fill: 'currentColor' }, [['path', { d: WA_PATH }]]); }
  function hideError() { prevError.hidden = true; }
  function showError(msg) {
    prevErrorText.textContent = msg || "Seleziona un'opzione per continuare.";
    prevError.hidden = false;
    var a = document.querySelector('.prev-step.active');
    if (a) { a.classList.remove('invalid'); void a.offsetWidth; a.classList.add('invalid'); }
  }

  function showStep(n, dir) {
    steps.forEach(function(s) { s.classList.remove('active'); });
    var active = document.querySelector('[data-step="' + n + '"]');
    active.setAttribute('data-dir', dir === 'back' ? 'back' : 'next');
    active.classList.add('active');
    dots.forEach(function(d, i) {
      d.classList.remove('active', 'done');
      if (i + 1 === n) d.classList.add('active');
      else if (i + 1 < n) d.classList.add('done');
    });
    backBtn.classList.toggle('hidden', n === 1);
    prevStatus.textContent = 'Passo ' + n + ' di ' + totalSteps;
    hideError();
    if (n === totalSteps) {
      nextBtn.classList.add('wa');
      empty(nextBtn); nextBtn.appendChild(waIcon()); nextBtn.appendChild(document.createTextNode('Invia la richiesta'));
    } else {
      nextBtn.classList.remove('wa');
      nextBtn.textContent = 'Avanti \u2192';
    }
    if (dir) { active.setAttribute('tabindex', '-1'); active.focus(); }
  }

  document.querySelectorAll('.prev-option').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var siblings = btn.parentElement.querySelectorAll('.prev-option');
      siblings.forEach(function(x) { x.classList.remove('selected'); x.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('selected'); btn.setAttribute('aria-pressed', 'true');
      answers['step' + step] = btn.dataset.value;
      hideError();
    });
  });

  // Dai box dei servizi: il pulsante porta al preventivo con il servizio già scelto
  document.querySelectorAll('[data-servizio]').forEach(function(link) {
    link.addEventListener('click', function() {
      if (step !== 1) return;
      var opt = document.querySelector('.prev-step[data-step="1"] .prev-option[data-value="' + link.dataset.servizio + '"]');
      if (opt) opt.click();
    });
  });

  function buildMessage() {
    var notes = document.getElementById('prevNotes').value.trim();
    var msg = 'Buongiorno, vorrei un preventivo.\n';
    if (answers.step1) msg += '\nServizio: ' + answers.step1;
    if (answers.step2) msg += '\nDimensione: ' + answers.step2;
    if (answers.step3) msg += '\nZona: ' + answers.step3;
    if (notes) msg += '\nNote: ' + notes;
    return msg;
  }
  function leafBurst(box) {
    if (prefersReduced) return;
    var colors = ['var(--green)', 'var(--sage)', 'var(--green-bright)', '#d99aa6'];
    var burst = make('div', 'leaf-burst'); burst.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      var dist = 70 + Math.random() * 50;
      var leaf = document.createElement('span');
      leaf.style.setProperty('--x', Math.round(Math.cos(a) * dist) + 'px');
      leaf.style.setProperty('--y', Math.round(Math.sin(a) * dist + 40) + 'px');
      leaf.style.setProperty('--r', Math.round(Math.random() * 360 - 180) + 'deg');
      leaf.style.setProperty('--d', (Math.random() * 0.15).toFixed(2) + 's');
      leaf.style.setProperty('--c', colors[i % colors.length]);
      burst.appendChild(leaf);
    }
    box.appendChild(burst);
  }
  function showSuccess(waUrl) {
    var box = make('div', 'prev-success'); box.setAttribute('role', 'status');
    var icon = make('div', 'prev-success-icon');
    leafBurst(icon);
    icon.appendChild(svg('0 0 24 24', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [['polyline', { points: '20 6 9 17 4 12' }]]));
    box.appendChild(icon);
    box.appendChild(make('h3', null, 'Ti apriamo WhatsApp'));
    box.appendChild(make('p', null, 'Si è aperto WhatsApp con la tua richiesta già compilata: inviala e ti rispondiamo al più presto. Se la finestra non si è aperta, usa il pulsante qui sotto.'));
    var a = make('a', 'prev-success-wa');
    a.href = waUrl; a.target = '_blank'; a.rel = 'noopener';
    a.appendChild(waIcon()); a.appendChild(document.createTextNode('Apri WhatsApp'));
    box.appendChild(a);
    empty(prevForm);
    prevForm.appendChild(box);
  }
  nextBtn.addEventListener('click', function() {
    if (submitting) return;
    if (step >= 1 && step <= 3 && !answers['step' + step]) { showError(); return; }
    if (step < totalSteps) { step++; showStep(step, 'next'); return; }
    submitting = true;
    nextBtn.setAttribute('disabled', '');
    nextBtn.textContent = 'Invio…';
    var waUrl = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildMessage());
    // Apri WhatsApp subito (gesto utente: evita il blocco popup)
    window.open(waUrl, '_blank', 'noopener');
    showSuccess(waUrl);
  });

  backBtn.addEventListener('click', function() {
    if (step > 1) { step--; showStep(step, 'back'); }
  });

  // ── Lightbox sfogliabile (dialog con focus-trap, frecce, swipe) ──
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  var lbAvif = document.getElementById('lbAvif');
  var lbWebp = document.getElementById('lbWebp');
  var lbCaption = document.getElementById('lbCaption');
  var lbCount = document.getElementById('lbCount');
  var lbClose = document.getElementById('lbClose');
  var lbPrev = document.getElementById('lbPrev');
  var lbNext = document.getElementById('lbNext');
  var lbAll = [];
  var lbItems = [];
  var lbIndex = 0;
  var lbLastFocus = null;
  function lbShow(i, dir) {
    lbIndex = (i + lbItems.length) % lbItems.length;
    var item = lbItems[lbIndex];
    var im = item.querySelector('img');
    var avif = item.querySelector('source[type="image/avif"]');
    var webp = item.querySelector('source[type="image/webp"]');
    lbAvif.srcset = avif ? avif.getAttribute('srcset') : '';
    lbWebp.srcset = webp ? webp.getAttribute('srcset') : '';
    lbImg.classList.remove('from-next', 'from-prev', 'is-leaving');
    if (dir && !prefersReduced) {
      lbImg.classList.add(dir > 0 ? 'from-next' : 'from-prev');
      void lbImg.offsetWidth;
    }
    lbImg.src = im.getAttribute('src');
    lbImg.alt = im.alt;
    lbCaption.textContent = im.alt;
    lbCount.textContent = (lbIndex + 1) + ' / ' + lbItems.length;
    // entra quando la nuova foto è pronta (con un limite, per non restare vuoti)
    var shown = false;
    var reveal = function() {
      if (shown) return; shown = true;
      requestAnimationFrame(function() { lbImg.classList.remove('from-next', 'from-prev'); });
    };
    if (lbImg.complete) reveal();
    else { lbImg.addEventListener('load', reveal, { once: true }); setTimeout(reveal, 700); }
  }
  function lbStep(dir) {
    if (prefersReduced) { lbShow(lbIndex + dir); return; }
    lbImg.classList.add('is-leaving');
    setTimeout(function() { lbShow(lbIndex + dir, dir); }, 160);
  }
  function openLb(trigger) {
    // sfoglia solo le foto visibili con il filtro attivo (l'elenco può cambiare: arriva dal database)
    lbAll = Array.prototype.slice.call(document.querySelectorAll('[data-lb]'));
    lbItems = lbAll.filter(function(el) { return !el.hidden; });
    lbShow(lbItems.indexOf(trigger));
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
    lbLastFocus = trigger;
    lbClose.focus();
  }
  function closeLb() {
    lb.classList.remove('active');
    document.body.style.overflow = '';
    if (lbLastFocus) { lbLastFocus.focus(); lbLastFocus = null; }
  }
  document.addEventListener('click', function(e) {
    var el = e.target.closest && e.target.closest('[data-lb]');
    if (el) openLb(el);
  });

  // ── Galleria: filtri per tipo di lavoro, con passaggio animato ──
  var galFilters = document.querySelectorAll('.gal-filter');
  var galItems = [];
  var galWide = window.matchMedia('(min-width: 900px)');
  var galCat = 'tutti';
  var GAL_FIRST = 8, galAll = false;
  var galMore = document.getElementById('galMore');
  function galPrepare() {
    galItems = Array.prototype.slice.call(document.querySelectorAll('.gal-item'));
    galItems.forEach(function(el, i) {
      el.style.viewTransitionName = 'gal-' + i;
      el.dataset.shape = el.classList.contains('is-big') ? 'big' : el.classList.contains('is-tall') ? 'tall' : '';
    });
  }
  galPrepare();
  // Con un filtro attivo le forme si ricalcolano per riempire le righe senza buchi
  function shapesFor(n) {
    var out = [];
    if (!galWide.matches) {             // 2 colonne: una grande se dispari, poi coppie alte
      if (n % 2) out.push('big');
      while (out.length < n) out.push('tall');
      return out;
    }
    while (out.length < n) {            // 4 colonne: righe da grande+2 alte, 2 grandi o 4 alte
      var left = n - out.length;
      if (left === 4) out.push('tall', 'tall', 'tall', 'tall');
      else if (left % 3 === 0 || left === 1) out.push('big', 'tall', 'tall');
      else out.push('big', 'big');
    }
    return out.slice(0, n);
  }
  function setShape(el, shape) {
    el.classList.toggle('is-big', shape === 'big');
    el.classList.toggle('is-tall', shape === 'tall');
  }
  function applyFilter(cat) {
    galCat = cat;
    var shown = galItems.filter(function(el) { return cat === 'tutti' || el.dataset.cat === cat; });
    var limited = cat === 'tutti' && !galAll && shown.length > GAL_FIRST;
    if (limited) shown = shown.slice(0, GAL_FIRST);
    if (galMore) galMore.hidden = !limited;
    var shapes = shapesFor(shown.length);
    galItems.forEach(function(el) {
      var k = shown.indexOf(el);
      el.hidden = k < 0;
      if (k >= 0) { el.classList.add('visible'); setShape(el, shapes ? shapes[k] : el.dataset.shape); }
    });
    galFilters.forEach(function(b) { b.setAttribute('aria-pressed', b.dataset.filter === cat ? 'true' : 'false'); });
  }
  if (galWide.addEventListener) galWide.addEventListener('change', function() { applyFilter(galCat); });
  applyFilter('tutti');
  // L'elenco dal database (gallery/live.js) può arrivare prima o dopo questo punto
  function galRefresh() {
    galPrepare();
    if (galCat !== 'tutti' && !document.querySelector('.gal-filter[data-filter="' + galCat + '"]:not([hidden])')) galCat = 'tutti';
    applyFilter(galCat);
  }
  document.addEventListener('gallery:updated', galRefresh);
  if (window.__galleryDone) galRefresh();
  if (galMore) galMore.addEventListener('click', function() {
    galAll = true;
    var first = galItems.filter(function(el) { return el.hidden; })[0];
    if (document.startViewTransition && !prefersReduced) document.startViewTransition(function() { applyFilter('tutti'); });
    else applyFilter('tutti');
    if (first) setTimeout(function() { first.focus({ preventScroll: true }); }, 50);
  });
  galFilters.forEach(function(b) {
    b.addEventListener('click', function() {
      var cat = b.dataset.filter;
      if (document.startViewTransition && !prefersReduced) document.startViewTransition(function() { applyFilter(cat); });
      else applyFilter(cat);
    });
  });
  lb.addEventListener('click', function(e) {
    if (e.target === lb || e.target.classList.contains('lb-figure')) closeLb();
  });
  lbClose.addEventListener('click', closeLb);
  lbPrev.addEventListener('click', function() { lbStep(-1); });
  lbNext.addEventListener('click', function() { lbStep(1); });
  var lbFocusables = [lbClose, lbPrev, lbNext];
  document.addEventListener('keydown', function(e) {
    if (!lb.classList.contains('active')) return;
    if (e.key === 'Escape') { closeLb(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); lbStep(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); lbStep(-1); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      var k = lbFocusables.indexOf(document.activeElement);
      k = (k + (e.shiftKey ? -1 : 1) + lbFocusables.length) % lbFocusables.length;
      lbFocusables[k].focus();
    }
  });
  // Swipe orizzontale su touch
  var lbTouchX = null, lbTouchY = null;
  lb.addEventListener('touchstart', function(e) {
    lbTouchX = e.touches[0].clientX; lbTouchY = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener('touchend', function(e) {
    if (lbTouchX === null) return;
    var dx = e.changedTouches[0].clientX - lbTouchX;
    var dy = e.changedTouches[0].clientY - lbTouchY;
    lbTouchX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lbStep(dx < 0 ? 1 : -1);
  }, { passive: true });

  // ── Scorrimento ai link interni: morbido (se gradito) e con il focus
  // spostato sulla destinazione, così tastiera e lettori di schermo seguono ──
  document.querySelectorAll('a[href^="#"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      var t = document.querySelector(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      if (t.id === 'prima-dopo' && pdWipe && Math.abs(t.getBoundingClientRect().top) > 40) pdWipe();
      else t.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    });
  });

  // ── Barra di avanzamento e voce di menu della sezione in vista ──
  var progress = document.getElementById('scrollProgress');
  onScrollFrame(function(y, vh) { var max = document.documentElement.scrollHeight - vh; return max > 0 ? Math.min(1, y / max) : 0; },
    function(k) { progress.style.transform = 'scaleX(' + k.toFixed(4) + ')'; });
  queueScrollFrame();

  var navMap = {};
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(function(a) { navMap[a.getAttribute('href').slice(1)] = a; });
  var spyObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      var link = navMap[e.target.id];
      if (!link) return;
      if (e.isIntersecting) {
        Object.keys(navMap).forEach(function(k) { navMap[k].classList.remove('is-current'); navMap[k].removeAttribute('aria-current'); });
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'true');
      } else if (link.classList.contains('is-current')) {
        link.classList.remove('is-current');
        link.removeAttribute('aria-current');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section[id]').forEach(function(sec) { spyObserver.observe(sec); });

})();
