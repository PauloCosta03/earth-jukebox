// Motor de áudio (Web Audio). Cada fonte de informação é uma camada com seu próprio
// GainNode (solo/mudo por instrumento):
//   temp  melodia      — a harmonia escurece (escala maior → lócria) e desafina com o calor
//   co2   drone        — dois osciladores que se afastam e distorcem com mais CO₂
//   ice   sinos        — somem com o degelo
//   sea   ondas        — ruído filtrado que cresce com o nível do mar
//   img   visão        — acorde (matizes), arpejo (densidade), chimbal (bordas), golpes (movimento)
//
// Determinismo: o acaso é semeado pelo ano, então o mesmo ano soa igual em qualquer
// cenário — assim dá para comparar cenários ouvindo só a diferença dos dados.
window.EJ = window.EJ || {};
EJ.audio = (function () {
  const AUDIO_LAYERS = ['temp', 'co2', 'ice', 'sea', 'img'];
  const KEY = 220;                                   // lá3: tonalidade fixa da peça
  const TICK = () => (EJ.TICK_MS || 260) / 1000;

  // Escalas por nível de tensão (0..1): do consonante ao instável.
  const MODES = [
    { max: 0.30, name: 'pentatônica maior', steps: [0, 2, 4, 7, 9] },
    { max: 0.45, name: 'mixolídio',         steps: [0, 2, 4, 5, 7, 9, 10] },
    { max: 0.60, name: 'menor natural',     steps: [0, 2, 3, 5, 7, 8, 10] },
    { max: 0.80, name: 'frígio',            steps: [0, 1, 3, 5, 7, 8, 10] },
    { max: 1.01, name: 'lócrio',            steps: [0, 1, 3, 5, 6, 8, 10] }
  ];
  const modeFor = t => MODES.find(m => t < m.max) || MODES[MODES.length - 1];

  // Perfis de som: ajustam como as características da imagem viram música.
  const PROFILES = {
    balanced: { label: 'Equilibrado',                      padVol: .50, padEvery: 4, arpMax: 3, arpWave: 'triangle', arpDecay: .35, hat: .6,  thump: .5,  motionGain: 1, pitchFrom: 'row' },
    pulse:    { label: 'Pulso (luzes, relâmpagos)',        padVol: .25, padEvery: 8, arpMax: 4, arpWave: 'sine',     arpDecay: .18, hat: .9,  thump: 1.0, motionGain: 2, pitchFrom: 'row' },
    flow:     { label: 'Fluxo (correntes, aerossóis)',     padVol: .85, padEvery: 3, arpMax: 1, arpWave: 'sine',     arpDecay: .80, hat: .15, thump: .1,  motionGain: 1, pitchFrom: 'row' },
    forest:   { label: 'Floresta (cor → altura/ritmo)',    padVol: .40, padEvery: 4, arpMax: 4, arpWave: 'square',   arpDecay: .22, hat: .3,  thump: .3,  motionGain: 1, pitchFrom: 'hue' }
  };

  let ctx, master, mix, comp, recDest, shaper, lp, droneOsc, droneOsc2, droneGain, noiseBuf,
      noiseGain, noiseFilter, mediaRec = null, recChunks = [], lastCurve = -1;
  let tick = 0, melDeg = 4;
  const bus = {};
  const state = { muted: false, solo: null, off: new Set(), mode: 'globe', profile: 'balanced' };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

  function curve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }

  // Frequência do grau `deg` (pode passar de uma oitava) de uma escala.
  function degFreq(root, steps, deg, cents = 0) {
    const len = steps.length, oct = Math.floor(deg / len), idx = ((deg % len) + len) % len;
    return root * Math.pow(2, (oct * 12 + steps[idx]) / 12 + cents / 1200);
  }

  function reverbIR(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function init() {
    if (ctx) return ctx.resume();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .7;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 4; comp.attack.value = .01; comp.release.value = .25;
    master.connect(comp); comp.connect(ctx.destination);
    recDest = ctx.createMediaStreamDestination(); comp.connect(recDest);

    mix = ctx.createGain(); mix.connect(master);
    const send = ctx.createGain(); send.gain.value = .3;
    const conv = ctx.createConvolver(); conv.buffer = reverbIR(2.4, 3);
    mix.connect(send); send.connect(conv); conv.connect(master);
    AUDIO_LAYERS.forEach(k => { bus[k] = ctx.createGain(); bus[k].connect(mix); });

    // CO2 → drone: dois dentes-de-serra que desafinam, passam por distorção e filtro
    droneOsc = ctx.createOscillator(); droneOsc.type = 'sawtooth'; droneOsc.frequency.value = 55;
    droneOsc2 = ctx.createOscillator(); droneOsc2.type = 'sawtooth'; droneOsc2.frequency.value = 55;
    shaper = ctx.createWaveShaper(); shaper.curve = curve(0);
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    droneGain = ctx.createGain(); droneGain.gain.value = .06;
    droneOsc.connect(shaper); droneOsc2.connect(shaper);
    shaper.connect(lp); lp.connect(droneGain); droneGain.connect(bus.co2);
    droneOsc.start(); droneOsc2.start();

    // ruído branco (ondas, chimbal)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
    noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 600;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(bus.sea); noise.start();
    applyMix();
    return ctx.resume();
  }

  // Nota sintetizada. `at` = atraso em segundos a partir de agora.
  function tone(o) {
    const t = ctx.currentTime + (o.at || 0), atk = o.attack == null ? .02 : o.attack;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.value = o.freq;
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol, t + atk);
    g.gain.exponentialRampToValueAtTime(.0008, t + Math.max(o.dur, atk + .02));
    let out = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; out.connect(f); out = f; }
    out.connect(g); out = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); out.connect(p); out = p; }
    out.connect(bus[o.layer]);
    osc.start(t); osc.stop(t + o.dur + .05);
  }

  // Rajada de ruído filtrado (chimbal / textura).
  function burst(o) {
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = o.freq; f.Q.value = o.q || 1.2;
    g.gain.setValueAtTime(o.vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + o.dur);
    src.connect(f); f.connect(g); g.connect(bus[o.layer]);
    src.start(t, Math.random() * 1.5, o.dur + .02);
  }

  // Golpe grave (movimento): seno com queda de afinação.
  function thump(vol, at = 0) {
    const t = ctx.currentTime + at, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(42, t + .18);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + .26);
    osc.connect(g); g.connect(bus.img); osc.start(t); osc.stop(t + .3);
  }

  function audible(k) {
    if (state.mode === 'frame' && k !== 'img') return false;   // frame EIC: só a camada de imagem
    if (state.solo) return k === state.solo;
    return !state.off.has(k);
  }

  function applyMix() {
    if (!ctx) return;
    master.gain.setTargetAtTime(state.muted ? 0 : .7, ctx.currentTime, .05);
    AUDIO_LAYERS.forEach(k => bus[k].gain.setTargetAtTime(audible(k) ? 1 : 0, ctx.currentTime, .08));
  }

  // Tensão harmônica (0..1): temperatura quando há dado; senão, "calor" da imagem.
  function tensionOf(v, f) {
    if (v) return EJ.level('temp', v.temp);
    return f ? clamp(f.warm * 1.3 + (1 - f.cool) * 0.1) : 0.3;
  }

  function playData(v, rnd, mode) {
    const heat = EJ.level('temp', v.temp), steps = mode.steps, len = steps.length, now = ctx.currentTime;

    // Temperatura → melodia: passeio aleatório pela escala; mais aguda e desafinada com o calor
    if (rnd() > .15) {
      melDeg = clamp(melDeg + pick(rnd, [-2, -1, -1, 1, 1, 2]), 0, len * 2);
      const f0 = degFreq(KEY * Math.pow(2, heat * 1.2), steps, melDeg);
      const detune = Math.max(0, heat - .4) * 70;
      tone({ freq: f0, dur: .35, type: heat > .55 ? 'sawtooth' : 'triangle', vol: .11, layer: 'temp', detune,
             lp: 1500 + heat * 3500 });
      if (rnd() < Math.max(0, heat - .5) * 1.6)        // segunda menor: o "choque" do calor extremo
        tone({ freq: f0 * Math.pow(2, 1 / 12), dur: .3, type: 'sawtooth', vol: .045, layer: 'temp', at: .03, lp: 2000 });
    }

    // CO2 → drone: distorção, desafinação entre osciladores e brilho crescem
    const c = EJ.level('co2', v.co2);
    if (Math.abs(c - lastCurve) > .01) { shaper.curve = curve(c * 140); lastCurve = c; }
    droneGain.gain.setTargetAtTime(.04 + c * .09, now, .2);
    droneOsc.frequency.setTargetAtTime(55 * (1 + c * .05), now, .2);
    droneOsc2.detune.setTargetAtTime(c * 45, now, .2);
    lp.frequency.setTargetAtTime(280 + c * 900, now, .2);

    // Gelo → sinos (inarmônicos), na escala atual; menos gelo = menos sinos
    const ice = v.ice == null ? 7.5 : v.ice;
    if (rnd() < clamp(ice / 7.5) * .9) {
      const f = degFreq(KEY * 8, steps, pick(rnd, [0, 2, 4]) % len);
      tone({ freq: f, dur: 1.2, type: 'sine', vol: .055, layer: 'ice', pan: rnd() * 1.6 - .8 });
      tone({ freq: f * 2.76, dur: .5, type: 'sine', vol: .018, layer: 'ice' });
    }

    // Mar → ondas
    const s = EJ.level('sea', v.sea);
    noiseGain.gain.setTargetAtTime(.01 + s * .12, now, .3);
    noiseFilter.frequency.setTargetAtTime(300 + s * 1500, now, .3);
  }

  function playImage(f, rnd, mode) {
    const P = PROFILES[state.profile], steps = mode.steps, len = steps.length, T = TICK();
    const bri = clamp(f.bright * 2.2);

    // Matizes dominantes → acorde (cada matiz vira um grau da escala atual)
    if (tick % P.padEvery === 0 && f.topHues.length) {
      const degs = f.topHues.map(t => t.bin % len);
      for (let i = 0; degs.length < 3; i++) degs.push((degs[0] + 2 * (i + 1)) % len);   // completa a tríade
      degs.slice(0, 3).sort((a, b) => a - b).forEach((dg, i) => {
        tone({ freq: degFreq(KEY * .5, steps, dg + len * (i > 0 ? 1 : 0)), dur: T * P.padEvery * 1.5, attack: .3,
               type: 'triangle', vol: .05 * P.padVol * (1 - i * .15), layer: 'img', lp: 300 + bri * 2800,
               pan: (i - 1) * .5, detune: i * 3 });
      });
    }

    // Densidade de brilho → arpejo (mais pontos brilhantes = mais notas por pulso)
    const hits = Math.round(clamp(f.density * 4) * P.arpMax);
    const cols = f.cols.filter(c => c.peaks.length);
    for (let i = 0; i < hits && cols.length; i++) {
      const col = cols[Math.floor(rnd() * cols.length)], pk = col.peaks[Math.floor(rnd() * col.peaks.length)];
      const deg = P.pitchFrom === 'hue'
        ? (pk.bin % len) + len * Math.floor((1 - pk.y) * 2.99)        // floresta: cor → nota, altura → oitava
        : Math.round((1 - pk.y) * (len * 3 - 1));                     // padrão: altura do pixel → altura da nota
      tone({ freq: degFreq(KEY, steps, deg), dur: P.arpDecay, type: P.arpWave, vol: (.04 + .07 * pk.a) * .9,
             layer: 'img', at: i * T / Math.max(1, hits), pan: col.x * 2 - 1, lp: 600 + bri * 4000 });
    }

    // Bordas/textura → chimbal
    if (rnd() < clamp(f.edge * 4) * P.hat) burst({ freq: 7000, dur: .05, vol: .035, layer: 'img', q: 2 });

    // Movimento entre quadros → golpe grave (relâmpago, avanço de frente, mudança de ano)
    const mv = clamp(f.motion * 12 * P.motionGain);
    if (mv > .15) thump(clamp(mv * P.thump * .35, 0, .3));
  }

  // data (v) pode ser null (modo frame EIC); features (f) podem ser null (sem visão disponível).
  function play(v, f) {
    if (!ctx) return;
    tick++;
    const mode = modeFor(tensionOf(v, f));
    const rnd = EJ.rng(v ? v.year * 9973 + 17 : tick * 7919 + 3);
    if (v) playData(v, rnd, mode);
    if (f) playImage(f, rnd, mode);
    return mode;
  }

  // Varredura estilo "leitor de imagem": esquerda→direita; altura do pixel = altura da nota,
  // brilho = volume, posição horizontal = panorâmica, matiz quente = timbre áspero.
  // `forceSteps`: escala fixa (ex.: maior) para imagens-partitura — ver main.js, "modo partitura".
  // No modo partitura a nota soa como uma caixinha de música: uma oitava acima, ataque nítido,
  // termina antes da próxima coluna (notas repetidas ficam separadas) e sem panorâmica.
  function scan(f, seconds = 6, tension = .3, forceSteps = null) {
    if (!ctx || !f) return 0;
    const score = !!forceSteps;
    const steps = forceSteps || modeFor(tension).steps, len = steps.length, n = f.cols.length;
    const colDur = seconds / n;
    f.cols.forEach((col, i) => {
      const at = .05 + (i / n) * seconds;
      col.peaks.forEach(pk => {
        const deg = Math.round((1 - pk.y) * (len * 3 - 1));
        if (score) {
          const fr = degFreq(KEY, steps, deg);                       // 1 oitava acima (440–660 Hz)
          tone({ freq: fr, dur: colDur * 1.6, type: 'triangle', vol: .16, layer: 'img', at, attack: .008, lp: 5000 });
          tone({ freq: fr * 2, dur: colDur * 0.9, type: 'sine', vol: .04, layer: 'img', at, attack: .005 });  // brilho
          return;
        }
        tone({ freq: degFreq(KEY * .5, steps, deg), dur: Math.max(.25, colDur * 3),
               type: pk.warm ? 'sawtooth' : 'sine', vol: (.03 + .1 * pk.a) * (pk.warm ? .6 : 1),
               layer: 'img', at, pan: col.x * 2 - 1, lp: 3000, attack: .015 });
      });
    });
    return seconds;
  }

  // Gravação do que está tocando (arquivo de áudio gerado)
  const rec = {
    get active() { return !!mediaRec; },
    start() {
      if (!ctx || mediaRec || typeof MediaRecorder === 'undefined') return false;
      recChunks = [];
      mediaRec = new MediaRecorder(recDest.stream);
      mediaRec.ondataavailable = e => e.data && e.data.size && recChunks.push(e.data);
      mediaRec.start();
      return true;
    },
    stop() {
      return new Promise(resolve => {
        if (!mediaRec) return resolve(null);
        const mr = mediaRec; mediaRec = null;
        mr.onstop = () => resolve(new Blob(recChunks, { type: mr.mimeType || 'audio/webm' }));
        mr.stop();
      });
    }
  };

  return {
    MAJOR: [0, 2, 4, 5, 7, 9, 11],                     // escala maior (modo partitura)
    init, play, scan, audible, rec, modeFor, tensionOf, degFreq, MODES, PROFILES, TICK,
    toggleSolo(k) { state.solo = state.solo === k ? null : k; applyMix(); return state.solo; },
    toggleLayer(k) { state.off.has(k) ? state.off.delete(k) : state.off.add(k); state.solo = null; applyMix(); },
    toggleMute() { state.muted = !state.muted; applyMix(); return state.muted; },
    setMode(m) { state.mode = m; tick = 0; applyMix(); },
    setProfile(p) { if (PROFILES[p]) state.profile = p; },
    state
  };
})();
