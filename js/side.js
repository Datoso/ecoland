// =============================================================
// EcoLand — tarefas paralelas ("enquanto espera")
// Missões curtas que liberam junto com o Manual para preencher os
// dias de espera (plantas crescendo, galinhas botando): pesca,
// formas de ganhar dinheiro, vizinhança, organização.
// =============================================================
const SIDE_FISH_DISHES = ['caldo_piranha', 'peixe_brasa', 'tucunare_assado', 'dourado_brasa'];

// after: id da etapa do Manual que precisa estar concluída para liberar
D.sideQuests = [
  // enquanto a primeira plantação cresce
  { id: 'pesca1', after: 'plantar', i: '🎣', t: 'Primeira pescaria', goal: 'Pesque 2 peixes', stat: 'fish', n: 2, reward: { money: 40, items: { minhoca: 4 } },
    txt: 'Enquanto a horta cresce, vá ao lago! Pegue a vara (tecla 9), clique na água e espere o peixe morder (o ❗ aparece). Clique de novo na hora certa. Com minhoca na mochila o peixe morde mais rápido.' },
  { id: 'cida', after: 'plantar', i: '🏪', t: 'Conhecendo a vizinhança', goal: 'Converse com a Dona Cida na loja', check: g => !!(g.npc && g.npc.cida && g.npc.cida.pts > 0), reward: { money: 30 },
    txt: 'Abra a loja e clique em 💬 Conversar. Converse todo dia e leve presentes: com amizade, a Dona Cida dá desconto em tudo.' },
  { id: 'vender', after: 'regar', i: '💰', t: 'Primeiro dinheiro', goal: 'Venda 10 itens na loja (peixe, lenha, pedra, ovos...)', stat: 'sold', n: 10, reward: { money: 60 },
    txt: 'Formas de ganhar dinheiro logo no começo: peixes (os raros valem muito!), madeira e pedra que sobrarem, e depois ovos, frutas e queijo. Na loja, use a aba 💰 Vender.' },
  // enquanto espera as galinhas e a colheita maior
  { id: 'minhocas', after: 'colher', i: '🪱', t: 'Isca viva', goal: 'Encontre 5 minhocas arando a terra', stat: 'worms', n: 5, reward: { money: 50 },
    txt: 'Às vezes uma minhoca aparece quando você ara. Guarde: é a melhor isca. A composteira caprichada (nível 3) também cria minhocas.' },
  { id: 'pesca_rara', after: 'colher', i: '🐟', t: 'Peixe de respeito', goal: 'Pesque um peixe incomum ou mais raro (traíra, bagre, piranha...)', stat: 'fishrare', n: 1, reward: { money: 100 },
    txt: 'Peixes raros valem mais e dão mais XP. À noite e nos lagos grandes eles aparecem mais, e subindo o nível de Pesca eles ficam cada vez mais fáceis.' },
  { id: 'lenha30', after: 'cozinhar', i: '🪵', t: 'Estoque de lenha', goal: 'Junte 30 madeiras no total', check: g => (g.stats.wood || 0) >= 30, prog: g => `${Math.min(30, g.stats.wood || 0)}/30`, reward: { items: { ferragens: 1 } },
    txt: 'Galinheiro, cocho, cercas e baús comem muita madeira. Corte com manejo e replante: a mata se regenera devagar.' },
  { id: 'prato_peixe', after: 'galinheiro', i: '🍲', t: 'Peixe na mesa', goal: 'Prepare um prato de peixe (caldo, peixe na brasa...)', stat: 'cookfish', n: 1, reward: { money: 120 },
    txt: 'Peixe preparado mata a fome muito melhor que cru, e vende bem. Veja as receitas na aba Cozinha e no Forno e brasa (C).' },
  { id: 'presente', after: 'galinheiro', i: '🎁', t: 'Um agrado', goal: 'Dê um presente a um dos personagens', stat: 'gifts', n: 1, reward: { money: 80 },
    txt: 'Segure o item na mão e clique em 🎁 Dar presente na conversa. Cada um tem favoritos: a Dona Cida adora bolo de fubá e queijo, o Seu Tonho, feijoada.' },
  { id: 'pe_de_meia', after: 'cocho', i: '🐷', t: 'Pé-de-meia', goal: 'Ganhe 💰 1.500 vendendo na loja (no total)', check: g => (g.stats.earned || 0) >= 1500, prog: g => `💰 ${Math.min(1500, g.stats.earned || 0)}/1500`, reward: { money: 200 },
    txt: 'Dicas para engordar o caixa: peixes raros, frutas da estação, ovos e, mais tarde, charque, queijo e mel. Produto processado vale bem mais que o cru.' },
  // depois dos ovos, enquanto o sistema cresce
  { id: 'bau', after: 'ovos', i: '📦', t: 'Tudo no lugar', goal: 'Construa um baú perto da horta ou dos animais', check: g => G.countBuildings('bau') >= 1, reward: { money: 100 },
    txt: 'Baús perto de onde você trabalha poupam caminhada: guarde ração perto dos animais e sementes perto da horta.' },
  { id: 'pesca15', after: 'ovos', i: '🎣', t: 'Pescador da várzea', goal: 'Pesque 15 peixes no total', stat: 'fish', n: 15, reward: { money: 250 },
    txt: 'O lago é uma fonte de proteína que não precisa de ração. Mais tarde, o tanque de tilápias faz isso de forma organizada.' },
  { id: 'nivel5', after: 'adubo', i: '⭐', t: 'Mãos calejadas', goal: 'Chegue ao nível 5 em qualquer habilidade', check: () => !!G.skill && Object.keys(D.skills || {}).some(k => G.skill(k) >= 5), reward: { money: 150 },
    txt: 'Cada habilidade sobe fazendo: pescar, cortar lenha, plantar, cozinhar. Veja as vantagens de cada nível no painel ⭐ (tecla H).' },
];

