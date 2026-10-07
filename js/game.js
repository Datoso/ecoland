// =============================================================
// EcoLand — lógica do jogo: mundo, tempo, sobrevivência, ações,
// lavoura, animais, economia, manual e salvamento.
// Estado salvável fica em S; G contém as funções do motor.
// =============================================================
window.S = null;

const MIN_PER_SEC = 1.6;      // minutos de jogo por segundo real
const DAY_START = 360;        // 06:00
const NIGHT_HOME = 1170;      // 19:30 animais voltam pra casa
const ANIMALS_IN = 1200;      // 20:00 animais recolhidos
const PASS_OUT = 1560;        // 02:00 desmaio
const SAVE_KEY = 'ecoland_save_v1';        // save antigo (um mundo só)
const WORLDS_KEY = 'ecoland_worlds_v1';
const WORLD_PREFIX = 'ecoland_world_';

function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function chance(p) { return Math.random() < p; }
function sfx(n, o) { try { window.SFX && SFX.play(n, o); } catch (e) { /* sem som */ } }
function toast(m, type) { if (window.UI) UI.toast(m, type); }

const G = window.G = {
  W: D.MAP_W, H: D.MAP_H,
  lotGrid: null,       // índice do lote por tile
  paused: false,
  popups: [],          // textos flutuantes
  particles: [],
  report: [],          // relatório da noite

  get animals() { return S.animals; },

  // ---------------- Mundo ----------------
  idx(x, y) { return y * this.W + x; },
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; },
  tile(x, y) { return this.inBounds(x, y) ? S.tiles[this.idx(x, y)] : null; },
  lotAt(x, y) { return this.inBounds(x, y) ? D.lots[this.lotGrid[this.idx(x, y)]] : null; },
  owned(x, y) { const l = this.lotAt(x, y); return !!(l && S.lots[l.id]); },

  buildLotGrid() {
    this.lotGrid = new Int8Array(this.W * this.H).fill(-1);
    D.lots.forEach((l, i) => {
      for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) this.lotGrid[this.idx(x, y)] = i;
    });
  },

  solid(x, y, animal) {
    if (!this.inBounds(x, y) || !this.owned(x, y)) return true;
    const t = S.tiles[this.idx(x, y)];
    if (t.o && t.o.gate) return !!animal;   // porteira e ponte: você passa, os animais não
    if (t.g === 'water') return true;
    if (t.o && (t.o.t === 'tree' || t.o.t === 'rock' || t.o.t === 'b' || t.o.t === 'fruit')) return true;
    return false;
  },

  genWorld() {
    const W = this.W, H = this.H;
    S.tiles = [];
    for (let i = 0; i < W * H; i++) S.tiles.push({ g: 'grass', o: null, c: null, wet: false });
    for (const lot of D.lots) {
      const cx = lot.x + lot.w / 2, cy = lot.y + lot.h / 2;
      for (let y = lot.y; y < lot.y + lot.h; y++) for (let x = lot.x; x < lot.x + lot.w; x++) {
        const t = S.tiles[this.idx(x, y)];
        const r = Math.random();
        const v = rnd(0, 3);
        switch (lot.biome) {
          case 'sede':
            if (r < 0.11) t.o = { t: 'weed', v }; else if (r < 0.21) t.o = { t: 'tree', hp: 3, v }; else if (r < 0.26) t.o = { t: 'rock', hp: 2, v };
            break;
          case 'pasto':
            if (r < 0.06) t.o = { t: 'weed', v }; else if (r < 0.075) t.o = { t: 'tree', hp: 3, v }; else if (r < 0.085) t.o = { t: 'rock', hp: 2, v };
            break;
          case 'mata':
            if (r < 0.40) t.o = { t: 'tree', hp: 3, v }; else if (r < 0.50) t.o = { t: 'weed', v }; else if (r < 0.53) t.o = { t: 'rock', hp: 2, v };
            break;
          case 'cerrado':
            if (r < 0.11) t.o = { t: 'rock', hp: 2, v }; else if (r < 0.17) t.o = { t: 'tree', hp: 3, v }; else if (r < 0.28) t.o = { t: 'weed', v };
            break;
          case 'lago': {
            const d = ((x + 0.5 - cx) / (lot.w * 0.33)) ** 2 + ((y + 0.5 - cy) / (lot.h * 0.32)) ** 2 + (Math.random() - 0.5) * 0.15;
            if (d < 1) t.g = 'water';
            else if (d < 1.4) t.g = 'sand';
            else if (r < 0.08) t.o = { t: 'weed', v }; else if (r < 0.13) t.o = { t: 'tree', hp: 3, v };
            break;
          }
        }
      }
    }
    // sede: casa, loja e lagoinha
    const s = D.lots[0];
    const clear = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const t = this.tile(x, y); if (t) { t.o = null; t.g = 'grass'; } } };
    clear(s.x + 2, s.y + 1, 7, 6);    // em volta da casa
    clear(s.x + 12, s.y + 1, 5, 5);   // em volta da loja
    clear(s.x + 3, s.y + 6, 9, 4);    // área inicial de plantio
    // bosque no canto sudoeste da sede: lenha garantida para as primeiras missões
    for (let y = s.y + 10; y < s.y + 15; y++) for (let x = s.x + 1; x < s.x + 8; x++) {
      const t = this.tile(x, y);
      if (Math.random() < 0.55) t.o = { t: 'tree', hp: 3, v: rnd(0, 3) };
    }
    this.addBuilding('casa', s.x + 3, s.y + 2, true);
    this.addBuilding('loja', s.x + 13, s.y + 2, true);
    clear(s.x, s.y + 3, 3, 3);
    this.addBuilding('cozinha_externa', s.x, s.y + 3);   // dois tijolinhos e uma grelha de ferro
    for (let y = s.y + 10; y < s.y + 14; y++) for (let x = s.x + 14; x < s.x + 19; x++) {
      const d = ((x + 0.5 - (s.x + 16.5)) / 2.6) ** 2 + ((y + 0.5 - (s.y + 12)) / 1.9) ** 2;
      const t = this.tile(x, y);
      if (d < 1) { t.g = 'water'; t.o = null; } else if (d < 1.6) { t.g = 'sand'; t.o = null; }
    }
  },

  // ---------------- Construções ----------------
  getBuilding(id) { return S.buildings.find(b => b.id === id); },
  lvl(b) { const L = D.buildings[b.type].levels; return L ? L[Math.min(b.level || 1, L.length) - 1] : {}; },
  bname(b) { return this.lvl(b).n || D.buildings[b.type].n; },
  cap(b) { return this.lvl(b).cap || 0; },
  perk(b, p) { return (this.lvl(b).perks || []).includes(p); },
  feedCap(b) { return this.lvl(b).feedCap || (this.perk(b, 'feeder') ? 200 : 0); },
  nextLevel(b) { const L = D.buildings[b.type].levels; return L && (b.level || 1) < L.length ? L[b.level || 1] : null; },
  upgrade(b) {
    const nx = this.nextLevel(b);
    if (!nx) return false;
    if (!S.creative && S.money < nx.cost) { toast('Dinheiro insuficiente para evoluir.', 'bad'); sfx('error'); return false; }
    this.spend(nx.cost); b.level = (b.level || 1) + 1;
    if (this.feedCap(b) && b.data.feed == null) b.data.feed = 0;
    sfx('unlock'); toast(`🏗️ Evoluído para ${nx.n}!`, 'good');
    const def = D.buildings[b.type];
    this.burst(b.x + def.w / 2, b.y + def.h / 2, '#ffe066', 20);
    return true;
  },
  countBuildings(type) { return S.buildings.filter(b => b.type === type).length; },
  countAnimals(type) { return S.animals.filter(a => a.type === type).length; },
  countCrops() { let n = 0; for (const t of S.tiles) if (t.c && !t.c.dead) n++; return n; },
  countFruitTrees() { let n = 0; for (const t of S.tiles) if (t.o && t.o.t === 'fruit') n++; return n; },

  canPlace(type, x0, y0) {
    const def = D.buildings[type];
    for (let y = y0; y < y0 + def.h; y++) for (let x = x0; x < x0 + def.w; x++) {
      if (!this.owned(x, y)) return false;
      const t = this.tile(x, y);
      if (!t || t.o || t.c) return false;
      if ((t.g === 'water') !== (type === 'ponte')) return false;   // ponte só na água; o resto só em terra
      if (Math.floor(S.player.x) === x && Math.floor(S.player.y) === y) return false;
    }
    return true;
  },

  addBuilding(type, x0, y0, fixed) {
    const def = D.buildings[type];
    const b = { id: S.nextId++, type, x: x0, y: y0, level: 1, data: {} };
    if (this.feedCap(b)) b.data.feed = 0;
    if (def.houses) { b.data.manure = 0; b.data.store = {}; }
    if (type === 'composteira') { b.data.load = 0; b.data.batches = []; b.data.ready = 0; }
    if (type === 'colmeia') { b.data.t = 0; b.data.mel = 0; }
    for (let y = y0; y < y0 + def.h; y++) for (let x = x0; x < x0 + def.w; x++) {
      const t = this.tile(x, y); t.o = { t: 'b', id: b.id }; if (type === 'porteira' || type === 'ponte') t.o.gate = true; t.g = t.g === 'tilled' ? 'grass' : t.g; t.c = null;
    }
    S.buildings.push(b);
    return b;
  },

  removeBuilding(b) {
    const def = D.buildings[b.type];
    for (let y = b.y; y < b.y + def.h; y++) for (let x = b.x; x < b.x + def.w; x++) this.tile(x, y).o = null;
    S.buildings = S.buildings.filter(o => o !== b);
  },

  buildingDoor(b) {
    const def = D.buildings[b.type];
    return { x: b.x + Math.floor(def.w / 2) + 0.5, y: b.y + def.h + 0.5 };
  },

  nearStation(type, range = 3) {
    if (!type) return true;
    if (type === 'fogueira' && (this.nearStation('fogao_biogas', range) || this.nearStation('cozinha_externa', range))) return true;
    if (type === 'forno') return S.buildings.some(b => b.type === 'cozinha_externa' && (b.level || 1) >= 3) && this.nearStation('cozinha_externa', range);
    const px = S.player.x, py = S.player.y;
    return S.buildings.some(b => {
      if (b.type !== type) return false;
      const def = D.buildings[b.type];
      const dx = Math.max(b.x - px, 0, px - (b.x + def.w));
      const dy = Math.max(b.y - py, 0, py - (b.y + def.h));
      return Math.hypot(dx, dy) <= range;
    });
  },

  homeWithSpace(animalType) {
    const def = D.animals[animalType];
    return S.buildings.find(b => def.homes.includes(b.type) &&
      S.animals.filter(a => a.home === b.id).length < this.cap(b));
  },
  homeNames(animalType) { return D.animals[animalType].homes.map(h => D.buildings[h].n).join(' ou '); },

  nearBee(x, y, r = 6) {
    return S.buildings.some(b => b.type === 'colmeia' && Math.abs(b.x - x) <= r && Math.abs(b.y - y) <= r);
  },

  // ---------------- Inventário ----------------
  has(id, n = 1) { return (S.inv[id] || 0) >= n; },
  add(id, n = 1, silent) {
    S.inv[id] = (S.inv[id] || 0) + n;
    if (!silent) this.popup(S.player.x, S.player.y - 0.8, `+${n} ${D.items[id].i}`);
    if (id === 'madeira') this.stat('wood', n);
    if (id === 'pedra') this.stat('stone', n);
  },
  take(id, n = 1) {
    if (!this.has(id, n)) return false;
    S.inv[id] -= n;
    if (S.inv[id] <= 0) { delete S.inv[id]; if (S.held === id) S.held = null; }
    return true;
  },

  popup(x, y, text, color) {
    const near = this.popups.filter(f => Math.abs(f.x - x) < 1.5 && f.life > 1).length;
    this.popups.push({ x, y: y - near * 0.45, text, color: color || '#fff', life: 1.4 });
  },
  burst(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 0.6 + Math.random() * 0.4, color });
  },

  stat(k, n = 1) { S.stats[k] = (S.stats[k] || 0) + n; this.checkQuests(); },

  setCreative(on) {
    S.creative = !!on;
    if (on) S.money = Math.max(S.money, 999999);
    toast(on ? '🧪 Modo teste ligado: dinheiro infinito!' : 'Modo teste desligado.', 'good');
  },
  spend(n) { if (!S.creative) S.money -= n; else S.money = Math.max(S.money, 999999); },

  energyCost(base) { return S.upgrades.ferramentas ? base * 0.6 : base; },
  useEnergy(base) {
    const p = S.player;
    if (p.energy <= 0) { toast('Você está exausto! Coma algo ou vá dormir.', 'bad'); sfx('error'); return false; }
    p.energy = Math.max(0, p.energy - this.energyCost(base));
    return true;
  },

  // ---------------- Novo jogo / mundos salvos ----------------
  newGame(farmName) {
    S = {
      version: 1, worldId: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      farmName: farmName || 'Sítio Esperança',
      day: 1, season: 0, year: 1, time: DAY_START, money: 300, weather: 'sol', tomorrow: 'sol',
      player: { x: 0, y: 0, dir: 'down', hp: 100, energy: 100, maxEnergy: 100, fome: 85, sede: 85, water: 15, waterMax: 15, sick: 0 },
      inv: { sem_alface: 10, sem_cenoura: 6, marmita: 3, agua: 3 },
      held: 'sem_alface', tool: 0, lots: { sede: true }, tiles: [], buildings: [], animals: [], nextId: 1,
      stats: {}, quest: 0, upgrades: {}, tools: {}, seedBank: {}, ended: false,
    };
    this.buildLotGrid();
    this.genWorld();
    this.toHouse();
    this.ecoInit();
    S.inv.minhoca = 3;
  },

  toHouse() {
    const casa = S.buildings.find(b => b.type === 'casa');
    const d = this.buildingDoor(casa);
    S.player.x = d.x; S.player.y = d.y + 0.2; S.player.dir = 'down';
  },

  // índice dos mundos: [{ id, name, day, season, year, creative, updated }]
  listWorlds() {
    try {
      let list = JSON.parse(localStorage.getItem(WORLDS_KEY) || '[]');
      // migra o save antigo (um único mundo) para a lista
      const old = localStorage.getItem(SAVE_KEY);
      if (old) {
        const o = JSON.parse(old);
        o.worldId = o.worldId || 'antigo';
        localStorage.setItem(WORLD_PREFIX + o.worldId, old);
        list = list.filter(w => w.id !== o.worldId);
        list.push({ id: o.worldId, name: o.farmName, day: o.day, season: o.season, year: o.year, creative: !!o.creative, updated: Date.now() });
        localStorage.setItem(WORLDS_KEY, JSON.stringify(list));
        localStorage.removeItem(SAVE_KEY);
      }
      return list.sort((a, b) => b.updated - a.updated);
    } catch (e) { return []; }
  },
  save() {
    try {
      localStorage.setItem(WORLD_PREFIX + S.worldId, JSON.stringify(S));
      const list = this.listWorlds().filter(w => w.id !== S.worldId);
      list.push({ id: S.worldId, name: S.farmName, day: S.day, season: S.season, year: S.year, creative: !!S.creative, updated: Date.now() });
      localStorage.setItem(WORLDS_KEY, JSON.stringify(list));
      return true;
    } catch (e) { toast('Não foi possível salvar.', 'bad'); return false; }
  },
  hasSave() { return this.listWorlds().length > 0; },
  deleteWorld(id) {
    try {
      localStorage.removeItem(WORLD_PREFIX + id);
      localStorage.setItem(WORLDS_KEY, JSON.stringify(this.listWorlds().filter(w => w.id !== id)));
    } catch (e) { /* sem armazenamento */ }
  },
  load(id) {
    try {
      const raw = localStorage.getItem(WORLD_PREFIX + id);
      if (!raw) return false;
      S = JSON.parse(raw);
      S.worldId = S.worldId || id;
      S.tools = S.tools || {};
      S.seedBank = S.seedBank || {};
      this.ecoInit();
      if (S.upgrades.regador && !S.tools.regador) { S.tools.regador = 2; delete S.upgrades.regador; }
      this.buildLotGrid();
      S.animals.forEach(a => { a.tx = null; });
      for (const b of S.buildings) {
        b.level = b.level || 1;
        if (b.type === 'casa') {   // casa ficou maior (5×4): ocupa o novo espaço
          const d = D.buildings.casa;
          for (let y = b.y; y < b.y + d.h; y++) for (let x = b.x; x < b.x + d.w; x++) {
            const t = this.tile(x, y); if (t && !(t.o && t.o.t === 'b' && t.o.id !== b.id)) { t.o = { t: 'b', id: b.id }; t.c = null; if (t.g === 'tilled') t.g = 'grass'; }
          }
        }
        if (D.buildings[b.type].houses && !b.data.store) b.data.store = {};
        if (b.data.eggs) { b.data.store.ovo = (b.data.store.ovo || 0) + b.data.eggs; b.data.eggs = 0; }
        if (this.feedCap(b) && b.data.feed == null) b.data.feed = 0;
      }
      return true;
    } catch (e) { return false; }
  },

  // ---------------- Tempo ----------------
  clock() {
    const m = Math.floor(S.time) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m / 10) * 10 % 60).padStart(2, '0');
  },
  isNight() { return S.time >= 1140 || S.time < 330; },

  update(dt) {
    if (this.paused) return;
    const mins = dt * MIN_PER_SEC;
    S.time += mins;
    const p = S.player;
    const sedeRate = 0.085 * (S.upgrades.mochila ? 0.7 : 1) * (S.season === 1 ? 1.2 : 1);
    p.fome = Math.max(0, p.fome - 0.06 * mins);
    p.sede = Math.max(0, p.sede - sedeRate * mins);
    if (p.sick > 0) { p.sick -= mins; p.energy = Math.max(0, p.energy - 0.02 * mins); }
    if (p.fome <= 0 || p.sede <= 0) {
      p.hp -= 0.07 * mins;
      if (!this._warned) { this._warned = true; toast(p.fome <= 0 ? 'Você está faminto! Coma algo.' : 'Você está desidratado! Beba água.', 'bad'); sfx('hurt'); }
    } else {
      this._warned = false;
      if (p.fome > 30 && p.sede > 30) p.hp = Math.min(100, p.hp + 0.02 * mins);
    }
    if (p.hp <= 0) { this.faint('Você desmaiou de fraqueza...'); return; }
    if (S.time >= PASS_OUT) { this.faint('Você desmaiou de cansaço às 2h da manhã...'); return; }

    this.updateAnimals(dt);
    this.updateFish(dt);
    for (const f of this.popups) { f.life -= dt; f.y -= dt * 0.8; }
    this.popups = this.popups.filter(f => f.life > 0);
    for (const q of this.particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 8 * dt; }
    this.particles = this.particles.filter(q => q.life > 0);
    this._qTimer = (this._qTimer || 0) + dt;
    if (this._qTimer > 1) { this._qTimer = 0; this.checkQuests(); }
  },

  // ---------------- Animais (movimento) ----------------
  updateAnimals(dt) {
    for (const a of S.animals) {
      const def = D.animals[a.type];
      const home = this.getBuilding(a.home);
      if (!home) continue;
      if (def.aquatic) { a.inside = true; continue; }
      if (S.time >= ANIMALS_IN) { a.inside = true; continue; }
      if (a.inside) { const d0 = this.buildingDoor(home); a.inside = false; a.x = d0.x; a.y = d0.y; a.tx = null; }
      const door = this.buildingDoor(home);
      if (S.time >= NIGHT_HOME) { a.tx = door.x; a.ty = door.y; a.wait = 0; }
      a.wait = (a.wait || 0) - dt;
      if (a.tx == null || (a.wait <= 0 && Math.hypot(a.tx - a.x, a.ty - a.y) < 0.2)) {
        if (a.wait <= 0 && S.time < NIGHT_HOME) {
          for (let k = 0; k < 8; k++) {
            const r = def.roam || 6, tx = Math.floor(door.x) + rnd(-r, r), ty = Math.floor(door.y) + rnd(-r, r);
            if (!this.solid(tx, ty, true)) { a.tx = tx + 0.5; a.ty = ty + 0.5; break; }
          }
          a.wait = 2 + Math.random() * 5;
        }
      }
      if (a.tx == null) continue;
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > 0.1) {
        const sp = def.speed * dt * (a.age < def.adult ? 1.2 : 1);
        const nx = a.x + dx / d * Math.min(sp, d), ny = a.y + dy / d * Math.min(sp, d);
        if (!this.solid(Math.floor(nx), Math.floor(ny), true)) { a.x = nx; a.y = ny; a.moving = true; }
        else { a.tx = null; a.wait = 0.5; }
        a.face = dx < 0 ? -1 : 1;
      } else a.moving = false;
      if (chance(0.0015) && Math.hypot(a.x - S.player.x, a.y - S.player.y) < 7) sfx(def.sfx, { volume: 0.4 });
    }
  },

  spawnAnimal(type, home, age = 0) {
    const d = this.buildingDoor(home);
    const def = D.animals[type];
    const names = ['Mimosa', 'Pintada', 'Estrela', 'Malhada', 'Bolota', 'Florzinha', 'Tico', 'Pipoca', 'Fubá', 'Canjica', 'Paçoca', 'Jabuticaba', 'Cocada', 'Pitanga', 'Marrom', 'Nevada'];
    const a = {
      id: S.nextId++, type, name: names[rnd(0, names.length - 1)], age, home: home.id,
      x: d.x, y: d.y, hungry: 0, happy: 60, ready: false, prodDays: 0, petted: false, inside: !!def.aquatic || S.time >= ANIMALS_IN,
    };
    S.animals.push(a);
    return a;
  },

  animalAt(wx, wy) {
    let best = null, bd = 0.75;
    for (const a of S.animals) {
      if (a.inside) continue;
      const d = Math.hypot(a.x - wx, a.y - 0.2 - wy);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  },

  // ---------------- Ações ----------------
  // ---------------- Ferramentas (níveis e área de efeito) ----------------
  toolLvl(id) { return (S.tools && S.tools[id]) || 1; },
  toolInfo(id) { const L = D.toolLevels[id]; return L ? L[Math.min(this.toolLvl(id), L.length) - 1] : null; },
  toolName(id) { const i = this.toolInfo(id); return i ? i.n : D.tools.find(t => t.id === id).n; },
  areaTiles(tx, ty, area) {
    if (area === 'line3') {
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[S.player.dir];
      return [0, 1, 2].map(i => [tx + dx * i, ty + dy * i]);
    }
    const r = ((area || 1) - 1) / 2, out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.push([tx + dx, ty + dy]);
    return out;
  },
  // aplica fn em cada tile da área que passar no filtro; cobra energia proporcional
  areaAction(tx, ty, area, base, filter, fn) {
    const list = this.areaTiles(tx, ty, area).filter(([x, y]) => this.owned(x, y) && this.tile(x, y) && filter(this.tile(x, y), x, y));
    if (!list.length) return 0;
    if (!this.useEnergy(base * (1 + 0.4 * (list.length - 1)))) return -1;
    for (const [x, y] of list) fn(this.tile(x, y), x, y);
    return list.length;
  },

  useTool(tx, ty, wx, wy) {
    const tool = D.tools[S.tool].id;
    const t = this.tile(tx, ty);
    if (!t) return;
    if (!this.owned(tx, ty)) { toast('Essa terra ainda não é sua. Compre o lote (tecla T).'); sfx('error'); return; }
    const cx = tx + 0.5, cy = ty + 0.5;
    const info = this.toolInfo(tool) || {};
    switch (tool) {
      case 'mao': return this.interact(tx, ty, wx, wy);
      case 'item': return this.useItem(tx, ty, wx, wy);
      case 'vara': return this.cast(tx, ty);
      case 'enxada': {
        const n = this.areaAction(tx, ty, info.area, 2,
          tt => (tt.c && tt.c.dead) || (tt.c && D.crops[tt.c.id].greenManure && this.cropReady(tt)) || (tt.g === 'grass' && !tt.o),
          (tt, x, y) => {
            if (tt.c && tt.c.dead) tt.c = null;
            else if (tt.c) this.greenManure(x, y);
            else { tt.g = 'tilled'; this.stat('till'); if (chance(0.12)) { this.add('minhoca', 1); this.popup(x + 0.5, y, '🪱'); } }
            this.burst(x + 0.5, y + 0.5, '#7a5230', 5);
          });
        if (n > 0) sfx('hoe');
        else if (!n && t.o && t.o.t === 'weed') toast('Roce o mato com a foice primeiro.');
        return;
      }
      case 'regador': {
        const b = t.o && t.o.t === 'b' ? this.getBuilding(t.o.id) : null;
        const p = S.player;
        if (t.g === 'water' || (b && (b.type === 'poco' || b.type === 'tanque'))) {
          if (p.water >= p.waterMax) { toast('🚿 O regador já está cheio.'); return; }
          p.water = p.waterMax;
          p.nutri = !!(b && b.type === 'tanque' && S.animals.some(a => a.home === b.id));
          sfx('refill'); this.popup(cx, cy, p.nutri ? '💧 água nutritiva do tanque!' : '💧 cheio!', p.nutri ? '#b6f5a0' : '#9fd8ff'); return;
        }
        if (t.g !== 'tilled') return;
        if (p.water <= 0) { toast('Regador vazio! Encha no lago, poço ou tanque.'); sfx('error'); return; }
        const n = this.areaAction(tx, ty, info.area, 1,
          tt => tt.g === 'tilled' && !tt.wet,
          (tt, x, y) => {
            if (p.water <= 0) return;
            tt.wet = true; p.water--;
            if (p.nutri && chance(0.25)) { if (tt.c) tt.c.fert = true; else tt.fert = true; }
            this.burst(x + 0.5, y + 0.5, '#6cc4ff', 4); this.stat('water');
          });
        if (n > 0) sfx('water'); else if (!n) toast('Já está regado.');
        return;
      }
      case 'foice': {
        let harvested = 0;
        const n = this.areaAction(tx, ty, info.area, 1,
          tt => (tt.c && (tt.c.dead || this.cropReady(tt))) || (tt.o && tt.o.t === 'weed'),
          (tt, x, y) => {
            if (tt.c && tt.c.dead) tt.c = null;
            else if (tt.c) { this.harvest(x, y, true); harvested++; }
            else { tt.o = null; this.add('capim', chance(0.4) ? 2 : 1, true); this.stat('weeds'); this.burst(x + 0.5, y + 0.5, '#5fae3a', 5); }
          });
        if (n > 0) { sfx(harvested ? 'harvest' : 'scythe'); this.popup(S.player.x, S.player.y - 0.8, harvested ? `🌾 colheu ${harvested}` : `+🌿`); }
        else if (!n && t.c) toast('Ainda não está pronto para colher.');
        return;
      }
      case 'machado':
        if (t.o && t.o.t === 'tree') {
          if (!this.useEnergy(3)) return;
          t.o.hp -= info.dmg || 1; this.burst(cx, cy, '#8b5a2b'); this.shake = 0.15;
          if (t.o.hp <= 0) { t.o = null; sfx('treefall'); this.add('madeira', rnd(3, 5) + (info.bonus || 0)); if (chance(0.3)) this.add('capim', 1, true); }
          else sfx('chop');
          return;
        }
        if (t.o && t.o.t === 'fruit') {
          UI.confirm(`Cortar esta ${D.fruits[t.o.k].n.toLowerCase()}? Ela vira madeira.`, () => {
            const trellis = t.o.trellis;
            t.o = null; sfx('treefall'); this.add('madeira', trellis ? 2 : 6);
            if (trellis) this.add('espaldeira', 1, true);
          });
          return;
        }
        if (t.o && t.o.t === 'b') {
          const b = this.getBuilding(t.o.id);
          if (b.type === 'cerca' || b.type === 'porteira' || b.type === 'ponte') { this.removeBuilding(b); this.add(b.type, 1); sfx('chop'); }
        }
        return;
      case 'picareta': {
        if (t.o && t.o.t === 'b') return this.dismantle(this.getBuilding(t.o.id));
        const n = this.areaAction(tx, ty, info.area, 3,
          tt => tt.o && tt.o.t === 'rock',
          (tt, x, y) => {
            tt.o.hp -= info.dmg || 1; this.burst(x + 0.5, y + 0.5, '#9a9a9a', 5);
            if (tt.o.hp <= 0) { tt.o = null; this.add('pedra', rnd(2, 4)); if (chance(0.08)) this.add('ferragens', 1); }
          });
        if (n > 0) { this.shake = 0.12; sfx(t.o ? 'pick' : 'rockbreak'); return; }
        if (!n && t.g === 'tilled') { t.g = 'grass'; t.c = null; t.wet = false; sfx('pick'); }
        return;
      }
      case 'faca': {
        const a = this.animalAt(wx, wy);
        if (!a) { toast('Use a faca sobre um animal adulto.'); return; }
        return this.slaughter(a);
      }
    }
  },

  // ponte: linha reta (no eixo dominante do arraste), só sobre a água
  bridgeCells(x0, y0, x1, y1) {
    const cells = [];
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) cells.push([x, y0]);
    else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) cells.push([x0, y]);
    return cells;
  },
  bridgeLine(x0, y0, x1, y1, quiet) {
    let placed = 0, missing = 0;
    for (const [x, y] of this.bridgeCells(x0, y0, x1, y1)) {
      if (!this.canPlace('ponte', x, y)) continue;
      if (!S.creative && !this.take('ponte')) { missing++; continue; }
      this.addBuilding('ponte', x, y); placed++;
    }
    if (quiet) return placed;
    if (placed) { sfx('place'); toast(`🌉 ${placed} trecho(s) de ponte construídos.${missing ? ` Faltaram ${missing} — crie mais pontes (C).` : ''}`); }
    else toast(missing ? 'Sem pontes na mochila. Crie no menu de criação (C).' : 'Arraste por cima da água para construir a ponte.');
    return placed;
  },

  // cercas em área: contorno do retângulo, com porteira no meio de um lado
  fenceRect(x0, y0, x1, y1, quiet, gateSide = 'bottom') {
    const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)], [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
    const cells = [];
    if (ax === bx || ay === by) { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) cells.push([x, y, 'cerca']); }
    else {
      for (let x = ax; x <= bx; x++) { cells.push([x, ay, 'cerca']); cells.push([x, by, 'cerca']); }
      for (let y = ay + 1; y < by; y++) { cells.push([ax, y, 'cerca']); cells.push([bx, y, 'cerca']); }
      const gx = Math.floor((ax + bx) / 2), gy = Math.floor((ay + by) / 2);
      const [px, py] = { bottom: [gx, by], top: [gx, ay], left: [ax, gy], right: [bx, gy] }[gateSide];
      const gate = cells.find(c => c[0] === px && c[1] === py);
      if (gate && Math.min(bx - ax, by - ay) >= 2) gate[2] = 'porteira';
    }
    let placed = 0, missing = 0;
    for (const [x, y, type] of cells) {
      if (!this.canPlace(type, x, y)) continue;
      if (!S.creative && !this.has(type)) {
        // sem porteira na mochila: usa cerca no lugar
        if (type === 'porteira' && (this.has('cerca'))) { this.take('cerca'); this.addBuilding('cerca', x, y); placed++; continue; }
        missing++; continue;
      }
      if (!S.creative) this.take(type);
      this.addBuilding(type, x, y); placed++;
    }
    if (quiet) return placed;
    if (placed) { sfx('place'); toast(`🚧 ${placed} peça(s) de cerca colocadas.${missing ? ` Faltaram ${missing} — crie mais cercas (C).` : ''}`); }
    else toast(missing ? 'Sem cercas na mochila. Crie mais no menu de criação (C).' : 'Não há espaço livre nessa área.');
    return placed;
  },

  cropReady(t) { return t.c && !t.c.dead && t.c.g >= D.crops[t.c.id].days; },

  harvest(tx, ty, quiet) {
    const t = this.tile(tx, ty), c = t.c, crop = D.crops[c.id];
    if (crop.greenManure) return this.greenManure(tx, ty);   // adubação verde: incorpora ao solo
    let n = rnd(crop.yield[0], crop.yield[1]);
    if (c.fert && chance(0.6)) n++;
    n = this.soilYield(t, c, n, tx, ty);
    if ((c.hp ?? 100) < 50) n = Math.max(1, n - 1);
    if (c.cri) {
      if (chance(0.08 * c.cri)) n++;            // variedade adaptada produz mais
      const bank = S.seedBank[c.id] || (S.seedBank[c.id] = { gen: 0, saved: 0, fresh: 0 });
      bank.fresh = Math.max(bank.fresh || 0, c.cri);   // colheu crioula: a próxima separação avança a geração
    }
    if (this.nearBee(tx, ty) && chance(0.3)) n++;
    this.add(c.id, n, quiet);
    if (!quiet) sfx('harvest');
    this.burst(tx + 0.5, ty + 0.5, '#ffe066', quiet ? 4 : 10);
    this.stat('harvest');
    this.soilAfterHarvest(t, crop, tx, ty);
    if (crop.regrow) { c.g = crop.days - crop.regrow; c.fert = false; }
    else t.c = null;
  },

  interact(tx, ty, wx, wy) {
    const p = S.player;
    const a = wx != null ? this.animalAt(wx, wy) : null;
    if (a) return this.touchAnimal(a);
    const t = this.tile(tx, ty);
    if (!t) return;
    if (t.o && t.o.t === 'b') return this.buildingInteract(this.getBuilding(t.o.id));
    if (t.o && t.o.t === 'fruit') {
      const f = D.fruits[t.o.k];
      if (t.o.ready) {
        t.o.ready = false;
        let n = rnd(f.yield[0], f.yield[1]); if (this.nearBee(tx, ty)) n++;
        this.add(f.fruit, n); sfx('harvest'); this.stat('fruits');
      } else if (t.o.age < f.mature) toast(`${f.n} jovem: ${f.mature - t.o.age} dias para começar a produzir.`);
      else if (!f.seasons.includes(S.season)) toast(`${f.n} só frutifica em: ${f.seasons.map(s => D.SEASONS[s]).join(', ')}.`);
      else toast(`${f.n}: frutos amadurecendo...`);
      return;
    }
    if (this.cropReady(t)) return this.harvest(tx, ty);
    if (t.c && !t.c.dead) {
      const crop = D.crops[t.c.id];
      toast(`${crop.n}: ${Math.max(0, crop.days - t.c.g)} dia(s) regado(s) para colher · saúde ${Math.round(t.c.hp ?? 100)}%${t.wet ? ' · regado hoje ✔' : ' · precisa de água'}${t.c.fert ? ' · adubado' : ''}`);
      return;
    }
    if (t.g === 'water') {
      // água do lago não é potável: pede confirmação e o risco cresce a cada gole no mesmo dia
      const n = p.lakeDrinks || 0, risk = Math.min(90, Math.round((0.2 + 0.2 * n) * 100));
      UI.confirm(`⚠️ <b>Água não potável.</b> Beber água do lago pode dar dor de barriga e deixar você doente.<br><small>Chance de passar mal agora: ${risk}%${n ? ` (você já bebeu ${n}× hoje)` : ''}. Prefira o poço, a cisterna ou água fervida.</small><br><br>Beber mesmo assim?`, () => {
        p.lakeDrinks = n + 1;
        p.sede = Math.min(100, p.sede + 25); sfx('drink');
        this.popup(tx + 0.5, ty, '+25 💧', '#9fd8ff');
        if (chance(risk / 100)) {
          p.sick = 180 + n * 120; p.energy = Math.max(0, p.energy - 10 - n * 5); p.hp = Math.max(5, p.hp - n * 8);
          toast(n >= 2 ? '🤢 Você ficou doente de verdade! Descanse e beba água limpa.' : '🤢 Dor de barriga! Construa um poço ou uma cisterna.', 'bad'); sfx('hurt');
        }
      });
      return;
    }
  },

  touchAnimal(a) {
    const def = D.animals[a.type];
    const isAdult = a.age >= def.adult;
    if (a.ready && def.produce && def.produce.where === 'hand') {
      a.ready = false; this.add(def.produce.item, 1); sfx(def.sfx); this.stat('animalProd');
      return;
    }
    if (!a.petted) { a.petted = true; a.happy = Math.min(100, a.happy + 5); this.popup(a.x, a.y - 1, '❤️'); sfx(def.sfx); return; }
    toast(`${a.name} (${isAdult ? def.n : def.baby}) · idade ${a.age}d · felicidade ${Math.round(a.happy)}%${a.hungry ? ' · COM FOME' : ''}`);
  },

  slaughter(a) {
    const def = D.animals[a.type];
    if (a.age < def.adult) { toast(`${a.name} ainda é ${def.baby.toLowerCase()}. Espere ficar adulto (${def.adult - a.age} dias).`); return; }
    const list = Object.entries(def.slaughter).map(([k, n]) => `${n} ${D.items[k].i}`).join(' ');
    UI.confirm(`Abater ${a.name} (${def.n})?<br><small>Rende: ${list}</small>`, () => {
      if (!this.useEnergy(4)) return;
      S.animals = S.animals.filter(o => o !== a);
      sfx('slaughter');
      let delay = 0;
      const bonus = (this.toolInfo('faca') || {}).bonus || 0;
      for (const [k, n] of Object.entries(def.slaughter)) { setTimeout(() => this.add(k, n + (k.startsWith('carne') ? bonus : 0)), delay); delay += 200; }
      this.stat('slaughter');
    });
  },

  dismantle(b) {
    const def = D.buildings[b.type];
    if (def.fixed) { toast('Isso não pode ser desmontado.'); return; }
    if (S.animals.some(a => a.home === b.id)) { toast('Ainda há animais morando aqui.'); return; }
    UI.confirm(`Desmontar ${def.n}? Você recebe o item de volta${b.type === 'cocho' && b.data.feed ? ' (a ração no cocho se perde)' : ''}.`, () => {
      this.removeBuilding(b); this.add(b.type, 1); sfx('craft');
    });
  },

  buildingInteract(b) {
    const def = D.buildings[b.type];
    const held = S.held && D.items[S.held];
    const p = S.player;
    switch (b.type) {
      case 'casa': return UI.sleepDialog();
      case 'loja': {
        const h = S.time / 60;
        if (!S.creative && (h < 7 || h >= 20)) { toast('A loja está fechada. Funciona das 7h às 20h.'); sfx('error'); return; }
        return UI.openShop();
      }
      case 'fogueira': return UI.openCraft('Cozinha');
      case 'moinho': return UI.openCraft('Moinho');
      case 'defumador': return UI.openCraft('Defumador');
      case 'cozinha_externa': return UI.openCraft((b.level || 1) >= 3 ? 'Forno e brasa' : 'Cozinha');
      case 'poco':
        p.sede = Math.min(100, p.sede + 40); p.water = p.waterMax; p.nutri = false; sfx('drink');
        this.popup(b.x + 1, b.y, '+40 💧 · regador cheio', '#9fd8ff');
        return;
      case 'composteira':
        if (b.data.ready > 0) { this.add('adubo', b.data.ready); this.stat('compost', b.data.ready); if (b.level >= 3) this.add('minhoca', b.data.ready * 2); b.data.ready = 0; sfx('pickup'); return; }
        if (held && held.organic) return this.deposit(b, S.held);
        return UI.openBuilding(b);
      case 'colmeia':
        if (b.data.mel > 0) { this.add('mel', b.data.mel); b.data.mel = 0; sfx('harvest'); return; }
        return UI.openBuilding(b);
      case 'cerca': return;
      case 'banco_sementes': return UI.openSeedBank(b);
      case 'fogao_biogas':
        if (!this.gasAvailable()) toast('Sem biogás: alimente o biodigestor com esterco. (Dá para cozinhar com lenha na fogueira.)');
        return UI.openCraft('Cozinha');
      case 'cisterna': {
        const w = b.data.water || 0, need = p.waterMax - p.water;
        if (w <= 0) { toast('Cisterna vazia: espere a chuva ou ligue uma bomba (roda d\'água / cata-vento).'); return; }
        const k = Math.min(w, need); b.data.water -= k; p.water += k;
        p.sede = Math.min(100, p.sede + 30); p.nutri = false; sfx('drink');
        this.popup(b.x + 1, b.y, `+30 💧 · regador +${k} L · restam ${Math.round(b.data.water)} L`, '#9fd8ff');
        return;
      }
      case 'biodigestor':
        if (b.data.ready > 0) { this.add('adubo', b.data.ready); b.data.bio -= b.data.ready; b.data.ready = 0; sfx('pickup'); toast('Biofertilizante coletado (vira adubo).'); return; }
        if (held && S.held === 'esterco') { const n = S.inv.esterco; this.take('esterco', n); b.data.load = (b.data.load || 0) + n; sfx('place'); this.popup(b.x + 1, b.y, `+${n} 💩`); return; }
        return UI.openBuilding(b);
    }
    if (held && held.feed && this.feedCap(b)) return this.deposit(b, S.held);
    if (def.houses && this.collectHouse(b)) return;
    return UI.openBuilding(b);
  },

  collectHouse(b) {
    let delay = 0, got = false;
    const later = (k, n) => { setTimeout(() => this.add(k, n), delay); delay += 220; got = true; };
    for (const [k, n] of Object.entries(b.data.store || {})) {
      if (n > 0) { later(k, n); if (k === 'ovo' || k === 'ovo_codorna') this.stat('eggs', n); else this.stat('animalProd', n); }
    }
    b.data.store = {};
    const m = Math.floor(b.data.manure || 0);
    if (m > 0) { later('esterco', m); b.data.manure -= m; }
    if (got) sfx('pickup');
    return got;
  },

  harvestFish(b) {
    const fish = S.animals.filter(a => a.home === b.id && a.age >= D.animals[a.type].adult);
    if (!fish.length) { toast('Nenhum peixe adulto ainda.'); return 0; }
    const tot = {};
    for (const a of fish) for (const [k, n] of Object.entries(D.animals[a.type].slaughter)) tot[k] = (tot[k] || 0) + n;
    S.animals = S.animals.filter(a => !fish.includes(a));
    let delay = 0;
    for (const [k, n] of Object.entries(tot)) { setTimeout(() => this.add(k, n), delay); delay += 220; }
    sfx('water'); this.stat('slaughter', fish.length);
    return fish.length;
  },

  deposit(b, id) {
    const it = D.items[id], n = S.inv[id] || 0;
    if (!n) return;
    const cap = this.feedCap(b);
    if (cap && it.feed) {
      if (b.data.feed >= cap) { toast(`${this.bname(b)} cheio (${cap}).`); return; }
      const qty = Math.min(n, Math.ceil((cap - b.data.feed) / it.feed));
      this.take(id, qty); b.data.feed = Math.min(cap, b.data.feed + qty * it.feed);
      this.feedProvenance(id, qty * it.feed);
      sfx('place'); this.popup(b.x + 1, b.y, `+${qty * it.feed} 🍽️`); this.stat('feed', qty * it.feed);
      return;
    }
    if (b.type === 'composteira') {
      const L = this.lvl(b);
      this.take(id, n); b.data.load += n * it.organic;
      let made = 0;
      while (b.data.load >= L.per) { b.data.load -= L.per; b.data.batches.push({ d: L.days, q: 1 }); made++; }
      sfx('place'); this.popup(b.x + 1, b.y, `+${n} ${it.i}`);
      toast(made ? `${made} lote(s) de adubo compostando (${L.days} noite(s)).` : `Composteira: carga ${b.data.load}/${L.per}.`);
    }
  },

  useItem(tx, ty, wx, wy) {
    const id = S.held, it = id && D.items[id];
    if (!it || !this.has(id)) { toast('Nenhum item na mão. Abra o inventário (I) e escolha um.'); return; }
    const t = this.tile(tx, ty);
    const b = t.o && t.o.t === 'b' ? this.getBuilding(t.o.id) : null;
    if (b && ((this.feedCap(b) && it.feed) || (b.type === 'composteira' && it.organic))) return this.deposit(b, id);
    if (it.seed) {
      if (t.g !== 'tilled' || t.c) { toast('Plante em terra arada e vazia (use a enxada).'); return; }
      const crop = D.crops[it.seed];
      if (!crop.seasons.includes(S.season)) { toast(`${crop.n} não cresce no(a) ${D.SEASONS[S.season]}. Épocas: ${crop.seasons.map(s => D.SEASONS[s]).join(', ')}.`); sfx('error'); return; }
      this.take(id); t.c = { id: it.seed, g: 0, fert: !!t.fert, dead: false, hp: 100 }; t.fert = false;
      if (it.crioula) t.c.cri = (S.seedBank[it.seed] && S.seedBank[it.seed].gen) || 1;
      this.ecoAdd(it.crioula ? 'seedCri' : 'seedShop', 1);
      this.onPlant(t, crop, tx, ty);
      sfx('plant'); this.stat('plant');
      return;
    }
    if (it.sapling) {
      const f = D.fruits[it.sapling];
      if (f.climber) {
        // trepadeira: precisa de uma espaldeira vazia
        if (!b || b.type !== 'espaldeira') { toast(`${f.n} é trepadeira: plante numa espaldeira (crie no menu C → Construção).`); sfx('error'); return; }
        this.removeBuilding(b);
        this.take(id); t.o = { t: 'fruit', k: it.sapling, age: 0, timer: 0, ready: false, trellis: true };
        sfx('plant'); this.stat('trees');
        return;
      }
      if (t.g !== 'grass' || t.o || t.c) { toast('Plante mudas em grama livre.'); return; }
      this.take(id); t.o = { t: 'fruit', k: it.sapling, age: 0, timer: 0, ready: false };
      sfx('plant'); this.stat('trees');
      return;
    }
    if (it.drip) {
      if (t.g !== 'tilled' || t.drip) { toast(t.drip ? 'Já tem gotejamento aqui.' : 'Instale o gotejamento em canteiros arados (arraste para cobrir vários).'); return; }
      this.take(id); t.drip = true; sfx('place');
      return;
    }
    if (it.place === 'painel_solar' && b && b.type === 'casa') {
      const n = b.data.panels || 0, max = D.buildings.casa.roofPanels;
      if (n >= max) { toast(`O telhado já está cheio (${max} painéis). Coloque os próximos no chão.`); return; }
      this.take(id); b.data.panels = n + 1;
      sfx('place'); this.burst(b.x + 2.5, b.y + 0.5, '#7fc4ff', 14);
      toast(`☀️ Painel instalado no telhado (${n + 1}/${max}). Cada um gera ~6 kWh por dia de sol.`);
      return;
    }
    if (it.place) {
      if (!this.canPlace(it.place, tx, ty)) { toast('Não cabe aqui. Precisa de espaço livre na sua terra.'); sfx('error'); return; }
      if (it.place === 'roda_dagua' && !this.nearWater({ type: 'roda_dagua', x: tx, y: ty }, 1)) { toast("A roda d'água precisa ficar encostada na água de um lago."); sfx('error'); return; }
      this.take(id); this.addBuilding(it.place, tx, ty);
      sfx('place'); this.burst(tx + 0.5, ty + 0.5, '#d9c08c', 12);
      this.checkQuests();
      return;
    }
    if (it.fert) {
      if (t.g !== 'tilled') { toast('Use o adubo em terra arada.'); return; }
      if ((t.c && t.c.fert) || t.fert) { toast('Já está adubado.'); return; }
      this.take(id); if (t.c) t.c.fert = true; else t.fert = true;
      t.f = Math.min(100, this.fert(t, tx, ty) + 25);
      sfx('plant'); this.burst(tx + 0.5, ty + 0.5, '#5a3d22');
      return;
    }
    if (it.pesticide) return this.applyPesticide(tx, ty, id);
    if (it.e) return this.eat(id);
    toast(`${it.n}: não há uso aqui. Venda na loja ou use em uma receita.`);
  },

  eat(id) {
    const it = D.items[id];
    if (!it || !it.e) { toast('Isso não é comestível.'); return; }
    if (!this.take(id)) return;
    const p = S.player, e = it.e;
    this.ecoAdd(it.cat === 'Mercado' ? 'foodBought' : 'foodOwn', (e.fome || 0) + (e.sede || 0) + (e.energia || 0));
    if (e.fome) p.fome = Math.min(100, p.fome + e.fome);
    if (e.sede) p.sede = Math.min(100, p.sede + e.sede);
    if (e.energia) p.energy = Math.min(p.maxEnergy, p.energy + e.energia);
    sfx(e.sede && !e.fome ? 'drink' : 'eat');
    this.popup(p.x, p.y - 1, `${it.i} ${e.fome ? '+' + e.fome + '🍖 ' : ''}${e.sede ? '+' + e.sede + '💧 ' : ''}${e.energia ? '+' + e.energia + '⚡' : ''}`);
  },

  // ---------------- Banco de sementes ----------------
  saveSeeds(b, crop, qty) {
    qty = Math.min(qty, S.inv[crop] || 0);
    if (!qty) { toast(`Você não tem ${D.crops[crop].n.toLowerCase()} colhido(a) para separar sementes.`); return false; }
    const L = this.lvl(b);
    this.take(crop, qty);
    const out = qty * (D.seedSave[crop] + (L.bonus || 0));
    const bank = S.seedBank[crop] || (S.seedBank[crop] = { gen: 0, saved: 0, fresh: 0 });
    const before = bank.gen;
    bank.gen = bank.fresh ? Math.min(5, Math.max(bank.gen, bank.fresh + (L.genStep || 1))) : Math.max(bank.gen, 1);
    bank.fresh = 0; bank.saved += out;
    this.add('cri_' + crop, out);
    sfx(bank.gen > before && before > 0 ? 'quest' : 'craft');
    if (bank.gen > before && before > 0) toast(`🌱 ${D.crops[crop].n} crioula chegou à geração ${bank.gen}: mais resistente e produtiva!`, 'good');
    this.stat('seeds', out);
    return true;
  },

  // ---------------- Criação (crafting) ----------------
  // perto do fogão a biogás (com gás), a lenha da receita não é gasta
  gasCooking(r) { return r.st === 'fogueira' && r.in.madeira && this.nearStation('fogao_biogas') && this.gasAvailable(); },
  recipeIn(r) { if (!this.gasCooking(r)) return r.in; const o = Object.assign({}, r.in); delete o.madeira; return o; },
  canCraft(r) {
    return Object.entries(this.recipeIn(r)).every(([k, n]) => this.has(k, n)) && this.nearStation(r.st);
  },
  craft(r) {
    if (!this.canCraft(r)) return false;
    if (this.gasCooking(r)) this.useGas();
    for (const [k, n] of Object.entries(this.recipeIn(r))) this.take(k, n);
    // fogão a lenha economiza lenha
    if ((r.st === 'fogueira' || r.st === 'forno') && r.in.madeira && !this.gasCooking(r)) {
      const k = S.buildings.find(b => b.type === 'cozinha_externa' && this.nearStation('cozinha_externa'));
      if (k && chance(this.lvl(k).save || 0)) { this.add('madeira', r.in.madeira, true); this.popup(S.player.x, S.player.y - 1.2, '🪵 lenha economizada', '#ffd27a'); }
    }
    if (r.out === 'racao') this.ecoAdd('rOwn', r.q);
    this.add(r.out, r.q);
    sfx(r.cat === 'Cozinha' ? 'cook' : 'craft');
    if (r.cat === 'Cozinha' || r.cat === 'Preparo') this.stat('cook');
    if (r.cat === 'Defumador') this.stat('smoke');
    if (r.out === 'racao' && r.st === 'moinho') this.stat('racao', r.q);
    return true;
  },

  // ---------------- Economia ----------------
  buy(entry, qty = 1) {
    const cost = entry.price * qty;
    if (!S.creative && S.money < cost) { toast('Dinheiro insuficiente.', 'bad'); sfx('error'); return false; }
    if (entry.animal) {
      for (let i = 0; i < qty; i++) {
        const home = this.homeWithSpace(entry.animal);
        if (!home) { toast(`Sem espaço! ${D.animals[entry.animal].n} precisa de ${this.homeNames(entry.animal)} com vaga.`, 'bad'); sfx('error'); return i > 0; }
        this.spend(entry.price);
        this.spawnAnimal(entry.animal, home, 0);
      }
      sfx('buy'); toast(`${qty > 1 ? 'Chegaram' : 'Chegou'} ${qty} ${D.animals[entry.animal].baby.toLowerCase()}(s)! Estão no(a) ${this.homeNames(entry.animal)}.`);
      this.checkQuests();
      return true;
    }
    if (entry.tool) {
      if (this.toolLvl(entry.tool) !== entry.level - 1) { toast('Compre o nível anterior primeiro.'); return false; }
      this.spend(cost); S.tools[entry.tool] = entry.level;
      if (entry.tool === 'regador') { S.player.waterMax = this.toolInfo('regador').cap; S.player.water = S.player.waterMax; }
      sfx('unlock'); toast(`🛠️ Nova ferramenta: ${this.toolName(entry.tool)}!`, 'good');
      return true;
    }
    if (entry.upgrade) {
      if (S.upgrades[entry.upgrade]) return false;
      this.spend(cost); S.upgrades[entry.upgrade] = true;
      if (entry.upgrade === 'regador') { S.player.waterMax = 40; S.player.water = 40; }
      sfx('buy'); toast(`Você comprou: ${entry.n}!`);
      return true;
    }
    this.spend(cost); this.add(entry.id, qty, true); sfx('buy');
    if (entry.id === 'racao') this.ecoAdd('rBought', qty);
    return true;
  },
  sell(id, qty) {
    const it = D.items[id];
    qty = Math.min(qty, S.inv[id] || 0);
    if (!qty || !it.sell) return;
    this.take(id, qty);
    S.money += it.sell * qty;
    S.stats.earned = (S.stats.earned || 0) + it.sell * qty;
    sfx('coin');
  },

  lotAdjacent(lot) {
    return D.lots.some(o => S.lots[o.id] && (
      (o.x + o.w === lot.x || lot.x + lot.w === o.x) && o.y < lot.y + lot.h && lot.y < o.y + o.h ||
      (o.y + o.h === lot.y || lot.y + lot.h === o.y) && o.x < lot.x + lot.w && lot.x < o.x + o.w));
  },
  buyLot(lot) {
    if (S.lots[lot.id] || !this.lotAdjacent(lot)) return false;
    if (!S.creative && S.money < lot.cost) { toast('Dinheiro insuficiente.', 'bad'); sfx('error'); return false; }
    this.spend(lot.cost); S.lots[lot.id] = true;
    sfx('unlock'); toast(`🎉 ${lot.n} agora é seu!`, 'good');
    this.stat('lots');
    return true;
  },

  // ---------------- Manual ----------------
  questProgress(q) {
    if (q.prog) return q.prog(S);
    if (q.stat) return `${Math.min(q.n, S.stats[q.stat] || 0)}/${q.n}`;
    return '';
  },
  questDone(q) { return q.check ? q.check(S) : (S.stats[q.stat] || 0) >= q.n; },
  checkQuests() {
    if (!S) return;
    let guard = 0;
    while (S.quest < D.quests.length && this.questDone(D.quests[S.quest]) && guard++ < 5) {
      const q = D.quests[S.quest];
      if (q.reward.money) S.money += q.reward.money;
      if (q.reward.items) for (const [k, n] of Object.entries(q.reward.items)) this.add(k, n, true);
      S.quest++;
      sfx('quest');
      const r = [q.reward.money ? `💰 ${q.reward.money}` : '', ...Object.entries(q.reward.items || {}).map(([k, n]) => `${n} ${D.items[k].i}`)].join(' ');
      toast(`📗 Manual: "${q.t}" concluído! Recompensa: ${r}`, 'good');
      if (S.quest >= D.quests.length) setTimeout(() => UI.victory(), 800);
    }
  },

  // ---------------- Noite / novo dia ----------------
  faint(msg) {
    const lost = Math.min(500, Math.floor(S.money * 0.1));
    S.money -= lost;
    this.report.unshift(`😵 ${msg} Um vizinho te levou para casa e cobrou 💰 ${lost} pelos cuidados.`);
    S.player.hp = Math.max(S.player.hp, 30);
    this.newDay(false);
  },

  sleep() {
    this.report.unshift(S.time <= 1440 ? '😴 Você dormiu bem.' : '🥱 Dormiu tarde... acordou um pouco cansado.');
    this.newDay(true);
  },

  newDay(slept) {
    const R = this.report;
    const p = S.player;
    // jogador
    const late = S.time > 1440;
    p.energy = slept ? (late ? p.maxEnergy * 0.75 : p.maxEnergy) : p.maxEnergy * 0.5;
    p.fome = Math.max(0, p.fome - 15); p.sede = Math.max(0, p.sede - 20);
    p.hp = Math.min(100, p.hp + (slept ? 25 : 0)); p.sick = 0; p.lakeDrinks = 0;
    if (p.fome <= 5 || p.sede <= 5) R.push('⚠️ Você acordou com muita fome/sede. Coma e beba logo!');

    // lavoura: crescimento e saúde das plantas
    let grew = 0, wilted = 0;
    S.tiles.forEach((t, i) => {
      const x = i % this.W, y = Math.floor(i / this.W);
      if (t.c && !t.c.dead) {
        const c = t.c, crop = D.crops[c.id];
        if (c.hp == null) c.hp = 100;
        const mature = c.g >= crop.days;
        if (t.wet) {
          c.hp = Math.min(100, c.hp + 10);
          if (!mature) {
            c.g += this.growStep(t, c, x, y); grew++;
            if (c.fert && chance(0.5)) c.g++;
            if (this.nearBee(x, y) && chance(0.2)) c.g++;
          }
        } else if (!mature) c.hp -= c.cri ? Math.max(10, 25 - 3 * c.cri) : 25;   // seca (crioulas resistem mais)
        if (mature) c.hp -= 4;                   // passando do ponto
        let weeds = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = this.tile(x + dx, y + dy); if (n && n.o && n.o.t === 'weed') weeds++; }
        c.hp -= Math.min(15, weeds * 5);         // competição com o mato
        if (c.fert) c.hp = Math.min(100, c.hp + 5);
        if (c.hp <= 0) { c.dead = true; wilted++; }
      } else if (t.g === 'tilled' && !t.c && !t.wet && !t.fert && chance(0.06)) t.g = 'grass';
      t.wet = false;
      if (t.o && t.o.t === 'fruit') {
        const f = D.fruits[t.o.k];
        t.o.age++;
        if (t.o.age >= f.mature && f.seasons.includes(S.season) && !t.o.ready) {
          t.o.timer += this.nearBee(x, y) ? 1.5 : 1;
          if (t.o.timer >= f.every) { t.o.ready = true; t.o.timer = 0; }
        }
      }
    });
    if (grew) R.push(`🌱 ${grew} plantas regadas cresceram.`);
    if (wilted) R.push(`🥀 ${wilted} planta(s) morreram por falta de água ou cuidado.`);
    this.nightPests(R);

    // construções
    for (const b of S.buildings) {
      if (b.type === 'composteira') {
        b.data.batches.forEach(x => x.d--);
        const done = b.data.batches.filter(x => x.d <= 0);
        if (done.length) { b.data.ready += done.reduce((s, x) => s + x.q, 0) * (b.level >= 3 ? 2 : 1); R.push(`♻️ A composteira produziu adubo.`); }
        b.data.batches = b.data.batches.filter(x => x.d > 0);
      }
      if (b.type === 'colmeia' && S.season !== 3) {
        b.data.t++;
        if (b.data.t >= this.lvl(b).every) { b.data.t = 0; b.data.mel = Math.min(10, b.data.mel + 1); R.push('🍯 A colmeia tem mel!'); }
      }
    }

    // animais
    this.feedAnimals(R);

    // natureza: mato e regeneração da mata
    for (const lot of D.lots) {
      if (!S.lots[lot.id]) continue;
      for (let k = 0; k < 4; k++) {
        const x = lot.x + rnd(0, lot.w - 1), y = lot.y + rnd(0, lot.h - 1), t = this.tile(x, y);
        if (t.g === 'grass' && !t.o && !t.c && chance(0.5)) t.o = { t: chance(lot.biome === 'mata' ? 0.25 : 0.03) ? 'tree' : 'weed', hp: 3, v: rnd(0, 3) };
      }
    }

    // calendário
    S.day++;
    if (S.day > D.DAYS_PER_SEASON) {
      S.day = 1; S.season = (S.season + 1) % 4; if (S.season === 0) S.year++;
      let died = 0;
      for (const t of S.tiles) if (t.c && !t.c.dead && !D.crops[t.c.id].seasons.includes(S.season)) { t.c.dead = true; died++; }
      R.push(`${D.SEASON_ICONS[S.season]} Começou o(a) ${D.SEASONS[S.season]}!${died ? ` ${died} plantas fora de época morreram.` : ''}`);
    }
    S.weather = S.tomorrow;
    const rainP = [0.25, 0.35, 0.2, 0.12][S.season];
    S.tomorrow = chance(rainP) ? 'chuva' : 'sol';
    if (S.weather === 'chuva') {
      for (const t of S.tiles) if (t.g === 'tilled') t.wet = true;
      R.push('🌧️ Está chovendo: a lavoura foi regada pela natureza.');
    }
    this.morningIrrigation(R);
    this.nightSystems(R);
    this.fish = null;
    S.time = DAY_START;
    for (const a of S.animals) {
      a.inside = false; a.tx = null;
      const h = this.getBuilding(a.home);
      if (h) { const d = this.buildingDoor(h); a.x = d.x + (Math.random() - 0.5); a.y = d.y + Math.random() * 0.5; }
    }
    this.toHouse();
    this.checkQuests();
    this.save();
    sfx('morning');
    if (window.UI) UI.morning(R.splice(0));
  },

  morningIrrigation(R) {
    let n = 0;
    const wet = (x, y, fert) => { const t = this.tile(x, y); if (t && t.g === 'tilled' && this.owned(x, y)) { if (!t.wet) n++; t.wet = true; if (fert && chance(0.15)) { if (t.c) t.c.fert = true; else t.fert = true; } } };
    for (const b of S.buildings) {
      if (b.type === 'aspersor') {
        const L = this.lvl(b);
        for (let dy = -L.range; dy <= L.range; dy++) for (let dx = -L.range; dx <= L.range; dx++) {
          if ((dx || dy) && (!L.cross || !dx || !dy)) wet(b.x + dx, b.y + dy);
        }
      }
      if (b.type === 'tanque' && this.perk(b, 'aquaponia')) {
        for (let dy = -3; dy <= 5; dy++) for (let dx = -3; dx <= 5; dx++) wet(b.x + dx, b.y + dy, true);
      }
    }
    if (n) R.push(`💦 Irrigação automática regou ${n} canteiro(s).`);
  },

  feedAnimals(R) {
    if (!S.animals.length) return;
    const troughs = S.buildings.filter(b => b.type === 'cocho' || b.type === 'silo');
    let pool = troughs.reduce((s, b) => s + (b.data.feed || 0), 0);
    const takeFeed = n => {
      for (const b of troughs) { const k = Math.min(n, b.data.feed); b.data.feed -= k; n -= k; if (!n) break; }
    };
    let pasture = 0;
    for (let i = 0; i < S.tiles.length; i++) {
      const t = S.tiles[i];
      if (t.g === 'grass' && (!t.o || t.o.t === 'weed') && !t.c && this.lotGrid[i] >= 0 && S.lots[D.lots[this.lotGrid[i]].id]) pasture++;
    }
    let grazeCap = Math.floor(pasture / 12 * (S.season === 3 ? 0.3 : 1));
    const order = S.animals.slice().sort(() => Math.random() - 0.5);
    let hungry = 0, dead = [], produced = {}, grown = 0;
    for (const a of order) {
      const def = D.animals[a.type];
      const home = this.getBuilding(a.home);
      let fed = false;
      if (def.grazer && grazeCap > 0) { grazeCap--; fed = true; S.eco.feedOwn += def.eat; }
      else if (home && this.perk(home, 'feeder') && home.data.feed >= def.eat) { home.data.feed -= def.eat; fed = true; this.troughEaten(def.eat); }
      else if (!def.aquatic && pool >= def.eat) { pool -= def.eat; takeFeed(def.eat); fed = true; this.troughEaten(def.eat); }
      const comfort = home && this.perk(home, 'comfort');
      if (fed) {
        a.hungry = 0; a.age++;
        a.happy = Math.min(100, a.happy + 5 + (a.petted ? 8 : 0) + (comfort ? 6 : 0));
        if (a.age >= def.adult && def.produce && (a.happy >= 30 || chance(0.5))) {
          const item = def.produce.item;
          if (def.produce.where === 'home') {
            if (home) { home.data.store[item] = Math.min(99, (home.data.store[item] || 0) + 1); produced[item] = (produced[item] || 0) + 1; }
          } else if (!a.ready) {
            a.prodDays++;
            if (a.prodDays >= def.produce.every) {
              a.prodDays = 0;
              if (home && this.perk(home, 'auto')) { home.data.store[item] = (home.data.store[item] || 0) + 1; produced[item] = (produced[item] || 0) + 1; }
              else a.ready = true;
            }
          }
        }
      } else {
        a.hungry++; hungry++;
        a.happy = Math.max(0, a.happy - 25);
        if (a.hungry >= 3) dead.push(a);
      }
      if (a.age === def.adult && fed) { if (def.aquatic) grown++; else R.push(`🎉 ${a.name} virou ${def.n.toLowerCase()} adulta!`); }
      a.petted = false;
      if (home && home.data.manure != null) home.data.manure = Math.min(99, home.data.manure + def.manure * (this.perk(home, 'biogas') ? 2 : 1));
    }
    if (grown) R.push(`🐟 ${grown} tilápia(s) atingiram o peso de abate.`);
    const prodTxt = Object.entries(produced).map(([k, n]) => `${n} ${D.items[k].i}`).join(' ');
    if (prodTxt) R.push(`🧺 Produção guardada nas instalações: ${prodTxt}`);
    if (hungry) R.push(`⚠️ ${hungry} animal(is) passaram fome! Abasteça cochos, silos ou comedouros.`);
    for (const a of dead) { R.push(`💀 ${a.name} (${D.animals[a.type].n}) morreu de fome.`); }
    S.animals = S.animals.filter(a => !dead.includes(a));
    // reprodução
    for (const b of S.buildings) {
      const def = D.buildings[b.type];
      if (!def.houses) continue;
      const cap = this.cap(b);
      for (const type of def.houses) {
        const ad = S.animals.filter(a => a.home === b.id && a.type === type && a.age >= D.animals[type].adult && !a.hungry && a.happy > 50);
        let total = S.animals.filter(a => a.home === b.id).length;
        const p = (D.animals[type].breed || 0.12) * (this.perk(b, 'comfort') ? 1.5 : 1);
        if (ad.length >= 2 && total < cap && chance(p)) {
          const k = D.animals[type].aquatic ? Math.min(cap - total, rnd(2, 5)) : 1;
          for (let i = 0; i < k; i++) this.spawnAnimal(type, b, 0);
          R.push(`🐣 Nasceu ${k > 1 ? k + ' ' + D.animals[type].baby.toLowerCase() + 's' : 'um(a) ' + D.animals[type].baby.toLowerCase()} no(a) ${this.bname(b)}!`);
        }
      }
    }
  },

  // ---------------- Ferramentas de desenvolvimento (modo teste) ----------------
  dev: {
    hours(h) { S.time = Math.min(PASS_OUT - 5, S.time + h * 60); },
    skipDay() { G.report.unshift('🧪 Dia pulado (modo teste).'); G.newDay(true); },
    grow(n = 1) { for (const t of S.tiles) if (t.c && !t.c.dead) { t.c.g += n; t.c.hp = 100; } for (const t of S.tiles) if (t.o && t.o.t === 'fruit') t.o.age += n; },
    ripen() {
      for (const t of S.tiles) if (t.c && !t.c.dead) { t.c.g = Math.max(t.c.g, D.crops[t.c.id].days); t.c.hp = 100; }
      for (const t of S.tiles) if (t.o && t.o.t === 'fruit') { t.o.age = Math.max(t.o.age, D.fruits[t.o.k].mature); t.o.ready = true; }
    },
    waterAll() { for (const t of S.tiles) if (t.g === 'tilled') t.wet = true; },
    healAll() { for (const t of S.tiles) if (t.c) { t.c.dead = false; t.c.hp = 100; } },
    ageAnimals(n = 1) {
      for (const a of S.animals) {
        const d = D.animals[a.type]; a.age += n; a.hungry = 0; a.happy = 100;
        if (a.age >= d.adult && d.produce) {
          const h = G.getBuilding(a.home);
          if (d.produce.where === 'home' || (h && G.perk(h, 'auto'))) { if (h) h.data.store[d.produce.item] = (h.data.store[d.produce.item] || 0) + 1; }
          else a.ready = true;
        }
      }
    },
    fillStats() { const p = S.player; p.hp = 100; p.energy = p.maxEnergy; p.fome = 100; p.sede = 100; p.water = p.waterMax; p.sick = 0; },
    materials() { for (const [k, n] of Object.entries({ madeira: 200, pedra: 200, ferragens: 50, racao: 100, adubo: 30, capim: 50 })) G.add(k, n, true); },
    seeds() { for (const id of Object.keys(D.crops)) G.add('sem_' + id, 20, true); for (const id of Object.keys(D.fruits)) G.add('muda_' + id, 3, true); },
    season() {
      S.season = (S.season + 1) % 4; S.day = 1;
      for (const t of S.tiles) if (t.c && !t.c.dead && !D.crops[t.c.id].seasons.includes(S.season)) t.c.dead = true;
    },
    rain() { S.weather = S.weather === 'chuva' ? 'sol' : 'chuva'; if (S.weather === 'chuva') this.waterAll(); },
    allLots() { for (const l of D.lots) S.lots[l.id] = true; },
  },
};
