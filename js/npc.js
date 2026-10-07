// =============================================================
// EcoLand — personagens com retrato e relacionamento (corações):
// Dona Cida (atendente da Agro&Cia), Seu Tonho (entregador) e
// Dra. Ana (veterinária). Carregar depois de house.js.
// =============================================================
D.npcs = {
  cida: {
    n: 'Dona Cida', role: 'Atendente da Agro&Cia', portrait: 'portrait_cida',
    loves: ['bolo_milho', 'queijo', 'mel', 'manta_la', 'pao_queijo'], likes: ['ovo', 'laranja', 'cravo', 'leite', 'pamonha', 'suco_laranja', 'cesto'], dislikes: ['esterco', 'residuo_peixe', 'ossos'],
    lines: [
      ['Bom dia, meu bem! Precisando de alguma coisa?', 'Seja bem-vindo à Agro&Cia. Semente boa é meio caminho andado.'],
      ['Ah, é você! Como vai a roça? Seu vô Zé comprava aqui todo sábado.', 'Chegou adubo novo, viu? Mas o seu composto deve ser melhor que o meu.'],
      ['Meu filho, guardei um pacotinho de sementes boas pra você.', 'Você está ficando conhecido na região, sabia? Todo mundo comenta da sua fazenda.'],
      ['Você é como da família já. Passa aqui pra tomar um cafezinho!', 'Sua fazenda me lembra o sítio dos meus pais. Que saudade!'],
    ],
    perks: [[4, '5% de desconto na loja'], [7, '10% de desconto na loja'], [10, '15% de desconto e um presente surpresa por semana']],
  },
  tonho: {
    n: 'Seu Tonho', role: 'Entregador', portrait: 'portrait_tonho',
    loves: ['feijoada', 'churrasco', 'costela_fogo_chao', 'cafe', 'linguica'], likes: ['pamonha', 'pao', 'banana', 'charque', 'chapeu_palha'], dislikes: ['esterco', 'calda', 'pimenta'],
    lines: [
      ['Entrega na mão! Assina aqui, patrão.', 'Ô estradinha de terra, hein? Quase atolei.'],
      ['Opa! Sempre bom passar por aqui, o cheiro da cozinha chega lá na porteira.', 'Se precisar de qualquer coisa da cidade, é só ligar.'],
      ['Trouxe um agradinho da minha comadre pra você.', 'Já tô até aprendendo o caminho de olho fechado!'],
      ['Amigo, sua fazenda é a parada mais gostosa da rota!', 'Entrego pra você até de madrugada, se precisar.'],
    ],
    perks: [[3, 'entregas sem taxa'], [6, 'traz um presente da cidade de vez em quando'], [10, 'entrega em dobro de ração aos sábados']],
  },
  ana: {
    n: 'Dra. Ana', role: 'Veterinária', portrait: 'portrait_ana',
    loves: ['leite', 'queijo_cabra', 'mel', 'suco_acerola', 'blusa_la'], likes: ['ovo', 'manga', 'morango', 'cenoura', 'travesseiro'], dislikes: ['charque', 'esterco', 'calda'],
    lines: [
      ['Oi! Vamos ver como está essa criação?', 'Animal feliz produz mais. Carinho também é manejo!'],
      ['Seus animais estão bem cuidados. Dá pra ver no pelo deles.', 'Lembra: água limpa e sombra fazem toda a diferença.'],
      ['Trouxe umas amostras de vermífugo natural pra você testar.', 'Você leva jeito com bicho, sabia?'],
      ['Sua fazenda é a minha favorita da região. Pode me chamar quando quiser.', 'Que tal um café depois da consulta?'],
    ],
    perks: [[3, 'consulta 20% mais barata'], [6, 'consulta deixa os animais ainda mais felizes'], [10, 'consulta grátis uma vez por semana']],
  },
};

