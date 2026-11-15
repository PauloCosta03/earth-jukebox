// Interface: timeline 1880→2100, cenários, caixinhas (Camadas / Instrumentos / Sobre),
// camadas visuais (chips), camadas de áudio (cards), leitura de quadros (globo ou
// imagem/vídeo do EIC), varredura, gravação e acessibilidade.
// Junta o trabalho da equipe: interface em caixinhas + visão computacional (vision.js).
(function () {
  const $ = id => document.getElementById(id);
  const slider = $('slider'), yearEl = $('year'), msg = $('msg'), descEl = $('desc'),
        playBtn = $('play'), live = $('sr-live');
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const nf = (v, d) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

  let mode = 'globe';                 // 'globe' | 'frame' (imagem/vídeo do EIC)
  let media = null;                   // { kind: 'image'|'video', el, url, name }
  let cur = EJ.YEAR_MIN;              // ano atual (fonte única da verdade)
  let timer = null, lastF = null, recStart = null, announceT = null, soonT = null;

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
    [EJ.YEAR_NOW + 1]: 'A partir daqui: projeções do modelo climático da NASA (GISS, CMIP6).',
    2050: 'Meados do século: o cenário escolhido decide a música.',
    2100: 'Fim do século. Que música vamos deixar?'
  };

  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  const fmt = {
    temp: v => sign(v) + nf(Math.abs(v), 2) + ' °C',
    co2: v => nf(v, 0) + ' ppm',
    ice: v => v == null ? 'sem satélite' : nf(v, 1) + ' mi km²',
    sea: v => sign(v) + nf(Math.abs(v), 0) + ' mm',
    img: f => !f ? '–' : (f.topHues.length ? EJ.vision.hueName(f.topHues[0].bin) : 'sem cor') +
      ' · ' + Math.round(f.density * 100) + '% brilho'
  };

  // ---------------------------------------------------------------- acessibilidade
  function announce(text) {           // leitor de tela: sobrescreve a região viva
    clearTimeout(announceT); live.textContent = '';
    announceT = setTimeout(() => (live.textContent = text), 60);
  }
  function announceSoon(text) {       // com espera, para quando o usuário arrasta o slider
    clearTimeout(soonT); soonT = setTimeout(() => announce(text), 700);
  }
  const scenarioLabel = () => EJ_PROJECTIONS[EJ.scenario].label;
  const harmonyOf = (v, f) => EJ.audio.modeFor(EJ.audio.tensionOf(v, f)).name;

  // Descrição completa do que está na tela (botão 🗣️ e tecla D)
  function describeFull() {
    if (mode === 'frame') {
      return (media ? `Arquivo ${media.name}. ` : '') + (lastF ? EJ.vision.describe(lastF) +
        ` A música está em ${harmonyOf(null, lastF)}.` : 'Ainda sem quadro analisado.');
    }
    const v = EJ.at(cur);
    const on = EJ.globe ? Object.keys(EJ.globe.layers).filter(k => k !== 'spin' && EJ.globe.layers[k]) : [];
    const names = { lights: 'luzes', sea: 'inundação', ice: 'gelo', heat: 'mapa de calor', clouds: 'nuvens',
                    ndvi: 'vegetação', fire: 'queimadas', wind: 'ventos', ozone: 'ozônio', ocean: 'correntes do mar' };
    return `${cur}${v.projected ? ', projeção ' + scenarioLabel() : ''}. ` +
      `Temperatura ${fmt.temp(v.temp)} em relação à média de 1951 a 1980; CO₂ ${fmt.co2(v.co2)}; ` +
      `gelo do Ártico ${fmt.ice(v.ice)}; nível do mar ${fmt.sea(v.sea)} em relação a 1993. ` +
      `A música está em ${harmonyOf(v)}: quanto mais quente, mais instável a harmonia. ` +
      (on.length ? `Camadas ligadas no globo: ${on.map(k => names[k] || k).join(', ')}. ` : '') +
      (lastF ? EJ.vision.describe(lastF) : '');
  }

  // ---------------------------------------------------------------- renderização
  const globeFrame = () => (EJ.globe && EJ.globe.frame ? EJ.globe.frame() : null);

  function render(y, sound = true) {
    cur = y;
    const v = EJ.at(y);
    yearEl.textContent = y; slider.value = y;
    // texto que o leitor de tela fala ao mexer no controle de ano
    slider.setAttribute('aria-valuetext', `${y}${v.projected ? ' (projeção)' : ''}, temperatura ${fmt.temp(v.temp)}`);
    yearEl.classList.toggle('proj', v.projected);
    EJ.LAYERS.forEach(k => ($('v-' + k).textContent = fmt[k](v[k])));
    const ev = Object.keys(events).map(Number).filter(k => k <= y).pop();
    if (ev) msg.textContent = `${ev}: ${events[ev]}`;
    if (events[y] && sound) announce(`${y}: ${events[y]}`);
    EJ.chart.draw(y);
    if (EJ.globe) EJ.globe.update(v);
    if (sound) {
      lastF = EJ.vision.analyze(globeFrame());      // o som também lê o próprio quadro do globo
      EJ.audio.play(v, lastF);
      $('v-img').textContent = fmt.img(lastF);
      descEl.textContent = (lastF ? EJ.vision.describe(lastF) + ' ' : '') + `Harmonia: ${harmonyOf(v, lastF)}.`;
    }
  }

  function tickFrame() {
    const f = EJ.vision.analyze(media && media.el);
    if (!f) return;
    lastF = f;
    EJ.audio.play(null, f);
    $('v-img').textContent = fmt.img(f);
    descEl.textContent = EJ.vision.describe(f) + ` Harmonia: ${harmonyOf(null, f)}.`;
  }

  function refreshCards() {
    document.querySelectorAll('.card').forEach(c => {
      const k = c.dataset.layer, s = EJ.audio.state, mute = c.querySelector('.mute-layer');
      c.querySelector('.solo').setAttribute('aria-pressed', String(s.solo === k));   // "solo ligado/desligado"
      c.classList.toggle('off', !EJ.audio.audible(k));
      mute.setAttribute('aria-pressed', String(s.off.has(k)));                       // "silenciado ou não"
      mute.textContent = s.off.has(k) ? '🔇' : '🔊';
    });
    if (mode === 'globe') EJ.chart.draw(cur);
  }

  // ---------------------------------------------------------------- reprodução
  function stop(label = '▶ Tocar') {
    clearInterval(timer); timer = null; playBtn.textContent = label;
    if (media && media.kind === 'video') media.el.pause();
  }

  function startGlobe() {
    if (cur >= EJ.YEAR_MAX) cur = EJ.YEAR_MIN;
    timer = setInterval(() => {
      render(cur);
      if (cur >= EJ.YEAR_MAX) {
        if ($('loop').checked) cur = EJ.YEAR_MIN; else stop('↺ De novo');
      } else cur++;
    }, EJ.TICK_MS);
  }

  function startFrame() {
    if (!media) return;
    if (media.kind === 'video') media.el.play().catch(() => {});
    timer = setInterval(tickFrame, EJ.TICK_MS);
  }

  playBtn.onclick = () => {
    EJ.audio.init();
    if (timer) { stop(); announce('Pausado.'); return; }
    if (mode === 'frame' && media && media.score) { $('scan').click(); return; }   // partitura: Tocar = Varrer
    playBtn.textContent = '⏸ Pausar';
    mode === 'globe' ? startGlobe() : startFrame();
  };

  $('mute').onclick = e => {
    const m = EJ.audio.toggleMute();
    e.currentTarget.textContent = m ? '🔇' : '🔊';
    e.currentTarget.setAttribute('aria-pressed', String(m));
  };

  $('scenario').onchange = e => {
    EJ.scenario = e.target.value;
    EJ.audio.init();
    render(cur, true);                       // ouve o mesmo ano no novo cenário (comparação A/B)
    announce(`Cenário ${scenarioLabel()}. ` + describeFull());
  };

  slider.oninput = () => {
    EJ.audio.init();
    if (mode === 'frame') {
      if (media && media.kind === 'video' && media.el.duration) media.el.currentTime = slider.value / 1000 * media.el.duration;
      return;
    }
    render(+slider.value);
    announceSoon(describeFull());
  };

  // ---------------------------------------------------------------- varredura, descrição, gravação
  $('scan').onclick = () => {
    EJ.audio.init();
    const f = EJ.vision.analyze(mode === 'frame' ? (media && media.el) : globeFrame());
    if (!f) { msg.textContent = 'Nenhum quadro disponível para varrer ainda.'; return; }
    lastF = f;
    // 🎼 modo partitura: imagens com "partitura" no nome tocam na escala maior, em andamento de música
    const score = mode === 'frame' && media && media.score;
    const secs = score ? 12 : 6, tension = mode === 'frame' ? EJ.audio.tensionOf(null, f) : EJ.audio.tensionOf(EJ.at(cur), f);
    EJ.audio.scan(f, secs, tension, score ? EJ.audio.MAJOR : null);
    const sl = $('scanline');
    sl.style.setProperty('--dur', secs + 's'); sl.classList.remove('run'); void sl.offsetWidth; sl.classList.add('run');
    announce('Varrendo a imagem da esquerda para a direita: notas mais agudas são partes mais altas da imagem. ' + EJ.vision.describe(f));
  };

  $('describe').onclick = () => {
    if (mode === 'globe' && !lastF) lastF = EJ.vision.analyze(globeFrame());
    const t = describeFull();
    descEl.textContent = t; announce(t);
  };

  const recBtn = $('rec');
  recBtn.onclick = async () => {
    EJ.audio.init();
    if (EJ.audio.rec.active) {
      const blob = await EJ.audio.rec.stop();
      recBtn.classList.remove('recording'); recBtn.textContent = '⏺ Gravar áudio';
      if (!blob) return;
      const ext = /ogg/.test(blob.type) ? 'ogg' : /mp4/.test(blob.type) ? 'm4a' : 'webm';
      const span = mode === 'globe' ? `${recStart}-${cur}` : 'frame';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `earth-jukebox-${mode === 'globe' ? EJ.scenario : 'eic'}-${span}.${ext}`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      announce('Gravação salva.');
    } else if (EJ.audio.rec.start()) {
      recStart = cur; recBtn.classList.add('recording'); recBtn.textContent = '⏹ Parar gravação';
      announce('Gravando o áudio. Aperte tocar para gerar música.');
    } else msg.textContent = 'Seu navegador não suporta gravação de áudio.';
  };

  // ---------------------------------------------------------------- imagem/vídeo do EIC
  const prof = $('profile');
  Object.entries(EJ.audio.PROFILES).forEach(([k, p]) => prof.add(new Option(p.label, k)));
  prof.onchange = () => { EJ.audio.setProfile(prof.value); announce('Perfil de som: ' + EJ.audio.PROFILES[prof.value].label); };

  const fmtTime = s => { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function setMode(m) {
    mode = m; stop();
    const frame = m === 'frame';
    document.body.classList.toggle('frame-mode', frame);
    document.body.classList.toggle('is-image', frame && media && media.kind === 'image');
    $('globe-btn').hidden = !frame;
    $('scenario').disabled = frame;
    document.querySelectorAll('[data-viz]').forEach(c => (c.disabled = frame));
    EJ.audio.setMode(m);
    if (EJ.globe) EJ.globe.setActive(!frame);
    if (frame) {
      slider.min = 0; slider.max = 1000; slider.value = 0;
      $('slider').labels[0].textContent = 'Posição no vídeo'; slider.removeAttribute('aria-valuetext');
      yearEl.textContent = '0:00'; yearEl.classList.remove('proj');
    } else {
      slider.min = EJ.YEAR_MIN; slider.max = EJ.YEAR_MAX;
      $('slider').labels[0].textContent = 'Ano';
      lastF = null; render(cur, false);
      msg.textContent = 'Aperte tocar e escute 220 anos de clima.';
    }
    refreshCards();
  }

  function loadMedia(file) {
    if (!file) return;
    const video = file.type.startsWith('video/'), image = file.type.startsWith('image/');
    if (!video && !image) { msg.textContent = 'Formato não suportado: use imagem ou vídeo.'; return; }
    stop();
    if (media) URL.revokeObjectURL(media.url);
    const url = URL.createObjectURL(file);
    const el = document.createElement(video ? 'video' : 'img');
    el.src = url;
    if (video) {
      el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
      el.ontimeupdate = () => {
        if (!el.duration) return;
        slider.value = Math.round(el.currentTime / el.duration * 1000);
        yearEl.textContent = fmtTime(el.currentTime);
      };
    } else el.alt = 'Imagem carregada: ' + file.name;
    $('frame-view').replaceChildren(el);
    media = { kind: video ? 'video' : 'image', el, url, name: file.name, score: /partitura/i.test(file.name) };
    EJ.vision.reset(); lastF = null;
    setMode('frame');
    msg.textContent = media.score ? `🎼 Partitura ${file.name}: aperte Tocar (ou S) para ouvir a melodia.` : `${file.name}: escolha um perfil de som e aperte Tocar ou Varrer.`;
    announce(`${video ? 'Vídeo' : 'Imagem'} ${file.name} carregado. Aperte tocar ou varrer para ouvir.`);
    const first = () => { lastF = EJ.vision.analyze(el); if (lastF) descEl.textContent = EJ.vision.describe(lastF); };
    video ? (el.onloadeddata = first) : (el.onload = first);
  }

  $('frame-btn').onclick = () => $('file').click();
  $('file').onchange = e => { loadMedia(e.target.files[0]); e.target.value = ''; };
  $('globe-btn').onclick = () => { setMode('globe'); announce('De volta ao globo.'); };
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); loadMedia(e.dataTransfer.files[0]); });

  // ---------------------------------------------------------------- cards (áudio) e chips (globo)
  document.querySelectorAll('.card').forEach(card => {
    const k = card.dataset.layer;
    card.querySelector('.solo').onclick = () => { EJ.audio.init(); EJ.audio.toggleSolo(k); refreshCards(); };
    card.querySelector('.mute-layer').onclick = () => { EJ.audio.init(); EJ.audio.toggleLayer(k); refreshCards(); };
  });

  // aria-pressed faz o leitor de tela dizer "ligado/desligado"
  const chips = document.querySelectorAll('.chip[data-viz]');
  const syncChips = () => chips.forEach(ch => ch.setAttribute('aria-pressed', String(!!EJ.globe.layers[ch.dataset.viz])));
  chips.forEach(ch => {
    ch.onclick = () => { if (EJ.globe) { EJ.globe.toggle(ch.dataset.viz); syncChips(); } };
  });

  // ---------------------------------------------------------------- caixinhas
  // um botão abre, o mesmo botão (ou Esc) fecha; só uma aberta por vez
  const tools = document.querySelectorAll('.tool');
  function setOpen(btn, open) {
    const panel = $(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', String(open));   // leitor de tela anuncia "expandido/recolhido"
    panel.hidden = !open;
    if (open && panel.id === 'p-sound' && mode === 'globe') EJ.chart.draw(cur);  // gráfico precisa estar visível
  }
  tools.forEach(btn => btn.onclick = () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    tools.forEach(b => setOpen(b, false));
    setOpen(btn, open);
  });

  // ---------------------------------------------------------------- teclado
  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const openBtn = [...tools].find(b => b.getAttribute('aria-expanded') === 'true');
      if (openBtn) { setOpen(openBtn, false); openBtn.focus(); }      // devolve o foco ao botão
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, typing = t.closest && t.closest('input,select,textarea');
    if (e.key === ' ' && t === document.body) { e.preventDefault(); playBtn.click(); }
    else if (!typing && /^[sS]$/.test(e.key)) $('scan').click();
    else if (!typing && /^[dD]$/.test(e.key)) $('describe').click();
    else if (!typing && /^[mM]$/.test(e.key)) $('mute').click();
    else if (t === document.body && mode === 'globe' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      EJ.audio.init();
      render(clamp(cur + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1), EJ.YEAR_MIN, EJ.YEAR_MAX));
      announceSoon(describeFull());
    }
  });

  addEventListener('ej-globe-ready', () => {
    // Quem pediu ao sistema "reduzir movimento" recebe a Terra parada (pode ligar em Camadas)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches && EJ.globe.layers.spin) EJ.globe.toggle('spin');
    syncChips();
    render(cur, false);
  });
  addEventListener('resize', () => { if (mode === 'globe') EJ.chart.draw(cur); });
  refreshCards();
  render(EJ.YEAR_MIN, false);
})();
