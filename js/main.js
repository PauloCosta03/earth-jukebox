// Interface: timeline 1880→2100, cenários, camadas visuais (chips) e de áudio (cards).
(function () {
  const $ = id => document.getElementById(id);
  const slider = $('slider'), yearEl = $('year'), msg = $('msg'), playBtn = $('play');
  let timer = null;

  // O globo 3D usa módulos ES e texturas — não funciona abrindo o arquivo direto.
  if (location.protocol === 'file:') {
    const l = $('loading');
    l.classList.add('error');
    l.querySelector('p').innerHTML =
      'O globo 3D precisa de um servidor local.<br>Dê dois cliques em <b>run.bat</b> na pasta do projeto<br>e abra <b>http://localhost:8013</b>.';
  }

  const events = {
    1880: 'Era industrial: carvão alimenta o mundo.', 1910: 'O planeta ainda soa em harmonia.',
    1945: 'Pós-guerra: explosão do petróleo e do consumo.', 1958: 'Começa a medição de CO₂ em Mauna Loa.',
    1979: 'Satélites começam a medir o gelo do Ártico.',
    1988: 'Cientistas da NASA alertam o Congresso dos EUA sobre o aquecimento global.',
    1993: 'Satélites passam a medir o nível do mar.', 2012: 'Recorde de derretimento do gelo do Ártico.',
    2015: 'Acordo de Paris: meta de 1,5 °C.', 2024: 'Ano mais quente da história medida.',
    2025: 'A partir daqui: projeções dos modelos climáticos (CMIP6/IPCC) usados pela NASA.',
    2050: 'Meados do século: o cenário escolhido decide a música.',
    2100: 'Fim do século. Que música vamos deixar?'
  };

  const fmt = {
    temp: v => (v > 0 ? '+' : '') + v.toFixed(2) + ' °C',
    co2: v => v.toFixed(0) + ' ppm',
    ice: v => v == null ? 'sem satélite' : v.toFixed(1) + ' mi km²',
    sea: v => (v > 0 ? '+' : '') + v.toFixed(0) + ' mm'
  };

  function render(y, sound = true) {
    const v = EJ.at(y);
    yearEl.textContent = y; slider.value = y;
    yearEl.classList.toggle('proj', v.projected);
    EJ.LAYERS.forEach(k => ($('v-' + k).textContent = fmt[k](v[k])));
    const ev = Object.keys(events).map(Number).filter(k => k <= y).pop();
    if (ev) msg.textContent = `${ev}: ${events[ev]}`;
    EJ.chart.draw(y);
    if (EJ.globe) EJ.globe.update(v);
    if (sound) EJ.audio.play(v);
  }

  function refreshCards() {
    document.querySelectorAll('.card').forEach(c => {
      const k = c.dataset.layer, s = EJ.audio.state;
      c.classList.toggle('solo', s.solo === k);
      c.classList.toggle('off', !EJ.audio.audible(k));
      c.querySelector('.mute-layer').textContent = s.off.has(k) ? '🔇' : '🔊';
    });
    EJ.chart.draw(+slider.value);
  }

  playBtn.onclick = () => {
    EJ.audio.init();
    if (timer) { clearInterval(timer); timer = null; playBtn.textContent = '▶ Tocar'; return; }
    let y = +slider.value; if (y >= EJ.YEAR_MAX) y = EJ.YEAR_MIN;
    playBtn.textContent = '⏸ Pausar';
    timer = setInterval(() => {
      render(y); y++;
      if (y > EJ.YEAR_MAX) {
        if ($('loop').checked) y = EJ.YEAR_MIN;
        else { clearInterval(timer); timer = null; playBtn.textContent = '↺ De novo'; }
      }
    }, 260);
  };

  $('mute').onclick = e => { e.target.textContent = EJ.audio.toggleMute() ? '🔇' : '🔊'; };
  $('scenario').onchange = e => { EJ.scenario = e.target.value; render(+slider.value, false); };
  slider.oninput = () => { EJ.audio.init(); render(+slider.value); };

  // cards = camadas de ÁUDIO (clique: solo · alto-falante: liga/desliga)
  document.querySelectorAll('.card').forEach(card => {
    const k = card.dataset.layer;
    card.onclick = () => { EJ.audio.init(); EJ.audio.toggleSolo(k); refreshCards(); };
    card.querySelector('.mute-layer').onclick = e => { e.stopPropagation(); EJ.audio.toggleLayer(k); refreshCards(); };
  });

  // chips = camadas VISUAIS do globo
  document.querySelectorAll('.chip[data-viz]').forEach(ch => {
    ch.onclick = () => { if (EJ.globe) ch.classList.toggle('on', EJ.globe.toggle(ch.dataset.viz)); };
  });
  $('about-btn').onclick = () => $('about').classList.toggle('open');

  addEventListener('ej-globe-ready', () => {
    document.querySelectorAll('.chip[data-viz]').forEach(ch =>
      ch.classList.toggle('on', EJ.globe.layers[ch.dataset.viz]));
    render(+slider.value, false);
  });
  addEventListener('resize', () => EJ.chart.draw(+slider.value));
  render(EJ.YEAR_MIN, false);
})();
