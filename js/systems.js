// =============================================================
// EcoLand — sistemas de água, energia, pesca e o placar de
// autossuficiência. Estende o motor G (carregar depois de game.js).
// =============================================================
Object.assign(G, {
  // ---------------- Placar de autossuficiência ----------------
  ecoInit() {
    S.eco = Object.assign({
      foodOwn: 0, foodBought: 0,      // pontos de comida consumidos (da fazenda × comprados)
      feedOwn: 0, feedBought: 0,      // unidades de ração comidas pelos animais
      seedCri: 0, seedShop: 0,        // sementes plantadas (crioulas × da loja)
      rOwn: 0, rBought: 0,            // ração no inventário (feita × comprada)
      trOwn: 0, trBought: 0,          // alimento nos cochos/silos (da fazenda × comprado)
      kwhGen: 0, kwhUse: 0, kwhBought: 0, gasCook: 0,
      waterSup: 0, waterDem: 0, history: [],
    }, S.eco || {});
  },
  ecoAdd(k, v) { this.ecoInit(); S.eco[k] = (S.eco[k] || 0) + v; },
  pct(a, b) { return a + b > 0 ? Math.round(a / (a + b) * 100) : 0; },
  ecoScore() {
    this.ecoInit();
    const e = S.eco;
    const s = {
      food: this.pct(e.foodOwn, e.foodBought),
      water: e.waterDem ? Math.min(100, Math.round(e.waterSup / e.waterDem * 100)) : 0,
      energy: e.kwhUse ? Math.min(100, Math.round(e.kwhGen / e.kwhUse * 100)) : 0,
      feed: S.animals.length ? this.pct(e.feedOwn, e.feedBought) : 0,
      seeds: this.pct(e.seedCri, e.seedShop),
    };
    s.total = Math.round((s.food + s.water + s.energy + s.feed + s.seeds) / 5);
    return s;
  },
  // alimento depositado num cocho/silo/comedouro: de onde veio?
  feedProvenance(id, units) {
    this.ecoInit();
    const e = S.eco;
    if (id !== 'racao') { e.trOwn += units; return; }        // grãos, capim e restos são da fazenda
    const tot = e.rOwn + e.rBought, own = tot ? units * e.rOwn / tot : 0;
    e.trOwn += own; e.trBought += units - own;
    const used = units / 3;
    if (tot) { e.rOwn = Math.max(0, e.rOwn - used * e.rOwn / tot); e.rBought = Math.max(0, e.rBought - used * e.rBought / tot); }
  },
  troughOwnFrac() { const e = S.eco; return e.trOwn + e.trBought > 0 ? e.trOwn / (e.trOwn + e.trBought) : 0.5; },
  troughEaten(units) {
    const e = S.eco, f = this.troughOwnFrac();
    e.feedOwn += units * f; e.feedBought += units * (1 - f);
    const tot = e.trOwn + e.trBought;
    if (tot) { const k = Math.max(0, 1 - units / tot); e.trOwn *= k; e.trBought *= k; }
  },

  // ---------------- Água ----------------
  nearWater(b, r = 1) {
    const def = D.buildings[b.type] || b;
    for (let y = b.y - r; y < b.y + def.h + r; y++) for (let x = b.x - r; x < b.x + def.w + r; x++) {
      const t = this.tile(x, y); if (t && t.g === 'water') return true;
    }
    return false;
  },
  pumps() {
    return S.buildings.filter(b => {
      if (b.type === 'roda_dagua') return this.nearWater(b, 1);
      if (b.type === 'catavento') return this.nearWater(b, 5) || S.buildings.some(p => p.type === 'poco' && Math.abs(p.x - b.x) <= 5 && Math.abs(p.y - b.y) <= 5);
      return false;
    });
  },
  cisternas() { return S.buildings.filter(b => b.type === 'cisterna'); },
  waterStock() { return this.cisternas().reduce((s, b) => s + (b.data.water || 0), 0); },
  takeWater(n) {
    for (const b of this.cisternas()) { const k = Math.min(n, b.data.water || 0); b.data.water -= k; n -= k; if (!n) break; }
    return n === 0;
  },
  dripRect(x0, y0, x1, y1) {
    let placed = 0, missing = 0;
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      const t = this.tile(x, y);
      if (!t || t.g !== 'tilled' || t.drip || !this.owned(x, y)) continue;
      if (!S.creative && !this.take('gotejamento')) { missing++; continue; }
      t.drip = true; placed++;
    }
    if (placed) { sfx('place'); toast(`〰️ Gotejamento instalado em ${placed} canteiro(s).${missing ? ` Faltaram ${missing} mangueiras.` : ''} Precisa de cisterna ou bomba (roda d'água / cata-vento).`); }
    else toast(missing ? 'Sem mangueiras de gotejamento. Compre na loja (Insumos).' : 'Arraste sobre canteiros arados.');
    return placed;
  },

  // ---------------- Noite: água, gás, energia e placar ----------------
  nightSystems(R) {
    this.ecoInit();
    const e = S.eco, rain = S.weather === 'chuva';
    // chuva enche as cisternas
    let caught = 0;
    for (const b of this.cisternas()) {
      const cap = this.lvl(b).store;
      b.data.water = b.data.water || 0;
      if (rain) { const add = Math.min(cap - b.data.water, Math.round(cap * 0.45)); b.data.water += add; caught += add; }
    }
    // bombas: alimentam o gotejamento e completam as cisternas
    const pumps = this.pumps();
    let pumpCap = pumps.reduce((s, b) => s + D.buildings[b.type].pump, 0);
    let fill = pumps.reduce((s, b) => s + D.buildings[b.type].fill, 0);
    for (const b of this.cisternas()) { const cap = this.lvl(b).store, add = Math.min(cap - b.data.water, fill); b.data.water += add; fill -= add; }
    // gotejamento
    let dripped = 0, dry = 0;
    for (const t of S.tiles) {
      if (!t.drip || t.g !== 'tilled') continue;
      if (t.wet) continue;
      if (pumpCap > 0) { pumpCap--; t.wet = true; dripped++; }
      else if (this.takeWater(1)) { t.wet = true; dripped++; }
      else dry++;
    }
    if (caught) R.push(`🛢️ A chuva encheu as cisternas com ${caught} L.`);
    if (dripped) R.push(`〰️ O gotejamento regou ${dripped} canteiro(s).${dry ? ` ${dry} ficaram sem água — falta cisterna cheia ou bomba.` : ''}`);
    // biodigestor: esterco vira gás e biofertilizante
    let gasMade = 0;
    for (const b of S.buildings.filter(x => x.type === 'biodigestor')) {
      const L = this.lvl(b), k = Math.min(b.data.load || 0, L.rate);
      b.data.load = (b.data.load || 0) - k;
      const before = b.data.gas || 0;
      b.data.gas = Math.min(L.gasCap, before + k);
      gasMade += b.data.gas - before;
      b.data.bio = (b.data.bio || 0) + k / 5;
      b.data.ready = Math.floor(b.data.bio);
    }
    if (gasMade) R.push(`🫧 O biodigestor produziu ${Math.round(gasMade)} m³ de biogás.`);
    // energia elétrica
    let gen = 0;
    for (const b of S.buildings) {
      if (b.type === 'painel_solar') gen += this.lvl(b).kwh * (rain ? 0.25 : 1);
      if (b.type === 'roda_dagua' && this.nearWater(b, 1)) gen += D.buildings.roda_dagua.kwh;
      if (b.type === 'biodigestor') { const k = this.lvl(b).kwh || 0; if (k && (b.data.gas || 0) >= k / 2) { b.data.gas -= k / 2; gen += k; } }
    }
    const use = this.energyUse();
    const deficit = Math.max(0, use - gen);
    const bill = Math.round(deficit * 2);
    if (bill && !S.creative) { S.money = Math.max(0, S.money - bill); R.push(`⚡ Conta de luz: ${deficit.toFixed(0)} kWh da rede = 💰 ${bill}. Painéis solares e biogás reduzem a conta.`); }
    else if (gen > 0) R.push(`⚡ A fazenda gerou ${gen.toFixed(0)} kWh e usou ${use.toFixed(0)} kWh.`);
    e.kwhGen = gen; e.kwhUse = use; e.kwhBought = deficit;
    // água: oferta própria × demanda
    const tilled = S.tiles.filter(t => t.g === 'tilled').length;
    const animals = S.animals.filter(a => !D.animals[a.type].aquatic).length;
    e.waterDem = 20 + tilled + animals * 2;
    e.waterSup = this.countBuildings('poco') * 40 + this.waterStock() / 4 + pumps.reduce((s, b) => s + D.buildings[b.type].pump * 2, 0) + this.countBuildings('aspersor') * 4;
    // fluxos recentes pesam mais
    for (const k of ['foodOwn', 'foodBought', 'feedOwn', 'feedBought', 'seedCri', 'seedShop']) e[k] *= 0.9;
    const sc = this.ecoScore();
    e.history.push(sc.total); if (e.history.length > 28) e.history.shift();
    R.push(`📊 Autossuficiência: <b>${sc.total}%</b> (🍲 ${sc.food} · 💧 ${sc.water} · ⚡ ${sc.energy} · 🌾 ${sc.feed} · 🌱 ${sc.seeds}) — tecla P`);
  },
  energyUse() {
    let use = 3;   // casa
    for (const b of S.buildings) {
      const L = this.lvl(b);
      if (b.type === 'aspersor') use += 0.5 * (b.level || 1);
      if ((L.perks || []).includes('auto')) use += 3;
      if ((L.perks || []).includes('comfort')) use += 2;
      if ((L.perks || []).includes('aquaponia')) use += 3;
      if (b.type === 'banco_sementes' && b.level >= 3) use += 3;
      if (b.type === 'silo' && b.level >= 3) use += 2;
    }
    return use;
  },
  gasAvailable() { return S.buildings.some(b => b.type === 'biodigestor' && (b.data.gas || 0) >= 1); },
  useGas() { const b = S.buildings.find(x => x.type === 'biodigestor' && (x.data.gas || 0) >= 1); if (b) { b.data.gas -= 1; this.ecoAdd('gasCook', 1); } return !!b; },

  // ---------------- Pesca ----------------
  fish: null,
  cast(tx, ty) {
    const t = this.tile(tx, ty);
    if (!t || t.g !== 'water' || (t.o && t.o.t === 'b')) { toast('Lance a vara na água (lago ou lagoa).'); return; }
    if (this.fish) return this.reel();
    if (!this.useEnergy(2)) return;
    const info = this.toolInfo('vara');
    const bait = this.take('minhoca');
    this.fish = { phase: 'wait', tx, ty, t: 0, bait, wait: (2 + Math.random() * 5) * info.wait * (bait ? 0.5 : 1), window: info.window };
    S.player.dir = Math.abs(tx + 0.5 - S.player.x) > Math.abs(ty + 0.5 - S.player.y) ? (tx + 0.5 < S.player.x ? 'left' : 'right') : (ty + 0.5 < S.player.y ? 'up' : 'down');
    sfx('water');
    toast(bait ? '🎣 Lançou com isca de minhoca... espere o ❗' : '🎣 Lançou... espere o ❗ e clique para fisgar.');
  },
  updateFish(dt) {
    const f = this.fish;
    if (!f) return;
    f.t += dt;
    if (f.phase === 'wait' && f.t >= f.wait) { f.phase = 'bite'; f.t = 0; sfx('pick'); }
    else if (f.phase === 'bite' && f.t > f.window) { this.fish = null; toast('💨 O peixe escapou! Clique mais rápido quando aparecer o ❗'); sfx('error'); }
    else if (f.phase === 'catch' && f.t > 0.9) this.fish = null;
  },
  cancelFish() { if (this.fish && this.fish.phase !== 'catch') this.fish = null; },
  pickFish(tx, ty) {
    const lot = this.lotAt(tx, ty), big = lot && lot.biome === 'lago';
    const info = this.toolInfo('vara'), night = this.isNight();
    const pool = Object.entries(D.fish).filter(([, f]) => (!f.big || big) && (!f.seasons || f.seasons.includes(S.season)));
    const weight = ([, f]) => f.w * (f.night && night ? 2 : 1) * (f.big || f.rare ? 1 + info.rare * 20 : 1);
    let r = Math.random() * pool.reduce((s, p) => s + weight(p), 0);
    for (const p of pool) { r -= weight(p); if (r <= 0) return p[0]; }
    return pool[0][0];
  },
  reel() {
    const f = this.fish;
    if (!f) return;
    if (f.phase === 'wait') { this.fish = null; toast('Puxou cedo demais! Espere o ❗ aparecer.'); return; }
    if (f.phase !== 'bite') return;
    const id = this.pickFish(f.tx, f.ty), fd = D.fish[id];
    f.phase = 'catch'; f.t = 0; f.fish = id;
    this.add('peixe_' + id, 1);
    this.stat('fish');
    sfx(fd.rare || fd.big ? 'quest' : 'harvest');
    toast(`🐟 Você pescou: <b>${fd.n}</b>!${fd.rare ? ' Um peixe raríssimo!' : ''}`, fd.rare || fd.big ? 'good' : '');
  },
});