(() => {
  const mainIdx = id => D.quests.findIndex(q => q.id === id);
  const unlocked = q => S.quest > mainIdx(q.after);
  const done = q => !!(S.side && S.side[q.id]);
  const finished = q => q.check ? q.check(S) : (S.stats[q.stat] || 0) >= q.n;
  const prog = q => q.prog ? q.prog(S) : q.stat ? `${Math.min(q.n, S.stats[q.stat] || 0)}/${q.n}` : (finished(q) ? '✔' : '');
  const rewardTxt = r => [r.money ? `💰 ${r.money}` : '', ...Object.entries(r.items || {}).map(([k, n]) => `${n} ${D.items[k] ? D.items[k].i : k}`)].filter(Boolean).join(' ');

  Object.assign(G, {
    sideInit() {
      S.side = S.side || {}; S.sideSeen = S.sideSeen || {};
      for (const q of D.sideQuests) if (unlocked(q)) S.sideSeen[q.id] = true; // sem enxurrada de avisos ao carregar
    },
    sideActive() { return S && S.side ? D.sideQuests.filter(q => unlocked(q) && !done(q)) : []; },
    checkSide() {
      if (!S || !S.side) return;
      for (const q of D.sideQuests) {
        if (done(q) || !unlocked(q)) continue;
        if (!S.sideSeen[q.id]) { S.sideSeen[q.id] = true; if (S.quest < D.quests.length) UI.toast(`📋 Nova tarefa paralela: <b>${q.i} ${q.t}</b><br><small>${q.goal}</small>`); }
        if (!finished(q)) continue;
        S.side[q.id] = true;
        if (q.reward.money) S.money += q.reward.money;
        for (const [k, n] of Object.entries(q.reward.items || {})) G.add(k, n, true);
        try { SFX.play('quest'); } catch (e) { /* */ }
        UI.toast(`📋 Tarefa paralela concluída: <b>${q.t}</b>! Recompensa: ${rewardTxt(q.reward)}`, 'good');
      }
    },
  });

  for (const fn of ['newGame', 'load']) {
    const f = G[fn].bind(G);
    G[fn] = function (...a) { const r = f(...a); if (S) G.sideInit(); return r; };
  }
  const _cq = G.checkQuests.bind(G);
  G.checkQuests = function () { _cq(); this.checkSide(); };

  // contadores novos
  const _sell = G.sell.bind(G);
  G.sell = function (id, qty) {
    const before = S.inv[id] || 0; const r = _sell(id, qty);
    const sold = before - (S.inv[id] || 0); if (sold > 0) this.stat('sold', sold);
    return r;
  };
  const _craft = G.craft.bind(G);
  G.craft = function (r) {
    const ok = _craft(r);
    if (ok && r && SIDE_FISH_DISHES.concat(['tilapia_defumada', 'peixe_assado', 'moqueca', 'caldo_peixe', 'file_tilapia_frito']).includes(r.out)) this.stat('cookfish');
    else if (ok && r && Object.keys(r.in || {}).some(k => k.startsWith('peixe_') || k.startsWith('file_'))) this.stat('cookfish');
    return ok;
  };
  const _gift = UI.npcGift;
  UI.npcGift = n => {
    const st = S.npc[n], before = st && st.gifted;
    _gift(n);
    if (st && st.gifted !== before) G.stat('gifts');
  };

  // HUD: tarefas abaixo da etapa do Manual
  const _hud = UI.hud;
  let tick = 0;
  UI.hud = force => {
    _hud(force);
    if (!S || !S.side || (!force && tick++ % 8)) return;
    const box = document.getElementById('quest');
    if (!box) return;
    const act = G.sideActive();
    let el = box.querySelector('.side-q');
    if (!act.length) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'side-q'; box.appendChild(el); }
    const html = `<div class="side-h">📋 Enquanto espera</div>${act.slice(0, 3).map(q => `<div class="side-it"><span>${q.i}</span><div><b>${q.t}</b><small>${q.goal} · ${prog(q)}</small></div></div>`).join('')}${act.length > 3 ? `<small class="side-more">+${act.length - 3} tarefa(s)…</small>` : ''}`;
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    if (tick % 64 === 1) G.checkSide();
  };

  // painel com todas as tarefas paralelas
  UI.openSide = () => {
    const rows = D.sideQuests.map(q => {
      const st = done(q) ? 'done' : unlocked(q) ? 'cur' : 'lock';
      const after = D.quests[mainIdx(q.after)];
      return `<li class="${st}"><span class="sq-ic">${st === 'lock' ? '🔒' : q.i}</span><div><b>${q.t}</b> ${st === 'done' ? '✅' : ''}<br>${q.goal} <small>(${rewardTxt(q.reward)})</small>
        ${st === 'lock' ? `<br><small>Libera depois da etapa “${after ? after.t : q.after}” do Manual.</small>` : `<p>${q.txt}</p>`}${st === 'cur' ? `<small><b>Progresso:</b> ${prog(q)}</small>` : ''}</div></li>`;
    }).join('');
    UI.show('side', `<h2>📋 Tarefas paralelas</h2><p><small>Coisas para fazer enquanto as plantas crescem e os animais produzem. Elas não travam o Manual: faça quando quiser.</small></p><ul class="side-list">${rows}</ul>`);
  };
  document.addEventListener('click', e => {
    const s = e.target.closest && e.target.closest('#quest .side-q');
    if (s) { e.stopPropagation(); UI.openSide(); }
  }, true);
})();
