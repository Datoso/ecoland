// =============================================================
// EcoLand — dados do jogo (itens, culturas, animais, construções,
// receitas, loja, lotes de terra e o Manual da Autossuficiência)
// =============================================================
window.D = {};

D.SEASONS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
D.SEASON_ICONS = ['🌸', '☀️', '🍂', '❄️'];
D.DAYS_PER_SEASON = 28;
D.MAP_W = 64;
D.MAP_H = 48;

// ---------- Ferramentas (barra de atalhos 1..8) ----------
D.tools = [
  { id: 'mao', n: 'Mão', i: '✋', desc: 'Interagir, colher frutos, pegar produtos, acariciar animais' },
  { id: 'enxada', n: 'Enxada', i: '⛏️', desc: 'Arar a terra para plantar' },
  { id: 'regador', n: 'Regador', i: '🚿', desc: 'Regar a terra arada. Reabasteça no lago ou poço' },
  { id: 'foice', n: 'Foice', i: '🌾', desc: 'Colher plantações e roçar o mato (gera capim)' },
  { id: 'machado', n: 'Machado', i: '🪓', desc: 'Cortar árvores e desmontar cercas' },
  { id: 'picareta', n: 'Picareta', i: '⚒️', desc: 'Quebrar pedras e desmontar construções' },
  { id: 'faca', n: 'Faca', i: '🔪', desc: 'Abater animais adultos para carne e subprodutos' },
  { id: 'item', n: 'Item na mão', i: '🎒', desc: 'Usar o item selecionado no inventário (Q troca)' },
  { id: 'vara', n: 'Vara de pesca', i: '🎣', desc: 'Clique na água para lançar; quando aparecer ❗ clique de novo para fisgar' },
];

// ---------- Níveis das ferramentas (compra na loja, aba Ferramentas) ----------
// area: 1 = um tile, 'line3' = 3 em linha, 3 = 3×3, 5 = 5×5
D.toolLevels = {
  enxada: [
    { n: 'Enxada', area: 1 },
    { n: 'Enxada de aço', area: 'line3', price: 800, desc: 'Ara 3 covas em linha de uma vez.' },
    { n: 'Motocultivador', area: 3, price: 3500, icon: 'motocultivador', desc: 'Microtrator: ara uma área 3×3 de uma vez.' }],
  regador: [
    { n: 'Regador', area: 1, cap: 15 },
    { n: 'Regador grande', area: 3, cap: 40, price: 900, desc: '40 L, rega uma área 3×3.' },
    { n: 'Mangueira com carretel', area: 5, cap: 100, price: 3000, icon: 'mangueira', desc: '100 L, rega uma área 5×5.' }],
  foice: [
    { n: 'Foice', area: 1 },
    { n: 'Foice de aço', area: 3, price: 700, desc: 'Roça e colhe uma área 3×3.' },
    { n: 'Roçadeira a gasolina', area: 5, price: 2800, icon: 'rocadeira', desc: 'Roça e colhe uma área 5×5.' }],
  machado: [
    { n: 'Machado', dmg: 1 },
    { n: 'Machado de aço', dmg: 2, price: 900, desc: 'Derruba árvores em 2 golpes.' },
    { n: 'Motosserra', dmg: 3, bonus: 2, price: 3500, icon: 'motosserra', desc: 'Derruba árvores num golpe e rende +2 madeiras.' }],
  picareta: [
    { n: 'Picareta', dmg: 1, area: 1 },
    { n: 'Picareta de aço', dmg: 2, area: 1, price: 800, desc: 'Quebra pedras num golpe.' },
    { n: 'Rompedor elétrico', dmg: 2, area: 3, price: 3200, icon: 'rompedor', desc: 'Quebra todas as pedras numa área 3×3.' }],
  faca: [
    { n: 'Faca', bonus: 0 },
    { n: 'Faca de aço inox', bonus: 1, price: 500, desc: '+1 carne em cada abate.' }],
  vara: [
    { n: 'Vara de bambu', window: 0.8, wait: 1, rare: 0 },
    { n: 'Vara com molinete', window: 1.2, wait: 0.75, rare: 0.05, price: 600, desc: 'Peixe morde mais rápido e dá mais tempo para fisgar.' },
    { n: 'Vara com carretilha', window: 1.6, wait: 0.55, rare: 0.12, price: 2200, desc: 'Muito mais chance de peixes grandes e raros.' }],
};

// ---------- Peixes nativos (pesca no lago) ----------
// w = peso na sorteio; big = só em lagos grandes (lotes de lago); night = mais ativo à noite
D.fish = {
  lambari:   { n: 'Lambari', w: 30, sell: 15, organic: 1 },
  tilapia_l: { n: 'Tilápia', w: 18, sell: 35, organic: 1 },
  traira:    { n: 'Traíra', w: 14, sell: 55, organic: 1, night: true },
  pacu:      { n: 'Pacu', w: 12, sell: 70, organic: 2, seasons: [1, 2] },
  bagre:     { n: 'Bagre', w: 10, sell: 60, organic: 2, night: true },
  tambaqui:  { n: 'Tambaqui', w: 6, sell: 140, organic: 2, big: true },
  pirarucu:  { n: 'Pirarucu', w: 1, sell: 600, organic: 3, big: true, rare: true },
};

// ---------- Culturas ----------
// days = dias regados para amadurecer; regrow = dias para rebrotar após colheita
D.crops = {
  alface:   { fam: 'folhosa', n: 'Alface',   i: '🥬', days: 4,  seasons: [0, 1, 2, 3], yield: [1, 1], seedPrice: 15, color: '#7ccf4a' },
  cenoura:  { fam: 'raiz', n: 'Cenoura',  i: '🥕', days: 5,  seasons: [0, 2, 3],    yield: [1, 2], seedPrice: 20, color: '#5fae3a' },
  feijao:   { fam: 'leguminosa', n: 'Feijão',   i: '🫘', days: 6,  seasons: [0, 1, 2],    yield: [2, 3], seedPrice: 20, color: '#6cbf3f' },
  milho:    { fam: 'graminea', n: 'Milho',    i: '🌽', days: 7,  seasons: [0, 1],       yield: [1, 2], seedPrice: 25, color: '#9bc93c' },
  tomate:   { fam: 'fruto', n: 'Tomate',   i: '🍅', days: 8,  seasons: [0, 1],       yield: [1, 2], seedPrice: 40, regrow: 3, color: '#4f9f32' },
  mandioca: { fam: 'raiz', n: 'Mandioca', i: '🍠', days: 10, seasons: [0, 1, 2],    yield: [2, 3], seedPrice: 30, color: '#3f8f3a' },
  abobora:  { fam: 'fruto', n: 'Abóbora',  i: '🎃', days: 11, seasons: [1, 2],       yield: [1, 1], seedPrice: 50, color: '#5aa83a' },
  trigo:    { fam: 'graminea', n: 'Trigo',    i: '🌾', days: 5,  seasons: [2, 3],       yield: [2, 3], seedPrice: 15, color: '#c9b24a' },
  capim:    { fam: 'graminea', n: 'Capim',    i: '🌿', days: 3,  seasons: [0, 1, 2, 3], yield: [2, 3], seedPrice: 10, regrow: 2, color: '#4caf50' },
  morango:  { fam: 'fruto', n: 'Morango',  i: '🍓', days: 7,  seasons: [0, 3],       yield: [1, 2], seedPrice: 70, regrow: 3, color: '#4e9a36' },
  pimenta:  { fam: 'fruto', n: 'Pimenta',  i: '🌶️', days: 6,  seasons: [1],          yield: [2, 3], seedPrice: 35, regrow: 3, color: '#5b9b30' },
  melancia: { fam: 'fruto', n: 'Melancia', i: '🍉', days: 10, seasons: [1],          yield: [1, 1], seedPrice: 70, color: '#4a9f3a' },
  crotalaria:   { fam: 'adubo_verde', n: 'Crotalária', i: '🌼', days: 6, seasons: [0, 1, 2], yield: [0, 0], seedPrice: 15, greenManure: 45, color: '#7fae3a', desc: 'Adubação verde: quando florir, incorpore com a foice ou enxada (+fertilidade). Flores atraem abelhas.' },
  feijao_porco: { fam: 'adubo_verde', n: 'Feijão-de-porco', i: '🌿', days: 7, seasons: [0, 1, 2, 3], yield: [0, 0], seedPrice: 15, greenManure: 55, color: '#4f8f2f', desc: 'Leguminosa de adubação verde: fixa nitrogênio. Incorpore quando estiver pronta.' },
  cravo:        { fam: 'flor', n: 'Cravo-de-defunto', i: '🌼', days: 5, seasons: [0, 1, 2], yield: [2, 3], seedPrice: 20, regrow: 3, color: '#5f9f3a', companion: true, desc: 'Planta companheira: afasta pragas num raio de 2 canteiros.' },
  abacaxi:  { fam: 'fruto', n: 'Abacaxi',  i: '🍍', days: 14, seasons: [0, 1, 2, 3], yield: [1, 1], seedPrice: 60, regrow: 10, color: '#5f8f3a' },
};

