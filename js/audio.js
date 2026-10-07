/*
 * EcoLand - Sistema de Áudio (js/audio.js)
 * ------------------------------------------------------------------
 * Todos os sons são sintetizados proceduralmente com a Web Audio API
 * (osciladores, buffers de ruído, filtros e envelopes). Nenhum arquivo
 * externo é carregado. Qualquer erro de áudio é capturado e ignorado
 * para nunca travar o jogo.
 *
 * API global: window.SFX
 *
 *   SFX.init()                 Cria (ou retoma) o AudioContext. Deve ser
 *                              chamado a partir de um gesto do usuário
 *                              (clique/tecla). Pode ser chamado várias vezes.
 *   SFX.play(nome, opts?)      Toca um efeito curto. Nomes desconhecidos são
 *                              ignorados. Sem init(), não faz nada.
 *                              opts: { volume: 0..1 }
 *   SFX.setVolume(v)           Volume geral (0..1).
 *   SFX.setMuted(bool)         Silencia / reativa tudo.
 *   SFX.muted                  (boolean) estado atual do mudo.
 *   SFX.toggleMute()           Alterna o mudo e retorna o novo estado.
 *   SFX.has(nome)              true se o efeito existir.
 *   SFX.names                  Lista de efeitos disponíveis.
 *
 *   SFX.music.start()          Inicia a música procedural (pastoral, pentatônica).
 *   SFX.music.stop()           Para a música.
 *   SFX.music.setMode(m)       'day' | 'night' | 'rain'
 *                              night = mais lenta, suave e grave
 *                              rain  = adiciona uma cama de chuva suave
 *   SFX.music.setVolume(v)     Volume da música (0..1, padrão 1 => ganho ~0.08).
 *   SFX.music.playing          (boolean)  SFX.music.mode (string)
 *
 *   SFX.ambient(nome, on, vol?) Loops ambientes: 'rain' (chuva), 'fire'
 *                              (crepitar). Chamar de novo só ajusta o volume,
 *                              nunca duplica.
 *
 * Efeitos: step, hoe, water, chop, treefall, pick, rockbreak, scythe, plant,
 *   harvest, pickup, coin, buy, error, eat, drink, chicken, cow, pig, sheep,
 *   slaughter, craft, cook, place, quest, sleep, morning, ui, open, close,
 *   refill, levelup, unlock, hurt, rain_start
 */
