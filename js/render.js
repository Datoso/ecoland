// =============================================================
// EcoLand — renderização em canvas (tudo procedural, sem imagens)
// =============================================================
window.R = (() => {
  const TS = 44; // tamanho do tile em pixels
  let cv, ctx, light, lctx, W = 0, H = 0, dpr = 1;
  const cam = { x: 0, y: 0 }, camF = { x: 0, y: 0 };
  const emojiCache = new Map();
  let t = 0;

  function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

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
  function drawEmo(ch, x, y, size, flip) {
    const c = emo(ch, Math.round(size));
    if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore(); }
    else ctx.drawImage(c, x - c.width / 2, y - c.height / 2);
  }

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    light = document.createElement('canvas'); lctx = light.getContext('2d');
    resize();
    addEventListener('resize', resize);
  }
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    light.width = W; light.height = H;
  }

  function screenToWorld(sx, sy) { return { x: (sx + cam.x) / TS, y: (sy + cam.y) / TS }; }

  // ---------- paleta sazonal ----------
  const GRASS = [['#6fbf4f', '#66b548'], ['#5cae3e', '#54a339'], ['#a9a64c', '#9c9a45'], ['#a8bba0', '#9cb094']];
  const LEAF = [['#3f9b3a', '#58b847'], ['#2f8a33', '#45a63b'], ['#c9822f', '#d9a440'], ['#6f8f6a', '#86a27f']];

  function grassColor(x, y, lot) {
    const s = S.season, h = hash(x, y);
    let c = h < 0.5 ? GRASS[s][0] : GRASS[s][1];
    if (lot && lot.biome === 'cerrado') c = s === 3 ? '#b4b38f' : (h < 0.5 ? '#a8ad55' : '#9fa64f');
    return c;
  }

  // ---------- chão ----------
  function drawGround(x, y, tile, px, py) {
    const lot = G.lotAt(x, y);
    if (tile.g === 'water') {
      ctx.fillStyle = '#3a8fd1'; ctx.fillRect(px, py, TS, TS);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      const o = Math.sin(t * 1.5 + x * 0.8 + y * 0.5) * 4;
      ctx.beginPath(); ctx.moveTo(px + 8 + o, py + 16); ctx.quadraticCurveTo(px + 16 + o, py + 12, px + 24 + o, py + 16); ctx.stroke();
      if (hash(x, y) > 0.5) { ctx.beginPath(); ctx.moveTo(px + 20 - o, py + 32); ctx.quadraticCurveTo(px + 28 - o, py + 28, px + 36 - o, py + 32); ctx.stroke(); }
      // borda
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const n = G.tile(x + dx, y + dy);
        if (n && n.g !== 'water') {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          if (dy === -1) ctx.fillRect(px, py, TS, 3); if (dy === 1) ctx.fillRect(px, py + TS - 3, TS, 3);
          if (dx === -1) ctx.fillRect(px, py, 3, TS); if (dx === 1) ctx.fillRect(px + TS - 3, py, 3, TS);
        }
      }
      return;
    }
    if (tile.g === 'sand') {
      ctx.fillStyle = hash(x, y) < 0.5 ? '#e3cf8f' : '#dcc685'; ctx.fillRect(px, py, TS, TS);
      return;
    }
    ctx.fillStyle = grassColor(x, y, lot);
    ctx.fillRect(px, py, TS, TS);
    const h = hash(x, y);
    if (h > 0.55) {
      ctx.strokeStyle = 'rgba(0,60,0,0.18)'; ctx.lineWidth = 2;
      const gx = px + h * 30 + 4, gy = py + ((h * 997) % 1) * 28 + 10;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 2, gy - 6); ctx.moveTo(gx + 4, gy); ctx.lineTo(gx + 5, gy - 7); ctx.stroke();
    }
    if (h > 0.93 && S.season < 2) { ctx.fillStyle = h > 0.965 ? '#fff6a0' : '#ffd1ea'; ctx.beginPath(); ctx.arc(px + 30, py + 30, 2.5, 0, 7); ctx.fill(); }
    if (tile.g === 'tilled') {
      ctx.fillStyle = tile.wet ? '#5a3a22' : '#8a5f3a';
      ctx.fillRect(px + 2, py + 2, TS - 4, TS - 4);
      ctx.fillStyle = tile.wet ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 5, py + 9 + i * 11, TS - 10, 3);
      if (tile.fert || (tile.c && tile.c.fert)) { ctx.fillStyle = 'rgba(40,20,5,0.5)'; for (let i = 0; i < 6; i++) ctx.fillRect(px + 6 + ((i * 13) % 30), py + 6 + ((i * 7) % 30), 3, 3); }
    }
  }

  // ---------- objetos ----------
  function drawTree(px, py, o, x, y) {
    const s = S.season, v = o.v || 0;
    const cx = px + TS / 2, by = py + TS - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, by, 16, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a4f2a'; ctx.fillRect(cx - 5, by - 26, 10, 26);
    const sway = Math.sin(t * 1.2 + x) * 1.5;
    const leaf = LEAF[s];
    if (v === 3 && s !== 3) {
      // pinheiro / araucária estilizada
      ctx.fillStyle = '#2d6e34';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx + sway, by - 70 + i * 14); ctx.lineTo(cx - 20 + i * 2, by - 34 + i * 12); ctx.lineTo(cx + 20 - i * 2, by - 34 + i * 12); ctx.fill(); }
      return;
    }
    ctx.fillStyle = leaf[0];
    ctx.beginPath(); ctx.arc(cx + sway, by - 40, 20, 0, 7); ctx.arc(cx - 13 + sway, by - 30, 14, 0, 7); ctx.arc(cx + 13 + sway, by - 30, 14, 0, 7); ctx.fill();
    ctx.fillStyle = leaf[1];
    ctx.beginPath(); ctx.arc(cx - 5 + sway, by - 46, 10, 0, 7); ctx.fill();
    if (o.hp < 3) { ctx.fillStyle = '#f2d6a0'; ctx.fillRect(cx - 5, by - 14, 10, 3); }
  }

  function drawFruitTree(px, py, o, x, y) {
    const f = D.fruits[o.k];
    const grown = Math.min(1, 0.35 + o.age / f.mature * 0.65);
    const cx = px + TS / 2, by = py + TS - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, by, 14 * grown, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#80552e'; ctx.fillRect(cx - 3 * grown, by - 24 * grown, 6 * grown, 24 * grown);
    const sway = Math.sin(t * 1.2 + x) * 1.2;
    if (o.k === 'banana') {
      ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 7 * grown; ctx.lineCap = 'round';
      for (const a of [-1.1, -0.4, 0.4, 1.1]) { ctx.beginPath(); ctx.moveTo(cx, by - 26 * grown); ctx.quadraticCurveTo(cx + Math.sin(a) * 20 * grown + sway, by - 50 * grown, cx + Math.sin(a) * 26 * grown + sway, by - 34 * grown); ctx.stroke(); }
      ctx.lineCap = 'butt';
    } else {
      ctx.fillStyle = S.season === 3 ? '#5f8f55' : '#3b9a3d';
      ctx.beginPath(); ctx.arc(cx + sway, by - 36 * grown, 18 * grown, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(cx - 5 + sway, by - 42 * grown, 7 * grown, 0, 7); ctx.fill();
    }
    if (o.ready) {
      for (const [dx, dy] of [[-9, -36], [8, -42], [2, -28]]) drawEmo(f.i, cx + dx + sway, by + dy, 13);
    }
  }

  function drawRock(px, py, o, x) {
    const cx = px + TS / 2, cy = py + TS / 2 + 6, v = o.v || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, cy + 10, 15, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = v % 2 ? '#8e8e8e' : '#9c968c';
    ctx.beginPath(); ctx.moveTo(cx - 15, cy + 8); ctx.lineTo(cx - 12, cy - 6); ctx.lineTo(cx - 2, cy - 12); ctx.lineTo(cx + 11, cy - 8); ctx.lineTo(cx + 16, cy + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(cx - 10, cy - 5); ctx.lineTo(cx - 2, cy - 10); ctx.lineTo(cx + 4, cy - 6); ctx.lineTo(cx - 6, cy - 2); ctx.fill();
    if (o.hp < 2) { ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 2, cy - 10); ctx.lineTo(cx + 2, cy); ctx.lineTo(cx - 3, cy + 7); ctx.stroke(); }
  }

  function drawWeed(px, py, o, x, y) {
    const cx = px + TS / 2, by = py + TS - 8;
    const sway = Math.sin(t * 2 + x * 1.3 + y) * 2;
    ctx.strokeStyle = S.season === 2 ? '#8a8a2c' : S.season === 3 ? '#7b8f6e' : '#3c8f2f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 4, by); ctx.quadraticCurveTo(cx + i * 6, by - 10, cx + i * 7 + sway, by - 18 + Math.abs(i) * 3); ctx.stroke(); }
    ctx.lineCap = 'butt';
  }

  function drawCrop(px, py, c, x, y) {
    const crop = D.crops[c.id];
    const cx = px + TS / 2, by = py + TS - 8;
    if (c.dead) {
      ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx - 6, by - 12); ctx.moveTo(cx, by); ctx.lineTo(cx + 6, by - 10); ctx.stroke();
      return;
    }
    const p = Math.min(1, c.g / crop.days);
    const sway = Math.sin(t * 2 + x + y) * 1.2;
    if (p >= 1) {
      ctx.fillStyle = crop.color;
      ctx.beginPath(); ctx.ellipse(cx, by - 6, 13, 8, 0, 0, 7); ctx.fill();
      drawEmo(crop.i, cx + sway, by - 14 + Math.sin(t * 3 + x) * 1.5, 24);
      return;
    }
    ctx.strokeStyle = crop.color; ctx.fillStyle = crop.color; ctx.lineWidth = 2.5;
    const hgt = 6 + p * 20;
    ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx + sway, by - hgt); ctx.stroke();
    const leaves = 1 + Math.floor(p * 4);
    for (let i = 0; i < leaves; i++) {
      const ly = by - hgt * (0.3 + i * 0.18), side = i % 2 ? 1 : -1;
      ctx.beginPath(); ctx.ellipse(cx + side * 5 + sway, ly, 5 + p * 3, 2.5 + p, side * 0.5, 0, 7); ctx.fill();
    }
  }

  // ---------- construções ----------
  function roof(px, py, w, h, color, dark) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(px - 4, py + h); ctx.lineTo(px + w / 2, py); ctx.lineTo(px + w + 4, py + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark; ctx.fillRect(px - 4, py + h - 4, w + 8, 4);
  }

  function drawBuilding(b) {
    const def = D.buildings[b.type];
    const px = b.x * TS - cam.x, py = b.y * TS - cam.y, w = def.w * TS, h = def.h * TS;
    const night = G.isNight();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px + 4, py + h - 6, w, 8);
    switch (b.type) {
      case 'casa': {
        ctx.fillStyle = '#e9d8b4'; ctx.fillRect(px + 6, py + 34, w - 12, h - 36);
        ctx.fillStyle = '#d4c09a'; for (let i = 0; i < 5; i++) ctx.fillRect(px + 6, py + 44 + i * 18, w - 12, 2);
        roof(px + 6, py - 14, w - 12, 52, '#b5452f', '#8c3322');
        ctx.fillStyle = '#7a4a28'; ctx.fillRect(px + w / 2 - 12, py + h - 40, 24, 38);
        ctx.fillStyle = '#e1b354'; ctx.beginPath(); ctx.arc(px + w / 2 + 7, py + h - 20, 2, 0, 7); ctx.fill();
        for (const wx of [px + 22, px + w - 50]) {
          ctx.fillStyle = night ? '#ffd877' : '#9fd4f0'; ctx.fillRect(wx, py + 58, 28, 24);
          ctx.strokeStyle = '#7a4a28'; ctx.lineWidth = 3; ctx.strokeRect(wx, py + 58, 28, 24);
          ctx.beginPath(); ctx.moveTo(wx + 14, py + 58); ctx.lineTo(wx + 14, py + 82); ctx.stroke();
        }
        ctx.fillStyle = '#8a8a8a'; ctx.fillRect(px + w - 46, py - 6, 14, 26);
        if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = 'rgba(220,220,220,0.5)'; ctx.beginPath(); ctx.arc(px + w - 39 + Math.sin(t) * 3, py - 14 - (t * 10 % 12), 5, 0, 7); ctx.fill(); }
        break;
      }
      case 'loja': {
        ctx.fillStyle = '#c99a5e'; ctx.fillRect(px + 4, py + 26, w - 8, h - 28);
        ctx.fillStyle = '#a77a43'; ctx.fillRect(px + 4, py + h - 30, w - 8, 28);
        for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#2e8b57'; ctx.fillRect(px + i * (w / 7), py + 10, w / 7 + 1, 22); }
        ctx.fillStyle = '#2e8b57'; ctx.beginPath(); for (let i = 0; i < 7; i++) ctx.arc(px + i * (w / 7) + w / 14, py + 32, w / 14, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#3b2a1a'; ctx.fillRect(px + w / 2 - 34, py - 12, 68, 20);
        ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('AGRO&CIA', px + w / 2, py + 3);
        for (const [i, e] of ['🌱', '🔩', '🌰'].entries()) drawEmo(e, px + 26 + i * 40, py + h - 18, 18);
        break;
      }
      case 'galinheiro': {
        ctx.fillStyle = '#d8b26e'; ctx.fillRect(px + 6, py + 22, w - 12, h - 24);
        roof(px + 6, py - 4, w - 12, 30, '#6f8f3c', '#56702e');
        ctx.fillStyle = '#5a3a1f'; ctx.fillRect(px + w / 2 - 10, py + h - 26, 20, 24);
        ctx.strokeStyle = '#5a3a1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + w / 2 - 10, py + h); ctx.lineTo(px + w / 2 + 6, py + h + 14); ctx.stroke();
        if (b.data.eggs > 0) drawEmo('🥚', px + w - 18, py + 40, 16);
        break;
      }
      case 'galpao': {
        ctx.fillStyle = '#b23b2e'; ctx.fillRect(px + 6, py + 34, w - 12, h - 36);
        roof(px + 6, py - 6, w - 12, 44, '#5c4a3a', '#46382c');
        ctx.fillStyle = '#f2eadf'; ctx.fillRect(px + w / 2 - 26, py + h - 54, 52, 52);
        ctx.strokeStyle = '#b23b2e'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(px + w / 2 - 26, py + h - 54); ctx.lineTo(px + w / 2 + 26, py + h - 2); ctx.moveTo(px + w / 2 + 26, py + h - 54); ctx.lineTo(px + w / 2 - 26, py + h - 2); ctx.stroke();
        ctx.fillStyle = '#f2eadf'; ctx.fillRect(px + w / 2 - 12, py + 14, 24, 18);
        break;
      }
      case 'poco': {
        ctx.fillStyle = '#7d7d7d'; ctx.beginPath(); ctx.ellipse(px + w / 2, py + h - 26, 30, 18, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#9a9a9a'; ctx.fillRect(px + w / 2 - 30, py + h - 40, 60, 16);
        ctx.fillStyle = '#2a5f8f'; ctx.beginPath(); ctx.ellipse(px + w / 2, py + h - 40, 24, 10, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#6b4423'; ctx.fillRect(px + w / 2 - 30, py + 6, 5, h - 46); ctx.fillRect(px + w / 2 + 25, py + 6, 5, h - 46);
        roof(px + w / 2 - 34, py - 10, 68, 24, '#8c3a26', '#6e2d1d');
        ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + w / 2, py + 14); ctx.lineTo(px + w / 2, py + 34); ctx.stroke();
        drawEmo('🪣', px + w / 2, py + 40, 14);
        break;
      }
      case 'fogueira': {
        const cx = px + TS / 2, cy = py + TS / 2 + 6;
        ctx.fillStyle = '#777'; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 14, cy + Math.sin(a) * 7, 4, 0, 7); ctx.fill(); }
        ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - 12, cy + 4); ctx.lineTo(cx + 12, cy - 4); ctx.moveTo(cx - 12, cy - 4); ctx.lineTo(cx + 12, cy + 4); ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const f = Math.sin(t * 10 + i * 2) * 3;
          ctx.fillStyle = ['#ff6a1a', '#ffa41a', '#ffe14d'][i];
          ctx.beginPath(); ctx.moveTo(cx - 10 + i * 3, cy); ctx.quadraticCurveTo(cx + f, cy - 30 + i * 7, cx + 10 - i * 3, cy); ctx.fill();
        }
        break;
      }
      case 'defumador': {
        const cx = px + TS / 2;
        ctx.fillStyle = '#8e8679'; ctx.beginPath(); ctx.moveTo(px + 4, py + TS - 2); ctx.lineTo(px + 8, py + 6); ctx.lineTo(px + TS - 8, py + 6); ctx.lineTo(px + TS - 4, py + TS - 2); ctx.fill();
        ctx.fillStyle = '#2b1c10'; ctx.beginPath(); ctx.arc(cx, py + TS - 6, 9, Math.PI, 0); ctx.fill();
        ctx.fillStyle = `rgba(255,${120 + Math.sin(t * 8) * 40},40,0.9)`; ctx.fillRect(cx - 6, py + TS - 8, 12, 4);
        ctx.fillStyle = '#6e675c'; ctx.fillRect(cx - 5, py - 8, 10, 16);
        for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; ctx.fillStyle = `rgba(200,200,200,${0.5 - k * 0.5})`; ctx.beginPath(); ctx.arc(cx + Math.sin(k * 6 + i) * 5, py - 10 - k * 30, 4 + k * 6, 0, 7); ctx.fill(); }
        break;
      }
      case 'composteira': {
        ctx.fillStyle = '#7a5530'; ctx.fillRect(px + 4, py + 10, w - 8, h - 12);
        ctx.fillStyle = '#5a3d22'; for (let i = 0; i < 4; i++) ctx.fillRect(px + 4, py + 14 + i * 7, w - 8, 2);
        ctx.fillStyle = b.data.ready ? '#3d2a14' : '#4f6b2a'; ctx.beginPath(); ctx.ellipse(px + w / 2, py + 12, w / 2 - 8, 6, 0, 0, 7); ctx.fill();
        if (b.data.ready) drawEmo('🟫', px + w / 2, py - 4, 16);
        else if (b.data.batches.length) { ctx.fillStyle = 'rgba(230,230,230,0.4)'; ctx.beginPath(); ctx.arc(px + w / 2 + Math.sin(t) * 4, py - (t * 8 % 14), 4, 0, 7); ctx.fill(); }
        break;
      }
      case 'cocho': {
        ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 8, py + TS - 12, 6, 10); ctx.fillRect(px + w - 14, py + TS - 12, 6, 10);
        ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.moveTo(px + 2, py + 14); ctx.lineTo(px + w - 2, py + 14); ctx.lineTo(px + w - 8, py + TS - 10); ctx.lineTo(px + 8, py + TS - 10); ctx.fill();
        const lvl = Math.min(1, b.data.feed / 60);
        if (lvl > 0) { ctx.fillStyle = '#d9b44a'; ctx.fillRect(px + 6, py + 16 + (1 - lvl) * 10, w - 12, 4 + lvl * 6); }
        break;
      }
      case 'moinho': {
        ctx.fillStyle = '#b9b2a2'; ctx.beginPath(); ctx.moveTo(px + 14, py + h - 2); ctx.lineTo(px + 22, py + 10); ctx.lineTo(px + w - 22, py + 10); ctx.lineTo(px + w - 14, py + h - 2); ctx.fill();
        roof(px + 18, py - 8, w - 36, 22, '#7a4a28', '#5e381e');
        ctx.fillStyle = '#5a3a1f'; ctx.fillRect(px + w / 2 - 8, py + h - 22, 16, 20);
        ctx.save(); ctx.translate(px + w / 2, py + 22); ctx.rotate(t * 0.8);
        ctx.fillStyle = '#efe6d2'; ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-4, -40, 8, 36); ctx.strokeRect(-4, -40, 8, 36); }
        ctx.restore();
        ctx.fillStyle = '#5a3a1f'; ctx.beginPath(); ctx.arc(px + w / 2, py + 22, 4, 0, 7); ctx.fill();
        break;
      }
      case 'colmeia': {
        const cx = px + TS / 2;
        ctx.fillStyle = '#6b4423'; ctx.fillRect(cx - 2, py + TS - 14, 4, 12);
        ctx.fillStyle = '#e8b33c'; ctx.fillRect(cx - 14, py + 6, 28, 22);
        ctx.fillStyle = '#c99320'; ctx.fillRect(cx - 14, py + 13, 28, 2); ctx.fillRect(cx - 14, py + 20, 28, 2);
        ctx.fillStyle = '#8c5a1a'; ctx.fillRect(cx - 16, py + 2, 32, 5);
        for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 18, py + 10 + Math.sin(a * 1.3) * 12, 2, 0, 7); ctx.fill(); }
        if (b.data.mel) drawEmo('🍯', cx + 14, py, 12);
        break;
      }
      case 'cerca': {
        const has = (dx, dy) => { const o = G.tile(b.x + dx, b.y + dy); if (!o || !o.o || o.o.t !== 'b') return false; const ob = G.getBuilding(o.o.id); return ob && ob.type === 'cerca'; };
        const cx = px + TS / 2, cy = py + TS / 2;
        ctx.fillStyle = '#a0703f';
        if (has(1, 0)) { ctx.fillRect(cx, cy - 6, TS / 2 + 1, 4); ctx.fillRect(cx, cy + 4, TS / 2 + 1, 4); }
        if (has(-1, 0)) { ctx.fillRect(px, cy - 6, TS / 2, 4); ctx.fillRect(px, cy + 4, TS / 2, 4); }
        if (has(0, 1)) ctx.fillRect(cx - 2, cy, 4, TS / 2 + 1);
        if (has(0, -1)) ctx.fillRect(cx - 2, py, 4, TS / 2);
        ctx.fillStyle = '#7a5230'; ctx.fillRect(cx - 4, cy - 14, 8, 26);
        ctx.fillStyle = '#c08a50'; ctx.fillRect(cx - 4, cy - 14, 8, 3);
        break;
      }
    }
  }

  // ---------- animais e jogador ----------
  function drawAnimal(a) {
    const def = D.animals[a.type];
    const adult = a.age >= def.adult;
    const px = a.x * TS - cam.x, py = a.y * TS - cam.y;
    const size = adult ? (a.type === 'galinha' ? 26 : 34) : (a.type === 'galinha' ? 18 : 24);
    const bob = a.moving ? Math.abs(Math.sin(t * 10 + a.id)) * 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(px, py + 2, size * 0.4, size * 0.15, 0, 0, 7); ctx.fill();
    drawEmo(adult ? def.i : def.bi, px, py - size * 0.4 - bob, size, a.face > 0);
    if (a.ready) drawEmo(D.items[def.produce.item].i, px, py - size - 10 + Math.sin(t * 4) * 2, 14);
    else if (a.hungry) drawEmo('❗', px, py - size - 8, 12);
  }

  function drawPlayer() {
    const p = S.player;
    const px = p.x * TS - cam.x, py = p.y * TS - cam.y;
    const walk = p.moving ? Math.sin(t * 14) : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px, py + 2, 12, 5, 0, 0, 7); ctx.fill();
    // pernas
    ctx.fillStyle = '#3b4a6b';
    ctx.fillRect(px - 7, py - 14, 6, 14 + walk * 2); ctx.fillRect(px + 1, py - 14, 6, 14 - walk * 2);
    ctx.fillStyle = '#4a2f1c'; ctx.fillRect(px - 8, py - 2 + walk * 2, 7, 4); ctx.fillRect(px + 1, py - 2 - walk * 2, 7, 4);
    // corpo
    ctx.fillStyle = '#d9534f'; ctx.fillRect(px - 10, py - 32, 20, 20);
    ctx.fillStyle = '#b8403c'; for (let i = 0; i < 3; i++) ctx.fillRect(px - 10, py - 28 + i * 6, 20, 2);
    // macacão
    ctx.fillStyle = '#4b6fa5'; ctx.fillRect(px - 9, py - 22, 18, 10); ctx.fillRect(px - 7, py - 32, 3, 10); ctx.fillRect(px + 4, py - 32, 3, 10);
    // braços
    const arm = (G.swing > 0 ? -Math.sin(G.swing * 12) * 6 : walk * 3);
    ctx.fillStyle = '#e8b98f'; ctx.fillRect(px - 14, py - 30 + arm, 5, 14); ctx.fillRect(px + 9, py - 30 - arm, 5, 14);
    // cabeça
    ctx.fillStyle = '#e8b98f'; ctx.beginPath(); ctx.arc(px, py - 40, 9, 0, 7); ctx.fill();
    if (p.dir !== 'up') {
      ctx.fillStyle = '#2b2b2b';
      const ox = p.dir === 'left' ? -4 : p.dir === 'right' ? 4 : 0;
      if (p.dir !== 'right') ctx.fillRect(px - 4 + ox, py - 41, 2, 3);
      if (p.dir !== 'left') ctx.fillRect(px + 2 + ox, py - 41, 2, 3);
    }
    // chapéu de palha
    ctx.fillStyle = '#e4c26a'; ctx.beginPath(); ctx.ellipse(px, py - 46, 15, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d6ae4f'; ctx.fillRect(px - 8, py - 55, 16, 9);
    ctx.fillStyle = '#b5452f'; ctx.fillRect(px - 8, py - 49, 16, 3);
    // ferramenta em uso
    if (G.swing > 0) {
      const tool = D.tools[S.tool];
      const ic = tool.id === 'item' && S.held ? D.items[S.held].i : tool.i;
      const ang = (1 - G.swing / 0.3) * 1.8 - 0.9;
      const fx = p.dir === 'left' ? -1 : 1;
      ctx.save(); ctx.translate(px + fx * 14, py - 28); ctx.rotate(ang * fx);
      drawEmo(ic, fx * 8, -10, 20, fx < 0); ctx.restore();
    }
    if (p.sick > 0) drawEmo('🤢', px + 14, py - 56, 12);
  }

  // ---------- noite e luz ----------
  function darkness() {
    const m = S.time;
    if (m < 390) return 0.35 * (1 - (m - 360) / 30);
    if (m < 1050) return S.weather === 'chuva' ? 0.12 : 0;
    if (m < 1230) return 0.12 + (m - 1050) / 180 * 0.55;
    return 0.67;
  }

  function drawLighting(dark) {
    if (dark <= 0.01) return;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H);
    lctx.fillStyle = `rgba(12,18,48,${dark})`;
    lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'destination-out';
    const glow = (x, y, r, a) => {
      const g = lctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.beginPath(); lctx.arc(x, y, r, 0, 7); lctx.fill();
    };
    const p = S.player;
    glow(p.x * TS - cam.x, p.y * TS - cam.y - 20, TS * 2.6, 0.75);
    for (const b of S.buildings) {
      const def = D.buildings[b.type];
      const bx = (b.x + def.w / 2) * TS - cam.x, by = (b.y + def.h / 2) * TS - cam.y;
      if (bx < -300 || by < -300 || bx > W + 300 || by > H + 300) continue;
      if (def.light) glow(bx, by, TS * def.light * (0.95 + Math.sin(t * 9) * 0.05), 0.95);
      if (b.type === 'casa') glow(bx, by + 20, TS * 3, 0.7);
      if (b.type === 'loja') glow(bx, by, TS * 2, 0.5);
    }
    ctx.drawImage(light, 0, 0, W, H);
    // brilho quente da fogueira
    ctx.globalCompositeOperation = 'lighter';
    for (const b of S.buildings) {
      if (b.type !== 'fogueira') continue;
      const bx = (b.x + 0.5) * TS - cam.x, by = (b.y + 0.5) * TS - cam.y;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, TS * 3);
      g.addColorStop(0, `rgba(255,140,40,${0.25 * dark})`); g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, TS * 3, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const drops = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 }));
  function drawRain(dt) {
    if (S.weather !== 'chuva') return;
    ctx.strokeStyle = 'rgba(180,200,255,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const d of drops) {
      d.y += dt * 1.6 * d.s; d.x += dt * 0.15;
      if (d.y > 1) { d.y = 0; d.x = Math.random(); }
      if (d.x > 1) d.x -= 1;
      const x = d.x * W, y = d.y * H;
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14 * d.s);
    }
    ctx.stroke();
  }

  // ---------- quadro ----------
  function frame(dt, target, ghost) {
    t += dt;
    const p = S.player;
    let tx = p.x * TS - W / 2, ty = p.y * TS - H / 2;
    tx = Math.max(-TS * 2, Math.min(G.W * TS - W + TS * 2, tx));
    ty = Math.max(-TS * 2, Math.min(G.H * TS - H + TS * 2, ty));
    camF.x += (tx - camF.x) * Math.min(1, dt * 8); camF.y += (ty - camF.y) * Math.min(1, dt * 8);
    cam.x = camF.x; cam.y = camF.y;
    if (G.shake > 0) { G.shake -= dt; cam.x += (Math.random() - 0.5) * 4; cam.y += (Math.random() - 0.5) * 4; }

    cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2a3b25'; ctx.fillRect(0, 0, W, H);
    const x0 = Math.max(0, Math.floor(cam.x / TS) - 1), y0 = Math.max(0, Math.floor(cam.y / TS) - 1);
    const x1 = Math.min(G.W - 1, Math.ceil((cam.x + W) / TS) + 1), y1 = Math.min(G.H - 1, Math.ceil((cam.y + H) / TS) + 2);

    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawGround(x, y, S.tiles[G.idx(x, y)], x * TS - cam.x, y * TS - cam.y);

    // alvo
    if (target) {
      const px = target.x * TS - cam.x, py = target.y * TS - cam.y;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 20;
      ctx.strokeRect(px + 2, py + 2, TS - 4, TS - 4); ctx.setLineDash([]);
    }

    // camadas por linha (profundidade)
    const drawn = new Set();
    const animalsByRow = new Map();
    for (const a of S.animals) { if (a.inside) continue; const r = Math.floor(a.y); if (!animalsByRow.has(r)) animalsByRow.set(r, []); animalsByRow.get(r).push(a); }
    const prow = Math.floor(p.y);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tile = S.tiles[G.idx(x, y)], px = x * TS - cam.x, py = y * TS - cam.y;
        if (tile.c) drawCrop(px, py, tile.c, x, y);
        const o = tile.o;
        if (!o) continue;
        if (o.t === 'weed') drawWeed(px, py, o, x, y);
        else if (o.t === 'rock') drawRock(px, py, o, x);
        else if (o.t === 'tree') drawTree(px, py, o, x, y);
        else if (o.t === 'fruit') drawFruitTree(px, py, o, x, y);
        else if (o.t === 'b' && !drawn.has(o.id)) {
          const b = G.getBuilding(o.id);
          if (b && y === b.y + D.buildings[b.type].h - 1) { drawn.add(o.id); drawBuilding(b); }
        }
      }
      // construções que começam acima da tela
      (animalsByRow.get(y) || []).sort((a, b) => a.y - b.y).forEach(drawAnimal);
      if (y === prow) drawPlayer();
    }
    for (const b of S.buildings) if (!drawn.has(b.id)) { const def = D.buildings[b.type]; if (b.y + def.h - 1 > y1 && b.y <= y1 + 3) drawBuilding(b); }

    // fantasma de construção
    if (ghost) {
      const def = D.buildings[ghost.type];
      ctx.fillStyle = ghost.ok ? 'rgba(120,255,120,0.3)' : 'rgba(255,80,80,0.35)';
      ctx.fillRect(ghost.x * TS - cam.x, ghost.y * TS - cam.y, def.w * TS, def.h * TS);
      drawEmo(def.i || '🏠', (ghost.x + def.w / 2) * TS - cam.x, (ghost.y + def.h / 2) * TS - cam.y, 26);
    }

    // terras não compradas
    for (const lot of D.lots) {
      if (S.lots[lot.id]) continue;
      const lx = lot.x * TS - cam.x, ly = lot.y * TS - cam.y, lw = lot.w * TS, lh = lot.h * TS;
      if (lx > W || ly > H || lx + lw < 0 || ly + lh < 0) continue;
      ctx.fillStyle = 'rgba(15,20,30,0.55)'; ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = 'rgba(255,230,150,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.strokeRect(lx + 2, ly + 2, lw - 4, lh - 4); ctx.setLineDash([]);
      const cx = Math.max(lx + 120, Math.min(lx + lw - 120, W / 2)), cy = Math.max(ly + 50, Math.min(ly + lh - 50, H / 2));
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - 110, cy - 30, 220, 60);
      ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🔒 ' + lot.n, cx, cy - 6);
      ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
      ctx.fillText(`À venda: 💰 ${lot.cost} · tecla T`, cx, cy + 16);
    }

    // partículas e textos
    for (const q of G.particles) { ctx.fillStyle = q.color; ctx.globalAlpha = Math.max(0, q.life); ctx.fillRect(q.x * TS - cam.x - 2, q.y * TS - cam.y - 2, 4, 4); }
    ctx.globalAlpha = 1;
    drawLighting(darkness());
    drawRain(dt);
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    for (const f of G.popups) {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(f.text, f.x * TS - cam.x + 1, f.y * TS - cam.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x * TS - cam.x, f.y * TS - cam.y);
    }
    ctx.globalAlpha = 1;
  }

  // mini-mapa para o painel de terras
  function minimap(canvas) {
    const c = canvas.getContext('2d'), s = canvas.width / G.W;
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const tl = S.tiles[G.idx(x, y)];
      let col = tl.g === 'water' ? '#3a8fd1' : tl.g === 'sand' ? '#e3cf8f' : tl.g === 'tilled' ? '#8a5f3a' : '#6fbf4f';
      if (tl.o) col = tl.o.t === 'tree' ? '#2f7a33' : tl.o.t === 'rock' ? '#999' : tl.o.t === 'b' ? '#b5452f' : tl.o.t === 'fruit' ? '#e8a33c' : col;
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

  return { TS, init, frame, screenToWorld, minimap, emo };
})();