// famílias para a rotação de culturas
D.families = { folhosa: 'Folhosas', raiz: 'Raízes', leguminosa: 'Leguminosas', graminea: 'Gramíneas', fruto: 'Frutos', adubo_verde: 'Adubação verde', flor: 'Flores' };
D.soilBase = { sede: 60, pasto: 55, mata: 75, cerrado: 35, lago: 70 };
D.pests = {
  lagarta:  { n: 'Lagarta', dmg: 15, fams: ['folhosa', 'graminea', 'fruto'] },
  pulgao:   { n: 'Pulgão', dmg: 8, stall: true, fams: ['folhosa', 'fruto', 'leguminosa'] },
  formiga:  { n: 'Formiga-cortadeira', dmg: 25, fams: ['folhosa', 'raiz', 'fruto', 'leguminosa'] },
};

// ---------- Árvores frutíferas (pomar) ----------
D.fruits = {
  laranja: { n: 'Laranjeira', fruit: 'laranja', i: '🍊', seasons: [2, 3],       every: 3, yield: [2, 3], price: 200, mature: 10 },
  manga:   { n: 'Mangueira',  fruit: 'manga',   i: '🥭', seasons: [1],          every: 3, yield: [2, 4], price: 260, mature: 12 },
  banana:  { n: 'Bananeira',  fruit: 'banana',  i: '🍌', seasons: [0, 1, 2, 3], every: 4, yield: [2, 3], price: 180, mature: 8 },
  abacate: { n: 'Abacateiro', fruit: 'abacate', i: '🥑', seasons: [2],          every: 3, yield: [2, 3], price: 300, mature: 12 },
  limao:   { n: 'Limoeiro',   fruit: 'limao',   i: '🍋', seasons: [0, 1, 2, 3], every: 4, yield: [2, 3], price: 220, mature: 10 },
  acerola:    { n: 'Aceroleira',  fruit: 'acerola',    i: '🍒', seasons: [0, 1, 2],    every: 2, yield: [4, 7], price: 160, mature: 7 },
  jabuticaba: { n: 'Jabuticabeira', fruit: 'jabuticaba', i: '🫐', seasons: [0, 3],     every: 3, yield: [6, 10], price: 350, mature: 14, desc: 'Frutifica no tronco!' },
  coco:       { n: 'Coqueiro',    fruit: 'coco',       i: '🥥', seasons: [0, 1, 2, 3], every: 5, yield: [2, 3], price: 320, mature: 14 },
  // trepadeiras: a muda precisa ser plantada numa espaldeira (estrutura de madeira e arame)
  uva:        { n: 'Parreira',    fruit: 'uva',        i: '🍇', seasons: [1, 2],       every: 3, yield: [3, 5], price: 280, mature: 10, climber: true },
  maracuja:   { n: 'Maracujazeiro', fruit: 'maracuja', i: '🟡', seasons: [0, 1, 2],    every: 3, yield: [3, 5], price: 200, mature: 8, climber: true },
};

// ---------- Animais ----------
D.animals = {
  galinha: { roam: 5,
    n: 'Galinha', baby: 'Pintinho', i: '🐔', bi: '🐤', price: 80, homes: ['galinheiro'], adult: 4, eat: 1,
    produce: { item: 'ovo', every: 1, where: 'home' }, manure: 0.5, grazer: false, sfx: 'chicken',
    slaughter: { carne_frango: 2, penas: 3 }, speed: 1.4,
  },
  porco: { roam: 5,
    n: 'Porco', baby: 'Leitão', i: '🐖', bi: '🐖', price: 300, homes: ['chiqueiro', 'galpao'], adult: 7, eat: 2,
    produce: null, manure: 1, grazer: false, sfx: 'pig',
    slaughter: { carne_porco: 6, banha: 2, couro: 1, ossos: 1 }, speed: 0.9,
  },
  vaca: { roam: 11,
    n: 'Vaca', baby: 'Bezerro', i: '🐄', bi: '🐄', price: 700, homes: ['curral', 'galpao'], adult: 10, eat: 3,
    produce: { item: 'leite_balde', every: 1, where: 'hand' }, manure: 2, grazer: true, sfx: 'cow',
    slaughter: { carne_boi: 10, couro: 2, ossos: 3 }, speed: 0.7,
  },
  ovelha: { roam: 8,
    n: 'Ovelha', baby: 'Cordeiro', i: '🐑', bi: '🐑', price: 400, homes: ['curral', 'galpao'], adult: 6, eat: 2,
    produce: { item: 'la', every: 3, where: 'hand' }, manure: 1, grazer: true, sfx: 'sheep',
    slaughter: { carne_cordeiro: 5, la: 1, couro: 1, ossos: 1 }, speed: 0.9,
  },
  cabra: { roam: 8,
    n: 'Cabra', baby: 'Cabrito', i: '🐐', bi: '🐐', price: 450, homes: ['curral', 'galpao'], adult: 6, eat: 2,
    produce: { item: 'leite_cabra', every: 1, where: 'hand' }, manure: 1, grazer: true, sfx: 'sheep',
    slaughter: { carne_cabrito: 4, couro: 1, ossos: 1 }, speed: 1.0,
  },
  codorna: { roam: 2,
    n: 'Codorna', baby: 'Filhote de codorna', i: '🐦', bi: '🐣', price: 40, homes: ['viveiro'], adult: 3, eat: 1,
    produce: { item: 'ovo_codorna', every: 1, where: 'home' }, manure: 0.3, grazer: false, sfx: 'chicken',
    slaughter: { carne_codorna: 1, penas: 1 }, speed: 1.6, breed: 0.25,
  },
  tilapia: {
    n: 'Tilápia', baby: 'Alevino', i: '🐟', bi: '🐟', price: 15, homes: ['tanque'], adult: 8, eat: 1,
    produce: null, manure: 0, grazer: false, sfx: 'water', aquatic: true,
    slaughter: { file_tilapia: 2, residuo_peixe: 1 }, speed: 0, breed: 0.3,
  },
};

