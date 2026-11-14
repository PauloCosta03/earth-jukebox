// Visual: globo + gráfico. O "filtro de calor" (tinta vermelha, brilho e sombra)
// pode ser ligado/desligado; desligado, a Terra fica com cores naturais.
window.EJ = window.EJ || {};
EJ.visuals = (function () {
  const earth = document.getElementById('earth'), ectx = earth.getContext('2d');
  const chart = document.getElementById('chart'), cctx = chart.getContext('2d');
  const COLORS = { temp: '#ff5a4e', co2: '#c08bff', ice: '#5cd6ff', sea: '#3f8cff' };
  const RANGE = { temp: [-.6, 4.3], co2: [280, 1150], ice: [0, 8], sea: [-220, 820] };
  let heatFilter = false;

  function drawEarth(v) {
    const heat = heatFilter ? Math.max(0, Math.min(1, (v.temp + .5) / 3)) : 0;
    ectx.clearRect(0, 0, 320, 320);
    ectx.save(); ectx.beginPath(); ectx.arc(160, 160, 150, 0, Math.PI * 2); ectx.clip();
    ectx.fillStyle = `rgb(${30 + heat * 120},${90 - heat * 40},${190 - heat * 120})`;
    ectx.fillRect(0, 0, 320, 320);
    ectx.fillStyle = `rgb(${60 + heat * 150},${140 - heat * 60},${70 - heat * 40})`;
    [[110, 140, 40, 30], [190, 180, 35, 50], [200, 110, 45, 25], [120, 210, 20, 30]]
      .forEach(([x, y, a, b]) => { ectx.beginPath(); ectx.ellipse(x, y, a, b, .4, 0, Math.PI * 2); ectx.fill(); });
    const ice = v.ice == null ? 7.5 : v.ice;
    ectx.fillStyle = '#eef8ff';
    ectx.beginPath(); ectx.ellipse(160, 14, ice * 11, ice * 3, 0, 0, Math.PI * 2); ectx.fill();
    if (heatFilter) {               // sombreamento/luz só com o filtro ligado
      const g = ectx.createRadialGradient(120, 110, 20, 160, 160, 160);
      g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
      ectx.fillStyle = g; ectx.fillRect(0, 0, 320, 320);
    }
    ectx.restore();
    earth.style.boxShadow = heatFilter ? `0 0 ${40 + heat * 80}px rgba(255,${120 - heat * 100},60,${.2 + heat * .6})` : 'none';
  }

  function drawChart(year) {
    const dpr = devicePixelRatio;
    const W = chart.width = chart.clientWidth * dpr, H = chart.height = chart.clientHeight * dpr;
    cctx.clearRect(0, 0, W, H);
    const x = y => (y - EJ.YEAR_MIN) / (EJ.YEAR_MAX - EJ.YEAR_MIN) * W;
    // faixa de projeção
    cctx.fillStyle = 'rgba(255,255,255,.04)'; cctx.fillRect(x(EJ.YEAR_NOW), 0, W, H);
    EJ.LAYERS.forEach(k => {
      const [lo, hi] = RANGE[k];
      cctx.globalAlpha = EJ.audio.audible(k) ? 1 : .15;
      cctx.strokeStyle = COLORS[k]; cctx.lineWidth = 2 * dpr;
      let started = false;
      cctx.beginPath(); cctx.setLineDash([]);
      for (let y = EJ.YEAR_MIN; y <= year; y++) {
        if (y === EJ.YEAR_NOW + 1) { cctx.stroke(); cctx.beginPath(); cctx.setLineDash([6 * dpr, 4 * dpr]); started = false;
          const p = EJ.value(k, EJ.YEAR_NOW); cctx.moveTo(x(EJ.YEAR_NOW), H - (p - lo) / (hi - lo) * H * .85 - H * .07); started = true; }
        const val = EJ.value(k, y); if (val == null) continue;
        const py = H - (val - lo) / (hi - lo) * H * .85 - H * .07;
        started ? cctx.lineTo(x(y), py) : cctx.moveTo(x(y), py); started = true;
      }
      cctx.stroke();
    });
    cctx.globalAlpha = 1; cctx.setLineDash([]);
    cctx.fillStyle = '#8fa1c4'; cctx.font = `${11 * dpr}px system-ui`;
    [1900, 1950, 2000, 2050, 2100].forEach(y => cctx.fillText(y, Math.min(x(y), W - 30 * dpr), H - 4));
    cctx.fillText('projeção →', x(EJ.YEAR_NOW) + 4 * dpr, 14 * dpr);
  }

  return {
    drawEarth, drawChart,
    toggleHeatFilter() { heatFilter = !heatFilter; return heatFilter; }
  };
})();
