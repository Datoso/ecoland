// =============================================================
// EcoLand — habilidades estilo RuneScape (nível 1 a 99).
// Cada ação do jogo dá XP; bônus destravam nos níveis.
// Carregar depois de game.js/systems.js/soil.js e antes de ui.js.
// =============================================================
D.skills = {
  animais:     { n: 'Contato com os Animais', i: '🐾', desc: 'Alimentar, acariciar, ordenhar, coletar ovos, lã e mel.',
    perks: [[10, 'Animais +felizes todo dia'], [25, 'Chance de produto extra nas instalações'], [40, 'Mais mel ao colher a colmeia'], [60, 'Animais ficam adultos mais rápido'], [80, 'Produção extra frequente']] },
  agricultura: { n: 'Agricultura', i: '🌱', desc: 'Arar, plantar, regar e colher verduras e frutas.',
    perks: [[10, 'Chance de colheita extra'], [30, 'Regar e arar gastam menos energia'], [50, 'Frutas extras no pomar'], [70, 'Colheita extra frequente']] },
  culinaria:   { n: 'Culinária', i: '🍳', desc: 'Cozinhar, abater e processar carnes, defumar e moer.',
    perks: [[10, 'Chance de porção extra'], [30, '+1 carne em cada abate'], [60, '+2 carnes em cada abate'], [75, 'Porção extra frequente']] },
  lenha:       { n: 'Corte de lenha', i: '🪓', desc: 'Cortar árvores e roçar o mato.',
    perks: [[15, '+1 madeira por árvore'], [30, 'Golpe mais forte'], [50, '+2 madeiras por árvore'], [70, 'Derruba em 1 golpe']] },
  mineracao:   { n: 'Mineração', i: '⛏️', desc: 'Quebrar pedras e achar minérios.',
    perks: [[15, 'Chance de achar minério (ferragens)'], [30, 'Golpe mais forte'], [60, 'Mais pedras por rocha']] },
  pesca:       { n: 'Pesca', i: '🎣', desc: 'Pescar nos lagos.',
    perks: [[10, 'Mais tempo para fisgar'], [30, 'Peixe morde mais rápido'], [50, 'Mais peixes grandes e raros']] },
  construcao:  { n: 'Construção', i: '🔨', desc: 'Construir e evoluir construções.',
    perks: [[15, 'Chance de economizar material'], [40, 'Evoluções 10% mais baratas'], [70, 'Evoluções 20% mais baratas']] },
  herbologia:  { n: 'Herbologia', i: '🌿', desc: 'Adubos, compostagem, adubação verde, caldas, remédios e sementes.',
    perks: [[10, 'Adubo extra na composteira'], [30, 'Menos pragas na lavoura'], [50, 'Sementes extras ao separar'], [70, 'Plantas resistem mais à seca']] },
  artesanato:  { n: 'Artesanato', i: '🧶', desc: 'Trabalhar couro, lã, penas e palha na bancada.',
    perks: [[10, 'Chance de peça extra'], [30, 'Artesanato vende 15% mais caro'], [60, 'Artesanato vende 30% mais caro']] },
  vigor:       { n: 'Vigor', i: '💪', desc: 'Trabalho pesado e corrida aumentam a força.',
    perks: [[1, '+1 de energia máxima a cada 2 níveis'], [20, 'Corre mais rápido'], [40, 'Ferramentas gastam menos energia'], [70, 'Corrida de atleta']] },
};

