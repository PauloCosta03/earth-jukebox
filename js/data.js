// Camada de dados: une histórico + projeção do cenário escolhido.
window.EJ = window.EJ || {};
EJ.YEAR_MIN = 1880;
EJ.YEAR_NOW = 2024;
EJ.YEAR_MAX = 2100;
EJ.LAYERS = ['temp', 'co2', 'ice', 'sea'];
EJ.scenario = 'ssp245';

EJ.interp = function (series, y) {
  const ks = Object.keys(series).map(Number).sort((a, b) => a - b);
  if (y < ks[0]) return null;
  if (y >= ks[ks.length - 1]) return series[ks[ks.length - 1]];
  for (let i = 0; i < ks.length - 1; i++) {
    if (y >= ks[i] && y <= ks[i + 1]) {
      const t = (y - ks[i]) / (ks[i + 1] - ks[i]);
      return series[ks[i]] + (series[ks[i + 1]] - series[ks[i]]) * t;
    }
  }
};

// Último ano observado de cada série (ex.: gelo GSFC termina em 2017).
// Depois dele, usa a projeção do cenário escolhido.
EJ.lastObserved = {};
EJ.LAYERS.forEach(k => {
  EJ.lastObserved[k] = Math.max(...Object.keys(EJ_HISTORICAL[k]).map(Number));
});

EJ.value = function (layer, y) {
  const src = y <= EJ.lastObserved[layer] ? EJ_HISTORICAL : EJ_PROJECTIONS[EJ.scenario];
  return EJ.interp(src[layer], y);
};

EJ.at = function (y) {
  const v = { year: y, projected: y > EJ.YEAR_NOW };
  EJ.LAYERS.forEach(k => (v[k] = EJ.value(k, y)));
  return v;
};
