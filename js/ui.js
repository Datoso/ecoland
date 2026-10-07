// =============================================================
// EcoLand — interface (HUD, barra, painéis, diálogos)
// =============================================================
window.UI = (() => {
  const $ = s => document.querySelector(s);
  const modal = $('#modal'), panel = $('#panel');
  let current = null, frame = 0;
  const ui = {};

  const icon = (id, big) => {
    const it = D.items[id];
    const art = window.ITEMICONS && ITEMICONS.html(id);
    if (art) return art;
    const badge = it.seed ? '<span class="badge">🌱</span>' : it.sapling ? '<span class="badge">🪴</span>' : '';
    return `${it.i}${badge}`;
  };
  const ii = k => (window.ITEMICONS && ITEMICONS.html(k)) || D.items[k].i;
  const fmtIn = r => Object.entries(r.in).map(([k, n]) => `<span title="${D.items[k].n}" style="${G.has(k, n) ? '' : 'color:#c0392b'}">${n}${ii(k)}</span>`).join(' ');
  const play = n => { try { SFX.play(n); } catch (e) { /* */ } };

  // ---------- HUD ----------
  ui.buildHotbar = () => {
    const hb = $('#hotbar');
    hb.innerHTML = D.tools.map((t, i) => `<div class="slot" data-i="${i}" title="${t.n}: ${t.desc}"><span class="k">${i + 1}</span><span class="ic">${ICONS.html(t.id) || t.i}</span><span class="q"></span><span class="badge"></span></div>`).join('');
    hb.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => { S.tool = +el.dataset.i; play('ui'); ui.hud(true); }));
  };

  ui.hud = force => {
    if (!S) return;
    if (!force && frame++ % 8) return;
    const p = S.player;
    const set = (k, v, max) => { const el = document.querySelector(`.bar[data-k=${k}]`); el.querySelector('i').style.width = Math.max(0, v / max * 100) + '%'; el.classList.toggle('low', v / max < 0.2); el.title = `${Math.round(v)}/${max}`; el.querySelector('b').textContent = Math.round(v); };
    set('hp', p.hp, 100); set('energy', p.energy, p.maxEnergy); set('fome', p.fome, 100); set('sede', p.sede, 100); set('water', p.water, p.waterMax);
    $('#c-date').textContent = `${D.SEASON_ICONS[S.season]} ${D.SEASONS[S.season]}, dia ${S.day} · Ano ${S.year}`;
    $('#c-time').textContent = `${S.weather === 'chuva' ? '🌧️' : G.isNight() ? '🌙' : '☀️'} ${G.clock()}`;
    const dayP = Math.min(1, Math.max(0, (S.time - 360) / 1200));
    const sun = $('#c-sun');
    sun.textContent = G.isNight() ? '🌙' : S.weather === 'chuva' ? '🌦️' : '☀️';
    sun.style.left = (6 + dayP * 138) + 'px'; sun.style.top = (26 - Math.sin(dayP * Math.PI) * 18) + 'px';
    const sc = G.ecoScore ? G.ecoScore().total : 0;
    $('#c-eco').innerHTML = `🌍 <b>${sc}%</b> autossuficiente`;
    $('#c-money').innerHTML = S.creative ? '💰 <span class="creative-badge">∞ modo teste</span>' : `💰 ${S.money.toLocaleString('pt-BR')}`;
    document.getElementById('btn-dev').classList.toggle('hidden', !S.creative);
    const q = D.quests[S.quest];
    $('#quest').innerHTML = q ? `<small>📗 Manual · etapa ${S.quest + 1}/${D.quests.length}</small><b>${q.t}</b>${q.goal}<br><small>${G.questProgress(q)}</small>` : '<b>🏆 Fazenda autossuficiente!</b>Continue expandindo seu sistema.';
    document.querySelectorAll('#hotbar .slot').forEach((el, i) => {
      el.classList.toggle('sel', i === S.tool);
      if (D.tools[i].id === 'item') {
        const ic = el.querySelector('.ic'), want = S.held || '_bag';
        if (ic.dataset.v !== want) { ic.dataset.v = want; ic.innerHTML = S.held ? icon(S.held) : ICONS.html('item'); }
        el.querySelector('.q').textContent = S.held ? S.inv[S.held] || '' : '';
        el.querySelector('.badge').textContent = '';
        el.title = S.held ? D.items[S.held].n : 'Item na mão (escolha no inventário)';
      }
      if (D.tools[i].id === 'regador') el.querySelector('.q').textContent = p.water;
      const tinfo = G.toolInfo(D.tools[i].id);
      if (tinfo) {
        const ic = el.querySelector('.ic'), key = (tinfo.icon || D.tools[i].id) + G.toolLvl(D.tools[i].id);
        if (ic.dataset.v !== key) {
          ic.dataset.v = key; ic.innerHTML = ICONS.html(tinfo.icon || D.tools[i].id);
          el.querySelector('.badge').textContent = G.toolLvl(D.tools[i].id) > 1 ? '★'.repeat(G.toolLvl(D.tools[i].id) - 1) : '';
          el.title = `${tinfo.n}${tinfo.desc ? ': ' + tinfo.desc : ''}`;
        }
      }
    });
  };

  ui.hint = text => { $('#hint').innerHTML = text || ''; };

  ui.ii = ii;
  ui.toast = (msg, type) => {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = msg;
    const box = $('#toasts');
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), type === 'good' ? 5000 : 3200);
  };

  // ---------- modal ----------
  ui.isOpen = () => !modal.classList.contains('hidden');
  ui.show = (name, html) => {
    current = name;
    panel.innerHTML = `<button class="close" title="Fechar (Esc)">✖</button>` + html;
    panel.querySelector('.close').onclick = ui.close;
    if (modal.classList.contains('hidden')) play('open');
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    G.paused = true;
  };
  ui.close = () => {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden'); document.body.classList.remove('modal-open'); current = null; G.paused = false; play('close');
    ui.hud(true);
  };
  modal.addEventListener('mousedown', e => { if (e.target === modal) ui.close(); });

  ui.confirm = (msg, yes) => {
    ui.show('confirm', `<h2>Confirmar</h2><p>${msg}</p><div class="row"><button class="btn" id="c-yes">Sim</button><button class="btn alt" id="c-no">Não</button></div>`);
    $('#c-yes').onclick = () => { ui.close(); yes(); };
    $('#c-no').onclick = ui.close;
  };

  // ---------- inventário ----------
  ui.openInventory = () => {
    const ids = Object.keys(S.inv).filter(k => S.inv[k] > 0);
    const cats = [...new Set(ids.map(k => D.items[k].cat))];
    const sections = cats.map(c => `<h3>${c}</h3><div class="inv">${ids.filter(k => D.items[k].cat === c).map(k =>
      `<div class="it ${S.held === k ? 'held' : ''}" data-id="${k}" title="${D.items[k].n}">${icon(k)}<span class="q">${S.inv[k]}</span></div>`).join('')}</div>`).join('');
    ui.show('inv', `<h2>🎒 Inventário</h2><p><small>Clique para segurar o item (slot 8). Itens na mão: sementes plantam, construções são posicionadas, comida pode ser comida (F).</small></p>
      ${sections || '<p>Vazio.</p>'}<div id="inv-info">Passe o mouse sobre um item.</div>`);
    panel.querySelectorAll('.it').forEach(el => {
      const id = el.dataset.id, it = D.items[id];
      el.onmouseenter = () => {
        const e = it.e ? ` · Come: ${it.e.fome ? '+' + it.e.fome + '🍖 ' : ''}${it.e.sede ? '+' + it.e.sede + '💧 ' : ''}${it.e.energia ? '+' + it.e.energia + '⚡' : ''}` : '';
        const extra = it.seed ? ` · ${D.crops[it.seed].days} dias · épocas: ${D.crops[it.seed].seasons.map(s => D.SEASONS[s]).join(', ')}` :
          it.sapling ? ` · frutifica: ${D.fruits[it.sapling].seasons.map(s => D.SEASONS[s]).join(', ')}` :
          it.place ? ` · ${D.buildings[it.place].desc || ''}` : '';
        $('#inv-info').innerHTML = `<b>${ii(id)} ${it.n}</b> (${S.inv[id]}) · venda 💰${it.sell || '—'}${e}${it.feed ? ` · alimento animal: ${it.feed}` : ''}${it.organic ? ' · compostável' : ''}${extra}`;
      };
      el.onclick = () => { S.held = id; S.tool = 7; play('ui'); ui.close(); };
      el.oncontextmenu = ev => { ev.preventDefault(); if (it.e) { G.eat(id); ui.openInventory(); } };
    });
  };

  // ---------- criação ----------
  let craftTab = 'Construção';
  ui.openCraft = tab => {
    if (tab) craftTab = tab;
    const tabs = [...new Set(D.recipes.map(r => r.cat))];
    const list = D.recipes.filter(r => r.cat === craftTab);
    ui.show('craft', `<h2>🔨 Criação</h2><div class="tabs">${tabs.map(t => `<button data-t="${t}" class="${t === craftTab ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="grid">${list.map((r, i) => {
        const it = D.items[r.out], ok = G.canCraft(r), near = G.nearStation(r.st);
        return `<div class="card ${ok ? '' : 'off'}"><div class="ic">${icon(r.out)}</div><div class="info"><b>${it.n}${r.q > 1 ? ' ×' + r.q : ''}</b>${fmtIn(r)}
          <small>${r.st ? (near ? `✔ perto do(a) ${D.buildings[r.st].n}` : `✘ precisa estar perto de: ${D.buildings[r.st].n}`) : (it.place ? D.buildings[it.place].desc : it.e ? `+${it.e.fome || 0}🍖 +${it.e.sede || 0}💧 +${it.e.energia || 0}⚡` : '')}</small></div>
          <button data-r="${D.recipes.indexOf(r)}" ${ok ? '' : 'disabled'}>Criar</button></div>`;
      }).join('')}</div>`);
    panel.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { play('ui'); ui.openCraft(b.dataset.t); });
    panel.querySelectorAll('.card button').forEach(b => b.onclick = () => {
      const r = D.recipes[+b.dataset.r];
      if (G.craft(r)) { if (D.items[r.out].place) { S.held = r.out; S.tool = 7; ui.close(); ui.toast(`${D.items[r.out].n} na mão! Clique no chão para posicionar.`); } else ui.openCraft(); }
    });
  };

  // ---------- loja ----------
  let shopTab = 'Sementes', shopMode = 'buy';
  ui.openShop = (tab, mode) => {
    if (tab) shopTab = tab; if (mode) shopMode = mode;
    let body;
    if (shopMode === 'buy') {
      const tabs = [...new Set(D.shop.map(e => e.tab))];
      const list = D.shop.filter(e => e.tab === shopTab);
      body = `<div class="tabs">${tabs.map(t => `<button data-t="${t}" class="${t === shopTab ? 'on' : ''}">${t}</button>`).join('')}</div><div class="grid">${list.map(e => {
        const idx = D.shop.indexOf(e);
        let ic, name, sub = '', dis = S.money < e.price;
        if (e.animal) {
          const a = D.animals[e.animal]; ic = a.bi; name = a.baby + ` (${a.n})`;
          const home = G.homeWithSpace(e.animal);
          sub = `${home ? '✔ há vaga' : `✘ precisa de ${G.homeNames(e.animal)} com vaga`} · adulto em ${a.adult} dias · come ${a.eat}/dia${a.grazer ? ' (pasta)' : ''}`;
          dis = dis || !home;
        } else if (e.tool) {
          ic = ICONS.html(D.toolLevels[e.tool][e.level - 1].icon || e.tool); name = e.n;
          const cur = G.toolLvl(e.tool);
          sub = e.desc + (cur >= e.level ? ' · <b>✔ você já tem</b>' : cur < e.level - 1 ? ` · precisa antes: ${D.toolLevels[e.tool][e.level - 2].n}` : '');
          dis = dis || cur !== e.level - 1;
        } else if (e.upgrade) {
          ic = e.i; name = e.n; sub = e.desc; if (S.upgrades[e.upgrade]) { dis = true; sub = '✔ já comprado'; }
        } else {
          const it = D.items[e.id]; ic = icon(e.id); name = it.n;
          if (it.seed) { const c = D.crops[it.seed]; const inS = c.seasons.includes(S.season); sub = `${c.days} dias · ${c.seasons.map(s => D.SEASONS[s]).join(', ')}${inS ? '' : ' · <b style="color:#c0392b">fora de época</b>'}${c.regrow ? ' · rebrota' : ''}`; }
          else if (it.sapling) { const f = D.fruits[it.sapling]; sub = `produz em ${f.mature} dias · ${f.seasons.map(s => D.SEASONS[s]).join(', ')}`; }
          else if (it.e) sub = `+${it.e.fome || 0}🍖 +${it.e.sede || 0}💧 +${it.e.energia || 0}⚡`;
          else if (it.feed) sub = `alimento animal: ${it.feed} un.`;
        }
        const multi = !e.upgrade && !e.tool;
        return `<div class="card ${dis ? 'off' : ''}"><div class="ic">${ic}</div><div class="info"><b>${name}</b>💰 ${e.price}<small>${sub}</small></div>
          <div style="display:flex;flex-direction:column;gap:3px"><button data-b="${idx}" data-q="1" ${dis ? 'disabled' : ''}>Comprar</button>${multi ? `<button data-b="${idx}" data-q="5" ${S.money < e.price * 5 ? 'disabled' : ''}>×5</button>` : ''}</div></div>`;
      }).join('')}</div>`;
    } else {
      const ids = Object.keys(S.inv).filter(k => S.inv[k] > 0 && D.items[k].sell > 0);
      body = `<div class="grid">${ids.map(k => { const it = D.items[k]; return `<div class="card"><div class="ic">${icon(k)}</div><div class="info"><b>${it.n}</b>Você tem ${S.inv[k]} · 💰 ${it.sell} cada</div>
        <div style="display:flex;flex-direction:column;gap:3px"><button data-s="${k}" data-q="1">Vender 1</button><button data-s="${k}" data-q="999">Tudo</button></div></div>`; }).join('') || '<p>Nada para vender.</p>'}</div>`;
    }
    ui.show('shop', `<h2>🏪 Agropecuária & Materiais</h2><p><small>Ferramentas modernas, sementes, materiais de construção e animais. Você tem <b>💰 ${S.money.toLocaleString('pt-BR')}</b>.</small></p>
      <div class="tabs"><button data-m="buy" class="${shopMode === 'buy' ? 'on' : ''}">🛒 Comprar</button><button data-m="sell" class="${shopMode === 'sell' ? 'on' : ''}">💰 Vender</button></div>${body}`);
    panel.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { play('ui'); ui.openShop(null, b.dataset.m); });
    panel.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { play('ui'); ui.openShop(b.dataset.t); });
    panel.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { if (G.buy(D.shop[+b.dataset.b], +b.dataset.q)) ui.openShop(); });
    panel.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { G.sell(b.dataset.s, +b.dataset.q); ui.openShop(); });
  };

  // ---------- construções (info, animais e evolução) ----------
  const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  ui.openBuilding = b => {
    const def = D.buildings[b.type], L = G.lvl(b), lv = b.level || 1, nx = G.nextLevel(b);
    const list = S.animals.filter(a => a.home === b.id);
    const info = [];
    if (def.houses) info.push(`🏠 ${list.length}/${G.cap(b)} animais`);
    if (G.feedCap(b)) info.push(`🍽️ alimento: ${b.data.feed || 0}/${G.feedCap(b)} (segure ração, grãos ou capim e interaja)`);
    if (def.houses && !G.perk(b, 'feeder')) info.push(`🍽️ os animais comem dos cochos e silos (${S.buildings.filter(x => x.type === 'cocho' || x.type === 'silo').reduce((s, x) => s + (x.data.feed || 0), 0)} un.)`);
    if (b.data.manure != null && def.houses) info.push(`💩 esterco acumulado: ${Math.floor(b.data.manure)}`);
    if (b.type === 'composteira') info.push(`♻️ carga ${b.data.load}/${L.per} · ${b.data.batches.length} lote(s) compostando · adubo em ${L.days} noite(s)`);
    if (b.type === 'colmeia') info.push(S.season === 3 ? '❄️ abelhas recolhidas no inverno' : `🍯 mel a cada ${L.every} dia(s) · próximo em ${Math.max(0, L.every - b.data.t)} dia(s)`);
    if (b.type === 'aspersor') info.push(`💦 ${L.desc}, toda manhã`);
    if (b.type === 'cisterna') info.push(`🛢️ ${Math.round(b.data.water || 0)} / ${L.store} L · enche com chuva e com bombas · interaja para beber e encher o regador`);
    if (b.type === 'roda_dagua' || b.type === 'catavento') { const on = G.pumps().includes(b); info.push(on ? `💧 bombeando: rega ${D.buildings[b.type].pump} canteiros com gotejamento e manda ${D.buildings[b.type].fill} L/dia para as cisternas${D.buildings[b.type].kwh ? ` · ⚡ ${D.buildings[b.type].kwh} kWh/dia` : ''}` : (b.type === 'roda_dagua' ? '⚠️ precisa ficar encostada na água' : '⚠️ precisa de um poço ou lago a até 5 tiles')); }
    if (b.type === 'biodigestor') info.push(`🫧 biogás ${Math.round(b.data.gas || 0)} / ${L.gasCap} m³ · esterco na fila: ${Math.round(b.data.load || 0)} · processa ${L.rate}/dia${L.kwh ? ` · ⚡ gera ${L.kwh} kWh/dia` : ''} · segure esterco e interaja para abastecer`);
    if (b.type === 'painel_solar') info.push(`☀️ ${L.kwh} kWh por dia de sol (¼ na chuva)`);
    if (b.type === 'fogao_biogas') info.push(G.gasAvailable() ? '🔥 com biogás: as receitas da fogueira não gastam lenha' : '⚠️ sem biogás no biodigestor');
    const perks = { feeder: '🍽️ comedouro embutido', auto: '🤖 coleta automática', comfort: '💧 bebedouro/conforto (+felicidade, +reprodução)', biogas: '🔥 biodigestor (esterco em dobro)', aquaponia: '🌱 aquaponia (rega e aduba canteiros próximos)' };
    const pk = (L.perks || []).map(p => perks[p]).filter(Boolean);
    const animals = def.houses ? `<h3>Animais</h3><div class="grid">${list.map(a => { const ad = D.animals[a.type], adult = a.age >= ad.adult; return `<div class="card"><div class="ic">${adult ? ad.i : ad.bi}</div><div class="info"><b>${a.name}</b>${adult ? ad.n : ad.baby} · ${a.age} dias${adult ? '' : ` (adulto em ${ad.adult - a.age})`}
        <small>❤️ ${Math.round(a.happy)}% ${a.hungry ? '· ⚠️ com fome há ' + a.hungry + ' dia(s)' : '· alimentado'}${a.ready ? ' · produto pronto!' : ''}</small></div></div>`; }).join('') || `<p>Nenhum animal. Compre ${def.houses.map(h => D.animals[h].baby.toLowerCase() + 's').join(', ')} na loja.</p>`}</div>` : '';
    const fishBtn = b.type === 'tanque' ? `<button class="btn" id="b-fish">🎣 Despescar adultos (${list.filter(a => a.age >= D.animals[a.type].adult).length})</button>` : '';
    const up = nx ? `<div class="card" style="margin-top:12px"><div class="ic">🏗️</div><div class="info"><b>Evoluir para: ${nx.n} ${stars(lv + 1)}</b>${nx.desc || ''}<small>💰 ${nx.cost.toLocaleString('pt-BR')}${S.creative ? ' (grátis no modo teste)' : ''}</small></div>
        <button id="b-up" ${S.creative || S.money >= nx.cost ? '' : 'disabled'}>Evoluir</button></div>` : '<p><small>✅ Nível máximo.</small></p>';
    ui.show('building', `<h2>${def.i || '🏠'} ${G.bname(b)} <small style="color:#c99320">${stars(lv)}</small></h2>
      <p><small>${def.desc || ''}</small></p>
      <p>${info.join('<br>')}${pk.length ? '<br>' + pk.join(' · ') : ''}</p>
      <div class="row">${fishBtn}</div>${animals}${up}`);
    const ub = panel.querySelector('#b-up'); if (ub) ub.onclick = () => { if (G.upgrade(b)) ui.openBuilding(b); };
    const fb = panel.querySelector('#b-fish'); if (fb) fb.onclick = () => { G.harvestFish(b); ui.openBuilding(b); };
  };
  ui.openAnimals = ui.openBuilding;

  // ---------- banco de sementes ----------
  ui.openSeedBank = b => {
    const L = G.lvl(b), lv = b.level || 1, nx = G.nextLevel(b);
    const gens = g => g ? '🌱'.repeat(g) + '<span style="opacity:.25">' + '🌱'.repeat(5 - g) + '</span>' : '<small>nenhuma geração ainda</small>';
    const cards = Object.keys(D.crops).map(id => {
      const c = D.crops[id], bank = S.seedBank[id] || {}, have = S.inv[id] || 0, per = D.seedSave[id] + (L.bonus || 0);
      const next = bank.fresh ? Math.min(5, Math.max(bank.gen || 0, bank.fresh + (L.genStep || 1))) : 0;
      return `<div class="card ${have ? '' : 'off'}"><div class="ic">${icon('cri_' + id)}</div><div class="info"><b>${c.n}</b>${gens(bank.gen || 0)}
        <small>1 ${c.n.toLowerCase()} → ${per} semente(s) · você tem ${have} colhido(s) · ${S.inv['cri_' + id] || 0} crioula(s) guardada(s)${next > (bank.gen || 0) ? ` · <b style="color:#2d7a1f">próxima separação: geração ${next}!</b>` : ''}</small></div>
        <div style="display:flex;flex-direction:column;gap:3px"><button data-s="${id}" data-q="1" ${have ? '' : 'disabled'}>Separar 1</button><button data-s="${id}" data-q="999" ${have > 1 ? '' : 'disabled'}>Tudo</button></div></div>`;
    }).join('');
    const up = nx ? `<div class="card" style="margin-top:12px"><div class="ic">🏗️</div><div class="info"><b>Evoluir para: ${nx.n} ${stars(lv + 1)}</b>${nx.desc || ''}<small>💰 ${nx.cost.toLocaleString('pt-BR')}${S.creative ? ' (grátis no modo teste)' : ''}</small></div>
        <button id="b-up" ${S.creative || S.money >= nx.cost ? '' : 'disabled'}>Evoluir</button></div>` : '';
    ui.show('seedbank', `<h2>🫙 ${G.bname(b)} <small style="color:#c99320">${stars(lv)}</small></h2>
      <p><small>Separe sementes da sua colheita. Plantando a semente crioula, colhendo e guardando de novo, a variedade ganha uma <b>geração</b> (até 5):
      cada geração deixa a planta mais <b>resistente à seca</b> e com mais chance de <b>colheita extra</b>. Sementes da loja não evoluem.</small></p>
      <div class="grid">${cards}</div>${up}`);
    panel.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { G.saveSeeds(b, el.dataset.s, +el.dataset.q); ui.openSeedBank(b); });
    const ub = panel.querySelector('#b-up'); if (ub) ub.onclick = () => { if (G.upgrade(b)) ui.openSeedBank(b); };
  };

  // ---------- placar de autossuficiência ----------
  ui.openEco = () => {
    const sc = G.ecoScore(), e = S.eco;
    const bar = (icon, name, v, detail, tip) => `<div class="eco-row"><div class="eco-h"><b>${icon} ${name}</b><span>${v}%</span></div>
      <div class="eco-bar"><i style="width:${v}%;background:${v >= 70 ? '#4f9a3a' : v >= 40 ? '#e8b33c' : '#d9534f'}"></i></div><small>${detail}${v < 70 ? ` · 💡 ${tip}` : ''}</small></div>`;
    const hist = (e.history || []).slice(-14);
    const spark = hist.length > 1 ? `<svg viewBox="0 0 ${(hist.length - 1) * 20} 40" class="eco-spark" preserveAspectRatio="none"><polyline fill="none" stroke="#4f9a3a" stroke-width="3" points="${hist.map((v, i) => `${i * 20},${40 - v * 0.38}`).join(' ')}"/></svg>` : '<small>O histórico aparece depois de algumas noites.</small>';
    ui.show('eco', `<h2>📊 Autossuficiência da fazenda</h2>
      <div class="eco-total"><span>${sc.total}%</span><div><b>${sc.total >= 80 ? '🏆 Fazenda autossuficiente!' : sc.total >= 50 ? '🌱 No caminho certo' : '🧭 Começando a jornada'}</b><br><small>Média dos cinco pilares, atualizada toda noite.</small>${spark}</div></div>
      ${bar('🍲', 'Comida', sc.food, `${sc.food}% do que você comeu foi produzido na fazenda`, 'cozinhe o que você colhe e cria em vez de comprar marmita')}
      ${bar('💧', 'Água', sc.water, `fontes próprias cobrem ${sc.water}% da demanda (lavoura, animais e casa)`, 'construa poço, cisterna, roda d\'água ou cata-vento')}
      ${bar('⚡', 'Energia', sc.energy, `gerou ${Math.round(e.kwhGen)} kWh de ${Math.round(e.kwhUse)} kWh usados${e.kwhBought ? ` · ${Math.round(e.kwhBought)} kWh comprados da rede` : ''}${e.gasCook ? ` · ${Math.round(e.gasCook)} receitas no biogás` : ''}`, 'painéis solares, roda d\'água e biodigestor')}
      ${bar('🌾', 'Ração animal', sc.feed, S.animals.length ? `${sc.feed}% do alimento dos animais veio da fazenda (pasto, grãos, capim, ração do moinho)` : 'sem animais ainda', 'pasto, capineira e ração feita no moinho')}
      ${bar('🌱', 'Sementes', sc.seeds, `${sc.seeds}% do que você plantou foi semente crioula do seu banco`, 'separe sementes da colheita no Banco de Sementes')}`);
  };

  // ---------- painel dev (modo teste) ----------
  ui.openDev = () => {
    if (!S.creative) { ui.toast('Ligue o modo teste no menu ⚙️.'); return; }
    const B = (id, label) => `<button class="btn alt" data-d="${id}">${label}</button>`;
    ui.show('dev', `<h2>🧪 Painel de testes</h2><p><small>Ferramentas para testar o jogo. Em cima de cada planta aparecem os dias que faltam e a saúde.</small></p>
      <h3>⏰ Tempo</h3><div class="row">${B('h1', '+1 hora')}${B('h6', '+6 horas')}${B('day', '⏭️ Pular para o próximo dia')}${B('season', '🍂 Próxima estação')}${B('rain', '🌧️ Liga/desliga chuva')}</div>
      <h3>🌱 Plantas</h3><div class="row">${B('grow', '+1 dia de crescimento')}${B('grow3', '+3 dias')}${B('ripen', '✨ Amadurecer tudo')}${B('water', '💧 Regar tudo')}${B('heal', '❤️ Curar plantas')}</div>
      <h3>🐔 Animais</h3><div class="row">${B('age1', '+1 dia de idade')}${B('age5', '+5 dias')}</div>
      <h3>🎒 Recursos</h3><div class="row">${B('stats', '❤️ Encher status')}${B('mat', '🪵 +Materiais e ração')}${B('seeds', '🌱 +Sementes e mudas')}${B('lots', '🗺️ Liberar todas as terras')}</div>
      <p><small>Hoje: ${D.SEASONS[S.season]}, dia ${S.day} · ${G.clock()} · ${S.weather === 'chuva' ? 'chuva' : 'sol'} · ${G.countCrops()} cultivos · ${S.animals.length} animais</small></p>`);
    const act = { h1: () => G.dev.hours(1), h6: () => G.dev.hours(6), day: () => { ui.close(); G.dev.skipDay(); return true; }, season: () => G.dev.season(), rain: () => G.dev.rain(),
      grow: () => G.dev.grow(1), grow3: () => G.dev.grow(3), ripen: () => G.dev.ripen(), water: () => G.dev.waterAll(), heal: () => G.dev.healAll(),
      age1: () => G.dev.ageAnimals(1), age5: () => G.dev.ageAnimals(5), stats: () => G.dev.fillStats(), mat: () => G.dev.materials(), seeds: () => G.dev.seeds(), lots: () => G.dev.allLots() };
    panel.querySelectorAll('[data-d]').forEach(el => el.onclick = () => { play('ui'); if (!act[el.dataset.d]()) { ui.toast('✔ ' + el.textContent); ui.openDev(); } });
  };

  // ---------- manual ----------
  ui.openManual = () => {
    ui.show('manual', `<h2>📗 Manual da Autossuficiência</h2><p><small>Siga as etapas para transformar sua terra em um sistema integrado: lavoura, criação e floresta se alimentando mutuamente.</small></p>
      <ul class="quest-list">${D.quests.map((q, i) => {
        const cls = i < S.quest ? 'done' : i === S.quest ? 'cur' : 'lock';
        const rew = [q.reward.money ? `💰${q.reward.money}` : '', ...Object.entries(q.reward.items || {}).map(([k, n]) => `${n}${ii(k)}`)].join(' ');
        return `<li class="${cls}"><b>${i < S.quest ? '✅' : i === S.quest ? '▶️' : '🔒'} ${i + 1}. ${q.t}</b> — ${q.goal} <small>(${rew})</small>
          ${i <= S.quest ? `<p>${q.txt}</p>` : ''}${i === S.quest ? `<p><b>Progresso:</b> ${G.questProgress(q)}</p>` : ''}</li>`;
      }).join('')}</ul>
      <h3>🔄 O ciclo da fazenda</h3>
      <p style="font-size:14px">🌿 Capim & restos → 🐄 animais → 💩 esterco → ♻️ composteira → 🟫 adubo → 🌱 lavoura mais rápida → 🌽 grãos → ⚙️ moinho → 🌰 ração → 🐔 animais...<br>
      🐝 Colmeias polinizam plantas e pomares num raio de 6 tiles · 🦴 ossos viram adubo no moinho · 🌳 a mata se regenera aos poucos — corte com manejo.</p>`);
  };

  // ---------- terras ----------
  ui.openLands = () => {
    ui.show('lands', `<h2>🗺️ Terras</h2><canvas class="minimap" width="640" height="480"></canvas>
      <div class="grid" style="margin-top:10px">${D.lots.map(l => {
        const own = S.lots[l.id], adj = G.lotAdjacent(l);
        const bio = { sede: '🏡 sede', pasto: '🌾 pasto aberto', mata: '🌳 mata densa', cerrado: '🪨 cerrado pedregoso', lago: '💧 lago e várzea' }[l.biome];
        return `<div class="card ${own ? '' : 'off'}"><div class="info"><b>${own ? '✅' : '🔒'} ${l.n}</b>${bio} · ${l.w}×${l.h}<small>${own ? 'Sua terra' : adj ? `💰 ${l.cost}` : 'Compre um lote vizinho primeiro'}</small></div>
          ${own ? '' : `<button data-l="${l.id}" ${adj && S.money >= l.cost ? '' : 'disabled'}>Comprar</button>`}</div>`;
      }).join('')}</div>`);
    R.minimap(panel.querySelector('canvas'));
    panel.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { if (G.buyLot(D.lots.find(l => l.id === b.dataset.l))) ui.openLands(); });
  };

  // ---------- diálogos ----------
  ui.sleepDialog = () => {
    ui.show('sleep', `<h2>🛏️ Casa</h2><p>Dormir agora? O dia avança, as plantas regadas crescem e os animais comem do cocho.</p>
      <div class="row"><button class="btn" id="s-yes">😴 Dormir</button><button class="btn alt" id="s-save">💾 Só salvar</button><button class="btn alt" id="s-no">Ainda não</button></div>`);
    $('#s-yes').onclick = () => { modal.classList.add('hidden'); play('sleep'); fadeSleep(() => G.sleep()); };
    $('#s-save').onclick = () => { if (G.save()) ui.toast('Jogo salvo.', 'good'); ui.close(); };
    $('#s-no').onclick = ui.close;
  };

  function fadeSleep(cb) {
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .6s;z-index:35';
    document.body.appendChild(f);
    requestAnimationFrame(() => f.style.opacity = 1);
    setTimeout(() => {
      cb();
      const c = document.createElement('div');
      c.className = 'daycard';
      c.innerHTML = `${D.SEASON_ICONS[S.season]} Dia ${S.day}<small>${D.SEASONS[S.season]} · Ano ${S.year} · ${S.weather === 'chuva' ? '🌧️ chuvoso' : '☀️ ensolarado'}</small>`;
      document.body.appendChild(c);
      setTimeout(() => { f.style.opacity = 0; c.style.transition = 'opacity .6s'; c.style.opacity = 0; setTimeout(() => { f.remove(); c.remove(); }, 700); }, 1100);
    }, 700);
  }
  ui.fade = fadeSleep;

  ui.morning = lines => {
    const fc = S.tomorrow === 'chuva' ? '🌧️ chuva' : '☀️ sol';
    ui.show('morning', `<h2>${D.SEASON_ICONS[S.season]} Dia ${S.day} de ${D.SEASONS[S.season]}</h2>
      <ul class="morning">${lines.map(l => `<li>${l}</li>`).join('') || '<li>Uma noite tranquila.</li>'}</ul>
      <p><small>Previsão para amanhã: ${fc}. Jogo salvo automaticamente.</small></p><div class="row"><button class="btn" id="m-ok">Bom dia! ☀️</button></div>`);
    $('#m-ok').onclick = ui.close;
  };

  ui.victory = () => {
    ui.show('victory', `<h2>🏆 ${S.farmName}: Fazenda Autossuficiente!</h2><p>Você completou o Manual da Autossuficiência. Lavoura, pecuária e floresta agora formam um ecossistema integrado.</p>
      <p>Continue jogando: compre mais terras, aumente o plantel e torne o sistema cada vez mais rico.</p><div class="row"><button class="btn" id="v-ok">Continuar</button></div>`);
    $('#v-ok').onclick = ui.close;
  };

  ui.pause = () => {
    ui.show('pause', `<h2>⚙️ ${S.farmName}</h2>
      <p>Dinheiro ganho com vendas: 💰 ${(S.stats.earned || 0).toLocaleString('pt-BR')} · Animais: ${S.animals.length} · Cultivos: ${G.countCrops()}</p>
      <div class="row"><button class="btn" id="p-save">💾 Salvar</button><button class="btn alt" id="p-creative">🧪 Modo teste: ${S.creative ? 'LIGADO' : 'desligado'}</button><button class="btn alt" id="p-help">❓ Controles</button><button class="btn red" id="p-new">🏠 Salvar e voltar à tela inicial</button></div>
      <div id="p-extra"></div>`);
    $('#p-save').onclick = () => { if (G.save()) ui.toast('Jogo salvo.', 'good'); };
    $('#p-creative').onclick = () => { G.setCreative(!S.creative); ui.pause(); };
    $('#p-help').onclick = () => { $('#p-extra').innerHTML = document.querySelector('.controls p').outerHTML + '<p><small>Dormir salva automaticamente. A loja abre das 7h às 20h. Depois das 2h você desmaia.</small></p>'; };
    $('#p-new').onclick = () => { G.save(); location.reload(); };
  };

  ui.intro = () => {
    ui.show('intro', `<h2>✉️ Uma carta do vô Zé</h2>
      <p><i>"Querido(a) neto(a),<br><br>Se você está lendo isto, a velha terra agora é sua. Ela é grande, mas por enquanto só a sede está cuidada — o resto o mato tomou conta.
      Comece devagar: limpe, are, plante e regue. Depois vêm o fogo, a água limpa, as galinhas, os bichos maiores...<br><br>
      Deixei um <b>Manual da Autossuficiência</b> pra te guiar (tecla J). A loja de materiais fica aqui ao lado da casa: lá você compra o que precisar e vende o que produzir.<br><br>
      Cuide da terra que ela cuida de você.<br>— Vô Zé"</i></p>
      <p><small>Dica: comece com a <b>foice (4)</b> no mato, a <b>enxada (2)</b> na grama, depois segure as sementes (slot 8) e regue com o <b>regador (3)</b>. Coma e beba para não desmaiar!</small></p>
      <div class="row"><button class="btn" id="i-ok">Vamos lá! 🌱</button></div>`);
    $('#i-ok').onclick = ui.close;
  };

  ui.refresh = () => {
    if (current === 'inv') ui.openInventory();
  };

  ui.buildHotbar();
  return ui;
})();
