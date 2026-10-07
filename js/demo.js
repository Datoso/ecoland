// =============================================================
// EcoLand — Fazenda Demonstração: um mundo pronto com tudo o que o
// jogo tem, organizado como um sistema integrado (PAIS + ILPF):
//   Sede ............ casa, oficina e horta PAIS em volta do galinheiro
//   Pasto Norte ..... gado de leite (curral + pasto cercado)
//   Campo Noroeste .. ovelhas e cabras (galpão + pasto cercado)
//   Mata Leste ...... porcos num piquete na borda da mata manejada
//   Cerrado Oeste ... pomar, trepadeiras e apiário
//   Capoeira NE ..... lavoura de grãos e forragem + moinho e silo
//   Várzea do Lago .. piscicultura com aquaponia
//   SO e SE ......... reserva legal (vegetação nativa preservada)
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
  const lot = id => D.lots.find(l => l.id === id);

  const clear = (x0, y0, w, h, keepWater = true) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const t = G.tile(x, y);
      if (!t || (t.o && t.o.t === 'b')) continue;
      if (keepWater && t.g === 'water') continue;
      t.o = null; t.c = null; t.g = t.g === 'water' ? 'water' : 'grass'; t.wet = false; t.fert = false;
    }
  };
  const build = (type, x, y, level = 3) => {
    const def = D.buildings[type];
    clear(x, y, def.w, def.h + 1, false);
    const b = G.addBuilding(type, x, y);
    b.level = Math.min(level, (def.levels || [0]).length);
    if (G.feedCap(b)) b.data.feed = G.feedCap(b);
    return b;
  };
  const herd = (b, type, n, babies = 0) => {
    const def = D.animals[type];
    for (let i = 0; i < n; i++) {
      const a = G.spawnAnimal(type, b, i < babies ? rnd(0, def.adult - 1) : def.adult + rnd(1, 20));
      a.happy = rnd(90, 100); a.petted = true;
      if (a.age >= def.adult && def.produce && def.produce.where === 'hand' && !G.perk(b, 'auto')) a.ready = chance(0.6);
      a.x += (Math.random() - 0.5) * 1.5; a.y += Math.random() * 0.8;
    }
  };
  const plant = (x, y, id, grown) => {
    const t = G.tile(x, y), c = D.crops[id];
    if (!t || t.o || t.g === 'water') return;
    t.g = 'tilled'; t.wet = true;
    t.c = { id, g: grown == null ? rnd(0, c.days) : grown, fert: chance(0.4), dead: false, hp: rnd(80, 100), cri: chance(0.5) ? rnd(1, 5) : undefined };
    t.f = rnd(60, 95); t.lastFam = chance(0.5) ? 'leguminosa' : 'adubo_verde';
  };
  const tree = (x, y, k) => {
    const f = D.fruits[k], t = G.tile(x, y);
    clear(x, y, 1, 1, false);
    t.o = { t: 'fruit', k, age: f.mature + rnd(5, 60), timer: rnd(0, f.every - 1), ready: chance(0.7), trellis: !!f.climber };
  };
  const fence = (x0, y0, x1, y1, side) => G.fenceRect(x0, y0, x1, y1, true, side);

  // ---------- Sede: casa, oficina e horta PAIS ----------
  const s = lot('sede');
  clear(s.x, s.y + 3, s.w, s.h - 3);
  clear(s.x, s.y, s.w, 2);   // caminho ao norte da casa (porteira do pasto)
  build('fogueira', s.x + 8, s.y + 3);
  build('poco', s.x + 9, s.y + 1, 1);
  build('defumador', s.x + 11, s.y + 4);
  build('banco_sementes', s.x + 11, s.y, 3);
  for (const id of Object.keys(D.crops)) S.seedBank[id] = { gen: rnd(1, 5), saved: rnd(20, 120), fresh: chance(0.4) ? rnd(1, 4) : 0 };
  S.buildings.find(b => b.type === 'cozinha_externa').level = 3;   // cozinha caipira completa
  const comp = build('composteira', s.x + 11, s.y + 14);
  comp.data.ready = 6; comp.data.batches = [{ d: 1, q: 1 }]; comp.data.load = 2;
  // PAIS: galinheiro no centro, cercado, com canteiros em anel ao redor
  const gx0 = s.x + 5, gy0 = s.y + 7, gx1 = s.x + 12, gy1 = s.y + 12;
  const gal = build('galinheiro', s.x + 7, s.y + 8, 3);
  fence(gx0, gy0, gx1, gy1);
  herd(gal, 'galinha', 12, 3); gal.data.store = { ovo: 9 }; gal.data.manure = 7;
  const crops = Object.keys(D.crops).filter(c => c !== 'capim');
  for (let y = gy0 - 2; y <= gy1 + 3; y++) for (let x = gx0 - 3; x <= gx1 + 3; x++) {
    const inner = x >= gx0 - 1 && x <= gx1 + 1 && y >= gy0 - 1 && y <= gy1 + 1;   // corredor em volta da cerca
    if (inner || y >= s.y + s.h) continue;
    const ring = Math.max(gx0 - 1 - x, x - gx1 - 1, gy0 - 1 - y, y - gy1 - 1);
    plant(x, y, crops[(ring * 5 + x + y) % crops.length], (x + y) % 3 === 0 ? 99 : null);
  }
  for (const [x, y] of [[gx0 - 2, gy0 - 2], [gx1 + 2, gy0 - 2], [gx0 - 2, gy1 + 2], [gx1 + 2, gy1 + 2], [s.x + 8, gy1 + 2]]) {
    const t = G.tile(x, y); if (t) { t.c = null; t.g = 'grass'; } build('aspersor', x, y, 3);
  }
  // codornas: viveiro com cercadinho ao lado da loja
  const viv = build('viveiro', s.x + 17, s.y + 5, 3);
  fence(s.x + 16, s.y + 4, s.x + 19, s.y + 9, 'left');   // porteira virada para a horta, longe do lago
  { // porteira uma casa abaixo, de frente para a porta do viveiro
    const at = (x, y) => G.getBuilding(G.tile(x, y).o.id);
    G.removeBuilding(at(s.x + 16, s.y + 6)); G.addBuilding('cerca', s.x + 16, s.y + 6);
    G.removeBuilding(at(s.x + 16, s.y + 7)); G.addBuilding('porteira', s.x + 16, s.y + 7);
  }
  G.bridgeLine(s.x + 13, s.y + 11, s.x + 19, s.y + 11, true);   // ponte sobre a lagoinha da sede
  herd(viv, 'codorna', 24, 4); viv.data.store = { ovo_codorna: 20 }; viv.data.manure = 5;

  // ---------- Pasto Norte: gado de leite ----------
  const n = lot('norte');
  clear(n.x, n.y, n.w, n.h);
  const curral = build('curral', n.x + 8, n.y + 2, 3);
  build('cocho', n.x + 3, n.y + 3, 3); build('cocho', n.x + 14, n.y + 3, 3); build('silo', n.x + 3, n.y + 6, 3);
  fence(n.x, n.y, n.x + n.w - 1, n.y + n.h - 1);
  herd(curral, 'vaca', 7, 2);
  curral.data.store = { leite_balde: 6 }; curral.data.manure = 16;
  for (let i = 0; i < 6; i++) tree(n.x + 3 + i * 3, n.y + 11, ['manga', 'abacate', 'coco'][i % 3]);  // sombra no pasto (ILPF)

  // ---------- Campo Noroeste: ovelhas e cabras ----------
  const o = lot('no');
  clear(o.x, o.y, o.w, o.h);
  const galp = build('galpao', o.x + 9, o.y + 2, 3);
  build('cocho', o.x + 4, o.y + 3, 2); build('cocho', o.x + 15, o.y + 3, 2);
  fence(o.x, o.y, o.x + o.w - 1, o.y + o.h - 1);
  herd(galp, 'ovelha', 5, 1); herd(galp, 'cabra', 5, 1);
  galp.data.store = { la: 3, leite_cabra: 4 }; galp.data.manure = 12;
  for (let i = 0; i < 5; i++) tree(o.x + 3 + i * 4, o.y + 11, ['laranja', 'limao', 'acerola'][i % 3]);

  // ---------- Mata Leste: piquete dos porcos na borda da mata ----------
  const l = lot('leste');
  clear(l.x, l.y, 12, 10);
  const chiq = build('chiqueiro', l.x + 4, l.y + 2, 3);
  fence(l.x, l.y, l.x + 11, l.y + 9);
  herd(chiq, 'porco', 8, 3); chiq.data.manure = 22;
  clear(l.x, l.y + 10, l.w, 2); clear(l.x + 12, l.y, 2, 12);   // estradas pela mata
  build('composteira', l.x + 3, l.y + 11, 2).data.ready = 3;

  // ---------- Cerrado Oeste: pomar, trepadeiras e apiário ----------
  const w = lot('oeste');
  clear(w.x, w.y, w.w, w.h);
  const trees = ['laranja', 'manga', 'banana', 'abacate', 'limao', 'acerola', 'jabuticaba', 'coco'];
  for (let y = w.y + 2, row = 0; y < w.y + 10; y += 3, row++) for (let x = w.x + 2, col = 0; x < w.x + 21; x += 3, col++) tree(x, y, trees[(row * 3 + col) % trees.length]);
  for (let x = w.x + 2; x < w.x + 20; x++) { tree(x, w.y + 11, 'uva'); tree(x, w.y + 13, 'maracuja'); }
  for (const [dx, dy] of [[3, 0], [13, 0], [18, 0], [6, 15], [14, 15]]) { const h = build('colmeia', w.x + dx, w.y + dy, 3); h.data.mel = rnd(3, 6); }
  build('espaldeira', w.x + 20, w.y + 11, 1);

  // ---------- Capoeira NE: lavoura de grãos e forragem ----------
  const ne = lot('ne');
  clear(ne.x, ne.y, ne.w, ne.h);
  const fields = [['milho', 0], ['feijao', 4], ['trigo', 8], ['capim', 12], ['mandioca', 15], ['abacaxi', 18]];
  for (const [crop, x0] of fields) for (let y = ne.y + 2; y < ne.y + 13; y++) for (let x = ne.x + 1 + x0; x < ne.x + 1 + x0 + 3; x++) plant(x, y, crop);
  for (let y = ne.y + 3; y < ne.y + 13; y += 5) for (let x = ne.x + 3; x < ne.x + 21; x += 5) { const t = G.tile(x, y); t.c = null; t.g = 'grass'; build('aspersor', x, y, 3); }
  build('moinho', ne.x + 1, ne.y + 13, 3); build('silo', ne.x + 4, ne.y + 13, 3);

  // ---------- Várzea do Lago: piscicultura com aquaponia ----------
  const v = lot('sul');
  const t1 = build('tanque', v.x + 1, v.y + 1, 3); herd(t1, 'tilapia', 40, 12);
  const t2 = build('tanque', v.x + 1, v.y + 6, 1); herd(t2, 'tilapia', 12, 6);
  G.bridgeLine(v.x + 10, v.y + 1, v.x + 10, v.y + 15, true);   // ponte atravessando o lago
  G.bridgeLine(v.x + 5, v.y + 11, v.x + 19, v.y + 11, true);   // mais ao sul, longe do tanque de baixo
  clear(v.x + 4, v.y + 1, 4, 5);
  for (let y = v.y + 1; y < v.y + 6; y++) for (let x = v.x + 4; x < v.x + 8; x++) plant(x, y, ['alface', 'tomate', 'morango', 'pimenta'][x % 4]);

  // ---------- Solo vivo e controle de pragas (lavoura NE) ----------
  for (let y = ne.y + 2; y < ne.y + 13; y++) { plant(ne.x + 4, y, 'cravo'); plant(ne.x + 12, y, y % 2 ? 'crotalaria' : 'feijao_porco'); }
  [[ne.x + 1, ne.y + 4], [ne.x + 2, ne.y + 5], [ne.x + 9, ne.y + 9]].forEach(([x, y], i) => { const t = G.tile(x, y); if (t && t.c) t.c.pest = ['lagarta', 'lagarta', 'pulgao'][i]; });

  // ---------- Água e energia ----------
  build('cisterna', s.x, s.y, 3).data.water = 1800;
  S.buildings.find(b => b.type === 'casa').data.panels = 6;   // telhado solar
  for (let x = s.x + 3; x < s.x + 7; x++) build('painel_solar', x, s.y, 3);
  build('catavento', s.x + 19, s.y + 13, 1);   // bombeia da lagoinha
  build('fogao_biogas', s.x + 12, s.y + 3, 1);
  const bio = build('biodigestor', l.x + 8, l.y + 2, 3); bio.data.gas = 120; bio.data.load = 30; bio.data.bio = 2; bio.data.ready = 2;
  { // roda d'água na margem do lago da várzea
    let done = false;
    for (let y = v.y; y < v.y + v.h - 1 && !done; y++) for (let x = v.x + 12; x < v.x + v.w - 1 && !done; x++) {
      if (G.canPlace('roda_dagua', x, y) && G.nearWater({ type: 'roda_dagua', x, y }, 1)) { build('roda_dagua', x, y, 1); done = true; }
    }
  }
  build('cisterna', ne.x + 7, ne.y + 13, 2).data.water = 700;
  for (const t of S.tiles) if (t.g === 'tilled' && t.c && (t.c.id === 'milho' || t.c.id === 'feijao' || t.c.id === 'trigo')) t.drip = true;   // gotejamento na lavoura de grãos

  // ---------- Mochila cheia ----------
  for (const [id, it] of Object.entries(D.items)) S.inv[id] = it.place ? 5 : it.seed || it.sapling ? 20 : 25;
  S.inv.cerca = 200;
  S.held = 'racao'; S.tool = 0;
  S.stats = { weeds: 50, till: 200, plant: 200, water: 300, wood: 200, stone: 200, harvest: 150, cook: 40, feed: 500, eggs: 200, compost: 30, lots: 8, slaughter: 10, smoke: 10, trees: 30, racao: 60 };
  S.quest = D.quests.length;   // manual concluído
  // habilidades da demonstração
  S.skills = {};
  for (const k of Object.keys(D.skills)) S.skills[k] = 0;   // habilidades começam no nível 1, até na demonstração
  G.applyVigor();
  build('bancada', s.x + 14, s.y + 3, 1);
  Object.assign(S.eco, { foodOwn: 420, foodBought: 60, feedOwn: 300, feedBought: 40, seedCri: 60, seedShop: 25, kwhGen: 70, kwhUse: 62, waterSup: 520, waterDem: 480, history: [38, 44, 47, 52, 55, 61, 64, 70, 73, 78, 81, 84] });
  S.player.fome = 90; S.player.sede = 90;
  G.toHouse();
  G.save();
};
