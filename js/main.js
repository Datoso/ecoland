// =============================================================
// EcoLand — entrada (teclado/mouse) e laço principal
// =============================================================
(() => {
  const cv = document.getElementById('game');
  R.init(cv);
  const keys = new Set();
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, moved: false };
  let running = false, last = performance.now(), stepT = 0;
  G.swing = 0;

  const REACH = 1.9;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function audioInit() { try { SFX.init(); if (!SFX.music.playing) SFX.music.start(); } catch (e) { /* */ } }

  // alvo = tile sob o mouse (se ao alcance) ou tile à frente
  function target() {
    const p = S.player;
    const w = R.screenToWorld(mouse.x, mouse.y);
    const mx = Math.floor(w.x), my = Math.floor(w.y);
    if (mouse.moved && Math.hypot(mx + 0.5 - p.x, my + 0.5 - (p.y - 0.3)) <= REACH) return { x: mx, y: my, wx: w.x, wy: w.y };
    const [dx, dy] = DIRS[p.dir];
    const fx = Math.floor(p.x + dx * 0.9), fy = Math.floor(p.y - 0.2 + dy * 0.9);
    return { x: fx, y: fy, wx: fx + 0.5, wy: fy + 0.6 };
  }

  function faceTo(tg) {
    const p = S.player, dx = tg.x + 0.5 - p.x, dy = tg.y + 0.5 - p.y;
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx < 0 ? 'left' : 'right'; else if (Math.abs(dy) > 0.3) p.dir = dy < 0 ? 'up' : 'down';
  }

  function act(interact) {
    if (!running || UI.isOpen()) return;
    if (G.fish && !interact) { G.reel(); UI.hud(true); return; }   // pescando: clique fisga
    const tg = target();
    faceTo(tg);
    G.swing = 0.3;
    if (interact) G.interact(tg.x, tg.y, tg.wx, tg.wy);
    else G.useTool(tg.x, tg.y, tg.wx, tg.wy);
    UI.hud(true);
  }

  function cycleHeld() {
    const ids = Object.keys(S.inv).filter(k => S.inv[k] > 0 && (D.items[k].seed || D.items[k].sapling || D.items[k].place || D.items[k].e || D.items[k].feed || D.items[k].organic || D.items[k].fert));
    if (!ids.length) return;
    const i = ids.indexOf(S.held);
    S.held = ids[(i + 1) % ids.length]; S.tool = 7;
    UI.toast(`Na mão: ${D.items[S.held].i} ${D.items[S.held].n}`);
    UI.hud(true);
  }

  function openPanel(name) {
    if (!running) return;
    if (name === 'inv') { UI.toggleBag(); return; }   // mochila: painel lateral, não fecha outros painéis
    if (UI.isOpen()) { UI.close(); return; }
    ({ inv: UI.openInventory, craft: () => UI.openCraft(), manual: () => (UI.openBook || UI.openManual)(), lands: UI.openLands, eco: UI.openEco, pause: UI.pause, dev: UI.openDev })[name]?.();
  }

  function toggleSound() {
    try { const m = SFX.toggleMute(); document.getElementById('btn-sound').textContent = m ? '🔇' : '🔊'; UI.toast(m ? 'Som desligado' : 'Som ligado'); } catch (e) { /* */ }
  }

  addEventListener('keydown', e => {
    audioInit();
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (!running) return;
    if (k === 'escape') { UI.isOpen() ? UI.close() : UI.pause(); return; }
    if (k === 'i' || k === 'tab') { e.preventDefault(); openPanel('inv'); return; }
    if (k === 'c') { openPanel('craft'); return; }
    if (k === 'j') { openPanel('manual'); return; }
    if (k === 't') { openPanel('lands'); return; }
    if (k === 'p') { openPanel('eco'); return; }
    if (k === 'm') { toggleSound(); return; }
    if (k === 'k') { openPanel('dev'); return; }
    if (!UI.isOpen() && (k === '+' || k === '=')) { zoomBy(1.2); return; }
    if (!UI.isOpen() && (k === '-' || k === '_')) { zoomBy(1 / 1.2); return; }
    if (!UI.isOpen() && k === 'z') { toggleOverview(); return; }
    if (UI.isOpen()) return;
    keys.add(k);
    if (k >= '1' && k <= '9' && +k <= D.tools.length) { S.tool = +k - 1; UI.hud(true); }
    if (k === ' ') { e.preventDefault(); act(false); }
    if (k === 'e') act(true);
    if (k === 'q') cycleHeld();
    if (k === 'f') { if (S.held && D.items[S.held].e) G.eat(S.held); else UI.toast('Segure uma comida (slot 8) para comer.'); UI.hud(true); }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  // arrastar com a cerca na mão: cerca a área selecionada
  let drag = null;
  const holdingFence = () => running && !UI.isOpen() && S.tool === 7 && (S.held === 'cerca' || S.held === 'ponte' || S.held === 'gotejamento');
  const tileAt = (sx, sy) => { const w = R.screenToWorld(sx, sy); return { x: Math.floor(w.x), y: Math.floor(w.y) }; };
  cv.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true;
    if (drag) drag.end = tileAt(e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => { mouse.moved = false; });
  cv.addEventListener('mousedown', e => {
    audioInit(); mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true;
    if (e.button === 0 && holdingFence()) { const t = tileAt(e.clientX, e.clientY); drag = { start: t, end: t, type: S.held }; return; }
    act(e.button === 2);
  });
  addEventListener('mouseup', () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.start.x === d.end.x && d.start.y === d.end.y) { act(false); return; }
    if (d.type === 'ponte') G.bridgeLine(d.start.x, d.start.y, d.end.x, d.end.y);
    else if (d.type === 'gotejamento') G.dripRect(d.start.x, d.start.y, d.end.x, d.end.y);
    else G.fenceRect(d.start.x, d.start.y, d.end.x, d.end.y);
    UI.hud(true);
  });
  function drawDrag() {
    if (!drag) return;
    const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), TS = R.tileSize ? R.tileSize() : R.TS;
    const ax = Math.min(drag.start.x, drag.end.x), bx = Math.max(drag.start.x, drag.end.x);
    const ay = Math.min(drag.start.y, drag.end.y), by = Math.max(drag.start.y, drag.end.y);
    const p0 = R.worldToScreen(ax, ay);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(255,230,150,0.12)'; ctx.fillRect(p0.x, p0.y, (bx - ax + 1) * TS, (by - ay + 1) * TS);
    let need = 0;
    const okAt = (x, y) => drag.type === 'gotejamento' ? (t => !!t && t.g === 'tilled' && !t.drip)(G.tile(x, y)) : G.canPlace(drag.type, x, y);
    const cell = (x, y) => { const q = R.worldToScreen(x, y), ok = okAt(x, y); if (ok) need++; ctx.fillStyle = ok ? 'rgba(140,255,120,0.45)' : 'rgba(255,90,90,0.4)'; ctx.fillRect(q.x + 3, q.y + 3, TS - 6, TS - 6); };
    if (drag.type === 'ponte') G.bridgeCells(drag.start.x, drag.start.y, drag.end.x, drag.end.y).forEach(([x, y]) => cell(x, y));
    else if (drag.type === 'gotejamento' || ax === bx || ay === by) { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) cell(x, y); }
    else { for (let x = ax; x <= bx; x++) { cell(x, ay); cell(x, by); } for (let y = ay + 1; y < by; y++) { cell(ax, y); cell(bx, y); } }
    const have = S.creative ? '∞' : (S.inv[drag.type] || 0);
    const txt = drag.type === 'ponte' ? `${need} trecho(s) de ponte (você tem ${have})` : drag.type === 'gotejamento' ? `${need} canteiro(s) com gotejamento (você tem ${have} mangueiras)` : `${bx - ax + 1}×${by - ay + 1} · ${need} cercas (você tem ${have})`;
    const q = R.worldToScreen(bx + 1, by + 1);
    ctx.font = 'bold 14px Fredoka, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(40,28,15,0.85)'; ctx.fillRect(q.x + 4, q.y + 4, ctx.measureText(txt).width + 14, 24);
    ctx.fillStyle = '#ffe9a8'; ctx.fillText(txt, q.x + 11, q.y + 21);
  }
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // rodinha = zoom (Shift + rodinha troca ferramenta)
  cv.addEventListener('wheel', e => {
    if (!running || UI.isOpen()) return;
    e.preventDefault();
    if (e.shiftKey) { S.tool = (S.tool + (e.deltaY > 0 ? 1 : -1) + D.tools.length) % D.tools.length; UI.hud(true); return; }
    zoomBy(e.deltaY > 0 ? 1 / 1.15 : 1.15, e.clientX, e.clientY);
  }, { passive: false });
  function zoomBy(f, x, y) { if (R.zoomBy) R.zoomBy(f, x, y); }
  let lastZoom = 1;
  function toggleOverview() {
    if (!R.setZoom) return;
    const z = R.getZoom();
    if (z > 0.45) { lastZoom = z; R.setZoom(0.01); UI.toast('🗺️ Visão da fazenda inteira (Z volta)'); }
    else R.setZoom(lastZoom || 1);
  }
  document.querySelectorAll('#menu-btns button').forEach(b => b.addEventListener('click', () => { audioInit(); b.dataset.open === 'sound' ? toggleSound() : openPanel(b.dataset.open); }));
  document.getElementById('zoom-in').onclick = () => zoomBy(1.25);
  document.getElementById('zoom-out').onclick = () => zoomBy(1 / 1.25);
  document.getElementById('zoom-all').onclick = () => toggleOverview();
  document.getElementById('quest').addEventListener('click', () => openPanel('manual'));
  document.getElementById('c-eco').addEventListener('click', () => openPanel('eco'));

  // ganchos para outros módulos (controles por toque, livro tutorial)
  window.INPUT = {
    keys, mouse, act, cycleHeld, openPanel, toggleSound,
    zoomBy: (f, x, y) => zoomBy(f, x, y), toggleOverview: () => toggleOverview(),
    isRunning: () => running,
    eat: () => { if (S.held && D.items[S.held].e) G.eat(S.held); UI.hud(true); },
  };

  // ---------- movimento ----------
  function move(dt) {
    const p = S.player;
    let dx = 0, dy = 0;
    if (keys.has('w') || keys.has('arrowup')) dy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dy += 1;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    p.moving = !!(dx || dy);
    if (!p.moving) return;
    if (G.fish) G.cancelFish();
    const running = keys.has('shift');   // Shift = correr
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    let sp = 4.2 * (running ? 1.65 : 1) * (S.upgrades.botas ? 1.2 : 1) * (p.energy <= 0 ? 0.55 : 1) * (p.sick > 0 ? 0.8 : 1);
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx < 0 ? 'left' : 'right'; else p.dir = dy < 0 ? 'up' : 'down';
    mouse.moved = false;
    const r = 0.28;
    const free = (x, y) => !G.solid(Math.floor(x - r), Math.floor(y - r * 0.5)) && !G.solid(Math.floor(x + r), Math.floor(y - r * 0.5)) &&
      !G.solid(Math.floor(x - r), Math.floor(y + 0.1)) && !G.solid(Math.floor(x + r), Math.floor(y + 0.1));
    const nx = p.x + dx * sp * dt, ny = p.y + dy * sp * dt;
    if (free(nx, p.y)) p.x = nx;
    if (free(p.x, ny)) p.y = ny;
    stepT -= dt;
    if (stepT <= 0) { stepT = running ? 0.2 : 0.32; try { SFX.play('step', { volume: 0.5 }); } catch (e) { /* */ } }
  }

  function hintFor(tg) {
    const t = G.tile(tg.x, tg.y);
    if (!t) return '';
    if (!G.owned(tg.x, tg.y)) return '🔒 Terra à venda (T)';
    const a = G.animalAt(tg.wx, tg.wy);
    if (a) { const d = D.animals[a.type]; return `${a.name} · ${a.age >= d.adult ? d.n : d.baby}${a.ready ? ' · <b>E</b> coletar' : ' · <b>E</b> acariciar'}`; }
    if (t.o && t.o.t === 'b') { const b = G.getBuilding(t.o.id); return `${G.bname(b)}${b.level > 1 ? ' ' + '★'.repeat(b.level) : ''} · <b>E</b> interagir`; }
    if (t.o && t.o.t === 'fruit') return `${D.fruits[t.o.k].n}${t.o.ready ? ' · <b>E</b> colher' : ''}`;
    if (G.cropReady(t)) return `${D.crops[t.c.id].n} pronto! · <b>E</b> colher`;
    if (t.c && !t.c.dead) { const c = D.crops[t.c.id]; return `${c.n}${t.c.cri ? ` crioula (G${t.c.cri})` : ''} · faltam ${Math.max(0, c.days - t.c.g)}d · saúde ${Math.round(t.c.hp ?? 100)}%${t.wet ? ' · 💧' : ' · <b>precisa de água</b>'} · solo ${Math.round(G.fert(t, tg.x, tg.y))}%${t.c.pest ? ` · <b style="color:#ffb3a8">🐛 ${D.pests[t.c.pest].n}!</b>` : ''}${t.c.mono ? ' · 🔁 monocultura' : ''}`; }
    if (t.c && t.c.dead) return 'Planta morta · use a enxada ou a foice para limpar';
    if (t.g === 'tilled') return `Canteiro · solo ${Math.round(G.fert(t, tg.x, tg.y))}% (${G.soilLabel(G.fert(t, tg.x, tg.y))})${t.lastFam ? ` · última família: ${D.families[t.lastFam]}` : ''}${t.drip ? ' · 〰️ gotejamento' : ''}`;
    if (t.g === 'water') return 'Lago · <b>E</b> beber · regador enche';
    return '';
  }

  // ---------- laço ----------
  let musicMode = '', fireOn = false;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (running && S) {
      if (!UI.isOpen()) { move(dt); G.update(dt); }
      if (G.swing > 0) G.swing -= dt;
      const tg = target();
      let ghost = null;
      if (S.tool === 7 && S.held && D.items[S.held] && D.items[S.held].place) ghost = { type: D.items[S.held].place, x: tg.x, y: tg.y, ok: G.canPlace(D.items[S.held].place, tg.x, tg.y) };
      R.frame(dt, UI.isOpen() || drag ? null : tg, drag ? null : ghost);
      drawDrag();
      UI.hud();
      if (!UI.isOpen()) UI.hint(hintFor(tg));
      // música e ambiente
      const mode = S.weather === 'chuva' ? 'rain' : G.isNight() ? 'night' : 'day';
      if (mode !== musicMode) { musicMode = mode; try { SFX.music.setMode(mode); SFX.ambient('rain', mode === 'rain', 0.5); } catch (e) { /* */ } }
      let fd = 99;
      for (const b of S.buildings) if (b.type === 'fogueira') fd = Math.min(fd, Math.hypot(b.x + 0.5 - S.player.x, b.y + 0.5 - S.player.y));
      const want = fd < 6;
      if (want || fireOn) { try { SFX.ambient('fire', want, Math.max(0, 1 - fd / 6) * 0.6); } catch (e) { /* */ } fireOn = want; }
    }
    requestAnimationFrame(loop);
  }

  // ---------- tela inicial ----------
  const btnNew = document.getElementById('btn-new');
  const fmtDate = ts => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  function renderWorlds() {
    const box = document.getElementById('worlds');
    const list = G.listWorlds();
    box.innerHTML = list.length ? `<h3>🌍 Seus mundos</h3>` + list.map(w => `<div class="world" data-id="${w.id}">
        <div class="w-info"><b>${w.name.replace(/</g, '&lt;')}${w.creative ? ' <span class="creative-badge">🧪</span>' : ''}</b>
        <small>${D.SEASON_ICONS[w.season] || ''} ${D.SEASONS[w.season] || ''}, dia ${w.day} · ano ${w.year} · salvo ${fmtDate(w.updated)}</small></div>
        <button class="w-play">Jogar</button><button class="w-del" title="Apagar mundo">🗑️</button></div>`).join('') : '';
    box.querySelectorAll('.world').forEach(el => {
      const id = el.dataset.id;
      el.querySelector('.w-play').onclick = () => {
        audioInit();
        if (G.load(id)) { start(); UI.toast(`Bem-vindo de volta ao ${S.farmName}!`, 'good'); }
        else UI.toast('Não foi possível carregar este mundo.', 'bad');
      };
      const del = el.querySelector('.w-del');
      del.onclick = () => {
        if (del.dataset.armed) { G.deleteWorld(id); renderWorlds(); return; }
        del.dataset.armed = '1'; del.textContent = 'Apagar?'; del.classList.add('armed');
        setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = '🗑️'; del.classList.remove('armed'); } }, 3000);
      };
    });
  }
  renderWorlds();
  // folhas caindo na tela inicial
  (() => {
    const title = document.getElementById('title');
    const leaves = ['🍃', '🍂', '🌸', '🍁', '🌿'];
    for (let i = 0; i < 14; i++) {
      const l = document.createElement('span');
      l.className = 'leaf'; l.textContent = leaves[i % leaves.length];
      l.style.left = Math.random() * 100 + 'vw';
      l.style.animationDuration = 7 + Math.random() * 8 + 's';
      l.style.animationDelay = -Math.random() * 12 + 's';
      l.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      l.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      title.appendChild(l);
    }
  })();
  function start() {
    document.getElementById('title').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    running = true; UI.hud(true);
  }
  btnNew.onclick = () => {
    audioInit();
    G.newGame(document.getElementById('farm-name').value.trim());
    if (document.getElementById('creative').checked) G.setCreative(true);
    G.save();
    start(); UI.intro();
  };
  document.getElementById('btn-demo').onclick = () => {
    audioInit();
    G.newDemoWorld();
    start();
    UI.toast('🌎 Fazenda Demonstração: tudo construído, no nível máximo e produzindo! Modo teste ligado (K).', 'good');
  };
  // fundo animado da tela inicial
  G.newGame('preview'); S.time = 600;
  requestAnimationFrame(loop);
  (function titleBg() { if (running) return; R.frame(0.016, null, null); S.player.x += 0.004; requestAnimationFrame(titleBg); })();
})();
