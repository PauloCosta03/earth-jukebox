// Motor de áudio: cada dado é uma camada (layer) com seu próprio GainNode,
// o que permite solo/mudo por instrumento.
window.EJ = window.EJ || {};
EJ.audio = (function () {
  let ctx, master, droneOsc, droneGain, shaper, noiseGain, noiseFilter, step = 0;
  const bus = {};                       // um gain por camada
  const state = { muted: false, solo: null, off: new Set() };
  const major = [0, 2, 4, 7, 9, 12, 14, 16], dissonant = [0, 1, 3, 6, 8, 11, 13, 18];

  function curve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }

  function init() {
    if (ctx) return ctx.resume();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .6; master.connect(ctx.destination);
    EJ.LAYERS.forEach(k => { bus[k] = ctx.createGain(); bus[k].connect(master); });

    // CO2 → drone distorcido
    droneOsc = ctx.createOscillator(); droneOsc.type = 'sawtooth'; droneOsc.frequency.value = 55;
    shaper = ctx.createWaveShaper(); shaper.curve = curve(0);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    droneGain = ctx.createGain(); droneGain.gain.value = .08;
    droneOsc.connect(shaper).connect(lp).connect(droneGain).connect(bus.co2); droneOsc.start();

    // Nível do mar → ondas (ruído filtrado)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 600;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
    noise.connect(noiseFilter).connect(noiseGain).connect(bus.sea); noise.start();
    applyMix();
  }

  function note(freq, dur, type, vol, layer) {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(bus[layer]); o.start(t); o.stop(t + dur + .05);
  }

  function audible(k) {
    if (state.solo) return k === state.solo;
    return !state.off.has(k);
  }

  function applyMix() {
    if (!ctx) return;
    master.gain.setTargetAtTime(state.muted ? 0 : .6, ctx.currentTime, .05);
    EJ.LAYERS.forEach(k => bus[k].gain.setTargetAtTime(audible(k) ? 1 : 0, ctx.currentTime, .08));
  }

  function play(v) {
    if (!ctx) return;
    const heat = Math.max(0, Math.min(1, (v.temp + .5) / 3));
    // Temperatura → melodia (mais quente = mais aguda e dissonante)
    const scale = Math.random() < heat * 1.3 ? dissonant : major;
    note(220 * Math.pow(2, heat * 1.5) * Math.pow(2, scale[step % scale.length] / 12), .35,
         heat > .45 ? 'sawtooth' : 'triangle', .12, 'temp');
    step += 1 + Math.floor(Math.random() * 3);
    // CO2 → drone
    const c = Math.min(1.5, (v.co2 - 280) / 150);
    shaper.curve = curve(c * 60);
    droneGain.gain.setTargetAtTime(.04 + c * .1, ctx.currentTime, .2);
    droneOsc.frequency.setTargetAtTime(55 * (1 + c * .06), ctx.currentTime, .2);
    // Gelo → sinos (menos gelo = menos sinos)
    const ice = v.ice == null ? 7.5 : v.ice;
    if (Math.random() < ice / 8) note(1760 * [1, 1.25, 1.5][step % 3], 1.2, 'sine', .06, 'ice');
    // Mar → ondas
    const s = Math.min(1.5, (v.sea + 210) / 320);
    noiseGain.gain.setTargetAtTime(.01 + s * .1, ctx.currentTime, .3);
    noiseFilter.frequency.setTargetAtTime(300 + s * 1500, ctx.currentTime, .3);
  }

  return {
    init, play, audible,
    toggleSolo(k) { state.solo = state.solo === k ? null : k; applyMix(); return state.solo; },
    toggleLayer(k) { state.off.has(k) ? state.off.delete(k) : state.off.add(k); state.solo = null; applyMix(); },
    toggleMute() { state.muted = !state.muted; applyMix(); return state.muted; },
    state
  };
})();
