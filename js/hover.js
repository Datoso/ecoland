// =============================================================
// EcoLand — rótulo ao passar o mouse sobre construções:
// nome, nível (★) e um ⓘ com o resumo da construção.
// =============================================================
(() => {
  const tip = document.createElement('div');
  tip.id = 'btip'; tip.style.display = 'none';
  document.body.appendChild(tip);
  let cur = null, overTip = false, lastKey = '', lastSeen = 0;

  tip.addEventListener('mouseenter', () => { overTip = true; });
  tip.addEventListener('mouseleave', () => { overTip = false; tip.classList.remove('open'); });
  tip.addEventListener('click', e => { if (e.target.closest('.info')) tip.classList.add('open'); else if (cur) UI.openBuilding(cur); });
  tip.addEventListener('mouseover', e => { if (e.target.closest('.info')) tip.classList.add('open'); });

  // resumo curto de cada construção
  function summary(b) {
    const def = D.buildings[b.type], L = G.lvl(b), out = [];
    if (def.desc) out.push(def.desc);
    const list = S.animals.filter(a => a.home === b.id);
    if (def.houses) out.push(`🏠 ${list.length}/${G.cap(b)} animais${list.length ? ' · ' + Object.entries(list.reduce((m, a) => (m[a.type] = (m[a.type] || 0) + 1, m), {})).map(([t, n]) => `${n} ${D.animals[t].n.toLowerCase()}`).join(', ') : ''}`);
    if (G.feedCap(b)) out.push(`🍽️ alimento ${b.data.feed || 0}/${G.feedCap(b)}`);
    const store = Object.entries(b.data.store || {}).filter(([, n]) => n > 0);
    if (store.length) out.push(`🧺 pronto para coletar: ${store.map(([k, n]) => `${n} ${D.items[k].n.toLowerCase()}`).join(', ')}`);
    if (def.houses && b.data.manure >= 1) out.push(`💩 esterco: ${Math.floor(b.data.manure)}`);
    if (b.type === 'composteira') out.push(`♻️ carga ${b.data.load}/${L.per} · ${b.data.batches.length} lote(s) · adubo pronto: ${b.data.ready}`);
    if (b.type === 'colmeia') out.push(`🍯 mel pronto: ${b.data.mel} · a cada ${L.every} dia(s)`);
    if (b.type === 'cisterna') out.push(`🛢️ ${Math.round(b.data.water || 0)} / ${L.store} L`);
    if (b.type === 'biodigestor') out.push(`🫧 biogás ${Math.round(b.data.gas || 0)} / ${L.gasCap} m³ · biofertilizante: ${b.data.ready || 0}`);
    if (b.type === 'painel_solar') out.push(`☀️ ${L.kwh} kWh por dia de sol`);
    if (b.type === 'roda_dagua' || b.type === 'catavento') out.push(G.pumps().includes(b) ? '💧 bombeando água' : '⚠️ sem fonte de água por perto');
    if (b.type === 'aspersor') out.push(`💦 ${L.desc}`);
    if (b.type === 'casa') out.push(`☀️ ${b.data.panels || 0}/${def.roofPanels} painéis no telhado · E para dormir e abrir o baú`);
    if (b.type === 'loja') out.push(`🕖 aberta das 7h às 20h · ${S.time >= 420 && S.time < 1200 ? 'aberta agora' : 'fechada agora'}`);
    if (b.type === 'banco_sementes') out.push(`🌱 ${Object.keys(S.seedBank || {}).length} variedade(s) crioula(s) guardada(s)`);
    const nx = G.nextLevel && G.nextLevel(b);
    if (nx) out.push(`🏗️ próximo nível: ${nx.n} (💰 ${nx.cost.toLocaleString('pt-BR')})`);
    out.push('<i>E para interagir · duplo clique: informações e evolução</i>');
    return out.join('<br>');
  }

  function update() {
    requestAnimationFrame(update);
    const run = window.INPUT && INPUT.isRunning() && S && !UI.isOpen() && !S.indoors;
    if (!run) { tip.style.display = 'none'; cur = null; return; }
    if (!overTip) {
      let found = null;
      const m = INPUT.mouse;
      if (m.moved) {
        const w = R.screenToWorld(m.x, m.y), t = G.tile(Math.floor(w.x), Math.floor(w.y));
        if (t && t.o && t.o.t === 'b') found = G.getBuilding(t.o.id);
      }
      // ao sair da construção, o rótulo espera um pouco para dar tempo de alcançar o ⓘ
      if (found) { cur = found; lastSeen = performance.now(); }
      else if (performance.now() - lastSeen > 700) cur = null;
    }
    if (!cur || !G.getBuilding(cur.id)) { tip.style.display = 'none'; tip.classList.remove('open'); cur = null; return; }
    const def = D.buildings[cur.type], lv = cur.level || 1, hasLv = !!def.levels;
    const key = cur.id + ':' + lv + ':' + G.bname(cur);
    if (key !== lastKey) {
      lastKey = key;
      tip.innerHTML = `<div class="sum"></div><div class="hd">${def.i ? def.i + ' ' : ''}${G.bname(cur)}${hasLv ? `<span class="lv">${'★'.repeat(lv)}${'☆'.repeat(def.levels.length - lv)}</span>` : ''}<span class="info" title="Resumo">i</span></div>`;
    }
    if (tip.classList.contains('open')) tip.querySelector('.sum').innerHTML = summary(cur);
    const p = R.worldToScreen(cur.x + G.dims(cur).w / 2, cur.y);
    tip.style.left = p.x + 'px';
    tip.style.top = Math.max(60, p.y + 14) + 'px';   // encosta na construção: o mouse chega ao rótulo sem sair dela
    tip.style.display = 'block';
  }
  requestAnimationFrame(update);
})();
