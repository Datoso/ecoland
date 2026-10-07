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
    if (UI.isOpen()) { UI.close(); return; }
    ({ inv: UI.openInventory, craft: () => UI.openCraft(), manual: UI.openManual, lands: UI.openLands, pause: UI.pause })[name]?.();
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
    if (k === 'm') { toggleSound(); return; }
    if (UI.isOpen()) return;
    keys.add(k);
    if (k >= '1' && k <= '8') { S.tool = +k - 1; UI.hud(true); }
    if (k === ' ') { e.preventDefault(); act(false); }
    if (k === 'e') act(true);
    if (k === 'q') cycleHeld();
    if (k === 'f') { if (S.held && D.items[S.held].e) G.eat(S.held); else UI.toast('Segure uma comida (slot 8) para comer.'); UI.hud(true); }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; });
  cv.addEventListener('mouseleave', () => { mouse.moved = false; });
  cv.addEventListener('mousedown', e => { audioInit(); mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; act(e.button === 2); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { if (!running || UI.isOpen()) return; S.tool = (S.tool + (e.deltaY > 0 ? 1 : -1) + D.tools.length) % D.tools.length; UI.hud(true); }, { passive: true });
  document.querySelectorAll('#menu-btns button').forEach(b => b.addEventListener('click', () => { audioInit(); b.dataset.open === 'sound' ? toggleSound() : openPanel(b.dataset.open); }));
  document.getElementById('quest').addEventListener('click', () => openPanel('manual'));

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
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    let sp = 4.2 * (S.upgrades.botas ? 1.2 : 1) * (p.energy <= 0 ? 0.55 : 1) * (p.sick > 0 ? 0.8 : 1);
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx < 0 ? 'left' : 'right'; else p.dir = dy < 0 ? 'up' : 'down';
    mouse.moved = false;
    const r = 0.28;
    const free = (x, y) => !G.solid(Math.floor(x - r), Math.floor(y - r * 0.5)) && !G.solid(Math.floor(x + r), Math.floor(y - r * 0.5)) &&
      !G.solid(Math.floor(x - r), Math.floor(y + 0.1)) && !G.solid(Math.floor(x + r), Math.floor(y + 0.1));
    const nx = p.x + dx * sp * dt, ny = p.y + dy * sp * dt;
    if (free(nx, p.y)) p.x = nx;
    if (free(p.x, ny)) p.y = ny;
    stepT -= dt;
    if (stepT <= 0) { stepT = 0.32; try { SFX.play('step', { volume: 0.5 }); } catch (e) { /* */ } }
  }

  function hintFor(tg) {
    const t = G.tile(tg.x, tg.y);
    if (!t) return '';
    if (!G.owned(tg.x, tg.y)) return '🔒 Terra à venda (T)';
    const a = G.animalAt(tg.wx, tg.wy);
    if (a) { const d = D.animals[a.type]; return `${a.name} · ${a.age >= d.adult ? d.n : d.baby}${a.ready ? ' · <b>E</b> coletar' : ' · <b>E</b> acariciar'}`; }
    if (t.o && t.o.t === 'b') { const b = G.getBuilding(t.o.id); return `${D.buildings[b.type].n} · <b>E</b> interagir`; }
    if (t.o && t.o.t === 'fruit') return `${D.fruits[t.o.k].n}${t.o.ready ? ' · <b>E</b> colher' : ''}`;
    if (G.cropReady(t)) return `${D.crops[t.c.id].n} pronto! · <b>E</b> colher`;
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
      R.frame(dt, UI.isOpen() ? null : tg, ghost);
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
  const btnNew = document.getElementById('btn-new'), btnCont = document.getElementById('btn-continue');
  if (G.hasSave()) btnCont.classList.remove('hidden');
  function start() {
    document.getElementById('title').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    running = true; UI.hud(true);
  }
  btnNew.onclick = () => {
    audioInit();
    G.newGame(document.getElementById('farm-name').value.trim());
    start(); UI.intro();
  };
  btnCont.onclick = () => {
    audioInit();
    if (G.load()) { start(); UI.toast(`Bem-vindo de volta ao ${S.farmName}!`, 'good'); }
    else UI.toast('Não foi possível carregar o jogo salvo.', 'bad');
  };
  // fundo animado da tela inicial
  G.newGame('preview'); S.time = 600;
  requestAnimationFrame(loop);
  (function titleBg() { if (running) return; R.frame(0.016, null, null); S.player.x += 0.004; requestAnimationFrame(titleBg); })();
})();
