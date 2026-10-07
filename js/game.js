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
const SAVE_KEY = 'ecoland_save_v1';

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

  solid(x, y) {
    if (!this.inBounds(x, y) || !this.owned(x, y)) return true;
    const t = S.tiles[this.idx(x, y)];
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
    for (let y = s.y + 10; y < s.y + 14; y++) for (let x = s.x + 14; x < s.x + 19; x++) {
      const d = ((x + 0.5 - (s.x + 16.5)) / 2.6) ** 2 + ((y + 0.5 - (s.y + 12)) / 1.9) ** 2;
      const t = this.tile(x, y);
      if (d < 1) { t.g = 'water'; t.o = null; } else if (d < 1.6) { t.g = 'sand'; t.o = null; }
    }
  },

  // ---------------- Construções ----------------
  getBuilding(id) { return S.buildings.find(b => b.id === id); },
  countBuildings(type) { return S.buildings.filter(b => b.type === type).length; },
  countAnimals(type) { return S.animals.filter(a => a.type === type).length; },
  countCrops() { let n = 0; for (const t of S.tiles) if (t.c && !t.c.dead) n++; return n; },
  countFruitTrees() { let n = 0; for (const t of S.tiles) if (t.o && t.o.t === 'fruit') n++; return n; },

  canPlace(type, x0, y0) {
    const def = D.buildings[type];
    for (let y = y0; y < y0 + def.h; y++) for (let x = x0; x < x0 + def.w; x++) {
      if (!this.owned(x, y)) return false;
      const t = this.tile(x, y);
      if (!t || t.g === 'water' || t.o || t.c) return false;
      if (Math.floor(S.player.x) === x && Math.floor(S.player.y) === y) return false;
    }
    return true;
  },

  addBuilding(type, x0, y0, fixed) {
    const def = D.buildings[type];
    const b = { id: S.nextId++, type, x: x0, y: y0, data: {} };
    if (type === 'cocho') b.data.feed = 0;
    if (type === 'composteira') { b.data.load = 0; b.data.batches = []; b.data.ready = 0; }
    if (type === 'galinheiro' || type === 'galpao') { b.data.manure = 0; b.data.eggs = 0; }
    if (type === 'colmeia') { b.data.t = 0; b.data.mel = 0; }
    for (let y = y0; y < y0 + def.h; y++) for (let x = x0; x < x0 + def.w; x++) {
      const t = this.tile(x, y); t.o = { t: 'b', id: b.id }; t.g = t.g === 'tilled' ? 'grass' : t.g; t.c = null;
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
    return S.buildings.find(b => b.type === def.home &&
      S.animals.filter(a => a.home === b.id).length < D.buildings[b.type].cap);
  },

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

  // ---------------- Novo jogo / save ----------------
  newGame(farmName) {
    S = {
      version: 1, farmName: farmName || 'Sítio Esperança',
      day: 1, season: 0, year: 1, time: DAY_START, money: 300, weather: 'sol', tomorrow: 'sol',
      player: { x: 0, y: 0, dir: 'down', hp: 100, energy: 100, maxEnergy: 100, fome: 85, sede: 85, water: 15, waterMax: 15, sick: 0 },
      inv: { sem_alface: 10, sem_cenoura: 6, marmita: 3, agua: 3 },
      held: 'sem_alface', tool: 0, lots: { sede: true }, tiles: [], buildings: [], animals: [], nextId: 1,
      stats: {}, quest: 0, upgrades: {}, ended: false,
    };
    this.buildLotGrid();
    this.genWorld();
    this.toHouse();
  },

  toHouse() {
    const casa = S.buildings.find(b => b.type === 'casa');
    const d = this.buildingDoor(casa);
    S.player.x = d.x; S.player.y = d.y + 0.2; S.player.dir = 'down';
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch (e) { toast('Não foi possível salvar.', 'bad'); return false; }
  },
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      S = JSON.parse(raw);
      this.buildLotGrid();
      S.animals.forEach(a => { a.tx = null; });
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
      if (S.time >= ANIMALS_IN) { a.inside = true; continue; }
      if (a.inside) { const d0 = this.buildingDoor(home); a.inside = false; a.x = d0.x; a.y = d0.y; a.tx = null; }
      const door = this.buildingDoor(home);
      if (S.time >= NIGHT_HOME) { a.tx = door.x; a.ty = door.y; a.wait = 0; }
      a.wait = (a.wait || 0) - dt;
      if (a.tx == null || (a.wait <= 0 && Math.hypot(a.tx - a.x, a.ty - a.y) < 0.2)) {
        if (a.wait <= 0 && S.time < NIGHT_HOME) {
          for (let k = 0; k < 8; k++) {
            const tx = Math.floor(door.x) + rnd(-6, 6), ty = Math.floor(door.y) + rnd(-5, 6);
            if (!this.solid(tx, ty)) { a.tx = tx + 0.5; a.ty = ty + 0.5; break; }
          }
          a.wait = 2 + Math.random() * 5;
        }
      }
      if (a.tx == null) continue;
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > 0.1) {
        const sp = def.speed * dt * (a.age < def.adult ? 1.2 : 1);
        const nx = a.x + dx / d * Math.min(sp, d), ny = a.y + dy / d * Math.min(sp, d);
        if (!this.solid(Math.floor(nx), Math.floor(ny))) { a.x = nx; a.y = ny; a.moving = true; }
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
      x: d.x, y: d.y, hungry: 0, happy: 60, ready: false, prodDays: 0, petted: false, inside: S.time >= ANIMALS_IN,
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
  useTool(tx, ty, wx, wy) {
    const tool = D.tools[S.tool].id;
    const t = this.tile(tx, ty);
    if (!t) return;
    if (!this.owned(tx, ty)) { toast('Essa terra ainda não é sua. Compre o lote (tecla T).'); sfx('error'); return; }
    const cx = tx + 0.5, cy = ty + 0.5;
    switch (tool) {
      case 'mao': return this.interact(tx, ty, wx, wy);
      case 'item': return this.useItem(tx, ty, wx, wy);
      case 'enxada':
        if (t.c && t.c.dead) { if (!this.useEnergy(1)) return; t.c = null; sfx('hoe'); this.burst(cx, cy, '#6b4a2b'); return; }
        if (t.g === 'grass' && !t.o) {
          if (!this.useEnergy(2)) return;
          t.g = 'tilled'; sfx('hoe'); this.burst(cx, cy, '#7a5230'); this.stat('till');
          return;
        }
        if (t.o && t.o.t === 'weed') { toast('Roce o mato com a foice primeiro.'); return; }
        return;
      case 'regador': {
        const b = t.o && t.o.t === 'b' ? this.getBuilding(t.o.id) : null;
        if (t.g === 'water' || (b && b.type === 'poco')) {
          S.player.water = S.player.waterMax; sfx('refill'); this.popup(cx, cy, '💧 cheio!', '#9fd8ff'); return;
        }
        if (t.g === 'tilled') {
          if (S.player.water <= 0) { toast('Regador vazio! Encha no lago ou no poço.'); sfx('error'); return; }
          if (!this.useEnergy(1)) return;
          S.player.water--; t.wet = true; sfx('water'); this.burst(cx, cy, '#6cc4ff', 6); this.stat('water');
          return;
        }
        return;
      }
      case 'foice':
        if (t.c) {
          if (t.c.dead) { t.c = null; sfx('scythe'); return; }
          if (this.cropReady(t)) { if (!this.useEnergy(1)) return; return this.harvest(tx, ty); }
          toast('Ainda não está pronto para colher.'); return;
        }
        if (t.o && t.o.t === 'weed') {
          if (!this.useEnergy(1)) return;
          t.o = null; sfx('scythe'); this.burst(cx, cy, '#5fae3a'); this.add('capim', chance(0.4) ? 2 : 1); this.stat('weeds');
          return;
        }
        return;
      case 'machado':
        if (t.o && t.o.t === 'tree') {
          if (!this.useEnergy(3)) return;
          t.o.hp--; this.burst(cx, cy, '#8b5a2b'); this.shake = 0.15;
          if (t.o.hp <= 0) { t.o = null; sfx('treefall'); this.add('madeira', rnd(3, 5)); if (chance(0.3)) this.add('capim', 1, true); }
          else sfx('chop');
          return;
        }
        if (t.o && t.o.t === 'fruit') {
          UI.confirm(`Cortar esta ${D.fruits[t.o.k].n.toLowerCase()}? Ela vira madeira.`, () => {
            t.o = null; sfx('treefall'); this.add('madeira', 6);
          });
          return;
        }
        if (t.o && t.o.t === 'b') {
          const b = this.getBuilding(t.o.id);
          if (b.type === 'cerca') { this.removeBuilding(b); this.add('cerca', 1); sfx('chop'); }
        }
        return;
      case 'picareta':
        if (t.o && t.o.t === 'rock') {
          if (!this.useEnergy(3)) return;
          t.o.hp--; this.burst(cx, cy, '#9a9a9a'); this.shake = 0.12;
          if (t.o.hp <= 0) { t.o = null; sfx('rockbreak'); this.add('pedra', rnd(2, 4)); if (chance(0.08)) this.add('ferragens', 1); }
          else sfx('pick');
          return;
        }
        if (t.o && t.o.t === 'b') return this.dismantle(this.getBuilding(t.o.id));
        if (t.g === 'tilled') { t.g = 'grass'; t.c = null; t.wet = false; sfx('pick'); }
        return;
      case 'faca': {
        const a = this.animalAt(wx, wy);
        if (!a) { toast('Use a faca sobre um animal adulto.'); return; }
        return this.slaughter(a);
      }
    }
  },

  cropReady(t) { return t.c && !t.c.dead && t.c.g >= D.crops[t.c.id].days; },

  harvest(tx, ty) {
    const t = this.tile(tx, ty), c = t.c, crop = D.crops[c.id];
    let n = rnd(crop.yield[0], crop.yield[1]);
    if (c.fert && chance(0.6)) n++;
    if (this.nearBee(tx, ty) && chance(0.3)) n++;
    this.add(c.id, n);
    sfx('harvest'); this.burst(tx + 0.5, ty + 0.5, '#ffe066', 10);
    this.stat('harvest');
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
      toast(`${crop.n}: ${Math.max(0, crop.days - t.c.g)} dia(s) regado(s) para colher${t.wet ? ' · regado hoje ✔' : ' · precisa de água'}${t.c.fert ? ' · adubado' : ''}`);
      return;
    }
    if (t.g === 'water') {
      p.sede = Math.min(100, p.sede + 25); sfx('drink');
      this.popup(tx + 0.5, ty, '+25 💧', '#9fd8ff');
      if (chance(0.25)) { p.sick = 180; p.energy = Math.max(0, p.energy - 10); toast('Água do lago não tratada... dor de barriga! Construa um poço.', 'bad'); sfx('hurt'); }
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
      for (const [k, n] of Object.entries(def.slaughter)) { setTimeout(() => this.add(k, n), delay); delay += 200; }
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
        if (h < 7 || h >= 20) { toast('A loja está fechada. Funciona das 7h às 20h.'); sfx('error'); return; }
        return UI.openShop();
      }
      case 'fogueira': return UI.openCraft('Cozinha');
      case 'moinho': return UI.openCraft('Moinho');
      case 'defumador': return UI.openCraft('Defumador');
      case 'poco':
        p.sede = Math.min(100, p.sede + 40); p.water = p.waterMax; sfx('drink');
        this.popup(b.x + 1, b.y, '+40 💧 · regador cheio', '#9fd8ff');
        return;
      case 'cocho':
        if (held && held.feed) return this.deposit(b, S.held);
        toast(`Cocho: ${b.data.feed} unidade(s) de alimento. Segure ração, grãos ou capim para abastecer.`);
        return;
      case 'composteira':
        if (b.data.ready > 0) { this.add('adubo', b.data.ready); this.stat('compost', b.data.ready); b.data.ready = 0; sfx('pickup'); return; }
        if (held && held.organic) return this.deposit(b, S.held);
        toast(`Composteira: carga ${b.data.load}/4 · ${b.data.batches.length} lote(s) compostando. Segure esterco, capim ou restos.`);
        return;
      case 'galinheiro':
      case 'galpao': {
        let got = false;
        if (b.data.eggs > 0) { this.add('ovo', b.data.eggs); this.stat('eggs', b.data.eggs); b.data.eggs = 0; got = true; }
        const m = Math.floor(b.data.manure);
        if (m > 0) { setTimeout(() => this.add('esterco', m), got ? 250 : 0); b.data.manure -= m; got = true; }
        if (got) { sfx('pickup'); return; }
        return UI.openAnimals(b);
      }
      case 'colmeia':
        if (b.data.mel > 0) { this.add('mel', b.data.mel); b.data.mel = 0; sfx('harvest'); return; }
        toast(S.season === 3 ? 'As abelhas estão recolhidas no inverno.' : `Colmeia trabalhando... mel em ${3 - b.data.t} dia(s).`);
        return;
      case 'cerca': return;
    }
  },

  deposit(b, id) {
    const it = D.items[id], n = S.inv[id] || 0;
    if (!n) return;
    if (b.type === 'cocho') {
      if (b.data.feed >= 60) { toast('Cocho cheio (60).'); return; }
      const qty = Math.min(n, Math.ceil((60 - b.data.feed) / it.feed));
      this.take(id, qty); b.data.feed = Math.min(60, b.data.feed + qty * it.feed);
      sfx('place'); this.popup(b.x + 1, b.y, `+${qty * it.feed} 🍽️`); this.stat('feed', qty * it.feed);
      return;
    }
    if (b.type === 'composteira') {
      this.take(id, n); b.data.load += n * it.organic;
      let made = 0;
      while (b.data.load >= 4) { b.data.load -= 4; b.data.batches.push({ d: 2, q: 1 }); made++; }
      sfx('place'); this.popup(b.x + 1, b.y, `+${n} ${it.i}`);
      toast(made ? `${made} lote(s) de adubo compostando (2 noites).` : `Composteira: carga ${b.data.load}/4.`);
    }
  },

  useItem(tx, ty, wx, wy) {
    const id = S.held, it = id && D.items[id];
    if (!it || !this.has(id)) { toast('Nenhum item na mão. Abra o inventário (I) e escolha um.'); return; }
    const t = this.tile(tx, ty);
    const b = t.o && t.o.t === 'b' ? this.getBuilding(t.o.id) : null;
    if (b && ((b.type === 'cocho' && it.feed) || (b.type === 'composteira' && it.organic))) return this.deposit(b, id);
    if (it.seed) {
      if (t.g !== 'tilled' || t.c) { toast('Plante em terra arada e vazia (use a enxada).'); return; }
      const crop = D.crops[it.seed];
      if (!crop.seasons.includes(S.season)) { toast(`${crop.n} não cresce no(a) ${D.SEASONS[S.season]}. Épocas: ${crop.seasons.map(s => D.SEASONS[s]).join(', ')}.`); sfx('error'); return; }
      this.take(id); t.c = { id: it.seed, g: 0, fert: !!t.fert, dead: false }; t.fert = false;
      sfx('plant'); this.stat('plant');
      return;
    }
    if (it.sapling) {
      if (t.g !== 'grass' || t.o || t.c) { toast('Plante mudas em grama livre.'); return; }
      this.take(id); t.o = { t: 'fruit', k: it.sapling, age: 0, timer: 0, ready: false };
      sfx('plant'); this.stat('trees');
      return;
    }
    if (it.place) {
      if (!this.canPlace(it.place, tx, ty)) { toast('Não cabe aqui. Precisa de espaço livre na sua terra.'); sfx('error'); return; }
      this.take(id); this.addBuilding(it.place, tx, ty);
      sfx('place'); this.burst(tx + 0.5, ty + 0.5, '#d9c08c', 12);
      this.checkQuests();
      return;
    }
    if (it.fert) {
      if (t.g !== 'tilled') { toast('Use o adubo em terra arada.'); return; }
      if ((t.c && t.c.fert) || t.fert) { toast('Já está adubado.'); return; }
      this.take(id); if (t.c) t.c.fert = true; else t.fert = true;
      sfx('plant'); this.burst(tx + 0.5, ty + 0.5, '#5a3d22');
      return;
    }
    if (it.e) return this.eat(id);
    toast(`${it.n}: não há uso aqui. Venda na loja ou use em uma receita.`);
  },

  eat(id) {
    const it = D.items[id];
    if (!it || !it.e) { toast('Isso não é comestível.'); return; }
    if (!this.take(id)) return;
    const p = S.player, e = it.e;
    if (e.fome) p.fome = Math.min(100, p.fome + e.fome);
    if (e.sede) p.sede = Math.min(100, p.sede + e.sede);
    if (e.energia) p.energy = Math.min(p.maxEnergy, p.energy + e.energia);
    sfx(e.sede && !e.fome ? 'drink' : 'eat');
    this.popup(p.x, p.y - 1, `${it.i} ${e.fome ? '+' + e.fome + '🍖 ' : ''}${e.sede ? '+' + e.sede + '💧 ' : ''}${e.energia ? '+' + e.energia + '⚡' : ''}`);
  },

  // ---------------- Criação (crafting) ----------------
  canCraft(r) {
    return Object.entries(r.in).every(([k, n]) => this.has(k, n)) && this.nearStation(r.st);
  },
  craft(r) {
    if (!this.canCraft(r)) return false;
    for (const [k, n] of Object.entries(r.in)) this.take(k, n);
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
        if (!home) { toast(`Sem espaço! ${D.animals[entry.animal].n} precisa de um(a) ${D.buildings[D.animals[entry.animal].home].n} com vaga.`, 'bad'); sfx('error'); return i > 0; }
        this.spend(entry.price);
        this.spawnAnimal(entry.animal, home, 0);
      }
      sfx('buy'); toast(`${qty > 1 ? 'Chegaram' : 'Chegou'} ${qty} ${D.animals[entry.animal].baby.toLowerCase()}(s)! Estão perto do(a) ${D.buildings[D.animals[entry.animal].home].n}.`);
      this.checkQuests();
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
    p.hp = Math.min(100, p.hp + (slept ? 25 : 0)); p.sick = 0;
    if (p.fome <= 5 || p.sede <= 5) R.push('⚠️ Você acordou com muita fome/sede. Coma e beba logo!');

    // lavoura
    let grew = 0;
    S.tiles.forEach((t, i) => {
      const x = i % this.W, y = Math.floor(i / this.W);
      if (t.c && !t.c.dead) {
        if (t.wet) {
          t.c.g++; grew++;
          if (t.c.fert && chance(0.5)) t.c.g++;
          if (this.nearBee(x, y) && chance(0.2)) t.c.g++;
        }
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

    // construções
    for (const b of S.buildings) {
      if (b.type === 'composteira') {
        b.data.batches.forEach(x => x.d--);
        const done = b.data.batches.filter(x => x.d <= 0);
        if (done.length) { b.data.ready += done.reduce((s, x) => s + x.q, 0); R.push(`♻️ A composteira produziu ${done.length} adubo.`); }
        b.data.batches = b.data.batches.filter(x => x.d > 0);
      }
      if (b.type === 'colmeia' && S.season !== 3) {
        b.data.t++;
        if (b.data.t >= 3) { b.data.t = 0; b.data.mel = Math.min(5, b.data.mel + 1); R.push('🍯 A colmeia tem mel!'); }
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

  feedAnimals(R) {
    if (!S.animals.length) return;
    const troughs = S.buildings.filter(b => b.type === 'cocho');
    let pool = troughs.reduce((s, b) => s + b.data.feed, 0);
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
    let hungry = 0, dead = [], eggs = 0;
    for (const a of order) {
      const def = D.animals[a.type];
      let fed = false;
      if (def.grazer && grazeCap > 0) { grazeCap--; fed = true; }
      else if (pool >= def.eat) { pool -= def.eat; takeFeed(def.eat); fed = true; }
      const home = this.getBuilding(a.home);
      if (fed) {
        a.hungry = 0; a.age++;
        a.happy = Math.min(100, a.happy + 5 + (a.petted ? 8 : 0));
        if (a.age >= def.adult && def.produce && (a.happy >= 30 || chance(0.5))) {
          if (def.produce.where === 'home') { if (home) { home.data.eggs = Math.min(40, (home.data.eggs || 0) + 1); eggs++; } }
          else if (!a.ready) { a.prodDays++; if (a.prodDays >= def.produce.every) { a.ready = true; a.prodDays = 0; } }
        }
      } else {
        a.hungry++; hungry++;
        a.happy = Math.max(0, a.happy - 25);
        if (a.hungry >= 3) dead.push(a);
      }
      if (a.age === def.adult && fed) R.push(`🎉 ${a.name} virou ${def.n.toLowerCase()} adulta!`);
      a.petted = false;
      if (home) home.data.manure = Math.min(50, (home.data.manure || 0) + def.manure);
    }
    if (eggs) R.push(`🥚 ${eggs} ovo(s) no galinheiro.`);
    if (hungry) R.push(`⚠️ ${hungry} animal(is) passaram fome! Abasteça o cocho ou libere pasto.`);
    for (const a of dead) { R.push(`💀 ${a.name} (${D.animals[a.type].n}) morreu de fome.`); }
    S.animals = S.animals.filter(a => !dead.includes(a));
    // reprodução
    for (const b of S.buildings) {
      const def = D.buildings[b.type];
      if (!def.cap) continue;
      for (const type of def.houses) {
        const ad = S.animals.filter(a => a.home === b.id && a.type === type && a.age >= D.animals[type].adult && !a.hungry && a.happy > 50);
        const total = S.animals.filter(a => a.home === b.id).length;
        if (ad.length >= 2 && total < def.cap && chance(0.12)) {
          const baby = this.spawnAnimal(type, b, 0);
          R.push(`🐣 Nasceu um(a) ${D.animals[type].baby.toLowerCase()}: ${baby.name}!`);
        }
      }
    }
  },
};
