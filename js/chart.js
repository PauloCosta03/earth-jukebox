// Gráfico 2D das quatro séries, com faixa de projeção e cursor do ano atual.
window.EJ = window.EJ || {};
EJ.chart = (function () {
  const COLORS = { temp: '#ff5a4e', co2: '#c08bff', ice: '#5cd6ff', sea: '#3f8cff' };
  const RANGE = { temp: [-.6, 4.3], co2: [280, 1150], ice: [0, 8], sea: [-220, 820] };
  const chart = document.getElementById('chart'), cctx = chart.getContext('2d');

  function draw(year) {
    if (!chart.clientWidth) return;
    const dpr = devicePixelRatio;
    const W = chart.width = chart.clientWidth * dpr, H = chart.height = chart.clientHeight * dpr;
    cctx.clearRect(0, 0, W, H);
    const x = y => (y - EJ.YEAR_MIN) / (EJ.YEAR_MAX - EJ.YEAR_MIN) * W;
    cctx.fillStyle = 'rgba(255,255,255,.05)';
    cctx.fillRect(x(EJ.YEAR_NOW), 0, W - x(EJ.YEAR_NOW), H);
    EJ.LAYERS.forEach(k => {
      const [lo, hi] = RANGE[k];
      cctx.globalAlpha = EJ.audio.audible(k) ? 1 : .15;
      cctx.strokeStyle = COLORS[k]; cctx.lineWidth = 1.6 * dpr;
      let started = false;
      cctx.beginPath(); cctx.setLineDash([]);
      for (let y = EJ.YEAR_MIN; y <= year; y++) {
        if (y === EJ.YEAR_NOW + 1) {
          cctx.stroke(); cctx.beginPath(); cctx.setLineDash([5 * dpr, 4 * dpr]);
          const p = EJ.value(k, EJ.YEAR_NOW);
          cctx.moveTo(x(EJ.YEAR_NOW), H - (p - lo) / (hi - lo) * H * .82 - H * .09);
        }
        const val = EJ.value(k, y); if (val == null) continue;
        const py = H - (val - lo) / (hi - lo) * H * .82 - H * .09;
        started ? cctx.lineTo(x(y), py) : cctx.moveTo(x(y), py); started = true;
      }
      cctx.stroke();
    });
    cctx.globalAlpha = 1; cctx.setLineDash([]);
    cctx.strokeStyle = 'rgba(255,179,92,.9)'; cctx.lineWidth = dpr;
    cctx.beginPath(); cctx.moveTo(x(year), 0); cctx.lineTo(x(year), H); cctx.stroke();
    cctx.fillStyle = '#8fa1c4'; cctx.font = `${10 * dpr}px system-ui`;
    [1900, 1950, 2000, 2050].forEach(y => cctx.fillText(y, x(y) + 2 * dpr, H - 3 * dpr));
  }
  return { draw };
})();