// ---------- Construções ----------
D.buildings = {
  casa:        { n: 'Casa', w: 5, h: 4, fixed: true, roofPanels: 6, desc: 'Sua casa. Interaja para dormir. Segure um painel solar e clique nela para instalar no telhado (até 6).' },
  loja:        { n: 'Agropecuária & Materiais', w: 3, h: 2, fixed: true },
  fogueira:    { n: 'Fogueira', w: 1, h: 1, i: '🔥', light: 5, desc: 'Fonte de fogo: cozinhe receitas por perto.' },
  poco:        { n: 'Poço', w: 2, h: 2, i: '🪣', desc: 'Água limpa para beber e reabastecer o regador.' },
  composteira: { n: 'Composteira', w: 2, h: 1, i: '♻️', desc: 'Transforma esterco e restos em adubo.', levels: [
    { n: 'Composteira', days: 2, per: 4 },
    { n: 'Composteira dupla', days: 1, per: 4, cost: 800, desc: 'adubo em 1 noite' },
    { n: 'Minhocário', days: 1, per: 3, cost: 2200, desc: 'adubo em 1 noite e com menos material' }] },
  cocho:       { n: 'Cocho', w: 2, h: 1, i: '🛶', desc: 'Deposite ração, grãos ou capim. Os animais comem à noite.', levels: [
    { n: 'Cocho', feedCap: 60 },
    { n: 'Cocho grande', feedCap: 150, cost: 400, desc: 'capacidade 150' },
    { n: 'Comedouro automático', feedCap: 300, cost: 1200, desc: 'capacidade 300' }] },
  galinheiro:  { n: 'Galinheiro', w: 3, h: 2, i: '🛖', houses: ['galinha'], desc: 'Abriga galinhas. Ovos e esterco ficam aqui.', levels: [
    { n: 'Galinheiro', cap: 6 },
    { n: 'Galinheiro reformado', cap: 10, cost: 1500, perks: ['feeder'], desc: '+4 vagas e comedouro embutido' },
    { n: 'Granja avícola', cap: 16, cost: 4500, perks: ['feeder', 'auto', 'comfort'], desc: '+6 vagas, bebedouro automático e aquecimento' }] },
  viveiro:     { n: 'Viveiro de codornas', w: 2, h: 2, i: '🐦', houses: ['codorna'], desc: 'Gaiolas para codornas: ovos todo dia, ocupam pouco espaço.', levels: [
    { n: 'Viveiro de codornas', cap: 10 },
    { n: 'Viveiro ampliado', cap: 20, cost: 1200, perks: ['feeder'], desc: '+10 vagas e comedouro tipo calha' },
    { n: 'Codornário', cap: 35, cost: 3500, perks: ['feeder', 'auto', 'comfort'], desc: '+15 vagas, bebedouro nipple e luz controlada' }] },
  curral:      { n: 'Curral', w: 4, h: 3, i: '🐄', houses: ['vaca', 'ovelha', 'cabra'], desc: 'Abriga vacas, ovelhas e cabras. Acumula esterco.', levels: [
    { n: 'Curral', cap: 4 },
    { n: 'Curral coberto', cap: 8, cost: 2500, perks: ['feeder'], desc: '+4 vagas e cocho coberto' },
    { n: 'Estábulo leiteiro', cap: 12, cost: 7000, perks: ['feeder', 'auto', 'comfort'], desc: '+4 vagas, ordenhadeira (coleta automática de leite e lã) e bebedouro' }] },
  chiqueiro:   { n: 'Chiqueiro', w: 3, h: 2, i: '🐖', houses: ['porco'], desc: 'Abriga porcos e já vem com cocho próprio: deposite ração, grãos ou restos nele.', levels: [
    { n: 'Chiqueiro', cap: 4, perks: ['feeder'] },
    { n: 'Pocilga de alvenaria', cap: 8, cost: 2000, perks: ['feeder'], desc: '+4 vagas, piso lavável' },
    { n: 'Suinocultura com biodigestor', cap: 12, cost: 6000, perks: ['feeder', 'comfort', 'biogas'], desc: '+4 vagas, bebedouro e biodigestor (dobra o esterco)' }] },
  tanque:      { n: 'Tanque de tilápias', w: 3, h: 3, i: '🐟', houses: ['tilapia'], desc: 'Criação de peixes. Deposite ração no tanque. A água rica em nutrientes aduba a horta (encha o regador aqui).', levels: [
    { n: 'Tanque de tilápias', cap: 15, perks: ['feeder'] },
    { n: 'Tanque com aerador', cap: 30, cost: 2500, perks: ['feeder', 'comfort'], desc: '+15 vagas, aerador (peixes mais saudáveis)' },
    { n: 'Sistema de aquaponia', cap: 50, cost: 6500, perks: ['feeder', 'comfort', 'aquaponia'], desc: '+20 vagas, água do tanque rega e aduba os canteiros próximos sozinha' }] },
  galpao:      { n: 'Galpão', w: 4, h: 3, i: '🏚️', houses: ['porco', 'vaca', 'ovelha', 'cabra'], desc: 'Galpão multiuso: abriga qualquer animal grande. Acumula esterco.', levels: [
    { n: 'Galpão', cap: 8 },
    { n: 'Galpão ampliado', cap: 12, cost: 3000, perks: ['feeder'], desc: '+4 vagas e comedouro embutido' },
    { n: 'Galpão climatizado', cap: 16, cost: 8000, perks: ['feeder', 'auto', 'comfort'], desc: '+4 vagas, coleta automática e ventilação' }] },
  silo:        { n: 'Silo', w: 2, h: 2, i: '🛢️', desc: 'Grande depósito de ração: os animais comem dele como de um cocho.', levels: [
    { n: 'Silo', feedCap: 200 },
    { n: 'Silo metálico', feedCap: 500, cost: 1500, desc: 'capacidade 500' },
    { n: 'Silo com rosca', feedCap: 1200, cost: 4000, desc: 'capacidade 1200' }] },
  aspersor:    { n: 'Aspersor', w: 1, h: 1, i: '💦', desc: 'Rega sozinho os canteiros em volta toda manhã.', levels: [
    { n: 'Aspersor', range: 1, cross: true, desc: 'rega os 4 vizinhos' },
    { n: 'Aspersor de qualidade', range: 1, cost: 600, desc: 'rega 3×3 (8 vizinhos)' },
    { n: 'Aspersor de irídio', range: 2, cost: 1800, desc: 'rega 5×5 (24 vizinhos)' }] },
  moinho:      { n: 'Moinho', w: 2, h: 2, i: '⚙️', desc: 'Mói grãos: farinha, fubá, ração caseira e farinha de osso.' },
  defumador:   { n: 'Defumador', w: 1, h: 1, i: '♨️', light: 2, desc: 'Conserva carnes: charque e linguiça.' },
  colmeia:     { n: 'Colmeia', w: 1, h: 1, i: '🐝', desc: 'Produz mel e poliniza plantas e pomares próximos.', levels: [
    { n: 'Colmeia', every: 3 },
    { n: 'Colmeia com melgueira', every: 2, cost: 900, desc: 'mel a cada 2 dias' },
    { n: 'Apiário', every: 1, cost: 2500, desc: 'mel todo dia e polinização mais forte' }] },
  cerca:       { n: 'Cerca', w: 1, h: 1, i: '🚧', desc: 'Delimita pastos e protege canteiros. Segure a cerca e arraste o mouse para cercar uma área.' },
  cisterna:    { n: 'Cisterna', w: 2, h: 2, i: '🛢️', desc: 'Capta a água da chuva do telhado. Reabastece o regador e alimenta a irrigação por gotejamento.', levels: [
    { n: 'Cisterna de placas', store: 400 },
    { n: 'Cisterna grande', store: 1000, cost: 1200, desc: 'guarda 1000 L' },
    { n: 'Reservatório com calha', store: 2500, cost: 3000, desc: 'guarda 2500 L' }] },
  roda_dagua:  { n: "Roda d'água", w: 2, h: 2, i: '🎡', desc: "Precisa ficar encostada na água. Bombeia água para a irrigação e as cisternas e gera um pouco de energia.", pump: 60, fill: 120, kwh: 4 },
  catavento:   { n: 'Cata-vento', w: 1, h: 1, i: '🌬️', desc: 'Bombeia água de um poço ou lago próximo (até 5 tiles) para a irrigação e as cisternas.', pump: 30, fill: 60 },
  biodigestor: { n: 'Biodigestor', w: 2, h: 2, i: '🫧', desc: 'Deposite esterco: ele vira biogás para o fogão e biofertilizante. Nada de lenha!', levels: [
    { n: 'Biodigestor', gasCap: 30, rate: 10, kwh: 0 },
    { n: 'Biodigestor com gasômetro', gasCap: 80, rate: 20, kwh: 3, cost: 1800, desc: 'mais gás e um gerador pequeno' },
    { n: 'Usina de biogás', gasCap: 200, rate: 40, kwh: 8, cost: 5000, desc: 'muito gás e energia elétrica' }] },
  painel_solar: { n: 'Painel solar', w: 1, h: 1, i: '☀️', desc: 'Gera energia elétrica nos dias de sol (pouco na chuva).', levels: [
    { n: 'Painel solar', kwh: 6 },
    { n: 'Painel solar duplo', kwh: 11, cost: 900, desc: '11 kWh por dia de sol' },
    { n: 'Painel com bateria', kwh: 16, cost: 2400, desc: '16 kWh, e guarda energia para a noite' }] },
  fogao_biogas: { n: 'Fogão a biogás', w: 1, h: 1, i: '🔥', desc: 'Cozinha as receitas da fogueira usando biogás em vez de lenha.' },
  banco_sementes: { n: 'Banco de Sementes', w: 2, h: 2, i: '🫙', desc: 'Separe sementes crioulas da própria colheita. A cada geração plantada e guardada elas se adaptam à sua terra.', levels: [
    { n: 'Banco de Sementes', bonus: 0, genStep: 1 },
    { n: 'Banco comunitário', bonus: 1, genStep: 1, cost: 1500, desc: '+1 semente em cada separação' },
    { n: 'Câmara fria de sementes', bonus: 1, genStep: 2, cost: 4000, desc: 'sementes bem conservadas: a geração sobe 2 de cada vez' }] },
  espaldeira:  { n: 'Espaldeira', w: 1, h: 1, i: '🪜', desc: 'Estrutura de madeira e arame para trepadeiras: plante muda de uva ou maracujá nela.' },
  ponte:       { n: 'Ponte de madeira', w: 1, h: 1, i: '🌉', desc: 'Atravessa lagos e córregos. Segure a ponte e arraste o mouse por cima da água.' },
  porteira:    { n: 'Porteira', w: 1, h: 1, i: '🚪', desc: 'Passagem na cerca: você passa, os animais não.' },
};

