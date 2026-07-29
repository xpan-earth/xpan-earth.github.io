/*! media-proxy.js — xpan (rev shared-observers)
 *  - Imágenes responsive vía images.weserv.nl con fallback automático al original
 *  - Lazy-load compartido para imágenes y videos sin observadores por elemento
 *  - Selección de fuentes de video según compatibilidad del navegador
 *  - Acceso al original con Alt/Ctrl/Cmd + click o long-press
 *  - Soporte para nodos dinámicos, cambios de fuente y data-no-proxy
 *  - Carga condicional de aei-panzoom.mjs
 */
(() => {
  'use strict';

  const BOOT_KEY = '__xpanMediaProxySharedObservers';
  if (window[BOOT_KEY]) return;
  window[BOOT_KEY] = true;

  const doc = document;
  const scriptSrc = doc.currentScript?.src
    || doc.querySelector('script[src*="media-proxy.js"]')?.src
    || '/assets/js/media-proxy.js';

  const IMG_HOST_MATCH = /(?:cloudfront\.net|attachments\.are\.na)/i;
  const IMG_SELECTOR = 'img,source[type^="image/"]';
  const MEDIA_SELECTOR = 'img,video';
  const WESERV = 'https://images.weserv.nl/?url=';
  const WESERV_CONFIG = '&q=70&we';
  const WIDTHS = [480, 960, 1600, 2200];
  const LONGPRESS_MS = 550;
  const MOVE_TOLERANCE = 12;
  const DEFAULT_SIZES = '100vw';

  const connection = navigator.connection
    || navigator.mozConnection
    || navigator.webkitConnection;
  const saveData = Boolean(connection?.saveData);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const imageMargin = saveData ? '120px 0px' : '600px 0px';
  const videoMargin = saveData ? '0px' : '300px 0px';

  const imageState = new WeakMap();
  const videoState = new WeakMap();
  const resizableImages = new Set();
  const visibleVideos = new Set();

  const enqueueMicrotask = window.queueMicrotask
    ? callback => window.queueMicrotask(callback)
    : callback => Promise.resolve().then(callback);
  const enqueueIdle = window.requestIdleCallback
    ? callback => window.requestIdleCallback(callback, { timeout: 500 })
    : callback => setTimeout(() => callback({ timeRemaining: () => 0, didTimeout: true }), 0);

  const fixUrl = value => typeof value === 'string'
    ? value.replace(/\?(\d+)\?bc=0$/, '?$1&bc=0')
    : value;

  const isHttp = value => /^https?:\/\//i.test(value || '');
  const isProxied = value => /^https?:\/\/images\.weserv\.nl\/\?url=/i.test(value || '');
  const firstSrcsetUrl = value => (value || '').split(',')[0]?.trim().split(/\s+/)[0] || '';

  function proxify(url, width) {
    if (!isHttp(url)) return null;
    const clean = url.replace(/^https?:\/\//, '');
    return `${WESERV}${encodeURIComponent(clean)}${width ? `&w=${width}` : ''}${WESERV_CONFIG}`;
  }

  function rawImageCandidate(element) {
    const dataSrc = element.getAttribute('data-src') || '';
    const src = element.getAttribute('src') || '';
    const dataSrcset = firstSrcsetUrl(element.getAttribute('data-srcset'));
    const srcset = firstSrcsetUrl(element.getAttribute('srcset'));
    return [dataSrc, src, dataSrcset, srcset]
      .map(fixUrl)
      .find(value => isHttp(value) && !isProxied(value)) || '';
  }

  function getOriginalFrom(element) {
    if (!(element instanceof Element)) return '';
    const full = fixUrl(element.getAttribute('data-full') || '');
    if (isHttp(full)) return full;

    if (element.tagName === 'VIDEO') {
      const source = element.querySelector('source');
      const candidate = fixUrl(
        source?.getAttribute('data-src')
        || source?.getAttribute('src')
        || element.getAttribute('data-src')
        || element.getAttribute('src')
        || ''
      );
      return isHttp(candidate) ? candidate : '';
    }

    return rawImageCandidate(element);
  }

  function storeOriginal(element, original) {
    const fixed = fixUrl(original);
    if (isHttp(fixed) && element.getAttribute('data-full') !== fixed) {
      element.setAttribute('data-full', fixed);
    }
    return fixed;
  }

  function mediaFromEventTarget(target) {
    const element = target?.closest?.(MEDIA_SELECTOR);
    if (!element) return null;
    const original = getOriginalFrom(element);
    return original ? { element, original } : null;
  }

  function openOriginal(url) {
    if (!isHttp(url)) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /* Interacción delegada: costo constante, sin listeners por cada medio. */
  let press = null;
  let suppressClickUntil = 0;
  let suppressClickTarget = null;

  function modifierClick(event) {
    const media = mediaFromEventTarget(event.target);
    if (!media) return;

    if (
      suppressClickTarget === media.element
      && performance.now() < suppressClickUntil
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      press = null;
      return;
    }

    if (!(event.altKey || event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openOriginal(media.original);
  }

  function startPress(event, x, y, id) {
    const media = mediaFromEventTarget(event.target);
    if (!media) return;

    clearTimeout(press?.timer);
    press = {
      element: media.element,
      original: media.original,
      x,
      y,
      id,
      moved: false,
      timer: setTimeout(() => {
        if (!press || press.moved) return;
        suppressClickTarget = press.element;
        suppressClickUntil = performance.now() + 700;
        openOriginal(press.original);
      }, LONGPRESS_MS)
    };
  }

  function movePress(x, y, id) {
    if (!press || (id != null && press.id !== id)) return;
    if (Math.hypot(x - press.x, y - press.y) > MOVE_TOLERANCE) {
      press.moved = true;
      clearTimeout(press.timer);
    }
  }

  function endPress(id) {
    if (!press || (id != null && press.id !== id)) return;
    clearTimeout(press.timer);
    press = null;
  }

  window.addEventListener('click', modifierClick, true);
  if ('PointerEvent' in window) {
    window.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        startPress(event, event.clientX, event.clientY, event.pointerId);
      }
    }, { capture: true, passive: true });
    window.addEventListener('pointermove', event => {
      movePress(event.clientX, event.clientY, event.pointerId);
    }, { capture: true, passive: true });
    window.addEventListener('pointerup', event => endPress(event.pointerId), {
      capture: true,
      passive: true
    });
    window.addEventListener('pointercancel', event => endPress(event.pointerId), {
      capture: true,
      passive: true
    });
  } else {
    window.addEventListener('touchstart', event => {
      const touch = event.touches[0];
      if (touch) startPress(event, touch.clientX, touch.clientY, touch.identifier);
    }, { capture: true, passive: true });
    window.addEventListener('touchmove', event => {
      const touch = event.touches[0];
      if (touch) movePress(touch.clientX, touch.clientY, touch.identifier);
    }, { capture: true, passive: true });
    window.addEventListener('touchend', event => {
      endPress(event.changedTouches[0]?.identifier);
    }, { capture: true, passive: true });
    window.addEventListener('touchcancel', () => endPress(null), {
      capture: true,
      passive: true
    });
  }

  function renderedWidth(element) {
    const ownWidth = Math.ceil(element.getBoundingClientRect?.().width || 0);
    if (ownWidth > 1) return ownWidth;
    return Math.ceil(element.parentElement?.getBoundingClientRect?.().width || 0);
  }

  function updateSizes(element) {
    const state = imageState.get(element);
    if (!state?.generated || element.tagName !== 'IMG') return;

    const authored = element.getAttribute('data-sizes');
    const width = renderedWidth(element);
    const value = authored || (
      width > 1
        ? `${width}px`
        : DEFAULT_SIZES
    );
    if (element.getAttribute('sizes') !== value) element.setAttribute('sizes', value);
  }

  const resizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver(entries => {
        entries.forEach(entry => updateSizes(entry.target));
      })
    : null;

  let resizeQueued = false;
  if (!resizeObserver) {
    window.addEventListener('resize', () => {
      if (resizeQueued) return;
      resizeQueued = true;
      const scheduleFrame = window.requestAnimationFrame || (callback => setTimeout(callback, 16));
      scheduleFrame(() => {
        resizeQueued = false;
        resizableImages.forEach(element => {
          if (element.isConnected) updateSizes(element);
          else resizableImages.delete(element);
        });
      });
    }, { passive: true });
  }

  function hydrateImage(image) {
    const dataSrc = image.getAttribute('data-src');
    const dataSrcset = image.getAttribute('data-srcset');
    if (dataSrc && !image.getAttribute('src')) image.setAttribute('src', dataSrc);
    if (dataSrcset && !image.getAttribute('srcset')) {
      image.setAttribute('srcset', dataSrcset);
    }
    imageObserver?.unobserve(image);
  }

  const imageObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) hydrateImage(entry.target);
        });
      }, { rootMargin: imageMargin, threshold: 0 })
    : null;

  function observeImage(image) {
    if (imageObserver) imageObserver.observe(image);
    else hydrateImage(image);
  }

  function authorProvidedSrcset(element) {
    const srcset = element.getAttribute('srcset') || element.getAttribute('data-srcset') || '';
    if (!srcset) return false;
    return !isProxied(firstSrcsetUrl(srcset));
  }

  function tuneImage(element) {
    if (!(element instanceof Element)) return;
    if (
      element.tagName === 'SOURCE'
      && !/^image\//i.test(element.getAttribute('type') || '')
    ) return;

    const existing = imageState.get(element);
    const candidate = rawImageCandidate(element);
    if (existing) {
      if (!candidate || candidate === existing.original) return;
      if (isProxied(element.getAttribute('src') || firstSrcsetUrl(element.getAttribute('srcset')))) {
        return;
      }
      imageState.delete(element);
    }

    const full = fixUrl(element.getAttribute('data-full') || '');
    const original = storeOriginal(element, candidate || full);
    if (!original) return;

    if (element.dataset.noProxy != null || !IMG_HOST_MATCH.test(original)) {
      imageState.set(element, { original, generated: false, mode: 'original' });
      return;
    }

    if (authorProvidedSrcset(element)) {
      if (element.tagName === 'IMG') {
        element.loading = element.loading || 'lazy';
        element.decoding = 'async';
      }
      imageState.set(element, { original, generated: false, mode: 'authored-srcset' });
      element.dataset.proxied = '1';
      return;
    }

    const srcset = WIDTHS
      .map(width => `${proxify(original, width)} ${width}w`)
      .join(', ');
    imageState.set(element, { original, generated: true, fallback: false });

    if (element.tagName === 'SOURCE') {
      element.setAttribute('srcset', srcset);
      element.removeAttribute('data-src');
      element.dataset.proxied = '1';
      return;
    }

    element.referrerPolicy = 'no-referrer';
    element.decoding = 'async';
    element.loading = 'lazy';

    resizableImages.add(element);
    updateSizes(element);
    resizeObserver?.observe(element);

    const hasDeferredSource = element.hasAttribute('data-src') && !element.getAttribute('src');
    if (hasDeferredSource) {
      element.setAttribute('data-src', proxify(original, 960));
      element.setAttribute('data-srcset', srcset);
      observeImage(element);
    } else {
      element.setAttribute('src', proxify(original, 960));
      element.setAttribute('srcset', srcset);
    }
    element.dataset.proxied = '1';
  }

  function tunePicture(picture) {
    picture.querySelectorAll('source[type^="image/"]').forEach(tuneImage);
    const image = picture.querySelector('img');
    if (image) tuneImage(image);
  }

  /* Fallback del proxy: nunca dejar una imagen rota si existe el original. */
  doc.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    const state = imageState.get(image);
    const original = state?.original || getOriginalFrom(image);
    if (!state?.generated || state.fallback || !original) return;

    state.fallback = true;
    image.removeAttribute('srcset');
    image.removeAttribute('data-srcset');
    image.setAttribute('src', original);
    image.dataset.proxyFallback = 'original';
  }, true);

  const TYPE_MAP = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    ogv: 'video/ogg',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    ts: 'video/mp2t',
    m2ts: 'video/mp2t',
    m3u8: 'application/vnd.apple.mpegurl'
  };

  function mimeFrom(url) {
    try {
      const extension = (
        new URL(url, location.href).pathname.split('.').pop() || ''
      ).toLowerCase();
      return TYPE_MAP[extension] || '';
    } catch (_) {
      return '';
    }
  }

  function playable(video, mime) {
    if (!mime) return false;
    const support = video.canPlayType(mime);
    return support === 'probably' || support === 'maybe';
  }

  function canAutoPlay() {
    return !doc.hidden && !saveData && !reducedMotion?.matches;
  }

  function playVideo(video) {
    if (!canAutoPlay()) return;
    try {
      const promise = video.play();
      if (promise?.catch) promise.catch(() => {});
    } catch (_) {}
  }

  function hydrateVideo(video) {
    const state = videoState.get(video);
    if (!state || state.hydrated) return;

    const sources = Array.from(video.querySelectorAll('source'));
    sources.forEach(source => {
      const dataSrc = source.getAttribute('data-src');
      if (!source.getAttribute('src') && dataSrc) source.setAttribute('src', dataSrc);
      if (!source.getAttribute('type')) {
        const type = mimeFrom(source.getAttribute('src') || '');
        if (type) source.setAttribute('type', type);
      }
    });

    const videoDataSrc = video.getAttribute('data-src');
    if (!video.getAttribute('src') && videoDataSrc) {
      video.setAttribute('src', videoDataSrc);
    }

    const preferred = sources.find(source => {
      const type = (source.getAttribute('type') || '').toLowerCase();
      return type.includes('application/vnd.apple.mpegurl')
        || type.includes('video/mp4')
        || type.includes('avc1');
    });
    if (preferred) video.prepend(preferred);

    const first = video.querySelector('source');
    if (!playable(video, first?.getAttribute('type') || '')) {
      const compatible = sources.find(source => (
        playable(video, source.getAttribute('type') || '')
      ));
      if (compatible && compatible !== first) video.prepend(compatible);
    }

    state.hydrated = true;
    videoHydrateObserver?.unobserve(video);
    video.load();
    if (visibleVideos.has(video)) playVideo(video);
  }

  const videoHydrateObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) hydrateVideo(entry.target);
        });
      }, { rootMargin: videoMargin, threshold: 0.2 })
    : null;

  const videoPlaybackObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const video = entry.target;
          if (entry.isIntersecting) {
            visibleVideos.add(video);
            hydrateVideo(video);
            playVideo(video);
          } else {
            visibleVideos.delete(video);
            video.pause();
          }
        });
      }, { threshold: 0.25 })
    : null;

  function normalizeVideoSources(video, state) {
    let sources = Array.from(video.querySelectorAll('source'));
    if (!sources.length && (video.getAttribute('src') || video.getAttribute('data-src'))) {
      const source = doc.createElement('source');
      const url = video.getAttribute('src') || video.getAttribute('data-src');
      source.setAttribute('src', url);
      const type = video.getAttribute('type') || mimeFrom(url);
      if (type) source.setAttribute('type', type);
      video.appendChild(source);
      sources = [source];
    }

    const firstUrl = fixUrl(
      sources[0]?.getAttribute('src')
      || sources[0]?.getAttribute('data-src')
      || video.getAttribute('src')
      || video.getAttribute('data-src')
      || ''
    );
    state.original = storeOriginal(video, firstUrl);
    state.isArena = IMG_HOST_MATCH.test(state.original || '');

    if (!state.hasOwnLazy && state.isArena) {
      sources.forEach(source => {
        if (!source.getAttribute('data-src')) {
          const src = source.getAttribute('src');
          if (src) {
            source.setAttribute('data-src', fixUrl(src));
            source.removeAttribute('src');
          }
        }
        if (!source.getAttribute('type')) {
          const type = mimeFrom(source.getAttribute('data-src') || '');
          if (type) source.setAttribute('type', type);
        }
      });

      if (video.getAttribute('src') && !video.getAttribute('data-src')) {
        video.setAttribute('data-src', fixUrl(video.getAttribute('src')));
        video.removeAttribute('src');
      }
      video.preload = 'none';
      state.hydrated = false;
    } else {
      state.hydrated = true;
    }
  }

  function prepareVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    if (videoState.has(video)) return;

    const state = {
      original: '',
      isArena: false,
      hydrated: false,
      hasOwnLazy: video.classList.contains('lazy-video')
    };
    videoState.set(video, state);
    normalizeVideoSources(video, state);

    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    if (!state.hydrated) {
      if (videoHydrateObserver) videoHydrateObserver.observe(video);
      else hydrateVideo(video);
    }
    if (videoPlaybackObserver) videoPlaybackObserver.observe(video);
    else {
      visibleVideos.add(video);
      hydrateVideo(video);
      playVideo(video);
    }
    video.dataset.videoReady = '1';
  }

  function resumeVisibleVideos() {
    visibleVideos.forEach(video => {
      if (video.isConnected) playVideo(video);
      else visibleVideos.delete(video);
    });
  }

  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) visibleVideos.forEach(video => video.pause());
    else resumeVisibleVideos();
  }, { passive: true });
  window.addEventListener('pagehide', () => {
    visibleVideos.forEach(video => video.pause());
  }, { passive: true });
  const handleMotionPreference = () => {
    if (reducedMotion.matches) visibleVideos.forEach(video => video.pause());
    else resumeVisibleVideos();
  };
  if (reducedMotion?.addEventListener) {
    reducedMotion.addEventListener('change', handleMotionPreference);
  } else {
    reducedMotion?.addListener?.(handleMotionPreference);
  }

  function processElement(element) {
    if (!(element instanceof Element)) return;
    if (element.tagName === 'PICTURE') tunePicture(element);
    if (element.matches(IMG_SELECTOR)) tuneImage(element);
    if (element.tagName === 'VIDEO') prepareVideo(element);
    if (element.tagName === 'SOURCE' && /^video\//i.test(element.getAttribute('type') || '')) {
      prepareVideo(element.closest('video'));
    }
  }

  function scanRoot(root) {
    if (!(root instanceof Element) && root !== doc) return;
    if (root instanceof Element) processElement(root);
    root.querySelectorAll?.('picture,img,source[type^="image/"],video').forEach(processElement);
  }

  function cleanupRoot(root) {
    if (!(root instanceof Element)) return;
    const images = root.matches('img') ? [root] : Array.from(root.querySelectorAll('img'));
    const videos = root.matches('video') ? [root] : Array.from(root.querySelectorAll('video'));

    images.forEach(image => {
      imageObserver?.unobserve(image);
      resizeObserver?.unobserve(image);
      resizableImages.delete(image);
      imageState.delete(image);
    });
    videos.forEach(video => {
      videoHydrateObserver?.unobserve(video);
      videoPlaybackObserver?.unobserve(video);
      visibleVideos.delete(video);
      videoState.delete(video);
      video.pause();
    });
  }

  const pendingRoots = new Set();
  let flushQueued = false;
  function queueRoot(root) {
    if (!(root instanceof Element)) return;
    pendingRoots.add(root);
    if (flushQueued) return;
    flushQueued = true;
    enqueueMicrotask(() => {
      flushQueued = false;
      const roots = Array.from(pendingRoots);
      pendingRoots.clear();
      roots.forEach(scanRoot);
    });
  }

  const mutationObserver = 'MutationObserver' in window
    ? new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === 1) {
                queueRoot(node);
                if (node.tagName === 'SOURCE') queueRoot(node.closest('video'));
              }
            });
            mutation.removedNodes.forEach(node => {
              if (node.nodeType === 1) cleanupRoot(node);
            });
          } else if (mutation.type === 'attributes') {
            queueRoot(mutation.target);
            if (mutation.target.tagName === 'SOURCE') {
              queueRoot(mutation.target.closest('video'));
            }
          }
        });
      })
    : null;

  function processInitialDocument() {
    const nodes = Array.from(
      doc.querySelectorAll('picture,img,source[type^="image/"],video')
    );
    const immediate = Math.min(nodes.length, 48);
    for (let index = 0; index < immediate; index += 1) processElement(nodes[index]);

    let cursor = immediate;
    const processChunk = deadline => {
      let processed = 0;
      while (
        cursor < nodes.length
        && (processed < 64 || deadline.timeRemaining() > 4)
      ) {
        processElement(nodes[cursor]);
        cursor += 1;
        processed += 1;
      }
      if (cursor < nodes.length) enqueueIdle(processChunk);
    };
    if (cursor < nodes.length) enqueueIdle(processChunk);
  }

  function boot() {
    mutationObserver?.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'src',
        'srcset',
        'data-src',
        'data-srcset',
        'data-no-proxy',
        'type',
        'class'
      ]
    });
    processInitialDocument();

    if (doc.querySelector('.aei-embed')) {
      const url = new URL('./aei-panzoom.mjs', new URL(scriptSrc, location.href));
      import(url.href).catch(() => {});
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
