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
    chestPut(id) {
      const n = S.inv[id] || 0; if (!n) return;
      S.chest[id] = (S.chest[id] || 0) + n; delete S.inv[id];
      if (S.held === id) S.held = null;
      this.bagSync(); sfx('pickup');
    },
    chestTake(id, all = true) {
      const n = S.chest[id] || 0; if (!n) return;
      if (!(S.inv[id] > 0) && !this.freeSlots()) { UI.toast('A mochila está cheia (28 slots). Guarde algo no baú primeiro.', 'bad'); sfx('error'); return; }
      const k = all ? n : 1;
      S.chest[id] -= k; if (S.chest[id] <= 0) delete S.chest[id];
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
      G.bagSync(); G.save();
    };
  }

  // baú: construção 1×1 (todos os baús compartilham o mesmo estoque, como um depósito)
  D.buildings.bau = { n: 'Baú', w: 1, h: 1, i: '📦', desc: 'Guarda itens que não cabem na mochila. Todos os baús e a casa acessam o mesmo depósito.' };
  D.items.bau = { n: 'Baú', i: '📦', place: 'bau', sell: 0, cat: 'Construção' };
  D.recipes.splice(1, 0, { out: 'bau', q: 1, in: { madeira: 15, ferragens: 1 }, st: null, cat: 'Construção' });
  const _bi = G.buildingInteract.bind(G);
  G.buildingInteract = function (b) { if (b.type === 'bau') return UI.openChest(); return _bi(b); };

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
  bag.querySelector('#bag-chest').onclick = () => UI.openChest();

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
  const nearChest = () => G.nearStation('bau', 2) || G.nearStation('casa', 2) || S.creative;
  UI.openChest = () => {
    if (!nearChest()) { UI.toast('Vá até a casa ou até um baú para acessar o depósito.'); return; }
    const ids = Object.keys(S.chest).filter(k => S.chest[k] > 0).sort((a, b) => D.items[a].cat.localeCompare(D.items[b].cat));
    UI.show('chest', `<h2>📦 Baú</h2><p><small>Clique num item do baú para levar a pilha para a mochila; clique num item da mochila para guardar. A mochila tem ${SLOTS} slots (${G.freeSlots()} livres).</small></p>
      <div class="chest-cols"><div><h3>🎒 Mochila</h3><div class="inv bag-mini">${S.slots.map(id => `<div class="it ${id ? '' : 'empty'}" data-put="${id || ''}" title="${id ? info(id) : ''}">${id ? ii(id) + `<span class="q">${fmtN(S.inv[id])}</span>` : ''}</div>`).join('')}</div></div>
      <div><h3>📦 Baú (${ids.length} tipos)</h3><div class="inv">${ids.map(id => `<div class="it" data-get="${id}" title="${info(id)}">${ii(id)}<span class="q">${fmtN(S.chest[id])}</span></div>`).join('') || '<p>Vazio.</p>'}</div></div></div>`);
    document.querySelectorAll('#panel [data-put]').forEach(el => el.onclick = () => { if (el.dataset.put) { G.chestPut(el.dataset.put); UI.openChest(); } });
    document.querySelectorAll('#panel [data-get]').forEach(el => el.onclick = () => { G.chestTake(el.dataset.get); UI.openChest(); });
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