// ---------- Itens ----------
// sell = preço de venda; e = {fome, sede, energia} se comestível
// feed = unidades de alimento no cocho; organic = carga na composteira
D.items = {
  // materiais
  madeira:   { n: 'Madeira', i: '🪵', sell: 4, cat: 'Material', organic: 1 },
  pedra:     { n: 'Pedra', i: '🪨', sell: 3, cat: 'Material' },
  ferragens: { n: 'Ferragens', i: '🔩', sell: 20, cat: 'Material' },
  // insumos
  capim:     { n: 'Capim', i: '🌿', sell: 2, cat: 'Forragem', feed: 1, organic: 1 },
  racao:     { n: 'Ração', i: '🌰', sell: 8, cat: 'Forragem', feed: 3 },
  esterco:   { n: 'Esterco', i: '💩', sell: 4, cat: 'Orgânico', organic: 2 },
  adubo:     { n: 'Adubo orgânico', i: '🟫', sell: 20, cat: 'Orgânico', fert: true },
  // colheitas
  alface:   { n: 'Alface', i: '🥬', sell: 30, cat: 'Colheita', e: { fome: 8, sede: 5 }, organic: 1, feed: 1 },
  cenoura:  { n: 'Cenoura', i: '🥕', sell: 40, cat: 'Colheita', e: { fome: 10, energia: 3 }, organic: 1, feed: 1 },
  feijao:   { n: 'Feijão', i: '🫘', sell: 25, cat: 'Colheita', organic: 1, feed: 2 },
  milho:    { n: 'Milho', i: '🌽', sell: 30, cat: 'Colheita', organic: 1, feed: 2 },
  tomate:   { n: 'Tomate', i: '🍅', sell: 35, cat: 'Colheita', e: { fome: 8, sede: 6 }, organic: 1 },
  mandioca: { n: 'Mandioca', i: '🍠', sell: 50, cat: 'Colheita', organic: 1, feed: 2 },
  abobora:  { n: 'Abóbora', i: '🎃', sell: 120, cat: 'Colheita', organic: 2, feed: 3 },
  trigo:    { n: 'Trigo', i: '🌾', sell: 20, cat: 'Colheita', organic: 1, feed: 2 },
  morango:  { n: 'Morango', i: '🍓', sell: 50, cat: 'Colheita', e: { fome: 6, sede: 4, energia: 4 }, organic: 1 },
  pimenta:  { n: 'Pimenta', i: '🌶️', sell: 30, cat: 'Colheita', organic: 1 },
  melancia: { n: 'Melancia', i: '🍉', sell: 180, cat: 'Colheita', e: { fome: 10, sede: 35 }, organic: 2 },
  cravo:    { n: 'Cravo-de-defunto', i: '🌼', sell: 20, cat: 'Colheita', organic: 1 },
  abacaxi:  { n: 'Abacaxi', i: '🍍', sell: 140, cat: 'Colheita', e: { fome: 10, sede: 20 }, organic: 2 },
  acerola:    { n: 'Acerola', i: '🍒', sell: 12, cat: 'Fruta', e: { sede: 4, energia: 2 }, organic: 1 },
  jabuticaba: { n: 'Jabuticaba', i: '🫐', sell: 15, cat: 'Fruta', e: { fome: 2, sede: 3 }, organic: 1 },
  coco:       { n: 'Coco verde', i: '🥥', sell: 45, cat: 'Fruta', e: { sede: 30 }, organic: 2 },
  uva:        { n: 'Uva', i: '🍇', sell: 25, cat: 'Fruta', e: { fome: 4, sede: 6 }, organic: 1 },
  maracuja:   { n: 'Maracujá', i: '🟡', sell: 30, cat: 'Fruta', organic: 1 },
  // frutas
  laranja: { n: 'Laranja', i: '🍊', sell: 40, cat: 'Fruta', e: { fome: 6, sede: 15 }, organic: 1 },
  manga:   { n: 'Manga', i: '🥭', sell: 50, cat: 'Fruta', e: { fome: 10, sede: 10 }, organic: 1 },
  banana:  { n: 'Banana', i: '🍌', sell: 30, cat: 'Fruta', e: { fome: 15, energia: 5 }, organic: 1, feed: 1 },
  abacate: { n: 'Abacate', i: '🥑', sell: 60, cat: 'Fruta', e: { fome: 18 }, organic: 1 },
  limao:   { n: 'Limão', i: '🍋', sell: 30, cat: 'Fruta', e: { sede: 8 }, organic: 1 },
  // produtos animais
  ovo:     { n: 'Ovo', i: '🥚', sell: 25, cat: 'Animal' },
  leite_balde: { n: 'Balde de leite cru', i: '🪣', sell: 40, cat: 'Animal' },
  leite:   { n: 'Garrafa de leite', i: '🥛', sell: 70, cat: 'Processado', e: { fome: 8, sede: 20 } },
  la:      { n: 'Lã', i: '🧶', sell: 120, cat: 'Animal' },
  ovo_codorna:  { n: 'Ovo de codorna', i: '🥚', sell: 10, cat: 'Animal', e: { fome: 4 } },
  leite_cabra:  { n: 'Leite de cabra', i: '🍼', sell: 70, cat: 'Animal', e: { fome: 8, sede: 18 } },
  carne_cabrito: { n: 'Carne de cabrito', i: '🍖', sell: 80, cat: 'Carne' },
  carne_codorna: { n: 'Carne de codorna', i: '🍗', sell: 25, cat: 'Carne' },
  file_tilapia: { n: 'Filé de tilápia', i: '🐟', sell: 45, cat: 'Carne' },
  residuo_peixe: { n: 'Resíduo de peixe', i: '🦴', sell: 2, cat: 'Orgânico', organic: 3 },
  mel:     { n: 'Mel', i: '🍯', sell: 150, cat: 'Animal', e: { fome: 10, energia: 15 } },
  penas:   { n: 'Penas', i: '🪶', sell: 6, cat: 'Subproduto', organic: 1 },
  couro:   { n: 'Couro', i: '🧥', sell: 90, cat: 'Subproduto' },
  banha:   { n: 'Banha', i: '🫙', sell: 30, cat: 'Subproduto' },
  ossos:   { n: 'Ossos', i: '🦴', sell: 5, cat: 'Subproduto' },
  // carnes cruas
  carne_frango:   { n: 'Carne de frango', i: '🍗', sell: 50, cat: 'Carne' },
  carne_porco:    { n: 'Carne suína', i: '🥓', sell: 60, cat: 'Carne' },
  carne_boi:      { n: 'Carne bovina', i: '🥩', sell: 80, cat: 'Carne' },
  carne_cordeiro: { n: 'Carne de cordeiro', i: '🍖', sell: 75, cat: 'Carne' },
  // processados
  farinha:  { n: 'Farinha de trigo', i: '🍚', sell: 70, cat: 'Processado' },
  fuba:     { n: 'Fubá', i: '🟨', sell: 70, cat: 'Processado' },
  charque:  { n: 'Charque', i: '🧂', sell: 260, cat: 'Processado', e: { fome: 35, energia: 15 } },
  linguica: { n: 'Linguiça', i: '🌭', sell: 90, cat: 'Processado', e: { fome: 25, energia: 10 } },
  queijo:   { n: 'Queijo', i: '🧀', sell: 150, cat: 'Processado', e: { fome: 25, energia: 10 } },
  sabao:    { n: 'Sabão caseiro', i: '🧼', sell: 60, cat: 'Processado' },
  // pratos
  omelete:       { n: 'Omelete', i: '🍳', sell: 70, cat: 'Prato', e: { fome: 30, energia: 12 } },
  frango_assado: { n: 'Frango assado', i: '🥘', sell: 90, cat: 'Prato', e: { fome: 40, energia: 18 } },
  churrasco:     { n: 'Churrasco', i: '🍢', sell: 110, cat: 'Prato', e: { fome: 45, energia: 22 } },
  feijoada:      { n: 'Feijoada', i: '🍲', sell: 200, cat: 'Prato', e: { fome: 70, energia: 30 } },
  sopa:          { n: 'Sopa de legumes', i: '🥣', sell: 120, cat: 'Prato', e: { fome: 40, sede: 20, energia: 15 } },
  pamonha:       { n: 'Pamonha', i: '🫔', sell: 80, cat: 'Prato', e: { fome: 25, energia: 12 } },
  pao:           { n: 'Pão caseiro', i: '🍞', sell: 100, cat: 'Prato', e: { fome: 35, energia: 15 } },
  bolo_milho:    { n: 'Bolo de fubá', i: '🍰', sell: 160, cat: 'Prato', e: { fome: 40, energia: 25 } },
  salada:        { n: 'Salada', i: '🥗', sell: 80, cat: 'Prato', e: { fome: 20, sede: 10, energia: 8 } },
  suco_laranja:  { n: 'Suco de laranja', i: '🧃', sell: 90, cat: 'Prato', e: { sede: 40, energia: 8 } },
  tilapia_frita: { n: 'Tilápia frita', i: '🍤', sell: 100, cat: 'Prato', e: { fome: 35, energia: 15 } },
  moqueca:       { n: 'Moqueca', i: '🥘', sell: 240, cat: 'Prato', e: { fome: 60, sede: 10, energia: 30 } },
  queijo_cabra:  { n: 'Queijo de cabra', i: '🧀', sell: 190, cat: 'Processado', e: { fome: 25, energia: 12 } },
  conserva_codorna: { n: 'Ovos de codorna em conserva', i: '🫙', sell: 140, cat: 'Processado', e: { fome: 20, energia: 8 } },
  tilapia_defumada: { n: 'Tilápia defumada', i: '🐠', sell: 160, cat: 'Processado', e: { fome: 30, energia: 12 } },
  lambari_frito: { n: 'Lambari frito', i: '🐟', sell: 90, cat: 'Prato', e: { fome: 25, energia: 12 } },
  traira_frita:  { n: 'Traíra frita', i: '🐟', sell: 120, cat: 'Prato', e: { fome: 35, energia: 15 } },
  pacu_assado:   { n: 'Pacu assado', i: '🐟', sell: 170, cat: 'Prato', e: { fome: 45, energia: 20 } },
  caldo_peixe:   { n: 'Caldo de peixe', i: '🥣', sell: 150, cat: 'Prato', e: { fome: 40, sede: 20, energia: 18 } },
  costela_tambaqui: { n: 'Costela de tambaqui', i: '🐟', sell: 280, cat: 'Prato', e: { fome: 55, energia: 25 } },
  pirarucu_casaca:  { n: 'Pirarucu de casaca', i: '🐟', sell: 900, cat: 'Prato', e: { fome: 80, energia: 40 } },
  limonada:      { n: 'Limonada', i: '🍹', sell: 80, cat: 'Prato', e: { sede: 40, energia: 6 } },
  suco_acerola:  { n: 'Suco de acerola', i: '🧃', sell: 90, cat: 'Prato', e: { sede: 40, energia: 12 } },
  suco_maracuja: { n: 'Suco de maracujá', i: '🧃', sell: 100, cat: 'Prato', e: { sede: 40, energia: 5 } },
  suco_uva:      { n: 'Suco de uva', i: '🧃', sell: 110, cat: 'Prato', e: { sede: 40, energia: 10 } },
  geleia_jabuticaba: { n: 'Geleia de jabuticaba', i: '🫙', sell: 220, cat: 'Processado', e: { fome: 15, energia: 15 } },
  doce_coco:     { n: 'Cocada', i: '🥥', sell: 130, cat: 'Processado', e: { fome: 20, energia: 15 } },
  // compras de mercado
  marmita: { n: 'Marmita', i: '🍱', sell: 20, cat: 'Mercado', e: { fome: 40, energia: 15 } },
  agua:    { n: 'Garrafa de água', i: '💧', sell: 5, cat: 'Mercado', e: { sede: 35 } },
  cafe:    { n: 'Café', i: '☕', sell: 10, cat: 'Mercado', e: { sede: 5, energia: 30 } },
};

