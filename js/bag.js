// =============================================================
// EcoLand — mochila estilo RuneScape: 28 slots (4 × 7) num painel
// lateral, com baú para o que não couber. Carregar depois de ui.js.
// =============================================================
(() => {
  const SLOTS = 28;
  const $ = s => document.querySelector(s);
  let warned = false, sig = '', dragFrom = null;

  // ---------------- Lógica ----------------
  Object.assign(G, {
    bagInit() {
      S.chest = S.chest || {};
      S.equip = S.equip || { mochila: 'pano' };
      if (!Array.isArray(S.slots) || S.slots.length !== SLOTS) S.slots = (S.slots || []).concat(Array(SLOTS).fill(null)).slice(0, SLOTS);
      this.bagSync();
    },
    freeSlots() { return S.slots.filter(s => !s).length; },
    // mantém slots e inventário coerentes; o que sobrar vai para o baú
    bagSync() {
      if (!S.slots) return;
      for (let i = 0; i < SLOTS; i++) if (S.slots[i] && !(S.inv[S.slots[i]] > 0)) S.slots[i] = null;
      const moved = [];
      for (const id of Object.keys(S.inv)) {
        if (!(S.inv[id] > 0)) { delete S.inv[id]; continue; }
        if (S.slots.includes(id)) continue;
        const free = S.slots.indexOf(null);
        if (free >= 0) S.slots[free] = id;
        else { S.chest[id] = (S.chest[id] || 0) + S.inv[id]; delete S.inv[id]; moved.push(id); if (S.held === id) S.held = null; }
      }
      if (moved.length && !warned) {
        warned = true; setTimeout(() => { warned = false; }, 4000);
        UI.toast(`🎒 Mochila cheia! ${moved.map(k => D.items[k].n).slice(0, 3).join(', ')}${moved.length > 3 ? '…' : ''} foi para o baú da casa.`, 'bad');
      }
    },
    // store = conteúdo de um baú construído (b.data.items) ou o depósito da casa (S.chest)
    chestPut(id, store = S.chest) {
      const n = S.inv[id] || 0; if (!n) return;
      store[id] = (store[id] || 0) + n; delete S.inv[id];
      if (S.held === id) S.held = null;
      this.bagSync(); sfx('pickup');
    },
    chestTake(id, store = S.chest) {
      const n = store[id] || 0; if (!n) return;
      if (!(S.inv[id] > 0) && !this.freeSlots()) { UI.toast('A mochila está cheia (28 slots). Guarde algo no baú primeiro.', 'bad'); sfx('error'); return; }
      const k = n;
      store[id] -= k; if (store[id] <= 0) delete store[id];
      S.inv[id] = (S.inv[id] || 0) + k; this.bagSync(); sfx('pickup');
    },
  });
  const _add = G.add.bind(G), _take = G.take.bind(G);
  G.add = function (id, n = 1, silent) {
    if (S.slots && !(S.inv[id] > 0) && !G.freeSlots()) {
      S.chest[id] = (S.chest[id] || 0) + n;
      if (!warned) { warned = true; setTimeout(() => { warned = false; }, 4000); UI.toast(`🎒 Mochila cheia: ${D.items[id].n} foi para o baú da casa.`, 'bad'); }
      if (id === 'madeira') G.stat('wood', n);
      if (id === 'pedra') G.stat('stone', n);
      return;
    }
    _add(id, n, silent);
    G.bagSync();
  };
  G.take = function (id, n = 1) { const ok = _take(id, n); if (ok && !(S.inv[id] > 0)) G.bagSync(); return ok; };

  // inicia a mochila em jogos novos, carregados e na demonstração (aberta por padrão, ou como o jogador deixou)
  const restoreOpen = () => { let open = true; try { open = localStorage.getItem('ecoland_bag_open') !== '0'; } catch (e) { /* */ } setTimeout(() => { if (document.getElementById('hud').classList.contains('hidden')) return; UI.toggleBag(open); }, 0); };
  for (const fn of ['newGame', 'load']) {
    const orig = G[fn].bind(G);
    G[fn] = function (...a) { const r = orig(...a); if (S && r !== false && S.farmName !== 'preview') { G.bagInit(); restoreOpen(); } else if (S) G.bagInit(); return r; };
  }
  if (G.newDemoWorld) {
    const orig = G.newDemoWorld;
    G.newDemoWorld = function () {
      orig();
      // mochila da demonstração: o essencial à mão, o resto no baú
      const keep = ['racao', 'adubo', 'calda', 'gotejamento', 'cerca', 'ponte', 'painel_solar', 'minhoca', 'cri_milho', 'cri_feijao', 'cri_tomate',
        'sem_crotalaria', 'sem_cravo', 'muda_uva', 'espaldeira', 'esterco', 'madeira', 'pedra', 'ferragens', 'pao', 'feijoada', 'suco_laranja',
        'queijo', 'agua', 'peixe_tambaqui', 'mel', 'charque', 'neem'];
      S.chest = {}; S.slots = Array(SLOTS).fill(null);
      for (const id of Object.keys(S.inv)) if (!keep.includes(id)) { S.chest[id] = S.inv[id]; delete S.inv[id]; }
      keep.forEach((id, i) => { if (S.inv[id] > 0) S.slots[i] = id; });
      // baús espalhados pela fazenda, cada um com a produção do lugar
      const put = (x, y, label, items) => {
        for (let k = 0; k < 6; k++) { if (G.canPlace('bau', x + k, y)) { const b = G.addBuilding('bau', x + k, y); b.data.label = label; b.data.items = items; return; } }
      };
      const lot = id => D.lots.find(l => l.id === id);
      const n = lot('norte'), w = lot('oeste'), ne = lot('ne'), sd = lot('sede');
      put(n.x + 13, n.y + 6, 'Leite do curral', { leite_balde: 18, leite: 12, queijo: 4, esterco: 20 });
      put(w.x + 2, w.y + 15, 'Frutas do pomar', { laranja: 30, manga: 22, banana: 40, acerola: 60, jabuticaba: 80, uva: 35, maracuja: 25, mel: 9 });
      put(ne.x + 8, ne.y + 14, 'Grãos e forragem', { milho: 60, feijao: 45, trigo: 50, capim: 80, mandioca: 30 });
      put(sd.x + 1, sd.y + 6, 'Horta', { alface: 12, tomate: 18, cenoura: 15, pimenta: 20, abobora: 6 });
      G.bagSync(); G.save();
    };
  }

  // baú: construção 1×1 (todos os baús compartilham o mesmo estoque, como um depósito)
  D.buildings.bau = { n: 'Baú', w: 1, h: 1, i: '📦', desc: 'Cada baú guarda as suas próprias coisas: ponha perto do curral, do pomar ou da horta para guardar a produção ali mesmo.' };
  D.items.bau = { n: 'Baú', i: '📦', place: 'bau', sell: 0, cat: 'Construção' };
  D.recipes.splice(1, 0, { out: 'bau', q: 1, in: { madeira: 15, ferragens: 1 }, st: null, cat: 'Construção' });
  const _bi = G.buildingInteract.bind(G);
  G.buildingInteract = function (b) { if (b.type === 'bau') return UI.openChest(b); return _bi(b); };
  const _rm = G.removeBuilding.bind(G);
  G.removeBuilding = function (b) {   // desmontar um baú devolve o conteúdo ao depósito da casa
    if (b.type === 'bau' && b.data.items) for (const [k, n] of Object.entries(b.data.items)) S.chest[k] = (S.chest[k] || 0) + n;
    return _rm(b);
  };

  // ---------------- Interface ----------------
  const ii = id => (window.ITEMICONS && ITEMICONS.html(id)) || `<span class="emo">${D.items[id].i}</span>`;
  const fmtN = n => n >= 100000 ? Math.floor(n / 1000) + 'K' : String(n);
  const info = id => {
    const it = D.items[id], e = it.e;
    return `${it.n} (${S.inv[id] || S.chest[id] || 0})${e ? ` · come: ${e.fome ? '+' + e.fome + '🍖' : ''}${e.sede ? ' +' + e.sede + '💧' : ''}${e.energia ? ' +' + e.energia + '⚡' : ''}` : ''}${it.sell ? ` · vende 💰${it.sell}` : ''}`;
  };

  const bag = document.createElement('div');
  bag.id = 'bag'; bag.className = 'hidden';
  bag.innerHTML = `<div class="bag-head"><span>🎒 Mochila</span><small id="bag-count"></small><button id="bag-chest" title="Abrir o baú (só perto da casa ou de um baú)">📦</button><button id="bag-close" title="Fechar (I)">✖</button></div><div class="bag-grid"></div><div id="bag-tip">Clique: segurar · Botão direito: comer/usar · Arraste para organizar</div>`;
  $('#hud').appendChild(bag);
  const grid = bag.querySelector('.bag-grid');
  bag.querySelector('#bag-close').onclick = () => UI.toggleBag(false);
  bag.querySelector('#bag-chest').onclick = () => {
    // abre o baú mais próximo (ou o depósito da casa)
    const near = S.buildings.filter(b => b.type === 'bau' && Math.hypot(b.x + 0.5 - S.player.x, b.y + 0.5 - S.player.y) <= 2.5)[0];
    UI.openChest(near);
  };

  function render(force) {
    if (!S || !S.slots) return;
    const s = S.slots.map(id => id ? id + ':' + S.inv[id] : '-').join('|') + '#' + S.held;
    if (!force && s === sig) return;
    sig = s;
    grid.innerHTML = S.slots.map((id, i) => `<div class="bslot${id && S.held === id ? ' held' : ''}" data-i="${i}" ${id ? `draggable="true" title="${info(id)}"` : ''}>${id ? ii(id) + (S.inv[id] > 1 ? `<span class="bq">${fmtN(S.inv[id])}</span>` : '') : ''}</div>`).join('');
    $('#bag-count').textContent = `${SLOTS - G.freeSlots()}/${SLOTS}`;
    grid.querySelectorAll('.bslot').forEach(el => {
      const i = +el.dataset.i;
      el.onclick = () => { const id = S.slots[i]; if (!id) return; S.held = id; S.tool = 7; UI.hud(true); render(true); try { SFX.play('ui'); } catch (e) { /* */ } };
      el.oncontextmenu = ev => {
        ev.preventDefault(); const id = S.slots[i]; if (!id) return;
        if (D.items[id].e) G.eat(id); else { S.held = id; S.tool = 7; UI.toast(`Na mão: ${D.items[id].n}. Clique no mapa para usar.`); }
        UI.hud(true); render(true);
      };
      el.ondragstart = ev => { dragFrom = i; ev.dataTransfer.effectAllowed = 'move'; };
      el.ondragover = ev => ev.preventDefault();
      el.ondrop = ev => { ev.preventDefault(); if (dragFrom == null || dragFrom === i) return; [S.slots[dragFrom], S.slots[i]] = [S.slots[i], S.slots[dragFrom]]; dragFrom = null; render(true); };
      el.onmouseenter = () => { const id = S.slots[i]; $('#bag-tip').textContent = id ? info(id) : 'Slot vazio'; };
    });
  }

  UI.toggleBag = open => {
    if (!S) return;
    const show = open == null ? bag.classList.contains('hidden') : open;
    bag.classList.toggle('hidden', !show);
    try { localStorage.setItem('ecoland_bag_open', show ? '1' : '0'); } catch (e) { /* */ }
    document.querySelector('[data-open="inv"]')?.classList.toggle('on', show);
    try { SFX.play(show ? 'open' : 'close'); } catch (e) { /* */ }
    render(true);
  };
  UI.openInventory = () => UI.toggleBag(true);

  // baú (modal): mochila ↔ depósito
  UI.openChest = b => {
    if (!b && !(G.nearStation('casa', 2) || S.creative)) { UI.toast('Vá até a casa ou até um baú para abrir.'); return; }
    const store = b ? (b.data.items = b.data.items || {}) : S.chest;
    const title = b ? (b.data.title || `📦 Baú${b.data.label ? ' — ' + b.data.label : ''}`) : '🏠 Depósito da casa';
    const ids = Object.keys(store).filter(k => store[k] > 0).sort((a, c) => D.items[a].cat.localeCompare(D.items[c].cat));
    UI.show('chest', `<h2>${title}</h2><p><small>Clique num item do baú para levar a pilha para a mochila; clique num item da mochila para guardar. A mochila tem ${SLOTS} slots (${G.freeSlots()} livres).${b ? ' Cada baú tem o seu próprio conteúdo.' : ' O que não cabe na mochila vem para cá.'}</small></p>
      ${b && !b.data.title ? `<div class="row" style="margin:0 0 6px"><input id="chest-label" maxlength="20" placeholder="Nome do baú (ex.: Leite do curral)" value="${(b.data.label || '').replace(/"/g, '&quot;')}" style="flex:1;padding:6px;border:2px solid #c99a5e;border-radius:8px;font-family:inherit"><button class="btn alt" id="chest-all">⬇️ Guardar a produção</button></div>` : ''}
      <div class="chest-cols"><div><h3>🎒 Mochila</h3><div class="inv bag-mini">${S.slots.map(id => `<div class="it ${id ? '' : 'empty'}" data-put="${id || ''}" title="${id ? info(id) : ''}">${id ? ii(id) + `<span class="q">${fmtN(S.inv[id])}</span>` : ''}</div>`).join('')}</div></div>
      <div><h3>📦 Conteúdo (${ids.length} tipos)</h3><div class="inv">${ids.map(id => `<div class="it" data-get="${id}" title="${info(id)}">${ii(id)}<span class="q">${fmtN(store[id])}</span></div>`).join('') || '<p>Vazio.</p>'}</div></div></div>`);
    document.querySelectorAll('#panel [data-put]').forEach(el => el.onclick = () => { if (el.dataset.put) { G.chestPut(el.dataset.put, store); UI.openChest(b); } });
    document.querySelectorAll('#panel [data-get]').forEach(el => el.onclick = () => { G.chestTake(el.dataset.get, store); UI.openChest(b); });
    const lab = document.getElementById('chest-label');
    if (lab) lab.onchange = () => { b.data.label = lab.value.trim(); };
    const all = document.getElementById('chest-all');
    // guarda produção (colheitas, frutas, produtos animais, peixes, carnes) e deixa insumos/sementes/construções na mochila
    if (all) all.onclick = () => { for (const id of S.slots.filter(Boolean)) if (['Colheita', 'Fruta', 'Animal', 'Peixe', 'Carne', 'Subproduto', 'Processado', 'Prato'].includes(D.items[id].cat)) G.chestPut(id, store); UI.openChest(b); };
  };

  // a casa ganha o botão do baú no diálogo de dormir
  const _sleep = UI.sleepDialog;
  UI.sleepDialog = () => {
    _sleep();
    const row = document.querySelector('#s-no')?.parentElement;
    if (row) { const btn = document.createElement('button'); btn.className = 'btn alt'; btn.textContent = '📦 Baú da casa'; btn.onclick = () => UI.openChest(); row.insertBefore(btn, document.querySelector('#s-no')); }
  };

  // atualização contínua junto com o HUD
  const _hud = UI.hud;
  UI.hud = force => { _hud(force); if (S && S.slots && !bag.classList.contains('hidden')) render(false); };
})();
