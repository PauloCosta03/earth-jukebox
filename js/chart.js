// Gráfico 2D das quatro séries: trecho já tocado em linha cheia, futuro do cenário
// escolhido como prévia tracejada e esmaecida, e cursor do ano atual.
window.EJ = window.EJ || {};
EJ.chart = (function () {
  const COLORS = { temp: '#ff5a4e', co2: '#c08bff', ice: '#5cd6ff', sea: '#3f8cff' };
  const chart = document.getElementById('chart'), cctx = chart.getContext('2d');

  function draw(year) {
    if (!chart.clientWidth || !cctx) return;
    const dpr = devicePixelRatio;
    const W = chart.width = chart.clientWidth * dpr, H = chart.height = chart.clientHeight * dpr;
    cctx.clearRect(0, 0, W, H);
    const x = y => (y - EJ.YEAR_MIN) / (EJ.YEAR_MAX - EJ.YEAR_MIN) * W;
    cctx.fillStyle = 'rgba(255,255,255,.05)';
    cctx.fillRect(x(EJ.YEAR_NOW), 0, W - x(EJ.YEAR_NOW), H);

    // traça a série entre y0 e y1; sólida até YEAR_NOW, tracejada depois
    function trace(k, y0, y1, alpha) {
      const [lo, hi] = EJ.RANGE[k];
      const py = v => H - (v - lo) / (hi - lo) * H * .82 - H * .09;
      cctx.globalAlpha = alpha * (EJ.audio.audible(k) ? 1 : .15);
      cctx.strokeStyle = COLORS[k]; cctx.lineWidth = 1.6 * dpr;
      [[y0, Math.min(y1, EJ.YEAR_NOW), []], [Math.max(y0, EJ.YEAR_NOW), y1, [5 * dpr, 4 * dpr]]].forEach(([a, b, dash]) => {
        if (b <= a) return;
        cctx.setLineDash(dash); cctx.beginPath();
        let started = false;
        for (let y = a; y <= b; y++) {
          const val = EJ.value(k, y); if (val == null) continue;
          started ? cctx.lineTo(x(y), py(val)) : cctx.moveTo(x(y), py(val)); started = true;
        }
        cctx.stroke();
      });
    }

    EJ.LAYERS.forEach(k => {
      if (year < EJ.YEAR_MAX) trace(k, year, EJ.YEAR_MAX, .22);   // prévia do futuro
      trace(k, EJ.YEAR_MIN, year, 1);
    });
    cctx.globalAlpha = 1; cctx.setLineDash([]);
    cctx.strokeStyle = 'rgba(255,179,92,.9)'; cctx.lineWidth = dpr;
    cctx.beginPath(); cctx.moveTo(x(year), 0); cctx.lineTo(x(year), H); cctx.stroke();
    cctx.fillStyle = '#8fa1c4'; cctx.font = `${10 * dpr}px system-ui`;
    [1900, 1950, 2000, 2050].forEach(y => cctx.fillText(y, x(y) + 2 * dpr, H - 3 * dpr));
  }
  return { draw };
})();
