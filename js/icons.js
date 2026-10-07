// =============================================================
// EcoLand — ícones das ferramentas desenhados em SVG
// ICONS.html(id) -> <svg> para a interface
// ICONS.img(id)  -> Image para desenhar no canvas (ou null)
// =============================================================
window.ICONS = (() => {
  const wood = (x1, y1, x2, y2, w = 5) => `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a2c14" stroke-width="${w + 2.5}" stroke-linecap="round"/>
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9a6233" stroke-width="${w}" stroke-linecap="round"/>
    <line x1="${x1 - 1}" y1="${y1 - 1}" x2="${x2 - 1}" y2="${y2 - 1}" stroke="#c48a52" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>`;

  const svg = {
    // enxada: cabo longo e lâmina chata de aço
    enxada: `${wood(9, 43, 33, 11)}
      <rect x="30" y="7" width="7" height="6" rx="1.5" fill="#5b6268" stroke="#2b3034" stroke-width="1.5" transform="rotate(-37 33 10)"/>
      <path d="M31 9 L45 14 L43.5 25 L33.5 17 Z" fill="#8f9aa3" stroke="#2b3034" stroke-width="2" stroke-linejoin="round"/>
      <path d="M43.5 25 L33.5 17" stroke="#dfe6eb" stroke-width="1.6"/>`,
    // picareta: cabeça curva de duas pontas
    picareta: `${wood(10, 44, 30, 14)}
      <path d="M7 15 Q26 -1 46 19 L42 22 Q27 9 11 19 Z" fill="#9aa3ab" stroke="#2b3034" stroke-width="2" stroke-linejoin="round"/>
      <path d="M12 15 Q26 5 40 16" stroke="#e4eaee" stroke-width="1.6" fill="none"/>
      <rect x="26" y="7" width="8" height="8" rx="1.5" fill="#5b6268" stroke="#2b3034" stroke-width="1.5"/>`,
    // regador de metal verde com crivo
    regador: `
      <path d="M31 31 L43 16" stroke="#1f5f45" stroke-width="6" stroke-linecap="round"/>
      <path d="M31 31 L43 16" stroke="#3fae7c" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="43.5" cy="15" rx="3.6" ry="2.4" fill="#e3c25a" stroke="#7a5c12" stroke-width="1.4" transform="rotate(-50 43.5 15)"/>
      <path d="M14 19 Q20 6 29 19" fill="none" stroke="#1f5f45" stroke-width="5" stroke-linecap="round"/>
      <path d="M14 19 Q20 6 29 19" fill="none" stroke="#3fae7c" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M9 20 h24 l-2 21 a3 3 0 0 1 -3 3 h-14 a3 3 0 0 1 -3 -3 Z" fill="#3fae7c" stroke="#1f5f45" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="9" y="19" width="24" height="4" rx="2" fill="#2f8c63" stroke="#1f5f45" stroke-width="1.6"/>
      <path d="M13 26 v13" stroke="#8fe0bb" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
      <rect x="11" y="32" width="20" height="3" fill="#2f8c63" opacity=".6"/>
      <circle cx="44" cy="22" r="1.4" fill="#7fd3ff"/><circle cx="47" cy="25" r="1.1" fill="#7fd3ff"/><circle cx="42" cy="27" r="1.2" fill="#7fd3ff"/>`,
    // foice: cabo curvo e lâmina em arco
    foice: `
      <path d="M11 45 Q14 26 25 8" fill="none" stroke="#4a2c14" stroke-width="7" stroke-linecap="round"/>
      <path d="M11 45 Q14 26 25 8" fill="none" stroke="#9a6233" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M24 9 Q41 3 47 22 Q38 12 25 14 Z" fill="#b9c2c9" stroke="#2b3034" stroke-width="2" stroke-linejoin="round"/>
      <path d="M27 10 Q40 7 45 18" fill="none" stroke="#f0f4f6" stroke-width="1.4"/>
      <rect x="10" y="30" width="7" height="3" rx="1" fill="#4a2c14" transform="rotate(-15 13 31)"/>`,
    // machado: cabeça preta, fio prateado, cabo de madeira marrom
    machado: `${wood(13, 45, 29, 8, 5.5)}
      <path d="M22 9 L35 5 Q46 13 38 26 L25 18 Z" fill="#1d1f22" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
      <path d="M35 5 Q46 13 38 26" fill="none" stroke="#cfd6dc" stroke-width="2.6"/>
      <path d="M27 11 L33 9" stroke="#55595e" stroke-width="1.6" stroke-linecap="round"/>`,
    // faca: lâmina de aço e cabo de madeira com rebites
    faca: `
      <path d="M17 33 L37 8 Q42 7 41 13 L22 37 Z" fill="#c4ccd2" stroke="#2b3034" stroke-width="2" stroke-linejoin="round"/>
      <path d="M20 33 L38 11" stroke="#f2f5f7" stroke-width="1.4"/>
      <rect x="14.5" y="31" width="10" height="4" rx="1" fill="#3a3a3a" transform="rotate(40 19.5 33)"/>
      <path d="M17 36 L8 45" stroke="#4a2c14" stroke-width="8" stroke-linecap="round"/>
      <path d="M17 36 L8 45" stroke="#9a6233" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="14.5" cy="38.5" r="1.1" fill="#e3c25a"/><circle cx="11" cy="42" r="1.1" fill="#e3c25a"/>`,
    // mochila / item na mão
    item: `
      <path d="M12 18 Q12 10 24 10 Q36 10 36 18 L38 40 Q38 44 34 44 H14 Q10 44 10 40 Z" fill="#b07a45" stroke="#4a2c14" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M17 11 Q24 3 31 11" fill="none" stroke="#4a2c14" stroke-width="3"/>
      <rect x="15" y="22" width="18" height="12" rx="3" fill="#8b5a2b" stroke="#4a2c14" stroke-width="1.8"/>
      <rect x="22" y="26" width="4" height="4" rx="1" fill="#e3c25a"/>`,
    // mão (luva de trabalho)
    mao: `
      <path d="M15 44 L13 26 Q12 22 15 22 Q18 22 18 26 L18 14 Q18 10 21 10 Q24 10 24 14 L24 11 Q24 7 27 7 Q30 7 30 11 L30 13 Q30 9 33 9 Q36 9 36 13 L36 30 Q36 40 30 44 Z"
        fill="#e7c08a" stroke="#6b4423" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M24 14 v12 M30 13 v13" stroke="#b58b55" stroke-width="1.6"/>
      <rect x="14" y="38" width="20" height="6" rx="2" fill="#4f9a3a" stroke="#2d5f20" stroke-width="1.6"/>`,
  };

  const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%">${body}</svg>`;
  const imgs = {};
  for (const [id, body] of Object.entries(svg)) {
    const im = new Image();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(wrap(body));
    imgs[id] = im;
  }
  return {
    html: id => svg[id] ? `<span class="svgic">${wrap(svg[id])}</span>` : null,
    img: id => (imgs[id] && imgs[id].complete && imgs[id].naturalWidth) ? imgs[id] : null,
  };
})();
