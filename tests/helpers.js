// Carrega os scripts do navegador num sandbox do Node (sem DOM) e fornece um AudioContext falso
// e ESTRITO: ele lança erro se o código usar a Web Audio API de forma inválida
// (tempo NaN, rampa exponencial para 0, frequência não finita...).
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

function param(name) {
  const p = { _v: 0, name };
  const chk = (fn, ...a) => a.forEach(x => { if (!Number.isFinite(x)) throw new Error(`${name}.${fn}: valor inválido ${x}`); });
  Object.defineProperty(p, 'value', { get() { return p._v; }, set(x) { chk('value', x); p._v = x; } });
  p.setValueAtTime = (v, t) => chk('setValueAtTime', v, t);
  p.linearRampToValueAtTime = (v, t) => chk('linearRamp', v, t);
  p.exponentialRampToValueAtTime = (v, t) => { chk('expRamp', v, t); if (v <= 0) throw new Error(name + ': rampa exponencial para ' + v); };
  p.setTargetAtTime = (v, t, c) => chk('setTarget', v, t, c);
  return p;
}

function fakeAudio() {
  const stats = { oscillators: 0, noises: 0, nodes: 0 };
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = node('dest'); this.state = 'running'; }
    resume() { return Promise.resolve(); }
    createBuffer(ch, len) {
      if (!(len > 0)) throw new Error('createBuffer: tamanho inválido ' + len);
      return { getChannelData: () => new Float32Array(len) };
    }
    createMediaStreamDestination() { return Object.assign(node('rec'), { stream: {} }); }
  }
  function node(kind) {
    stats.nodes++;
    const n = { kind, connected: [] };
    ['gain', 'frequency', 'detune', 'Q', 'pan', 'threshold', 'ratio', 'attack', 'release'].forEach(k => (n[k] = param(kind + '.' + k)));
    n.connect = x => { if (!x) throw new Error(kind + '.connect(undefined)'); n.connected.push(x); return x; };
    n.start = (t = 0, off, dur) => { if (!Number.isFinite(t)) throw new Error(kind + '.start NaN'); };
    n.stop = t => { if (!Number.isFinite(t)) throw new Error(kind + '.stop NaN'); };
    return n;
  }
  const factories = {
    createGain: 'gain', createOscillator: 'osc', createBiquadFilter: 'biquad', createWaveShaper: 'shaper',
    createDynamicsCompressor: 'comp', createConvolver: 'conv', createBufferSource: 'src', createStereoPanner: 'pan'
  };
  Object.entries(factories).forEach(([m, kind]) => {
    Ctx.prototype[m] = function () {
      const n = node(kind);
      if (kind === 'osc') stats.oscillators++;
      if (kind === 'src') stats.noises++;
      return n;
    };
  });
  return { Ctx, stats };
}

function load(files, extra = {}) {
  const sb = { console, Math, Float32Array, Float64Array, Uint8ClampedArray, Object, Array, Number, Promise,
               setTimeout, clearTimeout, ...extra };
  sb.window = sb;
  vm.createContext(sb);
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f }));
  return sb;
}

module.exports = { load, fakeAudio, ROOT };
