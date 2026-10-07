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
  const fmtIn = r => Object.entries(r.in).map(([k, n]) => `<span title="${D.items[k].n}" style="${G.has(k, n) ? '' : 'color:#c0392b'}">${n}${D.items[k].i}</span>`).join(' ');
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
    });
  };

  ui.hint = text => { $('#hint').innerHTML = text || ''; };

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
    G.paused = true;
  };
  ui.close = () => {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden'); current = null; G.paused = false; play('close');
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
        $('#inv-info').innerHTML = `<b>${it.i} ${it.n}</b> (${S.inv[id]}) · venda 💰${it.sell || '—'}${e}${it.feed ? ` · alimento animal: ${it.feed}` : ''}${it.organic ? ' · compostável' : ''}${extra}`;
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
        } else if (e.upgrade) {
          ic = e.i; name = e.n; sub = e.desc; if (S.upgrades[e.upgrade]) { dis = true; sub = '✔ já comprado'; }
        } else {
          const it = D.items[e.id]; ic = icon(e.id); name = it.n;
          if (it.seed) { const c = D.crops[it.seed]; const inS = c.seasons.includes(S.season); sub = `${c.days} dias · ${c.seasons.map(s => D.SEASONS[s]).join(', ')}${inS ? '' : ' · <b style="color:#c0392b">fora de época</b>'}${c.regrow ? ' · rebrota' : ''}`; }
          else if (it.sapling) { const f = D.fruits[it.sapling]; sub = `produz em ${f.mature} dias · ${f.seasons.map(s => D.SEASONS[s]).join(', ')}`; }
          else if (it.e) sub = `+${it.e.fome || 0}🍖 +${it.e.sede || 0}💧 +${it.e.energia || 0}⚡`;
          else if (it.feed) sub = `alimento animal: ${it.feed} un.`;
        }
        const multi = !e.upgrade;
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
        const rew = [q.reward.money ? `💰${q.reward.money}` : '', ...Object.entries(q.reward.items || {}).map(([k, n]) => `${n}${D.items[k].i}`)].join(' ');
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
      <div class="row"><button class="btn" id="p-save">💾 Salvar</button><button class="btn alt" id="p-creative">🧪 Modo teste: ${S.creative ? 'LIGADO' : 'desligado'}</button><button class="btn alt" id="p-help">❓ Controles</button><button class="btn red" id="p-new">🆕 Novo jogo</button></div>
      <div id="p-extra"></div>`);
    $('#p-save').onclick = () => { if (G.save()) ui.toast('Jogo salvo.', 'good'); };
    $('#p-creative').onclick = () => { G.setCreative(!S.creative); ui.pause(); };
    $('#p-help').onclick = () => { $('#p-extra').innerHTML = document.querySelector('.controls p').outerHTML + '<p><small>Dormir salva automaticamente. A loja abre das 7h às 20h. Depois das 2h você desmaia.</small></p>'; };
    $('#p-new').onclick = () => ui.confirm('Começar um novo jogo? O progresso salvo será substituído quando você salvar.', () => { location.reload(); try { localStorage.removeItem('ecoland_save_v1'); } catch (e) { /* */ } });
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