// sementes e mudas geradas automaticamente
for (const [id, c] of Object.entries(D.crops)) {
  D.items['sem_' + id] = {
    n: (id === 'mandioca' ? 'Ramas de ' : id === 'capim' || id === 'abacaxi' ? 'Mudas de ' : 'Sementes de ') + c.n.toLowerCase(),
    i: c.i, seed: id, sell: Math.floor(c.seedPrice / 2), cat: 'Semente',
  };
  // sementes crioulas: separadas da própria colheita no Banco de Sementes
  D.items['cri_' + id] = {
    n: (id === 'mandioca' ? 'Ramas crioulas de ' : id === 'capim' || id === 'abacaxi' || id === 'morango' ? 'Mudas crioulas de ' : 'Sementes crioulas de ') + c.n.toLowerCase(),
    i: c.i, seed: id, crioula: true, sell: Math.floor(c.seedPrice * 0.7), cat: 'Semente crioula',
  };
}
// peixes viram itens
for (const [id, f] of Object.entries(D.fish)) D.items['peixe_' + id] = { n: f.n, i: '🐟', sell: f.sell, cat: 'Peixe', organic: f.organic };
D.items.gotejamento = { n: 'Mangueira de gotejamento', i: '〰️', sell: 3, cat: 'Insumo', drip: true };
D.items.calda = { n: 'Calda de pimenta e sabão', i: '🧴', sell: 15, cat: 'Insumo', pesticide: 3, desc: 'Defensivo natural: aplique sobre a planta para tirar pragas numa área 3×3.' };
D.items.neem = { n: 'Óleo de neem', i: '🫗', sell: 25, cat: 'Insumo', pesticide: 6, desc: 'Defensivo natural: tira pragas numa área 3×3 e protege por 6 dias.' };
D.items.minhoca = { n: 'Minhoca (isca)', i: '🪱', sell: 2, cat: 'Insumo', organic: 1 };
// quantas sementes saem de cada produto colhido
D.seedSave = { crotalaria: 6, feijao_porco: 4, cravo: 5, alface: 3, cenoura: 3, feijao: 3, milho: 4, tomate: 4, mandioca: 2, abobora: 5, trigo: 3, capim: 2, morango: 2, pimenta: 4, melancia: 4, abacaxi: 1 };
for (const [id, f] of Object.entries(D.fruits)) {
  D.items['muda_' + id] = { n: 'Muda de ' + f.n.toLowerCase(), i: f.i, sapling: id, sell: Math.floor(f.price / 2), cat: 'Muda' };
}
// itens que viram construções
for (const [id, b] of Object.entries(D.buildings)) {
  if (b.fixed) continue;
  D.items[id] = { n: b.n, i: b.i, place: id, sell: 0, cat: 'Construção' };
}

