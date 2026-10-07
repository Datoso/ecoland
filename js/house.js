// =============================================================
// EcoLand — interior da casa: cama de casal, despensa, geladeira,
// freezer, cozinha, armário de roupas, baú, TV com PS5 e computador.
// O mundo lá fora continua rodando. Carregar depois de bag.js.
// =============================================================
D.interior = {
  w: 14, h: 10,
  door: { x: 7, y: 9 },
  spawn: { x: 7.5, y: 8.3 },
  bedSide: { x: 4.5, y: 2.6 },
  furniture: [
    { id: 'cama', n: 'Cama de casal', x: 1, y: 1, w: 3, h: 2 },
    { id: 'armario', n: 'Armário de roupas', x: 4, y: 1, w: 2, h: 1 },
    { id: 'bau', n: 'Baú', x: 6, y: 1, w: 1, h: 1 },
    { id: 'tv', n: 'TV e PS5', x: 8, y: 1, w: 3, h: 1 },
    { id: 'sofa', n: 'Sofá', x: 8, y: 3, w: 3, h: 1 },
    { id: 'computador', n: 'Computador', x: 11, y: 1, w: 2, h: 1 },
    { id: 'despensa', n: 'Despensa', x: 1, y: 5, w: 1, h: 2 },
    { id: 'fogao', n: 'Fogão', x: 1, y: 7, w: 1, h: 1 },
    { id: 'pia', n: 'Pia', x: 2, y: 7, w: 1, h: 1 },
    { id: 'geladeira', n: 'Geladeira', x: 3, y: 7, w: 1, h: 1 },
    { id: 'freezer', n: 'Freezer', x: 4, y: 7, w: 1, h: 1 },
    { id: 'mesa', n: 'Mesa de jantar', x: 4, y: 5, w: 2, h: 1 },
  ],
};