(() => {
  const H = n => Math.min(10, Math.floor((S.npc[n] && S.npc[n].pts || 0) / 100));
  Object.assign(G, {
    npcInit() { S.npc = S.npc || {}; for (const k of Object.keys(D.npcs)) S.npc[k] = S.npc[k] || { pts: 0, talked: 0, gifted: 0, met: false }; },
    hearts: H,
    friend(n, pts) {
      const before = H(n);
      S.npc[n].pts = Math.max(0, Math.min(1000, S.npc[n].pts + pts));
      const after = H(n);
      if (after > before) {
        const perk = D.npcs[n].perks.find(([h]) => h === after);
        UI.toast(`💛 Sua amizade com ${D.npcs[n].n} subiu para ${after} coração(ões)!${perk ? `<br>✨ ${perk[1]}` : ''}`, 'good');
        try { SFX.play('quest'); } catch (e) { /* */ }
      }
    },
    dayStamp() { return S.year * 1000 + S.season * 100 + S.day; },
    shopDiscount() { const h = H('cida'); return h >= 10 ? 0.15 : h >= 7 ? 0.1 : h >= 4 ? 0.05 : 0; },
  });
  for (const fn of ['newGame', 'load']) {
    const orig = G[fn].bind(G);
    G[fn] = function (...a) { const r = orig(...a); if (S && r !== false) G.npcInit(); return r; };
  }

  // desconto da Dona Cida e taxa de entrega on-line do Seu Tonho
  const _buy = G.buy.bind(G);
  G.buy = function (entry, qty = 1) {
    const orig = entry.price;
    let k = 1 - G.shopDiscount();
    if (G.online && H('tonho') < 3) k += 0.1;
    entry.price = Math.max(1, k < 1 ? Math.floor(orig * k) : Math.ceil(orig * k));
    const ok = _buy(entry, qty);
    entry.price = orig;
    if (ok && G.online) G.deliveries = (G.deliveries || 0) + 1;
    return ok;
  };

  // ---------- diálogo com retrato ----------
  const portrait = (id, happy) => (window.ITEMICONS && (ITEMICONS.html(id + (happy ? '_feliz' : '')) || ITEMICONS.html(id))) || '<span style="font-size:64px">🙂</span>';
  const hearts = n => { const h = H(n); return '❤️'.repeat(h) + '<span style="opacity:.25">' + '🤍'.repeat(10 - h) + '</span>'; };
  UI.npcTalk = (n, extra) => {
    const npc = D.npcs[n], st = S.npc[n], today = G.dayStamp();
    st.met = true;
    let line = '', happy = false;
    if (st.talked !== today) {
      st.talked = today; G.friend(n, 20);
      const tier = Math.min(3, Math.floor(H(n) / 3));
      line = npc.lines[tier][(S.day + tier) % 2]; happy = H(n) >= 3;
    } else line = 'Já conversamos hoje! Mas passa aqui amanhã de novo, viu?';
    UI.npcDialog(n, line, happy, extra);
  };
  UI.npcDialog = (n, line, happy, extra = '') => {
    const npc = D.npcs[n];
    const held = S.held && D.items[S.held] ? D.items[S.held] : null;
    const perks = npc.perks.map(([h, t]) => `<li class="${H(n) >= h ? 'got' : ''}">${H(n) >= h ? '✅' : '🔒'} ${h}❤️ ${t}</li>`).join('');
    UI.show('npc', `<div class="npc-box"><div class="npc-portrait">${portrait(npc.portrait, happy)}</div>
      <div class="npc-talk"><h2>${npc.n} <small>${npc.role}</small></h2><div class="npc-hearts">${hearts(n)}</div>
      <p class="npc-line">“${line}”</p>
      <div class="row">${held ? `<button class="btn" id="npc-gift">🎁 Dar ${held.n.toLowerCase()}</button>` : '<small>Segure um item (slot 8) para dar de presente.</small>'}${extra}</div>
      <details><summary>Amizade e vantagens</summary><ul class="perks">${perks}</ul><small>Presentes favoritos: ${npc.loves.map(k => D.items[k] ? D.items[k].n : k).slice(0, 3).join(', ')}…</small></details></div></div>`);
    const g = document.getElementById('npc-gift');
    if (g) g.onclick = () => UI.npcGift(n);
  };
  UI.npcGift = n => {
    const npc = D.npcs[n], st = S.npc[n], id = S.held, today = G.dayStamp();
    if (!id || !G.has(id)) return;
    if (st.gifted === today) { UI.npcDialog(n, 'Ah, que gentileza, mas você já me deu um presente hoje!', false); return; }
    G.take(id); st.gifted = today;
    let pts = 20, line = 'Obrigado(a)! Que lembrança simpática.', happy = false;
    if (npc.loves.includes(id)) { pts = 80; line = `Não acredito! ${D.items[id].n} é o meu favorito! Muito obrigado(a)!`; happy = true; }
    else if (npc.likes.includes(id)) { pts = 45; line = `Hum, ${D.items[id].n.toLowerCase()}! Gostei muito, obrigado(a).`; happy = true; }
    else if (npc.dislikes.includes(id)) { pts = -20; line = 'Hã... obrigado(a)... eu acho.'; }
    G.friend(n, pts);
    try { SFX.play(pts > 40 ? 'quest' : 'pickup'); } catch (e) { /* */ }
    UI.npcDialog(n, line, happy);
  };

  // ---------- onde encontrar cada um ----------
  // Dona Cida: na loja (retrato + saudação no topo; botão para conversar)
  const _shop = UI.openShop;
  UI.openShop = (...a) => {
    _shop(...a);
    const panel = document.getElementById('panel'), h2 = panel.querySelector('h2');
    if (!h2) return;
    const disc = G.shopDiscount();
    const bar = document.createElement('div');
    bar.className = 'npc-strip';
    bar.innerHTML = `<div class="npc-mini">${portrait(G.online ? 'portrait_tonho' : 'portrait_cida', true)}</div><div><b>${G.online ? 'Seu Tonho entrega na hora!' : 'Dona Cida'}</b> <span class="npc-hearts sm">${hearts(G.online ? 'tonho' : 'cida')}</span><br><small>${G.online ? (H('tonho') >= 3 ? 'Entrega sem taxa para os amigos.' : 'Compra on-line: +10% de taxa de entrega.') : (disc ? `Desconto de amiga: ${Math.round(disc * 100)}% em tudo!` : '“Fique à vontade, meu bem!”')}</small></div>
      <button class="btn alt" id="npc-open">💬 Conversar</button>`;
    h2.after(bar);
    document.getElementById('npc-open').onclick = () => UI.npcTalk(G.online ? 'tonho' : 'cida', `<button class="btn alt" id="npc-back">🛒 Voltar às compras</button>`) || bindBack();
    const bindBack = () => { const b = document.getElementById('npc-back'); if (b) b.onclick = () => UI.openShop(); };
    setTimeout(bindBack, 0);
  };
  // computador: loja on-line (Seu Tonho entrega) e chamar a veterinária
  const _pc = UI.openComputer;
  UI.openComputer = () => {
    _pc();
    const row = document.querySelector('#panel .row');
    if (!row) return;
    row.insertAdjacentHTML('beforeend', `<button class="btn alt" id="pc-vet">📞 Chamar a Dra. Ana</button><button class="btn alt" id="pc-tonho">📞 Ligar para o Seu Tonho</button><button class="btn alt" id="pc-rel">💛 Relacionamentos</button>`);
    document.getElementById('pc-shop').onclick = () => { G.online = true; UI.openShop(); };
    document.getElementById('pc-vet').onclick = () => UI.vetVisit();
    document.getElementById('pc-tonho').onclick = () => UI.npcTalk('tonho');
    document.getElementById('pc-rel').onclick = () => UI.openRelations();
  };
  const _close = UI.close;
  UI.close = () => { G.online = false; _close(); };

  // Dra. Ana: consulta veterinária
  UI.vetVisit = () => {
    const h = H('ana'), today = G.dayStamp(), st = S.npc.ana;
    const free = h >= 10 && (!st.freeWeek || today - st.freeWeek >= 7);
    const price = free ? 0 : Math.round(150 * (h >= 3 ? 0.8 : 1));
    UI.npcTalk('ana', `<button class="btn" id="vet-go">🩺 Consulta para todos os animais (💰 ${price})</button>`);
    const b = document.getElementById('vet-go');
    if (b) b.onclick = () => {
      if (!S.creative && S.money < price) { UI.toast('Dinheiro insuficiente para a consulta.', 'bad'); return; }
      if (!S.creative) S.money -= price;
      if (free) st.freeWeek = today;
      let n = 0;
      for (const a of S.animals) { a.happy = Math.min(100, a.happy + (h >= 6 ? 30 : 20)); a.hungry = 0; a.sick = 0; n++; }
      G.friend('ana', 15);
      UI.npcDialog('ana', n ? `Pronto! Examinei ${n} animais. Estão todos ótimos — e mais felizes!` : 'Ainda não há animais para examinar. Me chama quando tiver!', true);
    };
  };

  // painel de relacionamentos
  UI.openRelations = () => {
    UI.show('rel', `<h2>💛 Relacionamentos</h2><div class="grid">${Object.entries(D.npcs).map(([k, npc]) => `<div class="card npc-card" data-n="${k}"><div class="ic npc-mini">${portrait(npc.portrait)}</div><div class="info"><b>${npc.n}</b>${npc.role}<small class="npc-hearts sm">${hearts(k)}</small><small>${S.npc[k].met ? 'Clique para conversar' : 'Ainda não se conheceram'}</small></div></div>`).join('')}</div>
      <p><small>Converse todo dia e dê presentes para ganhar corações. Cada um tem vantagens especiais para os amigos.</small></p>`);
    document.querySelectorAll('#panel .npc-card').forEach(el => el.onclick = () => { const n = el.dataset.n; if (n === 'ana') UI.vetVisit(); else UI.npcTalk(n); });
  };

  // manhã: de vez em quando o Seu Tonho passa com um presente; a Dona Cida manda um mimo semanal
  const _morning = UI.morning;
  UI.morning = lines => {
    if (S.npc) {
      if (H('tonho') >= 6 && Math.random() < 0.25) { const g = ['cafe', 'pao', 'banana', 'marmita'][Math.floor(Math.random() * 4)]; G.add(g, 1, true); lines.push(`📦 Seu Tonho passou cedo e deixou ${D.items[g].n.toLowerCase()} na porteira.`); }
      if (H('cida') >= 10 && S.day % 7 === 1) { G.add('sem_morango', 5, true); lines.push('🎁 Dona Cida mandou 5 sementes de morango de presente.'); }
    }
    _morning(lines);
  };
})();
