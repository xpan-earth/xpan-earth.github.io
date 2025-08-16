/*
 * video-autoplay-mobile.js
 * Arreglo robusto para autoplay en iOS/Android con múltiples videos.
 * No cambia estilo ni controles. Solo normaliza atributos, carga y reproducción.
 */
(function(){
  const IS_MOBILE = matchMedia('(max-width: 640px)').matches;
  const LOAD_QUEUE_LIMIT = IS_MOBILE ? 2 : 6; // controla CARGA simultánea, no la reproducción

  const pendingToLoad = new Set();
  const blockedToPlay = new Set();
  let currentLoads = 0;

  function normalize(v){
    // atributos imprescindibles para autoplay móvil
    v.muted = true;                  // propiedad
    v.setAttribute('muted','');      // atributo
    v.setAttribute('playsinline','');
    v.setAttribute('webkit-playsinline','');
    if(!v.getAttribute('preload')){
      v.preload = v.dataset.eager ? 'auto' : 'metadata';
    }
  }

  function ensureSrc(v){
    // Si ya tiene src válido, no tocar. Si solo tiene data-src, aplicar con control de concurrencia.
    const hasRealSrc = v.currentSrc || (v.src && v.src !== window.location.href);
    if(hasRealSrc) return;

    const src = v.getAttribute('data-src') || v.getAttribute('src');
    if(!src) return;
    if(v.dataset.deferSrcApplied) return;

    if(v.dataset.eager || currentLoads < LOAD_QUEUE_LIMIT){
      v.src = src; v.dataset.deferSrcApplied='1'; v.load(); currentLoads++;
      v.addEventListener('loadeddata', ()=>{ currentLoads=Math.max(0,currentLoads-1); tryPlay(v); }, {once:true});
      v.addEventListener('error', ()=>{ currentLoads=Math.max(0,currentLoads-1); }, {once:true});
    }else{
      pendingToLoad.add(v);
    }
  }

  function drainQueue(){
    if(currentLoads >= LOAD_QUEUE_LIMIT) return;
    const it = pendingToLoad.values().next();
    if(!it.done){
      const v = it.value; pendingToLoad.delete(v);
      ensureSrc(v);
    }
  }
  setInterval(drainQueue, 150);

  function tryPlay(v){
    if(v.readyState>=2){
      v.play().catch(()=> blockedToPlay.add(v));
    }else{
      v.addEventListener('loadeddata', ()=> v.play().catch(()=> blockedToPlay.add(v)), {once:true});
    }
  }

  // Observa visibilidad para reproducir/pausar sin tocar estilo
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries)=>{
    for(const e of entries){
      const v = e.target;
      if(e.isIntersecting && e.intersectionRatio>0){
        ensureSrc(v);
        tryPlay(v);
      }else{
        if(!v.dataset.keepPlaying) v.pause();
      }
    }
  }, {threshold:[0,0.25,0.5], rootMargin:'100px'}) : null;

  function setupVideo(v){
    if(!v || v.dataset.vamInit) return;
    v.dataset.vamInit='1';
    normalize(v);
    if(io) io.observe(v);
    ensureSrc(v);
  }

  // Detecta videos insertados dinámicamente
  const mo = new MutationObserver((muts)=>{
    muts.forEach(m=>{
      m.addedNodes && m.addedNodes.forEach(node=>{
        if(node.nodeType===1){
          if(node.tagName==='VIDEO') setupVideo(node);
          node.querySelectorAll && node.querySelectorAll('video').forEach(setupVideo);
        }
      });
    });
  });
  mo.observe(document.documentElement, {childList:true, subtree:true});

  // Marca como eager el primer video bajo [data-section="walkthrough"], si existe
  function markWalkthroughEager(){
    document.querySelectorAll('[data-section="walkthrough"]').forEach(sec=>{
      const first = sec.querySelector('video:not([data-eager])');
      if(first){ first.dataset.eager='1'; first.preload='auto'; ensureSrc(first); tryPlay(first); }
    });
  }
  const eagerTimer = setInterval(markWalkthroughEager, 200);
  window.addEventListener('load', ()=>{ markWalkthroughEager(); clearInterval(eagerTimer); });

  // Desbloqueo por gesto + reintentos al volver a la pestaña
  function unlock(){
    document.querySelectorAll('video').forEach(v=>{ normalize(v); ensureSrc(v); });
    blockedToPlay.forEach(v=>{ tryPlay(v); blockedToPlay.delete(v); });
  }
  ;['pointerdown','touchstart','click','keydown'].forEach(evt=> document.addEventListener(evt, unlock, {passive:true}));
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') unlock(); });
  window.addEventListener('pageshow', ()=> unlock());

  // API mínima opcional
  window.VideoAutoplayMobile = {
    setup: ()=> document.querySelectorAll('video').forEach(setupVideo),
    registerHero: (el)=>{ if(el){ el.dataset.eager='1'; setupVideo(el); } },
  };

  // Escaneo inicial
  document.addEventListener('DOMContentLoaded', ()=> window.VideoAutoplayMobile.setup());
})();