(function () {
  'use strict';

  var ctx = null;
  var master = null, comp = null, sfxBus = null, musicBus = null, ambBus = null;
  var noiseBuf = null;
  var masterVolume = 0.8;
  var lastPlayed = {};
  var activeVoices = 0;
  var MAX_VOICES = 24;

  var THROTTLE = {
    step: 120, ui: 40, pickup: 50, coin: 60, chop: 80, pick: 80, hoe: 80,
    scythe: 90, water: 120, error: 150, eat: 150, drink: 150, chicken: 300,
    cow: 900, pig: 500, sheep: 700, cook: 200, plant: 60, harvest: 60, hurt: 150,
    rain_start: 1500, refill: 300
  };

  function now() { return ctx ? ctx.currentTime : 0; }
  function clamp(v, a, b) { v = +v; if (isNaN(v)) v = a; return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function getNoise() {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function init() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        comp = ctx.createDynamicsCompressor();
        try {
          comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4;
          comp.attack.value = 0.005; comp.release.value = 0.2;
        } catch (e) {}
        master = ctx.createGain();
        master.gain.value = SFX.muted ? 0 : masterVolume;
        master.connect(comp);
        comp.connect(ctx.destination);
        sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.08 * music._vol; musicBus.connect(master);
        ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
        getNoise();
      }
      if (ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
      if (music._wantPlaying && !music._timer) music._begin();
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- primitivas ---------------- */

  function voiceEnd(node, t) {
    activeVoices++;
    node.onended = function () { activeVoices = Math.max(0, activeVoices - 1); };
  }

  // Tom com envelope. o: {type, vol, attack, dur, freqEnd, delay, filter, filterQ, dest, detune}
  function tone(freq, o) {
    o = o || {};
    var t = now() + (o.delay || 0);
    var dur = o.dur || 0.2;
    var atk = o.attack != null ? o.attack : 0.005;
    var vol = (o.vol != null ? o.vol : 0.3) * (o._mul || 1);
    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(1, freq), t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var last = osc;
    if (o.filter) {
      var f = ctx.createBiquadFilter();
      f.type = o.filterType || 'lowpass';
      f.frequency.setValueAtTime(o.filter, t);
      if (o.filterEnd) f.frequency.exponentialRampToValueAtTime(o.filterEnd, t + dur);
      f.Q.value = o.filterQ || 0.7;
      osc.connect(f); last = f;
    }
    last.connect(g);
    g.connect(o.dest || sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    voiceEnd(osc);
    return { osc: osc, gain: g, t: t };
  }

  // Ruído filtrado. o: {vol, dur, attack, type, freq, freqEnd, Q, delay, dest}
  function noise(o) {
    o = o || {};
    var t = now() + (o.delay || 0);
    var dur = o.dur || 0.2;
    var atk = o.attack != null ? o.attack : 0.003;
    var vol = (o.vol != null ? o.vol : 0.3) * (o._mul || 1);
    var src = ctx.createBufferSource();
    src.buffer = getNoise();
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + dur);
    f.Q.value = o.Q != null ? o.Q : 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    voiceEnd(src);
    return { src: src, filter: f, gain: g, t: t };
  }

  // Arpejo simples
  function arp(freqs, step, o) {
    for (var i = 0; i < freqs.length; i++) {
      var oo = {};
      for (var k in o) oo[k] = o[k];
      oo.delay = (o.delay || 0) + i * step;
      tone(freqs[i], oo);
    }
  }

  // Nota musical (MIDI -> Hz)
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---------------- efeitos ---------------- */
  // Cada função recebe m = multiplicador de volume
  var FX = {
    step: function (m) {
      noise({ _mul: m, vol: 0.06, dur: 0.07, type: 'lowpass', freq: rand(500, 900), Q: 0.5 });
      noise({ _mul: m, vol: 0.025, dur: 0.05, type: 'highpass', freq: 3000, delay: 0.01 });
    },
    hoe: function (m) {
      tone(110, { _mul: m, type: 'sine', vol: 0.35, dur: 0.18, freqEnd: 55 });
      noise({ _mul: m, vol: 0.25, dur: 0.16, type: 'lowpass', freq: 900, freqEnd: 200 });
      noise({ _mul: m, vol: 0.06, dur: 0.12, type: 'bandpass', freq: 2500, Q: 1, delay: 0.03 });
    },
    water: function (m) {
      noise({ _mul: m, vol: 0.18, dur: 0.45, attack: 0.04, type: 'bandpass', freq: 1200, freqEnd: 2600, Q: 1.5 });
      for (var i = 0; i < 5; i++) {
        tone(rand(500, 1100), { _mul: m, type: 'sine', vol: 0.06, dur: 0.07, freqEnd: rand(1200, 1800), delay: i * 0.06 + rand(0, 0.03) });
      }
    },
    chop: function (m) {
      tone(rand(280, 320), { _mul: m, type: 'triangle', vol: 0.3, dur: 0.12, freqEnd: 140 });
      noise({ _mul: m, vol: 0.3, dur: 0.09, type: 'bandpass', freq: 1800, Q: 2 });
      tone(170, { _mul: m, type: 'sine', vol: 0.25, dur: 0.2, freqEnd: 90, delay: 0.005 });
    },
    treefall: function (m) {
      for (var i = 0; i < 6; i++) {
        noise({ _mul: m, vol: 0.18, dur: 0.05, type: 'bandpass', freq: rand(1500, 3000), Q: 3, delay: i * rand(0.03, 0.07) });
      }
      noise({ _mul: m, vol: 0.2, dur: 0.6, attack: 0.2, type: 'bandpass', freq: 600, freqEnd: 300, Q: 0.8, delay: 0.2 });
      tone(80, { _mul: m, type: 'sine', vol: 0.5, dur: 0.6, freqEnd: 35, delay: 0.75 });
      noise({ _mul: m, vol: 0.35, dur: 0.5, type: 'lowpass', freq: 500, freqEnd: 120, delay: 0.75 });
    },
    pick: function (m) {
      var f = rand(1700, 2100);
      tone(f, { _mul: m, type: 'triangle', vol: 0.18, dur: 0.22 });
      tone(f * 2.76, { _mul: m, type: 'sine', vol: 0.06, dur: 0.12 });
      noise({ _mul: m, vol: 0.2, dur: 0.05, type: 'highpass', freq: 2500 });
    },
    rockbreak: function (m) {
      noise({ _mul: m, vol: 0.4, dur: 0.35, type: 'lowpass', freq: 1800, freqEnd: 200, Q: 0.7 });
      tone(120, { _mul: m, type: 'sine', vol: 0.35, dur: 0.3, freqEnd: 50 });
      for (var i = 0; i < 6; i++) {
        noise({ _mul: m, vol: 0.1, dur: 0.04, type: 'bandpass', freq: rand(2000, 4000), Q: 4, delay: 0.05 + i * rand(0.03, 0.06) });
      }
    },
    scythe: function (m) {
      noise({ _mul: m, vol: 0.16, dur: 0.22, attack: 0.08, type: 'bandpass', freq: 1500, freqEnd: 5000, Q: 2 });
      noise({ _mul: m, vol: 0.05, dur: 0.12, type: 'highpass', freq: 4000, delay: 0.12 });
    },
    plant: function (m) {
      tone(300, { _mul: m, type: 'sine', vol: 0.25, dur: 0.12, freqEnd: 600, glide: 0.06 });
      noise({ _mul: m, vol: 0.08, dur: 0.08, type: 'lowpass', freq: 700 });
    },
    harvest: function (m) {
      tone(400, { _mul: m, type: 'sine', vol: 0.25, dur: 0.12, freqEnd: 800, glide: 0.05 });
      arp([mtof(84), mtof(88), mtof(91), mtof(96)], 0.05, { _mul: m, type: 'triangle', vol: 0.09, dur: 0.25, delay: 0.06 });
    },
    pickup: function (m) {
      tone(880, { _mul: m, type: 'square', vol: 0.06, dur: 0.08, filter: 3000 });
      tone(1320, { _mul: m, type: 'square', vol: 0.06, dur: 0.1, filter: 3000, delay: 0.05 });
    },
    coin: function (m) {
      tone(mtof(83), { _mul: m, type: 'square', vol: 0.07, dur: 0.08, filter: 4000 });
      tone(mtof(88), { _mul: m, type: 'square', vol: 0.07, dur: 0.35, filter: 4000, delay: 0.07 });
      tone(mtof(100), { _mul: m, type: 'sine', vol: 0.04, dur: 0.3, delay: 0.07 });
    },
    buy: function (m) {
      tone(mtof(76), { _mul: m, type: 'triangle', vol: 0.15, dur: 0.12 });
      tone(mtof(83), { _mul: m, type: 'triangle', vol: 0.15, dur: 0.12, delay: 0.08 });
      tone(mtof(79), { _mul: m, type: 'triangle', vol: 0.15, dur: 0.25, delay: 0.16 });
      noise({ _mul: m, vol: 0.05, dur: 0.1, type: 'highpass', freq: 5000, delay: 0.16 });
    },
    error: function (m) {
      tone(160, { _mul: m, type: 'sawtooth', vol: 0.09, dur: 0.12, filter: 600 });
      tone(120, { _mul: m, type: 'sawtooth', vol: 0.09, dur: 0.2, filter: 500, delay: 0.12 });
    },
    eat: function (m) {
      for (var i = 0; i < 3; i++) {
        noise({ _mul: m, vol: 0.2, dur: 0.07, type: 'bandpass', freq: rand(1200, 2500), Q: 1.5, delay: i * 0.13 });
        noise({ _mul: m, vol: 0.12, dur: 0.06, type: 'lowpass', freq: 400, delay: i * 0.13 + 0.01 });
      }
    },
    drink: function (m) {
      for (var i = 0; i < 2; i++) {
        tone(250, { _mul: m, type: 'sine', vol: 0.25, dur: 0.12, freqEnd: 600, glide: 0.08, delay: i * 0.25 });
        noise({ _mul: m, vol: 0.06, dur: 0.1, type: 'lowpass', freq: 500, delay: i * 0.25 });
      }
    },
    chicken: function (m) {
      var n = 2 + Math.floor(Math.random() * 2);
      for (var i = 0; i < n; i++) {
        var f = rand(700, 900);
        tone(f, { _mul: m, type: 'square', vol: 0.06, dur: 0.07, freqEnd: f * 1.4, glide: 0.03, filter: 2000, filterType: 'bandpass', filterQ: 2, delay: i * 0.11 });
      }
    },
    cow: function (m) {
      var t = now();
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.linearRampToValueAtTime(130, t + 0.25);
      osc.frequency.linearRampToValueAtTime(95, t + 1.0);
      var f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
      f1.frequency.setValueAtTime(300, t); f1.frequency.linearRampToValueAtTime(700, t + 0.35); f1.frequency.linearRampToValueAtTime(400, t + 1.0);
      var f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6;
      f2.frequency.setValueAtTime(900, t); f2.frequency.linearRampToValueAtTime(1100, t + 0.4); f2.frequency.linearRampToValueAtTime(800, t + 1.0);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5 * m, t + 0.15);
      g.gain.linearRampToValueAtTime(0.4 * m, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
      var g2 = ctx.createGain(); g2.gain.value = 0.4;
      osc.connect(f1); osc.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g); g.connect(sfxBus);
      osc.start(t); osc.stop(t + 1.1);
      voiceEnd(osc);
    },
    pig: function (m) {
      for (var i = 0; i < 2; i++) {
        var d = i * 0.17;
        tone(220, { _mul: m, type: 'sawtooth', vol: 0.18, dur: 0.12, freqEnd: 160, filter: 900, filterType: 'bandpass', filterQ: 3, delay: d });
        noise({ _mul: m, vol: 0.08, dur: 0.1, type: 'bandpass', freq: 600, Q: 3, delay: d });
      }
    },
    sheep: function (m) {
      var t = now();
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, t);
      osc.frequency.linearRampToValueAtTime(300, t + 0.6);
      var lfo = ctx.createOscillator(); lfo.frequency.value = 18;
      var lg = ctx.createGain(); lg.gain.value = 14;
      lfo.connect(lg); lg.connect(osc.frequency);
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
      f.frequency.setValueAtTime(800, t); f.frequency.linearRampToValueAtTime(1300, t + 0.15);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.25 * m, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      osc.connect(f); f.connect(g); g.connect(sfxBus);
      osc.start(t); lfo.start(t); osc.stop(t + 0.7); lfo.stop(t + 0.7);
      voiceEnd(osc);
    },
    slaughter: function (m) {
      tone(90, { _mul: m, type: 'sine', vol: 0.4, dur: 0.25, freqEnd: 45 });
      noise({ _mul: m, vol: 0.15, dur: 0.15, type: 'lowpass', freq: 400 });
      tone(mtof(64), { _mul: m, type: 'sine', vol: 0.05, dur: 0.5, delay: 0.25 });
    },
    craft: function (m) {
      for (var i = 0; i < 3; i++) {
        var d = i * 0.16;
        tone(rand(900, 1100), { _mul: m, type: 'triangle', vol: 0.14, dur: 0.12, delay: d });
        noise({ _mul: m, vol: 0.15, dur: 0.05, type: 'bandpass', freq: 2500, Q: 2, delay: d });
        tone(200, { _mul: m, type: 'sine', vol: 0.15, dur: 0.1, freqEnd: 100, delay: d });
      }
      tone(mtof(84), { _mul: m, type: 'triangle', vol: 0.08, dur: 0.3, delay: 0.5 });
    },
    cook: function (m) {
      noise({ _mul: m, vol: 0.12, dur: 0.8, attack: 0.05, type: 'highpass', freq: 3000, Q: 0.5 });
      for (var i = 0; i < 8; i++) {
        noise({ _mul: m, vol: 0.06, dur: 0.02, type: 'bandpass', freq: rand(3000, 6000), Q: 3, delay: rand(0, 0.7) });
      }
    },
    place: function (m) {
      tone(140, { _mul: m, type: 'sine', vol: 0.4, dur: 0.25, freqEnd: 60 });
      noise({ _mul: m, vol: 0.2, dur: 0.15, type: 'lowpass', freq: 800, freqEnd: 200 });
      tone(mtof(79), { _mul: m, type: 'triangle', vol: 0.06, dur: 0.2, delay: 0.1 });
    },
    quest: function (m) {
      arp([mtof(72), mtof(76), mtof(79), mtof(84)], 0.09, { _mul: m, type: 'triangle', vol: 0.15, dur: 0.3 });
      tone(mtof(88), { _mul: m, type: 'triangle', vol: 0.12, dur: 0.7, delay: 0.38 });
      tone(mtof(84), { _mul: m, type: 'sine', vol: 0.08, dur: 0.7, delay: 0.38 });
      for (var i = 0; i < 4; i++) tone(mtof(96 + i * 2), { _mul: m, type: 'sine', vol: 0.03, dur: 0.2, delay: 0.45 + i * 0.05 });
    },
    sleep: function (m) {
      arp([mtof(84), mtof(81), mtof(76), mtof(72), mtof(69)], 0.22, { _mul: m, type: 'sine', vol: 0.1, dur: 0.9, attack: 0.02 });
    },
    morning: function (m) {
      arp([mtof(72), mtof(76), mtof(79), mtof(84), mtof(88)], 0.1, { _mul: m, type: 'triangle', vol: 0.1, dur: 0.6 });
      tone(mtof(91), { _mul: m, type: 'sine', vol: 0.06, dur: 1.0, delay: 0.5 });
    },
    ui: function (m) {
      tone(1200, { _mul: m, type: 'sine', vol: 0.08, dur: 0.04 });
    },
    open: function (m) {
      tone(600, { _mul: m, type: 'triangle', vol: 0.1, dur: 0.1, freqEnd: 1000, glide: 0.07 });
      noise({ _mul: m, vol: 0.03, dur: 0.08, type: 'bandpass', freq: 2000, Q: 1 });
    },
    close: function (m) {
      tone(1000, { _mul: m, type: 'triangle', vol: 0.1, dur: 0.1, freqEnd: 550, glide: 0.07 });
      noise({ _mul: m, vol: 0.03, dur: 0.08, type: 'bandpass', freq: 1200, Q: 1 });
    },
    refill: function (m) {
      noise({ _mul: m, vol: 0.12, dur: 0.9, attack: 0.1, type: 'bandpass', freq: 800, freqEnd: 2200, Q: 2 });
      tone(300, { _mul: m, type: 'sine', vol: 0.06, dur: 0.9, freqEnd: 900, attack: 0.1 });
      for (var i = 0; i < 6; i++) tone(rand(600, 1400), { _mul: m, type: 'sine', vol: 0.04, dur: 0.06, delay: 0.1 + i * 0.12 });
    },
    levelup: function (m) {
      var seq = [72, 76, 79, 84, 79, 84, 88];
      var t = [0, 0.1, 0.2, 0.3, 0.45, 0.55, 0.7];
      for (var i = 0; i < seq.length; i++) {
        tone(mtof(seq[i]), { _mul: m, type: 'square', vol: 0.06, dur: i === seq.length - 1 ? 0.8 : 0.15, filter: 2500, delay: t[i] });
        tone(mtof(seq[i] - 12), { _mul: m, type: 'triangle', vol: 0.08, dur: i === seq.length - 1 ? 0.8 : 0.15, delay: t[i] });
      }
      for (var j = 0; j < 6; j++) tone(mtof(96 + j), { _mul: m, type: 'sine', vol: 0.025, dur: 0.15, delay: 0.75 + j * 0.05 });
    },
    hurt: function (m) {
      tone(150, { _mul: m, type: 'sine', vol: 0.4, dur: 0.2, freqEnd: 60 });
      tone(200, { _mul: m, type: 'sawtooth', vol: 0.06, dur: 0.15, freqEnd: 90, filter: 500 });
      noise({ _mul: m, vol: 0.12, dur: 0.1, type: 'lowpass', freq: 600 });
    },
    rain_start: function (m) {
      noise({ _mul: m, vol: 0.25, dur: 0.15, type: 'lowpass', freq: 2000, freqEnd: 600, Q: 0.5 });
      noise({ _mul: m, vol: 0.4, dur: 2.5, attack: 0.15, type: 'lowpass', freq: 220, freqEnd: 60, Q: 0.8, delay: 0.05 });
      tone(45, { _mul: m, type: 'sine', vol: 0.3, dur: 2.0, attack: 0.2, freqEnd: 30 });
      noise({ _mul: m, vol: 0.2, dur: 1.2, attack: 0.3, type: 'lowpass', freq: 150, delay: 0.9 });
    }
  };
  FX.unlock = FX.levelup;

  function play(name, opts) {
    try {
      if (!ctx || !sfxBus || SFX.muted) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      var fn = FX[name];
      if (!fn) return;
      var ms = Date.now();
      var th = THROTTLE[name] != null ? THROTTLE[name] : 30;
      if (lastPlayed[name] && ms - lastPlayed[name] < th) return;
      if (activeVoices > MAX_VOICES * 3 && name === 'step') return;
      if (activeVoices > MAX_VOICES * 6) return;
      lastPlayed[name] = ms;
      var m = 1;
      if (opts && opts.volume != null) m = clamp(opts.volume, 0, 1);
      if (m <= 0) return;
      fn(m);
    } catch (e) {}
  }

  /* ---------------- loops ambientes ---------------- */
  var ambients = {};

  function makeRainLoop(dest, vol) {
    var src = ctx.createBufferSource();
    src.buffer = getNoise(); src.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
    var g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.setTargetAtTime(vol, now(), 0.8);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dest);
    src.start();
    // gotas ocasionais
    var timer = setInterval(function () {
      try {
        if (!ctx || SFX.muted) return;
        if (Math.random() < 0.6) {
          noise({ vol: vol * 0.5, dur: 0.03, type: 'bandpass', freq: rand(2000, 5000), Q: 5, dest: g });
        }
      } catch (e) {}
    }, 180);
    return {
      gain: g, base: vol,
      setVol: function (v) { this.base = v; g.gain.setTargetAtTime(v, now(), 0.3); },
      stop: function () {
        clearInterval(timer);
        try { g.gain.setTargetAtTime(0.0001, now(), 0.5); src.stop(now() + 2.5); } catch (e) {}
      }
    };
  }

  function makeFireLoop(dest, vol) {
    var src = ctx.createBufferSource();
    src.buffer = getNoise(); src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    var g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.setTargetAtTime(vol * 0.4, now(), 0.3);
    var out = ctx.createGain(); out.gain.value = 1;
    src.connect(lp); lp.connect(g); g.connect(out); out.connect(dest);
    src.start();
    var obj = { base: vol };
    var timer = setInterval(function () {
      try {
        if (!ctx || SFX.muted) return;
        var n = Math.random() < 0.5 ? 1 : (Math.random() < 0.5 ? 2 : 0);
        for (var i = 0; i < n; i++) {
          noise({ vol: obj.base * rand(0.3, 0.8), dur: rand(0.01, 0.03), type: 'bandpass', freq: rand(1500, 4500), Q: rand(2, 6), delay: rand(0, 0.08), dest: out });
        }
      } catch (e) {}
    }, 90);
    obj.setVol = function (v) { obj.base = v; g.gain.setTargetAtTime(v * 0.4, now(), 0.2); };
    obj.stop = function () {
      clearInterval(timer);
      try { g.gain.setTargetAtTime(0.0001, now(), 0.2); src.stop(now() + 1.5); } catch (e) {}
    };
    return obj;
  }

  function ambient(name, on, vol) {
    try {
      if (!ctx) return;
      var cur = ambients[name];
      if (!on) {
        if (cur) { cur.stop(); delete ambients[name]; }
        return;
      }
      var defaults = { rain: 0.12, fire: 0.25 };
      if (!(name in defaults)) return;
      var v = vol != null ? clamp(vol, 0, 1) * defaults[name] * 2 : defaults[name];
      if (cur) { if (vol != null) cur.setVol(v); return; }
      ambients[name] = name === 'rain' ? makeRainLoop(ambBus, v) : makeFireLoop(ambBus, v);
    } catch (e) {}
  }

  /* ---------------- música procedural ---------------- */
  // Pentatônica de Dó maior; progressão I - vi - IV - V (C, Am, F, G)
  var PENTA = [0, 2, 4, 7, 9];
  var CHORDS = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
  var MODES = {
    day:   { stepDur: 0.32, octave: 72, density: 0.6, vol: 1.0, cutoff: 2600 },
    night: { stepDur: 0.5,  octave: 60, density: 0.38, vol: 0.65, cutoff: 1300 },
    rain:  { stepDur: 0.4,  octave: 67, density: 0.45, vol: 0.85, cutoff: 1800 }
  };

  var music = {
    _vol: 1, _timer: null, _wantPlaying: false, _next: 0, _step: 0, _bar: 0,
    _deg: 2, _rain: null, _lastPhrase: [],
    mode: 'day',
    get playing() { return !!this._timer; },

    setVolume: function (v) {
      try {
        this._vol = clamp(v, 0, 1);
        if (musicBus) musicBus.gain.setTargetAtTime(0.08 * this._vol, now(), 0.1);
      } catch (e) {}
    },
    setMode: function (m) {
      try {
        if (!MODES[m]) return;
        this.mode = m;
        if (!ctx) return;
        this._updateRain();
      } catch (e) {}
    },
    start: function () {
      try {
        this._wantPlaying = true;
        if (!ctx) return;
        this._begin();
      } catch (e) {}
    },
    stop: function () {
      try {
        this._wantPlaying = false;
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        if (this._rain) { this._rain.stop(); this._rain = null; }
      } catch (e) {}
    },
    _begin: function () {
      if (this._timer) return;
      this._next = now() + 0.15;
      this._step = 0; this._bar = 0;
      var self = this;
      this._timer = setInterval(function () { self._schedule(); }, 100);
      this._updateRain();
    },
    _updateRain: function () {
      if (this.mode === 'rain' && this._timer) {
        if (!this._rain) this._rain = makeRainLoop(musicBus, 0.9);
      } else if (this._rain) {
        this._rain.stop(); this._rain = null;
      }
    },
    _schedule: function () {
      try {
        if (!ctx) return;
        if (ctx.state !== 'running') { this._next = Math.max(this._next, now() + 0.1); return; }
        if (this._next < now() - 0.5) this._next = now() + 0.05; // aba ficou em segundo plano
        var horizon = now() + 0.35;
        while (this._next < horizon) {
          this._note(this._next);
          var md = MODES[this.mode];
          // leve swing
          var sw = (this._step % 2 === 0) ? 1.08 : 0.92;
          this._next += md.stepDur * sw;
          this._step++;
          if (this._step % 8 === 0) this._bar++;
        }
      } catch (e) {}
    },
    _pluck: function (t, freq, vol, cutoff) {
      var o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2; o2.detune.value = 4;
      var g2 = ctx.createGain(); g2.gain.value = 0.25;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(cutoff * 1.5, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.3), t + 0.6);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(musicBus);
      o1.start(t); o2.start(t); o1.stop(t + 1.2); o2.stop(t + 1.2);
    },
    _pad: function (t, notes, dur, vol) {
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.75);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
      f.connect(g); g.connect(musicBus);
      for (var i = 0; i < notes.length; i++) {
        for (var d = -1; d <= 1; d += 2) {
          var o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.value = mtof(notes[i]); o.detune.value = d * 6;
          o.connect(f); o.start(t); o.stop(t + dur + 0.4);
        }
      }
    },
    _note: function (t) {
      var md = MODES[this.mode];
      var s = this._step % 8;
      var chord = CHORDS[this._bar % 4];
      var barDur = md.stepDur * 8;
      if (s === 0) {
        this._pad(t, chord, barDur, 0.12 * md.vol);
        // baixo
        this._pluck(t, mtof(chord[0] - 12), 0.35 * md.vol, 600);
      }
      if (s === 4 && this.mode !== 'night') {
        this._pluck(t, mtof(chord[1] - 12), 0.18 * md.vol, 700);
      }
      // melodia: caminhada aleatória na pentatônica, mais provável em tempos fortes
      var p = md.density * (s % 2 === 0 ? 1.2 : 0.6);
      if (Math.random() < p) {
        var stepMove = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
        this._deg = Math.max(0, Math.min(9, this._deg + stepMove));
        // em tempo 0, puxa para nota do acorde
        var oct = Math.floor(this._deg / 5);
        var midi = md.octave + oct * 12 + PENTA[this._deg % 5];
        if (s === 0) {
          var best = midi, bd = 99;
          for (var i = 0; i < chord.length; i++) {
            for (var k = -2; k <= 2; k++) {
              var c = chord[i] + 12 * k;
              if (Math.abs(c - midi) < bd) { bd = Math.abs(c - midi); best = c; }
            }
          }
          midi = best;
        }
        var v = (0.22 + Math.random() * 0.08) * md.vol;
        this._pluck(t + rand(0, 0.012), mtof(midi), v, md.cutoff);
        // eco suave
        if (Math.random() < 0.25) this._pluck(t + md.stepDur * 1.5, mtof(midi), v * 0.3, md.cutoff * 0.6);
      }
    }
  };

  /* ---------------- objeto público ---------------- */
  var SFX = {
    muted: false,
    music: music,
    names: Object.keys(FX),
    init: init,
    play: play,
    ambient: ambient,
    has: function (n) { return !!FX[n]; },
    setVolume: function (v) {
      try {
        masterVolume = clamp(v, 0, 1);
        if (master && !SFX.muted) master.gain.setTargetAtTime(masterVolume, now(), 0.05);
      } catch (e) {}
    },
    getVolume: function () { return masterVolume; },
    setMuted: function (b) {
      try {
        SFX.muted = !!b;
        if (master) master.gain.setTargetAtTime(SFX.muted ? 0 : masterVolume, now(), 0.05);
      } catch (e) {}
      return SFX.muted;
    },
    toggleMute: function () { return SFX.setMuted(!SFX.muted); }
  };

  window.SFX = SFX;
})();
