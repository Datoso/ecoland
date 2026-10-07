// =============================================================
// EcoLand — solo vivo (fertilidade, rotação, adubação verde) e
// pragas com controle biológico. Estende o motor G.
// =============================================================
Object.assign(G, {
  // fertilidade do canteiro (0..100), iniciada pelo bioma do lote
  fert(t, x, y) {
    if (t.f == null) { const lot = this.lotAt(x, y); t.f = (lot && D.soilBase[lot.biome]) || 60; }
    return t.f;
  },
  soilLabel(f) { return f >= 75 ? 'fértil' : f >= 50 ? 'bom' : f >= 30 ? 'cansado' : 'esgotado'; },

  // crescimento de uma noite regada, de acordo com o solo e as pragas
  growStep(t, c, x, y) {
    const f = this.fert(t, x, y);
    if (c.pest && D.pests[c.pest].stall) return 0;          // pulgão trava o crescimento
    if (f < 30 && chance(0.4)) return 0;                     // solo esgotado
    return 1 + (f >= 75 && chance(0.15) ? 1 : 0);
  },

  // adubação verde: colher = incorporar ao solo
  greenManure(tx, ty) {
    const t = this.tile(tx, ty), crop = D.crops[t.c.id];
    t.f = Math.min(100, this.fert(t, tx, ty) + crop.greenManure);
    t.lastFam = 'adubo_verde'; t.c = null;
    this.burst(tx + 0.5, ty + 0.5, '#5a8f2a', 10);
    this.popup(tx + 0.5, ty, `🌱 solo +${crop.greenManure}`, '#b6f5a0');
    this.stat('greenmanure');
    return true;
  },
  soilYield(t, c, n, x, y) {
    const f = this.fert(t, x, y);
    if (f < 30) n = Math.max(1, n - 1);
    else if (f >= 75 && chance(0.3)) n++;
    if (c.pest) n = Math.max(1, n - 1);
    return n;
  },
  soilAfterHarvest(t, crop, x, y) {
    const f = this.fert(t, x, y);
    const demand = crop.fam === 'leguminosa' ? -8 : crop.fam === 'graminea' ? 12 : crop.fam === 'fruto' ? 10 : 8;   // feijão devolve nitrogênio
    t.f = Math.max(5, Math.min(100, f - demand - (t.c && t.c.mono ? 8 : 0)));
    t.lastFam = crop.fam;
  },
  onPlant(t, crop, x, y) {
    this.fert(t, x, y);
    if (crop.fam && t.lastFam === crop.fam && crop.fam !== 'adubo_verde') {
      t.c.mono = true;
      this.popup(x + 0.5, y, '🔁 mesma família: solo cansa e atrai pragas', '#ffd27a');
    } else if (t.lastFam && t.lastFam !== crop.fam) t.f = Math.min(100, t.f + 4);   // rotação
    if (crop.companion) this.stat('cravo');
  },

  // aplicar calda/neem numa área 3×3
  applyPesticide(tx, ty, id) {
    const it = D.items[id];
    let cured = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = this.tile(tx + dx, ty + dy);
      if (!t || !t.c || t.c.dead) continue;
      n++; if (t.c.pest) { cured++; t.c.pest = null; }
      t.c.protect = Math.max(t.c.protect || 0, it.pesticide);
    }
    if (!n) { toast('Aplique sobre plantas (área 3×3).'); return; }
    this.take(id);
    sfx('water'); this.burst(tx + 0.5, ty + 0.5, '#c6f08a', 14);
    toast(`🧴 ${it.n}: ${cured} planta(s) livres de pragas e ${n} protegidas por ${it.pesticide} dias.`);
    this.stat('pesticide');
  },

  // noite: pragas atacam, se espalham ou aparecem
  nightPests(R) {
    const W = this.W, crops = [];
    S.tiles.forEach((t, i) => { if (t.c && !t.c.dead) crops.push([t, i % W, Math.floor(i / W)]); });
    if (!crops.length) return;
    const near = (x, y, r, test) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const t = this.tile(x + dx, y + dy); if (t && test(t, x + dx, y + dy)) return true; } return false; };
    const coops = S.buildings.filter(b => b.type === 'galinheiro' && S.animals.some(a => a.home === b.id));
    let damaged = 0, spread = 0, fresh = 0, killed = 0;
    const counts = {};
    for (const [t, x, y] of crops) {
      const c = t.c, fam = D.crops[c.id].fam;
      if (c.protect) c.protect--;
      if (c.pest) {
        const p = D.pests[c.pest];
        // inimigos naturais: com diversidade, flores e galinhas por perto, a praga pode sumir sozinha
        const helpers = (near(x, y, 2, n => n.c && !n.c.dead && (D.crops[n.c.id].companion || D.crops[n.c.id].fam === 'adubo_verde')) ? 1 : 0)
          + (coops.some(b => Math.abs(b.x + 1 - x) <= 6 && Math.abs(b.y + 1 - y) <= 6) ? 1 : 0);
        if (chance(0.1 + helpers * 0.2)) { c.pest = null; continue; }
        c.hp -= p.dmg; damaged++; counts[c.pest] = (counts[c.pest] || 0) + 1;
        if (c.hp <= 0) { c.dead = true; killed++; continue; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.tile(x + dx, y + dy);
          if (n && n.c && !n.c.dead && !n.c.pest && !n.c.protect && p.fams.includes(D.crops[n.c.id].fam) && chance(0.15)) { n.c.pest = c.pest; n.c.newPest = true; spread++; }
        }
        continue;
      }
      if (c.protect || c.newPest || fam === 'adubo_verde' || fam === 'flor') { c.newPest = false; continue; }
      let risk = 0.01 + (c.mono ? 0.05 : 0) + (c.hp < 60 ? 0.03 : 0);
      const fams = new Set();
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const n = this.tile(x + dx, y + dy); if (n && n.c && !n.c.dead) fams.add(D.crops[n.c.id].fam); }
      if (fams.size <= 1) risk += 0.03;                                   // monocultura em volta
      if (fams.size >= 3) risk *= 0.6;                                    // biodiversidade
      if (near(x, y, 2, n => n.c && !n.c.dead && D.crops[n.c.id].companion)) risk *= 0.3;   // cravo-de-defunto
      if (coops.some(b => Math.abs(b.x + 1 - x) <= 6 && Math.abs(b.y + 1 - y) <= 6)) risk *= 0.5;   // galinhas comem insetos
      if (chance(risk)) {
        const opts = Object.keys(D.pests).filter(k => D.pests[k].fams.includes(fam));
        if (opts.length) { c.pest = opts[rnd(0, opts.length - 1)]; fresh++; }
      }
    }
    for (const [t] of crops) if (t.c) t.c.newPest = false;
    const names = Object.entries(counts).map(([k, n]) => `${n} ${D.pests[k].n.toLowerCase()}`).join(', ');
    if (damaged) R.push(`🐛 Pragas atacaram ${damaged} planta(s) (${names})${killed ? `, ${killed} morreram` : ''}. Use calda ou neem, plante cravo e faça rotação.`);
    if (fresh + spread) R.push(`🐛 ${fresh + spread} planta(s) com pragas novas.`);
  },
});
