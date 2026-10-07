// =============================================================
// EcoLand — controles por toque (celular/tablet)
// joystick virtual, toque no mundo, toque longo, pinça p/ zoom,
// botões de ação. Só ativa em aparelhos com toque.
// =============================================================
(() => {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch || !window.INPUT) return;
  const body = document.body;
  body.classList.add('touch');
  const cv = document.getElementById('game');
  const IN = window.INPUT;

  const LONG_MS = 450;     // toque longo = interagir
  const TAP_MOVE = 14;     // px de tolerância para ainda ser "toque"
  const JOY_R = 56;        // raio do joystick
  const DEAD = 0.28;       // zona morta (fração do raio)
  const DIAG = 0.38;       // sin(22.5°): 8 direções

  const canPlay = () => IN.isRunning() && !(window.UI && UI.isOpen());
  const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* */ } };

  // ---------- elementos ----------
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const wrap = el('div', '', '');
  wrap.id = 'touch-ui';
  const joy = el('div', 'tc-joy', '<div class="tc-knob"></div>');
  const knob = joy.firstChild;
  const ring = el('div', 'tc-ring');
  const acts = el('div', 'tc-acts');
  const mkBtn = (cls, icon, label, title) => {
    const b = el('button', 'tc-btn ' + cls, `<span class="tc-ic">${icon}</span><span class="tc-lb">${label}</span>`);
    b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
    acts.appendChild(b); return b;
  };
  const bUse = mkBtn('tc-use', '⚒️', 'Usar', 'Usar ferramenta no tile à frente');
  const bAct = mkBtn('tc-act', '✋', 'Interagir', 'Interagir / colher / conversar');
  const bEat = mkBtn('tc-eat', '🍎', 'Comer', 'Comer o item na mão');
  const bCyc = mkBtn('tc-cyc', '🔄', 'Q', 'Trocar item na mão (Q)');
  const rot = el('div', 'tc-rotate', '📱↻ Dica: gire o celular (paisagem) para jogar melhor');
  wrap.append(joy, ring, acts);
  body.append(wrap, rot);

  // ---------- botões de ação ----------
  function onPress(b, fn) {
    const fire = e => { e.preventDefault(); e.stopPropagation(); if (!canPlay()) return; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); fn(); };
    b.addEventListener('touchstart', fire, { passive: false });
    b.addEventListener('click', fire); // mouse em telas híbridas
  }
  onPress(bUse, () => { IN.mouse.moved = false; IN.act(false); });
  onPress(bAct, () => { IN.mouse.moved = false; IN.act(true); });
  onPress(bEat, () => {
    if (S.held && D.items[S.held] && D.items[S.held].e) IN.eat();
    else UI.toast('Segure uma comida para comer (troque com 🔄 ou no inventário 🎒).');
  });
  onPress(bCyc, () => IN.cycleHeld());

  // ---------- joystick ----------
  const myKeys = new Set();
  let joyId = null, joyBase = null, joyStart = 0, joyMoved = false;
  function setKeys(want) {
    for (const k of myKeys) if (!want.has(k)) { IN.keys.delete(k); myKeys.delete(k); }
    for (const k of want) if (!myKeys.has(k)) { IN.keys.add(k); myKeys.add(k); }
  }
  function placeJoy(x, y) { joy.style.left = x + 'px'; joy.style.top = y + 'px'; }
  function joyUpdate(x, y) {
    let dx = x - joyBase.x, dy = y - joyBase.y;
    const d = Math.hypot(dx, dy);
    if (d > TAP_MOVE) joyMoved = true;
    const k = d > JOY_R ? JOY_R / d : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const want = new Set();
    if (d / JOY_R > DEAD) {
      const nx = dx / d, ny = dy / d;
      if (nx > DIAG) want.add('d'); else if (nx < -DIAG) want.add('a');
      if (ny > DIAG) want.add('s'); else if (ny < -DIAG) want.add('w');
    }
    setKeys(want);
  }
  function joyEnd() {
    joyId = null; joyBase = null; setKeys(new Set());
    knob.style.transform = ''; joy.classList.remove('on'); joy.style.left = joy.style.top = '';
  }
  const inJoyZone = (x, y) => {
    const W = innerWidth, H = innerHeight;
    return x < W * 0.4 && y > H * (W < H ? 0.5 : 0.35);
  };

  // ---------- toque no mundo ----------
  const world = new Map(); // id -> {x0,y0,x,y,t,timer,long,moved,fence}
  let pinch = null; // {d, ids}
  const fenceMode = () => canPlay() && S.tool === 7 && ['cerca', 'ponte', 'gotejamento'].includes(S.held);
  const mouseEv = (type, x, y, target) => (target || cv).dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, buttons: type === 'mouseup' ? 0 : 1, bubbles: true, cancelable: true, view: window }));
  function pointAt(x, y) { IN.mouse.x = x; IN.mouse.y = y; IN.mouse.moved = true; }
  function showRing(x, y) { ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go'); }
  function hideRing() { ring.classList.remove('go'); }
  function cancelWorld(w) { if (w && w.timer) { clearTimeout(w.timer); w.timer = null; } hideRing(); }
  const pinchDist = () => { const [a, b] = [...world.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; };

  cv.addEventListener('touchstart', e => {
    e.preventDefault(); // sem eventos de mouse sintéticos nem zoom da página
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      if (joyId === null && world.size === 0 && inJoyZone(x, y) && canPlay()) {
        joyId = t.identifier; joyBase = { x, y }; joyStart = performance.now(); joyMoved = false;
        placeJoy(x, y); joy.classList.add('on'); joyUpdate(x, y);
        continue;
      }
      const w = { x0: x, y0: y, x, y, t: performance.now(), timer: null, long: false, moved: false, fence: false };
      world.set(t.identifier, w);
      if (world.size === 2) { // pinça
        for (const o of world.values()) { cancelWorld(o); if (o.fence) { mouseEv('mouseup', o.x, o.y, window); o.fence = false; } }
        pinch = pinchDist();
        continue;
      }
      if (world.size > 2 || !canPlay()) continue;
      pointAt(x, y);
      if (fenceMode()) { w.fence = true; mouseEv('mousedown', x, y); continue; }
      showRing(x, y);
      w.timer = setTimeout(() => {
        w.timer = null; hideRing();
        if (w.moved || pinch || !canPlay()) return;
        w.long = true; pointAt(w.x, w.y); IN.act(true); vib(25);
      }, LONG_MS);
    }
  }, { passive: false });

  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyUpdate(t.clientX, t.clientY); continue; }
      const w = world.get(t.identifier);
      if (!w) continue;
      w.x = t.clientX; w.y = t.clientY;
      if (Math.hypot(w.x - w.x0, w.y - w.y0) > TAP_MOVE) { if (!w.moved) { w.moved = true; cancelWorld(w); } }
      if (w.fence) { pointAt(w.x, w.y); mouseEv('mousemove', w.x, w.y); }
    }
    if (pinch && world.size >= 2) {
      const p = pinchDist();
      if (pinch.d > 10 && p.d > 10) {
        const f = p.d / pinch.d;
        if (Math.abs(f - 1) > 0.004) { IN.zoomBy(f, p.cx, p.cy); pinch = p; }
      }
    }
  }, { passive: false });

  function endTouch(e, cancelled) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const quick = !joyMoved && performance.now() - joyStart < 260;
        const x = joyBase.x, y = joyBase.y;
        joyEnd();
        // toque rápido na zona do joystick = toque no mundo
        if (quick && !cancelled && canPlay()) { pointAt(x, y); IN.act(false); }
        continue;
      }
      const w = world.get(t.identifier);
      if (!w) continue;
      world.delete(t.identifier);
      cancelWorld(w);
      if (w.fence) { pointAt(t.clientX, t.clientY); mouseEv('mouseup', t.clientX, t.clientY, window); continue; }
      if (pinch) { if (world.size < 2) { pinch = null; for (const o of world.values()) o.moved = true; } continue; }
      if (cancelled || w.long || w.moved || !canPlay()) continue;
      pointAt(t.clientX, t.clientY);
      IN.act(false);
    }
  }
  cv.addEventListener('touchend', e => endTouch(e, false), { passive: false });
  cv.addEventListener('touchcancel', e => endTouch(e, true), { passive: false });

  // ---------- sem zoom/rolagem da página ----------
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });

  // ---------- estado visual ----------
  let wasPlaying = null, lastIc = '', toldRotate = false;
  function tick() {
    const playing = IN.isRunning();
    if (playing !== wasPlaying) {
      wasPlaying = playing;
      body.classList.toggle('touch-playing', playing);
      if (playing && !toldRotate && innerHeight > innerWidth && innerWidth < 600) {
        toldRotate = true;
        setTimeout(() => window.UI && UI.toast('📱↻ Dica: na horizontal (paisagem) você vê mais da fazenda.'), 1500);
      }
    }
    if (playing && window.S) {
      if (window.UI && UI.isOpen() && joyId !== null) joyEnd();
      const sel = document.querySelector('#hotbar .slot.sel .ic');
      const ic = sel ? sel.innerHTML : '⚒️';
      if (ic !== lastIc) { lastIc = ic; bUse.querySelector('.tc-ic').innerHTML = ic; }
      bEat.classList.toggle('off', !(S.held && D.items[S.held] && D.items[S.held].e));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  addEventListener('blur', () => { if (joyId !== null) joyEnd(); });
})();