// ---------- Receitas ----------
// st = estação de trabalho necessária por perto (null = qualquer lugar)
D.recipes = [
  // construção
  { out: 'fogueira', q: 1, in: { madeira: 5, pedra: 3 }, st: null, cat: 'Construção' },
  { out: 'cerca', q: 4, in: { madeira: 2 }, st: null, cat: 'Construção' },
  { out: 'porteira', q: 1, in: { madeira: 4, ferragens: 1 }, st: null, cat: 'Construção' },
  { out: 'ponte', q: 2, in: { madeira: 3 }, st: null, cat: 'Construção' },
  { out: 'cisterna', q: 1, in: { pedra: 40, ferragens: 4 }, st: null, cat: 'Construção' },
  { out: 'roda_dagua', q: 1, in: { madeira: 40, ferragens: 6 }, st: null, cat: 'Construção' },
  { out: 'catavento', q: 1, in: { madeira: 10, ferragens: 12 }, st: null, cat: 'Construção' },
  { out: 'biodigestor', q: 1, in: { pedra: 30, ferragens: 8 }, st: null, cat: 'Construção' },
  { out: 'fogao_biogas', q: 1, in: { pedra: 10, ferragens: 6 }, st: null, cat: 'Construção' },
  { out: 'calda', q: 4, in: { pimenta: 2, sabao: 1 }, st: null, cat: 'Preparo' },
  { out: 'banco_sementes', q: 1, in: { madeira: 25, pedra: 15, ferragens: 2 }, st: null, cat: 'Construção' },
  { out: 'espaldeira', q: 1, in: { madeira: 4, ferragens: 1 }, st: null, cat: 'Construção' },
  { out: 'cocho', q: 1, in: { madeira: 10 }, st: null, cat: 'Construção' },
  { out: 'composteira', q: 1, in: { madeira: 15, pedra: 5 }, st: null, cat: 'Construção' },
  { out: 'poco', q: 1, in: { pedra: 25, madeira: 10, ferragens: 2 }, st: null, cat: 'Construção' },
  { out: 'galinheiro', q: 1, in: { madeira: 40, pedra: 10, ferragens: 5 }, st: null, cat: 'Construção' },
  { out: 'galpao', q: 1, in: { madeira: 80, pedra: 40, ferragens: 12 }, st: null, cat: 'Construção' },
  { out: 'moinho', q: 1, in: { madeira: 30, pedra: 40, ferragens: 8 }, st: null, cat: 'Construção' },
  { out: 'defumador', q: 1, in: { pedra: 15, madeira: 10 }, st: null, cat: 'Construção' },
  { out: 'viveiro', q: 1, in: { madeira: 25, ferragens: 4 }, st: null, cat: 'Construção' },
  { out: 'curral', q: 1, in: { madeira: 70, pedra: 10, ferragens: 6 }, st: null, cat: 'Construção' },
  { out: 'chiqueiro', q: 1, in: { madeira: 40, pedra: 20, ferragens: 4 }, st: null, cat: 'Construção' },
  { out: 'tanque', q: 1, in: { pedra: 50, ferragens: 6 }, st: null, cat: 'Construção' },
  { out: 'silo', q: 1, in: { pedra: 20, ferragens: 15 }, st: null, cat: 'Construção' },
  { out: 'aspersor', q: 1, in: { ferragens: 2, pedra: 2 }, st: null, cat: 'Construção' },
  { out: 'colmeia', q: 1, in: { madeira: 15, ferragens: 2 }, st: null, cat: 'Construção' },
  // cozinha (fogueira)
  { out: 'leite', q: 2, in: { leite_balde: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'omelete', q: 1, in: { ovo: 2, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'frango_assado', q: 1, in: { carne_frango: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'churrasco', q: 1, in: { carne_boi: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'churrasco', q: 1, in: { carne_cordeiro: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'feijoada', q: 1, in: { feijao: 3, carne_porco: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'sopa', q: 1, in: { cenoura: 1, mandioca: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'pamonha', q: 1, in: { milho: 2, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'pao', q: 1, in: { farinha: 2, ovo: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'bolo_milho', q: 1, in: { fuba: 2, ovo: 1, leite: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'queijo', q: 1, in: { leite: 3, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'tilapia_frita', q: 1, in: { file_tilapia: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'tilapia_frita', q: 1, in: { peixe_tilapia_l: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'lambari_frito', q: 1, in: { peixe_lambari: 3, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'traira_frita', q: 1, in: { peixe_traira: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'pacu_assado', q: 1, in: { peixe_pacu: 1, limao: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'caldo_peixe', q: 1, in: { peixe_bagre: 1, mandioca: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'costela_tambaqui', q: 1, in: { peixe_tambaqui: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'pirarucu_casaca', q: 1, in: { peixe_pirarucu: 1, banana: 2, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'moqueca', q: 1, in: { file_tilapia: 2, tomate: 1, pimenta: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'queijo_cabra', q: 1, in: { leite_cabra: 3, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'omelete', q: 1, in: { ovo_codorna: 5, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'conserva_codorna', q: 1, in: { ovo_codorna: 8, limao: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'churrasco', q: 1, in: { carne_cabrito: 1, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'sabao', q: 2, in: { banha: 2, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  // preparo simples (qualquer lugar)
  { out: 'salada', q: 1, in: { alface: 1, tomate: 1 }, st: null, cat: 'Preparo' },
  { out: 'suco_laranja', q: 1, in: { laranja: 2 }, st: null, cat: 'Preparo' },
  { out: 'limonada', q: 1, in: { limao: 2 }, st: null, cat: 'Preparo' },
  { out: 'suco_acerola', q: 1, in: { acerola: 6 }, st: null, cat: 'Preparo' },
  { out: 'suco_maracuja', q: 1, in: { maracuja: 2 }, st: null, cat: 'Preparo' },
  { out: 'suco_uva', q: 1, in: { uva: 4 }, st: null, cat: 'Preparo' },
  { out: 'geleia_jabuticaba', q: 1, in: { jabuticaba: 10, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  { out: 'doce_coco', q: 2, in: { coco: 2, madeira: 1 }, st: 'fogueira', cat: 'Cozinha' },
  // moinho
  { out: 'farinha', q: 1, in: { trigo: 3 }, st: 'moinho', cat: 'Moinho' },
  { out: 'fuba', q: 1, in: { milho: 2 }, st: 'moinho', cat: 'Moinho' },
  { out: 'racao', q: 3, in: { milho: 1, feijao: 1 }, st: 'moinho', cat: 'Moinho' },
  { out: 'racao', q: 2, in: { mandioca: 1, capim: 2 }, st: 'moinho', cat: 'Moinho' },
  { out: 'adubo', q: 2, in: { ossos: 2 }, st: 'moinho', cat: 'Moinho' },
  // defumador
  { out: 'charque', q: 1, in: { carne_boi: 2, madeira: 2 }, st: 'defumador', cat: 'Defumador' },
  { out: 'linguica', q: 2, in: { carne_porco: 2, banha: 1, madeira: 1 }, st: 'defumador', cat: 'Defumador' },
  { out: 'linguica', q: 2, in: { carne_frango: 2, madeira: 1 }, st: 'defumador', cat: 'Defumador' },
  { out: 'tilapia_defumada', q: 1, in: { file_tilapia: 2, madeira: 1 }, st: 'defumador', cat: 'Defumador' },
];

// ---------- Loja (Agropecuária & Materiais) ----------
D.shop = [
  ...Object.entries(D.crops).map(([id, c]) => ({ id: 'sem_' + id, price: c.seedPrice, tab: 'Sementes' })),
  ...Object.entries(D.fruits).map(([id, f]) => ({ id: 'muda_' + id, price: f.price, tab: 'Mudas' })),
  { id: 'madeira', price: 10, tab: 'Materiais' },
  { id: 'pedra', price: 10, tab: 'Materiais' },
  { id: 'ferragens', price: 50, tab: 'Materiais' },
  { id: 'racao', price: 15, tab: 'Insumos' },
  { id: 'gotejamento', price: 8, tab: 'Insumos' },
  { id: 'neem', price: 45, tab: 'Insumos' },
  { id: 'minhoca', price: 4, tab: 'Insumos' },
  { id: 'painel_solar', price: 1200, tab: 'Materiais' },
  { id: 'adubo', price: 40, tab: 'Insumos' },
  { id: 'marmita', price: 60, tab: 'Mercado' },
  { id: 'agua', price: 15, tab: 'Mercado' },
  { id: 'cafe', price: 25, tab: 'Mercado' },
  ...Object.entries(D.animals).map(([id, a]) => ({ animal: id, price: a.price, tab: 'Animais' })),
  ...Object.entries(D.toolLevels).flatMap(([tool, L]) => L.slice(1).map((l, i) => ({ tool, level: i + 2, n: l.n, price: l.price, desc: l.desc, tab: 'Ferramentas' }))),
  { upgrade: 'mochila', n: 'Cantil térmico', i: '🧴', price: 600, tab: 'Ferramentas', desc: 'A sede diminui 30% mais devagar.' },
  { upgrade: 'botas', n: 'Botas de trilha', i: '🥾', price: 700, tab: 'Ferramentas', desc: 'Anda 20% mais rápido.' },
  { upgrade: 'ferramentas', n: 'Ferramentas de aço', i: '🛠️', price: 1500, tab: 'Ferramentas', desc: 'Ferramentas gastam 40% menos energia.' },
];

// ---------- Lotes de terra ----------
D.lots = [
  { id: 'sede',  n: 'Sede da Fazenda', x: 22, y: 16, w: 20, h: 16, cost: 0,    biome: 'sede' },
  { id: 'norte', n: 'Pasto Norte',     x: 22, y: 0,  w: 20, h: 16, cost: 1500, biome: 'pasto' },
  { id: 'sul',   n: 'Várzea do Lago',  x: 22, y: 32, w: 20, h: 16, cost: 2000, biome: 'lago' },
  { id: 'leste', n: 'Mata Leste',      x: 42, y: 16, w: 22, h: 16, cost: 2500, biome: 'mata' },
  { id: 'oeste', n: 'Cerrado Oeste',   x: 0,  y: 16, w: 22, h: 16, cost: 2500, biome: 'cerrado' },
  { id: 'no',    n: 'Campo Noroeste',  x: 0,  y: 0,  w: 22, h: 16, cost: 4000, biome: 'pasto' },
  { id: 'ne',    n: 'Capoeira Nordeste', x: 42, y: 0, w: 22, h: 16, cost: 4000, biome: 'mata' },
  { id: 'so',    n: 'Chapada Sudoeste', x: 0, y: 32, w: 22, h: 16, cost: 4500, biome: 'cerrado' },
  { id: 'se',    n: 'Brejo Sudeste',   x: 42, y: 32, w: 22, h: 16, cost: 4500, biome: 'lago' },
];

// ---------- Manual da Autossuficiência ----------
// Cada etapa ensina um passo do sistema integrado (inspirado no PAIS
// — Produção Agroecológica Integrada e Sustentável — e na ILPF da Embrapa)
D.quests = [
  { id: 'mato', t: 'Limpando o terreno', goal: 'Roce 5 matos com a foice', stat: 'weeds', n: 5, reward: { money: 50 },
    txt: 'Todo sistema começa pelo chão. Roçar o mato abre espaço e gera capim — que não é lixo: vira alimento para os animais ou matéria orgânica para a compostagem.' },
  { id: 'arar', t: 'Preparando o solo', goal: 'Are 8 covas com a enxada', stat: 'till', n: 8, reward: { items: { sem_feijao: 5 } },
    txt: 'Arar solta a terra e deixa a água e as raízes entrarem. Prefira canteiros próximos da água e da casa: menos caminhada, mais cuidado.' },
  { id: 'plantar', t: 'A primeira semeadura', goal: 'Plante 8 sementes', stat: 'plant', n: 8, reward: { money: 60 },
    txt: 'Cada cultura tem sua época. Fique de olho na estação: plantas fora de época morrem na virada. O feijão é uma leguminosa e ajuda a enriquecer o solo.' },
  { id: 'regar', t: 'Água é vida', goal: 'Regue 8 vezes', stat: 'water', n: 8, reward: { money: 40 },
    txt: 'Planta só cresce nos dias em que é regada. Em dia de chuva a natureza faz isso por você. Reabasteça o regador no lago (clique com o regador na água).' },
  { id: 'lenha', t: 'Lenha e pedra', goal: 'Junte 10 madeiras e 5 pedras', check: g => (g.stats.wood || 0) >= 10 && (g.stats.stone || 0) >= 5,
    prog: g => `${Math.min(10, g.stats.wood || 0)}/10 madeira · ${Math.min(5, g.stats.stone || 0)}/5 pedra`, reward: { money: 50 },
    txt: 'Machado nas árvores, picareta nas pedras. Corte com manejo: a mata se regenera devagar, então replante e deixe sempre árvores em pé.' },
  { id: 'fogo', t: 'Fonte de fogo', goal: 'Construa uma fogueira (C → Construção)', check: g => G.countBuildings('fogueira') >= 1, reward: { money: 100 },
    txt: 'O fogo cozinha, aquece e ilumina a noite. Abra o menu de criação (tecla C), crie a fogueira e coloque-a com o "Item na mão".' },
  { id: 'colher', t: 'A primeira colheita', goal: 'Colha 5 plantas', stat: 'harvest', n: 5, reward: { money: 80 },
    txt: 'Quando a planta mostrar o fruto, use a foice (ou a mão). Parte da colheita se vende, parte se come — e o que sobra alimenta animais e a composteira.' },
  { id: 'cozinhar', t: 'Cozinhar é sobreviver', goal: 'Prepare 1 receita', stat: 'cook', n: 1, reward: { items: { sem_milho: 5, sem_tomate: 3 } },
    txt: 'Comida preparada sacia muito mais que comida crua. Fome e sede zeradas tiram sua vida — mantenha a despensa cheia!' },
  { id: 'poco', t: 'Fonte de água limpa', goal: 'Construa um poço', check: g => G.countBuildings('poco') >= 1, reward: { money: 150 },
    txt: 'Água do lago pode causar dor de barriga. O poço dá água limpa para beber e regar perto dos canteiros. Ferragens você encontra na loja de materiais.' },
  { id: 'galinheiro', t: 'O galinheiro', goal: 'Construa um galinheiro e tenha 2 galinhas', check: g => G.countBuildings('galinheiro') >= 1 && G.countAnimals('galinha') >= 2,
    prog: g => `${G.countBuildings('galinheiro') ? '✔' : '✘'} galinheiro · ${G.countAnimals('galinha')}/2 galinhas`, reward: { items: { racao: 10 } },
    txt: 'No sistema PAIS o galinheiro fica no centro, cercado pelos canteiros: as aves dão ovos, carne e esterco que aduba a horta ao redor.' },
  { id: 'cocho', t: 'Alimentando o plantel', goal: 'Construa um cocho e deposite 5 unidades de alimento', stat: 'feed', n: 5, reward: { money: 100 },
    txt: 'Os animais comem à noite do cocho. Ração, milho, feijão, mandioca e capim servem. Animal com fome não produz — e depois de 3 dias sem comer, morre.' },
  { id: 'ovos', t: 'Ovos frescos', goal: 'Colete 5 ovos no galinheiro', stat: 'eggs', n: 5, reward: { money: 120 },
    txt: 'Os ovos ficam no galinheiro: interaja com ele para coletar. Ovo é proteína barata e vira omelete, pão e bolo.' },
  { id: 'adubo', t: 'Ciclo dos nutrientes', goal: 'Produza 1 adubo na composteira', stat: 'compost', n: 1, reward: { items: { adubo: 3 } },
    txt: 'Pegue o esterco no galinheiro e deposite na composteira junto com restos e capim. Em duas noites vira adubo, que acelera o crescimento e melhora a colheita. Nada se perde!' },
  { id: 'terra', t: 'Expandindo as terras', goal: 'Compre um novo lote (tecla T)', stat: 'lots', n: 1, reward: { money: 200 },
    txt: 'Cada lote tem um bioma: pasto, mata, lago, cerrado. Planeje: pasto para os ruminantes, mata para lenha manejada, lago para água.' },
  { id: 'galpao', t: 'Animais de grande porte', goal: 'Construa um curral, chiqueiro ou galpão e tenha um porco, vaca, ovelha ou cabra', check: g => (G.countBuildings('galpao') + G.countBuildings('curral') + G.countBuildings('chiqueiro')) >= 1 && (G.countAnimals('porco') + G.countAnimals('vaca') + G.countAnimals('ovelha') + G.countAnimals('cabra')) >= 1,
    reward: { items: { racao: 15 } },
    txt: 'Curral para ruminantes, chiqueiro (com cocho próprio) para porcos. Vacas, ovelhas e cabras pastam: com bastante pasto livre elas se alimentam sozinhas (menos no inverno). Porcos comem do cocho e aproveitam restos.' },
  { id: 'abate', t: 'Do campo à mesa', goal: 'Abata um animal adulto com a faca', stat: 'slaughter', n: 1, reward: { money: 150 },
    txt: 'O abate deve ser feito com respeito e sem sofrimento. Aproveite tudo: carne, couro, banha, penas e ossos (que viram farinha de osso, um adubo rico em fósforo).' },
  { id: 'conserva', t: 'Conservação de alimentos', goal: 'Faça charque ou linguiça no defumador', stat: 'smoke', n: 1, reward: { money: 200 },
    txt: 'Defumar e salgar conserva a carne por muito tempo e agrega valor. Charque é um dos produtos mais rentáveis da fazenda.' },
  { id: 'pomar', t: 'O pomar', goal: 'Plante 3 mudas frutíferas', stat: 'trees', n: 3, reward: { money: 200 },
    txt: 'Árvores frutíferas são investimento de longo prazo: produzem por anos, dão sombra e protegem o solo. É o "F" (floresta) da ILPF.' },
  { id: 'colmeia', t: 'Polinizadores', goal: 'Construa uma colmeia', check: g => G.countBuildings('colmeia') >= 1, reward: { money: 250 },
    txt: 'As abelhas produzem mel e polinizam: plantas e frutíferas perto da colmeia crescem e produzem mais.' },
  { id: 'racao', t: 'Ração caseira', goal: 'Produza 6 rações no moinho', stat: 'racao', n: 6, reward: { money: 300 },
    txt: 'Comprar ração é dependência. Moendo milho com feijão (ou mandioca com capim) você fecha o ciclo: a lavoura alimenta a criação.' },
  { id: 'solo', t: 'Solo vivo', goal: 'Incorpore 3 adubações verdes (crotalária ou feijão-de-porco)', stat: 'greenmanure', n: 3, reward: { items: { adubo: 5 } },
    txt: 'Cada colheita tira nutrientes da terra, e plantar sempre a mesma família no mesmo canteiro cansa o solo e chama pragas. Alterne as famílias (folhas, raízes, grãos, frutos, leguminosas) e use adubação verde: semeie crotalária ou feijão-de-porco e, quando florirem, corte e deixe no solo. É adubo que nasce do chão!' },
  { id: 'pragas', t: 'Controle natural de pragas', goal: 'Plante 4 cravos-de-defunto e aplique 1 calda ou óleo de neem', check: g => (g.stats.cravo || 0) >= 4 && (g.stats.pesticide || 0) >= 1,
    prog: g => `${Math.min(4, g.stats.cravo || 0)}/4 cravos · ${Math.min(1, g.stats.pesticide || 0)}/1 aplicação`, reward: { money: 300 },
    txt: 'Lagarta, pulgão e formiga aparecem mais em monocultura e em plantas fracas. Diversidade é remédio: cravo-de-defunto afasta pragas, as galinhas perto da horta comem insetos e a calda de pimenta com sabão (ou o óleo de neem) resolve sem veneno.' },
  { id: 'sementes', t: 'Sementes da terra', goal: 'Guarde sementes crioulas de 3 culturas no Banco de Sementes', check: g => Object.keys(g.seedBank || {}).length >= 3,
    prog: g => `${Math.min(3, Object.keys(g.seedBank || {}).length)}/3 variedades`, reward: { money: 400 },
    txt: 'Semente comprada deixa você dependente da loja. Separando sementes da sua colheita, cada geração se adapta melhor ao seu solo e ao seu clima: fica mais resistente à seca e mais produtiva. Guardar e trocar sementes crioulas é uma tradição dos agricultores — e a base da autonomia.' },
  { id: 'integrado', t: 'Sistema Integrado', goal: '10 cultivos, 6 animais, 3 frutíferas, colmeia e composteira ao mesmo tempo',
    check: g => G.countCrops() >= 10 && G.animals.length >= 6 && G.countFruitTrees() >= 3 && G.countBuildings('colmeia') >= 1 && G.countBuildings('composteira') >= 1,
    prog: g => `${Math.min(10, G.countCrops())}/10 cultivos · ${Math.min(6, G.animals.length)}/6 animais · ${Math.min(3, G.countFruitTrees())}/3 frutíferas`,
    reward: { money: 5000 },
    txt: 'Parabéns! Lavoura, pecuária e floresta trabalhando juntas: o esterco aduba a horta, a horta alimenta os animais, as abelhas polinizam o pomar. Isso é autossuficiência.' },
];
