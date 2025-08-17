/*! media-proxy.js — xpan
 *  - Proxy responsive vía images.weserv.nl para imágenes (src/srcset/data-src)
 *  - Lazy-load de videos (attachments.are.na) si no tienen tu lazy propio
 *  - Acceso “oculto” al original: Alt/Ctrl/Cmd + click (desktop) o long-press (~550ms) en touch
 *  - Funciona con nodos añadidos dinámicamente y cambios de atributos (src, srcset, poster)
 *  - Opt-out por elemento con data-no-proxy
 */
(() => {
  // --- Config ---
  const IMG_HOST_MATCH = /(?:cloudfront\.net|attachments\.are\.na)/i;
  const IMG_SEL = 'img, source[type^="image/"]';
  const WESERV = 'https://images.weserv.nl/?url=';
  const WCFG = '&q=70&we';                  // q=calidad, we=auto WebP/AVIF si soporta
  const WIDTHS = [480, 960, 1600, 2200];    // breakpoints para srcset
  const IO_MARGIN_IMG = '600px 0px';
  const IO_MARGIN_VID = '300px 0px';
  const LONGPRESS_MS = 550;

  // --- Utils ---
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
      // toma el primer candidato de srcset si es HTTP
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

    // Detecta URL objetivo (src o data-src o srcset)
    const tag = imgLike.tagName;
    let orig = null;

    // Si es <source> de imagen dentro de <picture>
    if (tag === 'SOURCE' && /^image\//i.test(imgLike.getAttribute('type') || '')) {
      let candidate = imgLike.getAttribute('srcset') || imgLike.getAttribute('data-srcset') || '';
      // toma primer candidato
      const first = candidate.split(',')[0]?.trim().split(' ')[0] || '';
      orig = first || imgLike.getAttribute('src') || imgLike.getAttribute('data-src') || null;
    } else {
      // <img>
      orig = imgLike.getAttribute('data-src') || imgLike.getAttribute('src') || null;
      // si viene con srcset/data-srcset ya armado por autor, no tocar (solo habilitar original)
      if (imgLike.hasAttribute('srcset') || imgLike.hasAttribute('data-srcset')) {
        // pero aún marcamos data-full con el primer candidato
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
      // Mantén semántica de <picture>: usamos srcset
      imgLike.setAttribute('srcset', srcset);
      imgLike.removeAttribute('data-src'); // por si acaso
    } else {
      // IMG
      imgLike.referrerPolicy = 'no-referrer';
      imgLike.decoding = 'async';
      imgLike.loading = 'lazy';

      if (imgLike.hasAttribute('data-src') && !imgLike.getAttribute('src')) {
        // El autor usa lazy con data-src -> reescribimos data-src a proxy medio
        imgLike.setAttribute('data-src', proxify(orig, 960));
        imgLike.setAttribute('data-srcset', srcset); // por si el loader del autor lo respeta
      } else {
        // Tenemos src “eager” -> lo cambiamos al proxy medio
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
    // Proxifica sus <source> y su <img> fallback
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

  // --- Videos (attachments.are.na) ---
  function prepareVideo(v) {
    if (!(v instanceof HTMLVideoElement)) return;
    if (v.dataset.videoReady === '1') return;

    const hasOwnLazy = v.classList.contains('lazy-video'); // respeta el lazy del sitio si existe

    // Si ya viene con <source data-src> dejamos su lazy y solo habilitamos “original”
    const firstSource = v.querySelector('source');
    let orig = null;

    if (firstSource) {
      const ds = firstSource.getAttribute('data-src');
      const s = firstSource.getAttribute('src');
      orig = fixUrl(ds || s || '');
    } else {
      const ds = v.getAttribute('data-src');
      const s = v.getAttribute('src');
      orig = fixUrl(ds || s || '');
    }

    if (orig) v.setAttribute('data-full', orig);
    enableOpenOriginal(v);

    // Si no tiene lazy propio y es de are.na, le ponemos un IO básico
    const isArena = IMG_HOST_MATCH.test(orig || '');
    if (!hasOwnLazy && isArena) {
      // Convertimos src/src de <source> a data-src para lazear
      if (firstSource) {
        if (!firstSource.getAttribute('data-src') && firstSource.getAttribute('src')) {
          firstSource.setAttribute('data-src', firstSource.getAttribute('src'));
          firstSource.removeAttribute('src');
        }
      } else if (v.getAttribute('src')) {
        v.setAttribute('data-src', v.getAttribute('src'));
        v.removeAttribute('src');
      }

      const vio = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          const vid = en.target;
          const s = vid.querySelector('source[data-src]');
          if (s && !s.src) s.src = s.getAttribute('data-src');
          if (!vid.src && vid.getAttribute('data-src')) vid.src = vid.getAttribute('data-src');
          vid.load();
          const p = vid.play();
          if (p && p.catch) p.catch(() => {});
          vio.unobserve(vid);
        });
      }, { rootMargin: IO_MARGIN_VID, threshold: 0.2 });

      vio.observe(v);
    }

    // Autoplay on visible / pause off visible (suave, no interfiere si ya hay uno)
    const apo = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
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
      attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'poster']
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
