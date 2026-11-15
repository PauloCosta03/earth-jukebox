// Rodar com:  node --test tests/
const test = require('node:test'), assert = require('node:assert/strict');
const { load, fakeAudio } = require('./helpers');

const DATA = ['data/historical.js', 'data/projections.js', 'js/data.js'];
const SSPS = ['ssp126', 'ssp245', 'ssp585'];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ------------------------------------------------------------------ dados / projeções
test('projeções variam a cada ano até 2100 (nenhuma série fica congelada)', () => {
  const { EJ } = load(DATA);
  for (const s of SSPS) {
    EJ.scenario = s;
    for (const L of EJ.LAYERS) {
      if (L === 'ice' && s === 'ssp585') continue;           // gelo chega a 0 por volta de 2090: congelado é físico
      const vals = range(EJ.YEAR_NOW + 1, 2100).map(y => EJ.value(L, y));
      const distinct = new Set(vals.map(v => v.toFixed(4))).size;
      assert.ok(distinct >= vals.length * 0.9, `${s}/${L}: só ${distinct} valores distintos em ${vals.length} anos`);
    }
  }
});

test('emenda observado→projetado é contínua (sem degrau), com e sem variabilidade sintética', () => {
  for (const variability of [false, true]) {
    const { EJ } = load(DATA);
    EJ.config.variability = variability; EJ.resetProjections();
    for (const s of SSPS) {
      EJ.scenario = s;
      for (const L of EJ.LAYERS) {
        const last = EJ.lastObserved[L], [lo, hi] = EJ.RANGE[L];
        const jump = Math.abs(EJ.value(L, last + 1) - EJ.value(L, last));
        // o passo tem de ser ~ a tendência anual dos anos seguintes (o gelo cai rápido de verdade);
        // com ruído sintético, acrescenta-se uma folga de ~2 desvios
        const trend = Math.abs(EJ.value(L, last + 6) - EJ.value(L, last + 1)) / 5;
        const lim = 2 * trend + (hi - lo) * (variability ? 0.04 : 0.01);
        assert.ok(jump < lim, `${s}/${L} (variab=${variability}): salto ${jump.toFixed(3)} > ${lim.toFixed(3)} em ${last}→${last + 1}`);
      }
    }
  }
});

test('cenários se ordenam em 2100 (mais emissões = mais calor, CO₂, mar; menos gelo)', () => {
  const { EJ } = load(DATA), at = (s, L) => { EJ.scenario = s; return EJ.value(L, 2100); };
  for (const L of ['temp', 'co2', 'sea']) assert.ok(at('ssp126', L) < at('ssp245', L) && at('ssp245', L) < at('ssp585', L), L);
  assert.ok(at('ssp126', 'ice') > at('ssp245', 'ice') && at('ssp245', 'ice') >= at('ssp585', 'ice'));
});

test('níveis perceptivos não saturam antes de 2100 e crescem com o cenário', () => {
  const { EJ } = load(DATA);
  EJ.scenario = 'ssp585';
  for (const L of ['co2', 'sea']) {                      // séries monotônicas
    let prev = -1;
    for (const y of [2030, 2050, 2070, 2090, 2100]) {
      const lv = EJ.level(L, EJ.value(L, y));
      assert.ok(lv > prev && lv <= 1, `${L} ${y}: nível ${lv}`);
      prev = lv;
    }
  }
  assert.ok(EJ.level('temp', EJ.value('temp', 2100)) > EJ.level('temp', EJ.value('temp', 2060)) + 0.05);
  assert.ok(EJ.level('temp', EJ.value('temp', 2100)) <= 1);
});

test('determinismo: mesmo cenário e ano dão sempre o mesmo valor', () => {
  const a = load(DATA).EJ, b = load(DATA).EJ;
  a.scenario = b.scenario = 'ssp245';
  for (const y of [2030, 2061, 2099]) assert.equal(a.value('temp', y), b.value('temp', y));
  a.config.variability = false; a.resetProjections();
  assert.notEqual(a.value('temp', 2061), b.value('temp', 2061));   // ruído desligado muda
});

test('histórico continua exato nos anos medidos', () => {
  const { EJ, EJ_HISTORICAL } = load(DATA);
  for (const y of [1880, 1998, 2016, 2025]) assert.equal(EJ.value('temp', y), EJ_HISTORICAL.temp[y]);
  assert.equal(EJ.value('ice', 1950), null);                       // antes dos satélites
});

test('PCHIP não ultrapassa os pontos (sem overshoot)', () => {
  const { EJ } = load(DATA), s = { 0: 0, 10: 1, 20: 1, 30: 5 };
  for (let y = 0; y <= 30; y += 0.5) { const v = EJ.interp(s, y); assert.ok(v >= -1e-9 && v <= 5 + 1e-9, `${y}: ${v}`); }
  for (let y = 10; y <= 20; y += 0.5) assert.ok(Math.abs(EJ.interp(s, y) - 1) < 1e-9);
});

// ------------------------------------------------------------------ visão
const px = (w, h, fn) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); d.set([...c, 255], (y * w + x) * 4); } return d; };