// ---------- Artesanato ----------
D.buildings.bancada = { n: 'Bancada de artesanato', w: 2, h: 1, i: '🧵', desc: 'Trabalhe couro, lã, penas e palha.' };
Object.assign(D.items, {
  bancada:        { n: 'Bancada de artesanato', i: '🧵', place: 'bancada', sell: 0, cat: 'Construção' },
  chapeu_palha:   { n: 'Chapéu de palha', i: '👒', sell: 70, cat: 'Artesanato', craft: true },
  cesto:          { n: 'Cesto de palha', i: '🧺', sell: 60, cat: 'Artesanato', craft: true },
  novelo:         { n: 'Novelo de lã', i: '🧶', sell: 160, cat: 'Artesanato', craft: true },
  manta_la:       { n: 'Manta de lã', i: '🧣', sell: 520, cat: 'Artesanato', craft: true },
  blusa_la:       { n: 'Blusa de lã', i: '🧥', sell: 700, cat: 'Artesanato', craft: true },
  bolsa_couro:    { n: 'Bolsa de couro', i: '👜', sell: 380, cat: 'Artesanato', craft: true },
  luvas_trabalho: { n: 'Luvas de trabalho', i: '🧤', sell: 150, cat: 'Artesanato', craft: true, desc: 'Na mochila: ferramentas gastam 10% menos energia.' },
  botas_couro:    { n: 'Botas de couro', i: '👢', sell: 420, cat: 'Artesanato', craft: true },
  travesseiro:    { n: 'Travesseiro de penas', i: '🛏️', sell: 260, cat: 'Artesanato', craft: true },
  espanador:      { n: 'Espanador de penas', i: '🪶', sell: 90, cat: 'Artesanato', craft: true },
});
D.recipes.push(
  { out: 'bancada', q: 1, in: { madeira: 12, ferragens: 1 }, st: null, cat: 'Construção' },
  { out: 'chapeu_palha', q: 1, in: { capim: 6 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'cesto', q: 1, in: { capim: 8 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'novelo', q: 1, in: { la: 2 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'manta_la', q: 1, in: { novelo: 3 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'blusa_la', q: 1, in: { novelo: 4 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'bolsa_couro', q: 1, in: { couro: 2 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'luvas_trabalho', q: 1, in: { couro: 1 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'botas_couro', q: 1, in: { couro: 2, banha: 1 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'travesseiro', q: 1, in: { penas: 10, la: 1 }, st: 'bancada', cat: 'Artesanato' },
  { out: 'espanador', q: 1, in: { penas: 6 }, st: 'bancada', cat: 'Artesanato' },
);

(() => {
  // ---------- curva de XP (a mesma do RuneScape: nível 2 = 83 XP, 10 = 1.154, 50 = 101 mil, 99 = 13 milhões) ----------
  const XP = [0, 0];
  let pts = 0;
  for (let l = 1; l < 99; l++) { pts += Math.floor(l + 300 * Math.pow(2, l / 7)); XP[l + 1] = Math.floor(pts / 4); }
  const levelFor = xp => { let l = 1; while (l < 99 && xp >= XP[l + 1]) l++; return l; };

  Object.assign(G, {
    XP_TABLE: XP,
    skillsInit() { S.skills = S.skills || {}; for (const k of Object.keys(D.skills)) S.skills[k] = S.skills[k] || 0; this.applyVigor(); },
    lvl2: null,
    skill(k) { return S && S.skills ? levelFor(S.skills[k] || 0) : 1; },
    totalLevel() { return Object.keys(D.skills).reduce((s, k) => s + this.skill(k), 0); },
    xp(k, amount) {
      if (!S || !S.skills || !amount) return;
      const before = this.skill(k);
      S.skills[k] = (S.skills[k] || 0) + amount;
      xpDrop(k, amount);
      const after = this.skill(k);
      if (after > before) this.levelUp(k, after);
    },
    levelUp(k, lv) {
      const sk = D.skills[k];
      sfx('levelup'); setTimeout(() => sfx('quest'), 350);
      fireworks();
      banner(sk, lv);
      const perk = sk.perks.find(([l]) => l === lv);
      if (perk) UI.toast(`✨ ${sk.i} ${sk.n} nível ${lv} — novo bônus: <b>${perk[1]}</b>`, 'good');
      this.burst(S.player.x, S.player.y - 0.5, '#ffe066', 16);
      if (k === 'vigor') this.applyVigor();
    },
    applyVigor() { if (S && S.player) S.player.maxEnergy = 100 + Math.floor(this.skill('vigor') / 2); },
  });

  // ---------- fogos de artifício e faixa de parabéns (estilo RuneScape) ----------
  const COLORS = ['#ffe066', '#ff6b5e', '#6cc2ff', '#9dff7a', '#e08cff', '#ffffff', '#ffb347'];
  function fireworks() {
    for (let k = 0; k < 7; k++) setTimeout(() => {
      if (!S) return;
      const cx = S.player.x + (Math.random() - 0.5) * 3, cy = S.player.y - 2 - Math.random() * 1.6, col = COLORS[k % COLORS.length];
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * Math.PI * 2, v = 2.5 + Math.random() * 2;
        G.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 0.9 + Math.random() * 0.5, color: Math.random() < 0.3 ? '#fff' : col });
      }
      try { SFX.play('pop', { volume: 0.4 }); SFX.play('harvest', { volume: 0.35 }); } catch (e) { /* */ }
    }, k * 170);
  }
  function banner(sk, lv) {
    document.querySelectorAll('.lvlup').forEach(e => e.remove());   // a faixa nova substitui a anterior
    const el = document.createElement('div');
    el.className = 'lvlup';
    const icon = (window.ITEMICONS && ITEMICONS.html('skill_' + Object.keys(D.skills).find(k => D.skills[k] === sk))) || sk.i;
    el.innerHTML = `<div class="lv-icon">${icon}</div><div><b>Parabéns!</b> Você avançou para o nível <b>${lv}</b> em <b>${sk.n}</b>.<br><small>Nível total: ${G.totalLevel()}</small></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3800);
  }

  // ---------- "+XP" flutuante (estilo RuneScape) ----------
  const drops = document.createElement('div');
  drops.id = 'xpdrops'; document.body.appendChild(drops);
  const pending = {};
  function xpDrop(k, n) {
    pending[k] = (pending[k] || 0) + n;
    if (pending[k + '_t']) return;
    pending[k + '_t'] = setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'xpdrop';
      const icon = (window.ITEMICONS && ITEMICONS.html('skill_' + k)) || D.skills[k].i;
      el.innerHTML = `${icon}<span>+${Math.round(pending[k])}</span>`;
      drops.appendChild(el);
      setTimeout(() => el.remove(), 1600);
      pending[k] = 0; pending[k + '_t'] = null;
    }, 120);
  }

  // ---------- XP vindo das estatísticas que o jogo já registra ----------
  const STAT_XP = {
    weeds: ['lenha', 5],
    till: ['agricultura', 3], plant: ['agricultura', 4], water: ['agricultura', 1.5], harvest: ['agricultura', 9], fruits: ['agricultura', 10], trees: ['agricultura', 15],
    cook: ['culinaria', 15], smoke: ['culinaria', 25], racao: ['culinaria', 3], slaughter: ['culinaria', 30],
    eggs: ['animais', 3], animalProd: ['animais', 8], feed: ['animais', 0.6],
    compost: ['herbologia', 20], greenmanure: ['herbologia', 16], pesticide: ['herbologia', 20], seeds: ['herbologia', 2], cravo: ['herbologia', 6],
  };
  // lenha e pedra só dão XP quando você corta/quebra (comprar na loja não conta)
  const _useTool = G.useTool.bind(G);
  G.useTool = function (tx, ty, wx, wy) {
    const w0 = S.stats.wood || 0, s0 = S.stats.stone || 0, tool = D.tools[S.tool].id;
    const r = _useTool(tx, ty, wx, wy);
    if (tool === 'machado' && S.stats.wood > w0) G.xp('lenha', (S.stats.wood - w0) * 6);
    if (tool === 'picareta' && S.stats.stone > s0) G.xp('mineracao', (S.stats.stone - s0) * 8);
    return r;
  };
  const _stat = G.stat.bind(G);
  G.stat = function (k, n = 1) {
    _stat(k, n);
    const m = STAT_XP[k];
    if (m) G.xp(m[0], m[1] * n);
    // mineração: chance de achar minério
    if (k === 'stone' && G.skill('mineracao') >= 15 && chance(G.skill('mineracao') / 400)) { G.add('ferragens', 1, true); G.popup(S.player.x, S.player.y - 1, '+1 🔩 minério!', '#c9d1d7'); }
    if (k === 'compost' && G.skill('herbologia') >= 10 && chance(G.skill('herbologia') / 200)) G.add('adubo', 1, true);
  };

  // acariciar e mel
  const _touch = G.touchAnimal.bind(G);
  G.touchAnimal = function (a) { const was = a.petted; _touch(a); if (!was && a.petted) G.xp('animais', 4); };
  const _add = G.add.bind(G);
  G.add = function (id, n = 1, silent) {
    if (id === 'mel' && !G._melBonus) {
      G.xp('animais', 15 * n);
      if (G.skill('animais') >= 40 && chance(0.5)) n += 1;
    }
    return _add(id, n, silent);
  };

  // energia: vigor sobe com trabalho pesado; ferramentas gastam menos com vigor e luvas
  const _use = G.useEnergy.bind(G);
  G.useEnergy = function (base) {
    let k = 1;
    if (G.skill('vigor') >= 40) k -= 0.1;
    if (S.inv.luvas_trabalho > 0) k -= 0.1;
    if (G.skill('agricultura') >= 30) k -= 0.05;
    const ok = _use(base * k);
    if (ok) G.xp('vigor', base * 1.5);
    return ok;
  };

  // níveis das ferramentas recebem os bônus das habilidades
  const _ti = G.toolInfo.bind(G);
  G.toolInfo = function (id) {
    const t = _ti(id);
    if (!t || !S || !S.skills) return t;
    const o = Object.assign({}, t);
    if (id === 'machado') { const l = G.skill('lenha'); o.dmg = (o.dmg || 1) + (l >= 30 ? 1 : 0) + (l >= 70 ? 2 : 0); o.bonus = (o.bonus || 0) + (l >= 50 ? 2 : l >= 15 ? 1 : 0); }
    if (id === 'picareta') { const l = G.skill('mineracao'); o.dmg = (o.dmg || 1) + (l >= 30 ? 1 : 0); }
    if (id === 'faca') { const l = G.skill('culinaria'); o.bonus = (o.bonus || 0) + (l >= 60 ? 2 : l >= 30 ? 1 : 0); }
    if (id === 'vara') { const l = G.skill('pesca'); o.window = (o.window || 0.8) + l * 0.01; o.wait = (o.wait || 1) * (l >= 30 ? 0.85 : 1); o.rare = (o.rare || 0) + (l >= 50 ? l * 0.002 : 0); }
    return o;
  };

  // colheita extra (agricultura)
  const _sy = G.soilYield.bind(G);
  G.soilYield = function (t, c, n, x, y) { n = _sy(t, c, n, x, y); const l = G.skill('agricultura'); if (l >= 10 && chance(l / (l >= 70 ? 160 : 260))) n++; return n; };

  // culinária/artesanato/construção ao criar
  const _craft = G.craft.bind(G);
  G.craft = function (r) {
    const ok = _craft(r);
    if (!ok) return ok;
    if (r.cat === 'Construção') {
      const mats = Object.values(r.in).reduce((s, n) => s + n, 0);
      G.xp('construcao', 20 + mats);
      const l = G.skill('construcao');
      if (l >= 15) for (const [k, n] of Object.entries(r.in)) if (chance(l / 400)) { G.add(k, Math.max(1, Math.floor(n / 3)), true); G.popup(S.player.x, S.player.y - 1, `♻️ economizou ${D.items[k].n.toLowerCase()}`, '#b6f5a0'); }
    } else if (r.cat === 'Artesanato') {
      G.xp('artesanato', 25 + Object.values(r.in).reduce((s, n) => s + n, 0) * 3);
      if (G.skill('artesanato') >= 10 && chance(G.skill('artesanato') / 300)) G.add(r.out, 1);
    } else if (['Cozinha', 'Preparo', 'Defumador', 'Moinho'].includes(r.cat)) {
      if (r.cat === 'Moinho') G.xp('culinaria', 8);
      const l = G.skill('culinaria');
      if (l >= 10 && chance(l / (l >= 75 ? 180 : 300))) { G.add(r.out, 1); G.popup(S.player.x, S.player.y - 1.2, '✨ porção extra!', '#ffe066'); }
    }
    return ok;
  };

  // evoluções mais baratas (construção)
  const _up = G.upgrade.bind(G);
  G.upgrade = function (b) {
    const nx = G.nextLevel(b); if (!nx) return false;
    const l = G.skill('construcao'), disc = l >= 70 ? 0.8 : l >= 40 ? 0.9 : 1;
    const orig = nx.cost; nx.cost = Math.round(orig * disc);
    const ok = _up(b); nx.cost = orig;
    if (ok) G.xp('construcao', 60 + Math.round(orig / 20));
    return ok;
  };

  // artesanato vende mais caro
  const _sell = G.sell.bind(G);
  G.sell = function (id, qty) {
    const it = D.items[id], l = G.skill('artesanato');
    if (it && it.craft && l >= 30) { const orig = it.sell; it.sell = Math.round(orig * (l >= 60 ? 1.3 : 1.15)); _sell(id, qty); it.sell = orig; return; }
    return _sell(id, qty);
  };

  // herbologia: sementes extras ao separar
  const _ss = G.saveSeeds.bind(G);
  G.saveSeeds = function (b, crop, qty) { const ok = _ss(b, crop, qty); if (ok && G.skill('herbologia') >= 50 && chance(0.4)) G.add('cri_' + crop, 1, true); return ok; };

  // noite: animais e pragas sentem os bônus
  const _feed = G.feedAnimals.bind(G);
  G.feedAnimals = function (R) {
    _feed(R);
    const l = G.skill('animais');
    if (l >= 10) for (const a of S.animals) a.happy = Math.min(100, a.happy + l / 10);
    if (l >= 60) for (const a of S.animals) if (a.age < D.animals[a.type].adult && chance(0.25)) a.age++;
    if (l >= 25) for (const b of S.buildings) if (b.data.store) for (const [k, n] of Object.entries(b.data.store)) { const extra = Math.floor(n * (l >= 80 ? 0.2 : 0.08) + Math.random()); if (n > 0 && extra > 0) b.data.store[k] = n + extra; }
  };
  const _pests = G.nightPests.bind(G);
  G.nightPests = function (R) {
    _pests(R);
    const l = G.skill('herbologia');
    if (l >= 30) for (const t of S.tiles) if (t.c && t.c.pest && chance(l / 250)) t.c.pest = null;
    if (l >= 70) for (const t of S.tiles) if (t.c && !t.c.dead && t.c.hp < 100) t.c.hp = Math.min(100, t.c.hp + 5);
  };

  // ---------- painel de habilidades (tecla H) ----------
  UI.openSkills = sel => {
    const keys = Object.keys(D.skills);
    sel = sel || keys[0];
    const ic = k => (window.ITEMICONS && ITEMICONS.html('skill_' + k)) || D.skills[k].i;
    const tile = k => { const l = G.skill(k), x = S.skills[k] || 0, a = XP[l], b = XP[Math.min(99, l + 1)], p = l >= 99 ? 100 : Math.round((x - a) / (b - a) * 100);
      return `<div class="sk ${k === sel ? 'on' : ''}" data-k="${k}" title="${D.skills[k].n}"><div class="sk-ic">${ic(k)}</div><div class="sk-lv">${l}<small>/99</small></div><div class="sk-bar"><i style="width:${p}%"></i></div></div>`; };
    const sk = D.skills[sel], l = G.skill(sel), x = S.skills[sel] || 0, next = l >= 99 ? null : XP[l + 1];
    UI.show('skills', `<h2>⭐ Habilidades <small style="color:#7a6a50">· nível total ${G.totalLevel()}</small></h2>
      <div class="sk-wrap"><div class="sk-grid">${keys.map(tile).join('')}</div>
      <div class="sk-detail"><h3>${ic(sel)} ${sk.n} — nível ${l}</h3><p>${sk.desc}</p>
        <p><b>XP:</b> ${Math.floor(x).toLocaleString('pt-BR')}${next ? ` · próximo nível em ${Math.ceil(next - x).toLocaleString('pt-BR')} XP` : ' · nível máximo!'}</p>
        <ul class="perks">${sk.perks.map(([lv, t]) => `<li class="${l >= lv ? 'got' : ''}">${l >= lv ? '✅' : '🔒'} <b>Nível ${lv}:</b> ${t}</li>`).join('')}</ul></div></div>`);
    document.querySelectorAll('#panel .sk').forEach(el => el.onclick = () => UI.openSkills(el.dataset.k));
  };

  // inicializa em jogos novos/carregados
  for (const fn of ['newGame', 'load']) {
    const orig = G[fn].bind(G);
    G[fn] = function (...a) { const r = orig(...a); if (S && r !== false) G.skillsInit(); return r; };
  }
})();
