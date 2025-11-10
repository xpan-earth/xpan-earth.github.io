/*! media-proxy.js — xpan (rev universal-video)
 *  - Proxy responsive vía images.weserv.nl para imágenes (src/srcset/data-src)
 *  - Lazy-load robusto de videos (p. ej., attachments.are.na) sin limitar formatos
 *  - Prioriza fuentes reproducibles por navegador (canPlayType) y no rompe si ninguna sirve
 *  - Acceso al original: Alt/Ctrl/Cmd + click o long-press (~550ms)
 *  - Soporta nodos añadidos dinámicamente y cambios de atributos
 *  - Opt-out por elemento con data-no-proxy
 */
(() => {
  // --- Config ---
  const IMG_HOST_MATCH = /(?:cloudfront\.net|attachments\.are\.na)/i; // imágenes y videos servidos desde estos hosts
  const IMG_SEL = 'img, source[type^="image/"]';
  const WESERV = 'https://images.weserv.nl/?url=';
  const WCFG = '&q=70&we';                  // q=calidad, we=auto WebP/AVIF si soporta
  const WIDTHS = [480, 960, 1600, 2200];    // breakpoints para srcset
  const IO_MARGIN_IMG = '600px 0px';
  const IO_MARGIN_VID = '300px 0px';
  const LONGPRESS_MS = 550;

  // --- Utils comunes ---
  const fixUrl = u => typeof u === 'string'
    ? u.replace(/\?(\d+)\?bc=0$/, '?$1&bc=0')
    : u;

  const isHttp = u => /^https?:\/\//i.test(u || '');
  const isProxied = u => /^https?:\/\/images\.weserv\.nl\/\?url=/i.test(u || '');

  function proxify(url, w) {
    if (!isHttp(url)) return null;
    const clean = url.replace(/^https?:\/\//, '');
    return `${WESERV}${encodeURIComponent(clean)}${w ? `&w=${w}` : ''}${WCFG}`;
  }

  function getOriginalFrom(el) {
    // Prioridad: data-full -> data-src -> src/srcset
    const df = el.getAttribute('data-full');
    if (df) return df;

    const ds = el.getAttribute('data-src');
    if (ds) return ds;

    if (el.tagName === 'SOURCE') {
      const ss = el.getAttribute('srcset') || '';
      const s = el.getAttribute('src') || '';
      const first = ss.split(',')[0]?.trim().split(' ')[0];
      return (first && isHttp(first)) ? first : (isHttp(s) ? s : null);
    }

    const s1 = el.getAttribute('src');
    const ss1 = el.getAttribute('srcset') || '';
    if (isHttp(s1)) return s1;
    const f1 = ss1.split(',')[0]?.trim().split(' ')[0];
    return (f1 && isHttp(f1)) ? f1 : null;
  }

  function enableOpenOriginal(el) {
    // Guarda original (si lo encontramos) para consultas rápidas
    const orig = getOriginalFrom(el);
    if (orig && !el.getAttribute('data-full')) el.setAttribute('data-full', orig);

    // Desktop modifiers
    el.addEventListener('click', (e) => {
      const mod = e.altKey || e.ctrlKey || e.metaKey;
      if (!mod) return;
      const href = el.getAttribute('data-full') || getOriginalFrom(el);
      if (!href) return;
      e.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
    });

    // Long-press en touch
    let timer = null, moved = false;
    const onStart = () => {
      moved = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (moved) return;
        const href = el.getAttribute('data-full') || getOriginalFrom(el);
        if (href) window.open(href, '_blank', 'noopener,noreferrer');
      }, LONGPRESS_MS);
    };
    const onMove = () => { moved = true; };
    const onEnd = () => { clearTimeout(timer); };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
  }

  // --- Imágenes ---
  function tuneImgElement(imgLike) {
    // imgLike: <img> o <source[type=image/*]>
    if (!(imgLike instanceof Element)) return;
    if (imgLike.dataset.noProxy != null) { enableOpenOriginal(imgLike); return; }
    if (imgLike.dataset.proxied === '1') { enableOpenOriginal(imgLike); return; }

    const tag = imgLike.tagName;
    let orig = null;

    // Si es <source> de imagen dentro de <picture>
    if (tag === 'SOURCE' && /^image\//i.test(imgLike.getAttribute('type') || '')) {
      let candidate = imgLike.getAttribute('srcset') || imgLike.getAttribute('data-srcset') || '';
      const first = candidate.split(',')[0]?.trim().split(' ')[0] || '';
      orig = first || imgLike.getAttribute('src') || imgLike.getAttribute('data-src') || null;
    } else {
      // <img>
      orig = imgLike.getAttribute('data-src') || imgLike.getAttribute('src') || null;

      // si viene con srcset/data-srcset ya armado por autor, no tocar (solo habilitar original)
      if (imgLike.hasAttribute('srcset') || imgLike.hasAttribute('data-srcset')) {
        const first = (imgLike.getAttribute('srcset') || imgLike.getAttribute('data-srcset') || '')
          .split(',')[0]?.trim().split(' ')[0];
        if (first && isHttp(first)) imgLike.setAttribute('data-full', first);
        enableOpenOriginal(imgLike);
        imgLike.dataset.proxied = '1';
        return;
      }
    }

    orig = fixUrl(orig);
    // Solo proxificamos si la URL apunta a nuestros hosts y no está ya por weserv
    if (!orig || !IMG_HOST_MATCH.test(orig) || isProxied(orig)) {
      enableOpenOriginal(imgLike);
      imgLike.dataset.proxied = '1';
      return;
    }

    // Guarda original
    imgLike.setAttribute('data-full', orig);

    // Construye srcset responsive
    const srcset = WIDTHS
      .map(w => `${proxify(orig, w)} ${w}w`)
      .join(', ');

    // Aplica según el tipo de elemento y si usa data-src (lazy) o src directo
    if (tag === 'SOURCE') {
      imgLike.setAttribute('srcset', srcset);
      imgLike.removeAttribute('data-src');
    } else {
      imgLike.referrerPolicy = 'no-referrer';
      imgLike.decoding = 'async';
      imgLike.loading = 'lazy';

      if (imgLike.hasAttribute('data-src') && !imgLike.getAttribute('src')) {
        imgLike.setAttribute('data-src', proxify(orig, 960));
        imgLike.setAttribute('data-srcset', srcset);
      } else {
        imgLike.setAttribute('src', proxify(orig, 960));
        imgLike.setAttribute('srcset', srcset);
      }
      imgLike.setAttribute(
        'sizes',
        '(max-width:600px) 480px, (max-width:1200px) 960px, (max-width:1800px) 1600px, 2200px'
      );
    }

    enableOpenOriginal(imgLike);
    imgLike.dataset.proxied = '1';
  }

  function tunePicture(pic) {
    pic.querySelectorAll('source[type^="image/"]').forEach(tuneImgElement);
    const img = pic.querySelector('img');
    if (img) tuneImgElement(img);
  }

  // Lazy propio para imágenes con data-src (si el sitio no trae uno)
  function ensureImageLazyIO() {
    const targets = Array.from(document.querySelectorAll('img[data-src]'))
      .filter(el => !el.__x_lazy_img);
    if (!targets.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const ds = el.getAttribute('data-src');
        const dss = el.getAttribute('data-srcset');
        if (ds && !el.getAttribute('src')) el.setAttribute('src', ds);
        if (dss && !el.getAttribute('srcset')) el.setAttribute('srcset', dss);
        io.unobserve(el);
      });
    }, { rootMargin: IO_MARGIN_IMG, threshold: 0 });

    targets.forEach(el => { el.__x_lazy_img = 1; io.observe(el); });
  }

  // --- Videos: soporte universal en cliente sin transcodificar ---
  // Mapa mínimo para deducir MIME si falta type=""
  const TYPE_MAP = {
    mp4:'video/mp4', m4v:'video/mp4', mov:'video/quicktime',
    webm:'video/webm', mkv:'video/x-matroska',
    ogv:'video/ogg', mpeg:'video/mpeg', mpg:'video/mpeg',
    ts:'video/mp2t', m2ts:'video/mp2t',
    m3u8:'application/vnd.apple.mpegurl'
  };
  function mimeFrom(u){
    try{
      const ext = (new URL(u, location.href).pathname.split('.').pop()||'').toLowerCase();
      return TYPE_MAP[ext] || '';
    }catch{ return ''; }
  }
  function playable(videoEl, mime){
    if (!mime) return false;
    const r = videoEl.canPlayType(mime);
    return r === 'probably' || r === 'maybe';
  }

  function prepareVideo(v){
    if (!(v instanceof HTMLVideoElement) || v.dataset.videoReady === '1') return;

    const hasOwnLazy = v.classList.contains('lazy-video');
    let sources = Array.from(v.querySelectorAll('source'));

    // guardar original para “abrir original”
    const firstUrl =
      sources[0]?.getAttribute('src') ||
      sources[0]?.getAttribute('data-src') ||
      v.getAttribute('src') ||
      v.getAttribute('data-src') || '';
    if (firstUrl) v.setAttribute('data-full', fixUrl(firstUrl));
    enableOpenOriginal(v);

    // si no hay <source> y sí hay video[src], normalizar a <source>
    if (!sources.length && (v.getAttribute('src') || v.getAttribute('data-src'))){
      const s = document.createElement('source');
      const url = v.getAttribute('src') || v.getAttribute('data-src');
      s.setAttribute('src', url);
      const t = v.getAttribute('type') || mimeFrom(url);
      if (t) s.setAttribute('type', t);
      v.appendChild(s);
      sources = [s];
    }

    // decidir si aplicar lazy propio: medios de nuestros hosts y sin lazy del sitio
    const isArena = IMG_HOST_MATCH.test(firstUrl||'');

    // mover TODAS las fuentes a data-src para lazy si aplica
    if (!hasOwnLazy && isArena){
      sources.forEach(s=>{
        if (!s.getAttribute('data-src')){
          const src = s.getAttribute('src');
          if (src){ s.setAttribute('data-src', src); s.removeAttribute('src'); }
        }
        if (!s.getAttribute('type')){
          const t = mimeFrom(s.getAttribute('data-src')||'');
          if (t) s.setAttribute('type', t);
        }
      });
      if (v.getAttribute('src') && !v.getAttribute('data-src')){
        v.setAttribute('data-src', v.getAttribute('src'));
        v.removeAttribute('src');
        if (!v.getAttribute('type')){
          const t = mimeFrom(v.getAttribute('data-src'));
          if (t) v.setAttribute('type', t);
        }
      }
    }

    // IO: restaurar todas las fuentes y priorizar una reproducible
    const vio = new IntersectionObserver(entries=>{
      entries.forEach(en=>{
        if (!en.isIntersecting) return;
        const vid = en.target;

        // restaurar todas las fuentes <source>
        const ss = Array.from(vid.querySelectorAll('source'));
        ss.forEach(s=>{
          if (!s.getAttribute('src') && s.getAttribute('data-src')){
            s.setAttribute('src', s.getAttribute('data-src'));
          }
          if (!s.getAttribute('type')){
            const t = mimeFrom(s.getAttribute('src')||'');
            if (t) s.setAttribute('type', t);
          }
        });
        // restaurar video[src] si estaba en data-src
        if (!vid.getAttribute('src') && vid.getAttribute('data-src')){
          vid.setAttribute('src', vid.getAttribute('data-src'));
        }

        // 1) preferir HLS/MP4 si el cliente lo puede reproducir
        const preferred = ss.find(s=>{
          const t = (s.getAttribute('type')||'').toLowerCase();
          return t.includes('application/vnd.apple.mpegurl') || t.includes('video/mp4') || t.includes('avc1');
        });
        if (preferred) vid.prepend(preferred);

        // 2) si el primero sigue sin ser reproducible, elegir por canPlayType
        let first = vid.querySelector('source');
        if (!playable(vid, first?.getAttribute('type')||'')){
          const ok = ss.find(s=>playable(vid, s.getAttribute('type')||''));
          if (ok && ok !== first) vid.prepend(ok);
        }

        // cargar y reproducir si procede
        vid.load();
        const p = vid.play();
        if (p && p.catch) p.catch(()=>{});

        vio.unobserve(vid);
      });
    }, { rootMargin: IO_MARGIN_VID, threshold: 0.2 });

    if (!hasOwnLazy && isArena) vio.observe(v);

    // Autoplay/pause por visibilidad
    const apo = new IntersectionObserver(es=>{
      es.forEach(en=>{
        if (en.isIntersecting){
          const p = v.play(); if (p && p.catch) p.catch(()=>{});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    apo.observe(v);

    v.dataset.videoReady = '1';
  }

  function tuneVideosIn(root = document) {
    root.querySelectorAll('video').forEach(prepareVideo);
  }

  // --- Observers globales ---
  function observeNewNodes() {
    const mo = new MutationObserver((ml) => {
      for (const m of ml) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;

            // <picture>
            if (node.tagName === 'PICTURE') tunePicture(node);
            node.querySelectorAll?.('picture').forEach(tunePicture);

            // <img>/<source image>
            if (node.matches?.(IMG_SEL)) processImgOrSource(node);
            node.querySelectorAll?.(IMG_SEL).forEach(processImgOrSource);

            // videos
            if (node.matches?.('video')) prepareVideo(node);
            node.querySelectorAll?.('video').forEach(prepareVideo);
          });
        } else if (m.type === 'attributes') {
          const el = m.target;
          if (el.matches(IMG_SEL)) processImgOrSource(el);
          if (el.tagName === 'VIDEO') prepareVideo(el);
        }
      }
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'poster', 'type']
    });
  }

  function processImgOrSource(node) {
    // Solo proxificamos si es imagen y apunta a nuestros hosts
    if (node.tagName === 'SOURCE' && !/^image\//i.test(node.getAttribute('type') || '')) return;
    const candidate =
      node.getAttribute('data-src') ||
      node.getAttribute('src') ||
      (node.getAttribute('srcset') || '').split(',')[0]?.trim().split(' ')[0] ||
      '';
    if (!IMG_HOST_MATCH.test(candidate) && !IMG_HOST_MATCH.test(getOriginalFrom(node) || '')) {
      enableOpenOriginal(node);
      return;
    }
    tuneImgElement(node);
  }

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', () => {
    // <picture>
    document.querySelectorAll('picture').forEach(tunePicture);
    // imgs/sources sueltos
    document.querySelectorAll(IMG_SEL).forEach(processImgOrSource);
    // lazy propio (si hay imgs con data-src sin loader externo)
    ensureImageLazyIO();
    // videos
    tuneVideosIn(document);
    // observar DOM
    observeNewNodes();
  });
})();

/* loader aei-panzoom (robusto) */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('.aei-embed')) return;
  const here = document.currentScript?.src
    || document.querySelector('script[src*="media-proxy.js"]')?.src
    || '/assets/js/media-proxy.js';
  const url = new URL('./aei-panzoom.mjs', here); // misma carpeta /assets/js/
  import(url.href).catch(() => {});
});
