// Camada de dados: une histórico + projeção do cenário escolhido.
//
// Pontos-chave do desenho (ver README, "Como as projeções variam com os anos"):
//  1. Todas as séries são interpoladas com PCHIP (monótona, sem overshoot), então
//     pontos esparsos viram curvas suaves ano a ano, não segmentos retos.
//  2. A projeção é ancorada no último valor observado e o desvio some aos poucos
//     (EJ.config.blendYears), evitando o "degrau" entre observado e projetado.
//  3. Projeções esparsas (medianas do IPCC) ganham variabilidade natural sintética,
//     determinística por cenário, para que cada ano soe/pareça diferente — como um
//     único membro de modelo. Projeções densas (geradas pelo modelo GISS pelo
//     scripts/fetch_nasa_data.py) já têm variabilidade própria e não recebem ruído.
//  4. Faixas físicas e curvas perceptivas ficam aqui (EJ.RANGE / EJ.level) e são
//     compartilhadas por gráfico, áudio e globo — nada satura antes de 2100.
window.EJ = window.EJ || {};
EJ.YEAR_MIN = 1880;
EJ.YEAR_MAX = 2100;
EJ.TICK_MS = 260;                       // duração de um "ano" na reprodução
EJ.LAYERS = ['temp', 'co2', 'ice', 'sea'];
EJ.scenario = 'ssp245';
// variability: ruído sintético DESLIGADO — regra do projeto: só dados da NASA (as projeções do
// modelo GISS já têm a variação real de ano a ano). blendYears: emenda suave observado→projetado.
EJ.config = { variability: false, blendYears: 25 };

// Faixas cobrindo o pior cenário (SSP5-8.5 em 2100). Nível do mar: mm desde 1993 (início das
// medições por satélite da NASA; antes disso a série não tem valor e o app mostra "sem satélite").
EJ.RANGE = { temp: [-0.6, 4.3], co2: [280, 1150], ice: [0, 8], sea: [0, 820] };
// Expoente perceptivo: realça o início da escala (o clima de hoje já deve soar diferente de 1900).
const GAMMA = { temp: 0.7, co2: 0.6, ice: 1, sea: 0.6 };
// Variabilidade interanual sintética (desvio-padrão) e memória (AR1), só para projeções esparsas.
const VARIABILITY = { temp: { sigma: 0.085, phi: 0.45 }, ice: { sigma: 0.28, phi: 0.35 } };

const clamp01 = x => Math.min(1, Math.max(0, x));

EJ.norm = (layer, v) => {
  const [lo, hi] = EJ.RANGE[layer];
  return clamp01((v - lo) / (hi - lo));
};
EJ.level = (layer, v) => Math.pow(EJ.norm(layer, v), GAMMA[layer]);

// ---------------------------------------------------------------- interpolação PCHIP
const prepared = new WeakMap();

function prepare(series) {
  let p = prepared.get(series);
  if (p) return p;
  const xs = Object.keys(series).map(Number).sort((a, b) => a - b);
  const ys = xs.map(x => series[x]);
  const n = xs.length, h = [], d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  if (n === 2) { m[0] = m[1] = d[0]; }
  else if (n > 2) {
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    const edge = (h0, h1, d0, d1) => {
      let s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
      if (Math.sign(s) !== Math.sign(d0)) s = 0;
      else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(s) > 3 * Math.abs(d0)) s = 3 * d0;
      return s;
    };
    m[0] = edge(h[0], h[1], d[0], d[1]);
    m[n - 1] = edge(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  }
  p = { xs, ys, m, dense: n > 1 && (xs[n - 1] - xs[0]) / (n - 1) <= 1.5 };
  prepared.set(series, p);
  return p;
}

// Valor da série no ano y (null antes do primeiro ponto; constante depois do último).
EJ.interp = function (series, y) {
  const { xs, ys, m } = prepare(series), n = xs.length;
  if (!n || y < xs[0]) return null;
  if (y >= xs[n - 1]) return ys[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; xs[mid] <= y ? (lo = mid) : (hi = mid); }
  const h = xs[hi] - xs[lo], t = (y - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] +
         (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
};

// ---------------------------------------------------------------- observado x projetado
// Último ano observado de cada série (ex.: gelo GSFC termina em 2017). Depois dele vale a projeção.
// Primeiro ano observado: antes dele não há medição (gelo: satélites desde 1979; mar: desde 1993).
EJ.lastObserved = {}; EJ.firstObserved = {};
EJ.LAYERS.forEach(k => {
  const years = Object.keys(EJ_HISTORICAL[k]).map(Number);
  EJ.lastObserved[k] = Math.max(...years);
  EJ.firstObserved[k] = Math.min(...years);
});
// Valor para o globo e o som quando a série ainda não tem medição: o PRIMEIRO valor medido pela NASA
// (o texto e a narração continuam dizendo "sem satélite"; nada é inventado para trás).
EJ.orFirst = (layer, v) => (v == null ? EJ_HISTORICAL[layer][EJ.firstObserved[layer]] : v);
// Último ano com temperatura medida: tudo depois é rotulado como projeção.
EJ.YEAR_NOW = EJ.lastObserved.temp;

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
EJ.rng = function (seed) {                   // mulberry32: PRNG pequeno e determinístico
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const gauss = rnd => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());

const tables = {};                           // cache: tables[scenario][layer] = {y0, values[]}

function buildProjection(scn, layer) {
  const proj = EJ_PROJECTIONS[scn][layer], hist = EJ_HISTORICAL[layer];
  const last = EJ.lastObserved[layer], dense = prepare(proj).dense;
  // desvio entre o último valor medido e a curva projetada (só p/ projeções esparsas;
  // as densas já vêm corrigidas pelo pipeline Python)
  let offset = 0;
  if (!dense) {
    const p0 = EJ.interp(proj, last);
    if (p0 != null) offset = hist[last] - p0;
  }
  const vr = VARIABILITY[layer];
  const noisy = !dense && EJ.config.variability && vr;
  const rnd = EJ.rng(hashSeed(scn + ':' + layer));
  const values = [];
  let e = 0;
  for (let y = last + 1; y <= EJ.YEAR_MAX; y++) {
    let v = EJ.interp(proj, y);
    const fade = Math.max(0, 1 - (y - last) / EJ.config.blendYears);
    v += offset * fade;
    if (noisy) {
      e = vr.phi * e + vr.sigma * Math.sqrt(1 - vr.phi * vr.phi) * gauss(rnd);
      // o gelo some perto de zero: o ruído encolhe junto
      v += layer === 'ice' ? e * Math.min(1, Math.max(v, 0) / 2) : e;
    }
    if (layer === 'ice') v = Math.max(0, v);
    values.push(v);
  }
  return { y0: last + 1, values };
}

EJ.resetProjections = () => { for (const k in tables) delete tables[k]; };

EJ.value = function (layer, y) {
  if (y <= EJ.lastObserved[layer]) return EJ.interp(EJ_HISTORICAL[layer], y);
  const t = ((tables[EJ.scenario] = tables[EJ.scenario] || {})[layer] ||=
    buildProjection(EJ.scenario, layer));
  const i = y - t.y0, i0 = Math.floor(i), f = i - i0;
  const a = t.values[Math.min(t.values.length - 1, Math.max(0, i0))];
  const b = t.values[Math.min(t.values.length - 1, Math.max(0, i0 + 1))];
  return a + (b - a) * f;
};

EJ.at = function (y) {
  const v = { year: y, projected: y > EJ.YEAR_NOW, scenario: EJ.scenario };
  EJ.LAYERS.forEach(k => (v[k] = EJ.value(k, y)));
  return v;
};
