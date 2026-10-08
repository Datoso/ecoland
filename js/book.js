// =============================================================
// EcoLand — O Livro do Vô Zé
// Tutorial ilustrado em forma de livro (UI.openBook), com capa,
// sumário, uma página por etapa do Manual, caderno de receitas e
// dicas e o certificado de Fazenda Autossuficiente.
// =============================================================
(() => {
  if (!window.UI) return;
  const UI = window.UI;
  const panel = document.getElementById('panel');
  const modal = document.getElementById('modal');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const play = n => { try { SFX.play(n); } catch (e) { /* */ } };
  const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'][n] || String(n);

  // ---------- ícones (SVG desenhados à mão, com emoji de reserva) ----------
  // 't:foice' ferramenta · 'a:galinha' animal · 'e:🌼' emoji · 'milho' item/construção
  function ic(spec, cls) {
    let h = null, title = '';
    if (spec.startsWith('t:')) {
      const id = spec.slice(2), t = (D.tools || []).find(x => x.id === id);
      h = (window.ICONS && ICONS.html(id)) || (t && t.i); title = t ? t.n : id;
    } else if (spec.startsWith('a:')) {
      const a = D.animals[spec.slice(2)]; if (a) { h = `<span class="bk-emo">${a.i}</span>`; title = a.n; }
    } else if (spec.startsWith('e:')) {
      h = `<span class="bk-emo">${spec.slice(2)}</span>`;
    } else {
      const it = D.items[spec];
      h = (window.ITEMICONS && ITEMICONS.html(spec)) || (it && `<span class="bk-emo">${it.i}</span>`);
      title = it ? it.n : (D.buildings[spec] ? D.buildings[spec].n : spec);
    }
    return h ? `<span class="bk-ic ${cls || ''}" title="${esc(title)}">${h}</span>` : '';
  }
  const tiny = id => ic(id, 'tiny');

  // ---------- capítulos (agrupados pelos ids das etapas) ----------
  const CHAPTERS = [
    { title: 'Primeiros passos', sub: 'terreno, solo, plantio e água', ids: ['mato', 'arar', 'plantar', 'regar'], doodle: 'sprout' },
    { title: 'Fogo e comida', sub: 'lenha, fogueira, colheita e panela', ids: ['lenha', 'fogo', 'colher', 'cozinhar'], doodle: 'sun' },
    { title: 'Terra nova', sub: 'o primeiro lote vizinho', ids: ['terra'], doodle: 'house' },
    { title: 'Água limpa e criação de aves', sub: 'poço, galinheiro, cocho e ovos', ids: ['poco', 'galinheiro', 'cocho', 'ovos'], doodle: 'egg' },
    { title: 'O ciclo dos nutrientes', sub: 'esterco que vira adubo', ids: ['adubo'], doodle: 'cycle' },
    { title: 'Animais de grande porte', sub: 'curral, chiqueiro e galpão', ids: ['galpao'], doodle: 'house' },
    { title: 'Do campo à mesa', sub: 'abate respeitoso e conservação', ids: ['abate', 'conserva'], doodle: 'pot' },
    { title: 'Pomar, abelhas e ração própria', sub: 'árvores, mel e moinho', ids: ['pomar', 'colmeia', 'racao'], doodle: 'bee' },
    { title: 'Solo vivo e pragas sem veneno', sub: 'adubação verde e controle natural', ids: ['solo', 'pragas'], doodle: 'flower' },
    { title: 'Sementes crioulas e o sistema integrado', sub: 'a autonomia da fazenda', ids: ['sementes', 'integrado'], doodle: 'flower' },
  ];
  const FALLBACK = { title: 'Páginas soltas do vô', sub: 'novas lições', doodle: 'sprout' };
  const chapterOf = id => CHAPTERS.find(c => c.ids.includes(id)) || FALLBACK;

  // ---------- o que fazer, em palavras simples ----------
  const STEPS = {
    mato: { icons: ['t:foice', 'capim'], note: 'O capim que sobra vira comida de bicho!',
      todo: ['Aperte <kbd>4</kbd> para pegar a <b>foice</b>.', 'Chegue perto de um matinho e <b>clique</b> nele (ou aperte <kbd>Espaço</kbd>).', 'Faça isso 5 vezes. O capim vai direto para a mochila.'] },
    arar: { icons: ['t:enxada', 'sem_feijao'], note: 'Canteiro perto da água = menos caminhada.',
      todo: ['Aperte <kbd>2</kbd> para pegar a <b>enxada</b>.', 'Clique na grama limpa, perto da casa, para abrir uma cova.', 'Abra 8 covas lado a lado: isso é o seu primeiro canteiro.'] },
    plantar: { icons: ['sem_feijao', 'sem_milho', 'feijao'], note: 'Olhe a estação antes de plantar!',
      todo: ['Abra a mochila com <kbd>I</kbd> e clique nas <b>sementes</b>: elas vão para a mão (slot <kbd>8</kbd>).', 'Clique em cada cova arada para semear.', 'Plante 8 sementes. Na loja você vê a estação de cada uma.'] },
    regar: { icons: ['t:regador', 'alface'], note: 'Dia de chuva é folga do regador.',
      todo: ['Aperte <kbd>3</kbd> para pegar o <b>regador</b>.', 'Clique nas covas plantadas: a terra escurece quando está molhada.', 'Acabou a água? Clique com o regador no <b>lago</b> (ou no poço) para encher.'] },
    lenha: { icons: ['t:machado', 'madeira', 't:picareta', 'pedra'], note: 'Cortou uma árvore? Plante outra.',
      todo: ['Aperte <kbd>5</kbd> (<b>machado</b>) e clique numa árvore até ela cair.', 'Aperte <kbd>6</kbd> (<b>picareta</b>) e quebre as pedras do terreno.', 'Junte 10 madeiras e 5 pedras.'] },
    fogo: { icons: ['madeira', 'pedra', 'fogueira'], note: 'A fogueira também clareia a noite.',
      todo: ['Aperte <kbd>C</kbd> para abrir a <b>criação</b>, aba <b>Construção</b>.', 'Crie a <b>Fogueira</b> (5 madeiras + 3 pedras).', 'Ela já vem para a sua mão: clique no chão para colocar.'] },
    colher: { icons: ['t:foice', 'milho', 'tomate', 'feijao'], note: 'Guarde um pouco para semente!',
      todo: ['Regue todo dia até a planta mostrar o fruto.', 'Use a <b>foice</b> <kbd>4</kbd> ou a <b>mão</b> <kbd>1</kbd> e clique na planta madura.', 'Colha 5 plantas.'] },
    cozinhar: { icons: ['fogueira', 'omelete', 'sopa', 'salada'], note: 'Salada não precisa de fogo: alface + tomate.',
      todo: ['Fique perto da <b>fogueira</b>.', 'Aperte <kbd>C</kbd> e abra a aba <b>Cozinha</b> (ou <b>Preparo</b>, que dispensa fogo).', 'Escolha uma receita com os ingredientes e clique em <b>Criar</b>.'] },
    poco: { icons: ['ferragens', 'pedra', 'poco'], note: 'Água do lago dá dor de barriga!',
      todo: ['Compre <b>ferragens</b> na loja <b>Agro&amp;Cia</b>, ao lado da casa (aberta das 7h às 20h; aperte <kbd>E</kbd> no balcão).', 'Junte 25 pedras e 10 madeiras.', '<kbd>C</kbd> → Construção → <b>Poço</b>. Coloque-o perto dos canteiros.'] },
    galinheiro: { icons: ['galinheiro', 'a:galinha', 'ovo'], note: 'Galinha no meio da horta: adubo de graça.',
      todo: ['<kbd>C</kbd> → Construção → <b>Galinheiro</b> (40 madeiras, 10 pedras, 5 ferragens).', 'Coloque-o no meio da horta.', 'Na loja, aba <b>Animais</b>, compre 2 pintinhos: eles vão direto para o galinheiro.'] },
    cocho: { icons: ['cocho', 'racao', 'milho', 'capim'], note: 'Bicho come à noite. Encha antes de dormir.',
      todo: ['<kbd>C</kbd> → Construção → <b>Cocho</b> (10 madeiras). Coloque perto dos animais.', 'Na mochila <kbd>I</kbd>, clique em ração, milho ou capim para segurar (slot <kbd>8</kbd>).', 'Aperte <kbd>E</kbd> no cocho para depositar. Coloque 5 unidades.'] },
    ovos: { icons: ['galinheiro', 'ovo', 'omelete'], note: 'Ovo + lenha = omelete quentinha.',
      todo: ['Galinha adulta bota um ovo por dia, dentro do galinheiro.', 'Chegue no galinheiro e aperte <kbd>E</kbd> para recolher os ovos.', 'Colete 5 ovos.'] },
    adubo: { icons: ['esterco', 'capim', 'composteira', 'adubo'], note: 'Nada se perde, tudo se transforma.',
      todo: ['<kbd>C</kbd> → Construção → <b>Composteira</b> (15 madeiras + 5 pedras).', 'Pegue o <b>esterco</b> no galinheiro com <kbd>E</kbd>.', 'Segure esterco, capim ou restos e aperte <kbd>E</kbd> na composteira.', 'Espere 2 noites e recolha o <b>adubo</b>.'] },
    terra: { icons: ['e:🗺️', 'cerca', 'porteira'], note: 'Comece pelo lote vizinho.',
      todo: ['Aperte <kbd>T</kbd> para abrir o mapa de <b>terras</b>.', 'Escolha um lote vizinho ao seu e clique em <b>Comprar</b>.', 'Pasto para os bichos, mata para lenha, lago para água.'] },
    galpao: { icons: ['curral', 'chiqueiro', 'a:vaca', 'a:porco'], note: 'Vaca no pasto se vira sozinha (menos no inverno).',
      todo: ['<kbd>C</kbd> → Construção: <b>Curral</b> (vaca, ovelha, cabra), <b>Chiqueiro</b> (porco) ou <b>Galpão</b> (todos).', 'Coloque com bastante pasto livre em volta.', 'Compre o filhote na loja, aba <b>Animais</b>.'] },
    abate: { icons: ['t:faca', 'carne_boi', 'couro', 'ossos'], note: 'Ossos no moinho viram adubo.',
      todo: ['Espere o animal ficar <b>adulto</b> (veja a tabela no fim do livro).', 'Aperte <kbd>7</kbd> para pegar a <b>faca</b> e clique no animal.', 'Guarde tudo: carne, couro, banha, penas e ossos.'] },
    conserva: { icons: ['defumador', 'charque', 'linguica'], note: 'Charque vale ouro na loja!',
      todo: ['<kbd>C</kbd> → Construção → <b>Defumador</b> (15 pedras + 10 madeiras).', 'Fique perto dele e abra <kbd>C</kbd> → aba <b>Defumador</b>.', '<b>Charque</b>: 2 carnes bovinas + 2 madeiras. <b>Linguiça</b>: carne suína ou de frango.'] },
    pomar: { icons: ['muda_laranja', 'muda_manga', 'muda_banana'], note: 'Quem planta árvore pensa nos netos.',
      todo: ['Compre <b>mudas</b> na loja, aba Mudas.', 'Segure a muda (slot <kbd>8</kbd>) e clique na grama para plantar.', 'Plante 3, deixando espaço entre elas.'] },
    colmeia: { icons: ['colmeia', 'mel', 'e:🌼'], note: 'Abelha descansa no inverno.',
      todo: ['<kbd>C</kbd> → Construção → <b>Colmeia</b> (15 madeiras + 2 ferragens).', 'Coloque perto da horta e do pomar: ela poliniza tudo em volta.', 'Volte de tempos em tempos e recolha o <b>mel</b> com <kbd>E</kbd>.'] },
    racao: { icons: ['moinho', 'milho', 'feijao', 'racao'], note: 'A lavoura alimenta a criação.',
      todo: ['<kbd>C</kbd> → Construção → <b>Moinho</b>.', 'Fique perto dele e abra <kbd>C</kbd> → aba <b>Moinho</b>.', 'Milho + feijão = 3 rações. Mandioca + 2 capins = 2 rações. Faça 6.'] },
    solo: { icons: ['sem_crotalaria', 'sem_feijao_porco', 't:foice', 'adubo'], note: 'Adubo que nasce do chão!',
      todo: ['Compre sementes de <b>crotalária</b> ou <b>feijão-de-porco</b> na loja (aba Sementes).', 'Plante e regue como qualquer cultura.', 'Quando florirem, use a <b>foice</b> <kbd>4</kbd>: a planta é incorporada ao solo. Faça 3 vezes.', 'Troque a família do canteiro a cada plantio.'] },
    pragas: { icons: ['sem_cravo', 'cravo', 'calda', 'neem'], note: 'Diversidade é remédio.',
      todo: ['Plante 4 <b>cravos-de-defunto</b> entre os canteiros.', 'Faça <b>calda</b> (<kbd>C</kbd> → Preparo: 2 pimentas + 1 sabão) ou compre <b>óleo de neem</b> na loja.', 'Segure a calda (slot <kbd>8</kbd>) e clique na planta com praga.'] },
    sementes: { icons: ['banco_sementes', 'cri_milho', 'cri_feijao', 'cri_tomate'], note: 'Semente boa é semente trocada.',
      todo: ['<kbd>C</kbd> → Construção → <b>Banco de Sementes</b>.', 'Aperte <kbd>E</kbd> nele e clique em <b>Separar</b> em 3 culturas que você colheu.', 'Plante as crioulas e guarde de novo: cada geração fica mais forte.'] },
    integrado: { icons: ['milho', 'galinheiro', 'muda_laranja', 'colmeia', 'composteira'], note: 'Tudo ligado, tudo vivo.',
      todo: ['Mantenha <b>10 cultivos</b> plantados e <b>6 animais</b> vivos.', 'Tenha <b>3 frutíferas</b>, uma <b>colmeia</b> e uma <b>composteira</b>.', 'Tudo isso ao mesmo tempo. Aí a fazenda anda sozinha!'] },
  };

  // ---------- rabiscos à mão (SVG) ----------
  const DOODLES = {
    sprout: '<path d="M30 56 C30 44 30 36 31 28"/><path d="M31 32 C20 30 13 22 12 12 C23 13 30 21 31 32Z"/><path d="M31 28 C35 18 44 12 54 12 C53 23 44 29 31 30Z"/><path d="M14 57 Q30 52 48 57"/>',
    sun: '<circle cx="32" cy="32" r="11"/><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6"/>',
    egg: '<path d="M32 10 C20 10 14 30 14 40 C14 50 22 56 32 56 C42 56 50 50 50 40 C50 30 44 10 32 10Z"/><path d="M22 42 l5 -4 5 4 5 -4 5 4"/>',
    cycle: '<path d="M14 30 A18 18 0 0 1 48 24"/><path d="M48 24 l2 -9 M48 24 l-9 -1"/><path d="M50 36 A18 18 0 0 1 16 42"/><path d="M16 42 l-2 9 M16 42 l9 1"/>',
    house: '<path d="M10 32 L32 12 L54 32"/><path d="M16 28 V54 H48 V28"/><path d="M27 54 V40 H37 V54"/>',
    pot: '<path d="M12 28 H52 L48 52 H16 Z"/><path d="M8 28 H56"/><path d="M24 20 q3 -6 0 -12 M32 20 q3 -6 0 -12 M40 20 q3 -6 0 -12"/>',
    bee: '<ellipse cx="32" cy="36" rx="13" ry="10"/><path d="M28 27 v18 M36 27 v18"/><path d="M26 28 C18 14 30 12 31 26 M38 28 C46 14 34 12 33 26"/><path d="M45 36 l6 0"/><path d="M8 50 q8 -8 14 0 t14 0" stroke-dasharray="2 4"/>',
    flower: '<circle cx="32" cy="24" r="5"/><path d="M32 19 C28 8 36 8 32 19 M37 24 C48 20 48 28 37 24 M32 29 C36 40 28 40 32 29 M27 24 C16 28 16 20 27 24"/><path d="M32 30 V56 M32 46 C24 44 22 38 22 36 C28 38 31 42 32 46"/>',
    arrow: '<path d="M8 40 C20 20 38 18 52 28"/><path d="M52 28 l-9 -2 M52 28 l-3 8"/>',
  };
  const doodle = (k, cls) => `<svg class="bk-doodle ${cls || ''}" viewBox="0 0 64 64" aria-hidden="true">${DOODLES[k] || DOODLES.sprout}</svg>`;

  // ---------- helpers de etapa ----------
  const reward = q => {
    const r = q.reward || {};
    const parts = [r.money ? `<span class="bk-rw">💰 ${Number(r.money).toLocaleString('pt-BR')}</span>` : '',
      ...Object.entries(r.items || {}).map(([k, n]) => `<span class="bk-rw">${n}× ${tiny(k)} ${esc(D.items[k] ? D.items[k].n : k)}</span>`)];
    return parts.filter(Boolean).join(' ');
  };
  function frac(q) {
    try { if (G.questDone(q)) return 1; } catch (e) { /* */ }
    const t = String(G.questProgress(q) || '');
    const parts = [...t.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map(m => Math.min(1, +m[1] / Math.max(1, +m[2])));
    (t.match(/✔/g) || []).forEach(() => parts.push(1));
    (t.match(/✘/g) || []).forEach(() => parts.push(0));
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  }

  // ---------- montagem das páginas ----------
  function buildPages() {
    const pages = [{ kind: 'cover' }, { kind: 'dedic' }, { kind: 'toc' }];
    const chapters = [];
    let last = null;
    D.quests.forEach((q, i) => {
      const ch = chapterOf(q.id);
      if (ch !== last) { chapters.push({ ...ch, num: chapters.length + 1, quests: [], page: pages.length }); last = ch; }
      const cur = chapters[chapters.length - 1];
      cur.quests.push(i);
      pages.push({ kind: 'step', q, i, ch: cur, first: cur.quests.length === 1 });
    });
    const appendixPage = pages.length;
    ['controls', 'cycle', 'seasons', 'animals', 'recipes', 'tips'].forEach((k, j) => pages.push({ kind: 'apx', k, first: j === 0 }));
    if ((pages.length - 1) % 2 === 0) pages.push({ kind: 'notes' }); // certificado sempre à direita
    const certPage = pages.length;
    pages.push({ kind: 'cert' });
    return { pages, chapters, appendixPage, certPage };
  }

  // ---------- estado ----------
  let B = null, cur = 0, single = false;
  const isSingle = () => window.matchMedia('(max-width: 760px)').matches;
  const stepPage = i => B.pages.findIndex(p => p.kind === 'step' && p.i === i);
  const currentPage = () => (S.quest >= D.quests.length ? B.certPage : Math.max(3, stepPage(S.quest)));
  const spreadStart = p => (single || p === 0 ? p : (p % 2 === 1 ? p : p - 1));
  const spreadPages = s => (single || s === 0 ? [s] : [s, s + 1].filter(x => x < B.pages.length));

  // ---------- renderização das páginas ----------
  const pno = n => `<div class="bk-pno">— ${n} —</div>`;

  function pCover() {
    const done = Math.min(S.quest, D.quests.length);
    return `<div class="bk-cover">
      <div class="bk-cover-in">
        <div class="bk-cover-top">✦ Manual da Autossuficiência ✦</div>
        <h1>O Livro<br><span>do Vô Zé</span></h1>
        <div class="bk-vignette">
          <div class="bk-vig-row">${ic('muda_laranja')}${ic('galinheiro', 'big')}${ic('colmeia')}</div>
          <div class="bk-vig-row low">${ic('t:enxada')}${ic('milho')}${ic('t:regador')}</div>
        </div>
        <div class="bk-cover-farm">${esc(S.farmName)}</div>
        <div class="bk-cover-strap">${done >= D.quests.length ? '🏆 Fazenda autossuficiente!' : `etapa ${done + 1} de ${D.quests.length}`}</div>
        <button class="bk-open-btn" data-go="1">Abrir o livro ›</button>
      </div>
    </div>`;
  }

  function pDedic() {
    return `<div class="bk-page-in bk-dedic">
      <div class="bk-belongs">Este livro pertence a<br><b>${esc(S.farmName)}</b></div>
      <div class="bk-letter">
        <p>Neto(a) querido(a),</p>
        <p>Escrevi aqui, página por página, tudo o que aprendi nesta terra. Não tenha pressa: <b>cada página é uma tarefa</b>. Faça uma, vire a folha, faça a próxima.</p>
        <p>No fim do caminho a fazenda se sustenta sozinha: a horta alimenta os bichos, os bichos adubam a horta, as abelhas cuidam do pomar.</p>
      </div>
      <div class="bk-howto">
        <h4>Como usar este livro</h4>
        <ul>
          <li><span class="bk-ribbon-mini"></span> A <b>fita vermelha</b> marca a página onde você está.</li>
          <li><kbd>←</kbd> <kbd>→</kbd> ou os botões ‹ › viram as páginas.</li>
          <li><kbd>J</kbd> abre e fecha o livro a qualquer hora.</li>
          <li>No fim tem um <b>caderno de receitas e dicas</b>.</li>
        </ul>
      </div>
      <div class="bk-sign">Com carinho, <span>Vô Zé</span></div>
      ${doodle('sprout', 'd-corner')}
      ${pno(1)}
    </div>`;
  }

  function pToc() {
    const row = (num, title, page, dots, cls) => `<li class="${cls || ''}" data-go="${page}" role="button" tabindex="0">
      <span class="bk-toc-n">${num}</span><span class="bk-toc-t">${title}${dots ? `<span class="bk-toc-dots">${dots}</span>` : ''}</span><span class="bk-toc-l"></span><span class="bk-toc-p">${page}</span></li>`;
    const items = B.chapters.map(c => {
      const dots = c.quests.map(i => `<i class="${i < S.quest ? 'd' : i === S.quest ? 'c' : ''}"></i>`).join('');
      const st = c.quests.every(i => i < S.quest) ? 'done' : c.quests.includes(S.quest) ? 'cur' : '';
      return row(roman(c.num) + '.', esc(c.title), c.page, dots, st);
    }).join('');
    return `<div class="bk-page-in bk-toc">
      <h2 class="bk-h">Sumário</h2>
      <ol>${items}
        ${row('✎', 'Caderno de receitas e dicas', B.appendixPage, '', 'apx')}
        ${row('★', 'Certificado de Fazenda Autossuficiente', B.certPage, '', S.quest >= D.quests.length ? 'done' : '')}
      </ol>
      <div class="bk-note n-bottom">clique num capítulo para ir direto!</div>
      ${pno(2)}
    </div>`;
  }

  function pStep(p, n) {
    const q = p.q, i = p.i, info = STEPS[q.id] || { icons: [], todo: [esc(q.goal)] };
    const st = i < S.quest ? 'done' : i === S.quest ? 'cur' : 'lock';
    const head = p.first
      ? `<div class="bk-chap-open"><span>Capítulo ${roman(p.ch.num)}</span><b>${esc(p.ch.title)}</b><small>${esc(p.ch.sub || '')}</small></div>`
      : `<div class="bk-runhead">Cap. ${roman(p.ch.num)} · ${esc(p.ch.title)}</div>`;
    let status;
    if (st === 'done') status = `<div class="bk-status done">✅ Concluída · recompensa recebida: ${reward(q)}</div>`;
    else if (st === 'cur') {
      const f = frac(q), txt = G.questProgress(q);
      status = `<div class="bk-status cur"><div class="bk-here">Você está aqui</div>
        <div class="bk-prog"><i style="width:${Math.round(f * 100)}%"></i></div>
        <div class="bk-prog-t">${txt ? esc(txt) : 'ainda não feito'} <span>· recompensa: ${reward(q)}</span></div></div>`;
    } else status = `<div class="bk-status lock">🔒 Complete as páginas anteriores <span>· recompensa: ${reward(q)}</span></div>`;
    return `<div class="bk-page-in bk-step st-${st}">
      ${st === 'cur' ? '<div class="bk-ribbon" aria-hidden="true"></div>' : ''}
      ${head}
      <h2 class="bk-title"><span class="bk-snum">${i + 1}</span>${esc(q.t)}</h2>
      <div class="bk-goal">🎯 ${esc(q.goal)}</div>
      <div class="bk-body">
        ${st === 'done' ? '<div class="bk-stamp">Feito!</div>' : ''}
        <div class="bk-art">${(info.icons || []).map(x => ic(x)).join('<span class="bk-plus">·</span>')}</div>
        <div class="bk-todo"><h4>O que fazer</h4><ol>${info.todo.map(t => `<li>${t}</li>`).join('')}</ol></div>
        <div class="bk-why"><h4>Por que isso importa</h4><p>“${esc(q.txt)}”</p><span class="bk-sig">— vô Zé</span></div>
      </div>
      ${info.note ? `<div class="bk-note n-margin">${esc(info.note)}</div>` : ''}
      ${status}
      ${p.first ? doodle(p.ch.doodle, 'd-chap') : ''}
      ${pno(n)}
    </div>`;
  }

  // --- caderno de receitas e dicas ---
  function apxControls() {
    const tools = (D.tools || []).map((t, k) => `<div class="bk-tool"><kbd>${k + 1}</kbd>${ic(t.id === 'item' ? 't:item' : 't:' + t.id)}<small>${esc(t.n)}</small></div>`).join('');
    const K = [['W A S D / setas', 'andar'], ['Clique / Espaço', 'usar a ferramenta'], ['E / botão direito', 'interagir: loja, cocho, galinheiro, casa'],
      ['I', 'mochila (clique num item para segurar)'], ['Q', 'trocar o item na mão'], ['F', 'comer o item na mão'], ['C', 'criar e construir'],
      ['J', 'este livro'], ['T', 'comprar terras'], ['Z', 'ver a fazenda inteira'], ['Esc', 'menu / fechar']];
    return `<div class="bk-chap-open"><span>Apêndice</span><b>Caderno de receitas e dicas</b><small>para consultar sempre que precisar</small></div>
      <h3 class="bk-h3">Ferramentas na mão</h3>
      <div class="bk-tools">${tools}</div>
      <h3 class="bk-h3">Teclas</h3>
      <table class="bk-keys">${K.map(([k, v]) => `<tr><td>${k.split(' / ').map(x => `<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
  }

  function apxCycle() {
    const nodes = [['milho', 'horta'], ['moinho', 'moinho'], ['racao', 'ração'], ['galinheiro', 'animais'], ['esterco', 'esterco'], ['composteira', 'composteira'], ['adubo', 'adubo']];
    const N = nodes.length, R = 38, pos = k => { const a = -Math.PI / 2 + k / N * Math.PI * 2; return [50 + Math.cos(a) * R, 50 + Math.sin(a) * R]; };
    const arcs = nodes.map((_, k) => {
      const a1 = -Math.PI / 2 + (k + 0.24) / N * Math.PI * 2, a2 = -Math.PI / 2 + (k + 0.76) / N * Math.PI * 2;
      const p1 = [50 + Math.cos(a1) * R, 50 + Math.sin(a1) * R], p2 = [50 + Math.cos(a2) * R, 50 + Math.sin(a2) * R];
      return `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${R} ${R} 0 0 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" marker-end="url(#bkArrow)"/>`;
    }).join('');
    const nd = nodes.map(([id, l], k) => { const [x, y] = pos(k); return `<div class="bk-cy-node" style="left:${x}%;top:${y}%">${ic(id)}<small>${l}</small></div>`; }).join('');
    return `<h3 class="bk-h3 first">O ciclo da fazenda</h3>
      <div class="bk-cycle">
        <svg viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="bkArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#7a4a22"/></marker></defs><g class="bk-cy-arcs">${arcs}</g></svg>
        ${nd}
        <div class="bk-cy-center">${ic('colmeia')}<small>as abelhas polinizam tudo em volta</small></div>
      </div>
      <p class="bk-small">🌿 Capim e restos da colheita também vão para o cocho ou para a composteira. 🦴 Ossos viram adubo no moinho. 🌳 A mata se regenera devagar: corte com manejo.</p>
      <div class="bk-note n-bottom">nada se perde!</div>`;
  }

  function apxSeasons() {
    const ss = D.SEASONS.map((s, k) => `<th title="${esc(s)}">${D.SEASON_ICONS[k]}<small>${esc(s.slice(0, 3))}</small></th>`).join('');
    const rows = Object.entries(D.crops).map(([id, c]) => `<tr><td class="bk-crop">${tiny(id)} ${esc(c.n)}</td>${D.SEASONS.map((_, k) => `<td>${c.seasons.includes(k) ? '<i class="bk-dot"></i>' : '<i class="bk-dot off"></i>'}</td>`).join('')}<td class="bk-num">${c.days}d${c.regrow ? ' ↻' : ''}</td></tr>`).join('');
    return `<h3 class="bk-h3 first">Calendário de plantio</h3>
      <table class="bk-table bk-seasons"><thead><tr><th></th>${ss}<th>dias</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="bk-small">● dá para plantar · <b>dias</b> = dias regados até colher · ↻ rebrota depois da colheita. Planta fora de época morre na virada da estação.</p>`;
  }

  function apxAnimals() {
    const rows = Object.entries(D.animals).map(([id, a]) => {
      const homes = (a.homes || []).map(h => D.buildings[h] ? D.buildings[h].n : h).join(', ');
      const prod = a.produce ? `${tiny(a.produce.item)} ${esc(D.items[a.produce.item].n)}${a.produce.every > 1 ? ` (a cada ${a.produce.every} dias)` : ''}` : 'carne (abate)';
      return `<tr><td class="bk-an"><span class="bk-emo">${a.i}</span><b>${esc(a.n)}</b><small>${esc(homes)}</small></td>
        <td>${a.eat}/dia${a.grazer ? '<br><small>ou pasto</small>' : ''}</td><td>${prod}</td><td class="bk-num">${a.adult}d</td></tr>`;
    }).join('');
    return `<h3 class="bk-h3 first">Os bichos da fazenda</h3>
      <table class="bk-table bk-animals"><thead><tr><th>animal · casa</th><th>come</th><th>produz</th><th>adulto</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="bk-small">Comem à noite do cocho (ração, milho, feijão, mandioca, capim). Animal com fome não produz; 3 dias sem comer, morre.</p>`;
  }

  const recipeLine = r => `<li>${tiny(r.out)}<b>${esc(D.items[r.out].n)}${r.q > 1 ? ' ×' + r.q : ''}</b><span>${Object.entries(r.in).map(([k, n]) => `${n}${tiny(k)}`).join(' ')}</span></li>`;
  function apxRecipes() {
    const seen = new Set();
    const list = D.recipes.filter(r => (r.cat === 'Cozinha' || r.cat === 'Preparo') && !seen.has(r.out) && seen.add(r.out));
    return `<h3 class="bk-h3 first">Receitas da cozinha</h3>
      <p class="bk-small">🔥 = perto da fogueira. Abra com <kbd>C</kbd>, aba Cozinha ou Preparo.</p>
      <ul class="bk-recipes">${list.map(r => recipeLine(r).replace('</b>', r.st ? ' <em>🔥</em></b>' : '</b>')).join('')}</ul>`;
  }

  function apxTips() {
    const list = D.recipes.filter(r => r.cat === 'Moinho' || r.cat === 'Defumador');
    return `<h3 class="bk-h3 first">Moinho e defumador</h3>
      <ul class="bk-recipes one">${list.map(recipeLine).join('')}</ul>
      <h3 class="bk-h3">Conselhos do vô</h3>
      <ul class="bk-tips">
        <li>🏪 A loja <b>Agro&amp;Cia</b> fica ao lado da casa e abre das <b>7h às 20h</b>.</li>
        <li>🛏️ Dormir na casa (<kbd>E</kbd> na porta) passa o dia e <b>salva o jogo</b>.</li>
        <li>🌙 Depois das 2h da manhã você desmaia de cansaço.</li>
        <li>🍖💧 Fome e sede zeradas tiram vida: coma com <kbd>F</kbd>.</li>
        <li>🌧️ Dia de chuva rega todos os canteiros.</li>
      </ul>
      <div class="bk-note n-bottom">devagar se vai ao longe</div>`;
  }

  const APX = { controls: apxControls, cycle: apxCycle, seasons: apxSeasons, animals: apxAnimals, recipes: apxRecipes, tips: apxTips };
  const pApx = (p, n) => `<div class="bk-page-in bk-apx">${p.first ? '' : '<div class="bk-runhead">Caderno de receitas e dicas</div>'}${APX[p.k]()}${pno(n)}</div>`;

  const pNotes = n => `<div class="bk-page-in bk-notes"><h3 class="bk-h3 first">Anotações</h3><div class="bk-lines"></div>${doodle('flower', 'd-corner')}${pno(n)}</div>`;

  function pCert(n) {
    const ok = S.quest >= D.quests.length;
    const date = `${D.SEASONS[S.season]}, dia ${S.day} do ano ${S.year}`;
    return `<div class="bk-page-in bk-cert-page">
      <div class="bk-cert ${ok ? '' : 'locked'}">
        <div class="bk-cert-k">Certificado de</div>
        <h2>Fazenda Autossuficiente</h2>
        <p>Certifico que a</p>
        <div class="bk-cert-name">${esc(S.farmName)}</div>
        <p>fechou o ciclo: a lavoura alimenta a criação, a criação aduba a lavoura e a floresta protege tudo.</p>
        <div class="bk-cert-icons">${ic('milho')}${ic('a:vaca')}${ic('muda_laranja')}${ic('colmeia')}${ic('composteira')}</div>
        ${ok ? `<p class="bk-small">${esc(date)} · 🐾 ${S.animals.length} animais · 🌱 ${G.countCrops()} cultivos · 💰 ${(S.stats.earned || 0).toLocaleString('pt-BR')} em vendas</p>`
          : `<p class="bk-small">Ainda faltam <b>${D.quests.length - S.quest}</b> etapas. Este certificado espera por você.</p>`}
        <div class="bk-cert-foot"><div class="bk-seal"><span>🌱</span><small>EcoLand</small></div><div class="bk-cert-sign"><span>Vô Zé</span><small>fundador da fazenda</small></div></div>
      </div>
      ${pno(n)}
    </div>`;
  }

  function renderPage(n, side) {
    const p = B.pages[n];
    if (!p) return `<div class="bk-page ${side} blank"></div>`;
    let html;
    if (p.kind === 'cover') return `<div class="bk-page cover-page">${pCover()}</div>`;
    if (p.kind === 'dedic') html = pDedic();
    else if (p.kind === 'toc') html = pToc();
    else if (p.kind === 'step') html = pStep(p, n);
    else if (p.kind === 'apx') html = pApx(p, n);
    else if (p.kind === 'notes') html = pNotes(n);
    else html = pCert(n);
    const lock = p.kind === 'step' && p.i > S.quest ? ' locked' : '';
    return `<div class="bk-page ${side}${lock}" data-n="${n}">${html}</div>`;
  }

  function render(dir) {
    const root = panel.querySelector('.book');
    if (!root) return;
    single = isSingle();
    cur = spreadStart(Math.max(0, Math.min(B.pages.length - 1, cur)));
    const ps = spreadPages(cur);
    const cover = cur === 0;
    const stage = root.querySelector('.bk-stage');
    stage.innerHTML = `<div class="bk-spread ${single ? 'single' : 'double'} ${cover ? 'is-cover' : ''} ${dir ? 'turn-' + dir : ''}">
      ${cover ? renderPage(0, 'solo') : single ? renderPage(ps[0], 'solo') : renderPage(ps[0], 'left') + renderPage(ps[1], 'right')}
      ${!cover && !single ? '<div class="bk-gutter"></div>' : ''}
    </div>`;
    const last = B.pages.length - 1;
    const lastShown = ps[ps.length - 1];
    root.querySelector('[data-act=prev]').disabled = cur === 0;
    root.querySelector('[data-act=next]').disabled = lastShown >= last;
    const label = cover ? 'Capa' : ps.length > 1 ? `págs. ${ps[0]}–${ps[1]} de ${last}` : `pág. ${ps[0]} de ${last}`;
    root.querySelector('.bk-pg').textContent = label;
    const here = currentPage();
    root.querySelector('[data-act=mark]').classList.toggle('on', ps.includes(here));
    root.querySelectorAll('.bk-page-in').forEach(el => { el.scrollTop = 0; });
  }

  function go(n, dir) {
    const target = spreadStart(Math.max(0, Math.min(B.pages.length - 1, n)));
    if (target === cur) return;
    const d = dir || (target > cur ? 'next' : 'prev');
    cur = target;
    play('ui');
    render(d);
  }
  const turn = d => {
    const ps = spreadPages(cur);
    if (d > 0) { const nx = ps[ps.length - 1] + 1; if (nx < B.pages.length) go(nx, 'next'); }
    else if (cur > 0) go(single || cur === 1 ? cur - 1 : cur - 2, 'prev');
  };

  // ---------- abrir ----------
  UI.openBook = page => {
    if (!window.S || !window.D || !D.quests) return UI.openManual && UI.openManual();
    B = buildPages();
    single = isSingle();
    cur = spreadStart(typeof page === 'number' ? page : currentPage());
    UI.show('book', `<div class="book" role="dialog" aria-label="O Livro do Vô Zé">
      <div class="bk-stage"></div>
      <div class="bk-nav">
        <button class="bk-btn" data-act="prev" title="Página anterior (←)" aria-label="Página anterior">‹</button>
        <span class="bk-pg"></span>
        <button class="bk-btn bk-mark" data-act="mark" title="Ir para a página atual">🔖<span> Onde parei</span></button>
        <button class="bk-btn" data-act="toc" title="Sumário">☰<span> Sumário</span></button>
        <button class="bk-btn" data-act="next" title="Próxima página (→)" aria-label="Próxima página">›</button>
      </div>
    </div>`);
    const root = panel.querySelector('.book');
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (a) {
        const act = a.dataset.act;
        if (act === 'prev') turn(-1); else if (act === 'next') turn(1);
        else if (act === 'mark') go(currentPage()); else if (act === 'toc') go(2);
        return;
      }
      const g = e.target.closest('[data-go]');
      if (g) { go(+g.dataset.go); return; }
      // clicar na margem externa da página vira a folha
      const pg = e.target.closest('.bk-page');
      if (pg && !e.target.closest('button,a,kbd,li[data-go]')) {
        const r = pg.getBoundingClientRect(), x = e.clientX - r.left;
        if (pg.classList.contains('right') && x > r.width - 44) turn(1);
        else if (pg.classList.contains('left') && x < 44) turn(-1);
        else if (pg.classList.contains('solo') && cur > 0) { if (x > r.width - 36) turn(1); else if (x < 36) turn(-1); }
      }
    });
    root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li[data-go]')) { e.preventDefault(); go(+e.target.dataset.go); } });
    render();
  };

  const bookOpen = () => !modal.classList.contains('hidden') && panel.classList.contains('book-open') && panel.querySelector('.book');
  addEventListener('keydown', e => {
    if (!bookOpen()) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(B.pages.length - 1); }
  });
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (bookOpen() && isSingle() !== single) render(); }, 120); });

  // ---------- o painel fica "largo" só enquanto o livro está aberto ----------
  const origShow = UI.show, origClose = UI.close;
  UI.show = function (name, html) {
    panel.classList.toggle('book-open', name === 'book');
    return origShow.apply(this, arguments);
  };
  UI.close = function () {
    const r = origClose.apply(this, arguments);
    if (modal.classList.contains('hidden')) panel.classList.remove('book-open');
    return r;
  };

  // ---------- carta de introdução: botão "Abrir o livro" ----------
  if (typeof UI.intro === 'function') {
    const origIntro = UI.intro;
    UI.intro = function () {
      const r = origIntro.apply(this, arguments);
      const ok = document.getElementById('i-ok');
      if (ok && ok.parentElement && !document.getElementById('i-book')) {
        const b = document.createElement('button');
        b.className = 'btn alt'; b.id = 'i-book'; b.textContent = '📖 Abrir o livro';
        b.onclick = () => UI.openBook();
        ok.parentElement.appendChild(b);
      }
      return r;
    };
  }
})();