test('visão: cor, densidade, calor e movimento', () => {
  const { EJ } = load(DATA.concat('js/vision.js')), V = EJ.vision, W = 96, H = 54;
  const black = V.analyzePixels(px(W, H, () => [0, 0, 0]), W, H);
  assert.equal(black.density, 0); assert.equal(black.topHues.length, 0); assert.ok(black.cols.every(c => c.peaks.length === 0));

  const blue = V.analyzePixels(px(W, H, () => [20, 60, 255]), W, H);
  assert.equal(blue.topHues[0].bin, 8);                       // azul
  assert.ok(blue.cool > .9 && blue.warm < .05);

  const orange = V.analyzePixels(px(W, H, () => [255, 120, 0]), W, H);
  assert.equal(orange.topHues[0].bin, 1);                     // laranja
  assert.ok(orange.warm > .9);

  const lights = V.analyzePixels(px(W, H, (x, y) => (x % 8 === 0 && y % 8 === 0 ? [255, 220, 150] : [0, 0, 8])), W, H);
  assert.ok(lights.density > 0 && lights.density < 0.05);
  assert.ok(lights.cols.some(c => c.peaks.length));

  const f1 = V.analyzePixels(px(W, H, () => [10, 10, 10]), W, H);
  const f2 = V.analyzePixels(px(W, H, () => [200, 200, 200]), W, H, f1.luma);
  assert.ok(f2.motion > .5 && f1.motion === 0);
  assert.match(V.describe(blue), /azul/);
});

test('visão: varredura — altura do pixel vira posição vertical do pico', () => {
  const { EJ } = load(DATA.concat('js/vision.js')), W = 96, H = 54;
  const top = EJ.vision.analyzePixels(px(W, H, (x, y) => (y === 5 ? [255, 255, 255] : [0, 0, 0])), W, H);
  const bot = EJ.vision.analyzePixels(px(W, H, (x, y) => (y === 48 ? [255, 255, 255] : [0, 0, 0])), W, H);
  assert.ok(top.cols[10].peaks[0].y < 0.2 && bot.cols[10].peaks[0].y > 0.8);
});

// ------------------------------------------------------------------ áudio (Web Audio falsa e estrita)
function audioEnv() {
  const fa = fakeAudio(), sb = load(DATA.concat('js/vision.js', 'js/audio.js'), { AudioContext: fa.Ctx, MediaRecorder: undefined });
  return { EJ: sb.EJ, stats: fa.stats };
}
const feat = (EJ, fn) => EJ.vision.analyzePixels(px(96, 54, fn), 96, 54);

test('áudio: toca 1880–2100 nos 3 cenários, com e sem imagem, sem violar a Web Audio API', async () => {
  const { EJ, stats } = audioEnv();
  await EJ.audio.init();
  const f = feat(EJ, (x, y) => (x % 5 === 0 && y % 7 === 0 ? [255, 200, 90] : [0, 20, 90]));
  for (const s of SSPS) { EJ.scenario = s; for (let y = 1880; y <= 2100; y++) { EJ.audio.play(EJ.at(y), y % 2 ? f : null); } }
  assert.ok(stats.oscillators > 500);
  // quadros com MOVIMENTO exercitam o golpe grave (thump) e o chimbal (bordas)
  const dark = feat(EJ, () => [5, 5, 5]), flash = EJ.vision.analyzePixels(px(96, 54, (x, y) => (Math.floor(x / 3) % 2 ? [255, 255, 255] : [0, 0, 0])), 96, 54, dark.luma);
  assert.ok(flash.motion > .3 && flash.edge > .1, `motion=${flash.motion} edge=${flash.edge}`);
  const osc0 = stats.oscillators;
  for (let i = 0; i < 20; i++) EJ.audio.play(null, flash);
  assert.ok(stats.oscillators > osc0 + 20, 'movimento deveria disparar golpes');
  for (const p of Object.keys(EJ.audio.PROFILES)) { EJ.audio.setProfile(p); for (let i = 0; i < 30; i++) EJ.audio.play(null, f); }
});

test('áudio: a harmonia escurece com o calor e muda de cenário para cenário', async () => {
  const { EJ } = audioEnv();
  const names = ['pentatônica maior', 'mixolídio', 'menor natural', 'frígio', 'lócrio'];
  const idx = (s, y) => { EJ.scenario = s; return names.indexOf(EJ.audio.modeFor(EJ.audio.tensionOf(EJ.at(y), null)).name); };
  assert.equal(idx('ssp245', 1900), 0);
  assert.ok(idx('ssp245', 2025) >= 2);
  assert.ok(idx('ssp585', 2100) >= 4);
  assert.ok(idx('ssp126', 2100) < idx('ssp585', 2100));
  // não satura: SSP5-8.5 ainda sobe entre 2060 e 2100
  assert.ok(EJ.audio.tensionOf(EJ.at(2100), null) > EJ.audio.tensionOf(EJ.at(2060), null));
});

test('áudio: varredura agenda notas; solo/mudo e modo frame', async () => {
  const { EJ, stats } = audioEnv();
  await EJ.audio.init();
  const f = feat(EJ, (x, y) => [x * 2, 255 - y * 4, 80]);
  const before = stats.oscillators;
  assert.equal(EJ.audio.scan(f, 6, .4), 6);
  assert.ok(stats.oscillators > before + 20);
  EJ.audio.toggleSolo('temp'); assert.ok(EJ.audio.audible('temp') && !EJ.audio.audible('co2'));
  EJ.audio.toggleSolo('temp'); EJ.audio.toggleLayer('ice'); assert.ok(!EJ.audio.audible('ice'));
  EJ.audio.setMode('frame'); assert.ok(EJ.audio.audible('img') && !EJ.audio.audible('temp'));
  assert.equal(EJ.audio.scan(null), 0);
});

test('áudio: mesmo ano em cenários diferentes usa a mesma semente (comparação A/B)', () => {
  const { EJ } = audioEnv();
  const a = EJ.rng(2050 * 9973 + 17), b = EJ.rng(2050 * 9973 + 17);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
