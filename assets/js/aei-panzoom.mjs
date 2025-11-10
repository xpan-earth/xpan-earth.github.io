// aei-panzoom.mjs  /* patch: pan/zoom AEI sin tocar bloques */
(() => {
  if (window.__AEI_PZ__) return; window.__AEI_PZ__ = true;

  // Inyecta CSS mínimo solo una vez
  if (!document.getElementById('aei-panzoom-css')) {
    const css = `
      .aei-stage,.aei-lines{
        transform:translate3d(var(--aei-tx,0px),var(--aei-ty,0px),0) scale(var(--aei-zoom,1));
        transform-origin:0 0; will-change:transform;
      }`;
    const st = document.createElement('style'); st.id='aei-panzoom-css'; st.textContent=css;
    document.head.appendChild(st);
  }

  const Z_MIN = 0.5, Z_MAX = 3;

  function initInstance(embed){
    if (!embed || embed.__pz) return; embed.__pz = true;
    const stage = embed.querySelector('.aei-stage');
    const lines = embed.querySelector('.aei-lines');
    if (!stage || !lines) return;

    let tx=0, ty=0, zoom=1;
    const apply = () => {
      stage.style.setProperty('--aei-tx', tx+'px');
      stage.style.setProperty('--aei-ty', ty+'px');
      stage.style.setProperty('--aei-zoom', zoom);
      lines.style.setProperty('--aei-tx', tx+'px');
      lines.style.setProperty('--aei-ty', ty+'px');
      lines.style.setProperty('--aei-zoom', zoom);
    };
    function clampPan(){
      const cw = embed.clientWidth, ch = embed.clientHeight;
      const sw = stage.clientWidth * zoom, sh = stage.clientHeight * zoom;
      const minX = Math.min(0, cw - sw), minY = Math.min(0, ch - sh);
      tx = Math.max(minX, Math.min(0, tx));
      ty = Math.max(minY, Math.min(0, ty));
    }
    const onBlock = ev => !!ev.target.closest('.aei-block, a.aei-block');

    // Pointer gestures
    let p1=null, p2=null, start={tx:0,ty:0,zoom:1,px:0,py:0,c:null,d:0};
    const rectOf = el => el.getBoundingClientRect();
    const center = () => {
      const r = rectOf(embed);
      const x = (p1.x + (p2?.x ?? p1.x))/2 - r.left;
      const y = (p1.y + (p2?.y ?? p1.y))/2 - r.top;
      return {x,y};
    };
    const dist = (a,b)=>Math.hypot(a.x-b.x, a.y-b.y);

    embed.addEventListener('pointerdown', e=>{
      if (onBlock(e)) return;
      embed.setPointerCapture(e.pointerId);
      const pt = {id:e.pointerId, x:e.clientX, y:e.clientY};
      if (!p1) p1 = pt; else if (!p2 && pt.id !== p1.id) p2 = pt;
      start.tx=tx; start.ty=ty; start.zoom=zoom; start.px=p1.x; start.py=p1.y;
      if (p1 && p2){ start.c=center(); start.d=dist(p1,p2); }
    });
    embed.addEventListener('pointermove', e=>{
      if (e.pointerType==='mouse' && e.buttons===0) return;
      if (p1 && e.pointerId===p1.id){ p1.x=e.clientX; p1.y=e.clientY; }
      if (p2 && e.pointerId===p2.id){ p2.x=e.clientX; p2.y=e.clientY; }

      if (p1 && p2){
        const ratio = start.d ? dist(p1,p2)/start.d : 1;
        const nz = Math.max(Z_MIN, Math.min(Z_MAX, start.zoom*ratio));
        const c = center();
        const k = nz/zoom;
        tx = c.x - (c.x - tx)*k;
        ty = c.y - (c.y - ty)*k;
        zoom = nz;
        clampPan(); apply();
      } else if (p1 && !p2){
        tx = start.tx + (p1.x - start.px);
        ty = start.ty + (p1.y - start.py);
        clampPan(); apply();
      }
    }, {passive:true});
    function endPtr(e){
      if (p2 && e.pointerId===p2.id) p2=null;
      else if (p1 && e.pointerId===p1.id) p1=p2, p2=null;
      embed.releasePointerCapture?.(e.pointerId);
      if (!p1){ start.tx=tx; start.ty=ty; start.zoom=zoom; }
    }
    embed.addEventListener('pointerup', endPtr);
    embed.addEventListener('pointercancel', endPtr);

    // Wheel zoom desktop
    embed.addEventListener('wheel', e=>{
      if (onBlock(e)) return; e.preventDefault();
      const r = rectOf(embed), cx = e.clientX - r.left, cy = e.clientY - r.top;
      const prev = zoom, delta = Math.sign(e.deltaY)*0.1;
      zoom = Math.max(Z_MIN, Math.min(Z_MAX, zoom*(1-delta)));
      const k = zoom/prev;
      tx = cx - (cx - tx)*k;
      ty = cy - (cy - ty)*k;
      clampPan(); apply();
    }, {passive:false});

    addEventListener('resize', ()=>{ clampPan(); apply(); }, {passive:true});
    if (window.visualViewport){
      visualViewport.addEventListener('resize', ()=>{ clampPan(); apply(); });
    }
    apply();
  }

  // Inicializa todas las instancias presentes
  document.querySelectorAll('.aei-embed').forEach(initInstance);

  // También las futuras (por navegación parcial)
  const mo = new MutationObserver(muts=>{
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach(n=>{
        if (!(n instanceof Element)) return;
        if (n.matches?.('.aei-embed')) initInstance(n);
        n.querySelectorAll?.('.aei-embed').forEach(initInstance);
      });
    }
  });
  mo.observe(document.documentElement, {subtree:true, childList:true});

  // Termal: si se detecta caída sostenida de FPS en la página, fuerza modo low-power (reutiliza tu .lp)
  let frames=0, last=performance.now();
  function raf(t){
    frames++;
    if (t-last >= 1000){
      const fps = frames; frames = 0; last = t;
      if (fps < 26) document.querySelectorAll('.aei-embed').forEach(el=>el.classList.add('lp'));
      else if (fps > 45) document.querySelectorAll('.aei-embed').forEach(el=>el.classList.remove('lp'));
    }
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
})();
