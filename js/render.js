// =============================================================
// EcoLand — renderização em canvas (tudo procedural, sem imagens)
// Chão em blocos pré-renderizados (texturas, margens orgânicas de
// água/areia), sprites procedurais em cache para árvores, pedras,
// mato, plantações e construções; atmosfera por hora e estação.
// =============================================================
window.R = (() => {
  const TS = 44; // tamanho do tile em pixels
  const TAU = Math.PI * 2;
  let cv, ctx, light, lctx, W = 0, H = 0, dpr = 1, cacheDpr = 0;
  // zoom: Z atual, ZT alvo; VW/VH = área visível em pixels de mundo
  let Z = 1, ZT = 1, zAnchor = null, VW = 0, VH = 0;
  const cam = { x: 0, y: 0 }, camF = { x: 0, y: 0 };
  const emojiCache = new Map();
  let t = 0, lastCam = null;

  function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
  function rng(seed) {
    let s = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) | 0 || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const shadeCache = new Map();
  function shade(h, k) {
    const key = h + k; let r = shadeCache.get(key);
    if (!r) { const c = hexRgb(h); r = css(k >= 0 ? mix(c, [255, 255, 255], k) : mix(c, [0, 0, 0], -k)); shadeCache.set(key, r); }
    return r;
  }

  // ---------- emojis ----------
  function emo(ch, size) {
    const key = ch + '|' + size;
    let c = emojiCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      const s = Math.ceil(size * 1.3);
      c.width = c.height = s;
      const x = c.getContext('2d');
      x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ch, s / 2, s / 2 + size * 0.06);
      emojiCache.set(key, c);
    }
    return c;
  }
  const emoHi = new Map(); // versão em alta resolução (dpr) para o jogo
  function emoC(ch, size) {
    const key = ch + '|' + size;
    let c = emoHi.get(key);
    if (!c) {
      c = document.createElement('canvas');
      const s = Math.ceil(size * 1.3), r = Math.ceil(s * dpr);
      c.width = c.height = r;
      const x = c.getContext('2d');
      x.scale(r / s, r / s);
      x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ch, s / 2, s / 2 + size * 0.06);
      c.s = s;
      emoHi.set(key, c);
    }
    return c;
  }
  function drawEmo(ch, x, y, size, flip, sx = 1, sy = 1, c2 = ctx) {
    const c = emoC(ch, Math.round(size)), w = c.s * sx, h = c.s * sy;
    if (flip) { c2.save(); c2.translate(x, y); c2.scale(-1, 1); c2.drawImage(c, -w / 2, -h / 2, w, h); c2.restore(); }
    else c2.drawImage(c, x - w / 2, y - h / 2, w, h);
  }

  // ---------- sprites em cache ----------
  const spr = new Map();
  // contorno escuro (estilo pixel art): pinta pixels transparentes vizinhos de
  // pixels sólidos com um tom bem escuro da própria cor vizinha
  function outlineCanvas(cv) {
    const w = cv.width, h = cv.height, x = cv.getContext('2d');
    const im = x.getImageData(0, 0, w, h), d = im.data, src = new Uint8ClampedArray(d);
    const R = Math.max(1, Math.round(dpr)), A = 0.88;
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = (y * w + xx) * 4;
      if (src[i + 3] >= 150) continue;
      let f = -1;
      for (let k = 1; k <= R && f < 0; k++) {
        if (xx + k < w && src[i + 4 * k + 3] >= 200) f = i + 4 * k;
        else if (xx - k >= 0 && src[i - 4 * k + 3] >= 200) f = i - 4 * k;
        else if (y + k < h && src[i + 4 * w * k + 3] >= 200) f = i + 4 * w * k;
        else if (y - k >= 0 && src[i - 4 * w * k + 3] >= 200) f = i - 4 * w * k;
      }
      if (f < 0) continue;
      const a0 = src[i + 3] / 255, r = src[f] * 0.28 + 8, g = src[f + 1] * 0.24 + 5, b = src[f + 2] * 0.22 + 4;
      d[i] = r * A + src[i] * (1 - A) * a0; d[i + 1] = g * A + src[i + 1] * (1 - A) * a0; d[i + 2] = b * A + src[i + 2] * (1 - A) * a0;
      d[i + 3] = 255 * (A + (1 - A) * a0);
    }
    x.putImageData(im, 0, 0);
  }
  function sprite(key, w, h, ox, oy, fn, outline = true) {
    let s = spr.get(key);
    if (!s) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const x = c.getContext('2d', { willReadFrequently: outline });
      x.scale(dpr, dpr); x.translate(ox, oy);
      x.lineCap = 'round'; x.lineJoin = 'round';
      fn(x);
      if (outline) outlineCanvas(c);
      s = { cv: c, w, h, ox, oy };
      spr.set(key, s);
    }
    return s;
  }
  function blit(s, x, y) { ctx.drawImage(s.cv, Math.round(x - s.ox), Math.round(y - s.oy), s.w, s.h); }
  // balanço ao vento: 7 quadros pré-inclinados por sprite (desenho sem transformações por quadro)
  const SWF = 7;
  function swayFrame(s, k, amp) {
    let i = Math.round((clamp(k, -1, 1) + 1) / 2 * (SWF - 1));
    if (i === (SWF - 1) / 2 || !amp) return s;
    if (!s.fr) s.fr = [];
    let f = s.fr[i];
    if (!f) {
      const sk = (i / ((SWF - 1) / 2) - 1) * amp, pad = Math.ceil(Math.abs(sk) * s.oy) + 2;
      const c = document.createElement('canvas'); c.width = Math.ceil((s.w + pad * 2) * dpr); c.height = s.cv.height;
      const x = c.getContext('2d'); x.scale(dpr, dpr); x.translate(s.ox + pad, s.oy); x.transform(1, 0, sk, 1, 0, 0);
      x.drawImage(s.cv, -s.ox, -s.oy, s.w, s.h);
      f = s.fr[i] = { cv: c, w: s.w + pad * 2, h: s.h, ox: s.ox + pad, oy: s.oy };
    }
    return f;
  }
  function blitSway(s, x, y, k, amp) { blit(swayFrame(s, k, amp), x, y); }

  // ---------- utilitários de desenho ----------
  function rrect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function rrect4(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r[0], y);
    c.arcTo(x + w, y, x + w, y + h, r[1]); c.arcTo(x + w, y + h, x, y + h, r[2]);
    c.arcTo(x, y + h, x, y, r[3]); c.arcTo(x, y, x + w, y, r[0]); c.closePath();
  }
  function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  function circ(c, x, y, r, col) { if (col) c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function leaf(c, x, y, len, wid, ang, col, vein) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const tx = x + ca * len, ty = y + sa * len, mx = x + ca * len * 0.5, my = y + sa * len * 0.5, nx = -sa * wid, ny = ca * wid;
    c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx + nx, my + ny, tx, ty); c.quadraticCurveTo(mx - nx, my - ny, x, y); c.fill();
    if (vein) { c.strokeStyle = vein; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + ca * len * 0.8, y + sa * len * 0.8); c.stroke(); }
  }
  function star4(c, x, y, r, col) {
    c.fillStyle = col; c.beginPath();
    c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
  }

  // ---------- paleta sazonal ----------
  const PAL = [
    { g0: '#4a9c36', g1: '#92d24e', dry: '#aaa65a', s0: '#efdba5', s1: '#dcc58c', ws: '#b49a6a', w0: '#6fcbe0', w1: '#2a6fb3', foam: '#f2fbff', tuft: '#3a7f33', tuftL: '#a6dc74' },
    { g0: '#3c9232', g1: '#7cc445', dry: '#a7a14d', s0: '#f1dca2', s1: '#e0c688', ws: '#b39866', w0: '#62c4dc', w1: '#22689f', foam: '#f2fbff', tuft: '#2f7029', tuftL: '#95cf62' },
    { g0: '#8c8a34', g1: '#d0ad4e', dry: '#b89a58', s0: '#ead39b', s1: '#d7bd84', ws: '#a98e62', w0: '#6db6cf', w1: '#2a5f98', foam: '#f2fbff', tuft: '#646a2a', tuftL: '#e0c46e' },
    { g0: '#93ada3', g1: '#dde9e4', dry: '#c7c2a8', s0: '#ebe6d4', s1: '#d8d1bd', ws: '#b3aa97', w0: '#a6d6e6', w1: '#4a7fae', foam: '#ffffff', tuft: '#7a9488', tuftL: '#f4f8f6' },
  ];
  const PALR = PAL.map(p => { const o = {}; for (const k in p) o[k] = hexRgb(p[k]); return o; });
  const LEAFPAL = [
    [['#2c7232', '#46953c', '#72bd55', '#b2e07c'], ['#2c7232', '#46953c', '#72bd55', '#b2e07c'], ['#2c7232', '#46953c', '#72bd55', '#b2e07c']],
    [['#1f5a28', '#2f7a2f', '#4c9b3a', '#86c45c'], ['#1f5a28', '#2f7a2f', '#4c9b3a', '#86c45c'], ['#1f5a28', '#2f7a2f', '#4c9b3a', '#86c45c']],
    [['#8e3f18', '#c26227', '#e58c36', '#f8c466'], ['#8a6a16', '#c49a26', '#e3c244', '#f6e38a'], ['#7a2618', '#a63a26', '#cf5a34', '#f09464']],
    null,
  ];

  // ---------- ruído ----------
  const NT = 512;
  let lowTex = null, grain = null;
  function vnoiseP(x, y, P) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P, o = P * 7;
    const a = hash(x0, y0 + o), b = hash(x1, y0 + o), c = hash(x0, y1 + o), d = hash(x1, y1 + o);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function initNoise() {
    lowTex = new Float32Array(NT * NT); grain = new Float32Array(65536);
    for (let y = 0; y < NT; y++) for (let x = 0; x < NT; x++)
      lowTex[y * NT + x] = vnoiseP(x / 64, y / 64, 8) * 0.6 + vnoiseP(x / 21.333, y / 21.333, 24) * 0.3 + vnoiseP(x / 8, y / 8, 64) * 0.1;
    for (let i = 0; i < 65536; i++) grain[i] = hash(i & 255, (i >> 8) + 999);
  }

  // ---------- canvas ----------
  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    light = document.createElement('canvas'); lctx = light.getContext('2d');
    initNoise();
    resize();
    addEventListener('resize', resize);
  }
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    light.width = W; light.height = H; vigC = null;
    if (dpr !== cacheDpr) { cacheDpr = dpr; spr.clear(); emoHi.clear(); chunks.clear(); }
    ambReady = false;
  }

  function screenToWorld(sx, sy) { return { x: (sx / Z + cam.x) / TS, y: (sy / Z + cam.y) / TS }; }

  // =============================================================
  // CHÃO — blocos de 8x8 tiles pré-renderizados
  // =============================================================
  const CH = 8, CPX = CH * TS;
  const chunks = new Map();
  let tmpC = null, tmpX = null, tmpImg = null;
  const GI = { grass: 0, sand: 1, water: 2, tilled: 3 };
  function tileC(x, y) {
    x = x < 0 ? 0 : x >= G.W ? G.W - 1 : x; y = y < 0 ? 0 : y >= G.H ? G.H - 1 : y;
    return S.tiles[y * G.W + x];
  }
  function chunkSig(cx, cy) {
    let s = S.season * 977 + 13;
    const x0 = cx * CH - 1, y0 = cy * CH - 1;
    for (let y = y0; y <= y0 + CH + 1; y++) for (let x = x0; x <= x0 + CH + 1; x++) {
      const tl = tileC(x, y);
      const code = (GI[tl.g] || 0) + (tl.wet ? 4 : 0) + (tl.fert || (tl.c && tl.c.fert) ? 8 : 0) + (tl.o && tl.o.t === 'b' ? 16 : 0) + (tl.drip ? 32 : 0) + (tl.g === 'tilled' ? fertCat(tl) * 64 : 0);
      s = (Math.imul(s, 31) + code) | 0;
    }
    return s;
  }

  function buildChunk(cx, cy, ch) {
    const P = PALR[S.season], season = S.season;
    const N = CH + 2, tx0 = cx * CH - 1, ty0 = cy * CH - 1;
    const fW = new Float32Array(N * N), fS = new Float32Array(N * N), fD = new Float32Array(N * N), fP = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = clamp(tx0 + i, 0, G.W - 1), y = clamp(ty0 + j, 0, G.H - 1), tl = S.tiles[y * G.W + x];
      const w = tl.g === 'water' ? 1 : 0, k = j * N + i;
      fW[k] = w; fS[k] = w || tl.g === 'sand' ? 1 : 0;
      const lot = G.lotAt(x, y); fD[k] = lot && lot.biome === 'cerrado' ? 1 : 0;
      if (w) { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileC(x + dx, y + dy).g === 'water') n++; fP[k] = n / 9; }
    }
    if (!tmpC) { tmpC = document.createElement('canvas'); tmpC.width = tmpC.height = CPX; tmpX = tmpC.getContext('2d'); tmpImg = tmpX.createImageData(CPX, CPX); }
    const ci = new Int32Array(CPX), cf = new Float32Array(CPX);
    for (let l = 0; l < CPX; l++) { const u = (l + 0.5) / TS + 0.5, i = Math.floor(u), f = u - i; ci[l] = i; cf[l] = f * f * (3 - 2 * f); }
    const data = tmpImg.data, wx0 = cx * CPX, wy0 = cy * CPX;
    const winter = season === 3;
    for (let ly = 0; ly < CPX; ly++) {
      const j = ci[ly], fy = cf[ly], wy = wy0 + ly;
      for (let lx = 0; lx < CPX; lx++) {
        const i = ci[lx], fx = cf[lx], k = j * N + i, wx = wx0 + lx, fxy = fx * fy;
        let a = fW[k], b = fW[k + 1], c = fW[k + N], d = fW[k + N + 1];
        const w = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fxy;
        a = fS[k]; b = fS[k + 1]; c = fS[k + N]; d = fS[k + N + 1];
        const s = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fxy;
        const lo = lowTex[(wy & 511) * 512 + (wx & 511)];
        const lo2 = lowTex[(((wx * 0.73) | 0) + 211 & 511) * 512 + ((((wy * 0.73) | 0) + 97) & 511)];
        const m = lo * 0.6 + lo2 * 0.4;
        const gr = grain[((wy & 255) << 8) | (wx & 255)];
        const en = lowTex[((wy * 3) & 511) * 512 + ((wx * 3) & 511)] - 0.5;
        const thrW = 0.5 + en * 0.3, thrS = 0.5 + en * 0.34;
        let r, g, bl;
        if (w > thrW) {
          a = fP[k]; b = fP[k + 1]; c = fP[k + N]; d = fP[k + N + 1];
          const dp = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fxy;
          const kd = clamp((dp - 0.3) / 0.62, 0, 1) * 0.85 + (m - 0.5) * 0.25;
          const W0 = P.w0, W1 = P.w1;
          r = W0[0] + (W1[0] - W0[0]) * kd; g = W0[1] + (W1[1] - W0[1]) * kd; bl = W0[2] + (W1[2] - W0[2]) * kd;
          const e = w - thrW;
          if (e < 0.05) { const f = (1 - e / 0.05) * (0.55 + gr * 0.35); r += (P.foam[0] - r) * f; g += (P.foam[1] - g) * f; bl += (P.foam[2] - bl) * f; }
          else if (e < 0.12) { r += 14; g += 16; bl += 10; }
          const v = (gr - 0.5) * 6; r += v; g += v; bl += v;
        } else if (s > thrS) {
          const S0 = P.s0, S1 = P.s1;
          r = S0[0] + (S1[0] - S0[0]) * m; g = S0[1] + (S1[1] - S0[1]) * m; bl = S0[2] + (S1[2] - S0[2]) * m;
          const wet = clamp((w - 0.16) / 0.3, 0, 1) * 0.9;
          r += (P.ws[0] - r) * wet; g += (P.ws[1] - g) * wet; bl += (P.ws[2] - bl) * wet;
          const v = (gr - 0.5) * 16; r += v; g += v; bl += v;
          if (gr > 0.992) { r *= 0.78; g *= 0.76; bl *= 0.74; }
          const es = s - thrS; if (es < 0.04) { const f = 0.9 + es / 0.04 * 0.1; r *= f; g *= f; bl *= f; }
        } else {
          const G0 = P.g0, G1 = P.g1;
          r = G0[0] + (G1[0] - G0[0]) * m; g = G0[1] + (G1[1] - G0[1]) * m; bl = G0[2] + (G1[2] - G0[2]) * m;
          a = fD[k]; b = fD[k + 1]; c = fD[k + N]; d = fD[k + N + 1];
          const dr = (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fxy) * 0.7;
          if (dr > 0) { r += (P.dry[0] - r) * dr; g += (P.dry[1] - g) * dr; bl += (P.dry[2] - bl) * dr; }
          const v = (gr - 0.5) * 20; r += v; g += v * 1.1; bl += v * 0.6;
          if (winter && gr > 0.84) { r += (255 - r) * 0.45; g += (255 - g) * 0.45; bl += (255 - bl) * 0.45; }
          const es = thrS - s; if (es < 0.07) { const f = 0.72 + es / 0.07 * 0.28; r *= f; g *= f; bl *= f; }
        }
        const o = (ly * CPX + lx) * 4;
        data[o] = r; data[o + 1] = g; data[o + 2] = bl; data[o + 3] = 255;
      }
    }
    tmpX.putImageData(tmpImg, 0, 0);
    const c = ch.cv.getContext('2d');
    c.setTransform(ch.sc, 0, 0, ch.sc, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(tmpC, 0, 0, CPX, CPX);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // detalhes vetoriais por tile
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const x = cx * CH + i, y = cy * CH + j;
      if (x >= G.W || y >= G.H) continue;
      const tl = S.tiles[y * G.W + x], px = i * TS, py = j * TS;
      if (tl.g === 'tilled') drawSoil(c, x, y, px, py, tl);
      if (tl.drip) drawDrip(c, x, y, px, py, tl);
      else if (tl.g === 'grass' && !(tl.o && tl.o.t === 'b')) grassDecor(c, x, y, px, py, season);
      else if (tl.g === 'water') waterDecor(c, x, y, px, py, season);
      else if (tl.o && tl.o.t === 'b' && tl.g === 'grass' && (() => { const b = getB(tl.o.id), d = b && D.buildings[b.type]; return d && d.w === 1 && d.h === 1; })()) { // terra batida sob construções pequenas
        ell(c, px + TS / 2, py + TS / 2 + 6, 19, 13, 'rgba(110,80,40,0.16)');
      }
    }
  }

  function isSW(x, y) { const n = G.tile(x, y); return n && (n.g === 'water' || n.g === 'sand'); }
  function tuft(c, x, y, s, dk, lt) {
    c.lineWidth = 1.4; c.strokeStyle = dk; c.beginPath();
    for (let k = -2; k <= 2; k++) { c.moveTo(x + k * 1.5, y); c.quadraticCurveTo(x + k * 1.9, y - 4 * s, x + k * 3, y - (7.5 - Math.abs(k) * 1.2) * s); }
    c.stroke();
    c.strokeStyle = lt; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x - 0.5, y - 0.5); c.quadraticCurveTo(x, y - 4 * s, x + 1.2, y - 6.8 * s); c.stroke();
  }
  function flower(c, x, y, col, r = 1.6) {
    ell(c, x, y + 2.2, 2.6, 1, 'rgba(0,0,0,0.12)');
    c.fillStyle = col; c.beginPath();
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - 1.57; c.moveTo(x + Math.cos(a) * r * 1.2 + r, y + Math.sin(a) * r * 1.2); c.arc(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, r, 0, TAU); }
    c.fill(); circ(c, x, y, r * 0.75, '#ffcf3a');
  }
  function grassDecor(c, x, y, px, py, season) {
    const P = PAL[season], h = hash(x, y), r = rng(x * 7919 + y * 104729);
    const edge = isSW(x - 1, y) || isSW(x + 1, y) || isSW(x, y - 1) || isSW(x, y + 1);
    const nt = r() < 0.6 ? (r() < 0.4 ? 2 : 1) : 0;
    for (let k = 0; k < nt; k++) tuft(c, px + 9 + r() * 26, py + 14 + r() * 24, 0.8 + r() * 0.5, P.tuft, P.tuftL);
    if (edge) return;
    if (season === 0 && h < 0.17) {
      const cols = ['#ffffff', '#ffc4dd', '#fff07a', '#c7a6ff', '#ff9bb3'], n = 1 + Math.floor(r() * 3), col = cols[Math.floor(r() * cols.length)];
      for (let k = 0; k < n; k++) flower(c, px + 8 + r() * 28, py + 10 + r() * 26, col);
    } else if (season === 1 && h < 0.1) {
      const cols = ['#ffd23a', '#ff8a3a', '#ffffff', '#e8463c'], n = 1 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) flower(c, px + 8 + r() * 28, py + 10 + r() * 26, cols[Math.floor(r() * cols.length)], 1.8);
    } else if (season === 2) {
      if (h < 0.32) {
        const cols = ['#d9662a', '#c0392b', '#e8a23a', '#8a5a2a'], n = 2 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const lx = px + 6 + r() * 32, ly = py + 8 + r() * 30, a = r() * TAU;
          leaf(c, lx, ly, 5, 2.2, a, cols[Math.floor(r() * cols.length)], 'rgba(0,0,0,0.2)');
        }
      } else if (h > 0.975) { // cogumelo
        const mx = px + 14 + r() * 16, my = py + 22 + r() * 12;
        c.fillStyle = '#efe6d2'; c.fillRect(mx - 1.5, my - 4, 3, 5);
        c.fillStyle = '#c0392b'; c.beginPath(); c.arc(mx, my - 4, 4.5, Math.PI, 0); c.fill();
        circ(c, mx - 1.5, my - 6, 0.9, '#fff'); circ(c, mx + 2, my - 5, 0.8, '#fff');
      }
    } else if (season === 3 && h < 0.4) {
      const n = 1 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const sx = px + 8 + r() * 28, sy = py + 10 + r() * 26, rw = 6 + r() * 8;
        ell(c, sx, sy + 1.5, rw, rw * 0.42, 'rgba(120,150,180,0.25)');
        ell(c, sx, sy, rw, rw * 0.4, 'rgba(255,255,255,0.92)');
      }
    }
    if (hash(y + 31, x + 17) > 0.94) { // pedrinha
      const sx = px + 10 + r() * 24, sy = py + 14 + r() * 22;
      ell(c, sx + 0.5, sy + 1, 2.8, 1.6, 'rgba(0,0,0,0.18)'); ell(c, sx, sy, 2.6, 1.8, '#a49e94'); ell(c, sx - 0.8, sy - 0.6, 1.1, 0.7, '#cfc9bf');
    }
  }
  function waterDecor(c, x, y, px, py, season) {
    let interior = true;
    for (let dy = -1; dy <= 1 && interior; dy++) for (let dx = -1; dx <= 1; dx++) { const n = G.tile(x + dx, y + dy); if (!n || n.g !== 'water') { interior = false; break; } }
    const h = hash(x * 3 + 1, y * 5 + 2);
    if (!interior) return;
    if (season !== 3 && h < 0.13) {
      const r = rng(x * 31 + y * 17), n = 1 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const lx = px + 12 + r() * 20, ly = py + 12 + r() * 20, rr = 6 + r() * 3.5, a = r() * TAU;
        ell(c, lx + 1, ly + 1.5, rr, rr * 0.75, 'rgba(10,40,60,0.25)');
        c.fillStyle = '#4f9a3e'; c.beginPath(); c.ellipse(lx, ly, rr, rr * 0.75, 0, a + 0.35, a + TAU - 0.05); c.lineTo(lx, ly); c.fill();
        c.fillStyle = '#6dba52'; c.beginPath(); c.ellipse(lx - 1, ly - 1, rr * 0.55, rr * 0.4, 0, 0, TAU); c.fill();
        if (season < 2 && r() < 0.4) { flower(c, lx + 1, ly - 1, '#ffb3d1', 1.5); }
      }
    } else if (season === 3 && h < 0.3) {
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1; c.beginPath();
      c.moveTo(px + 8, py + 30); c.lineTo(px + 18, py + 22); c.lineTo(px + 30, py + 26); c.moveTo(px + 18, py + 22); c.lineTo(px + 22, py + 12); c.stroke();
    }
  }
  function isTilled(x, y) { const n = G.tile(x, y); return n && n.g === 'tilled'; }
  function fertCat(tl) { const f = tl.f == null ? 60 : tl.f; return f >= 75 ? 2 : f < 30 ? 0 : 1; }
  function drawSoil(c, x, y, px, py, tl) {
    const L = !isTilled(x - 1, y), Rr = !isTilled(x + 1, y), U = !isTilled(x, y - 1), Dn = !isTilled(x, y + 1);
    const x0 = px + (L ? 2.5 : 0), x1 = px + TS - (Rr ? 2.5 : 0), y0 = py + (U ? 2.5 : 0), y1 = py + TS - (Dn ? 2.5 : 0);
    const wet = tl.wet;
    const fc = fertCat(tl);
    const SOIL = wet ? [['#7a6044', '#5a4430', '#927656'], ['#5e3d26', '#40281a', '#7a5638'], ['#46301e', '#2e1d0f', '#5e4029']]
                     : [['#b39068', '#8f7050', '#cbab80'], ['#91643f', '#6c4629', '#b07e52'], ['#6c4a2c', '#4a301a', '#8a6040']];
    const [base, dark, lite] = SOIL[fc];
    const rad = [U && L ? 7 : 0, U && Rr ? 7 : 0, Dn && Rr ? 7 : 0, Dn && L ? 7 : 0];
    rrect4(c, x0, y0, x1 - x0, y1 - y0, rad); c.fillStyle = dark; c.fill();
    rrect4(c, x0 + (L ? 1.5 : 0), y0 + (U ? 1 : 0), x1 - x0 - (L ? 1.5 : 0) - (Rr ? 1.5 : 0), y1 - y0 - (U ? 1 : 0) - (Dn ? 2.5 : 0), rad.map(v => v ? 6 : 0)); c.fillStyle = base; c.fill();
    // sulcos
    for (let k = 0; k < 3; k++) {
      const yy = py + 9 + k * 12.5;
      c.fillStyle = lite; c.fillRect(x0 + (L ? 3 : 0), yy, x1 - x0 - (L ? 3 : 0) - (Rr ? 3 : 0), 2.5);
      c.fillStyle = dark; c.fillRect(x0 + (L ? 3 : 0), yy + 3.5, x1 - x0 - (L ? 3 : 0) - (Rr ? 3 : 0), 2.5);
    }
    const r = rng(x * 131 + y * 977);
    for (let k = 0; k < 6; k++) { const cx = px + 5 + r() * 34, cy = py + 5 + r() * 34; c.fillStyle = r() < 0.5 ? lite : dark; c.fillRect(cx, cy, 2, 1.5); }
    if (wet) {
      c.fillStyle = 'rgba(160,200,255,0.16)';
      for (let k = 0; k < 3; k++) c.fillRect(x0 + (L ? 3 : 0), py + 9 + k * 12.5, x1 - x0 - (L ? 3 : 0) - (Rr ? 3 : 0), 1.2);
      c.fillStyle = 'rgba(220,235,255,0.35)'; c.fillRect(px + 8 + r() * 20, py + 10, 4, 1); c.fillRect(px + 12 + r() * 20, py + 35, 3, 1);
    }
    if (fc === 2) for (let k = 0; k < 10; k++) { c.fillStyle = k % 4 ? 'rgba(25,14,5,0.6)' : 'rgba(140,170,70,0.6)'; c.fillRect(px + 5 + r() * 32, py + 5 + r() * 32, 1.6, 1.2); }
    if (fc === 0) { c.strokeStyle = 'rgba(90,65,40,0.55)'; c.lineWidth = 0.8; c.beginPath(); for (let k = 0; k < 3; k++) { let qx = px + 6 + r() * 30, qy = py + 6 + r() * 30; c.moveTo(qx, qy); for (let s2 = 0; s2 < 3; s2++) { qx += (r() - 0.5) * 8; qy += 2 + r() * 4; c.lineTo(qx, qy); } } c.stroke(); }
    if (tl.fert || (tl.c && tl.c.fert)) {
      for (let k = 0; k < 9; k++) { c.fillStyle = k % 3 ? 'rgba(35,18,6,0.65)' : 'rgba(210,180,90,0.7)'; c.fillRect(px + 6 + r() * 30, py + 6 + r() * 30, 2.5, 2.5); }
    }
  }

  // mangueira de gotejamento: passa entre os sulcos e se liga aos vizinhos
  function hasDrip(x, y) { const n = G.tile(x, y); return !!(n && n.drip); }
  function drawDrip(c, x, y, px, py, tl) {
    const L = hasDrip(x - 1, y), Rr = hasDrip(x + 1, y), U = hasDrip(x, y - 1), Dn = hasDrip(x, y + 1);
    const hy = py + 21, xa = L ? px : px + 5, xb = Rr ? px + TS : px + TS - 5;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(xa, hy + 1.2); c.lineTo(xb, hy + 1.2); c.stroke();
    c.strokeStyle = '#1f1f22'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(xa, hy); c.lineTo(xb, hy);
    if ((U || Dn) && !L) { c.moveTo(px + 5, U ? py : hy); c.lineTo(px + 5, Dn ? py + TS : hy); }
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(xa, hy - 0.7); c.lineTo(xb, hy - 0.7); c.stroke();
    if (!L && !U && !Dn) { circ(c, xa, hy, 1.8, '#3a3a40'); }
    if (!Rr) circ(c, xb, hy, 1.6, '#3a3a40');
    for (const ex of [px + 11, px + 22, px + 33]) {
      if (ex < xa || ex > xb) continue;
      circ(c, ex, hy, 1.4, '#2f6fa5');
      if (tl.wet) { ell(c, ex, hy + 4, 3.2, 1.4, 'rgba(40,25,15,0.35)'); c.fillStyle = 'rgba(170,215,255,0.9)'; c.beginPath(); c.moveTo(ex, hy + 1.5); c.quadraticCurveTo(ex + 1.6, hy + 4, ex, hy + 4.8); c.quadraticCurveTo(ex - 1.6, hy + 4, ex, hy + 1.5); c.fill(); }
    }
    c.lineCap = 'butt';
  }

  function ensureChunk(cx, cy) {
    const key = cx + ',' + cy;
    let ch = chunks.get(key);
    const sig = chunkSig(cx, cy);
    if (ch && ch.sig === sig) return ch;
    if (!ch) {
      const sc = Math.round(CPX * Math.min(dpr, 1.5)) / CPX;
      const c = document.createElement('canvas'); c.width = c.height = Math.ceil(CPX * sc);
      ch = { cv: c, sc, sig: 0 }; chunks.set(key, ch);
    }
    ch.sig = sig; buildChunk(cx, cy, ch);
    return ch;
  }
  function drawGroundChunks() {
    const ncx = Math.ceil(G.W / CH), ncy = Math.ceil(G.H / CH);
    const cx0 = Math.max(0, Math.floor(cam.x / CPX)), cy0 = Math.max(0, Math.floor(cam.y / CPX));
    const cx1 = Math.min(ncx - 1, Math.floor((cam.x + VW) / CPX)), cy1 = Math.min(ncy - 1, Math.floor((cam.y + VH) / CPX));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const ch = ensureChunk(cx, cy);
      ctx.drawImage(ch.cv, cx * CPX - cam.x, cy * CPX - cam.y, CPX, CPX);
    }
    // pré-carrega um bloco vizinho por quadro
    for (let cy = Math.max(0, cy0 - 1); cy <= Math.min(ncy - 1, cy1 + 1); cy++) for (let cx = Math.max(0, cx0 - 1); cx <= Math.min(ncx - 1, cx1 + 1); cx++) {
      if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) continue;
      const ch = chunks.get(cx + ',' + cy);
      if (!ch || ch.sig !== chunkSig(cx, cy)) { ensureChunk(cx, cy); return; }
    }
  }


  // ---------- vista de longe: chão + objetos estáticos pré-compostos por bloco ----------
  const farChunks = new Map();
  const FAR_ROWS = 5, FAR_COLS = 2;
  function farSig(cx, cy, night, bById) {
    let s = chunkSig(cx, cy) ^ (night ? 0x5bd1e995 : 0);
    const x0 = cx * CH - FAR_COLS, x1 = cx * CH + CH - 1 + FAR_COLS, y0 = cy * CH, y1 = Math.min(G.H - 1, cy * CH + CH - 1 + FAR_ROWS);
    for (let y = y0; y <= y1; y++) for (let x = Math.max(0, x0); x <= Math.min(G.W - 1, x1); x++) {
      const tl = S.tiles[y * G.W + x], o = tl.o, c = tl.c;
      let code = 0;
      if (c) { const cr = D.crops[c.id]; code = 7 + (cr ? cropStage(c, cr) : 0) * 3 + (c.dead ? 1 : 0) + (c.pest ? 2 : 0) + c.id.length * 31; }
      if (o) {
        if (o.t === 'b') { const b = bById.get(o.id); code += b ? b.id * 977 + (b.level | 0) * 13 + bVariant(b) * 7 + 1 : 3; }
        else if (o.t === 'fruit') { const f = D.fruits[o.k]; code += 50 + o.k.length * 17 + (o.ready ? 5 : 0) + Math.round(clamp((o.timer || 0) / ((f && f.every) || 1), 0, 1) * 4) + Math.min(4, Math.floor((o.age || 0) / ((f && f.mature) || 1) * 4)) * 11; }
        else code += (o.t.charCodeAt(0) * 3 + (o.v || 0) * 5 + (o.hp || 0));
      }
      s = (Math.imul(s, 31) + code) | 0;
    }
    return s;
  }
  function buildFar(cx, cy, fc, bById) {
    const g = ensureChunk(cx, cy);
    const c = fc.cv.getContext('2d');
    c.setTransform(fc.sc, 0, 0, fc.sc, 0, 0);
    c.clearRect(0, 0, CPX, CPX);
    c.drawImage(g.cv, 0, 0, CPX, CPX);
    const mainCtx = ctx, cx0 = cam.x, cy0 = cam.y, t0 = t;
    ctx = c; cam.x = cx * CPX; cam.y = cy * CPX; t = 0;
    try {
      c.save(); c.beginPath(); c.rect(0, 0, CPX, CPX); c.clip();
      for (const b of S.buildings) if (b.type === 'ponte' && b.x >= cx * CH - 1 && b.x <= cx * CH + CH && b.y >= cy * CH - 1 && b.y <= cy * CH + CH) drawBuilding(b, true);
      const drawn = new Set();
      const y0 = cy * CH, y1 = Math.min(G.H - 1, cy * CH + CH - 1 + FAR_ROWS), xa = Math.max(0, cx * CH - FAR_COLS), xb = Math.min(G.W - 1, cx * CH + CH - 1 + FAR_COLS);
      for (let y = y0; y <= y1; y++) for (let x = xa; x <= xb; x++) {
        const tile = S.tiles[y * G.W + x], px = x * TS - cam.x, py = y * TS - cam.y;
        if (tile.c) drawCrop(px, py, tile.c, x, y);
        const o = tile.o;
        if (!o) continue;
        if (o.t === 'weed') drawWeed(px, py, o, x, y);
        else if (o.t === 'rock') drawRock(px, py, o, x);
        else if (o.t === 'tree') drawTree(px, py, o, x, y);
        else if (o.t === 'fruit') drawFruitTree(px, py, o, x, y);
        else if (o.t === 'b' && !drawn.has(o.id)) {
          const b = bById.get(o.id), def = b && D.buildings[b.type];
          if (def && b.type !== 'ponte' && y === b.y + def.h - 1) { drawn.add(o.id); drawBuilding(b, true); }
        }
      }
      c.restore();
    } finally { ctx = mainCtx; cam.x = cx0; cam.y = cy0; t = t0; }
  }
  function drawFarLayer(bById) {
    const ncx = Math.ceil(G.W / CH), ncy = Math.ceil(G.H / CH), night = G.isNight();
    const cx0 = Math.max(0, Math.floor(cam.x / CPX)), cy0 = Math.max(0, Math.floor(cam.y / CPX));
    const cx1 = Math.min(ncx - 1, Math.floor((cam.x + VW) / CPX)), cy1 = Math.min(ncy - 1, Math.floor((cam.y + VH) / CPX));
    const sc = Math.round(CPX * Math.min(dpr, 1) * 0.6) / CPX; // tamanho inteiro: evita frestas entre blocos
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cx + ',' + cy;
      let fc = farChunks.get(key);
      if (!fc || fc.scale !== sc) { const cvs = document.createElement('canvas'); cvs.width = cvs.height = Math.ceil(CPX * sc); fc = { cv: cvs, sc, scale: sc, sig: null }; farChunks.set(key, fc); }
      // assinatura conferida em rodízio (um terço dos blocos por quadro) para poupar CPU
      if (fc.sig === null || ((cx + cy + frameN) % 3 === 0)) {
        const sig = farSig(cx, cy, night, bById);
        if (sig !== fc.sig) { fc.sig = sig; buildFar(cx, cy, fc, bById); }
      }
      const ov = 1 / Z; ctx.drawImage(fc.cv, cx * CPX - cam.x, cy * CPX - cam.y, CPX + ov, CPX + ov);
    }
  }
  let frameN = 0;

  // brilho animado da água
  function drawWaterFx(x0, y0, x1, y1) {
    const rain = S.weather === 'chuva';
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath();
    const sparks = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const tl = S.tiles[y * G.W + x];
      if (tl.g !== 'water') continue;
      const h = hash(x + 5, y + 9), px = x * TS - cam.x, py = y * TS - cam.y;
      const n = G.tile(x, y - 1), s2 = G.tile(x, y + 1);
      if (!n || n.g !== 'water' || !s2 || s2.g !== 'water') continue;
      if (h > 0.35) {
        const o = Math.sin(t * 1.3 + x * 0.9 + y * 0.6) * 4, yy = py + 12 + h * 18;
        ctx.moveTo(px + 8 + o, yy); ctx.quadraticCurveTo(px + 14 + o, yy - 2.5, px + 20 + o, yy);
        if (h > 0.7) { const y2 = py + 34 - h * 6; ctx.moveTo(px + 22 - o, y2); ctx.quadraticCurveTo(px + 27 - o, y2 - 2, px + 32 - o, y2); }
      }
      if (!rain && Math.sin(t * 2.2 + h * 40) > 0.94) sparks.push(px + 10 + h * 24, py + 10 + ((h * 997) % 1) * 24);
    }
    ctx.stroke();
    for (let i = 0; i < sparks.length; i += 2) star4(ctx, sparks[i], sparks[i + 1], 3.2, 'rgba(255,255,255,0.85)');
    if (rain) {
      ctx.strokeStyle = 'rgba(230,240,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (S.tiles[y * G.W + x].g !== 'water') continue;
        const h = hash(x * 7, y * 3), k = (t * 1.1 + h * 7) % 1, px = x * TS - cam.x + 8 + h * 28, py = y * TS - cam.y + 8 + ((h * 113) % 1) * 28;
        ctx.moveTo(px + 1 + k * 9, py); ctx.ellipse(px, py, 1 + k * 9, (1 + k * 9) * 0.45, 0, 0, TAU);
      }
      ctx.stroke();
    }
  }

  // =============================================================
  // OBJETOS
  // =============================================================
  // ----- árvores -----
  function canopy(c, cx, cy, R, cols, r, sxs = 1, n = 9) {
    const blobs = [];
    for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.55; blobs.push([cx + Math.cos(a) * d * sxs, cy + Math.sin(a) * d * 0.8, R * (0.42 + r() * 0.2)]); }
    blobs.sort((a, b) => a[1] - b[1]);
    c.fillStyle = cols[0]; c.beginPath(); for (const b of blobs) { c.moveTo(b[0] + b[2] + 1.5, b[1] + 2); c.arc(b[0] + 0.5, b[1] + 2, b[2] + 1.5, 0, TAU); } c.fill();
    c.fillStyle = cols[1]; c.beginPath(); for (const b of blobs) { c.moveTo(b[0] - 1 + b[2] * 0.92, b[1] - 1); c.arc(b[0] - 1, b[1] - 1, b[2] * 0.92, 0, TAU); } c.fill();
    c.fillStyle = cols[2]; c.beginPath(); for (const b of blobs) { if (b[0] > cx + R * 0.3 && b[1] > cy) continue; const rr = b[2] * 0.55; c.moveTo(b[0] - b[2] * 0.3 + rr, b[1] - b[2] * 0.35); c.arc(b[0] - b[2] * 0.3, b[1] - b[2] * 0.35, rr, 0, TAU); } c.fill();
    c.fillStyle = cols[3]; c.beginPath(); for (const b of blobs) { if (b[1] > cy + 2 || b[0] > cx + 4) continue; const rr = b[2] * 0.22; c.moveTo(b[0] - b[2] * 0.4 + rr, b[1] - b[2] * 0.5); c.arc(b[0] - b[2] * 0.4, b[1] - b[2] * 0.5, rr, 0, TAU); } c.fill();
    // textura de folhas
    c.fillStyle = 'rgba(0,30,0,0.16)';
    for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.9; const x = cx + Math.cos(a) * d * sxs, y = cy + Math.sin(a) * d * 0.8; c.beginPath(); c.arc(x, y, 1.6, 0.2, 2.9); c.fill(); }
    return blobs;
  }
  function trunk(c, h, wTop, col) {
    ell(c, 0, -1, 19, 6, 'rgba(10,30,5,0.24)');
    c.fillStyle = col; c.beginPath();
    c.moveTo(-wTop - 3, 0); c.quadraticCurveTo(-wTop, -4, -wTop, -h); c.lineTo(wTop, -h); c.quadraticCurveTo(wTop, -4, wTop + 4, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(1, -h, wTop, h - 1);
    c.strokeStyle = 'rgba(40,20,5,0.4)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-2, -4); c.lineTo(-2.5, -h * 0.5); c.moveTo(2.5, -h * 0.3); c.lineTo(2, -h * 0.75); c.stroke();
  }
  function branch(c, x, y, ang, len, w, depth, r, snow) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    c.strokeStyle = '#5e4330'; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
    if (snow && w > 1.2) { c.strokeStyle = 'rgba(250,252,255,0.95)'; c.lineWidth = w * 0.55; c.beginPath(); c.moveTo(x, y - w * 0.45); c.lineTo(x2, y2 - w * 0.45); c.stroke(); }
    if (depth <= 0) return;
    const sp = 0.35 + r() * 0.3;
    branch(c, x2, y2, ang - sp, len * (0.62 + r() * 0.15), w * 0.65, depth - 1, r, snow);
    branch(c, x2, y2, ang + sp, len * (0.62 + r() * 0.15), w * 0.65, depth - 1, r, snow);
  }
  function treeSprite(v, k, season) {
    return sprite(`tree|${v}|${k}|${season}`, 96, 116, 48, 106, c => {
      const r = rng(v * 100 + k * 7 + 3);
      if (v === 3) { // pinheiro
        trunk(c, 16, 3.5, '#6b4226');
        const cols = season === 2 ? ['#1f4a2c', '#2d6838', '#46874a', '#7fb070'] : ['#1b4c2c', '#286a3a', '#3d8a4a', '#79b86e'];
        for (let i = 0; i < 4; i++) {
          const yb = -14 - i * 15, wd = 24 - i * 5, ht = 26 - i * 2;
          c.fillStyle = cols[0]; c.beginPath(); c.moveTo(0, yb - ht);
          for (let z = 0; z <= 6; z++) { const xx = wd - z * (wd * 2 / 6); c.lineTo(xx, yb + (z % 2 ? -2 : 2)); }
          c.closePath(); c.fill();
          c.fillStyle = cols[1]; c.beginPath(); c.moveTo(0, yb - ht + 2); c.lineTo(-wd + 3, yb - 1); c.lineTo(wd * 0.3, yb - 2); c.closePath(); c.fill();
          c.fillStyle = cols[2]; c.beginPath(); c.moveTo(-1, yb - ht + 5); c.lineTo(-wd * 0.7, yb - 4); c.lineTo(-wd * 0.15, yb - 5); c.closePath(); c.fill();
          if (season === 3) {
            c.fillStyle = '#f5f9fc'; c.beginPath(); c.moveTo(0, yb - ht); c.lineTo(-wd * 0.62, yb - ht * 0.38); c.quadraticCurveTo(-wd * 0.3, yb - ht * 0.48, -wd * 0.1, yb - ht * 0.35);
            c.quadraticCurveTo(wd * 0.25, yb - ht * 0.5, wd * 0.55, yb - ht * 0.42); c.closePath(); c.fill();
          } else if (season === 0) { c.fillStyle = 'rgba(170,230,120,0.7)'; for (let z = 0; z < 4; z++) circ(c, -wd + 4 + z * wd * 0.5, yb - 1, 1.4); }
        }
        return;
      }
      if (season === 3) { // galhos nus com neve
        trunk(c, 26, 4.5, '#6e4b30');
        branch(c, 0, -24, -Math.PI / 2 + (r() - 0.5) * 0.3, 18, 5, 3, r, true);
        branch(c, 0, -20, -Math.PI / 2 - 0.7, 12, 3, 2, r, true);
        branch(c, 0, -22, -Math.PI / 2 + 0.75, 12, 3, 2, r, true);
        ell(c, 0, -1, 12, 3.5, 'rgba(255,255,255,0.9)');
        return;
      }
      const pal = LEAFPAL[season][v % 3];
      trunk(c, v === 1 ? 30 : 26, 4.5, '#7a4f2a');
      let blobs;
      if (v === 1) { blobs = canopy(c, 0, -36, 18, pal, r, 1, 7).concat(canopy(c, 0, -60, 14, pal, r, 1, 6)); }
      else if (v === 2) blobs = canopy(c, 0, -42, 24, pal, r, 1.25, 11);
      else blobs = canopy(c, 0, -44, 22, pal, r, 1, 10);
      if (season === 0 && v !== 1) { // flores (ipê/cerejeira)
        const cols = v === 2 ? ['#fff4fa', '#ffd9ea'] : ['#ffb7d5', '#ff8fbd'];
        for (let i = 0; i < 26; i++) { const b = blobs[Math.floor(r() * blobs.length)], a = r() * TAU, d = r() * b[2] * 0.8; circ(c, b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d - 1, 1.6 + r() * 0.8, cols[i % 2]); }
      } else if (season === 2) {
        const cols = ['#f2b33d', '#d65a2c', '#a3341f'];
        for (let i = 0; i < 18; i++) { const b = blobs[Math.floor(r() * blobs.length)], a = r() * TAU, d = r() * b[2] * 0.8; circ(c, b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d, 1.5, cols[i % 3]); }
      }
    });
  }
  function drawTree(px, py, o, x, y) {
    const v = o.v || 0, h = hash(x, y), k = Math.floor(h * 3);
    const s = treeSprite(v, k, S.season);
    const cx = px + TS / 2, by = py + TS - 5;
    const amp = S.season === 3 && v !== 3 ? 0 : (S.weather === 'chuva' ? 0.06 : 0.035);
    blitSway(s, cx, by, Math.sin(t * 1.1 + x * 0.7 + y * 0.4), amp);
    if (o.hp < 3) {
      ctx.fillStyle = '#f2d6a0'; ctx.beginPath(); ctx.moveTo(cx - 5, by - 13); ctx.lineTo(cx + 1, by - 10); ctx.lineTo(cx - 5, by - 7); ctx.fill();
      ctx.fillStyle = '#c99a62'; ctx.fillRect(cx - 5, by - 10.5, 4, 1);
    }
  }

  // ----- árvores frutíferas -----
  // ----- árvores frutíferas e trepadeiras -----
  const FRUITC = {
    laranja: ['#f28c1c', '#ffc46a'], limao: ['#86c43a', '#c6ef7a'], manga: ['#f2a83a', '#ffd88a', '#e0503a'], abacate: ['#3f6a26', '#7aa34a'],
    banana: ['#f5d43a', '#fff1a0'], acerola: ['#e0202a', '#ff8a8a'], jabuticaba: ['#2a1630', '#8a6aa0'], coco: ['#b89a3a', '#e0cc7a'],
    uva: ['#6a2a7a', '#b07ac0'], maracuja: ['#f0cc2a', '#fff2a0'],
  };
  function paintTrellis(c, cx, by, snow) {
    for (const px of [cx - 18, cx + 18]) {
      ell(c, px + 1, by + 1, 4, 1.6, 'rgba(10,25,5,0.25)');
      c.fillStyle = '#6e4626'; c.fillRect(px - 2.5, by - 44, 5, 45); c.fillStyle = '#9a6a3a'; c.fillRect(px - 2.5, by - 44, 1.6, 45);
      if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(px - 3, by - 46, 6, 2.5); }
    }
    c.fillStyle = '#8a5a30'; c.fillRect(cx - 22, by - 45, 44, 3.5); c.fillStyle = '#b07a44'; c.fillRect(cx - 22, by - 45, 44, 1);
    c.strokeStyle = 'rgba(200,205,210,0.9)'; c.lineWidth = 0.9; c.beginPath();
    for (const wy of [-12, -22, -32]) { c.moveTo(cx - 18, by + wy); c.lineTo(cx + 18, by + wy); }
    c.stroke();
  }
  function trellisSprite(k, season, st) {
    let pts = [];
    const s = sprite(`vine|${k}|${season}|${st}`, 70, 70, 35, 62, c => {
      paintTrellis(c, 0, 0, season === 3);
      if (st < 0) return;
      const r = rng(k.length * 7 + st), grape = k === 'uva';
      const bare = grape && season === 3;
      const lc = grape ? (season === 2 ? ['#b8862a', '#d8a83a', '#a8402a'] : ['#3f8a35', '#5aa845', '#7cc456']) : ['#2f7a2f', '#45983a', '#6cbf4a'];
      const cover = [0.3, 0.6, 0.85, 1][st];
      // troncos/ramos
      c.strokeStyle = grape ? '#6b4a2a' : '#4f7a2a'; c.lineWidth = grape ? 2.6 : 1.6;
      c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(-8, -14, -2, -22); c.stroke();
      c.lineWidth = grape ? 1.6 : 1.2; c.beginPath();
      for (const wy of [-12, -22, -32]) {
        if (-wy / 34 > cover + 0.15) continue;
        const ext = 17 * Math.min(1, cover * 1.3);
        c.moveTo(-ext, wy); for (let x = -ext; x <= ext; x += 4) c.lineTo(x, wy + Math.sin(x * 0.6 + wy) * 1.5);
      }
      c.stroke();
      if (!bare) {
        const n = Math.round(30 * cover);
        for (let i = 0; i < n; i++) {
          const x = (r() - 0.5) * 38 * Math.min(1, cover * 1.3), y = -8 - r() * 30 * cover;
          const col = lc[Math.floor(r() * 3)], rr = grape ? 3.4 + r() * 1.4 : 2.8 + r() * 1.2;
          if (grape) { c.fillStyle = col; c.beginPath(); for (let q = 0; q < 3; q++) { const a = -1.57 + (q - 1) * 0.9; c.moveTo(x + Math.cos(a) * rr * 0.6 + rr * 0.7, y + Math.sin(a) * rr * 0.6); c.arc(x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6, rr * 0.7, 0, TAU); } c.fill(); }
          else { for (let q = -1; q <= 1; q++) leaf(c, x, y, rr * 1.4, rr * 0.45, -1.57 + q * 0.8, col); }
        }
        if (!grape && st >= 2 && season < 3) for (let i = 0; i < 3; i++) {
          const x = -12 + i * 12, y = -30 + (i % 2) * 8;
          c.fillStyle = '#ffffff'; for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; ell(c, x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 1.6, 1.6, '#ffffff'); }
          c.strokeStyle = '#7a3aa0'; c.lineWidth = 0.8; c.beginPath(); for (let q = 0; q < 14; q++) { const a = q / 14 * TAU; c.moveTo(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4); c.lineTo(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6); } c.stroke();
          circ(c, x, y, 1.2, '#d8e85a');
        }
      } else { c.strokeStyle = '#f4f8fb'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-17, -33.5); c.lineTo(17, -33.5); c.stroke(); }
      for (const wy of [-12, -22, -32]) if (-wy / 34 <= cover) for (const x of [-12, 0, 12]) pts.push([x + (wy % 3), wy + (grape ? 5 : 4)]);
    });
    if (pts.length) s.pts = pts;
    return s;
  }
  function fruitSprite(k, season) {
    let pts = null;
    const s = sprite(`fruit|${k}|${season}`, 140, 160, 70, 150, c => {
      const r = rng(k.length * 13 + 5);
      pts = [];
      const winter = season === 3;
      if (k === 'banana' || k === 'coco') {
        const tall = k === 'coco' ? 104 : 60, lean = k === 'coco' ? 10 : 2;
        ell(c, 0, -1, 18, 5.5, 'rgba(10,30,5,0.24)');
        c.strokeStyle = k === 'coco' ? '#8a7a5a' : '#8a8a4a'; c.lineWidth = k === 'coco' ? 6 : 8; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * 1.6, -tall * 0.5, lean, -tall); c.stroke();
        c.strokeStyle = 'rgba(50,35,15,0.35)'; c.lineWidth = 1;
        for (let i = 1; i < (k === 'coco' ? 14 : 7); i++) { const q = i / (k === 'coco' ? 14 : 7), x = lean * 1.6 * 2 * q * (1 - q) + lean * q * q; c.beginPath(); c.moveTo(x - 3, -tall * q); c.lineTo(x + 3, -tall * q - 1.5); c.stroke(); }
        const hx = lean, hy = -tall;
        if (k === 'coco') {
          const fc = winter ? ['#4f7a48', '#6f9a5e'] : ['#2f7a2f', '#5aa845'];
          for (const [a, l] of [[-2.9, 40], [-0.25, 40], [-2.3, 36], [-0.85, 36], [-1.57, 26], [-3.4, 30], [0.25, 30], [-1.2, 30], [-1.95, 30]]) {
            const ex = hx + Math.cos(a) * l, ey = hy + Math.sin(a) * l * 0.55 + (Math.abs(Math.cos(a)) > 0.5 ? 12 : 0);
            const cx2 = hx + Math.cos(a) * l * 0.5, cy2 = hy + Math.sin(a) * l * 0.5 - 8;
            c.strokeStyle = fc[0]; c.lineWidth = 2.4; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(cx2, cy2, ex, ey); c.stroke();
            for (let q = 0.15; q < 1; q += 0.09) {
              const t1 = q, bx = (1 - t1) * (1 - t1) * hx + 2 * (1 - t1) * t1 * cx2 + t1 * t1 * ex, by = (1 - t1) * (1 - t1) * hy + 2 * (1 - t1) * t1 * cy2 + t1 * t1 * ey;
              const ln = 9 * (1 - q * 0.55);
              c.strokeStyle = q % 0.18 < 0.09 ? fc[0] : fc[1]; c.lineWidth = 1.8; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + 1.5, by + ln); c.moveTo(bx, by); c.lineTo(bx - 1.5, by + ln); c.stroke();
            }
          }
          for (const [dx, dy] of [[-4, 4], [3, 5], [-0.5, 8], [5, 1], [-6, 0]]) pts.push([hx + dx, hy + dy]);
        } else {
          const cols = winter ? ['#5f8a48', '#7ba75e'] : season === 2 ? ['#6f9a38', '#94b84e'] : ['#3f9a3c', '#62bd52'];
          for (const [a, l] of [[-2.8, 38], [-0.35, 38], [-2.2, 32], [-0.95, 33], [-1.6, 26], [-3.1, 28], [-0.05, 28]]) {
            const ex = hx + Math.cos(a) * l, ey = hy + Math.sin(a) * l * 0.8 + 8;
            c.strokeStyle = cols[0]; c.lineWidth = 9; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + (ex - hx) * 0.5, hy + Math.sin(a) * l * 0.7 - 8, ex, ey); c.stroke();
            c.strokeStyle = cols[1]; c.lineWidth = 4; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + (ex - hx) * 0.5, hy + Math.sin(a) * l * 0.7 - 9, ex, ey - 1); c.stroke();
            c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + (ex - hx) * 0.5, hy + Math.sin(a) * l * 0.7 - 8, ex, ey); c.stroke();
          }
          c.strokeStyle = '#6a7a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx + 3, hy + 2); c.quadraticCurveTo(hx + 9, hy + 6, hx + 8, hy + 22); c.stroke();
          ell(c, hx + 8, hy + 25, 2.8, 4, '#7a2a4a');
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) pts.push([hx + 4 + j * 3, hy + 8 + i * 4.5]);
        }
        return;
      }
      if (k === 'jabuticaba') {
        ell(c, 0, -1, 20, 6, 'rgba(10,30,5,0.24)');
        const trunks = [[-8, -0.35], [-3, -0.12], [3, 0.1], [8, 0.38]];
        for (const [bx, a] of trunks) {
          const ex = bx + Math.sin(a) * 40, ey = -44;
          c.strokeStyle = '#8f877a'; c.lineWidth = 6; c.beginPath(); c.moveTo(bx * 0.4, 0); c.quadraticCurveTo(bx, -22, ex, ey); c.stroke();
          c.strokeStyle = '#c9c0b2'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx * 0.4 - 1, 0); c.quadraticCurveTo(bx - 1, -22, ex - 1, ey); c.stroke();
          for (let q = 0.2; q < 0.95; q += 0.14) { const t1 = q, x = (1 - t1) * (1 - t1) * bx * 0.4 + 2 * (1 - t1) * t1 * bx + t1 * t1 * ex, y = -44 * t1 + 2 * (1 - t1) * t1 * 0; pts.push([x + (r() - 0.5) * 3, y - 2 + (r() - 0.5) * 4]); if (r() < 0.5) ell(c, x + 1, y, 1.6, 2.4, 'rgba(120,100,80,0.45)'); }
        }
        const pal = winter ? ['#2f5034', '#41683f', '#5e8a5a', '#a7c8a4'] : ['#1f5a2a', '#2f7a33', '#4f9a45', '#8ac466'];
        const blobs = canopy(c, 0, -62, 26, pal, r, 1.2, 12);
        if (winter) for (const b of blobs) if (b[1] < -66) ell(c, b[0] - 1, b[1] - b[2] * 0.6, b[2] * 0.6, 2.2, 'rgba(250,252,255,0.9)');
        return;
      }
      const cfg = {
        laranja: { R: 32, cy: -66, sq: 1.05, tr: 40, base: '#2f7f34' }, limao: { R: 30, cy: -62, sq: 1.1, tr: 36, base: '#3b8f3a' },
        manga: { R: 36, cy: -72, sq: 1.2, tr: 42, base: '#1f6a30' }, abacate: { R: 27, cy: -60, sq: 0.95, tr: 40, base: '#2f7a30', two: true },
        acerola: { R: 25, cy: -44, sq: 1.3, tr: 24, base: '#3f9a3a', bush: true },
      }[k] || { R: 24, cy: -50, sq: 1, tr: 30, base: '#2f7f34' };
      ell(c, 0, -1, cfg.R * 0.8, 6, 'rgba(10,30,5,0.24)');
      if (cfg.bush) {
        for (const [bx, a] of [[-4, -0.4], [0, 0], [4, 0.4]]) { c.strokeStyle = '#7a5a3a'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(bx * 0.3, 0); c.lineTo(bx + Math.sin(a) * 22, -cfg.tr); c.stroke(); }
      } else trunk(c, cfg.tr, k === 'manga' ? 5.5 : 4.5, '#80552e');
      let pal = [shade(cfg.base, -0.35), cfg.base, shade(cfg.base, 0.25), shade(cfg.base, 0.55)];
      if (winter) pal = ['#3f6448', '#557e5c', '#79a07c', '#b4d0b4'];
      let blobs = canopy(c, 0, cfg.cy, cfg.R, pal, r, cfg.sq, 12);
      if (cfg.two) blobs = blobs.concat(canopy(c, 0, cfg.cy - 26, cfg.R * 0.75, pal, r, 1, 8));
      if (season === 0 && (k === 'laranja' || k === 'limao' || k === 'acerola')) for (let i = 0; i < 18; i++) { const b = blobs[Math.floor(r() * blobs.length)]; circ(c, b[0] + (r() - 0.5) * b[2], b[1] + (r() - 0.5) * b[2], 1.5, k === 'acerola' ? '#ffc4dd' : '#ffffff'); }
      if (winter) for (const b of blobs) if (b[1] < cfg.cy - 4) ell(c, b[0] - 1, b[1] - b[2] * 0.6, b[2] * 0.6, 2.2, 'rgba(250,252,255,0.9)');
      const n = k === 'acerola' ? 14 : k === 'abacate' || k === 'manga' ? 7 : 10;
      const rr = rng(k.length * 99);
      for (let i = 0; i < n; i++) { const a = (i + rr() * 0.6) / n * TAU, d = cfg.R * (0.3 + rr() * 0.5); pts.push([Math.cos(a) * d * cfg.sq, cfg.cy + Math.sin(a) * d * 0.8 + 4]); }
      if (cfg.two) for (let i = 0; i < 3; i++) pts.push([(i - 1) * 9, cfg.cy - 24 + (i % 2) * 6]);
    });
    if (pts) s.pts = pts;
    return s;
  }
  function drawFruit(k, x, y, prog, ready) {
    const C = FRUITC[k] || ['#e0503a', '#ffa08a'];
    const un = k === 'jabuticaba' ? '#5f7f3a' : k === 'uva' ? '#9ac45a' : '#7fb03a';
    const col = ready ? C[0] : un, hl = ready ? C[1] : '#b8dc78', g = ready ? 1 : 0.45 + prog * 0.45;
    switch (k) {
      case 'uva': {
        const R = 1.9 * g; c2Bunch(x, y, R, col, hl); ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y - 4); ctx.stroke(); break;
      }
      case 'banana': { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, 1.4 * g, 3.2 * g, -0.4, 0, TAU); ctx.fill(); break; }
      case 'abacate': { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + 1, 3.2 * g, 4.4 * g, 0, 0, TAU); ctx.fill(); circ(ctx, x, y - 2.2 * g, 2.3 * g); circ(ctx, x - 1, y - 0.5, 0.9 * g, hl); break; }
      case 'manga': { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, 3 * g, 4 * g, 0.4, 0, TAU); ctx.fill(); if (ready) { ctx.fillStyle = 'rgba(224,80,58,0.65)'; ctx.beginPath(); ctx.ellipse(x - 1, y - 1.5, 1.8, 2, 0.4, 0, TAU); ctx.fill(); } circ(ctx, x + 1, y - 1.5, 0.8 * g, hl); break; }
      case 'acerola': case 'jabuticaba': { const R = 2.1 * g; circ(ctx, x, y, R, col); circ(ctx, x - R * 0.35, y - R * 0.35, R * 0.38, hl); break; }
      case 'coco': { const R = 4 * g; circ(ctx, x, y, R, ready ? C[0] : '#5a8a2a'); circ(ctx, x - R * 0.35, y - R * 0.35, R * 0.35, ready ? C[1] : '#8ab85a'); break; }
      default: { const R = (k === 'maracuja' ? 3.6 : 3.1) * g; circ(ctx, x, y, R, col); circ(ctx, x - R * 0.35, y - R * 0.35, R * 0.35, hl); if (k === 'maracuja') { ctx.strokeStyle = '#4f7a2a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y - R); ctx.lineTo(x, y - R - 3); ctx.stroke(); } else if (k === 'laranja' || k === 'limao') circ(ctx, x + 0.5, y - R + 0.6, 0.7, '#3f6a20'); }
    }
  }
  function c2Bunch(x, y, R, col, hl) {
    ctx.fillStyle = col; ctx.beginPath();
    for (const [dx, dy] of [[-1.5, 0], [1.5, 0], [0, 1.6], [-0.75, 3], [0.75, 3], [0, 4.5], [-2.6, -1.2], [2.6, -1.2]]) { ctx.moveTo(x + dx * R + R, y + dy * R); ctx.arc(x + dx * R, y + dy * R, R, 0, TAU); }
    ctx.fill(); ctx.fillStyle = hl; for (const [dx, dy] of [[-1.5, 0], [0, 1.6], [0.75, 3]]) circ(ctx, x + dx * R - R * 0.3, y + dy * R - R * 0.3, R * 0.35);
  }
  function drawFruitTree(px, py, o, x, y) {
    const f = D.fruits[o.k];
    if (!f) return;
    const gp = Math.min(1, (o.age || 0) / f.mature), mature = gp >= 1;
    const cx = px + TS / 2, by = py + TS - 4;
    const prog = o.ready ? 1 : clamp((o.timer || 0) / (f.every || 1), 0, 1);
    const fb = o.ready ? 'r' : prog > 0.05 ? Math.max(1, Math.round(prog * 4)) : 0;
    if (f.climber || o.trellis) {
      const st = gp < 0.35 ? 0 : gp < 0.7 ? 1 : gp < 1 ? 2 : 3;
      const base = trellisSprite(o.k, S.season, st);
      const show = mature && fb && !(o.k === 'uva' && S.season === 3 && !o.ready);
      blit(show ? withFruits(base, `vine|${o.k}|${S.season}|${st}`, o.k, fb) : base, cx, by);
      return;
    }
    const base = fruitSprite(o.k, S.season);
    const sc = mature ? 1 : 0.38 + gp * 0.5;
    if (mature) blitSway(fb ? withFruits(base, `fruit|${o.k}|${S.season}`, o.k, fb) : base, cx, by, Math.sin(t * 1.1 + x * 0.7 + y * 0.4), 0.03);
    else ctx.drawImage(base.cv, Math.round(cx - base.ox * sc), Math.round(by - base.oy * sc), base.w * sc, base.h * sc);
  }
  // árvore + frutos compostos num único sprite em cache (por estágio de maturação)
  function withFruits(base, key, k, fb) {
    if (!base.pts) return base;
    return sprite(key + '|f' + fb, base.w, base.h, base.ox, base.oy, c => {
      c.drawImage(base.cv, -base.ox, -base.oy, base.w, base.h);
      const main = ctx; ctx = c;
      try { const ready = fb === 'r', prog = ready ? 1 : fb / 4; for (const [fx, fy] of base.pts) drawFruit(k, fx, fy, prog, ready); }
      finally { ctx = main; }
    }, false);
  }

  // ----- pedras -----
  const ROCKS = [
    [[-15, 0], [-15, -9], [-8, -16], [3, -17], [12, -11], [16, -2], [14, 1]],
    [[-13, 0], [-12, -8], [-5, -13], [4, -12], [10, -6], [11, 0]],
    [[-17, 0], [-16, -6], [-9, -10], [6, -11], [15, -6], [17, 0]],
    [[-12, 0], [-10, -12], [-3, -20], [5, -17], [11, -7], [12, 0]],
  ];
  function rockSprite(v, season) {
    return sprite(`rock|${v}|${season}`, 50, 40, 25, 32, c => {
      const pts = ROCKS[v % 4], warm = v % 2 === 0;
      const base = warm ? '#9a948a' : '#8d9094', dark = warm ? '#6d675f' : '#62666c', lite = warm ? '#c2bcb0' : '#b8bcc2';
      ell(c, 1, 1, 18, 5, 'rgba(10,25,5,0.25)');
      if (v === 1) { ell(c, 13, -2, 6, 4, dark); ell(c, 12.5, -3, 5, 3.2, base); ell(c, 11.5, -4, 2.4, 1.4, lite); }
      c.fillStyle = dark; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
      c.fillStyle = base; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * 0.92 - 1, y * 0.92 - 1) : c.moveTo(x * 0.92 - 1, y * 0.92 - 1)); c.closePath(); c.fill();
      // face superior
      const top = pts.filter(p => p[1] < -4);
      c.fillStyle = lite; c.beginPath();
      top.forEach(([x, y], i) => { const X = x * 0.75 - 2, Y = y * 0.8 - 1; i ? c.lineTo(X, Y) : c.moveTo(X, Y); });
      c.lineTo(top[top.length - 1][0] * 0.4, -5); c.lineTo(top[0][0] * 0.5, -4); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(top[0][0] * 0.75 - 2, top[0][1] * 0.8 - 1);
      for (let i = 1; i < top.length; i++) c.lineTo(top[i][0] * 0.75 - 2, top[i][1] * 0.8 - 1); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(4, -5); c.lineTo(9, -1); c.moveTo(-6, -3); c.lineTo(-3, 0); c.stroke();
      const r = rng(v + 40); c.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 6; i++) c.fillRect(-10 + r() * 20, -12 + r() * 10, 1.3, 1.3);
      if (season === 3) {
        c.fillStyle = '#f6fafd'; c.beginPath(); top.forEach(([x, y], i) => { const X = x * 0.8 - 1, Y = y * 0.88 - 2; i ? c.lineTo(X, Y) : c.moveTo(X, Y); });
        c.quadraticCurveTo(top[top.length - 1][0] * 0.3, top[top.length - 1][1] * 0.4, 0, -7); c.quadraticCurveTo(top[0][0] * 0.4, top[0][1] * 0.3, top[0][0] * 0.8 - 1, top[0][1] * 0.88 - 2); c.fill();
      } else if (warm && season < 2) {
        c.fillStyle = 'rgba(96,150,58,0.85)'; c.beginPath(); c.ellipse(-6, top[0][1] * 0.6 - 3, 5, 2.5, -0.3, 0, TAU); c.fill();
        circ(c, -9, top[0][1] * 0.6 - 1, 1.8, 'rgba(120,175,70,0.9)');
      }
    });
  }
  function drawRock(px, py, o, x) {
    const v = o.v || 0, cx = px + TS / 2, by = py + TS - 7;
    blit(rockSprite(v, S.season), cx, by);
    if (o.hp < 2) { ctx.strokeStyle = '#3d3a36'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 2, by - 15); ctx.lineTo(cx + 2, by - 9); ctx.lineTo(cx - 3, by - 3); ctx.moveTo(cx + 2, by - 9); ctx.lineTo(cx + 6, by - 7); ctx.stroke(); }
  }

  // ----- mato -----
  function weedSprite(v, season) {
    return sprite(`weed|${v}|${season}`, 48, 44, 24, 38, c => {
      const g = season === 2 ? ['#7e7a2a', '#a69a3c', '#cdb25a'] : season === 3 ? ['#6f8676', '#8ea394', '#b7c7bb'] : season === 1 ? ['#2a6e26', '#3f8f2f', '#69b443'] : ['#307a2a', '#4a9a35', '#7cc452'];
      const r = rng(v * 9 + 1);
      ell(c, 0, 0, 13, 4, 'rgba(10,30,5,0.22)');
      if (v % 4 === 0) { // touceira de capim
        for (let i = 0; i < 13; i++) {
          const a = -Math.PI / 2 + (i / 12 - 0.5) * 2.1, l = 13 + r() * 9;
          c.strokeStyle = g[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2]; c.lineWidth = 2;
          c.beginPath(); c.moveTo((i - 6) * 0.8, 0); c.quadraticCurveTo(Math.cos(a) * l * 0.4, -l * 0.6, Math.cos(a) * l * 0.9, Math.sin(a) * l); c.stroke();
        }
        if (season === 1 || season === 2) { c.fillStyle = season === 2 ? '#e8d9a8' : '#d8c37a'; for (let i = 0; i < 4; i++) ell(c, -8 + i * 5, -18 - r() * 4, 1.4, 3, c.fillStyle); }
      } else if (v % 4 === 1) { // arbusto
        const pal = [g[0], g[1], g[2], shade(PAL[season].tuftL, 0.1)];
        canopy(c, 0, -9, 11, pal, r, 1.2, 7);
        if (season === 0) for (let i = 0; i < 5; i++) flower(c, -8 + r() * 16, -14 + r() * 9, '#ffffff', 1.2);
        if (season === 1) for (let i = 0; i < 5; i++) circ(c, -8 + r() * 16, -14 + r() * 10, 1.6, '#3b2a6a');
        if (season === 2) for (let i = 0; i < 5; i++) circ(c, -8 + r() * 16, -14 + r() * 10, 1.6, '#c0392b');
        if (season === 3) ell(c, -1, -16, 8, 3, 'rgba(250,252,255,0.95)');
      } else if (v % 4 === 2) { // samambaia
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i / 5 - 0.5) * 2.4, l = 14 + r() * 5;
          const ex = Math.cos(a) * l, ey = Math.sin(a) * l * 0.85;
          c.strokeStyle = g[0]; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(ex * 0.4, ey * 0.9 - 4, ex, ey); c.stroke();
          for (let s = 1; s <= 5; s++) {
            const k = s / 6, qx = ex * k, qy = ey * k - Math.sin(k * Math.PI) * 3, ln = (1 - k) * 5 + 1.5;
            leaf(c, qx, qy, ln, 1.2, a - 1.2, g[1 + (s % 2)]); leaf(c, qx, qy, ln, 1.2, a + 1.2, g[1 + ((s + 1) % 2)]);
          }
        }
      } else { // flores do campo
        for (let i = 0; i < 7; i++) leaf(c, (i - 3) * 1.5, 0, 9 + r() * 5, 2.4, -Math.PI / 2 + (i - 3) * 0.32, g[i % 3], 'rgba(0,0,0,0.15)');
        const fc = season === 0 ? '#ffd43a' : season === 1 ? '#b05ad8' : season === 2 ? '#f4efe4' : '#9a8a6a';
        for (let i = 0; i < 3; i++) {
          const fx = -6 + i * 6, fy = -17 - r() * 5;
          c.strokeStyle = g[0]; c.lineWidth = 1.2; c.beginPath(); c.moveTo(fx * 0.3, 0); c.lineTo(fx, fy); c.stroke();
          if (season === 2) { circ(c, fx, fy, 3.4, 'rgba(250,248,240,0.8)'); circ(c, fx, fy, 1.2, '#b8ab90'); }
          else { circ(c, fx, fy, 2.8, fc); circ(c, fx - 0.8, fy - 0.8, 1, 'rgba(255,255,255,0.6)'); }
        }
      }
    });
  }
  function drawWeed(px, py, o, x, y) {
    blitSway(weedSprite(o.v || 0, S.season), px + TS / 2, py + TS - 7, Math.sin(t * 2 + x * 1.3 + y), 0.07);
  }

  // ----- plantações -----
  function cropStage(c, crop) { const p = Math.min(1, c.g / crop.days); return p >= 1 ? 4 : p < 0.2 ? 0 : p < 0.45 ? 1 : p < 0.75 ? 2 : 3; }
  function paintCrop(c, id, st) {
    const crop = D.crops[id], col = crop.color, dk = shade(col, -0.3), lt = shade(col, 0.25), vein = 'rgba(0,40,0,0.25)';
    const r = rng(id.length * 31 + st);
    ell(c, 0, 1, 9 + st * 1.5, 3, 'rgba(40,20,5,0.3)');
    if (st === 0) {
      ell(c, 0, 0, 5, 2, '#5a3a22');
      c.strokeStyle = dk; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -6); c.stroke();
      leaf(c, 0, -6, 6, 2.6, -Math.PI / 2 - 0.9, lt, vein); leaf(c, 0, -6, 6, 2.6, -Math.PI / 2 + 0.9, col, vein);
      return;
    }
    const s = st === 4 ? 1 : [0, 0.45, 0.7, 0.9][st];
    switch (id) {
      case 'milho': {
        const hgt = 14 + 40 * s;
        c.strokeStyle = shade('#8fbf3a', -0.15); c.lineWidth = 3.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -hgt); c.stroke();
        c.strokeStyle = '#a8d04a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-0.8, 0); c.lineTo(-0.8, -hgt); c.stroke();
        const n = 3 + Math.floor(s * 3);
        for (let i = 0; i < n; i++) {
          const y = -hgt * (0.12 + i * 0.75 / n), side = i % 2 ? 1 : -1, l = 12 + 10 * s;
          c.strokeStyle = i % 2 ? col : dk; c.lineWidth = 3;
          c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(side * l * 0.55, y - 9, side * l, y + 2); c.stroke();
        }
        leaf(c, 0, -hgt, 9, 2, -Math.PI / 2 - 0.3, lt, vein);
        if (st === 4) {
          c.strokeStyle = '#d9b44a'; c.lineWidth = 1.2;
          for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, -hgt); c.quadraticCurveTo(i * 3, -hgt - 6, i * 5, -hgt - 3); c.stroke(); }
          for (const [ex, ey, a] of [[4, -hgt * 0.5, 0.35], [-4, -hgt * 0.32, -0.35]]) {
            c.save(); c.translate(ex, ey); c.rotate(a);
            ell(c, 0, 0, 3.6, 8, '#f2cf45');
            c.fillStyle = '#d9a92a'; for (let k = -2; k <= 2; k++) for (let q = -1; q <= 1; q++) c.fillRect(q * 2 - 0.5, k * 3 - 0.5, 1, 1);
            leaf(c, 0, 8, 12, 3, -Math.PI / 2 - 0.25, '#7ab83a'); leaf(c, 0, 8, 11, 2.6, -Math.PI / 2 + 0.3, '#5f9f2f');
            c.restore();
          }
        }
        break;
      }
      case 'trigo': {
        const hgt = 10 + 24 * s, gold = st === 4, sc = gold ? '#cfa84a' : col, hc = gold ? '#e6c25a' : lt;
        for (let i = -3; i <= 3; i++) {
          const ex = i * 2.6 + (r() - 0.5), ey = -hgt + Math.abs(i) * 1.5 + r() * 3;
          c.strokeStyle = i % 2 ? sc : shade(sc, -0.15); c.lineWidth = 1.5; c.beginPath(); c.moveTo(i * 0.8, 0); c.quadraticCurveTo(i * 1.2, ey * 0.5, ex, ey); c.stroke();
          if (st >= 3) {
            c.save(); c.translate(ex, ey - 3); c.rotate(i * 0.08);
            ell(c, 0, 0, 2.2, 5.5, hc);
            c.strokeStyle = shade(hc, -0.25); c.lineWidth = 0.7; c.beginPath();
            for (let k = -2; k <= 2; k++) { c.moveTo(-2, k * 2); c.lineTo(0, k * 2 - 1); c.lineTo(2, k * 2); }
            c.stroke();
            if (gold) { c.strokeStyle = 'rgba(240,220,150,0.8)'; c.beginPath(); c.moveTo(0, -5); c.lineTo(-1.5, -10); c.moveTo(0, -5); c.lineTo(1.5, -10); c.stroke(); }
            c.restore();
          }
        }
        if (!gold) { leaf(c, 0, -3, 10 * s + 4, 1.8, -Math.PI / 2 - 0.6, col); leaf(c, 0, -3, 10 * s + 4, 1.8, -Math.PI / 2 + 0.6, dk); }
        break;
      }
      case 'crotalaria': {
        const hgt = 12 + 32 * s;
        for (const [bx, lean] of [[-2, -0.12], [2, 0.14], [0, 0]]) {
          const tx = bx + lean * hgt, ty = -hgt + Math.abs(bx) * 3;
          c.strokeStyle = dk; c.lineWidth = 1.6; c.beginPath(); c.moveTo(bx * 0.4, 0); c.lineTo(tx, ty); c.stroke();
          for (let k = 1; k <= 5; k++) { const q = k / 6, lx = bx * 0.4 + (tx - bx * 0.4) * q, ly = ty * q; leaf(c, lx, ly, 5 + s * 2, 1.8, (k % 2 ? -0.5 : -Math.PI + 0.5), k % 2 ? col : lt, vein); }
          if (st === 3) for (let k = 0; k < 4; k++) circ(c, tx, ty - k * 2.5, 1.3, '#9cc35a');
          if (st === 4) for (let k = 0; k < 6; k++) { ell(c, tx + (k % 2 ? 1.6 : -1.6), ty - k * 3, 2, 1.5, k % 3 ? '#f6d23a' : '#ffe56a'); ell(c, tx + (k % 2 ? 1.6 : -1.6) + (k % 2 ? 1 : -1), ty - k * 3 + 0.6, 0.8, 0.6, '#c99a1a'); }
        }
        break;
      }
      case 'feijao_porco': {
        const R = 5 + 9 * s, n = 3 + st * 2;
        c.strokeStyle = dk; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -R * 1.4); c.stroke();
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (i / (n - 1 || 1) - 0.5) * 2.6, d = R * (0.6 + (i % 2) * 0.4), lx = Math.cos(a) * d, ly = -R * 0.8 + Math.sin(a) * d * 0.7;
          c.strokeStyle = dk; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -R * 0.5); c.lineTo(lx, ly); c.stroke();
          for (let q = -1; q <= 1; q++) leaf(c, lx, ly, 4 + s * 3.5, 2.2 + s * 1.4, a + q * 0.8, q ? col : lt, vein);
        }
        if (st >= 3) for (let i = 0; i < 3; i++) { const fx = -6 + i * 6, fy = -R * 1.3 - (i % 2) * 3; circ(c, fx, fy, 1.8, '#a050c8'); circ(c, fx + 1.2, fy - 0.8, 1.2, '#d8a0f0'); }
        if (st === 4) for (const [fx, fy, a] of [[-7, -R * 0.4, 0.3], [6, -R * 0.5, -0.3], [-2, -R * 0.2, 0.1]]) { c.save(); c.translate(fx, fy); c.rotate(a); c.fillStyle = '#6fa83a'; c.beginPath(); c.ellipse(0, 6, 2.2, 8, 0, 0, TAU); c.fill(); c.strokeStyle = '#4f7a2a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -1); c.lineTo(0, 13); c.stroke(); c.restore(); }
        break;
      }
      case 'cravo': {
        const R = 4 + 9 * s;
        for (let i = 0; i < 14 + st * 6; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R; c.strokeStyle = i % 2 ? dk : col; c.lineWidth = 1.1; c.beginPath(); const lx = Math.cos(a) * d, ly = -R * 0.7 + Math.sin(a) * d * 0.7; c.moveTo(lx, ly); c.lineTo(lx + Math.cos(a) * 3, ly + Math.sin(a) * 2 - 1.5); c.stroke(); }
        ell(c, 0, -R * 0.7, R * 0.8, R * 0.55, col);
        for (let i = 0; i < 10; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.75; circ(c, Math.cos(a) * d, -R * 0.75 + Math.sin(a) * d * 0.6, 1.3, i % 2 ? dk : lt); }
        if (st === 3) for (let i = 0; i < 4; i++) circ(c, -6 + i * 4, -R * 1.1 - (i % 2) * 2, 1.6, '#e8b040');
        if (st === 4) for (const [fx, fy, fc] of [[-7, -R * 0.9, '#f28a1a'], [0, -R * 1.25, '#ffc21a'], [7, -R * 0.95, '#f28a1a'], [-3, -R * 0.55, '#ffc21a'], [4, -R * 0.5, '#e86a10']]) {
          circ(c, fx, fy, 3.4, shade(fc, -0.2)); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; circ(c, fx + Math.cos(a) * 1.9, fy + Math.sin(a) * 1.9, 1.5, fc); } circ(c, fx, fy, 1.2, shade(fc, 0.35));
        }
        break;
      }
      case 'abacaxi': {
        const n = 7 + st * 2, L = 8 + 14 * s;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.6, l = L * (0.7 + (i % 3) * 0.15);
          leaf(c, 0, -2, l, 1.8, a, i % 2 ? col : dk); c.strokeStyle = 'rgba(200,230,180,0.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0, -2); c.lineTo(Math.cos(a) * l * 0.8, -2 + Math.sin(a) * l * 0.8); c.stroke();
        }
        if (st >= 3) {
          const big = st === 4, fh = big ? 13 : 6, fw = big ? 5.5 : 3, fy = -4 - fh * 0.5;
          ell(c, 0, fy, fw, fh * 0.55, big ? '#e8a23a' : '#c46a6a');
          if (big) {
            c.save(); c.beginPath(); c.ellipse(0, fy, fw, fh * 0.55, 0, 0, TAU); c.clip();
            c.strokeStyle = '#8a5a1a'; c.lineWidth = 0.8; c.beginPath();
            for (let k = -3; k <= 3; k++) { c.moveTo(k * 3 - 6, fy - 8); c.lineTo(k * 3 + 6, fy + 8); c.moveTo(k * 3 + 6, fy - 8); c.lineTo(k * 3 - 6, fy + 8); }
            c.stroke(); c.restore();
            ell(c, -1.8, fy - 2, 1.2, 2.5, 'rgba(255,240,180,0.45)');
          }
          for (let i = 0; i < 7; i++) leaf(c, 0, fy - fh * 0.5, (big ? 7 : 4) - Math.abs(i - 3) * 0.6, 1.1, -Math.PI / 2 + (i - 3) * 0.32, i % 2 ? '#4f8f3a' : '#6faf4a');
        }
        break;
      }
      case 'abobora': case 'melancia': {
        c.strokeStyle = dk; c.lineWidth = 2; c.beginPath(); c.moveTo(-17, -2);
        for (let x = -17; x <= 17; x += 2) c.lineTo(x, -2 - Math.sin(x * 0.35) * 2.2);
        c.stroke();
        c.strokeStyle = lt; c.lineWidth = 0.8; c.beginPath(); c.arc(-15, -7, 2.5, 0, 5); c.arc(15, -6, 2, 2, 7); c.stroke();
        const n = 2 + st;
        for (let i = 0; i < n; i++) {
          const lx = -14 + i * (28 / (n - 1 || 1)), ly = -4 - (i % 2) * 5, rr = 4 + 4 * s;
          ell(c, lx + 0.8, ly + 1.2, rr, rr * 0.8, dk);
          c.fillStyle = i % 2 ? col : lt; c.beginPath();
          for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.75; c.moveTo(lx, ly); c.arc(lx + Math.cos(a) * rr * 0.45, ly + Math.sin(a) * rr * 0.45, rr * 0.55, 0, TAU); }
          c.fill();
          c.strokeStyle = vein; c.lineWidth = 0.7; c.beginPath(); c.moveTo(lx, ly + 2); c.lineTo(lx, ly - rr * 0.7); c.stroke();
        }
        if (st >= 3) {
          const big = st === 4, fx = 2, fy = big ? -9 : -6;
          if (id === 'abobora') {
            const R = big ? 12 : 5, col2 = big ? '#ea8a2a' : '#9cc35a';
            ell(c, fx + 1, fy + R * 0.8, R * 1.05, R * 0.3, 'rgba(0,0,0,0.25)');
            ell(c, fx - R * 0.45, fy, R * 0.62, R * 0.78, shade(col2, -0.12)); ell(c, fx + R * 0.45, fy, R * 0.62, R * 0.78, shade(col2, -0.12));
            ell(c, fx, fy, R * 0.6, R * 0.82, col2);
            c.strokeStyle = shade(col2, -0.3); c.lineWidth = 1; c.beginPath(); c.ellipse(fx, fy, R * 0.3, R * 0.8, 0, -1.3, 1.3); c.stroke();
            ell(c, fx - R * 0.3, fy - R * 0.4, R * 0.18, R * 0.24, 'rgba(255,255,255,0.35)');
            c.fillStyle = '#5a7a2a'; c.fillRect(fx - 1, fy - R * 0.85 - 3, 2.5, 4);
          } else {
            const R = big ? 11 : 5;
            ell(c, fx + 1, fy + R * 0.7, R * 1.15, R * 0.3, 'rgba(0,0,0,0.25)');
            ell(c, fx, fy, R * 1.15, R * 0.8, '#3a8a3a');
            c.strokeStyle = '#1f5a24'; c.lineWidth = 1.6; c.beginPath();
            for (let k = -2; k <= 2; k++) { c.moveTo(fx + k * R * 0.38, fy - R * 0.78); c.quadraticCurveTo(fx + k * R * 0.5, fy, fx + k * R * 0.38, fy + R * 0.78); }
            c.stroke();
            ell(c, fx - R * 0.45, fy - R * 0.35, R * 0.28, R * 0.16, 'rgba(255,255,255,0.35)');
          }
        } else if (st === 2) circ(c, 3, -10, 1.8, '#ffd23a');
        break;
      }
      case 'alface': {
        const R = 4 + 10 * s;
        const n = 5 + st * 2;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI + (i / (n - 1)) * Math.PI, lx = Math.cos(a) * R * 0.55, ly = -R * 0.45 + Math.sin(a) * R * 0.4;
          ell(c, lx, ly, R * 0.42, R * 0.34, i % 2 ? dk : col);
        }
        ell(c, 0, -R * 0.45, R * 0.62, R * 0.5, col);
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(c, Math.cos(a) * R * 0.25, -R * 0.55 + Math.sin(a) * R * 0.18, R * 0.3, R * 0.25, lt); }
        ell(c, 0, -R * 0.6, R * 0.3, R * 0.24, '#d4f29a');
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.8;
        for (let i = 0; i < 4; i++) { const a = -Math.PI + 0.4 + i * 0.75; c.beginPath(); c.moveTo(0, -R * 0.45); c.lineTo(Math.cos(a) * R * 0.75, -R * 0.45 + Math.sin(a) * R * 0.55); c.stroke(); }
        break;
      }
      case 'cenoura': {
        const n = 5, l = 8 + 15 * s;
        if (st >= 3) {
          const ow = st === 4 ? 6 : 3.5;
          c.fillStyle = '#ef8a2a'; c.beginPath(); c.moveTo(-ow, -1); c.quadraticCurveTo(-ow, -ow * 0.9, 0, -ow); c.quadraticCurveTo(ow, -ow * 0.9, ow, -1); c.lineTo(ow * 0.6, 2); c.lineTo(-ow * 0.6, 2); c.fill();
          c.strokeStyle = '#c4621a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-ow * 0.6, -2); c.lineTo(-ow * 0.1, -2); c.moveTo(ow * 0.2, -0.5); c.lineTo(ow * 0.7, -0.5); c.stroke();
        }
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.36, ex = Math.cos(a) * l, ey = -2 + Math.sin(a) * l;
          c.strokeStyle = dk; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(ex * 0.3, ey * 0.6, ex, ey); c.stroke();
          for (let k = 2; k <= 5; k++) {
            const q = k / 5, qx = ex * q, qy = -2 + (ey + 2) * q;
            circ(c, qx - 2, qy + 0.5, 1.6 + s * 0.6, i % 2 ? col : lt); circ(c, qx + 2, qy + 0.5, 1.6 + s * 0.6, i % 2 ? lt : col);
          }
        }
        break;
      }
      case 'tomate': case 'feijao': {
        const hgt = 10 + 30 * s;
        if (st >= 2) {
          c.fillStyle = '#8a6a3a'; c.fillRect(5, -hgt - 6, 2.5, hgt + 6); c.fillStyle = '#a8865a'; c.fillRect(5, -hgt - 6, 1, hgt + 6);
          c.strokeStyle = '#d8c79a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(1, -hgt * 0.5); c.lineTo(6, -hgt * 0.5); c.moveTo(1, -hgt * 0.8); c.lineTo(6, -hgt * 0.8); c.stroke();
        }
        c.strokeStyle = dk; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 0);
        for (let k = 1; k <= 6; k++) c.lineTo(Math.sin(k * 1.7) * 3, -hgt * k / 6);
        c.stroke();
        const n = 3 + st * 2;
        for (let i = 0; i < n; i++) {
          const y = -hgt * (0.15 + 0.8 * i / n), side = i % 2 ? 1 : -1;
          if (id === 'tomate') { leaf(c, Math.sin(i) * 2, y, 7 + 3 * s, 3, side > 0 ? -0.5 : -Math.PI + 0.5, i % 3 ? col : lt, vein); }
          else { c.save(); c.translate(Math.sin(i) * 2 + side * 5, y); ell(c, 0, 0, 3.6 + s, 3.6 + s, i % 3 ? col : lt); c.restore(); }
        }
        if (id === 'tomate') {
          if (st === 3) for (let i = 0; i < 3; i++) flower(c, -5 + i * 5, -hgt * (0.4 + i * 0.15), '#ffe04a', 1.1);
          if (st === 4) for (const [fx, fy, rc] of [[-5, -hgt * 0.35, '#e8392b'], [4, -hgt * 0.5, '#d92f24'], [-3, -hgt * 0.65, '#ee4a33'], [6, -hgt * 0.25, '#e8392b'], [-7, -hgt * 0.55, '#9cc35a']]) {
            circ(c, fx, fy, 3.8, rc); circ(c, fx - 1.2, fy - 1.2, 1.1, 'rgba(255,255,255,0.55)'); star4(c, fx, fy - 3.3, 1.8, '#3f7f2a');
          }
        } else {
          if (st === 3) for (let i = 0; i < 3; i++) flower(c, -5 + i * 5, -hgt * (0.3 + i * 0.2), '#e7b8ff', 1.1);
          if (st === 4) for (const [fx, fy] of [[-6, -hgt * 0.3], [7, -hgt * 0.45], [-4, -hgt * 0.62], [9, -hgt * 0.75]]) {
            c.strokeStyle = '#8fbf3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + 2, fy + 5, fx, fy + 10); c.stroke();
            c.strokeStyle = '#b7dc5c'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx - 0.6, fy + 1); c.quadraticCurveTo(fx + 1.2, fy + 5, fx - 0.4, fy + 9); c.stroke();
          }
        }
        break;
      }
      case 'morango': {
        const n = 3 + st;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI + (i + 0.5) / n * Math.PI, d = 5 + 5 * s, lx = Math.cos(a) * d, ly = -3 + Math.sin(a) * d * 0.6;
          c.strokeStyle = dk; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(lx, ly); c.stroke();
          for (let k = -1; k <= 1; k++) ell(c, lx + Math.cos(a + k * 0.9) * 2.6, ly + Math.sin(a + k * 0.9) * 2.6, 2.6 + s, 2.1 + s * 0.8, k ? col : lt);
        }
        if (st === 3) { flower(c, -5, -6, '#ffffff', 1.4); flower(c, 6, -4, '#ffffff', 1.4); }
        if (st === 4) for (const [fx, fy] of [[-7, -1], [6, 0], [1, -3], [-2, 2]]) {
          c.fillStyle = '#e2283a'; c.beginPath(); c.moveTo(fx - 3, fy - 2); c.quadraticCurveTo(fx - 3, fy + 3, fx, fy + 4.5); c.quadraticCurveTo(fx + 3, fy + 3, fx + 3, fy - 2); c.closePath(); c.fill();
          c.fillStyle = '#ffe36a'; c.fillRect(fx - 1.5, fy, 0.9, 0.9); c.fillRect(fx + 0.8, fy + 1, 0.9, 0.9); c.fillRect(fx - 0.4, fy + 2.5, 0.9, 0.9);
          star4(c, fx, fy - 2.5, 2.2, '#3f8f2a');
        }
        break;
      }
      case 'mandioca': {
        const hgt = 12 + 32 * s;
        if (st === 4) for (const [rx, a] of [[-5, 0.5], [4, -0.4], [0, 0.1]]) { c.save(); c.translate(rx, 1); c.rotate(a); ell(c, 0, 0, 2.5, 6, '#8a5a3a'); ell(c, -0.6, -1, 1, 4, '#a8754a'); c.restore(); }
        for (const [bx, lean] of [[-3, -0.12], [3, 0.12]]) {
          const tx = bx + lean * hgt, ty = -hgt + Math.abs(bx) * 2;
          c.strokeStyle = '#8a5a4a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(bx * 0.4, 0); c.lineTo(tx, ty); c.stroke();
          c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 0.8; for (let k = 1; k < 4; k++) { const q = k / 4; c.beginPath(); c.moveTo(bx * 0.4 + (tx - bx * 0.4) * q - 1.5, ty * q); c.lineTo(bx * 0.4 + (tx - bx * 0.4) * q + 1.5, ty * q); c.stroke(); }
          const nl = 5 + Math.round(s * 2);
          for (let k = 0; k < nl; k++) leaf(c, tx, ty, 7 + 5 * s, 1.8, -Math.PI / 2 + (k - (nl - 1) / 2) * 0.5, k % 2 ? col : lt, vein);
          circ(c, tx, ty, 1.5, '#a0303a');
        }
        break;
      }
      case 'pimenta': {
        const R = 5 + 8 * s;
        c.strokeStyle = dk; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -R); c.stroke();
        for (let i = 0; i < 9 + st * 2; i++) { const a = r() * TAU, d = r() * R * 0.8; leaf(c, Math.cos(a) * d * 0.9, -R + Math.sin(a) * d * 0.7, 4 + 2 * s, 2, a, i % 3 ? col : lt); }
        if (st === 3) for (let i = 0; i < 3; i++) flower(c, -5 + i * 5, -R + 2 - i, '#ffffff', 1);
        if (st === 4) for (const [fx, fy, rc] of [[-6, -R + 3, '#d8322a'], [5, -R + 1, '#e8432a'], [0, -R + 6, '#d8322a'], [7, -R + 7, '#7fb03a'], [-3, -R - 3, '#e8432a']]) {
          c.strokeStyle = rc; c.lineWidth = 2.8; c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + 1.5, fy + 4, fx - 0.5, fy + 8); c.stroke();
          c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(fx - 0.4, fy + 1); c.lineTo(fx + 0.2, fy + 4); c.stroke();
          c.fillStyle = '#3f7f2a'; c.fillRect(fx - 1, fy - 1.5, 2, 2);
        }
        break;
      }
      default: { // capim e genéricos
        const hgt = 10 + 24 * s;
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i / 8 - 0.5) * 1.5, l = hgt * (0.75 + r() * 0.3);
          c.strokeStyle = i % 3 ? col : i % 2 ? dk : lt; c.lineWidth = 2;
          const ex = Math.cos(a) * l, ey = Math.sin(a) * l;
          c.beginPath(); c.moveTo((i - 4) * 0.7, 0); c.quadraticCurveTo(ex * 0.3, ey * 0.7, ex, ey); c.stroke();
          if (st === 4 && i % 2 === 0) { ell(c, ex, ey - 2, 1.6, 4, '#e2d6a2'); }
        }
      }
    }
  }
  function cropSprite(id, st, dead, sick) {
    return sprite(`crop|${id}|${dead ? 'd' : st}|${sick ? 1 : 0}`, 56, 80, 28, 72, c => {
      if (!dead) {
        paintCrop(c, id, st);
        if (sick) { // folhas amareladas e roídas
          c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(205,180,60,0.38)'; c.fillRect(-28, -72, 56, 70);
          const r = rng(id.length * 5 + st); c.globalCompositeOperation = 'destination-out';
          for (let i = 0; i < 7; i++) circ(c, -10 + r() * 20, -6 - r() * (10 + st * 7), 1.3 + r() * 1.2);
          c.globalCompositeOperation = 'source-over';
        }
        return;
      }
      ell(c, 0, 1, 10, 3, 'rgba(40,20,5,0.3)');
      const tall = id === 'milho' || id === 'mandioca' || id === 'tomate' || id === 'feijao';
      const hgt = tall ? 26 : 14;
      c.strokeStyle = '#7a6040'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(1, -hgt * 0.7, 5, -hgt); c.stroke();
      c.strokeStyle = '#6a5034'; c.beginPath(); c.moveTo(-1, 0); c.quadraticCurveTo(-3, -hgt * 0.5, -7, -hgt * 0.55); c.stroke();
      for (const [lx, ly, a] of [[1, -hgt * 0.4, 0.9], [-3, -hgt * 0.45, 2.3], [4, -hgt * 0.85, 0.6], [0, -hgt * 0.2, 2.6]]) leaf(c, lx, ly, 7, 2, a, '#8f7448', 'rgba(0,0,0,0.25)');
      ell(c, 6, 0, 2.5, 1, '#8f7448');
    });
  }
  function drawCrop(px, py, c, x, y) {
    const crop = D.crops[c.id];
    if (!crop) return;
    const st = cropStage(c, crop);
    const s = cropSprite(c.id, st, c.dead, !!c.pest && !c.dead);
    const cx = px + TS / 2, by = py + TS - 9;
    blitSway(s, cx, by, Math.sin(t * 1.8 + x * 0.9 + y * 1.3), c.dead ? 0 : 0.05 * (0.3 + st / 4));
    if (!c.dead && (c.pest || c.protect > 0) && !(Z < 0.55)) drawPestFx(c, cx, by, st, x, y);
    if (st === 4 && !c.dead) {
      const ph = (t * 0.7 + hash(x, y) * 10) % 3;
      if (ph < 0.4) { const k = Math.sin(ph / 0.4 * Math.PI); star4(ctx, cx + 8, by - 18 - hash(y, x) * 10, 4 * k, `rgba(255,255,230,${0.9 * k})`); }
    }
  }

  function drawPestFx(c, cx, by, st, x, y) {
    const hgt = 6 + st * 5, h0 = hash(x, y);
    if (c.pest === 'lagarta') {
      const lx = cx - 5 + Math.sin(t * 0.6 + h0 * 9) * 4, ly = by - hgt * 0.6;
      for (let k = 0; k < 5; k++) { const sx = lx + k * 2.1, sy = ly + Math.sin(t * 6 + k * 0.9) * 0.9; circ(ctx, sx, sy, 1.7, k % 2 ? '#7fc23a' : '#a8de4a'); }
      ctx.fillStyle = '#2a3a1a'; for (let k = 0; k < 5; k += 2) ctx.fillRect(lx + k * 2.1 - 0.4, ly - 1.6, 0.8, 3.2);
      circ(ctx, lx + 10.5, ly - 0.3 + Math.sin(t * 8) * 0.5, 1.6, '#4f7a1a'); circ(ctx, lx + 11, ly - 0.8, 0.5, '#111');
    } else if (c.pest === 'pulgao') {
      const ax = cx + 3, ay = by - hgt * 0.75;
      for (let k = 0; k < 9; k++) { const a = k * 2.4, d = 1 + (k % 3) * 1.4; circ(ctx, ax + Math.cos(a) * d + Math.sin(t * 3 + k) * 0.25, ay + Math.sin(a) * d * 1.4, 0.95, k % 3 ? '#c8ec7a' : '#e8f8b0'); }
      circ(ctx, ax - 4, ay + 4, 0.9, '#c8ec7a'); circ(ctx, ax - 3, ay + 6, 0.9, '#c8ec7a');
    } else if (c.pest === 'formiga') {
      for (let k = 0; k < 5; k++) {
        const q = ((t * 0.18 + k / 5) % 1), ax = cx - 20 + q * 22, ay = by + 4 - Math.sin(q * Math.PI) * 2 + (k % 2) * 2;
        ctx.fillStyle = '#5a2a14'; ctx.fillRect(ax - 1.8, ay - 0.6, 3.6, 1.2); circ(ctx, ax + 2, ay, 0.8, '#3a1a0a');
        ctx.fillStyle = '#6fb83a'; ctx.beginPath(); ctx.moveTo(ax - 1, ay - 1); ctx.lineTo(ax + 1, ay - 4.5); ctx.lineTo(ax + 3, ay - 1.5); ctx.closePath(); ctx.fill();
      }
    }
    if (c.protect > 0) {
      ell(ctx, cx, by - hgt * 0.5, 9 + st * 1.5, 4 + st * 2, 'rgba(190,230,255,0.10)');
      for (let k = 0; k < 3; k++) { const ph = (t * 1.3 + k * 0.7 + h0 * 5) % 2.1; if (ph < 0.6) { const a = Math.sin(ph / 0.6 * Math.PI); star4(ctx, cx - 8 + k * 8, by - hgt * (0.3 + k * 0.25), 2.6 * a, `rgba(230,250,255,${0.9 * a})`); } }
    }
  }

  // =============================================================
  // CONSTRUÇÕES
  // =============================================================
  function roofPoly(c, pts, col, snow) {
    const path = () => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const dark = shade(col, -0.38), lite = shade(col, 0.2);
    c.save(); path(); c.fillStyle = col; c.fill(); c.clip();
    const g = c.createLinearGradient(0, minY, 0, maxY); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
    c.fillStyle = g; c.fillRect(minX, minY, maxX - minX, maxY - minY);
    let row = 0;
    for (let yy = minY + 7; yy < maxY + 6; yy += 7, row++) {
      c.strokeStyle = dark; c.lineWidth = 1.1; c.beginPath();
      for (let xx = minX - 12 + (row % 2) * 5; xx < maxX + 12; xx += 10) { c.moveTo(xx + 10, yy - 3); c.arc(xx + 5, yy - 3, 5, 0, Math.PI); }
      c.stroke();
      c.strokeStyle = lite; c.lineWidth = 0.8; c.beginPath();
      for (let xx = minX - 12 + (row % 2) * 5; xx < maxX + 12; xx += 10) { c.moveTo(xx + 2, yy - 6.5); c.lineTo(xx + 6, yy - 6.5); }
      c.stroke();
    }
    if (snow) {
      c.fillStyle = '#f4f8fb'; c.beginPath(); c.moveTo(minX - 5, minY - 2); c.lineTo(maxX + 5, minY - 2);
      for (let xx = maxX + 5; xx >= minX - 5; xx -= 6) c.lineTo(xx, minY + 10 + Math.sin(xx * 0.7) * 3 + ((xx * 13) % 5));
      c.closePath(); c.fill();
    }
    c.restore();
    c.strokeStyle = dark; c.lineWidth = 2; path(); c.stroke();
  }
  function gableRoof(c, x, y, w, h, inset, col, snow) {
    roofPoly(c, [[x - 7, y + h], [x + inset, y], [x + w - inset, y], [x + w + 7, y + h]], col, snow);
    c.fillStyle = shade(col, -0.45); c.fillRect(x - 8, y + h - 3, w + 16, 4);
    c.fillStyle = shade(col, 0.25); c.fillRect(x + inset - 2, y - 2, w - inset * 2 + 4, 4);
    if (snow) { c.fillStyle = '#f7fafc'; c.fillRect(x + inset - 3, y - 4, w - inset * 2 + 6, 5); for (let xx = x - 4; xx < x + w + 4; xx += 7) { c.beginPath(); c.moveTo(xx, y + h + 1); c.lineTo(xx + 1.5, y + h + 5 + (xx % 3)); c.lineTo(xx + 3, y + h + 1); c.fillStyle = 'rgba(220,240,255,0.9)'; c.fill(); } }
  }
  function siding(c, x, y, w, h, col, vert, gap, seed) {
    c.fillStyle = col; c.fillRect(x, y, w, h);
    const r = rng(seed || 7), dk = shade(col, -0.2), lt = shade(col, 0.14);
    if (!vert) {
      for (let yy = y; yy < y + h; yy += gap) {
        c.fillStyle = `rgba(0,0,0,${r() * 0.06})`; c.fillRect(x, yy, w, gap);
        c.fillStyle = lt; c.fillRect(x, yy + 1, w, 1.2);
        c.fillStyle = dk; c.fillRect(x, yy + gap - 1.5, w, 1.5);
      }
    } else {
      for (let xx = x; xx < x + w; xx += gap) {
        c.fillStyle = `rgba(0,0,0,${r() * 0.07})`; c.fillRect(xx, y, gap, h);
        c.fillStyle = lt; c.fillRect(xx + 1, y, 1.2, h);
        c.fillStyle = dk; c.fillRect(xx + gap - 1.5, y, 1.5, h);
        c.fillStyle = 'rgba(40,25,10,0.4)'; c.fillRect(xx + gap / 2 - 0.5, y + 3, 1, 1); c.fillRect(xx + gap / 2 - 0.5, y + h - 4, 1, 1);
      }
    }
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(0.25, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.fillStyle = g; c.fillRect(x, y, w, h);
  }
  function stones(c, x, y, w, h, col, seed) {
    c.fillStyle = shade(col, -0.35); c.fillRect(x, y, w, h);
    const r = rng(seed || 3), rows = Math.max(1, Math.round(h / 7)), rh = h / rows;
    for (let j = 0; j < rows; j++) {
      let xx = x + (j % 2) * 4 - 4;
      while (xx < x + w) {
        const sw = 7 + r() * 7, x0 = Math.max(x, xx), x1 = Math.min(x + w, xx + sw - 1);
        if (x1 > x0 + 1) { c.fillStyle = shade(col, (r() - 0.5) * 0.25); rrect(c, x0 + 0.5, y + j * rh + 0.5, x1 - x0 - 1, rh - 1.2, 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(x0 + 1.5, y + j * rh + 1, x1 - x0 - 3, 1); }
        xx += sw;
      }
    }
  }
  function windowP(c, x, y, w, h, night, box, season) {
    c.fillStyle = '#5e3b22'; rrect(c, x - 3, y - 3, w + 6, h + 6, 2); c.fill();
    const g = c.createLinearGradient(x, y, x, y + h);
    if (night) { g.addColorStop(0, '#ffe9a6'); g.addColorStop(1, '#ffbf55'); } else { g.addColorStop(0, '#d8f2fc'); g.addColorStop(1, '#79b4d8'); }
    c.fillStyle = g; c.fillRect(x, y, w, h);
    if (!night) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.moveTo(x + 2, y + h * 0.7); c.lineTo(x + w * 0.35, y + 1); c.lineTo(x + w * 0.5, y + 1); c.lineTo(x + 2, y + h); c.closePath(); c.fill(); }
    else { c.fillStyle = 'rgba(120,70,30,0.35)'; c.fillRect(x, y, w * 0.22, h); c.fillRect(x + w * 0.78, y, w * 0.22, h); }
    c.fillStyle = '#5e3b22'; c.fillRect(x + w / 2 - 1.5, y, 3, h); c.fillRect(x, y + h / 2 - 1.5, w, 3);
    c.fillStyle = '#8a5a34'; c.fillRect(x - 5, y + h + 2, w + 10, 4); c.fillStyle = '#a8764a'; c.fillRect(x - 5, y + h + 2, w + 10, 1.2);
    if (box) {
      c.fillStyle = '#7a4a28'; c.fillRect(x - 2, y + h + 6, w + 4, 7); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x - 2, y + h + 11, w + 4, 2);
      if (season !== 3) {
        const fl = season === 2 ? ['#e8822a', '#c0392b'] : ['#ff6f91', '#ffd23a', '#ffffff'];
        for (let i = 0; i < 6; i++) { circ(c, x + 1 + i * (w / 5), y + h + 5.5, 2.8, i % 2 ? '#3f8a35' : '#55a83f'); }
        for (let i = 0; i < 5; i++) circ(c, x + 3 + i * (w / 5), y + h + 3.5, 1.8, fl[i % fl.length]);
      } else { c.fillStyle = '#f4f8fb'; c.fillRect(x - 2, y + h + 4.5, w + 4, 2.5); }
    }
  }
  function door(c, x, y, w, h, col, arch) {
    c.fillStyle = '#4a2c16'; rrect(c, x - 2.5, y - 2.5, w + 5, h + 2.5, arch ? w / 2 : 2); c.fill();
    c.save(); rrect(c, x, y, w, h, arch ? w / 2 - 2 : 1); c.clip();
    siding(c, x, y, w, h, col, true, 6.5, 11);
    c.restore();
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 2, y + h * 0.3, w - 4, 2); c.fillRect(x + 2, y + h * 0.7, w - 4, 2);
    circ(c, x + w - 5, y + h * 0.55, 1.8, '#e7c35a');
  }
  function shadowRect(c, x, y, w, h) { c.fillStyle = 'rgba(10,25,5,0.22)'; rrect(c, x, y, w, h, h / 2); c.fill(); }

  function casaLayout(w, h) {
    return { roofY: -30, wallY: 62, winX: [44, w - 44], winY: 98, chx: w - 58, porchX0: w / 2 - 54, porchX1: w / 2 + 54 };
  }
  function paintBuilding(c, type, w, h, b, night, snow, season, variant, lv) {
    switch (type) {
      case 'casa': {
        const L = casaLayout(w, h), panels = variant;
        shadowRect(c, 12, h - 12, w - 6, 18);
        // chaminé (atrás do telhado)
        stones(c, L.chx - 10, -40, 20, 70, '#9a948c', 5);
        c.fillStyle = '#6e6862'; c.fillRect(L.chx - 13, -44, 26, 6);
        if (snow) { c.fillStyle = '#f5f9fc'; c.fillRect(L.chx - 14, -47, 28, 4); }
        // paredes
        siding(c, 10, L.wallY, w - 20, h - L.wallY - 14, '#f1e2c2', false, 8, 21);
        c.fillStyle = '#c8b48e'; c.fillRect(10, L.wallY, 4, h - L.wallY - 14); c.fillRect(w - 14, L.wallY, 4, h - L.wallY - 14);
        stones(c, 6, h - 15, w - 12, 11, '#a29b90', 9);
        // telhado grande
        gableRoof(c, 10, L.roofY, w - 20, L.wallY - L.roofY + 6, 46, '#c4553c', snow);
        // placas solares no telhado (2 fileiras × 3)
        for (let i = 0; i < Math.min(6, panels); i++) {
          const row = Math.floor(i / 3), col = i % 3, py = L.roofY + 14 + row * 26, pw = 34 + row * 3, cx = w / 2 + (col - 1) * (pw + 6), sk = (col - 1) * 4;
          c.fillStyle = '#c8ccd0'; c.beginPath(); c.moveTo(cx - pw / 2 + sk * 0.3, py); c.lineTo(cx + pw / 2 + sk * 0.3, py); c.lineTo(cx + pw / 2 + 2 + sk, py + 20); c.lineTo(cx - pw / 2 - 2 + sk, py + 20); c.closePath(); c.fill();
          c.fillStyle = '#1f3a6e'; c.beginPath(); c.moveTo(cx - pw / 2 + 1.5 + sk * 0.3, py + 1.5); c.lineTo(cx + pw / 2 - 1.5 + sk * 0.3, py + 1.5); c.lineTo(cx + pw / 2 + 0.5 + sk, py + 18.5); c.lineTo(cx - pw / 2 - 0.5 + sk, py + 18.5); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(140,180,230,0.55)'; c.lineWidth = 0.6; c.beginPath();
          for (let k = 1; k < 4; k++) { const f = k / 4; c.moveTo(cx - pw / 2 + pw * f + sk * 0.3, py + 1.5); c.lineTo(cx - pw / 2 - 2 + (pw + 4) * f + sk, py + 18.5); }
          c.moveTo(cx - pw / 2 + sk * 0.6, py + 10); c.lineTo(cx + pw / 2 + 1 + sk * 0.6, py + 10); c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.32)'; c.beginPath(); c.moveTo(cx - pw / 2 + 6 + sk * 0.3, py + 1.5); c.lineTo(cx - pw / 2 + 13 + sk * 0.3, py + 1.5); c.lineTo(cx - pw / 2 + 5 + sk, py + 18.5); c.lineTo(cx - pw / 2 + sk, py + 18.5); c.fill();
          if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(cx - pw / 2 + sk * 0.3, py - 1, pw, 2.5); }
        }
        // janelas com floreiras
        for (const wx of L.winX) windowP(c, wx - 20, L.winY - 16, 40, 32, night, true, season);
        // varanda: piso, colunas e telhadinho
        c.fillStyle = '#8a5a34'; c.fillRect(L.porchX0 - 4, h - 16, L.porchX1 - L.porchX0 + 8, 12);
        for (let x = L.porchX0 - 4; x < L.porchX1 + 4; x += 7) { c.fillStyle = (x / 7 | 0) % 2 ? '#a8764a' : '#9a6a3e'; c.fillRect(x, h - 16, 6.5, 11); }
        c.fillStyle = '#c99a5a'; c.fillRect(L.porchX0 - 4, h - 16, L.porchX1 - L.porchX0 + 8, 1.5);
        door(c, w / 2 - 15, h - 64, 30, 48, '#8a5530', true);
        c.fillStyle = '#d8c6a0'; c.fillRect(w / 2 - 22, h - 70, 44, 5);
        // lampião
        c.fillStyle = '#3a3a3a'; c.fillRect(w / 2 + 20, h - 58, 6, 2); c.fillRect(w / 2 + 22, h - 58, 2, 5);
        c.fillStyle = night ? '#ffd877' : '#e8e0c0'; rrect(c, w / 2 + 19.5, h - 54, 7, 9, 2); c.fill(); c.strokeStyle = '#3a3a3a'; c.lineWidth = 1; c.stroke();
        // banquinho e vasos na varanda
        c.fillStyle = '#7a4a28'; c.fillRect(L.porchX0 + 4, h - 30, 26, 4); c.fillRect(L.porchX0 + 6, h - 26, 3, 9); c.fillRect(L.porchX0 + 25, h - 26, 3, 9); c.fillRect(L.porchX0 + 4, h - 40, 26, 3);
        const bush = season === 2 ? '#c9822f' : season === 3 ? '#6f8f7a' : '#4a9a3c';
        for (const vx of [L.porchX1 - 14, w / 2 - 30]) {
          c.fillStyle = '#c0663a'; c.beginPath(); c.moveTo(vx - 6, h - 28); c.lineTo(vx + 6, h - 28); c.lineTo(vx + 4.5, h - 17); c.lineTo(vx - 4.5, h - 17); c.fill();
          circ(c, vx, h - 32, 7, bush); circ(c, vx - 2, h - 34, 3, shade(bush, 0.25));
          if (season < 2) { circ(c, vx + 2, h - 35, 1.6, '#ff6f91'); circ(c, vx - 3, h - 30, 1.6, '#ffd23a'); }
        }
        // colunas e telhado da varanda
        for (const px2 of [L.porchX0, L.porchX1 - 6]) { c.fillStyle = '#efe6d8'; c.fillRect(px2, h - 76, 6, 62); c.fillStyle = '#c8bca8'; c.fillRect(px2 + 4, h - 76, 2, 62); }
        roofPoly(c, [[L.porchX0 - 10, h - 70], [L.porchX0 - 2, h - 86], [L.porchX1 + 2, h - 86], [L.porchX1 + 10, h - 70]], '#b44c36', snow);
        c.fillStyle = shade('#b44c36', -0.45); c.fillRect(L.porchX0 - 11, h - 72, L.porchX1 - L.porchX0 + 22, 4);
        // degraus e capacho
        c.fillStyle = '#9a9288'; c.fillRect(w / 2 - 18, h - 5, 36, 5); c.fillStyle = '#bab2a6'; c.fillRect(w / 2 - 18, h - 5, 36, 1.5);
        c.fillStyle = '#b8443a'; rrect(c, w / 2 - 11, h - 14, 22, 5, 2); c.fill();
        break;
      }
      case 'loja': {
        shadowRect(c, 6, h - 10, w - 4, 14);
        siding(c, 4, 26, w - 8, h - 30, '#c8955a', true, 9, 33);
        c.fillStyle = '#5a3a22'; c.fillRect(-2, 16, w + 4, 10); c.fillStyle = '#7a5232'; c.fillRect(-2, 16, w + 4, 2);
        if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(-3, 13, w + 6, 4); }
        // placa
        c.fillStyle = '#5a3a22'; c.fillRect(w / 2 - 30, -2, 3, 18); c.fillRect(w / 2 + 27, -2, 3, 18);
        c.fillStyle = '#3b2a1a'; rrect(c, w / 2 - 38, -16, 76, 22, 4); c.fill();
        c.strokeStyle = '#a8764a'; c.lineWidth = 2; rrect(c, w / 2 - 36, -14, 72, 18, 3); c.stroke();
        c.fillStyle = '#ffe9a8'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('AGRO&CIA', w / 2, 0);
        if (snow) { c.fillStyle = '#f4f8fb'; rrect(c, w / 2 - 38, -18, 76, 4, 2); c.fill(); }
        // vitrine e porta
        windowP(c, 12, 46, 40, 22, night, false, season);
        door(c, w - 46, 44, 26, h - 46, '#7a4a28', false);
        c.fillStyle = night ? '#ffd877' : '#a9d6ee'; c.fillRect(w - 42, 48, 18, 10); c.fillStyle = '#4a2c16'; c.fillRect(w - 34, 48, 2, 10);
        // toldo listrado
        const sw = w / 7;
        for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#f7f3e8' : '#2e8b57'; c.fillRect(i * sw, 24, sw + 0.5, 16); }
        for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#f7f3e8' : '#2e8b57'; c.beginPath(); c.arc(i * sw + sw / 2, 40, sw / 2, 0, Math.PI); c.fill(); }
        c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 24, w, 4);
        c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(4, 46, w - 8, 3);
        // caixotes
        for (const [cx2, e] of [[10, '🌱'], [38, '🔩']]) { c.fillStyle = '#a0703f'; c.fillRect(cx2, h - 24, 26, 20); c.strokeStyle = '#6b4423'; c.lineWidth = 1.5; c.strokeRect(cx2 + 0.5, h - 23.5, 25, 19); c.beginPath(); c.moveTo(cx2, h - 14); c.lineTo(cx2 + 26, h - 14); c.stroke(); drawEmo(e, cx2 + 13, h - 24, 16, false, 1, 1, c); }
        c.fillStyle = '#8a5a34'; rrect(c, w - 18, h - 30, 16, 26, 4); c.fill(); c.fillStyle = '#5a3a1f'; c.fillRect(w - 18, h - 24, 16, 2); c.fillRect(w - 18, h - 12, 16, 2);
        drawEmo('🌰', w - 10, h - 31, 13, false, 1, 1, c);
        break;
      }
      case 'galinheiro': {
        shadowRect(c, 8, h - 10, w - 6, 14);
        c.fillStyle = '#5a3a1f'; c.fillRect(14, h - 12, 5, 10); c.fillRect(w - 19, h - 12, 5, 10);
        siding(c, 10, 22, w - 20, h - 32, '#dcb878', true, 8, 41);
        roofPoly(c, [[2, 28], [16, -8], [w - 16, -8], [w - 2, 28]], '#6f9440', snow);
        c.fillStyle = shade('#6f9440', -0.45); c.fillRect(0, 25, w, 4);
        // janela telada
        c.fillStyle = '#4a2c16'; c.fillRect(18, 38, 26, 18); c.fillStyle = '#2a1a0e'; c.fillRect(20, 40, 22, 14);
        c.strokeStyle = 'rgba(200,200,190,0.6)'; c.lineWidth = 0.7; c.beginPath();
        for (let i = 0; i < 6; i++) { c.moveTo(20 + i * 4.4, 40); c.lineTo(20 + i * 4.4 - 6, 54); c.moveTo(20 + i * 4.4, 40); c.lineTo(20 + i * 4.4 + 6, 54); } c.stroke();
        // porta e rampa
        c.fillStyle = '#4a2c16'; rrect(c, w / 2 - 11, h - 34, 22, 26, 10); c.fill(); c.fillStyle = '#20140a'; rrect(c, w / 2 - 8, h - 31, 16, 23, 8); c.fill();
        c.fillStyle = '#9a6a3a'; c.beginPath(); c.moveTo(w / 2 - 9, h - 8); c.lineTo(w / 2 + 9, h - 8); c.lineTo(w / 2 + 12, h + 8); c.lineTo(w / 2 - 6, h + 8); c.fill();
        c.strokeStyle = '#6b4423'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(w / 2 - 8 + i * 0.8, h - 4 + i * 3.5); c.lineTo(w / 2 + 10 + i * 0.6, h - 4 + i * 3.5); c.stroke(); }
        // ninho / feno
        c.fillStyle = '#e8c860'; for (let i = 0; i < 8; i++) { c.fillRect(w - 38 + i * 2.5, h - 12 - (i % 3), 6, 1.2); }
        c.fillStyle = '#8a5a34'; c.fillRect(w - 34, 34, 22, 14); c.fillStyle = '#e3c25a'; c.fillRect(w - 33, 33, 20, 4);
        if (variant) drawEmo('🥚', w - 23, 34, 14, false, 1, 1, c);
        break;
      }
      case 'galpao': {
        shadowRect(c, 10, h - 12, w - 6, 16);
        siding(c, 8, 40, w - 16, h - 44, '#b23b2e', true, 9, 55);
        c.fillStyle = '#efe6d8'; c.fillRect(8, 40, 4, h - 44); c.fillRect(w - 12, 40, 4, h - 44);
        roofPoly(c, [[-2, 48], [14, 12], [w / 2, -14], [w - 14, 12], [w + 2, 48]], '#5c4a3a', snow);
        c.fillStyle = '#3a2d22'; c.fillRect(-3, 45, w + 6, 4);
        c.strokeStyle = '#efe6d8'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 46); c.lineTo(14, 12); c.lineTo(w / 2, -14); c.lineTo(w - 14, 12); c.lineTo(w, 46); c.stroke();
        // palheiro
        c.fillStyle = '#efe6d8'; c.fillRect(w / 2 - 16, 6, 32, 26); c.fillStyle = '#2a1a10'; c.fillRect(w / 2 - 13, 9, 26, 21);
        c.strokeStyle = '#e8c860'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 10; i++) { c.moveTo(w / 2 - 12 + i * 2.6, 30); c.lineTo(w / 2 - 13 + i * 2.6 + ((i * 7) % 5) - 2, 21 + (i % 3) * 2); } c.stroke();
        // portão
        const dx = w / 2 - 28, dy = h - 58;
        siding(c, dx, dy, 56, 54, '#a3352a', true, 7, 66);
        c.strokeStyle = '#efe6d8'; c.lineWidth = 4; c.strokeRect(dx + 2, dy + 2, 52, 52);
        c.beginPath(); c.moveTo(dx + 2, dy + 2); c.lineTo(dx + 54, dy + 54); c.moveTo(dx + 54, dy + 2); c.lineTo(dx + 2, dy + 54); c.moveTo(dx + 28, dy + 2); c.lineTo(dx + 28, dy + 54); c.stroke();
        // janelinhas
        for (const wx of [20, w - 40]) { c.fillStyle = '#efe6d8'; c.fillRect(wx - 2, 58, 24, 20); c.fillStyle = night ? '#e8b860' : '#2a1a10'; c.fillRect(wx + 1, 61, 18, 14); c.fillStyle = '#efe6d8'; c.fillRect(wx + 9, 61, 2, 14); }
        if (variant) drawEmo('🥚', w - 22, h - 20, 14, false, 1, 1, c);
        break;
      }
      case 'poco': {
        ell(c, w / 2 + 3, h - 14, 36, 10, 'rgba(10,25,5,0.25)');
        // parede cilíndrica
        c.save(); c.beginPath(); c.moveTo(w / 2 - 32, h - 46); c.lineTo(w / 2 - 32, h - 22); c.ellipse(w / 2, h - 22, 32, 10, 0, Math.PI, 0, true); c.lineTo(w / 2 + 32, h - 46); c.closePath(); c.clip();
        stones(c, w / 2 - 33, h - 50, 66, 40, '#a29b90', 77);
        const sg = c.createLinearGradient(w / 2 - 32, 0, w / 2 + 32, 0); sg.addColorStop(0, 'rgba(255,255,255,0.12)'); sg.addColorStop(0.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)');
        c.fillStyle = sg; c.fillRect(w / 2 - 33, h - 50, 66, 40);
        c.restore();
        ell(c, w / 2, h - 46, 32, 11, '#bfb8ac'); ell(c, w / 2, h - 46, 26, 7.5, '#4a4640');
        const wg = c.createRadialGradient(w / 2, h - 45, 2, w / 2, h - 45, 24); wg.addColorStop(0, '#2f6fa5'); wg.addColorStop(1, '#173a5a');
        c.fillStyle = wg; c.beginPath(); c.ellipse(w / 2, h - 45, 23, 6, 0, 0, TAU); c.fill();
        if (snow) { c.fillStyle = '#f4f8fb'; c.beginPath(); c.ellipse(w / 2, h - 50, 30, 5, 0, Math.PI, 0); c.fill(); }
        // postes
        for (const px2 of [w / 2 - 31, w / 2 + 25]) { c.fillStyle = '#6b4423'; c.fillRect(px2, 2, 6, h - 46); c.fillStyle = '#8a5a34'; c.fillRect(px2, 2, 2, h - 46); }
        // eixo, corda, balde
        c.fillStyle = '#4a3a2a'; c.fillRect(w / 2 - 28, 14, 56, 4); c.fillStyle = '#7a5a3a'; rrect(c, w / 2 - 8, 12, 16, 8, 3); c.fill();
        c.strokeStyle = '#4a3a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2 + 31, 16); c.lineTo(w / 2 + 37, 16); c.lineTo(w / 2 + 37, 24); c.stroke();
        c.strokeStyle = '#c9b48a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(w / 2, 18); c.lineTo(w / 2, 30); c.stroke();
        c.fillStyle = '#8f989e'; c.beginPath(); c.moveTo(w / 2 - 7, 30); c.lineTo(w / 2 + 7, 30); c.lineTo(w / 2 + 5, 42); c.lineTo(w / 2 - 5, 42); c.fill();
        c.fillStyle = '#5f676c'; c.fillRect(w / 2 - 6.5, 32, 13, 1.5); c.fillRect(w / 2 - 5.5, 39, 11, 1.5);
        c.strokeStyle = '#5f676c'; c.lineWidth = 1; c.beginPath(); c.arc(w / 2, 30, 6, Math.PI, 0); c.stroke();
        gableRoof(c, w / 2 - 32, -14, 64, 22, 10, '#a2432c', snow);
        break;
      }
      case 'fogueira': {
        const cx = w / 2, cy = h / 2 + 6;
        ell(c, cx, cy + 1, 19, 10, 'rgba(40,25,15,0.4)');
        ell(c, cx, cy, 11, 5.5, '#2a1a10');
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU, sx = cx + Math.cos(a) * 14, sy = cy + Math.sin(a) * 7.5;
          ell(c, sx + 0.5, sy + 1.5, 4.4, 3.4, '#4f4b46'); ell(c, sx, sy, 4.2, 3.2, i % 2 ? '#8d8880' : '#9e988f'); ell(c, sx - 1, sy - 1.2, 2, 1.2, 'rgba(255,255,255,0.3)');
          if (snow && Math.sin(a) < 0.2) ell(c, sx, sy - 2.2, 3, 1.2, '#f4f8fb');
        }
        for (const [a, col] of [[0.35, '#6b4423'], [-0.35, '#7a5030']]) {
          c.save(); c.translate(cx, cy - 1); c.rotate(a); c.fillStyle = col; rrect(c, -13, -2.6, 26, 5.2, 2.6); c.fill();
          ell(c, 12.5, 0, 2, 2.6, '#c9a070'); c.restore();
        }
        break;
      }
      case 'defumador': {
        const cx = w / 2;
        ell(c, cx + 2, h - 3, 20, 5, 'rgba(10,25,5,0.25)');
        c.fillStyle = '#5e5a54'; c.fillRect(cx - 5, -14, 10, 22); c.fillStyle = '#7a756d'; c.fillRect(cx - 5, -14, 3, 22); c.fillStyle = '#4a4640'; c.fillRect(cx - 7, -16, 14, 4);
        c.save(); c.beginPath(); c.moveTo(4, h - 2); c.lineTo(7, 10); c.quadraticCurveTo(cx, 0, w - 7, 10); c.lineTo(w - 4, h - 2); c.closePath(); c.clip();
        stones(c, 2, 0, w - 4, h, '#9a8f80', 88); c.restore();
        c.fillStyle = '#2b1c10'; c.beginPath(); c.arc(cx, h - 5, 9, Math.PI, 0); c.fill();
        c.fillStyle = '#6e675c'; c.fillRect(cx - 11, h - 6, 22, 3);
        if (snow) { c.fillStyle = '#f4f8fb'; c.beginPath(); c.moveTo(7, 11); c.quadraticCurveTo(cx, 0, w - 7, 11); c.quadraticCurveTo(cx, 6, 7, 11); c.fill(); }
        break;
      }
      case 'composteira': {
        shadowRect(c, 4, h - 8, w - 2, 12);
        siding(c, 4, 4, w - 8, 18, '#6e4a28', false, 6, 91);
        const pile = variant === 2 ? '#3d2a14' : variant === 1 ? '#5a4a26' : '#6a5a36';
        ell(c, w / 2, 14, w / 2 - 8, 9, pile);
        const r = rng(5);
        if (variant === 1) for (let i = 0; i < 16; i++) { c.fillStyle = ['#8fbf3a', '#e3c25a', '#a8764a', '#5a8a2a'][i % 4]; c.fillRect(12 + r() * (w - 24), 8 + r() * 10, 3, 1.5); }
        if (variant === 2) for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(12 + r() * (w - 24), 8 + r() * 10, 2, 2); }
        if (snow) ell(c, w / 2, 9, w / 2 - 14, 4, 'rgba(245,250,252,0.9)');
        for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#8a5a30' : '#7a5028'; c.fillRect(4, 18 + i * 5.5, w - 8, 4.5); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(4, 18 + i * 5.5, w - 8, 1); }
        c.fillStyle = '#4a2f18'; c.fillRect(2, 2, 5, h - 4); c.fillRect(w - 7, 2, 5, h - 4); c.fillRect(w / 2 - 2, 16, 4, h - 18);
        break;
      }
      case 'cocho': {
        shadowRect(c, 4, h - 9, w - 2, 10);
        c.fillStyle = '#5a3a1f'; c.fillRect(8, h - 14, 6, 12); c.fillRect(w - 14, h - 14, 6, 12);
        c.fillStyle = '#6b4423'; c.beginPath(); c.moveTo(2, 12); c.lineTo(w - 2, 12); c.lineTo(w - 8, h - 10); c.lineTo(8, h - 10); c.fill();
        c.fillStyle = '#2e1d10'; c.beginPath(); c.ellipse(w / 2, 13, w / 2 - 3, 4.5, 0, 0, TAU); c.fill();
        const lvl = variant / 4;
        if (lvl > 0) { const fy = 13 + (1 - lvl) * 2; c.fillStyle = '#d9b44a'; c.beginPath(); c.ellipse(w / 2, fy, (w / 2 - 5) * (0.75 + lvl * 0.25), 3.6, 0, 0, TAU); c.fill(); const r = rng(9); for (let i = 0; i < 18; i++) { c.fillStyle = i % 2 ? '#b8902a' : '#f0d070'; c.fillRect(w / 2 - 30 + r() * 60, fy - 2.5 + r() * 4.5, 2, 1.4); } }
        c.fillStyle = '#8b5a2b'; c.beginPath(); c.moveTo(2, 15); c.lineTo(w - 2, 15); c.lineTo(w - 8, h - 10); c.lineTo(8, h - 10); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(5, 22, w - 10, 1.5); c.fillRect(6, 28, w - 12, 1.5);
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(2, 15, w - 4, 1.5);
        if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(1, 12, 6, 3); c.fillRect(w - 7, 12, 6, 3); }
        break;
      }
      case 'moinho': {
        shadowRect(c, 12, h - 10, w - 18, 14);
        c.save(); c.beginPath(); c.moveTo(14, h - 2); c.lineTo(22, 12); c.lineTo(w - 22, 12); c.lineTo(w - 14, h - 2); c.closePath(); c.clip();
        stones(c, 12, 10, w - 24, h - 10, '#c2b9a6', 101);
        const sg = c.createLinearGradient(14, 0, w - 14, 0); sg.addColorStop(0, 'rgba(255,255,255,0.12)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)'); c.fillStyle = sg; c.fillRect(12, 10, w - 24, h);
        c.restore();
        door(c, w / 2 - 8, h - 24, 16, 22, '#6b4423', true);
        c.fillStyle = '#4a2c16'; c.fillRect(w / 2 - 5, 40, 10, 10); c.fillStyle = '#2a1a10'; c.fillRect(w / 2 - 3.5, 41.5, 7, 7);
        roofPoly(c, [[14, 16], [w / 2, -12], [w - 14, 16]], '#7a4a28', snow);
        break;
      }
      case 'colmeia': {
        const cx = w / 2;
        ell(c, cx + 2, h - 3, 16, 4, 'rgba(10,25,5,0.25)');
        c.fillStyle = '#5a3a1f'; c.fillRect(cx - 12, h - 14, 3, 12); c.fillRect(cx + 9, h - 14, 3, 12); c.fillRect(cx - 13, h - 16, 26, 3);
        for (const [y0, hh] of [[16, 13], [4, 12]]) {
          c.fillStyle = '#e8b33c'; c.fillRect(cx - 14, y0, 28, hh); c.fillStyle = '#f5cf6a'; c.fillRect(cx - 14, y0, 28, 2); c.fillStyle = '#b8861e'; c.fillRect(cx - 14, y0 + hh - 2, 28, 2); c.fillRect(cx + 10, y0, 4, hh);
          c.fillStyle = '#8c5a1a'; c.fillRect(cx - 4, y0 + hh / 2 - 1, 8, 2);
        }
        c.fillStyle = '#2a1a0a'; c.fillRect(cx - 7, 27, 14, 2.5);
        c.fillStyle = '#7a4a1a'; c.beginPath(); c.moveTo(cx - 17, 5); c.lineTo(cx, -3); c.lineTo(cx + 17, 5); c.closePath(); c.fill();
        c.fillStyle = '#a06a2a'; c.fillRect(cx - 16, 3, 32, 3);
        if (snow) { c.fillStyle = '#f4f8fb'; c.beginPath(); c.moveTo(cx - 16, 3); c.lineTo(cx, -5); c.lineTo(cx + 16, 3); c.closePath(); c.fill(); }
        break;
      }
      case 'cerca': {
        const m = variant, cx = w / 2, cy = h / 2;
        const rail = (x, y, ww, hh) => { c.fillStyle = 'rgba(10,25,5,0.2)'; c.fillRect(x, y + hh + 6, ww, 2); c.fillStyle = '#9a6a3a'; c.fillRect(x, y, ww, hh); c.fillStyle = '#c08a50'; c.fillRect(x, y, ww, 1.2); c.fillStyle = '#6e4626'; c.fillRect(x, y + hh - 1, ww, 1); if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(x, y - 1.5, ww, 2); } };
        if (m & 2) { rail(0, cy - 7, cx, 4); rail(0, cy + 2, cx, 4); }
        if (m & 1) { rail(cx, cy - 7, cx + 1, 4); rail(cx, cy + 2, cx + 1, 4); }
        if (m & 8) { c.fillStyle = '#8a5a30'; c.fillRect(cx - 2, -2, 4, cy); }
        if (m & 4) { c.fillStyle = '#8a5a30'; c.fillRect(cx - 2, cy, 4, cy + 2); c.fillStyle = '#c08a50'; c.fillRect(cx - 2, cy, 1, cy + 2); }
        ell(c, cx + 1, cy + 12, 6, 2, 'rgba(10,25,5,0.25)');
        c.fillStyle = '#6e4626'; c.fillRect(cx - 4, cy - 14, 8, 26); c.fillStyle = '#8a5a30'; c.fillRect(cx - 4, cy - 14, 3, 26);
        c.fillStyle = '#c08a50'; c.beginPath(); c.moveTo(cx - 4, cy - 14); c.lineTo(cx, cy - 17); c.lineTo(cx + 4, cy - 14); c.fill();
        if (snow) { c.fillStyle = '#f4f8fb'; c.beginPath(); c.ellipse(cx, cy - 15, 5, 3, 0, 0, TAU); c.fill(); }
        break;
      }
      case 'porteira': {
        const m = variant, cx = w / 2, cy = h / 2, open = m & 16;
        const post = (x, y) => { ell(c, x + 1, y + 13, 5, 2, 'rgba(10,25,5,0.25)'); c.fillStyle = '#5e3a20'; c.fillRect(x - 4, y - 16, 8, 29); c.fillStyle = '#7a4a28'; c.fillRect(x - 4, y - 16, 3, 29); c.fillStyle = '#c08a50'; c.beginPath(); c.moveTo(x - 4, y - 16); c.lineTo(x, y - 19); c.lineTo(x + 4, y - 16); c.fill(); if (snow) ell(c, x, y - 17, 5, 3, '#f4f8fb'); };
        const vertical = (m & 12) && !(m & 3);
        if (!vertical) {
          if (m & 2) { c.fillStyle = '#9a6a3a'; c.fillRect(-1, cy - 7, 6, 4); c.fillRect(-1, cy + 2, 6, 4); }
          if (m & 1) { c.fillStyle = '#9a6a3a'; c.fillRect(w - 5, cy - 7, 6, 4); c.fillRect(w - 5, cy + 2, 6, 4); }
          const gx0 = 7, gx1 = open ? 18 : w - 7, gy0 = cy - 10, gy1 = cy + 8;
          c.fillStyle = 'rgba(10,25,5,0.2)'; c.fillRect(gx0, gy1 + 5, gx1 - gx0, 2);
          c.fillStyle = '#b07a44'; for (const yy of [gy0, cy - 1.5, gy1 - 3]) c.fillRect(gx0, yy, gx1 - gx0, 3.5);
          c.fillStyle = '#d29a5c'; for (const yy of [gy0, cy - 1.5, gy1 - 3]) c.fillRect(gx0, yy, gx1 - gx0, 1);
          c.fillStyle = '#9a6a3a'; c.fillRect(gx1 - 3, gy0, 3, gy1 - gy0); c.fillRect(gx0, gy0, 3, gy1 - gy0);
          c.strokeStyle = '#9a6a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(gx0 + 2, gy1 - 2); c.lineTo(gx1 - 2, gy0 + 2); c.stroke();
          c.fillStyle = '#3a3a3a'; c.fillRect(gx0 - 1, gy0 + 2, 4, 2); c.fillRect(gx0 - 1, gy1 - 5, 4, 2); if (!open) c.fillRect(gx1 - 2, cy - 2, 5, 3);
          if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(gx0, gy0 - 1.5, gx1 - gx0, 2); }
          post(4, cy); post(w - 4, cy);
        } else {
          c.fillStyle = '#9a6a3a'; if (m & 8) c.fillRect(cx - 2, -2, 4, 6); if (m & 4) c.fillRect(cx - 2, h - 4, 4, 6);
          post(cx, 4);
          c.fillStyle = '#b07a44'; c.fillRect(cx - 2.5, 6, 5, open ? 12 : h - 14); c.fillStyle = '#d29a5c'; c.fillRect(cx - 2.5, 6, 1.5, open ? 12 : h - 14);
          post(cx, h - 4);
        }
        break;
      }
      case 'viveiro': {
        shadowRect(c, 6, h - 10, w - 4, 14);
        c.fillStyle = '#8a5a34'; c.fillRect(4, h - 12, w - 8, 8); c.fillStyle = '#a8764a'; c.fillRect(4, h - 12, w - 8, 2);
        c.fillStyle = 'rgba(70,45,20,0.55)'; c.fillRect(6, 16, w - 12, h - 28);
        c.fillStyle = '#e3c25a'; const r = rng(31); for (let i = 0; i < 26; i++) c.fillRect(8 + r() * (w - 20), h - 26 + r() * 12, 5, 1.2);
        siding(c, 6, 14, w - 12, 18, '#9a6a3a', false, 6, 13);
        c.fillStyle = '#7a4a28'; c.fillRect(w / 2 - 12, 20, 24, 10); c.fillStyle = '#e3c25a'; c.fillRect(w / 2 - 11, 22, 22, 4);
        for (const [bx, by] of [[22, h - 22], [w / 2 + 4, h - 18], [w - 22, h - 24]]) drawEmo('🐦', bx, by, 13, bx > w / 2, 1, 1, c);
        c.strokeStyle = 'rgba(225,225,215,0.75)'; c.lineWidth = 0.8; c.beginPath();
        for (let x = 6; x <= w - 6; x += 5) { c.moveTo(x, 14); c.lineTo(x, h - 12); }
        for (let y = 14; y <= h - 12; y += 5) { c.moveTo(6, y); c.lineTo(w - 6, y); }
        c.stroke();
        c.fillStyle = '#6b4423'; for (const x of [3, w / 2 - 2, w - 7]) c.fillRect(x, 10, 4, h - 18);
        c.fillRect(3, h - 14, w - 6, 3);
        c.strokeStyle = '#6b4423'; c.lineWidth = 2; c.strokeRect(w / 2 + 8, h - 40, 16, 26);
        roofPoly(c, [[-2, 18], [8, -8], [w - 8, -8], [w + 2, 18]], '#b5652f', snow);
        c.fillStyle = shade('#b5652f', -0.45); c.fillRect(-3, 16, w + 6, 3);
        break;
      }
      case 'curral': { // estábulo aberto (o pasto é feito com cercas de verdade)
        shadowRect(c, 6, h - 12, w - 2, 16);
        siding(c, 8, 26, w - 16, h - 34, '#8a5a34', true, 9, 71);
        c.fillStyle = '#2a1a10'; c.fillRect(20, 40, w - 40, h - 48);
        const ig = c.createLinearGradient(0, 40, 0, h - 8); ig.addColorStop(0, 'rgba(0,0,0,0.5)'); ig.addColorStop(1, 'rgba(60,40,20,0)'); c.fillStyle = ig; c.fillRect(20, 40, w - 40, h - 48);
        c.fillStyle = '#c9a24a'; c.fillRect(20, h - 22, w - 40, 14); const r = rng(57);
        for (let i = 0; i < 40; i++) { c.fillStyle = i % 2 ? '#e3c25a' : '#a8802a'; c.fillRect(22 + r() * (w - 48), h - 24 + r() * 14, 5, 1.2); }
        // fardos, cocho de feno e bebedouro dentro
        for (const [hx, hy] of [[26, h - 40], [40, h - 40], [33, h - 54]]) { c.fillStyle = '#d9b44a'; rrect(c, hx, hy, 16, 13, 2); c.fill(); c.fillStyle = '#b8902a'; c.fillRect(hx + 4, hy, 1.5, 13); c.fillRect(hx + 11, hy, 1.5, 13); c.fillStyle = '#efd070'; c.fillRect(hx, hy, 16, 1.5); }
        c.fillStyle = '#6b4423'; c.fillRect(w - 64, 48, 40, 4); c.strokeStyle = '#6b4423'; c.lineWidth = 1.6; c.beginPath(); for (let x = w - 62; x < w - 24; x += 5) { c.moveTo(x, 52); c.lineTo(x, 66); } c.stroke();
        c.fillStyle = '#e3c25a'; c.fillRect(w - 62, 44, 36, 4);
        c.fillStyle = '#8f989e'; rrect(c, w - 66, h - 30, 40, 12, 4); c.fill(); c.fillStyle = '#4f8fbf'; c.fillRect(w - 63, h - 28, 34, 4); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(w - 60, h - 28, 10, 1.2);
        // pilares
        for (const x of [8, w / 2 - 3, w - 14]) { c.fillStyle = '#5e3a20'; c.fillRect(x, 30, 6, h - 36); c.fillStyle = '#8a5a30'; c.fillRect(x, 30, 2, h - 36); }
        c.fillStyle = '#5e3a20'; c.fillRect(6, 34, w - 12, 6); c.fillStyle = '#8a5a30'; c.fillRect(6, 34, w - 12, 2);
        roofPoly(c, [[-4, 38], [12, -16], [w - 12, -16], [w + 4, 38]], '#6e5a48', snow);
        c.fillStyle = '#3a2d22'; c.fillRect(-5, 35, w + 10, 4);
        c.fillStyle = '#efe6d8'; c.fillRect(w / 2 - 18, -4, 36, 22); c.fillStyle = '#2a1a10'; c.fillRect(w / 2 - 15, -1, 30, 16); c.fillStyle = '#e3c25a'; c.fillRect(w / 2 - 14, 9, 28, 6);
        break;
      }
      case 'chiqueiro': { // pocilga coberta com cocho
        shadowRect(c, 6, h - 10, w - 4, 14);
        stones(c, 6, h - 30, w - 12, 24, '#a29b90', 81);
        siding(c, 6, 18, w - 12, h - 46, '#b07a44', false, 6, 82);
        c.fillStyle = '#2a1a10'; rrect(c, 16, h - 44, 30, 36, 3); c.fill();
        c.fillStyle = 'rgba(110,70,40,0.6)'; ell(c, 31, h - 10, 13, 3.5, c.fillStyle);
        c.fillStyle = '#e3c25a'; for (let i = 0; i < 8; i++) c.fillRect(18 + i * 3.4, h - 14 - (i % 2), 4, 1.2);
        // cocho embutido na frente
        c.fillStyle = '#8a8378'; rrect(c, w - 64, h - 22, 50, 14, 3); c.fill(); c.fillStyle = '#3a3026'; c.fillRect(w - 61, h - 20, 44, 7);
        if (variant) { c.fillStyle = '#d9b44a'; c.fillRect(w - 61, h - 20 + (4 - variant) * 1.5, 44, 7 - (4 - variant) * 1.5); const r = rng(3); for (let i = 0; i < variant * 4; i++) { c.fillStyle = i % 2 ? '#b8902a' : '#f0d070'; c.fillRect(w - 60 + r() * 40, h - 19 + (4 - variant) * 1.5 + r() * 3, 2, 1.2); } }
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(w - 64, h - 22, 50, 1.5);
        c.fillStyle = '#4a2c16'; c.fillRect(w - 44, 26, 18, 10); c.fillStyle = '#2a1a10'; c.fillRect(w - 42, 28, 14, 6);
        ell(c, w - 22, h - 4, 12, 3, 'rgba(100,70,40,0.45)');
        roofPoly(c, [[-2, 26], [10, -8], [w - 10, -8], [w + 2, 26]], '#a0503a', snow);
        c.fillStyle = shade('#a0503a', -0.45); c.fillRect(-3, 23, w + 6, 4);
        break;
      }
      case 'espaldeira': paintTrellis(c, w / 2, h - 5, snow); break;
      case 'cisterna': {
        const top = [38, 30, 22][lv - 1], ins = [10, 6, 3][lv - 1], x0 = ins, x1 = w - ins, cx = w / 2, rx = (x1 - x0) / 2, bot = h - 10;
        ell(c, cx + 4, bot + 3, rx + 6, 8, 'rgba(10,25,5,0.25)');
        if (lv >= 3) { // calha sobre postes
          for (const px of [2, w - 4]) { c.fillStyle = '#6e4626'; c.fillRect(px, -14, 4, top + 10); }
          c.fillStyle = '#9aa6ae'; c.fillRect(-2, -16, w + 4, 5); c.fillStyle = '#c8d0d6'; c.fillRect(-2, -16, w + 4, 1.5);
        }
        // cano da calha
        c.strokeStyle = '#8a969e'; c.lineWidth = 4; c.beginPath(); c.moveTo(lv >= 3 ? 4 : -6, lv >= 3 ? -12 : -2); c.lineTo(x0 + 8, top - 6); c.lineTo(cx - 8, top - 4); c.stroke();
        c.strokeStyle = '#c8d0d6'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(lv >= 3 ? 4 : -6, lv >= 3 ? -13.5 : -3.5); c.lineTo(x0 + 8, top - 7.5); c.stroke();
        // corpo de placas
        c.save(); c.beginPath(); c.moveTo(x0, top); c.lineTo(x0, bot); c.ellipse(cx, bot, rx, 7, 0, Math.PI, 0, true); c.lineTo(x1, top); c.closePath(); c.clip();
        c.fillStyle = '#e6e1d6'; c.fillRect(x0, top - 2, x1 - x0, bot - top + 10);
        c.strokeStyle = 'rgba(120,110,95,0.45)'; c.lineWidth = 1; c.beginPath();
        for (let yy = top + 10; yy < bot + 6; yy += 11) { c.moveTo(x0, yy); c.quadraticCurveTo(cx, yy + 6, x1, yy); }
        for (let k = -3; k <= 3; k++) { const xx = cx + Math.sin(k / 3.6) * rx; c.moveTo(xx, top); c.lineTo(xx, bot + 7); }
        c.stroke();
        if (lv >= 2) { c.fillStyle = '#3f86c8'; c.fillRect(x0, bot - 8, x1 - x0, 4); }
        const sg = c.createLinearGradient(x0, 0, x1, 0); sg.addColorStop(0, 'rgba(255,255,255,0.2)'); sg.addColorStop(0.45, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)'); c.fillStyle = sg; c.fillRect(x0, top - 2, x1 - x0, bot - top + 10);
        c.restore();
        // tampa cônica
        c.fillStyle = '#d6d0c4'; c.beginPath(); c.moveTo(x0 - 2, top); c.lineTo(cx, top - 16 - lv * 2); c.lineTo(x1 + 2, top); c.ellipse(cx, top, rx + 2, 7, 0, 0, Math.PI); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.moveTo(x0 - 2, top); c.lineTo(cx, top - 16 - lv * 2); c.lineTo(cx - 8, top + 5); c.fill();
        if (snow) { c.fillStyle = '#f6fafd'; c.beginPath(); c.moveTo(x0 + 4, top - 3); c.lineTo(cx, top - 16 - lv * 2); c.lineTo(x1 - 4, top - 3); c.quadraticCurveTo(cx, top + 2, x0 + 4, top - 3); c.fill(); }
        c.fillStyle = '#8a8378'; rrect(c, cx - 5, top - 9 - lv, 10, 5, 1.5); c.fill();
        // régua de nível
        const gx = x1 - 14, gy0 = top + 6, gy1 = bot - 4, lvl = variant / 4;
        c.fillStyle = '#5a646a'; rrect(c, gx - 1.5, gy0 - 1.5, 7, gy1 - gy0 + 3, 2); c.fill();
        c.fillStyle = 'rgba(220,240,250,0.85)'; c.fillRect(gx, gy0, 4, gy1 - gy0);
        if (lvl > 0) { c.fillStyle = '#2f86d8'; c.fillRect(gx, gy1 - (gy1 - gy0) * lvl, 4, (gy1 - gy0) * lvl); c.fillStyle = '#9ad4ff'; c.fillRect(gx, gy1 - (gy1 - gy0) * lvl, 4, 1); }
        c.fillStyle = '#5a646a'; for (let k = 1; k < 4; k++) c.fillRect(gx + 4, gy0 + (gy1 - gy0) * k / 4, 2.5, 0.8);
        // torneira e balde
        c.fillStyle = '#8a969e'; c.fillRect(cx - 14, bot - 6, 8, 3); c.fillRect(cx - 9, bot - 6, 3, 6);
        c.fillStyle = '#4f8fbf'; c.beginPath(); c.moveTo(cx - 14, bot + 2); c.lineTo(cx - 2, bot + 2); c.lineTo(cx - 3.5, bot + 11); c.lineTo(cx - 12.5, bot + 11); c.fill();
        c.fillStyle = '#9ad4ff'; c.fillRect(cx - 13, bot + 2.5, 10, 2);
        break;
      }
      case 'roda_dagua': {
        shadowRect(c, 2, h - 10, w / 2 + 4, 12);
        // casinha da bomba
        siding(c, 4, 34, 40, h - 40, '#a8764a', true, 7, 141);
        c.fillStyle = '#2a1a10'; c.fillRect(14, h - 26, 16, 20); c.fillStyle = '#8a969e'; c.fillRect(30, 50, 22, 4);
        roofPoly(c, [[-2, 40], [8, 16], [40, 16], [50, 40]], '#7a4a28', snow);
        c.fillStyle = shade('#7a4a28', -0.45); c.fillRect(-3, 37, 54, 3);
        // calha de madeira trazendo água
        c.fillStyle = '#6b4423'; c.fillRect(w - 40, 6, 44, 7); c.fillStyle = '#4f9fd8'; c.fillRect(w - 38, 7, 42, 3);
        c.fillStyle = '#5e3a20'; c.fillRect(w + 1, 10, 4, 40);
        // suportes do eixo
        c.fillStyle = '#5e3a20'; c.fillRect(w - 30, 44, 6, h - 46); c.fillRect(w - 22, 44, 6, h - 46);
        c.fillStyle = '#8a5a30'; c.fillRect(w - 30, 44, 2, h - 46);
        break;
      }
      case 'catavento': {
        const cx = w / 2, by = h - 4, ty = -62;
        ell(c, cx + 2, by + 1, 14, 4, 'rgba(10,25,5,0.25)');
        c.strokeStyle = '#7d8a92'; c.lineWidth = 2.4; c.beginPath();
        c.moveTo(cx - 14, by); c.lineTo(cx - 3, ty); c.moveTo(cx + 14, by); c.lineTo(cx + 3, ty); c.stroke();
        c.lineWidth = 1; c.strokeStyle = '#9aa6ae'; c.beginPath();
        for (let k = 0; k < 6; k++) {
          const ya = by - k * (by - ty) / 6, yb = by - (k + 1) * (by - ty) / 6;
          const wa = 14 - k * 11 / 6, wb = 14 - (k + 1) * 11 / 6;
          c.moveTo(cx - wa, ya); c.lineTo(cx + wb, yb); c.moveTo(cx + wa, ya); c.lineTo(cx - wb, yb); c.moveTo(cx - wb, yb); c.lineTo(cx + wb, yb);
        }
        c.stroke();
        c.strokeStyle = '#5a646a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx, ty); c.lineTo(cx, by - 2); c.stroke();
        c.fillStyle = '#5a646a'; c.fillRect(cx - 6, ty - 2, 12, 4);
        // cauda (leme)
        c.strokeStyle = '#5a646a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx, ty - 2); c.lineTo(cx - 18, ty - 4); c.stroke();
        c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(cx - 14, ty - 4); c.lineTo(cx - 24, ty - 12); c.lineTo(cx - 24, ty + 3); c.closePath(); c.fill();
        // base: bomba e cocho d'água
        c.fillStyle = '#9a948a'; rrect(c, cx - 16, by - 8, 32, 9, 2); c.fill(); c.fillStyle = '#4f8fbf'; c.fillRect(cx - 14, by - 7, 28, 3);
        c.fillStyle = '#5a646a'; c.fillRect(cx + 4, by - 16, 3, 9); c.fillRect(cx + 4, by - 16, 7, 2);
        if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(cx - 7, ty - 4, 14, 2); }
        break;
      }
      case 'biodigestor': {
        const g = variant / 4, cx = w / 2 + 6, base = h - 14;
        shadowRect(c, 4, h - 10, w - 2, 12);
        if (lv >= 2) { // gasômetro
          const gx = 6, gy = 8;
          c.fillStyle = '#8a8378'; c.fillRect(gx, gy + 30, 30, 6);
          c.fillStyle = '#9aa6ae'; c.fillRect(gx + 2, gy + 6 + (1 - g) * 6, 26, 26 - (1 - g) * 6); ell(c, gx + 15, gy + 6 + (1 - g) * 6, 13, 4, '#c8d0d6');
          c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(gx + 20, gy + 8 + (1 - g) * 6, 8, 24 - (1 - g) * 6);
          c.strokeStyle = '#e8c23a'; c.lineWidth = 2; c.beginPath(); c.moveTo(gx + 28, gy + 26); c.lineTo(cx - 8, base - 18); c.stroke();
        }
        // anel de concreto
        ell(c, cx, base + 2, 35, 10, '#8a8378'); ell(c, cx, base, 34, 9, '#b5ada0');
        // cúpula inflável
        const ry = 12 + g * 24;
        c.fillStyle = '#2f3a2c'; c.beginPath(); c.ellipse(cx, base, 32, ry, 0, Math.PI, 0); c.fill();
        c.save(); c.beginPath(); c.ellipse(cx, base, 32, ry, 0, Math.PI, 0); c.clip();
        c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1; c.beginPath(); for (let k = -2; k <= 2; k++) { c.moveTo(cx + k * 10, base); c.quadraticCurveTo(cx + k * 6, base - ry * 1.2, cx + k * 3, base - ry); } c.stroke();
        ell(c, cx - 10, base - ry * 0.65, 8, Math.max(2, ry * 0.25), 'rgba(255,255,255,0.22)');
        c.restore();
        c.strokeStyle = '#c9b48a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - 28, base); c.quadraticCurveTo(cx, base - ry * 1.9, cx + 28, base); c.stroke();
        if (snow) ell(c, cx, base - ry + 2, 14, 3, 'rgba(245,250,252,0.9)');
        // válvula e cano de gás
        c.fillStyle = '#e8c23a'; c.fillRect(cx - 1.5, base - ry - 6, 3, 7); c.fillStyle = '#c0392b'; c.fillRect(cx - 4, base - ry - 7, 8, 2.5);
        c.strokeStyle = '#e8c23a'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, base - ry - 5); c.lineTo(cx + 22, base - ry - 5); c.lineTo(cx + 22, h - 6); c.stroke();
        // caixa de entrada de esterco
        c.fillStyle = '#9a948a'; rrect(c, 2, h - 30, 22, 18, 2); c.fill(); c.fillStyle = '#5a3a1f'; c.fillRect(5, h - 27, 16, 8); c.fillStyle = '#7a5a2a'; c.fillRect(5, h - 27, 16, 2);
        c.strokeStyle = '#7a756d'; c.lineWidth = 3; c.beginPath(); c.moveTo(22, h - 18); c.lineTo(cx - 26, base - 2); c.stroke();
        if (lv >= 3) { // gerador
          const gx = w - 28, gy = h - 30;
          c.fillStyle = '#3f8a4a'; rrect(c, gx, gy, 24, 18, 3); c.fill(); c.fillStyle = '#5fae6a'; c.fillRect(gx + 2, gy + 2, 20, 3);
          c.fillStyle = '#2a2a2a'; for (let k = 0; k < 4; k++) c.fillRect(gx + 4 + k * 4.5, gy + 8, 2.5, 7);
          c.fillStyle = '#5a646a'; c.fillRect(gx + 18, gy - 8, 3, 8); circ(c, gx + 6, gy + 5, 1.2, '#7cff6a');
          c.strokeStyle = '#2a2a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(gx, gy + 10); c.quadraticCurveTo(gx - 10, gy + 20, gx - 18, gy + 16); c.stroke();
        }
        break;
      }
      case 'painel_solar': {
        const panel = (ox, oy, sc) => {
          c.fillStyle = '#5a646a'; c.fillRect(ox + 6 * sc, oy + 18 * sc, 2.5, 18 * sc); c.fillRect(ox + 28 * sc, oy + 12 * sc, 2.5, 24 * sc);
          c.fillStyle = '#c8ccd0'; c.beginPath(); c.moveTo(ox, oy + 22 * sc); c.lineTo(ox + 6 * sc, oy); c.lineTo(ox + 38 * sc, oy); c.lineTo(ox + 34 * sc, oy + 22 * sc); c.closePath(); c.fill();
          c.fillStyle = '#1f3a6e'; c.beginPath(); c.moveTo(ox + 2 * sc, oy + 20.5 * sc); c.lineTo(ox + 7 * sc, oy + 1.5 * sc); c.lineTo(ox + 36.5 * sc, oy + 1.5 * sc); c.lineTo(ox + 32.5 * sc, oy + 20.5 * sc); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(140,180,230,0.55)'; c.lineWidth = 0.6; c.beginPath();
          for (let k = 1; k < 6; k++) { c.moveTo(ox + (2 + k * 5.1) * sc, oy + 20.5 * sc); c.lineTo(ox + (7 + k * 4.9) * sc, oy + 1.5 * sc); }
          for (let k = 1; k < 3; k++) { const yy = oy + (1.5 + k * 6.3) * sc; c.moveTo(ox + (7 - k * 1.7) * sc, yy); c.lineTo(ox + (36.5 - k * 1.35) * sc, yy); }
          c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(ox + 10 * sc, oy + 1.5 * sc); c.lineTo(ox + 17 * sc, oy + 1.5 * sc); c.lineTo(ox + 9 * sc, oy + 20.5 * sc); c.lineTo(ox + 4 * sc, oy + 20.5 * sc); c.fill();
          if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(ox + 6 * sc, oy - 1, 32 * sc, 2.5); }
        };
        ell(c, w / 2 + 2, h - 5, 18, 4, 'rgba(10,25,5,0.25)');
        if (lv >= 2) { panel(4, -4, 0.85); panel(6, 12, 0.85); }
        else panel(3, 6, 1);
        if (lv >= 3) {
          c.fillStyle = '#5a646a'; rrect(c, w - 14, h - 22, 13, 18, 2); c.fill(); c.fillStyle = '#7d8a92'; c.fillRect(w - 13, h - 21, 11, 3);
          circ(c, w - 7.5, h - 14, 1.3, '#7cff6a'); c.fillStyle = '#e8c23a'; c.fillRect(w - 11, h - 9, 7, 2);
          c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.moveTo(w - 14, h - 16); c.quadraticCurveTo(w - 20, h - 12, w - 22, h - 20); c.stroke();
        }
        break;
      }
      case 'fogao_biogas': {
        const cx = w / 2;
        ell(c, cx + 2, h - 3, 18, 4, 'rgba(10,25,5,0.25)');
        c.fillStyle = '#7a756d'; c.fillRect(cx + 6, -10, 7, 22); c.fillStyle = '#5a564f'; c.fillRect(cx + 5, -12, 9, 3);
        c.save(); c.beginPath(); c.rect(4, 14, w - 8, h - 17); c.clip();
        c.fillStyle = '#9a4a32'; c.fillRect(4, 14, w - 8, h - 17);
        for (let row = 0; row < 5; row++) for (let k = -1; k < 6; k++) { c.fillStyle = (row + k) % 3 ? '#b85a3a' : '#a44e34'; c.fillRect(4 + k * 8 + (row % 2) * 4 + 0.5, 14 + row * 5.5 + 0.5, 7, 4.5); }
        c.restore();
        c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(cx, h - 4, 7, Math.PI, 0); c.fill();
        c.fillStyle = '#3a3a3e'; c.fillRect(2, 10, w - 4, 5); c.fillStyle = '#5a5a60'; c.fillRect(2, 10, w - 4, 1.5);
        ell(c, cx - 6, 11, 6, 2, '#1a1a1a'); circ(c, cx - 6, 11, 2, '#5a5a60');
        c.strokeStyle = '#e8c23a'; c.lineWidth = 2; c.beginPath(); c.moveTo(w - 3, 13); c.lineTo(w + 6, 13); c.lineTo(w + 6, h); c.stroke();
        c.fillStyle = '#c0392b'; c.fillRect(w + 3, 20, 6, 3);
        if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(cx + 5, -13, 9, 2); }
        break;
      }
      case 'banco_sementes': {
        shadowRect(c, 6, h - 10, w - 4, 14);
        // paredes caiadas
        c.fillStyle = '#f3ede0'; c.fillRect(6, 22, w - 12, h - 28);
        const r = rng(123); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(150,130,100,${0.05 + r() * 0.08})`; ell(c, 8 + r() * (w - 16), 26 + r() * (h - 34), 2 + r() * 4, 1 + r() * 2, c.fillStyle); }
        c.fillStyle = '#c99a5a'; c.fillRect(6, h - 14, w - 12, 8); c.fillStyle = '#a87a42'; c.fillRect(6, h - 14, w - 12, 1.5);
        const sg = c.createLinearGradient(0, 22, 0, 40); sg.addColorStop(0, 'rgba(0,0,0,0.2)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(6, 22, w - 12, 18);
        const jars = (x0, y0, ww, rows) => {
          c.fillStyle = '#3a2414'; c.fillRect(x0, y0, ww, rows * 10 + 2);
          const jc = ['#e8c23a', '#c0392b', '#7a4a2a', '#8fbf3a', '#e8822a', '#f2efe0', '#6a3a7a', '#3a2a1a'], rj = rng(x0 * 7 + y0);
          for (let j = 0; j < rows; j++) {
            c.fillStyle = '#8a5a30'; c.fillRect(x0, y0 + j * 10 + 9, ww, 2);
            for (let x = x0 + 1.5; x < x0 + ww - 4; x += 5) {
              c.fillStyle = 'rgba(220,240,250,0.55)'; c.fillRect(x, y0 + j * 10 + 2, 4, 7);
              c.fillStyle = jc[Math.floor(rj() * jc.length)]; c.fillRect(x + 0.5, y0 + j * 10 + 4 + rj() * 1.5, 3, 4.5);
              c.fillStyle = '#b8902a'; c.fillRect(x, y0 + j * 10 + 1.5, 4, 1.2);
            }
          }
        };
        // porta aberta com prateleiras
        c.fillStyle = '#6b4423'; c.fillRect(12, h - 50, 28, 44);
        jars(15, h - 47, 22, 4);
        c.fillStyle = '#8a5a30'; c.fillRect(38, h - 49, 6, 42); c.fillStyle = '#a8764a'; c.fillRect(38, h - 49, 2, 42);
        // janela aberta com potes
        c.fillStyle = '#6b4423'; c.fillRect(52, 40, 26, 22); jars(54, 41, 22, 2);
        c.fillStyle = '#4f8a6a'; c.fillRect(46, 40, 6, 22); c.fillRect(78, 40, 6, 22);
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(47, 41, 1.2, 20); c.fillRect(79, 41, 1.2, 20);
        c.fillStyle = '#8a5a34'; c.fillRect(49, 62, 32, 3);
        // tranças de milho e ervas
        c.strokeStyle = '#c9b48a'; c.lineWidth = 1; c.beginPath(); c.moveTo(47, 30); c.lineTo(47, 36); c.stroke();
        for (let i = 0; i < 4; i++) { ell(c, 47 + (i % 2 ? 2 : -2), 39 + i * 5, 2.4, 3.6, i % 3 ? '#f2c23a' : '#e0a028'); c.fillStyle = '#d8c48a'; c.fillRect(46, 36 + i * 5, 2, 2); }
        for (const [hx, col] of [[58, '#6f9a3a'], [66, '#8a9a4a'], [74, '#5a8a3a']]) {
          c.strokeStyle = '#c9b48a'; c.beginPath(); c.moveTo(hx, 30); c.lineTo(hx, 33); c.stroke();
          c.fillStyle = col; c.beginPath(); c.moveTo(hx - 3, 33); c.lineTo(hx + 3, 33); c.lineTo(hx + 1.5, 39); c.lineTo(hx - 1.5, 39); c.fill();
          c.fillStyle = '#a0303a'; c.fillRect(hx - 2.5, 33, 5, 1.5);
        }
        // telhado de telhas
        roofPoly(c, [[-4, 30], [12, -14], [w - 12, -14], [w + 4, 30]], '#c4603a', snow);
        c.fillStyle = shade('#c4603a', -0.45); c.fillRect(-5, 27, w + 10, 4);
        // plaquinha pintada
        c.fillStyle = '#7a4a28'; rrect(c, 8, 33, 34, 11, 2); c.fill(); c.strokeStyle = '#f2d36a'; c.lineWidth = 0.8; rrect(c, 9.5, 34.5, 31, 8, 1.5); c.stroke();
        c.fillStyle = '#fff4c8'; c.font = 'bold 5.5px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SEMENTES', 25, 39, 24); c.textBaseline = 'alphabetic';
        circ(c, 11.5, 38.5, 1.2, '#8fbf3a'); circ(c, 38.5, 38.5, 1.2, '#e8c23a');
        if (lv >= 2) {
          // banco de madeira
          c.fillStyle = 'rgba(10,25,5,0.25)'; c.fillRect(54, h + 2, 30, 3);
          c.fillStyle = '#6b4423'; c.fillRect(56, h - 4, 3, 8); c.fillRect(79, h - 4, 3, 8);
          c.fillStyle = '#a8764a'; c.fillRect(53, h - 6, 32, 4); c.fillStyle = '#c99a5a'; c.fillRect(53, h - 6, 32, 1.2);
          c.fillStyle = '#8a5a30'; c.fillRect(53, h - 14, 32, 3); c.fillRect(56, h - 14, 2, 8); c.fillRect(80, h - 14, 2, 8);
          // cavalete com lousa
          c.strokeStyle = '#7a4a28'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, h + 4); c.lineTo(0, h - 22); c.lineTo(6, h + 4); c.stroke();
          c.fillStyle = '#7a4a28'; c.fillRect(-8, h - 20, 16, 16); c.fillStyle = '#2f3a34'; c.fillRect(-6.5, h - 18.5, 13, 13);
          c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-4.5, h - 15); c.lineTo(4, h - 15); c.moveTo(-4.5, h - 12); c.lineTo(2, h - 12); c.moveTo(-4.5, h - 9); c.lineTo(3.5, h - 9); c.stroke();
          circ(c, 3.5, h - 8, 1, '#f2d36a');
        }
        if (lv >= 3) {
          // anexo isolado (câmara fria) e condensador de ar
          c.fillStyle = 'rgba(10,25,5,0.22)'; c.fillRect(w - 6, h - 4, 22, 5);
          c.fillStyle = '#e8eef2'; c.fillRect(w - 6, 30, 20, h - 34); c.fillStyle = '#c8d2d8'; for (let y = 34; y < h - 4; y += 7) c.fillRect(w - 6, y, 20, 1);
          c.fillStyle = '#9aa6ae'; c.fillRect(w - 7, 28, 22, 3);
          c.fillStyle = '#f7fafc'; rrect(c, w - 3, 44, 15, 13, 2); c.fill(); c.strokeStyle = '#8a969e'; c.lineWidth = 0.8; c.stroke();
          c.beginPath(); c.arc(w + 4.5, 50.5, 4.5, 0, TAU); c.stroke();
          c.beginPath(); for (let i = 0; i < 4; i++) { const a = i * 1.57; c.moveTo(w + 4.5, 50.5); c.lineTo(w + 4.5 + Math.cos(a) * 4, 50.5 + Math.sin(a) * 4); } c.stroke();
          c.fillStyle = '#4fa8d8'; c.fillRect(w - 1, h - 14, 3, 3);
          if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(w - 7, 26, 22, 3); }
        }
        break;
      }
      case 'ponte': {
        const hor = variant & 1, endA = variant & 2, endB = variant & 4;
        const r = rng(variant * 7 + 1), pc = ['#a8743f', '#9a6a38', '#b5804a', '#8f6234'];
        if (hor) {
          const x0 = endA ? -6 : 0, x1 = endB ? w + 6 : w;
          c.fillStyle = 'rgba(0,30,60,0.32)'; c.fillRect(x0 + 2, 34, x1 - x0 - 2, 8);
          if (endA) { c.fillStyle = '#8a8378'; rrect(c, -8, 8, 8, 30, 3); c.fill(); }
          if (endB) { c.fillStyle = '#8a8378'; rrect(c, w, 8, 8, 30, 3); c.fill(); }
          c.fillStyle = '#5e3a20'; c.fillRect(x0, 9, x1 - x0, 26);
          for (let x = x0; x < x1; x += 5.5) { c.fillStyle = pc[Math.floor(r() * 4)]; c.fillRect(x + 0.5, 10 + (r() - 0.5), 4.5, 24); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + 0.5, 10, 4.5, 1.2); c.fillStyle = 'rgba(40,25,10,0.5)'; c.fillRect(x + 2.2, 13, 1, 1); c.fillRect(x + 2.2, 30, 1, 1); }
          for (const ry of [7, 33]) {
            c.fillStyle = '#6e4626'; c.fillRect(x0, ry - 1, x1 - x0, 4); c.fillStyle = '#b07a44'; c.fillRect(x0, ry - 1, x1 - x0, 1.2);
            for (const px of [x0 + 3, (x0 + x1) / 2, x1 - 3]) { c.fillStyle = '#5e3a20'; c.fillRect(px - 2, ry - 7, 4, 9); c.fillStyle = '#8a5a30'; c.fillRect(px - 2, ry - 7, 1.4, 9); }
            c.fillStyle = '#8a5a30'; c.fillRect(x0, ry - 6, x1 - x0, 2.5);
            if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(x0, ry - 7.5, x1 - x0, 2); }
          }
        } else {
          const y0 = endA ? -6 : 0, y1 = endB ? h + 6 : h;
          c.fillStyle = 'rgba(0,30,60,0.32)'; c.fillRect(36, y0 + 4, 7, y1 - y0 - 2);
          if (endA) { c.fillStyle = '#8a8378'; rrect(c, 7, -8, 30, 8, 3); c.fill(); }
          if (endB) { c.fillStyle = '#8a8378'; rrect(c, 7, h, 30, 8, 3); c.fill(); }
          c.fillStyle = '#5e3a20'; c.fillRect(8, y0, 28, y1 - y0);
          for (let y = y0; y < y1; y += 5.5) { c.fillStyle = pc[Math.floor(r() * 4)]; c.fillRect(9 + (r() - 0.5), y + 0.5, 26, 4.5); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(9, y + 0.5, 26, 1.2); c.fillStyle = 'rgba(40,25,10,0.5)'; c.fillRect(12, y + 2.2, 1, 1); c.fillRect(32, y + 2.2, 1, 1); }
          for (const rx of [6, 38]) {
            c.fillStyle = '#6e4626'; c.fillRect(rx - 2, y0, 4, y1 - y0); c.fillStyle = '#b07a44'; c.fillRect(rx - 2, y0, 1.2, y1 - y0);
            for (const py of [y0 + 4, (y0 + y1) / 2, y1 - 4]) { c.fillStyle = '#5e3a20'; c.fillRect(rx - 2.5, py - 8, 5, 10); c.fillStyle = '#8a5a30'; c.fillRect(rx - 2.5, py - 8, 1.6, 10); if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(rx - 2.5, py - 9.5, 5, 2); } }
          }
        }
        break;
      }
      case 'tanque': {
        shadowRect(c, 4, h - 12, w - 2, 16);
        rrect(c, 2, 6, w - 4, h - 10, 16); c.fillStyle = '#8f8a82'; c.fill();
        c.save(); rrect(c, 2, 6, w - 4, h - 10, 16); c.clip(); stones(c, 0, 4, w, h, '#b9b3a8', 61); c.restore();
        const wg = c.createLinearGradient(0, 14, 0, h - 10); wg.addColorStop(0, snow ? '#8fc0d8' : '#2f7f8f'); wg.addColorStop(1, snow ? '#5f92b8' : '#1f5468');
        rrect(c, 12, 16, w - 24, h - 30, 10); c.fillStyle = wg; c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(14, 16, w - 28, 4);
        if (variant) { const r = rng(7); c.fillStyle = '#c99a4a'; for (let i = 0; i < variant * 6; i++) circ(c, 20 + r() * (w - 40), 24 + r() * (h - 50), 1.2); }
        if (snow) { c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(24, 40); c.lineTo(50, 60); c.lineTo(80, 52); c.stroke(); }
        // aerador
        c.fillStyle = '#d8d2c4'; rrect(c, w - 30, 10, 18, 10, 2); c.fill(); c.fillStyle = '#5a7a8a'; c.fillRect(w - 26, 12, 10, 4);
        break;
      }
      case 'silo': {
        ell(c, w / 2 + 4, h - 6, 34, 8, 'rgba(10,25,5,0.25)');
        const x0 = 16, x1 = w - 16, top = -6, bot = h - 8;
        const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#9aa6ae'); g.addColorStop(0.3, '#e2e8ec'); g.addColorStop(0.7, '#b8c2c8'); g.addColorStop(1, '#7d8a92');
        c.fillStyle = g; c.fillRect(x0, top, x1 - x0, bot - top); c.beginPath(); c.ellipse(w / 2, bot, (x1 - x0) / 2, 7, 0, 0, Math.PI); c.fill();
        c.strokeStyle = 'rgba(60,70,80,0.25)'; c.lineWidth = 1; c.beginPath(); for (let x = x0 + 4; x < x1; x += 4) { c.moveTo(x, top); c.lineTo(x, bot + 5); } c.stroke();
        c.fillStyle = 'rgba(60,70,80,0.45)'; for (let y = top + 16; y < bot; y += 18) c.fillRect(x0, y, x1 - x0, 2);
        // cobertura cônica
        c.fillStyle = '#c4553c'; c.beginPath(); c.moveTo(x0 - 4, top + 2); c.lineTo(w / 2, top - 30); c.lineTo(x1 + 4, top + 2); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(x0 - 4, top + 2); c.lineTo(w / 2, top - 30); c.lineTo(w / 2 - 6, top + 2); c.closePath(); c.fill();
        c.fillStyle = '#8c3322'; c.beginPath(); c.ellipse(w / 2, top + 2, (x1 - x0) / 2 + 4, 4, 0, 0, Math.PI); c.fill();
        if (snow) { c.fillStyle = '#f4f8fb'; c.beginPath(); c.moveTo(w / 2 - 12, top - 18); c.lineTo(w / 2, top - 30); c.lineTo(w / 2 + 12, top - 18); c.quadraticCurveTo(w / 2, top - 14, w / 2 - 12, top - 18); c.fill(); }
        circ(c, w / 2, top - 30, 2.5, '#8c3322');
        // visor de nível
        c.fillStyle = '#3a4248'; c.fillRect(x0 + 6, top + 12, 7, bot - top - 22);
        const lvl = variant / 4, gh = bot - top - 26;
        if (lvl > 0) { c.fillStyle = '#e3b84a'; c.fillRect(x0 + 7.5, top + 14 + gh * (1 - lvl), 4, gh * lvl); }
        // escada
        c.strokeStyle = '#5a646a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x1 - 10, top + 4); c.lineTo(x1 - 10, bot + 4); c.moveTo(x1 - 3, top + 4); c.lineTo(x1 - 3, bot + 4);
        for (let y = top + 8; y < bot; y += 6) { c.moveTo(x1 - 10, y); c.lineTo(x1 - 3, y); } c.stroke();
        c.fillStyle = '#5a646a'; rrect(c, w / 2 - 7, bot - 12, 14, 12, 2); c.fill();
        break;
      }
      case 'aspersor': {
        const cx = w / 2, cy = h / 2 + 8;
        ell(c, cx, cy + 2, 8, 3, 'rgba(10,25,5,0.3)');
        c.fillStyle = '#6a737a'; c.fillRect(cx - 2, cy - 12, 4, 14); c.fillStyle = '#9aa4ac'; c.fillRect(cx - 2, cy - 12, 1.5, 14);
        c.fillStyle = '#c9a43a'; rrect(c, cx - 6, cy - 17, 12, 6, 2); c.fill(); c.fillStyle = '#e8c860'; c.fillRect(cx - 5, cy - 16, 5, 1.5);
        c.fillStyle = '#3f6ea8'; circ(c, cx, cy - 18, 2.4);
        break;
      }
      default: {
        const def = D.buildings[type] || {};
        shadowRect(c, 6, h - 10, w - 4, 12);
        const bw = Math.min(w - 8, 60), bh = Math.min(h - 8, 46), bx = (w - bw) / 2, by = h - bh - 4;
        siding(c, bx, by, bw, bh, '#a8764a', true, 8, 5);
        c.strokeStyle = '#5a3a1f'; c.lineWidth = 2.5; c.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
        c.beginPath(); c.moveTo(bx + 2, by + 2); c.lineTo(bx + bw - 2, by + bh - 2); c.stroke();
        c.fillStyle = '#7a4a28'; c.fillRect(bx - 3, by - 5, bw + 6, 6);
        if (snow) { c.fillStyle = '#f4f8fb'; c.fillRect(bx - 3, by - 7, bw + 6, 3); }
        if (def.i) drawEmo(def.i, w / 2, by + bh / 2, Math.min(26, bh * 0.6), false, 1, 1, c);
      }
    }
    if (lv >= 2 && type !== 'ponte' && type !== 'painel_solar') levelExtras(c, type, w, h, lv, season, snow);
  }
  // melhorias visuais por nível (2: jardineiras e acabamento; 3: placa solar e cata-vento)
  const ROOF_AT = { banco_sementes: [0.68, 2], casa: [0.26, 14], galinheiro: [0.32, 6], galpao: [0.27, 20], curral: [0.2, 2], viveiro: [0.3, 2], chiqueiro: [0.78, 0], loja: [0.22, 18], moinho: [0.5, 30], poco: [0.5, -4], silo: [0.5, 50] };
  function levelExtras(c, type, w, h, lv, season, snow) {
    const small = w <= TS && h <= TS;
    if (small) {
      c.fillStyle = '#d4a93a'; c.fillRect(w / 2 - 12, h - 8, 24, 2.5); c.fillStyle = '#f2d36a'; c.fillRect(w / 2 - 12, h - 8, 24, 1);
      if (lv >= 3) { c.fillStyle = '#d4a93a'; c.fillRect(w / 2 - 12, h - 14, 24, 2); }
      return;
    }
    // acabamento pintado na base
    c.fillStyle = 'rgba(240,230,210,0.85)'; c.fillRect(6, h - 6, w - 12, 2);
    const fl = season === 3 ? null : season === 2 ? ['#e8822a', '#c0392b'] : ['#ff6f91', '#ffd23a', '#ffffff', '#c7a6ff'];
    for (const bx of ['banco_sementes', 'cisterna', 'biodigestor', 'roda_dagua'].includes(type) ? [] : [4, w - 24]) {
      c.fillStyle = '#7a4a28'; rrect(c, bx, h - 12, 20, 9, 2); c.fill(); c.fillStyle = '#a8764a'; c.fillRect(bx, h - 12, 20, 1.5);
      if (fl) { for (let i = 0; i < 4; i++) circ(c, bx + 3 + i * 4.6, h - 13, 3, i % 2 ? '#3f8a35' : '#55a83f'); for (let i = 0; i < 4; i++) circ(c, bx + 3 + i * 4.6, h - 15, 1.6, fl[i % fl.length]); }
      else { c.fillStyle = '#f4f8fb'; c.fillRect(bx, h - 14, 20, 3); }
    }
    if (lv >= 3) {
      const a = ROOF_AT[type];
      if (!a) return;
      const sx = w * a[0], sy = a[1];
      if (type !== 'moinho' && type !== 'silo' && type !== 'poco') {
        c.fillStyle = '#c8ccd0'; c.beginPath(); c.moveTo(sx - 16, sy + 12); c.lineTo(sx - 11, sy - 2); c.lineTo(sx + 17, sy - 2); c.lineTo(sx + 14, sy + 12); c.closePath(); c.fill();
        c.fillStyle = '#25406e'; c.beginPath(); c.moveTo(sx - 14, sy + 10.5); c.lineTo(sx - 10, sy - 0.5); c.lineTo(sx + 15.5, sy - 0.5); c.lineTo(sx + 12.5, sy + 10.5); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(160,190,230,0.6)'; c.lineWidth = 0.7; c.beginPath();
        for (let i = 1; i < 4; i++) { c.moveTo(sx - 14 + i * 6.6 + i * 0.1, sy + 10.5); c.lineTo(sx - 10 + i * 6.4, sy - 0.5); }
        c.moveTo(sx - 12, sy + 5); c.lineTo(sx + 14, sy + 5); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(sx - 9, sy - 0.5); c.lineTo(sx - 4, sy - 0.5); c.lineTo(sx - 10, sy + 10.5); c.lineTo(sx - 13, sy + 10.5); c.fill();
      }
      // cata-vento no topo
      const vx = w * 0.62, vy = type === 'silo' ? -36 : type === 'casa' ? -22 : type === 'galpao' ? -14 : -10;
      c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx, vy - 16); c.moveTo(vx - 6, vy - 8); c.lineTo(vx + 6, vy - 8); c.stroke();
      c.fillStyle = '#3a3a3a'; c.beginPath(); c.moveTo(vx - 7, vy - 15); c.lineTo(vx + 4, vy - 18); c.lineTo(vx + 8, vy - 14); c.lineTo(vx + 2, vy - 13); c.closePath(); c.fill();
      c.fillStyle = '#d4a93a'; circ(c, vx, vy - 16, 1.6);
    }
  }
  // busca de construção por id com mapa reconstruído a cada quadro (G.getBuilding é linear)
  let bMap = null, bMapList = null, bMapLen = -1;
  function getB(id) {
    if (bMapList !== S.buildings || bMapLen !== S.buildings.length) { bMap = new Map(); for (const b of S.buildings) bMap.set(b.id, b); bMapList = S.buildings; bMapLen = S.buildings.length; }
    const b = bMap.get(id);
    return b || null;
  }
  function bVariant(b) {
    switch (b.type) {
      case 'casa': return clamp((b.data && b.data.panels) | 0, 0, 6);
      case 'galpao': return 0;
      case 'galinheiro': return b.data && b.data.eggs > 0 ? 1 : 0;
      case 'composteira': return b.data && b.data.ready ? 2 : b.data && b.data.batches && b.data.batches.length ? 1 : 0;
      case 'cocho': case 'silo': case 'chiqueiro': case 'tanque': {
        const def = D.buildings[b.type] || {}, cap = (G.feedCap && G.feedCap(b)) || (b.type === 'silo' ? 200 : 60);
        return Math.ceil(Math.min(1, ((b.data && b.data.feed) || 0) / cap) * 4);
      }
      case 'cisterna': { const L = (G.lvl && G.lvl(b)) || {}; return Math.round(clamp(((b.data && b.data.water) || 0) / (L.store || 400), 0, 1) * 4); }
      case 'biodigestor': { const L = (G.lvl && G.lvl(b)) || {}; return Math.round(clamp(((b.data && b.data.gas) || 0) / (L.gasCap || 30), 0, 1) * 4); }
      case 'ponte': {
        const t0 = (dx, dy) => { const o = G.tile(b.x + dx, b.y + dy); return o; };
        const isP = (dx, dy) => { const o = t0(dx, dy); if (!o || !o.o || o.o.t !== 'b') return false; const ob = getB(o.o.id); return !!ob && ob.type === 'ponte'; };
        const land = (dx, dy) => { const o = t0(dx, dy); return !!o && o.g !== 'water' && !isP(dx, dy); };
        let hor;
        if (isP(-1, 0) || isP(1, 0)) hor = true; else if (isP(0, -1) || isP(0, 1)) hor = false;
        else hor = land(-1, 0) || land(1, 0) || !(land(0, -1) || land(0, 1));
        const a = hor ? land(-1, 0) : land(0, -1), z = hor ? land(1, 0) : land(0, 1);
        return (hor ? 1 : 0) | (a ? 2 : 0) | (z ? 4 : 0);
      }
      case 'cerca': case 'porteira': {
        const has = (dx, dy) => { const o = G.tile(b.x + dx, b.y + dy); if (!o || !o.o || o.o.t !== 'b') return false; const ob = getB(o.o.id); return ob && (ob.type === 'cerca' || ob.type === 'porteira'); };
        return (b.data && b.data.open ? 16 : 0) | (b.id < 0 ? 3 : (has(1, 0) ? 1 : 0) | (has(-1, 0) ? 2 : 0) | (has(0, 1) ? 4 : 0) | (has(0, -1) ? 8 : 0));
      }
    }
    return 0;
  }
  function buildingSprite(b, night) {
    const def = D.buildings[b.type], w = def.w * TS, h = def.h * TS, snow = S.season === 3;
    const v = bVariant(b), nf = b.type === 'casa' || b.type === 'loja' || b.type === 'galpao' ? (night ? 1 : 0) : 0;
    const lv = clamp(b.level | 0 || 1, 1, 3);
    return sprite(`b|${b.type}|${S.season}|${v}|${nf}|${lv}`, w + 48, h + 110, 24, 86, c => paintBuilding(c, b.type, w, h, b, !!nf, snow, S.season, v, lv));
  }
  function smoke(x, y, n, speed, size, alpha, rise = 34) {
    for (let i = 0; i < n; i++) {
      const k = (t * speed + i / n) % 1;
      ctx.fillStyle = `rgba(225,225,225,${alpha * (1 - k) * Math.min(1, k * 5)})`;
      circ(ctx, x + Math.sin(k * 5 + i) * 4 + k * 6, y - k * rise, size * (0.5 + k));
    }
  }
  function drawBuilding(b, noFx) {
    const def = D.buildings[b.type];
    if (!def) return;
    const px = b.x * TS - cam.x, py = b.y * TS - cam.y, w = def.w * TS, h = def.h * TS;
    const night = G.isNight();
    blit(buildingSprite(b, night), px, py);
    if (!noFx) buildingFx(b, px, py, w, h);
    const lv = b.level | 0;
    if (lv >= 2 && b.type !== 'ponte') { // selo de nível
      const txt = lv >= 3 ? '★★★' : '★★', bw = lv >= 3 ? 34 : 25, bx = px + w - bw - 2, by = py - 6;
      ctx.fillStyle = 'rgba(50,32,16,0.88)'; rrect(ctx, bx, by, bw, 13, 6.5); ctx.fill();
      ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + bw / 2, by + 7); ctx.textBaseline = 'alphabetic';
    }
  }
  function buildingFx(b, px, py, w, h) {
    switch (b.type) {
      case 'roda_dagua': {
        const cx = px + w - 22, cy = py + h - 26, R = 26, a0 = t * 1.1;
        ctx.strokeStyle = '#5e3a20'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R - 7, 0, TAU); ctx.stroke();
        ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = a0 + k * TAU / 8; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } ctx.stroke();
        ctx.fillStyle = '#9a6a3a';
        for (let k = 0; k < 12; k++) { const a = a0 + k * TAU / 12, x = cx + Math.cos(a) * (R - 1), y = cy + Math.sin(a) * (R - 1); ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillRect(-2, -5, 7, 10); ctx.restore(); }
        circ(ctx, cx, cy, 4, '#4a2c16');
        ctx.fillStyle = 'rgba(160,215,255,0.8)';
        for (let i = 0; i < 6; i++) { const k = (t * 1.4 + i / 6) % 1; circ(ctx, px + w + 2 - k * 6, py + 12 + k * 24, 2 - k); circ(ctx, cx + Math.sin(i * 2 + t * 3) * 14, cy + R - 2 + k * 6, 1.6 * (1 - k)); }
        break;
      }
      case 'catavento': {
        const cx = px + w / 2 + 1, cy = py - 62, a0 = t * 2.4;
        ctx.fillStyle = '#d6dade'; ctx.strokeStyle = '#7d8a92'; ctx.lineWidth = 0.6;
        for (let k = 0; k < 14; k++) { const a = a0 + k * TAU / 14; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4); ctx.lineTo(cx + Math.cos(a - 0.12) * 19, cy + Math.sin(a - 0.12) * 19); ctx.lineTo(cx + Math.cos(a + 0.12) * 19, cy + Math.sin(a + 0.12) * 19); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.strokeStyle = '#7d8a92'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.stroke();
        circ(ctx, cx, cy, 3.5, '#c0392b');
        break;
      }
      case 'fogao_biogas': {
        const cx = px + w / 2 - 6, cy = py + 10, big = b.data && b.data.lit ? 1.6 : 1;
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, f = (Math.sin(t * 14 + k) * 0.5 + 0.5) * big; ctx.fillStyle = 'rgba(80,140,255,0.85)'; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 4 - 1.2, cy); ctx.lineTo(cx + Math.cos(a) * 4, cy - 3 - f * 3); ctx.lineTo(cx + Math.cos(a) * 4 + 1.2, cy); ctx.fill(); }
        ctx.fillStyle = 'rgba(200,230,255,0.9)'; ctx.beginPath(); ctx.ellipse(cx, cy - 1, 3, 1.2, 0, 0, TAU); ctx.fill();
        if (b.data && b.data.lit) { ctx.fillStyle = '#3a3a3e'; rrect(ctx, cx - 8, cy - 14, 16, 9, 2); ctx.fill(); ctx.fillStyle = '#5a5a60'; ctx.fillRect(cx - 9, cy - 15, 18, 2); smoke(cx, cy - 16, 3, 0.5, 3, 0.35, 16); }
        break;
      }
      case 'biodigestor': {
        if (((b.data && b.data.gas) || 0) > 0) for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; ctx.fillStyle = `rgba(200,230,180,${0.5 * (1 - k)})`; circ(ctx, px + 14 + Math.sin(i * 3) * 4, py + h - 24 - k * 8, 1.4 + k); }
        break;
      }
      case 'tanque': {
        const cx = px + w / 2, cy = py + h / 2 + 2, rx = w / 2 - 26, ry = h / 2 - 28;
        if (S.season !== 3) for (let i = 0; i < 4; i++) {
          const a = t * (0.35 + i * 0.07) * (i % 2 ? 1 : -1) + i * 1.7, fx = cx + Math.cos(a) * rx * (0.5 + i * 0.13), fy = cy + Math.sin(a * 1.3) * ry * 0.7;
          const dir = (i % 2 ? 1 : -1) * Math.sign(Math.cos(a * 1.0 + 1.57) || 1);
          ctx.fillStyle = 'rgba(10,35,45,0.45)'; ctx.beginPath(); ctx.ellipse(fx, fy, 7, 2.8, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(fx - dir * 6, fy); ctx.lineTo(fx - dir * 11, fy - 3); ctx.lineTo(fx - dir * 11, fy + 3); ctx.fill();
        }
        ctx.fillStyle = 'rgba(230,250,255,0.75)';
        for (let i = 0; i < 6; i++) { const k = (t * 0.8 + i / 6) % 1; circ(ctx, px + w - 22 + Math.sin(i * 2 + k * 8) * 4, py + 26 + k * 16, 1 + k * 1.8); }
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let i = 0; i < 3; i++) { const o = Math.sin(t * 1.4 + i * 2) * 5, yy = py + 36 + i * 26; ctx.moveTo(px + 26 + o + i * 12, yy); ctx.quadraticCurveTo(px + 34 + o + i * 12, yy - 3, px + 42 + o + i * 12, yy); }
        ctx.stroke();
        break;
      }
      case 'aspersor': {
        if (S.time < 360 || S.time > 420) break;
        const cx = px + w / 2, cy = py + h / 2 - 10, a0 = t * 4;
        ctx.fillStyle = 'rgba(225,245,255,0.95)';
        for (let i = 0; i < 24; i++) {
          const k = (t * 1.6 + i / 18) % 1, a = a0 - (i % 6) * 0.12, d = k * TS * 1.25;
          circ(ctx, cx + Math.cos(a + (i % 3) * 2.09) * d, cy + Math.sin(a + (i % 3) * 2.09) * d * 0.55 - Math.sin(k * Math.PI) * 10, 1.6 - k * 0.6);
        }
        ctx.strokeStyle = 'rgba(200,230,255,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy + 10, TS * 1.2, TS * 0.62, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'casa': smoke(px + casaLayout(w, h).chx, py - 46, 4, 0.35, 5, 0.55); break;
      case 'fogueira': {
        const cx = px + w / 2, cy = py + h / 2 + 4;
        const cols = ['#e8471a', '#ff8a1a', '#ffc93a', '#fff3b0'];
        for (let i = 0; i < 4; i++) {
          const f = Math.sin(t * 11 + i * 2.1) * 2.5, hh = 26 - i * 6 + Math.sin(t * 7 + i) * 3, ww = 10 - i * 2.2;
          ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(cx - ww, cy); ctx.quadraticCurveTo(cx - ww * 0.8 + f * 0.5, cy - hh * 0.6, cx + f, cy - hh); ctx.quadraticCurveTo(cx + ww * 0.8 + f * 0.5, cy - hh * 0.6, cx + ww, cy); ctx.closePath(); ctx.fill();
        }
        for (let i = 0; i < 5; i++) { const k = (t * 0.9 + i / 5) % 1; ctx.fillStyle = `rgba(255,${180 - k * 100 | 0},60,${1 - k})`; ctx.fillRect(cx + Math.sin(i * 3 + k * 6) * 8 - 1, cy - 10 - k * 36, 2, 2); }
        break;
      }
      case 'defumador': {
        const cx = px + w / 2;
        ctx.fillStyle = `rgba(255,${120 + Math.sin(t * 8) * 40 | 0},40,0.9)`; ctx.beginPath(); ctx.arc(cx, py + h - 5, 6, Math.PI, 0); ctx.fill();
        smoke(cx, py - 16, 4, 0.6, 5, 0.5, 30); break;
      }
      case 'composteira':
        if (b.data.ready) drawEmo('🟫', px + w / 2, py - 6 + Math.sin(t * 3) * 2, 16);
        else if (b.data.batches && b.data.batches.length) smoke(px + w / 2, py + 6, 3, 0.35, 3.5, 0.35, 18);
        break;
      case 'moinho': {
        const hx = px + w / 2, hy = py + 22;
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(t * 0.8);
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.fillStyle = '#5a3a1f'; ctx.fillRect(-1.5, -42, 3, 40);
          ctx.fillStyle = 'rgba(245,238,220,0.92)'; ctx.fillRect(1.5, -41, 9, 32);
          ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.strokeRect(1.5, -41, 9, 32);
          ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(1.5, -41 + k * 8); ctx.lineTo(10.5, -41 + k * 8); } ctx.moveTo(6, -41); ctx.lineTo(6, -9); ctx.stroke();
        }
        ctx.restore();
        circ(ctx, hx, hy, 4.5, '#4a2c16'); circ(ctx, hx - 1, hy - 1, 1.5, '#8a6a4a');
        break;
      }
      case 'colmeia': {
        const cx = px + w / 2;
        ctx.fillStyle = '#2a2a2a';
        for (let i = 0; i < 4; i++) {
          const a = t * 2.6 + i * 1.7, bx = cx + Math.cos(a) * (14 + i * 2), by = py + 14 + Math.sin(a * 1.4) * 11;
          ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(bx, by, 2.2, 1.6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#222'; ctx.fillRect(bx - 0.4, by - 1.6, 0.9, 3.2);
          ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 40 + i) * 0.3})`; ctx.beginPath(); ctx.ellipse(bx, by - 2, 1.6, 1, 0, 0, TAU); ctx.fill();
        }
        if (b.data.mel) drawEmo('🍯', cx + 14, py - 2 + Math.sin(t * 3) * 1.5, 12);
        break;
      }
    }
  }

  // =============================================================
  // ANIMAIS E JOGADOR
  // =============================================================
  // ----- animais procedurais (corpo inteiro, de perfil, virados à direita) -----
  const AN = {
    galinha: { w: 10, h: 26, bob: 2 }, codorna: { w: 5.5, h: 12, bob: 1.2 }, vaca: { w: 25, h: 44, bob: 1 },
    porco: { w: 17, h: 28, bob: 1.2 }, ovelha: { w: 16, h: 32, bob: 1.2 }, cabra: { w: 15, h: 36, bob: 1.4 },
  };
  function legLine(c, x, y0, sw, len, col, wd, hoof) {
    c.strokeStyle = col; c.lineWidth = wd; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y0); c.lineTo(x + sw, y0 + len); c.stroke();
    if (hoof) { c.fillStyle = hoof; c.fillRect(x + sw - wd / 2, y0 + len - 2, wd, 2.5); }
  }
  function paintAnimal(c, type, baby, pose, wf, vr, fluffy) {
    // pose: 0 andar/parado, 1 cabeça baixa (pastar/bicar)
    const sw = [0, 1, 0, -1][wf] || 0, down = pose === 1;
    switch (type) {
      case 'galinha': {
        if (baby) { // pintinho
          legLine(c, -1.5, -3, sw * 1.2, 3, '#e8932a', 1.2); legLine(c, 1.5, -3, -sw * 1.2, 3, '#e8932a', 1.2);
          ell(c, 0, -6.5, 5.2, 4.6, '#ffd84a'); ell(c, -1.5, -6, 2.8, 2, '#f2c23a');
          const hx = down ? 5 : 3.5, hy = down ? -4.5 : -10.5;
          circ(c, hx, hy, 3.4, '#ffe066');
          c.fillStyle = '#f08a1a'; c.beginPath(); c.moveTo(hx + 2.8, hy - 0.8); c.lineTo(hx + 5.2, hy + 0.2); c.lineTo(hx + 2.8, hy + 1.2); c.fill();
          circ(c, hx + 1.2, hy - 0.8, 0.8, '#2a1a0a');
          break;
        }
        const brown = vr % 2 === 1, body = brown ? '#c07a3a' : '#f7f3ea', dk = brown ? '#8a4f22' : '#d8d0c0', lt = brown ? '#e0a060' : '#ffffff';
        legLine(c, -2, -5, sw * 2, 5, '#e8a02a', 1.6); legLine(c, 2, -5, -sw * 2, 5, '#e8a02a', 1.6);
        c.strokeStyle = '#e8a02a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-2 + sw * 2 - 1.5, 0); c.lineTo(-2 + sw * 2 + 2, 0); c.moveTo(2 - sw * 2 - 1.5, 0); c.lineTo(2 - sw * 2 + 2, 0); c.stroke();
        // cauda
        c.fillStyle = brown ? '#5a3418' : dk; c.beginPath(); c.moveTo(-6, -11); c.quadraticCurveTo(-13, -22, -9, -23); c.quadraticCurveTo(-7, -17, -3, -13); c.fill();
        c.fillStyle = body; c.beginPath(); c.moveTo(-8, -13); c.quadraticCurveTo(-12, -21, -8, -21); c.quadraticCurveTo(-5, -16, -2, -14); c.fill();
        ell(c, -1, -10.5, 8.6, 6.4, body);
        ell(c, -2, -10, 5.2, 3.4, dk); ell(c, -2.5, -11, 4.2, 2.2, lt);
        const hx = down ? 8.5 : 5.5, hy = down ? -6 : -18;
        if (!down) { c.fillStyle = body; c.beginPath(); c.moveTo(2, -14); c.lineTo(hx - 3, hy + 1); c.lineTo(hx + 2, hy + 2); c.lineTo(7, -12); c.fill(); }
        else { c.fillStyle = body; c.beginPath(); c.moveTo(4, -15); c.lineTo(hx - 2, hy - 3); c.lineTo(hx + 1, hy + 2); c.lineTo(6, -9); c.fill(); }
        circ(c, hx, hy, 3.8, body);
        circ(c, hx - 1.5, hy - 3.6, 1.5, '#e0302a'); circ(c, hx + 0.3, hy - 4.1, 1.6, '#e0302a'); circ(c, hx + 2, hy - 3.4, 1.3, '#e0302a');
        ell(c, hx + 2.6, hy + 3, 1.1, 1.8, '#e0302a');
        c.fillStyle = '#f0a020'; c.beginPath(); c.moveTo(hx + 3.2, hy - 1); c.lineTo(hx + 6, hy + 0.2); c.lineTo(hx + 3.2, hy + 1.4); c.fill();
        circ(c, hx + 1.2, hy - 0.8, 0.9, '#1a1008');
        break;
      }
      case 'codorna': {
        const b0 = baby ? '#cfae78' : '#9a7148', b1 = baby ? '#b08f5a' : '#6e4e2e', sc = baby ? 0.55 : 0.75;
        c.save(); c.scale(sc, sc);
        legLine(c, -1.5, -3, sw * 1.4, 3, '#d88a4a', 1.1); legLine(c, 1.5, -3, -sw * 1.4, 3, '#d88a4a', 1.1);
        ell(c, -0.5, -6.5, 7, 5, b0);
        ell(c, -1, -8, 4.6, 2.6, b1);
        const r = rng(19); for (let i = 0; i < 10; i++) circ(c, -5 + r() * 9, -9 + r() * 6, 0.7, i % 2 ? '#f2e0b8' : '#3a2410');
        ell(c, -0.5, -3.5, 5, 1.6, '#e8cf9a');
        const hx = down ? 6.5 : 5, hy = down ? -3.5 : -10;
        circ(c, hx, hy, 3, b0);
        if (!baby) { c.strokeStyle = '#3a2410'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(hx + 2.5, hy + 0.5); c.quadraticCurveTo(hx, hy + 2.5, hx - 2.5, hy + 0.5); c.stroke();
          c.strokeStyle = '#2a1a0a'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, hy - 2.8); c.quadraticCurveTo(hx + 1, hy - 5.5, hx + 2.5, hy - 5); c.stroke(); }
        c.fillStyle = '#4a3a2a'; c.beginPath(); c.moveTo(hx + 2.5, hy - 0.8); c.lineTo(hx + 4.3, hy); c.lineTo(hx + 2.5, hy + 0.8); c.fill();
        circ(c, hx + 1, hy - 0.7, 0.75, '#1a1008');
        c.restore();
        break;
      }
      case 'vaca': {
        c.save(); if (baby) c.scale(0.64, 0.64);
        const W0 = '#f6f3ec', BK = '#2a2624', PK = '#f2b0a8';
        legLine(c, -13, -16, -sw * 3, 16, '#d8d2c6', 4.5, BK); legLine(c, 12, -16, sw * 3, 16, '#d8d2c6', 4.5, BK);
        // cauda
        c.strokeStyle = W0; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-21, -29); c.quadraticCurveTo(-25, -22, -24, -13); c.stroke(); ell(c, -24, -12, 1.8, 3, BK);
        rrect(c, -22, -33, 41, 19, 9); c.fillStyle = W0; c.fill();
        c.save(); rrect(c, -22, -33, 41, 19, 9); c.clip();
        const r = rng(vr * 17 + 3); c.fillStyle = BK;
        for (let i = 0; i < 4; i++) { const bx = -18 + r() * 34, by = -32 + r() * 14; c.beginPath(); c.ellipse(bx, by, 4 + r() * 6, 3 + r() * 4, r() * 3, 0, TAU); c.fill(); }
        c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(-22, -19, 41, 5);
        c.restore();
        if (!baby) { ell(c, -6, -13.5, 5, 3, PK); c.fillStyle = PK; for (const ux of [-8.5, -6, -3.5]) c.fillRect(ux - 0.7, -12, 1.4, 2.5); }
        legLine(c, -17, -16, sw * 3, 16, W0, 4.8, BK); legLine(c, 8, -16, -sw * 3, 16, W0, 4.8, BK);
        // cabeça
        const hx = down ? 23 : 22, hy = down ? -12 : -30;
        c.fillStyle = W0; c.beginPath(); c.moveTo(14, -32); c.lineTo(hx - 3, hy - 4); c.lineTo(hx + 1, hy + 6); c.lineTo(17, -18); c.fill();
        c.save(); c.translate(hx, hy); c.rotate(down ? 0.9 : 0.25);
        rrect(c, -5, -6, 13, 11, 4.5); c.fillStyle = W0; c.fill();
        c.fillStyle = BK; c.beginPath(); c.ellipse(-1, -3, 3.8, 3, 0.3, 0, TAU); c.fill();
        ell(c, 8, 1.5, 4, 3.6, PK); circ(c, 9.5, 0.8, 0.7, '#8a4a44'); circ(c, 9.5, 2.6, 0.7, '#8a4a44');
        ell(c, -4, -6, 3.5, 1.6, BK);
        if (!baby) { c.strokeStyle = '#efe2c0'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-1, -6); c.quadraticCurveTo(0, -10, 2.5, -10); c.stroke(); }
        circ(c, 3, -2, 1, '#1a1008');
        c.restore();
        c.restore();
        break;
      }
      case 'porco': {
        c.save(); if (baby) c.scale(0.62, 0.62);
        const P = '#f4a9b4', PD = '#d9808e', PL = '#ffd0d6';
        legLine(c, -9, -7, -sw * 1.6, 7, PD, 4, '#8a4a50'); legLine(c, 9, -7, sw * 1.6, 7, PD, 4, '#8a4a50');
        c.strokeStyle = PD; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-17, -14); c.arc(-19.5, -15, 2.4, 0, Math.PI * 1.6); c.stroke();
        ell(c, -1, -13, 17, 10, P);
        ell(c, -2, -8.5, 13, 4, PD); ell(c, -4, -18, 9, 3.5, PL);
        legLine(c, -12, -7, sw * 1.6, 7, P, 4.4, '#8a4a50'); legLine(c, 6, -7, -sw * 1.6, 7, P, 4.4, '#8a4a50');
        const hx = 15, hy = down ? -8 : -14;
        circ(c, hx, hy, 7.5, P);
        ell(c, hx + 6.5, hy + 1.5, 2.6, 3.6, PD); circ(c, hx + 7.2, hy + 0.5, 0.7, '#8a4a50'); circ(c, hx + 7.2, hy + 2.6, 0.7, '#8a4a50');
        c.fillStyle = PD; c.beginPath(); c.moveTo(hx - 3, hy - 6); c.lineTo(hx + 3, hy - 10); c.lineTo(hx + 3, hy - 4); c.fill();
        circ(c, hx + 2.5, hy - 1.5, 1, '#1a1008');
        ell(c, hx + 2, hy + 3, 1.6, 1, 'rgba(240,110,120,0.5)');
        c.restore();
        break;
      }
      case 'ovelha': {
        c.save(); if (baby) c.scale(0.62, 0.62);
        const D0 = '#3a3330', Wl = '#f3efe6', Wd = '#d8d0c2', f = fluffy && !baby ? 1.18 : 1;
        legLine(c, -9, -9, -sw * 2, 9, '#2a2422', 3, '#141010'); legLine(c, 8, -9, sw * 2, 9, '#2a2422', 3, '#141010');
        const r = rng(vr + 5);
        const puffs = []; for (let i = 0; i < (f > 1 ? 15 : 11); i++) { const a = r() * TAU; puffs.push([-2 + Math.cos(a) * 11 * f, -17 + Math.sin(a) * 6.5 * f, (5 + r() * 2.5) * f]); }
        c.fillStyle = Wd; c.beginPath(); for (const p of puffs) { c.moveTo(p[0] + p[2] + 1, p[1] + 1.5); c.arc(p[0] + 0.5, p[1] + 1.5, p[2] + 1, 0, TAU); } c.fill();
        ell(c, -2, -17, 13 * f, 8.5 * f, Wl);
        c.fillStyle = Wl; c.beginPath(); for (const p of puffs) { c.moveTo(p[0] + p[2], p[1]); c.arc(p[0], p[1], p[2], 0, TAU); } c.fill();
        c.fillStyle = '#ffffff'; for (const p of puffs) if (p[1] < -18) circ(c, p[0] - 1.5, p[1] - 1.5, p[2] * 0.4);
        legLine(c, -12, -9, sw * 2, 9, D0, 3.2, '#141010'); legLine(c, 5, -9, -sw * 2, 9, D0, 3.2, '#141010');
        const hx = 14 + (f - 1) * 6, hy = down ? -7 : -21;
        c.save(); c.translate(hx, hy); c.rotate(down ? 0.8 : 0.35);
        ell(c, 1.5, 0, 6.5, 4.6, D0);
        ell(c, -2.5, -3.5, 3.6, 1.4, D0); ell(c, -3, -3.3, 2.4, 0.8, '#6a5a52');
        circ(c, -2.5, -4.2, 3.2, Wl); circ(c, 0, -4.8, 2.6, Wl);
        circ(c, 3, -1, 1.1, '#ffffff'); circ(c, 3.3, -1, 0.6, '#1a1008');
        c.restore();
        c.restore();
        break;
      }
      case 'cabra': {
        c.save(); if (baby) c.scale(0.62, 0.62);
        const white = vr % 2 === 1, B0 = white ? '#efe9dc' : '#a8703f', B1 = white ? '#c9bfae' : '#7a4f2a', B2 = white ? '#ffffff' : '#f2e6d2';
        legLine(c, -9, -12, -sw * 2.4, 12, B1, 3, '#2a2018'); legLine(c, 8, -12, sw * 2.4, 12, B1, 3, '#2a2018');
        c.fillStyle = B1; c.beginPath(); c.moveTo(-13, -21); c.lineTo(-17, -27); c.lineTo(-12, -24); c.fill();
        ell(c, -1, -18, 14, 7.5, B0);
        ell(c, -1, -13.5, 10, 3, B2); if (!white) ell(c, -6, -21, 5, 2.2, 'rgba(255,255,255,0.18)');
        legLine(c, -12, -12, sw * 2.4, 12, B0, 3.3, '#2a2018'); legLine(c, 5, -12, -sw * 2.4, 12, B0, 3.3, '#2a2018');
        const hx = down ? 17 : 15, hy = down ? -8 : -29;
        c.fillStyle = B0; c.beginPath(); c.moveTo(8, -24); c.lineTo(hx - 3, hy - 2); c.lineTo(hx + 1, hy + 4); c.lineTo(12, -16); c.fill();
        c.save(); c.translate(hx, hy); c.rotate(down ? 0.9 : 0.45);
        ell(c, 2, 0, 7.2, 3.8, B0); ell(c, 7.5, 0.8, 2.2, 2.4, B1);
        ell(c, -2.5, 1.2, 4, 1.5, B1);
        if (!baby) {
          c.strokeStyle = '#8f8678'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(-3, -8, -6.5, -6); c.stroke();
          c.fillStyle = B1; c.beginPath(); c.moveTo(5, 3); c.lineTo(6.5, 8); c.lineTo(3.5, 3.5); c.fill();
        }
        circ(c, 2.5, -1, 0.95, '#1a1008');
        c.restore();
        c.restore();
        break;
      }
    }
  }
  function animalSprite(type, baby, pose, wf, vr, fluffy, flip) {
    return sprite(`an|${type}|${baby ? 1 : 0}|${pose}|${wf}|${vr}|${fluffy ? 1 : 0}|${flip ? 1 : 0}`, 84, 70, 42, 62, c => {
      if (flip) c.scale(-1, 1);
      paintAnimal(c, type, baby, pose, wf, vr, fluffy);
    });
  }
  function drawAnimal(a) {
    const def = D.animals[a.type];
    if (!def) return;
    const adult = a.age >= def.adult;
    const px = a.x * TS - cam.x, py = a.y * TS - cam.y;
    const spec = AN[a.type];
    let size, topY;
    if (spec) {
      const k = adult ? 1 : 0.64, id = a.id | 0;
      let pose = 0, wf = 0, bob = 0;
      if (a.moving) { const ph = t * (a.type === 'galinha' || a.type === 'codorna' ? 12 : 8) + id; wf = Math.floor(ph) & 3; bob = Math.abs(Math.sin(ph * Math.PI / 2)) * spec.bob; }
      else if (a.type === 'galinha' || a.type === 'codorna') { const ph = (t * 0.5 + id * 0.37) % 1; if (ph < 0.3) pose = Math.floor(t * 7 + id) % 2; }
      else if (a.type === 'vaca' || a.type === 'ovelha' || a.type === 'cabra' || a.type === 'porco') { const ph = (t * 0.12 + id * 0.29) % 1; if (ph < 0.4) pose = 1; else bob = -Math.max(0, Math.sin(t * 2 + id)) * 0.6; }
      ell(ctx, px, py + 1, spec.w * k * (a.moving ? 0.92 : 1), Math.max(2.5, spec.w * k * 0.3), 'rgba(15,30,5,0.28)');
      const s = animalSprite(a.type, !adult, pose, wf, id % 3, a.type === 'ovelha' && a.ready, a.face < 0);
      blit(s, px, py - bob);
      size = spec.h * k; topY = py - size;
    } else {
      size = adult ? 34 : 24;
      const hop = a.moving ? Math.abs(Math.sin(t * 9 + a.id)) : 0;
      ell(ctx, px, py + 2, size * 0.42 * (1 - hop * 0.18), size * 0.14, 'rgba(15,30,5,0.28)');
      drawEmo(adult ? def.i : (def.bi || def.i), px, py - size * 0.42 - hop * 3, size, a.face > 0);
      topY = py - size;
    }
    if (a.ready && def.produce && D.items[def.produce.item]) {
      const by = topY - 14 + Math.sin(t * 4) * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(px, by, 11, 0, TAU); ctx.moveTo(px - 4, by + 9); ctx.lineTo(px, by + 15); ctx.lineTo(px + 4, by + 9); ctx.fill();
      ctx.strokeStyle = 'rgba(80,60,40,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, by, 11, 0, TAU); ctx.stroke();
      drawEmo(D.items[def.produce.item].i, px, by, 14);
    } else if (a.hungry) drawEmo('❗', px, topY - 8, 12);
  }



  // =============================================================
  // VIDA SELVAGEM (só visual): borboletas, libélulas, sapos, joaninhas
  // =============================================================
  const wild = { bf: [], df: [], fr: [], lb: [], scanT: 0, flowers: [], water: [], shore: [], pads: [], soil: [] };
  const BFC = [['#ffd23a', '#e8a020'], ['#ffffff', '#d8d8e8'], ['#ff8a3a', '#2a1a10'], ['#7ab8ff', '#3a5ad8'], ['#ff9bd0', '#d84a9a'], ['#c7a6ff', '#7a4ad8']];
  function wildScan(x0, y0, x1, y1) {
    const W2 = wild; W2.flowers = []; W2.water = []; W2.shore = []; W2.pads = []; W2.soil = [];
    const season = S.season;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const tl = S.tiles[y * G.W + x];
      if (tl.g === 'water') {
        if (tl.o) continue;
        W2.water.push([x, y]);
        let inner = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = G.tile(x + dx, y + dy);
          if (n && n.g !== 'water' && !n.o) { W2.shore.push([x + 0.5 + dx * 0.42, y + 0.5 + dy * 0.42]); inner = false; }
        }
        if (inner && season !== 3 && hash(x * 3 + 1, y * 5 + 2) < 0.13) {
          let all = true; for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) { const n = G.tile(x + dx, y + dy); if (!n || n.g !== 'water') { all = false; break; } }
          if (all) { const r = rng(x * 31 + y * 17); W2.pads.push([x + (12 + r() * 20) / TS, y + (12 + r() * 20) / TS]); }
        }
      } else if (tl.c && !tl.c.dead) { W2.flowers.push([x, y]); if (tl.g === 'tilled') W2.soil.push([x, y]); }
      else if (tl.o && (tl.o.t === 'fruit' || tl.o.t === 'weed')) W2.flowers.push([x, y]);
      else if (tl.g === 'grass' && !tl.o && season < 2 && hash(x, y) < (season === 0 ? 0.17 : 0.1)) W2.flowers.push([x, y]);
      else if (tl.g === 'tilled') W2.soil.push([x, y]);
    }
  }
  const pick = a => a[(Math.random() * a.length) | 0];
  function nearPick(list, x, y, r) {
    for (let i = 0; i < 6; i++) { const c = pick(list); if (Math.abs((c[0] + 0.5) * TS - x) < r && Math.abs((c[1] + 0.5) * TS - y) < r) return c; }
    return pick(list);
  }
  function inView(x, y, m) { return x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m; }
  function updateWild(dt, x0, y0, x1, y1) {
    const m = S.time, day = m >= 420 && m < 1100, rain = S.weather === 'chuva', season = S.season;
    wild.scanT -= dt;
    if (wild.scanT <= 0) { wild.scanT = 0.6; wildScan(x0, y0, x1, y1); }
    // borboletas
    const nB = !day || rain || !wild.flowers.length ? 0 : [14, 12, 8, 2][season];
    while (wild.bf.length > nB) wild.bf.pop();
    while (wild.bf.length < nB) {
      const c = pick(wild.flowers), side = Math.random() * TAU;
      wild.bf.push({ x: (c[0] + 0.5) * TS + Math.cos(side) * 160, y: (c[1] + 0.5) * TS + Math.sin(side) * 120, alt: 18, tx: c, rest: 0, ph: Math.random() * 9, col: BFC[(Math.random() * BFC.length) | 0], s: 0.8 + Math.random() * 0.4 });
    }
    for (const b of wild.bf) {
      if (!inView(b.x, b.y, 220)) { const c = pick(wild.flowers); b.x = (c[0] + 0.5) * TS + (Math.random() - 0.5) * 200; b.y = (c[1] + 0.5) * TS + (Math.random() - 0.5) * 160; b.tx = c; }
      const tx = (b.tx[0] + 0.5) * TS + Math.sin(b.ph) * 8, ty = (b.tx[1] + 0.4) * TS;
      if (b.rest > 0) { b.rest -= dt; b.alt += (6 - b.alt) * dt * 4; if (b.rest <= 0) b.tx = nearPick(wild.flowers, b.x, b.y, 260); continue; }
      const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1, sp = 46 * b.s;
      b.x += (dx / d * sp + Math.sin(t * 3.1 + b.ph) * 30) * dt; b.y += (dy / d * sp + Math.cos(t * 2.3 + b.ph) * 22) * dt;
      b.alt += (16 + Math.sin(t * 2 + b.ph) * 6 - b.alt) * dt * 2;
      if (d < 8) b.rest = 1 + Math.random() * 3;
    }
    // libélulas
    const nD = !day || rain || season === 3 ? 0 : Math.min(6, Math.floor(wild.water.length / 5));
    while (wild.df.length > nD) wild.df.pop();
    while (wild.df.length < nD) { const c = pick(wild.water); wild.df.push({ x: (c[0] + 0.5) * TS, y: (c[1] + 0.5) * TS, hx: 0, hy: 0, wait: Math.random(), col: Math.random() < 0.6 ? '#3a8ad8' : '#d83a3a', ang: 0 }); }
    for (const f of wild.df) {
      if (!inView(f.x, f.y, 200)) { const c = pick(wild.water); f.x = (c[0] + 0.5) * TS; f.y = (c[1] + 0.5) * TS; f.hx = 0; }
      if (f.wait > 0) { f.wait -= dt; if (f.wait <= 0) { const c = nearPick(wild.water, f.x, f.y, 110); f.hx = (c[0] + 0.2 + Math.random() * 0.6) * TS; f.hy = (c[1] + 0.2 + Math.random() * 0.6) * TS; } }
      else { const dx = f.hx - f.x, dy = f.hy - f.y, d = Math.hypot(dx, dy); f.ang = Math.atan2(dy, dx); if (d < 4) f.wait = 0.4 + Math.random() * 1.6; else { const sp = Math.min(d, 260 * dt); f.x += dx / d * sp; f.y += dy / d * sp; } }
    }
    // sapos
    const frogSpots = wild.shore.concat(wild.pads);
    const nF = season === 3 || !frogSpots.length ? 0 : Math.min(6, Math.ceil(frogSpots.length / 8));
    while (wild.fr.length > nF) wild.fr.pop();
    while (wild.fr.length < nF) { const c = pick(frogSpots); wild.fr.push({ x: c[0] * TS, y: c[1] * TS, fx: 0, fy: 0, hop: 0, sit: 2 + Math.random() * 6, flip: Math.random() < 0.5, col: Math.random() < 0.7 ? 0 : 1, splash: 0, sx: 0, sy: 0 }); }
    for (const f of wild.fr) {
      if (!inView(f.x, f.y, 160)) { const c = pick(frogSpots); f.x = c[0] * TS; f.y = c[1] * TS; f.hop = 0; }
      if (f.splash > 0) f.splash -= dt;
      if (f.hop > 0) {
        f.hop -= dt / 0.45;
        if (f.hop <= 0) { f.x = f.fx; f.y = f.fy; f.splash = 0.7; f.sx = f.x; f.sy = f.y; f.sit = 3 + Math.random() * 7; }
      } else {
        f.sit -= dt;
        if (f.sit <= 0) {
          const c = nearPick(frogSpots, f.x, f.y, 100); f.ox = f.x; f.oy = f.y; f.fx = c[0] * TS; f.fy = c[1] * TS; f.hop = 1; f.flip = f.fx < f.x;
          const p = S.player;
          if (Math.random() < 0.25 && Math.hypot(f.x / TS - p.x, f.y / TS - p.y) < 5) { try { window.SFX && SFX.play('pick', { volume: 0.15 }); } catch (e) { /* */ } }
        }
      }
    }
    // joaninhas
    const nL = !day || rain || season === 3 || !wild.soil.length ? 0 : Math.min(5, Math.ceil(wild.soil.length / 10));
    while (wild.lb.length > nL) wild.lb.pop();
    while (wild.lb.length < nL) { const c = pick(wild.soil); wild.lb.push({ x: (c[0] + 0.2 + Math.random() * 0.6) * TS, y: (c[1] + 0.2 + Math.random() * 0.6) * TS, a: Math.random() * TAU, tile: c, kind: Math.random() < 0.7 ? 0 : 1 }); }
    for (const l of wild.lb) {
      if (!inView(l.x, l.y, 100)) { const c = pick(wild.soil); l.tile = c; l.x = (c[0] + 0.5) * TS; l.y = (c[1] + 0.5) * TS; }
      l.a += (Math.random() - 0.5) * 4 * dt; l.x += Math.cos(l.a) * 7 * dt; l.y += Math.sin(l.a) * 7 * dt;
      const cx = (l.tile[0] + 0.5) * TS, cy = (l.tile[1] + 0.5) * TS;
      if (Math.abs(l.x - cx) > 18 || Math.abs(l.y - cy) > 18) l.a = Math.atan2(cy - l.y, cx - l.x);
    }
  }
  function frogSprite(pose, flip, col) {
    return sprite(`frog|${pose}|${flip ? 1 : 0}|${col}`, 30, 24, 15, 16, c => {
      if (flip) c.scale(-1, 1);
      const G0 = col ? '#8a9a3a' : '#4f9a3a', G1 = col ? '#b8c45a' : '#7cc456', BL = '#e8e6b0';
      if (pose === 0) {
        ell(c, -4, 0, 4, 2.6, G0); ell(c, 4, 0, 4, 2.6, G0);
        ell(c, 0, -3, 6.5, 4.6, G0); ell(c, 0.5, -1.6, 4.5, 2.6, BL); ell(c, -1, -4.5, 4, 2, G1);
        circ(c, 3, -7, 2.1, G0); circ(c, -1, -7.2, 2.1, G0); circ(c, 3.4, -7.4, 1, '#1a1a10'); circ(c, -0.6, -7.6, 1, '#1a1a10');
        c.fillStyle = '#2a4a1a'; c.fillRect(-5, -2, 2, 1); c.fillRect(4, -4, 1.5, 1);
      } else {
        c.strokeStyle = G0; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-3, -2); c.lineTo(-10, 2); c.moveTo(-3, -1); c.lineTo(-9, 4); c.stroke();
        ell(c, 0, -3, 6.5, 3.6, G0); ell(c, 0.5, -2, 4.5, 2, BL); ell(c, -1, -4.5, 4, 1.6, G1);
        c.strokeStyle = G0; c.lineWidth = 1.6; c.beginPath(); c.moveTo(4, -1); c.lineTo(7, 2); c.stroke();
        circ(c, 4, -6, 2, G0); circ(c, 4.4, -6.4, 0.9, '#1a1a10');
      }
    });
  }
  function drawWildGround() {
    for (const l of wild.lb) {
      const x = l.x - cam.x, y = l.y - cam.y;
      if (l.kind === 0) { circ(ctx, x, y, 2.1, '#d8262a'); ctx.fillStyle = '#111'; ctx.fillRect(x - 0.3, y - 2, 0.6, 4); circ(ctx, x + Math.cos(l.a) * 2, y + Math.sin(l.a) * 2, 1, '#111'); circ(ctx, x - 0.9, y + 0.6, 0.45, '#111'); circ(ctx, x + 0.9, y - 0.6, 0.45, '#111'); }
      else { ell(ctx, x, y, 2.2, 1.6, '#2a3a5a'); circ(ctx, x + Math.cos(l.a) * 2, y + Math.sin(l.a) * 2, 0.9, '#111'); ctx.fillStyle = 'rgba(160,200,255,0.5)'; ctx.fillRect(x - 1, y - 1, 1, 1); }
    }
    for (const f of wild.fr) {
      if (f.splash > 0) { const k = 1 - f.splash / 0.7; ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(f.sx - cam.x, f.sy - cam.y + 1, 3 + k * 10, (3 + k * 10) * 0.4, 0, 0, TAU); ctx.stroke(); }
      let x = f.x, y = f.y, z = 0, pose = 0;
      if (f.hop > 0) { const k = 1 - f.hop; x = f.ox + (f.fx - f.ox) * k; y = f.oy + (f.fy - f.oy) * k; z = Math.sin(k * Math.PI) * 12; pose = 1; }
      ell(ctx, x - cam.x, y - cam.y + 1, 5, 1.8, 'rgba(10,30,20,0.3)');
      blit(frogSprite(pose, f.flip, f.col), x - cam.x, y - cam.y - z);
      if (!pose && Math.sin(t * 3 + f.x) > 0.8) ell(ctx, x - cam.x + (f.flip ? -3 : 3), y - cam.y - 2.5, 2.2, 1.6, 'rgba(240,240,200,0.9)');
    }
  }
  function drawWildAir() {
    for (const f of wild.df) {
      const x = f.x - cam.x, y = f.y - cam.y, hz = f.wait > 0 ? Math.sin(t * 9 + f.x) * 1.2 : 0, a = f.ang;
      ell(ctx, x, y + 10, 5, 1.2, 'rgba(0,30,60,0.2)');
      ctx.save(); ctx.translate(x, y - 2 + hz); ctx.rotate(a);
      ctx.fillStyle = `rgba(230,245,255,${0.45 + Math.sin(t * 60) * 0.2})`;
      for (const [ox, sg] of [[1.5, 1], [1.5, -1], [-1, 1], [-1, -1]]) { ctx.beginPath(); ctx.ellipse(ox, sg * 4.2, 1.4, 4.2, sg * 0.25, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = f.col; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(3, 0); ctx.stroke();
      circ(ctx, 4, 0, 1.8, shade(f.col, -0.3)); ctx.lineCap = 'butt';
      ctx.restore();
    }
    for (const b of wild.bf) {
      const x = b.x - cam.x, y = b.y - cam.y, by = y - b.alt;
      ell(ctx, x, y + 2, 3, 1, 'rgba(10,30,5,0.15)');
      const fl = b.rest > 0 ? 0.45 + Math.sin(t * 3 + b.ph) * 0.3 : Math.abs(Math.sin(t * 20 + b.ph)), ws = (0.2 + fl * 0.8) * b.s;
      ctx.fillStyle = b.col[0];
      ctx.beginPath(); ctx.ellipse(x - 3 * ws, by - 1, 3.2 * ws, 2.6 * b.s, -0.3, 0, TAU); ctx.ellipse(x + 3 * ws, by - 1, 3.2 * ws, 2.6 * b.s, 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = b.col[1];
      ctx.beginPath(); ctx.ellipse(x - 2.2 * ws, by + 2, 2.2 * ws, 1.8 * b.s, 0.3, 0, TAU); ctx.ellipse(x + 2.2 * ws, by + 2, 2.2 * ws, 1.8 * b.s, -0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, by - 3); ctx.lineTo(x, by + 3); ctx.stroke();
    }
  }

  // ---------- pesca ----------
  let fishPh = null, fishT0 = 0;
  function fishState() {
    const f = G.fish;
    if (!f || !f.phase) { fishPh = null; return null; }
    if (f.phase !== fishPh) { fishPh = f.phase; fishT0 = t; }
    return { f, el: t - fishT0, bx: (f.tx + 0.5) * TS - cam.x, by: (f.ty + 0.5) * TS - cam.y };
  }
  function bobberPos(st) {
    const p = S.player, hx = p.x * TS - cam.x, hy = p.y * TS - cam.y - 30;
    if (st.f.phase === 'cast') { const k = clamp(st.el / 0.5, 0, 1); return { x: hx + (st.bx - hx) * k, y: hy + (st.by - hy) * k - Math.sin(k * Math.PI) * 40, air: k < 1 }; }
    const dip = st.f.phase === 'bite' ? 3 + Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 2.5) * 1;
    return { x: st.bx, y: st.by + dip, air: false };
  }
  function drawFishingWater() {
    const st = fishState(); if (!st) return;
    const b = bobberPos(st);
    if (!b.air) {
      const sp = st.f.phase === 'bite' ? 2.2 : 0.7;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 2; i++) { const k = (t * sp + i / 2) % 1, r = 3 + k * 12; ctx.moveTo(st.bx + r, st.by + 2); ctx.ellipse(st.bx, st.by + 2, r, r * 0.4, 0, 0, TAU); }
      ctx.stroke();
    }
    if (st.f.phase !== 'catch') {
      const sub = b.air ? 0 : st.f.phase === 'bite' ? 0.6 : 0.3;
      ctx.save(); ctx.beginPath(); ctx.rect(b.x - 6, b.y - 8, 12, 8 + (b.air ? 6 : 4 * (1 - sub))); ctx.clip();
      circ(ctx, b.x, b.y, 3.6, '#f6f2ea'); ctx.fillStyle = '#e0302a'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.6, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(b.x - 0.5, b.y - 7, 1, 4);
      ctx.restore();
    }
  }
  function drawFishShape(x, y, len, col, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, len / 2, len / 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-len / 2 + 2, 0); ctx.lineTo(-len / 2 - len / 4, -len / 5); ctx.lineTo(-len / 2 - len / 4, len / 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(len * 0.05, -len / 12, len / 3, len / 14, 0, 0, TAU); ctx.fill();
    circ(ctx, len / 2 - len / 7, -len / 16, Math.max(0.8, len / 22), '#111');
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, len / 2, len / 5, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  const FISHC = { lambari: '#c9ccc0', tilapia_l: '#8a9a8a', traira: '#5a5a3a', pacu: '#7a8a9a', bagre: '#6a5a4a', tambaqui: '#3f4a3a', pirarucu: '#b0402a' };
  function drawFishingRod(px, py) {
    const st = fishState(); if (!st) return;
    const fx = st.bx >= px ? 1 : -1, hx = px + fx * 11, hy = py - 24;
    const tipx = hx + fx * 26, tipy = hy - 22 + (st.f.phase === 'bite' ? Math.sin(t * 20) * 3 : 0);
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tipx, tipy); ctx.stroke();
    ctx.strokeStyle = '#c99a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + fx * 8, hy - 7); ctx.stroke();
    circ(ctx, hx + fx * 3, hy - 2.5, 2, '#5a646a');
    circ(ctx, hx, hy, 2.6, '#f2c59b');
    if (st.f.phase !== 'catch') {
      const b = bobberPos(st);
      ctx.strokeStyle = 'rgba(240,240,240,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(tipx, tipy);
      ctx.quadraticCurveTo((tipx + b.x) / 2, Math.max(tipy, b.y) + (st.f.phase === 'bite' ? 0 : 10), b.x, b.y - 6); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (st.f.phase === 'bite') drawEmo('❗', px, py - 72 + Math.sin(t * 18) * 2, 22);
    if (st.f.phase === 'catch') {
      const k = clamp(st.el / 0.8, 0, 1), id = st.f.fish, fd = (D.fish && D.fish[id]) || {};
      const len = fd.rare ? 34 : fd.big ? 26 : 12 + Math.max(0, 30 - (fd.w || 20)) * 0.35;
      const x = st.bx + (px - st.bx) * k, y = st.by + (py - 50 - st.by) * k - Math.sin(k * Math.PI) * 50;
      if (k < 1) { ctx.fillStyle = 'rgba(200,230,255,0.8)'; for (let i = 0; i < 5; i++) circ(ctx, st.bx + Math.cos(i * 1.3) * 8 * k * 3, st.by - Math.sin(i * 1.1) * 10 * k * 2, 1.6); }
      drawFishShape(x, y, len, FISHC[id] || '#8aa0b0', (fx > 0 ? Math.PI : 0) + Math.sin(t * 25) * 0.25 * (1 - k));
      ctx.strokeStyle = 'rgba(240,240,240,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.lineTo(x, y); ctx.stroke();
    }
  }

  const PW = 64, PH = 74;
  let pcv = null, pcx = null;
  function drawPlayer() {
    const p = S.player;
    const px = p.x * TS - cam.x, py = p.y * TS - cam.y;
    const mv = !!p.moving, ph = t * 11;
    const st = mv ? Math.sin(ph) : 0;
    const bob = mv ? Math.abs(Math.cos(ph)) * 1.6 : Math.sin(t * 2.4) * 0.4;
    const dir = p.dir, side = dir === 'left' || dir === 'right', fx = dir === 'left' ? -1 : 1;
    const swinging = G.swing > 0;
    ell(ctx, px, py + 1, 11 - bob * 0.5, 4.2, 'rgba(15,30,5,0.3)');
    const SK = '#f2c59b', SKD = '#dca77c', SH = '#d8483e', SHD = '#a9302b', OV = '#3f6ea8', OVD = '#2f5585', BT = '#5a3a22', HR = '#6b3f22';
    // o corpo é desenhado num canvas próprio para receber o contorno escuro
    if (!pcv) { pcv = document.createElement('canvas'); pcv.width = Math.ceil(PW * dpr); pcv.height = Math.ceil(PH * dpr); pcx = pcv.getContext('2d', { willReadFrequently: true }); pcv.d = dpr; }
    if (pcv.d !== dpr) { pcv.width = Math.ceil(PW * dpr); pcv.height = Math.ceil(PH * dpr); pcv.d = dpr; }
    const main = ctx; ctx = pcx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, PW, PH);
    ctx.save(); ctx.translate(PW / 2, PH - 8); if (side && fx < 0) ctx.scale(-1, 1);
    if (!side) {
      const l1 = Math.max(0, st) * 3, l2 = Math.max(0, -st) * 3;
      ctx.fillStyle = OVD; ctx.fillRect(-6, -13 - l1, 5, 11); ctx.fillRect(1, -13 - l2, 5, 11);
      ctx.fillStyle = BT; rrect(ctx, -7, -4 - l1, 7, 5, 2); ctx.fill(); rrect(ctx, 0, -4 - l2, 7, 5, 2); ctx.fill();
      ctx.translate(0, -bob);
      const a = swinging ? -4 : st * 2.4;
      // braços
      ctx.fillStyle = SHD; rrect(ctx, -14, -31 + a, 5, 11, 2.5); ctx.fill(); rrect(ctx, 9, -31 - a, 5, 11, 2.5); ctx.fill();
      circ(ctx, -11.5, -19 + a, 2.6, SK); circ(ctx, 11.5, -19 - a, 2.6, SK);
      // tronco
      ctx.fillStyle = SH; rrect(ctx, -10, -32, 20, 21, 5); ctx.fill();
      ctx.fillStyle = 'rgba(120,20,20,0.35)'; ctx.fillRect(-10, -27, 20, 1.5); ctx.fillRect(-4, -32, 1.5, 10); ctx.fillRect(3, -32, 1.5, 10);
      ctx.fillStyle = OV; rrect(ctx, -9, -22, 18, 11, 3); ctx.fill();
      if (dir === 'down') {
        ctx.fillRect(-6, -29, 12, 8); ctx.fillRect(-8, -32, 3, 5); ctx.fillRect(5, -32, 3, 5);
        circ(ctx, -5, -27.5, 1.2, '#f2d36a'); circ(ctx, 5, -27.5, 1.2, '#f2d36a');
        ctx.fillStyle = OVD; ctx.fillRect(-3.5, -26, 7, 4); ctx.fillRect(-0.5, -21, 1, 9);
      } else {
        ctx.strokeStyle = OV; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -32); ctx.lineTo(5, -22); ctx.moveTo(6, -32); ctx.lineTo(-5, -22); ctx.stroke();
        ctx.fillStyle = OVD; ctx.fillRect(-6, -18, 4, 4); ctx.fillRect(2, -18, 4, 4);
      }
      // cabeça
      circ(ctx, 0, -40, 9.5, HR);
      if (dir === 'down') {
        circ(ctx, 0, -39.5, 8.6, SK);
        ctx.fillStyle = HR; ctx.fillRect(-9.5, -45, 3.5, 7); ctx.fillRect(6, -45, 3.5, 7);
        ctx.fillStyle = '#2b2118'; rrect(ctx, -4.6, -41.5, 2.4, 3.4, 1.2); ctx.fill(); rrect(ctx, 2.2, -41.5, 2.4, 3.4, 1.2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-4, -41.2, 0.9, 0.9); ctx.fillRect(2.8, -41.2, 0.9, 0.9);
        circ(ctx, -5.8, -37.2, 1.8, 'rgba(240,110,100,0.4)'); circ(ctx, 5.8, -37.2, 1.8, 'rgba(240,110,100,0.4)');
        ctx.strokeStyle = '#8a4a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -37, 2, 0.3, Math.PI - 0.3); ctx.stroke();
      } else {
        ctx.fillStyle = shade(HR, 0.12); ctx.beginPath(); ctx.arc(0, -40, 7, 0.2, Math.PI - 0.2); ctx.fill();
        ctx.fillStyle = SKD; ctx.fillRect(-3, -32.5, 6, 2);
      }
    } else {
      // perfil (virado à direita)
      ctx.fillStyle = '#2a4a74'; ctx.fillRect(-3 - st * 3, -13, 5, 11); ctx.fillStyle = BT; rrect(ctx, -4 - st * 3, -4, 8, 5, 2); ctx.fill();
      ctx.fillStyle = OVD; ctx.fillRect(-2 + st * 3, -13, 5, 11); ctx.fillStyle = BT; rrect(ctx, -3 + st * 3, -4, 8, 5, 2); ctx.fill();
      ctx.translate(0, -bob);
      ctx.fillStyle = SHD; rrect(ctx, -3 + st * 3, -31, 5, 11, 2.5); ctx.fill();
      ctx.fillStyle = SH; rrect(ctx, -8, -32, 16, 21, 5); ctx.fill();
      ctx.fillStyle = 'rgba(120,20,20,0.35)'; ctx.fillRect(-8, -27, 16, 1.5); ctx.fillRect(1, -32, 1.5, 10);
      ctx.fillStyle = OV; rrect(ctx, -7, -22, 14, 11, 3); ctx.fill(); ctx.fillRect(0, -32, 3, 10); ctx.fillRect(1, -29, 6, 8);
      if (!swinging) { ctx.fillStyle = SH; rrect(ctx, -3 - st * 3, -31, 5, 11, 2.5); ctx.fill(); circ(ctx, -0.5 - st * 3.4, -19, 2.6, SK); }
      else { ctx.save(); ctx.translate(0, -29); ctx.rotate(-1.3 + (1 - G.swing / 0.3) * 1.8); ctx.fillStyle = SH; rrect(ctx, -2.5, 0, 5, 11, 2.5); ctx.fill(); circ(ctx, 0, 12, 2.6, SK); ctx.restore(); }
      circ(ctx, -0.5, -40, 9.5, HR);
      circ(ctx, 1.2, -39.5, 8.2, SK);
      ctx.fillStyle = HR; ctx.beginPath(); ctx.arc(-1, -41, 9, Math.PI * 0.55, Math.PI * 1.25); ctx.lineTo(-1, -41); ctx.fill();
      circ(ctx, -2, -38.5, 2.2, SKD);
      ctx.fillStyle = '#2b2118'; rrect(ctx, 4.2, -41.5, 2.4, 3.4, 1.2); ctx.fill();
      circ(ctx, 4.6, -36.8, 1.7, 'rgba(240,110,100,0.4)');
      circ(ctx, 9.3, -38.5, 1.4, SK);
    }
    // chapéu de palha
    const hx = side ? 1 : 0;
    ctx.fillStyle = '#e9c46a'; ctx.beginPath(); ctx.ellipse(hx, -46, 15.5, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c3963e'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#e1b752'; ctx.beginPath(); ctx.moveTo(hx - 8.5, -46); ctx.quadraticCurveTo(hx - 8.5, -57, hx, -57); ctx.quadraticCurveTo(hx + 8.5, -57, hx + 8.5, -46); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.fillRect(hx - 8.5, -50, 17, 3.2);
    ctx.strokeStyle = 'rgba(160,110,40,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath();
    for (let i = -3; i <= 3; i++) { ctx.moveTo(hx + i * 4, -44); ctx.lineTo(hx + i * 4.6, -42.5); }
    ctx.moveTo(hx - 7, -53); ctx.lineTo(hx + 7, -53); ctx.stroke();
    ctx.fillStyle = 'rgba(255,245,200,0.5)'; ctx.beginPath(); ctx.ellipse(hx - 3, -54.5, 3, 1.4, -0.3, 0, TAU); ctx.fill();
    ctx.restore();
    outlineCanvas(pcv);
    ctx = main;
    ctx.drawImage(pcv, Math.round(px - PW / 2), Math.round(py - PH + 8), PW, PH);
    // ferramenta em uso
    if (swinging) {
      const tool = D.tools[S.tool];
      const ic = tool.id === 'item' && S.held ? D.items[S.held].i : tool.i;
      const k = 1 - G.swing / 0.3, ang = k * 1.8 - 0.9;
      const ox = px + fx * 14, oy = py - 28, base = Math.atan2(-10, fx * 8);
      const a0 = base - 0.9 * fx, a1 = base + ang * fx;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ox, oy, 17, a0, a1, fx < 0); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - k)})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(ox, oy, 17, a0 + (a1 - a0) * 0.5, a1, fx < 0); ctx.stroke();
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang * fx);
      const im = !(tool.id === 'item' && S.held) && window.ICONS && ICONS.img ? ICONS.img(tool.id) : null;
      if (im) { ctx.translate(fx * 8, -10); if (fx < 0) ctx.scale(-1, 1); ctx.drawImage(im, -13, -13, 26, 26); }
      else drawEmo(ic, fx * 8, -10, 20, fx < 0);
      ctx.restore();
    }
    drawFishingRod(px, py);
    if (p.sick > 0) drawEmo('🤢', px + 14, py - 58, 12);
  }

  // =============================================================
  // ATMOSFERA: luz, tons do dia, partículas ambientes, chuva
  // =============================================================
  function darkness() {
    const m = S.time;
    if (m < 390) return 0.35 * (1 - (m - 360) / 30);
    if (m < 1050) return S.weather === 'chuva' ? 0.12 : 0;
    if (m < 1230) return 0.12 + (m - 1050) / 180 * 0.55;
    return 0.67;
  }
  const glowCache = new Map();
  function glowSprite(col) {
    let g = glowCache.get(col);
    if (!g) {
      g = document.createElement('canvas'); g.width = g.height = 128;
      const x = g.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.35, `rgba(${col},0.75)`); gr.addColorStop(0.7, `rgba(${col},0.22)`); gr.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      glowCache.set(col, g);
    }
    return g;
  }
  function glowOn(c, col, x, y, r, a) { c.globalAlpha = a; c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); }

  // Passo único de atmosfera: tons do dia (aurora, hora dourada, chuva,
  // inverno), noite azulada, vinheta e furos de luz — tudo num canvas de
  // meia resolução sobreposto ao quadro; depois brilhos quentes aditivos.
  let vigC = null, warmC = null;
  function drawAtmos(dark) {
    const m = S.time, rain = S.weather === 'chuva';
    let warm = 0, dawn = 0;
    if (m >= 990 && m < 1230) warm = m < 1110 ? (m - 990) / 120 : 1 - (m - 1110) / 120;
    if (m < 460) dawn = Math.max(0, (460 - Math.max(360, m)) / 100);
    if (rain) { warm *= 0.3; dawn *= 0.3; }
    const nk = dark > 0.01 ? Math.min(1, dark / 0.67) : 0;
    const lw = light.width, lh = light.height;
    lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
    lctx.clearRect(0, 0, lw, lh);
    const layer = (col) => { lctx.fillStyle = col; lctx.fillRect(0, 0, lw, lh); };
    if (S.season === 3 && !rain) layer('rgba(215,232,255,0.1)');
    if (rain) layer('rgba(50,66,96,0.26)');
    if (dawn > 0.01) layer(`rgba(255,140,170,${0.16 * dawn})`);
    if (!vigC) { // gradientes pré-renderizados (preencher gradiente a cada quadro é caro)
      vigC = document.createElement('canvas'); vigC.width = lw; vigC.height = lh;
      let x = vigC.getContext('2d'), g = x.createRadialGradient(lw / 2, lh / 2, Math.min(lw, lh) * 0.38, lw / 2, lh / 2, Math.hypot(lw, lh) * 0.56);
      g.addColorStop(0, 'rgba(30,20,10,0)'); g.addColorStop(1, 'rgba(30,20,10,0.32)'); x.fillStyle = g; x.fillRect(0, 0, lw, lh);
      warmC = document.createElement('canvas'); warmC.width = lw; warmC.height = lh;
      x = warmC.getContext('2d'); g = x.createLinearGradient(0, 0, lw, lh);
      g.addColorStop(0, 'rgba(255,150,40,0.42)'); g.addColorStop(1, 'rgba(235,90,50,0.3)'); x.fillStyle = g; x.fillRect(0, 0, lw, lh);
    }
    if (warm > 0.01) { lctx.globalAlpha = warm; lctx.drawImage(warmC, 0, 0); lctx.globalAlpha = 1; }
    if (nk) layer(`rgba(12,20,72,${0.68 * nk})`);
    lctx.drawImage(vigC, 0, 0);
    const p = S.player, plx = p.x * TS - cam.x, ply = p.y * TS - cam.y - 20;
    const warmGlows = [];
    if (nk) {
      const q = Z;
      lctx.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a) => glowOn(lctx, '0,0,0', x * q, y * q, r * q, a * nk);
      hole(plx, ply, TS * 2.8, 0.8);
      for (const b of S.buildings) {
        const def = D.buildings[b.type];
        if (!def) continue;
        const bx = (b.x + def.w / 2) * TS - cam.x, by = (b.y + def.h / 2) * TS - cam.y;
        if (bx < -300 || by < -300 || bx > VW + 300 || by > VH + 300) continue;
        if (def.light) { const r = TS * def.light * (0.95 + Math.sin(t * 9 + b.id) * 0.05); hole(bx, by, r, 0.97); warmGlows.push([bx, by + 4, r * 0.62, b.type === 'fogueira' ? 0.5 : 0.35]); }
        if (b.type === 'casa') {
          hole(bx, by + 26, TS * 2.6, 0.75);
          const x0 = b.x * TS - cam.x, y0 = b.y * TS - cam.y;
          const CL = casaLayout(def.w * TS, def.h * TS);
          for (const wx of CL.winX) { hole(x0 + wx, y0 + CL.winY, 52, 0.9); warmGlows.push([x0 + wx, y0 + CL.winY, 48, 0.32]); }
          warmGlows.push([x0 + def.w * TS / 2 + 23, y0 + def.h * TS - 50, 26, 0.45]);
        }
        if (b.type === 'loja') hole(bx, by, TS * 2, 0.5);
      }
      lctx.globalAlpha = 1;
    }
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(light, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    if (nk) {
      for (const [x, y, r, al] of warmGlows) glowOn(ctx, '255,140,50', x * Z, y * Z, r * Z * (0.97 + Math.sin(t * 8 + x) * 0.03), al * nk);
      glowOn(ctx, '255,190,110', plx * Z, (ply + 6) * Z, TS * 1.3 * Z, 0.16 * nk);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ----- partículas ambientes (coordenadas de tela, ancoradas no mundo) -----
  let ambReady = false;
  const amb = { leaves: [], snow: [], flies: [], petals: [], drops: [], splash: [] };
  function ambInit() {
    const R0 = Math.random;
    amb.leaves = Array.from({ length: 24 }, () => ({ x: R0() * W, y: R0() * H, s: 0.7 + R0() * 0.7, r: R0() * TAU, vr: (R0() - 0.5) * 4, ph: R0() * TAU, c: ['#d9662a', '#c0392b', '#e8a23a', '#a8642a'][R0() * 4 | 0] }));
    amb.snow = Array.from({ length: 110 }, () => ({ x: R0() * W, y: R0() * H, s: 0.5 + R0() * 1, ph: R0() * TAU }));
    amb.flies = Array.from({ length: 26 }, () => ({ x: R0() * W, y: R0() * H, ph: R0() * TAU, sp: 0.5 + R0() }));
    amb.petals = Array.from({ length: 14 }, () => ({ x: R0() * W, y: R0() * H, s: 0.7 + R0() * 0.6, r: R0() * TAU, vr: (R0() - 0.5) * 3, ph: R0() * TAU }));
    amb.drops = Array.from({ length: 200 }, () => ({ x: R0(), y: R0(), s: 0.6 + R0() * 0.7 }));
    amb.splash = Array.from({ length: 36 }, () => ({ x: R0() * W, y: R0() * H, k: R0() }));
    ambReady = true;
  }
  function wrap(p) { if (p.x < -30) p.x += W + 60; else if (p.x > W + 30) p.x -= W + 60; if (p.y < -30) p.y += H + 60; else if (p.y > H + 30) p.y -= H + 60; }
  function updAmb(dt, dx, dy) {
    for (const k of ['leaves', 'snow', 'flies', 'petals', 'splash']) for (const p of amb[k]) { p.x -= dx; p.y -= dy; wrap(p); }
  }
  function drawAmbient(dt) {
    const s = S.season, rain = S.weather === 'chuva', m = S.time, night = m >= 1140 || m < 330;
    if (s === 2 && !rain) {
      for (const p of amb.leaves) {
        p.ph += dt * 2; p.r += p.vr * dt;
        p.x += (22 + Math.sin(p.ph) * 26) * dt * p.s; p.y += (26 + Math.cos(p.ph * 0.7) * 10) * dt * p.s; wrap(p);
        const ca = Math.cos(p.r), sa = Math.sin(p.r), fl = Math.abs(Math.sin(p.ph * 1.3)) * 0.7 + 0.3;
        ctx.setTransform(dpr * ca, dpr * sa, -dpr * sa * fl, dpr * ca * fl, dpr * p.x, dpr * p.y);
        leaf(ctx, -4 * p.s, 0, 8 * p.s, 2.6 * p.s, 0, p.c, 'rgba(0,0,0,0.25)');
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (s === 0 && !rain && !night) {
      for (const p of amb.petals) {
        p.ph += dt * 1.6; p.r += p.vr * dt;
        p.x += (16 + Math.sin(p.ph) * 20) * dt; p.y += (14 + Math.cos(p.ph) * 8) * dt; wrap(p);
        ctx.setTransform(dpr * Math.cos(p.r), dpr * Math.sin(p.r), -dpr * Math.sin(p.r), dpr * Math.cos(p.r), dpr * p.x, dpr * p.y);
        ell(ctx, 0, 0, 2.6 * p.s, 1.5 * p.s, 'rgba(255,190,215,0.9)');
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (s === 3 && S.weather === 'sol') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath();
      for (const p of amb.snow) {
        p.ph += dt; p.x += (Math.sin(p.ph * 1.2) * 14 + 6) * dt; p.y += (18 + p.s * 16) * dt; wrap(p);
        const r = 0.9 + p.s * 1.1; ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, TAU);
      }
      ctx.fill();
    }
  }
  function drawFireflies(dt) {
    const m = S.time;
    if (S.season !== 1 || S.weather === 'chuva' || !(m >= 1110 || m < 330)) return;
    const k = clamp((m - 1110) / 60, 0, 1) || (m < 330 ? 1 : 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of amb.flies) {
      p.ph += dt * p.sp;
      p.x += Math.sin(p.ph * 1.3) * 18 * dt; p.y += Math.cos(p.ph * 0.9) * 12 * dt; wrap(p);
      const a = Math.max(0, Math.sin(p.ph * 2.2)) * k;
      if (a < 0.05) continue;
      glowOn(ctx, '200,255,120', p.x, p.y, 9, a * 0.8);
      ctx.globalAlpha = a; circ(ctx, p.x, p.y, 1.3, '#f6ffc0');
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawRain(dt) {
    if (S.weather !== 'chuva') return;
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? 'rgba(215,228,255,0.7)' : 'rgba(180,200,240,0.4)'; ctx.lineWidth = pass ? 1.6 : 1.1;
      ctx.beginPath();
      for (let i = pass; i < amb.drops.length; i += 2) {
        const d = amb.drops[i];
        d.y += dt * 1.7 * d.s; d.x += dt * 0.16 * d.s;
        if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
        if (d.x > 1) d.x -= 1;
        const x = d.x * W, y = d.y * H, l = (pass ? 15 : 9) * d.s;
        ctx.moveTo(x, y); ctx.lineTo(x - l * 0.28, y + l);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(220,230,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const s of amb.splash) {
      s.k += dt * 2.4;
      if (s.k > 1) { s.k = 0; s.x = Math.random() * W; s.y = Math.random() * H; }
      const r = 1 + s.k * 6; ctx.moveTo(s.x + r, s.y); ctx.ellipse(s.x, s.y, r, r * 0.4, 0, 0, TAU);
    }
    ctx.stroke();
  }
  // sombras de nuvens
  let cloudSpr = null;
  function drawClouds() {
    const m = S.time;
    if (S.weather !== 'sol' || m < 400 || m > 1150) return;
    if (!cloudSpr) {
      cloudSpr = document.createElement('canvas'); cloudSpr.width = 640; cloudSpr.height = 400;
      const c = cloudSpr.getContext('2d'), r = rng(77); c.scale(2.5, 2.5);
      for (let i = 0; i < 9; i++) {
        const x = 50 + r() * 156, y = 50 + r() * 60, rr = 30 + r() * 30, g = c.createRadialGradient(x, y, 0, x, y, rr);
        g.addColorStop(0, 'rgba(20,30,60,0.5)'); g.addColorStop(1, 'rgba(20,30,60,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 160);
      }
    }
    const span = G.W * TS + 1200;
    const fade = Math.min(1, (m - 400) / 60, (1150 - m) / 60);
    ctx.globalAlpha = 0.22 * fade;
    for (let i = 0; i < 4; i++) {
      const wx = ((t * 14 + i * span / 4) % span) - 600, wy = (i * 0.29 % 1) * G.H * TS + Math.sin(t * 0.05 + i) * 60;
      const x = wx - cam.x, y = wy - cam.y;
      if (x > VW || y > VH || x + 640 < 0 || y + 400 < 0) continue;
      ctx.drawImage(cloudSpr, Math.round(x), Math.round(y));
    }
    ctx.globalAlpha = 1;
  }

  // =============================================================
  // QUADRO
  // =============================================================
  function zMin() { return Math.max(0.2, Math.min(1, W / (G.W * TS), H / (G.H * TS))); }
  function setZoom(z, sx, sy) {
    ZT = clamp(z, zMin(), 1.6);
    zAnchor = sx != null && sy != null ? { sx, sy, wx: sx / Z + cam.x, wy: sy / Z + cam.y } : null;
    return ZT;
  }
  function zoomBy(f, sx, sy) { return setZoom(ZT * f, sx, sy); }
  function getZoom() { return ZT; }
  function tileSize() { return TS * Z; }

  function frame(dt, target, ghost) {
    t += dt;
    bMapLen = -1; // reconstrói o mapa de construções neste quadro
    const p = S.player;
    // zoom suave
    ZT = clamp(ZT, zMin(), 1.6);
    if (Math.abs(ZT - Z) > 0.0005) Z += (ZT - Z) * Math.min(1, dt * 12); else { Z = ZT; zAnchor = null; }
    VW = W / Z; VH = H / Z;
    const mw = G.W * TS, mh = G.H * TS;
    const fitX = (v, mapS, view) => mapS + TS * 4 <= view ? (mapS - view) / 2 : Math.max(-TS * 2, Math.min(mapS - view + TS * 2, v));
    let tx = fitX(p.x * TS - VW / 2, mw, VW), ty = fitX(p.y * TS - VH / 2, mh, VH);
    if (zAnchor) { // mantém o ponto sob o cursor fixo durante o zoom
      camF.x = fitX(zAnchor.wx - zAnchor.sx / Z, mw, VW); camF.y = fitX(zAnchor.wy - zAnchor.sy / Z, mh, VH);
    } else { camF.x += (tx - camF.x) * Math.min(1, dt * 8); camF.y += (ty - camF.y) * Math.min(1, dt * 8); }
    cam.x = camF.x; cam.y = camF.y;
    if (G.shake > 0) { G.shake -= dt; cam.x += (Math.random() - 0.5) * 4; cam.y += (Math.random() - 0.5) * 4; }

    cam.x = Math.round(cam.x * Z) / Z; cam.y = Math.round(cam.y * Z) / Z;
    if (!ambReady) ambInit();
    if (lastCam) { const dx = (cam.x - lastCam.x) * Z, dy = (cam.y - lastCam.y) * Z; if (Math.abs(dx) < W && Math.abs(dy) < H) updAmb(dt, dx, dy); }
    lastCam = { x: cam.x, y: cam.y };
    const far = Z < 0.55; // vista de longe: pula detalhes miúdos

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    ctx.fillStyle = '#22331d'; ctx.fillRect(0, 0, W, H);
    // ---- passo do mundo (escala = zoom) ----
    ctx.setTransform(dpr * Z, 0, 0, dpr * Z, 0, 0);
    const x0 = Math.max(0, Math.floor(cam.x / TS) - 1), y0 = Math.max(0, Math.floor(cam.y / TS) - 1);
    const x1 = Math.min(G.W - 1, Math.ceil((cam.x + VW) / TS) + 1), y1 = Math.min(G.H - 1, Math.ceil((cam.y + VH) / TS) + 2);

    frameN++;
    const bById = new Map(); for (const b of S.buildings) bById.set(b.id, b);
    if (far) { drawFarLayer(bById); drawFishingWater(); }
    else {
      drawGroundChunks(); drawWaterFx(x0, y0, x1, y1); drawFishingWater();
      updateWild(dt, x0, y0, x1, y1); drawWildGround();
      for (const b of S.buildings) if (b.type === 'ponte' && b.x >= x0 - 1 && b.x <= x1 + 1 && b.y >= y0 - 1 && b.y <= y1 + 1) drawBuilding(b, true);
    }

    // alvo
    if (target) {
      const px = target.x * TS - cam.x, py = target.y * TS - cam.y, k = 2 + Math.sin(t * 6) * 1.2, L = 10;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, px + 2, py + 2, TS - 4, TS - 4, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 2.5 / Math.min(1, Z); ctx.lineCap = 'round'; ctx.beginPath();
      const a = px + k, b = py + k, c = px + TS - k, d = py + TS - k;
      ctx.moveTo(a, b + L); ctx.lineTo(a, b); ctx.lineTo(a + L, b);
      ctx.moveTo(c - L, b); ctx.lineTo(c, b); ctx.lineTo(c, b + L);
      ctx.moveTo(c, d - L); ctx.lineTo(c, d); ctx.lineTo(c - L, d);
      ctx.moveTo(a + L, d); ctx.lineTo(a, d); ctx.lineTo(a, d - L);
      ctx.stroke(); ctx.lineCap = 'butt';
    }

    // camadas por linha (profundidade)
    const drawn = new Set();
    const animalsByRow = new Map();
    for (const a of S.animals) { if (a.inside) continue; const r = Math.floor(a.y); if (!animalsByRow.has(r)) animalsByRow.set(r, []); animalsByRow.get(r).push(a); }
    const prow = Math.floor(p.y);
    for (let y = y0; y <= y1; y++) {
      if (!far) for (let x = x0; x <= x1; x++) {
        const tile = S.tiles[y * G.W + x], px = x * TS - cam.x, py = y * TS - cam.y;
        if (tile.c) drawCrop(px, py, tile.c, x, y);
        const o = tile.o;
        if (!o) continue;
        if (o.t === 'weed') drawWeed(px, py, o, x, y);
        else if (o.t === 'rock') drawRock(px, py, o, x);
        else if (o.t === 'tree') drawTree(px, py, o, x, y);
        else if (o.t === 'fruit') drawFruitTree(px, py, o, x, y);
        else if (o.t === 'b' && !drawn.has(o.id)) {
          const b = bById.get(o.id);
          if (b && b.type !== 'ponte' && D.buildings[b.type] && y === b.y + D.buildings[b.type].h - 1) { drawn.add(o.id); drawBuilding(b); }
        }
      }
      (animalsByRow.get(y) || []).sort((a, b) => a.y - b.y).forEach(drawAnimal);
      if (y === prow) drawPlayer();
    }
    // construções que começam acima da tela
    if (!far) { for (const b of S.buildings) if (!drawn.has(b.id)) { const def = D.buildings[b.type]; if (def && b.type !== 'ponte' && b.y + def.h - 1 > y1 && b.y <= y1 + 3) drawBuilding(b); } }
    else for (const b of S.buildings) { const def = D.buildings[b.type]; if (def) buildingFx(b, b.x * TS - cam.x, b.y * TS - cam.y, def.w * TS, def.h * TS); }

    // fantasma de construção
    if (ghost) {
      const def = D.buildings[ghost.type];
      const gx = ghost.x * TS - cam.x, gy = ghost.y * TS - cam.y;
      ctx.fillStyle = ghost.ok ? 'rgba(120,255,120,0.28)' : 'rgba(255,80,80,0.35)';
      rrect(ctx, gx, gy, def.w * TS, def.h * TS, 6); ctx.fill();
      ctx.strokeStyle = ghost.ok ? 'rgba(200,255,200,0.9)' : 'rgba(255,170,170,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 20; ctx.stroke(); ctx.setLineDash([]);
      try {
        const fake = { id: -1, type: ghost.type, x: ghost.x, y: ghost.y, data: { feed: 0, batches: [], ready: 0, eggs: 0, mel: 0 } };
        ctx.globalAlpha = 0.6; blit(buildingSprite(fake, false), gx, gy); ctx.globalAlpha = 1;
      } catch (e) { ctx.globalAlpha = 1; drawEmo(def.i || '🏠', gx + def.w * TS / 2, gy + def.h * TS / 2, 26); }
    }

    if (!far) drawWildAir();
    drawClouds();
    // partículas
    for (const q of G.particles) { ctx.fillStyle = q.color; ctx.globalAlpha = Math.max(0, Math.min(1, q.life)); ctx.beginPath(); ctx.arc(q.x * TS - cam.x, q.y * TS - cam.y, 2.3, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;

    // ---- passo de tela ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAmbient(dt);

    // terras não compradas
    for (const lot of D.lots) {
      if (S.lots[lot.id]) continue;
      const lx = (lot.x * TS - cam.x) * Z, ly = (lot.y * TS - cam.y) * Z, lw = lot.w * TS * Z, lh = lot.h * TS * Z;
      if (lx > W || ly > H || lx + lw < 0 || ly + lh < 0) continue;
      ctx.fillStyle = 'rgba(15,20,30,0.55)'; ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = 'rgba(255,230,150,0.55)'; ctx.lineWidth = far ? 2 : 3; ctx.setLineDash([12, 8]); ctx.strokeRect(lx + 2, ly + 2, lw - 4, lh - 4); ctx.setLineDash([]);
      const sc = clamp(Math.min(lw / 250, lh / 90), 0.55, 1), bw = 224 * sc, bh = 62 * sc;
      const cx = Math.max(lx + bw / 2 + 4, Math.min(lx + lw - bw / 2 - 4, W / 2)), cy = Math.max(ly + bh / 2 + 4, Math.min(ly + lh - bh / 2 - 4, H / 2));
      ctx.fillStyle = 'rgba(40,26,14,0.82)'; rrect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 12 * sc); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,130,0.75)'; ctx.lineWidth = 2; rrect(ctx, cx - bw / 2 + 4, cy - bh / 2 + 4, bw - 8, bh - 8, 9 * sc); ctx.stroke();
      ctx.fillStyle = '#ffe9a8'; ctx.font = `bold ${Math.round(16 * sc)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('🔒 ' + lot.n, cx, cy - 6 * sc);
      ctx.fillStyle = '#fff'; ctx.font = `${Math.round(13 * sc)}px sans-serif`;
      ctx.fillText(`À venda: 💰 ${lot.cost} · tecla T`, cx, cy + 16 * sc);
    }

    drawAtmos(darkness());
    drawFireflies(dt);
    drawRain(dt);
    if (S.creative && Z >= 0.6) { ctx.setTransform(dpr * Z, 0, 0, dpr * Z, 0, 0); cropOverlay(x0, y0, x1, y1); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const f of G.popups) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      const x = (f.x * TS - cam.x) * Z, y = (f.y * TS - cam.y) * Z;
      ctx.strokeStyle = 'rgba(30,20,10,0.75)'; ctx.lineWidth = 3.5; ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1; ctx.lineJoin = 'miter';
  }

  // modo criativo: dias restantes e saúde de cada cultivo
  function cropOverlay(x0, y0, x1, y1) {
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = S.tiles[y * G.W + x].c;
      if (!c || c.dead) continue;
      const crop = D.crops[c.id]; if (!crop) continue;
      const px = x * TS - cam.x + TS / 2, py = y * TS - cam.y + 4;
      const hp = Math.round(clamp(c.hp == null ? 100 : c.hp, 0, 100) / 5) / 20;
      const txt = Math.max(0, crop.days - c.g) + 'd';
      blit(sprite(`lbl|${txt}|${hp}`, 32, 20, 16, 2, l => {
        l.fillStyle = 'rgba(0,0,0,0.6)'; l.fillRect(-10, -1, 20, 4);
        l.fillStyle = `hsl(${hp * 120},85%,48%)`; l.fillRect(-9.5, -0.5, 19 * hp, 3);
        l.font = 'bold 9px sans-serif'; l.textAlign = 'center'; l.lineJoin = 'round';
        l.strokeStyle = 'rgba(0,0,0,0.75)'; l.lineWidth = 2.5; l.strokeText(txt, 0, 12);
        l.fillStyle = '#fff'; l.fillText(txt, 0, 12);
      }, false), px, py);
    }
    ctx.lineJoin = 'miter';
  }
  function worldToScreen(x, y) { return { x: (x * TS - cam.x) * Z, y: (y * TS - cam.y) * Z }; }

  // mini-mapa para o painel de terras
  function minimap(canvas) {
    const c = canvas.getContext('2d'), s = canvas.width / G.W, P = PAL[S.season];
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const tl = S.tiles[G.idx(x, y)];
      let col = tl.g === 'water' ? '#3a8fd1' : tl.g === 'sand' ? P.s0 : tl.g === 'tilled' ? '#8a5f3a' : (hash(x, y) < 0.5 ? P.g0 : P.g1);
      if (tl.o) col = tl.o.t === 'tree' ? '#2f6a33' : tl.o.t === 'rock' ? '#9a958c' : tl.o.t === 'b' ? '#b5452f' : tl.o.t === 'fruit' ? '#e8a33c' : tl.o.t === 'weed' ? P.tuft : col;
      if (tl.c) col = '#c9e26a';
      c.fillStyle = col; c.fillRect(x * s, y * s, s + 0.5, s + 0.5);
    }
    for (const lot of D.lots) {
      if (!S.lots[lot.id]) { c.fillStyle = 'rgba(10,15,25,0.55)'; c.fillRect(lot.x * s, lot.y * s, lot.w * s, lot.h * s); }
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1; c.strokeRect(lot.x * s + 0.5, lot.y * s + 0.5, lot.w * s - 1, lot.h * s - 1);
      c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
      c.fillText(lot.n, (lot.x + lot.w / 2) * s, (lot.y + lot.h / 2) * s);
    }
    c.fillStyle = '#ff3'; c.beginPath(); c.arc(S.player.x * s, S.player.y * s, 3, 0, 7); c.fill();
  }

  return { TS, init, frame, screenToWorld, worldToScreen, tileSize, setZoom: z => setZoom(z), getZoom, zoomBy, minimap, emo };
})();
