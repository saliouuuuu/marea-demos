/* Prepara le foto nel browser: applica la rotazione, ridimensiona a 1920 e 800 px sul lato lungo
   e ricodifica (WebP, o JPEG se il browser non sa fare WebP). Ridisegnare l'immagine toglie anche
   i dati nascosti nel file, come la posizione GPS. */
window.ImageTools = (function () {
  'use strict';
  var MAX_INPUT = 40 * 1024 * 1024;
  var LIMIT = 3 * 1024 * 1024 - 4096;   // il bucket rifiuta file sopra i 3 MB

  function readDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('lettura')); };
      r.readAsDataURL(file);
    });
  }
  function decode(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return viaImage(file); });
    }
    return viaImage(file);
  }
  function viaImage(file) {           // niente URL blob: la CSP del sito ammette solo data:
    return readDataUrl(file).then(function (url) {
      return new Promise(function (resolve, reject) {
        var im = new Image();
        im.onload = function () { resolve(im); };
        im.onerror = function () { reject(new Error('decodifica')); };
        im.src = url;
      });
    });
  }
  function size(src, max) {
    var w = src.width, h = src.height, k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }
  function draw(src, w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    return c;
  }
  function toBlob(canvas, mime, q) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, mime, q); });
  }
  function encode(canvas) {
    var mime = 'image/webp', q = 0.8;
    function attempt() {
      return toBlob(canvas, mime, q).then(function (b) {
        if (!b) throw new Error('codifica');
        if (b.type !== mime && mime === 'image/webp') { mime = 'image/jpeg'; return attempt(); }
        if (b.size > LIMIT && q > 0.45) { q -= 0.1; return attempt(); }
        if (b.size > LIMIT) throw new Error('troppo grande');
        return b;
      });
    }
    return attempt();
  }

  function prepare(file) {
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('non e\' un\'immagine'));
    if (file.size > MAX_INPUT) return Promise.reject(new Error('file troppo grande'));
    return decode(file).then(function (src) {
      var big = size(src, 1920), small = size(src, 800), th = size(src, 160);
      var bigCanvas = draw(src, big.w, big.h);
      if (src.close) src.close();
      var smallCanvas = draw(bigCanvas, small.w, small.h);
      var thumb = draw(bigCanvas, th.w, th.h).toDataURL('image/jpeg', 0.7);
      return Promise.all([encode(bigCanvas), encode(smallCanvas)]).then(function (b) {
        var ext = b[0].type === 'image/webp' ? 'webp' : 'jpg';
        return { w: big.w, h: big.h, ext: ext, big: b[0], small: b[1], thumb: thumb, name: file.name };
      });
    });
  }
  return { prepare: prepare };
})();
