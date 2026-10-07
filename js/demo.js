// =============================================================
// EcoLand — Fazenda Demonstração: um mundo pronto com tudo o que
// o jogo tem até agora, funcionando e produzindo.
// =============================================================
G.newDemoWorld = function () {
  G.newGame('Fazenda Demonstração');
  S.worldId = 'demo';   // sempre o mesmo: recriar substitui o anterior
  S.creative = true; S.money = 999999;
  S.day = 10; S.time = 540; S.weather = 'sol'; S.tomorrow = 'sol';
  for (const l of D.lots) S.lots[l.id] = true;
  for (const u of ['mochila', 'botas', 'ferramentas']) S.upgrades[u] = true;
  for (const [k, L] of Object.entries(D.toolLevels)) S.tools[k] = L.length;
  S.player.waterMax = G.toolInfo('regador').cap; S.player.water = S.player.waterMax;

  const clear = (x0, y0, w, h, keepWater) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const t = G.tile(x, y);
      if (!t || (t.o && t.o.t === 'b')) continue;
      if (keepWater && t.g === 'water') continue;
      t.o = null; t.c = null; t.g = 'grass'; t.wet = false; t.fert = false;
    }
  };
  const build = (type, x, y, level = 3) => {
    const def = D.buildings[type];
    clear(x, y, def.w, def.h + 1);
    const b = G.addBuilding(type, x, y);
    b.level = Math.min(level, (def.levels || [0]).length);
    if (G.feedCap(b)) b.data.feed = G.feedCap(b);
    return b;
  };
  const herd = (b, type, n, babies = 0) => {
    for (let i = 0; i < n; i++) {
      const def = D.animals[type];
      const a = G.spawnAnimal(type, b, i < babies ? rnd(0, def.adult - 1) : def.adult + rnd(1, 20));
      a.happy = rnd(90, 100); a.petted = true;
      if (a.age >= def.adult && def.produce && def.produce.where === 'hand' && !G.perk(b, 'auto')) a.ready = true;
      a.x += (Math.random() - 0.5) * 1.5; a.y += Math.random() * 0.8;
    }
  };
  const plant = (x, y, id, grown) => {
    const t = G.tile(x, y), c = D.crops[id];
    t.o = null; t.g = 'tilled'; t.wet = true;
    t.c = { id, g: grown == null ? rnd(0, c.days) : grown, fert: chance(0.4), dead: false, hp: rnd(75, 100) };
  };

  // ---------- Sede: horta irrigada e oficina ----------
  const s = D.lots.find(l => l.id === 'sede');
  clear(s.x, s.y + 5, 14, 11, true);
  const crops = Object.keys(D.crops);
  for (let y = s.y + 7; y < s.y + 15; y++) for (let x = s.x + 1; x < s.x + 13; x++) {
    const dx = x - (s.x + 1), dy = y - (s.y + 7);
    if (dx % 5 === 2 && dy % 5 === 2) continue;           // lugar dos aspersores
    plant(x, y, crops[Math.floor(dx / 1) % crops.length], (dx + dy) % 3 === 0 ? 99 : null);
  }
  for (let y = s.y + 9; y < s.y + 15; y += 5) for (let x = s.x + 3; x < s.x + 13; x += 5) build('aspersor', x, y, 3);
  build('fogueira', s.x + 9, s.y + 3);
  build('poco', s.x + 10, s.y + 1, 1);
  build('defumador', s.x + 12, s.y + 4);
  build('moinho', s.x + 17, s.y + 1);
  const comp = build('composteira', s.x + 13, s.y + 5);
  comp.data.ready = 6; comp.data.batches = [{ d: 1, q: 1 }]; comp.data.load = 2;
  for (const [dx, dy] of [[15, 5], [16, 7], [18, 6]]) { const h = build('colmeia', s.x + dx, s.y + dy, dx === 15 ? 3 : 2); h.data.mel = rnd(2, 4); }

  // ---------- Pasto Norte: criação animal ----------
  const n = D.lots.find(l => l.id === 'norte');
  clear(n.x, n.y + 1, n.w, 9);
  const curral = build('curral', n.x + 1, n.y + 2, 3);
  herd(curral, 'vaca', 5, 1); herd(curral, 'cabra', 3); herd(curral, 'ovelha', 3, 1);
  curral.data.store = { leite_balde: 5, leite_cabra: 3, la: 2 }; curral.data.manure = 14;
  const galpao = build('galpao', n.x + 6, n.y + 2, 2);
  herd(galpao, 'ovelha', 3); herd(galpao, 'porco', 3, 1); galpao.data.manure = 9;
  const chiq = build('chiqueiro', n.x + 11, n.y + 2, 3);
  herd(chiq, 'porco', 8, 3); chiq.data.manure = 20;
  const gal = build('galinheiro', n.x + 15, n.y + 2, 3);
  herd(gal, 'galinha', 14, 3); gal.data.store = { ovo: 11 }; gal.data.manure = 7;
  const viv = build('viveiro', n.x + 1, n.y + 7, 3);
  herd(viv, 'codorna', 28, 5); viv.data.store = { ovo_codorna: 24 }; viv.data.manure = 6;
  build('silo', n.x + 4, n.y + 7, 3); build('silo', n.x + 7, n.y + 7, 2);
  build('cocho', n.x + 10, n.y + 7, 3); build('cocho', n.x + 13, n.y + 7, 2); build('cocho', n.x + 16, n.y + 7, 1);
  clear(n.x, n.y + 10, n.w, 5);
  G.fenceRect(n.x, n.y + 1, n.x + n.w - 1, n.y + 13);   // pasto todo cercado, com porteira embaixo

  // ---------- Várzea do Lago: piscicultura com aquaponia ----------
  const v = D.lots.find(l => l.id === 'sul');
  const t1 = build('tanque', v.x + 1, v.y + 1, 3); herd(t1, 'tilapia', 40, 12);
  const t2 = build('tanque', v.x + 1, v.y + 6, 1); herd(t2, 'tilapia', 12, 6);
  for (let y = v.y + 1; y < v.y + 6; y++) for (let x = v.x + 4; x < v.x + 8; x++) plant(x, y, ['alface', 'tomate', 'morango', 'pimenta'][x % 4]);

  // ---------- Campo Noroeste: pomar com colmeias ----------
  const o = D.lots.find(l => l.id === 'no');
  clear(o.x + 1, o.y + 1, 18, 13);
  const kinds = Object.keys(D.fruits);
  for (let y = o.y + 2, row = 0; y < o.y + 14; y += 3, row++) for (let x = o.x + 2, col = 0; x < o.x + 19; x += 3, col++) {
    const k = kinds[(row + col) % kinds.length], f = D.fruits[k];
    G.tile(x, y).o = { t: 'fruit', k, age: f.mature + rnd(5, 40), timer: 0, ready: chance(0.85) };
  }
  for (const [dx, dy] of [[4, 4], [10, 7], [16, 10]]) { const h = build('colmeia', o.x + dx, o.y + dy, 3); h.data.mel = rnd(3, 6); }

  // ---------- Mochila cheia ----------
  for (const [id, it] of Object.entries(D.items)) S.inv[id] = it.place ? 3 : it.seed || it.sapling ? 20 : 25;
  S.held = 'racao'; S.tool = 0;
  S.stats = { weeds: 50, till: 200, plant: 200, water: 300, wood: 200, stone: 200, harvest: 150, cook: 40, feed: 500, eggs: 200, compost: 30, lots: 8, slaughter: 10, smoke: 10, trees: 30, racao: 60 };
  S.quest = D.quests.length;   // manual concluído
  S.player.fome = 90; S.player.sede = 90;
  G.toHouse();
  G.save();
};