(() => {
  const I = D.interior;
  const furnAt = (x, y) => I.furniture.find(f => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);

  Object.assign(G, {
    houseInit() {
      S.house = Object.assign({ despensa: {}, geladeira: {}, freezer: {}, bau: {} }, S.house || {});
      S.outfit = S.outfit || { shirt: '#d9534f', pants: '#4b6fa5', hat: 'palha' };
    },
    furnitureAt: furnAt,
    enterHouse() {
      UI.fade(() => {
        S.indoors = 'casa';
        S.player.x = I.spawn.x; S.player.y = I.spawn.y; S.player.dir = 'up';
        if (this.fish) this.fish = null;
      });
      sfx('open');
    },
    exitHouse() {
      S.indoors = null;
      const casa = S.buildings.find(b => b.type === 'casa'), d = this.buildingDoor(casa);
      S.player.x = d.x; S.player.y = d.y + 0.3; S.player.dir = 'down';
      sfx('close');
    },
    houseHint(tx, ty) {
      const f = furnAt(tx, ty);
      if (f) return `${f.n} · <b>E</b> usar`;
      if (ty >= I.door.y - 1 && Math.abs(tx - I.door.x) <= 0) return 'Porta · ande para baixo para sair';
      return '';
    },
    useFurniture(f) {
      const store = (k, title) => UI.openChest({ data: { items: S.house[k], title } });
      switch (f.id) {
        case 'cama': return UI.sleepDialog();
        case 'bau': return store('bau', '📦 Baú do quarto');
        case 'despensa': return store('despensa', '🫙 Despensa');
        case 'geladeira': return store('geladeira', '🧊 Geladeira');
        case 'freezer': return store('freezer', '❄️ Freezer');
        case 'fogao': case 'pia': return UI.openCraft('Cozinha');
        case 'armario': return UI.openWardrobe();
        case 'tv': return UI.openTV();
        case 'computador': return UI.openComputer();
        case 'sofa': {
          const p = S.player;
          if ((p.sofaUntil || 0) > S.time) { toast('Você já descansou no sofá há pouco.'); return; }
          p.sofaUntil = S.time + 120; S.time += 20; p.energy = Math.min(p.maxEnergy, p.energy + 8);
          toast('🛋️ Uma cochilada rápida no sofá: +8 ⚡'); sfx('sleep'); return;
        }
        case 'mesa': toast('🍽️ A mesa de jantar. Coma alguma coisa (F) com calma: aqui a comida rende mais.'); S.player.atTable = S.time + 60; return;
      }
    },
  });

  // ---------- colisão, interação e ferramentas dentro de casa ----------
  const _solid = G.solid.bind(G);
  G.solid = function (x, y, animal) {
    if (!S || !S.indoors || animal) return _solid(x, y, animal);
    if (x === I.door.x && y >= I.door.y) return false;          // porta (saída)
    if (x < 1 || x > I.w - 2 || y < 1 || y > I.h - 2) return true;  // paredes
    return !!furnAt(x, y);
  };
  const _interact = G.interact.bind(G);
  G.interact = function (tx, ty, wx, wy) {
    if (S.indoors) { const f = furnAt(tx, ty); if (f) G.useFurniture(f); return; }
    return _interact(tx, ty, wx, wy);
  };
  const _use = G.useTool.bind(G);
  G.useTool = function (tx, ty, wx, wy) {
    if (S.indoors) {
      const it = S.held && D.items[S.held];
      if (D.tools[S.tool].id === 'item' && it && it.e && !furnAt(tx, ty)) return G.eat(S.held);
      return G.interact(tx, ty, wx, wy);
    }
    return _use(tx, ty, wx, wy);
  };
  const _bi = G.buildingInteract.bind(G);
  G.buildingInteract = function (b) { if (b.type === 'casa') return G.enterHouse(); return _bi(b); };
  const _near = G.nearStation.bind(G);
  G.nearStation = function (type, range = 3) {
    if (S && S.indoors) {
      if (type === 'fogueira') return I.furniture.some(f => (f.id === 'fogao' || f.id === 'pia') && Math.hypot(f.x + 0.5 - S.player.x, f.y + 0.5 - S.player.y) <= 2.2);
      if (type === 'casa') return true;
      return !type;
    }
    return _near(type, range);
  };
  // comer à mesa rende mais
  const _eat = G.eat.bind(G);
  G.eat = function (id) {
    const it = D.items[id], p = S.player, table = S.indoors && (p.atTable || 0) > S.time;
    const before = p.fome;
    _eat(id);
    if (table && it && it.e && it.e.fome) { p.fome = Math.min(100, p.fome + Math.round(it.e.fome * 0.25)); if (p.fome > before) G.popup(p.x, p.y - 1.3, '🍽️ +25% à mesa', '#ffe066'); }
  };
  // acordar dentro de casa, ao lado da cama
  const _toHouse = G.toHouse.bind(G);
  G.toHouse = function () {
    if (S.indoors) { S.player.x = I.bedSide.x; S.player.y = I.bedSide.y; S.player.dir = 'down'; return; }
    return _toHouse();
  };
  // sair pela porta
  const _upd = G.update.bind(G);
  G.update = function (dt) {
    _upd(dt);
    if (S && S.indoors && S.player.y > I.door.y - 0.15) G.exitHouse();
  };
  for (const fn of ['newGame', 'load']) {
    const orig = G[fn].bind(G);
    G[fn] = function (...a) { const r = orig(...a); if (S && r !== false) G.houseInit(); return r; };
  }

  // ---------- interfaces dos móveis ----------
  const OUT = {
    shirt: [['Vermelha', '#d9534f'], ['Azul', '#3f7fbf'], ['Verde', '#4f9a3a'], ['Amarela', '#e8b33c'], ['Xadrez caipira', '#b5452f'], ['Branca', '#f2eadf'], ['Preta', '#333333'], ['Rosa', '#e889b5']],
    pants: [['Jeans', '#4b6fa5'], ['Marrom', '#6b4423'], ['Verde-oliva', '#5f6b2f'], ['Preta', '#2b2b2b'], ['Cáqui', '#b59b6a']],
    hat: [['Chapéu de palha', 'palha'], ['Boné', 'bone'], ['Chapéu de couro', 'couro'], ['Sem chapéu', 'nenhum']],
  };
  UI.openWardrobe = () => {
    const o = S.outfit;
    const row = (k, label) => `<h3>${label}</h3><div class="row">${OUT[k].map(([n, v]) => `<button class="btn ${o[k] === v ? '' : 'alt'} wd" data-k="${k}" data-v="${v}">${k === 'hat' ? '' : `<span class="sw" style="background:${v}"></span>`}${n}</button>`).join('')}</div>`;
    UI.show('wardrobe', `<h2>👕 Armário de roupas</h2><p><small>Escolha a roupa do dia. Ela aparece no seu personagem.</small></p>${row('shirt', 'Camisa')}${row('pants', 'Macacão / calça')}${row('hat', 'Chapéu')}`);
    document.querySelectorAll('#panel .wd').forEach(b => b.onclick = () => { S.outfit[b.dataset.k] = b.dataset.v; try { SFX.play('ui'); } catch (e) { /* */ } UI.openWardrobe(); });
  };
  const TIPS = [
    'Globo Rural: a rotação de culturas quebra o ciclo das pragas e recupera o solo.',
    'Globo Rural: cravo-de-defunto perto da horta afasta pragas — é a velha sabedoria do quintal.',
    'Globo Rural: a palhada (capim roçado) protege o solo da seca e vira adubo.',
    'Globo Rural: galinhas soltas perto da horta comem insetos e adubam a terra (sistema PAIS).',
    'Globo Rural: árvores no pasto dão sombra ao gado e aumentam a produção de leite (ILPF).',
    'Globo Rural: semente crioula guardada é semente adaptada à sua terra.',
    'Globo Rural: o biodigestor transforma esterco em gás de cozinha e adubo líquido.',
  ];
  UI.openTV = () => {
    const forecast = S.tomorrow === 'chuva' ? '🌧️ chuva amanhã — dá para folgar o regador' : '☀️ sol amanhã — regue a horta';
    UI.show('tv', `<h2>📺 TV e 🎮 PS5</h2><p>Previsão do tempo: <b>${forecast}</b>.</p><p><small>${TIPS[(S.day + S.season * 28) % TIPS.length]}</small></p>
      <div class="row"><button class="btn" id="tv-watch">📺 Assistir o Globo Rural (30 min)</button><button class="btn alt" id="tv-play">🎮 Jogar videogame (1 hora)</button></div>`);
    document.getElementById('tv-watch').onclick = () => { S.time += 30; S.player.energy = Math.min(S.player.maxEnergy, S.player.energy + 4); UI.close(); UI.toast('📺 ' + TIPS[(S.day * 3 + S.season) % TIPS.length], 'good'); };
    document.getElementById('tv-play').onclick = () => { S.time += 60; S.player.energy = Math.min(S.player.maxEnergy, S.player.energy + 10); S.player.fome = Math.max(0, S.player.fome - 4); UI.close(); UI.toast('🎮 Uma partida no PS5 para relaxar: +10 ⚡ (e a hora passou voando)'); try { SFX.play('levelup'); } catch (e) { /* */ } };
  };
  UI.openComputer = () => {
    UI.show('pc', `<h2>💻 Computador</h2><p><small>Internet rural via rádio. Dá para comprar on-line (entrega na hora, sem horário) e ver como anda a fazenda.</small></p>
      <div class="row"><button class="btn" id="pc-shop">🛒 Loja on-line Agro&Cia</button><button class="btn alt" id="pc-eco">📊 Relatório de autossuficiência</button><button class="btn alt" id="pc-skills">⭐ Habilidades</button><button class="btn alt" id="pc-save">💾 Salvar o jogo</button></div>`);
    document.getElementById('pc-shop').onclick = () => UI.openShop();
    document.getElementById('pc-eco').onclick = () => UI.openEco();
    document.getElementById('pc-skills').onclick = () => UI.openSkills();
    document.getElementById('pc-save').onclick = () => { if (G.save()) UI.toast('💾 Jogo salvo.', 'good'); };
  };
  // o botão "Baú da casa" do diálogo de dormir abre o baú do quarto quando se está dentro
  const _sleep = UI.sleepDialog;
  UI.sleepDialog = () => { _sleep(); if (S.indoors) { const btn = [...document.querySelectorAll('#panel .btn')].find(b => b.textContent.includes('Baú da casa')); if (btn) btn.remove(); } };
})();
