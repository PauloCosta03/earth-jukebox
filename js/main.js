// Interface: linha do tempo 1880→2100, cenários, painéis (Camadas / Instrumentos / Ouvir /
// Acessibilidade / Sobre), camadas visuais (interruptores), camadas de áudio (cartões),
// leitura de quadros (globo, imagem/vídeo do EIC, partituras), varredura e gravação.
// Narração por voz, sons da interface, tela cheia, esconder interface e zoom: js/a11y.js.
(function () {
  const $ = id => document.getElementById(id);
  const slider = $('slider'), yearEl = $('year'), yearSub = $('year-sub'), msg = $('msg'), descEl = $('desc'),
        playBtn = $('play'), live = $('sr-live');
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const nf = (v, d) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

  let mode = 'globe';                 // 'globe' | 'frame' (imagem/vídeo/partitura)
  let media = null;                   // { kind: 'image'|'video'|'score', el, url, name, ... }
  let cur = EJ.YEAR_MIN;              // ano atual (fonte única da verdade)
  let scoreT = null, scorePlaying = false;
  let timer = null, lastF = null, recStart = null, announceT = null, soonT = null;
  let intro = true;                   // mantém a dica inicial até a primeira interação

  // O globo 3D usa módulos ES e texturas — não funciona abrindo o arquivo direto.
  if (location.protocol === 'file:') {
    const l = $('loading');
    l.classList.add('error');
    l.querySelector('p').innerHTML =
      'O globo 3D precisa de um servidor local.<br>Dê dois cliques em <b>run.bat</b> na pasta do projeto<br>e abra <b>http://localhost:8013</b>.';
  }


  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  const fmt = {
    temp: v => sign(v) + nf(Math.abs(v), 2) + ' °C',
    co2: v => nf(v, 0) + ' ppm',
    ice: v => v == null ? 'sem satélite' : nf(v, 1) + ' mi km²',
    sea: v => sign(v) + nf(Math.abs(v), 0) + ' mm',
    img: f => !f ? '–' : (f.topHues.length ? EJ.vision.hueName(f.topHues[0].bin) : 'sem cor') +
      ' · ' + Math.round(f.density * 100) + '% brilho'
  };

  // ---------------------------------------------------------------- acontecimentos (js/events.js)
  // Anos com acontecimento: os históricos (EJ.EVENTS) + os marcos do futuro (montados com os dados).
  const eventYears = () => [...Object.keys(EJ.EVENTS).map(Number), ...EJ.FUTURE_YEARS].sort((a, b) => a - b);
  const lastEventUpTo = y => eventYears().filter(k => k <= y).pop();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // temperatura em palavras (a voz lê melhor que "+0,45 °C")
  const tempWords = t => Math.abs(t) < 0.05 ? 'na média de 1951 a 1980'
    : `${nf(Math.abs(t), 1)} grau${Math.abs(t) >= 2 ? 's' : ''} ${t > 0 ? 'acima' : 'abaixo'} da média de 1951 a 1980`;

  function eventAt(y) {
    if (EJ.EVENTS[y]) return EJ.EVENTS[y];
    if (!EJ.FUTURE_YEARS.includes(y)) return null;
    const v = EJ.at(y), s = ({ ssp126: 'de emissões baixas', ssp245: 'intermediário', ssp585: 'de emissões muito altas' })[EJ.scenario];
    if (y === EJ.FUTURE_YEARS[0]) return { future: true, title: 'Começam as projeções',
      text: `Daqui em diante, os números vêm do modelo climático da NASA, no cenário ${s}. Troque o cenário no painel Camadas para ouvir a diferença.`,
      impact: EJ.impactFor(v.temp) };
    const ice = v.ice == null ? '' : ` O gelo do Ártico no fim do verão fica em ${nf(v.ice, 1)} milhões de quilômetros quadrados.`;
    const FUTURE_TITLES = { 2040: 'O mundo em 2040', 2050: 'Meados do século', 2075: 'O mundo em 2075', 2100: 'Fim do século' };
    return { future: true, title: FUTURE_TITLES[y] || `O mundo em ${y}`,
      text: `No cenário ${s}, o planeta fica ${tempWords(v.temp)}, e o gás carbônico chega a ${nf(v.co2, 0)} partes por milhão.${ice} O mar sobe ${nf(Math.max(0, v.sea) / 10, 0)} centímetros desde 1993.`,
      impact: EJ.impactFor(v.temp) + (y === EJ.YEAR_MAX ? ' Que música vamos deixar para quem vem depois?' : '') };
  }
  // texto falado completo: ano, título, o que aconteceu, impacto e os dados medidos naquele ano
  function eventSpeech(y, ev) {
    const v = EJ.at(y);
    const data = ev.future ? '' : ` Naquele ano, a temperatura estava ${tempWords(v.temp)}, e o gás carbônico em ${nf(v.co2, 0)} partes por milhão.`;
    return `${y}. ${ev.title}. ${ev.text} Impacto na Terra: ${ev.impact}${data}`;
  }
  // mostra o acontecimento na barra (para quem vê)
  function showEvent(y, ev, full = false) {
    const strong = document.createElement('strong');
    strong.textContent = `${y} · ${ev.title}`;
    msg.replaceChildren(strong, document.createTextNode(full ? ' — ' + ev.impact : ''));
    msg.classList.toggle('event', full);
  }
  // conta um acontecimento e só termina quando a fala termina (voz do app) ou após o tempo de leitura
  function tellEvent(y, ev) {
    clearTimeout(soonT);                              // não deixa a descrição do slider atropelar
    showEvent(y, ev, true);
    const text = eventSpeech(y, ev);
    const voiceOn = EJ.a11y && EJ.a11y.options.voice && 'speechSynthesis' in window;
    if (voiceOn) return EJ.a11y.speakAsync(text).then(() => wait(350));
    announce(text);                                   // o leitor de tela lê a região viva
    return wait(Math.max(3500, text.length * 62));    // ~16 caracteres por segundo
  }
  const storyOn = () => !EJ.a11y || EJ.a11y.options.story;

  // ---------------------------------------------------------------- utilidades de interface
  // troca o ícone de um botão: <svg><use href="#i-nome"></svg>
  const setIcon = (el, name) => { const u = el.querySelector('use'); if (u) u.setAttribute('href', '#i-' + name); };

  // Botão principal: um ícone e um rótulo por estado (o rótulo é o que a narração fala)
  const PLAY = {
    play:  { icon: 'play',  label: 'Tocar',  say: 'Tocar. Começa a música do clima: os anos passam de 1880 até 2100 e cada dado da NASA vira um instrumento. Atalho: barra de espaço.' },
    pause: { icon: 'pause', label: 'Pausar', say: 'Pausar. Para a música e a linha do tempo no ano atual. Atalho: barra de espaço.' },
    again: { icon: 'again', label: 'Tocar de novo', say: 'Tocar de novo. A música chegou em 2100; aperte para recomeçar de 1880.' },
    stop:  { icon: 'stop',  label: 'Parar',  say: 'Parar. Interrompe a partitura que está tocando.' },
  };
  function setPlay(state) {
    const s = PLAY[state];
    setIcon(playBtn, s.icon);
    playBtn.setAttribute('aria-label', s.label);
    playBtn.title = s.label + ' (Espaço)';
    playBtn.dataset.say = s.say;
    playBtn.classList.toggle('playing', state === 'pause' || state === 'stop');
  }

  // ---------------------------------------------------------------- acessibilidade
  function announce(text) {           // leitor de tela e narração: sobrescreve a região viva
    clearTimeout(announceT); live.textContent = '';
    announceT = setTimeout(() => (live.textContent = text), 60);
  }
  function announceSoon(text) {       // com espera, para quando o usuário arrasta o slider
    clearTimeout(soonT); soonT = setTimeout(() => announce(text), 700);
  }
  const scenarioLabel = () => EJ_PROJECTIONS[EJ.scenario].label;
  const scenarioShort = () => ({ ssp126: 'emissões baixas', ssp245: 'intermediário', ssp585: 'emissões muito altas' })[EJ.scenario];
  const harmonyOf = (v, f) => EJ.audio.modeFor(EJ.audio.tensionOf(v, f)).name;
  const LAYER_NAMES = { lights: 'luzes das cidades', sea: 'inundação', ice: 'gelo do Ártico', heat: 'mapa de calor',
    clouds: 'nuvens', ndvi: 'vegetação', fire: 'queimadas', wind: 'ventos', ozone: 'ozônio', ocean: 'correntes do mar' };

  // Descrição completa do que está na tela (botão Descrever e tecla D)
  function describeFull() {
    if (mode === 'frame') {
      if (media && media.kind === 'score') return `Partitura ${media.name}, com ${media.notes.length} notas. Aperte tocar para ouvir.`;
      return (media ? `Arquivo ${media.name}. ` : '') + (lastF ? EJ.vision.describe(lastF) +
        ` A música está em ${harmonyOf(null, lastF)}.` : 'Ainda sem quadro analisado.');
    }
    const v = EJ.at(cur);
    const on = EJ.globe ? Object.keys(EJ.globe.layers).filter(k => k !== 'spin' && EJ.globe.layers[k]) : [];
    return `${cur}${v.projected ? ', projeção no cenário ' + scenarioShort() : ', valor medido'}. ` +
      `Temperatura ${fmt.temp(v.temp)} em relação à média de 1951 a 1980; CO₂ ${fmt.co2(v.co2)}; ` +
      `gelo do Ártico ${fmt.ice(v.ice)}; nível do mar ${fmt.sea(v.sea)} em relação a 1993. ` +
      `A música está em ${harmonyOf(v)}: quanto mais quente, mais instável a harmonia. ` +
      (on.length ? `Camadas ligadas no globo: ${on.map(k => LAYER_NAMES[k] || k).join(', ')}. ` : 'Nenhuma camada ligada. ') +
      eventContext(cur) +
      (lastF ? EJ.vision.describe(lastF) : '');
  }
  function eventContext(y) {
    const ey = lastEventUpTo(y);
    if (ey == null) return '';
    const ev = eventAt(ey);
    return ey === y ? `Acontecimento deste ano: ${ev.title}. ${ev.impact} `
                    : `Último acontecimento: ${ey}, ${ev.title}. Aperte fecha colchete para ouvir o próximo. `;
  }

  // ---------------------------------------------------------------- renderização
  const globeFrame = () => (EJ.globe && EJ.globe.frame ? EJ.globe.frame() : null);
  const pct = y => ((y - EJ.YEAR_MIN) / (EJ.YEAR_MAX - EJ.YEAR_MIN) * 100).toFixed(2) + '%';
  slider.style.setProperty('--now', pct(EJ.YEAR_NOW));

  function render(y, sound = true) {
    cur = y;
    const v = EJ.at(y);
    yearEl.textContent = y; slider.value = y;
    slider.style.setProperty('--pct', pct(y));
    slider.style.setProperty('--fill', v.projected ? 'var(--accent-2)' : '#ff7a52');
    yearSub.textContent = v.projected ? 'projeção · ' + scenarioShort() : 'medido';
    // texto que leitores de tela falam ao mexer no controle de ano
    const evHere = eventAt(y);
    slider.setAttribute('aria-valuetext', `${y}${v.projected ? ', projeção' : ''}, temperatura ${fmt.temp(v.temp)}` +
      (evHere ? `, acontecimento: ${evHere.title}` : ''));
    yearEl.classList.toggle('proj', v.projected);
    EJ.LAYERS.forEach(k => ($('v-' + k).textContent = fmt[k](v[k])));
    if (sound) intro = false;
    const ey = lastEventUpTo(y);
    if (ey != null && !intro && !(holding && ey === y)) showEvent(ey, eventAt(ey));
    if (evHere && sound && !storyOn()) announce(`${y}: ${evHere.title}.`);
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
      setIcon(mute, s.off.has(k) ? 'volume-off' : 'volume');
    });
    if (mode === 'globe') EJ.chart.draw(cur);
  }

  // ---------------------------------------------------------------- reprodução
  // playing = linha do tempo do globo tocando · holding = parada num acontecimento, contando.
  // runId muda a cada tocar/parar: um "contar" antigo que termine depois não reinicia nada.
  let playing = false, holding = false, toldYear = null, runId = 0;

  function stop(state = 'play') {
    EJ.audio.stopNotes(); clearTimeout(scoreT); scorePlaying = false;
    playing = false; holding = false; runId++;
    clearTimeout(timer); clearInterval(timer); timer = null; setPlay(state);
    if (media && media.kind === 'video') media.el.pause();
  }

  function startGlobe() {
    if (cur >= EJ.YEAR_MAX) { cur = EJ.YEAR_MIN; toldYear = null; }
    playing = true;
    step(++runId);
  }
  function step(id) {
    if (!playing || id !== runId) return;
    render(cur);
    const advance = () => {
      if (!playing || id !== runId) return;
      if (cur >= EJ.YEAR_MAX) {
        if ($('loop').checked) { cur = EJ.YEAR_MIN; toldYear = null; }
        else { stop('again'); announce('Fim da linha do tempo, 2100. Aperte tocar para recomeçar.'); return; }
      } else cur++;
      timer = setTimeout(() => step(id), EJ.TICK_MS);
    };
    const ev = eventAt(cur);
    if (ev && storyOn() && toldYear !== cur) {         // modo história: pausa e conta
      toldYear = cur; holding = true;
      tellEvent(cur, ev).then(() => { holding = false; advance(); });
    } else advance();
  }

  // pula para o acontecimento anterior/próximo e conta (teclas [ e ], botões ⏮ ⏭)
  function jumpEvent(dir) {
    if (mode !== 'globe') return;
    EJ.audio.init();
    const years = eventYears();
    const target = dir > 0 ? years.find(y => y > cur) : [...years].reverse().find(y => y < cur);
    if (target == null) { announce(dir > 0 ? 'Não há mais acontecimentos depois deste ano.' : 'Este é o primeiro acontecimento.'); return; }
    const resume = playing;
    stop(resume ? 'pause' : 'play');
    const id = runId;
    holding = true; intro = false;
    render(target, true);
    toldYear = target;
    tellEvent(target, eventAt(target)).then(() => {
      holding = false;
      if (resume && id === runId) startGlobe();        // estava tocando: continua dali
    });
  }

  function startFrame() {
    if (!media) return;
    if (media.kind === 'video') media.el.play().catch(() => {});
    timer = setInterval(tickFrame, EJ.TICK_MS);
  }

  playBtn.onclick = () => {
    EJ.audio.init();
    if (playing || timer) { stop(); announce(`Pausado em ${cur}.`); return; }
    if (mode === 'frame' && media && media.score) { $('scan').click(); return; }   // imagem-partitura: Tocar = Varrer
    if (mode === 'frame' && media && media.kind === 'score') {                     // arquivo de partitura
      if (scorePlaying) { stop(); announce('Parado.'); return; }
      const secs = EJ.audio.playNotes(media.notes);
      scorePlaying = true; setPlay('stop');
      scoreT = setTimeout(() => { scorePlaying = false; setPlay('again'); }, secs * 1000);
      return;
    }
    setPlay('pause');
    clearTimeout(soonT);
    if (mode === 'globe') { announce(`Tocando a partir de ${cur >= EJ.YEAR_MAX ? EJ.YEAR_MIN : cur}.`); startGlobe(); }
    else startFrame();
  };

  $('ev-prev').onclick = () => jumpEvent(-1);
  $('ev-next').onclick = () => jumpEvent(1);

  $('mute').onclick = e => {
    const btn = e.currentTarget, m = EJ.audio.toggleMute();
    setIcon(btn, m ? 'volume-off' : 'volume');
    btn.setAttribute('aria-pressed', String(m));
    btn.setAttribute('aria-label', m ? 'Devolver o som da música' : 'Silenciar a música');
  };

  $('volume').oninput = e => {
    EJ.audio.init();
    EJ.audio.setVolume(e.target.value / 100);
    e.target.style.setProperty('--pct', e.target.value + '%');
    e.target.setAttribute('aria-valuetext', e.target.value + ' por cento');
  };
  $('volume').style.setProperty('--pct', $('volume').value + '%');

  // cenários: cartões de rádio
  const scenarioInputs = document.querySelectorAll('input[name="scenario"]');
  scenarioInputs.forEach(r => r.addEventListener('change', () => {
    if (!r.checked) return;
    EJ.scenario = r.value;
    EJ.audio.init();
    render(cur, true);                       // ouve o mesmo ano no novo cenário (comparação A/B)
    announce(`Cenário ${scenarioLabel()}. ` + describeFull());
  }));

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
    // modo partitura: imagens com "partitura" no nome tocam na escala maior, em andamento de música
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

  const recBtn = $('rec'), recLabel = recBtn.querySelector('.rec-label');
  recBtn.onclick = async () => {
    EJ.audio.init();
    if (EJ.audio.rec.active) {
      const blob = await EJ.audio.rec.stop();
      recBtn.classList.remove('recording'); recLabel.textContent = 'Gravar áudio'; setIcon(recBtn, 'record');
      if (!blob) return;
      const ext = /ogg/.test(blob.type) ? 'ogg' : /mp4/.test(blob.type) ? 'm4a' : 'webm';
      const span = mode === 'globe' ? `${recStart}-${cur}` : 'frame';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `earth-jukebox-${mode === 'globe' ? EJ.scenario : 'eic'}-${span}.${ext}`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      announce('Gravação salva na pasta de downloads.');
    } else if (EJ.audio.rec.start()) {
      recStart = cur; recBtn.classList.add('recording'); recLabel.textContent = 'Parar gravação'; setIcon(recBtn, 'stop');
      announce('Gravando o áudio. Aperte tocar para gerar música e aperte de novo em gravar para salvar.');
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
    document.body.classList.toggle('is-image', frame && media && media.kind !== 'video');
    $('globe-btn').hidden = !frame;
    scenarioInputs.forEach(r => (r.disabled = frame));
    document.querySelectorAll('.chip[data-viz]').forEach(c => (c.disabled = frame));
    EJ.audio.setMode(m);
    if (EJ.globe) EJ.globe.setActive(!frame);
    if (frame) {
      slider.min = 0; slider.max = 1000; slider.value = 0;
      slider.labels[0].textContent = 'Posição no vídeo'; slider.removeAttribute('aria-valuetext');
      slider.style.setProperty('--now', '100%'); slider.style.setProperty('--pct', '0%');
      yearEl.textContent = '0:00'; yearSub.textContent = 'tempo'; yearEl.classList.remove('proj');
    } else {
      slider.min = EJ.YEAR_MIN; slider.max = EJ.YEAR_MAX;
      slider.labels[0].textContent = 'Ano';
      slider.style.setProperty('--now', pct(EJ.YEAR_NOW));
      lastF = null; render(cur, false);
      msg.textContent = 'De volta ao globo. Aperte Tocar para ouvir o clima.';
    }
    refreshCards();
  }

  function loadMedia(file) {
    if (!file) return;
    const video = file.type.startsWith('video/'), image = file.type.startsWith('image/');
    if (!video && !image) { msg.textContent = 'Formato não suportado: use imagem ou vídeo.'; announce(msg.textContent); return; }
    stop();
    if (media && media.url) URL.revokeObjectURL(media.url);
    const url = URL.createObjectURL(file);
    const el = document.createElement(video ? 'video' : 'img');
    el.src = url;
    if (video) {
      el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
      el.ontimeupdate = () => {
        if (!el.duration) return;
        slider.value = Math.round(el.currentTime / el.duration * 1000);
        slider.style.setProperty('--pct', (el.currentTime / el.duration * 100).toFixed(1) + '%');
        yearEl.textContent = fmtTime(el.currentTime);
      };
    } else el.alt = 'Imagem carregada: ' + file.name;
    $('frame-view').replaceChildren(el);
    media = { kind: video ? 'video' : 'image', el, url, name: file.name, score: /partitura/i.test(file.name) };
    EJ.vision.reset(); lastF = null;
    setMode('frame');
    msg.textContent = media.score ? `Partitura ${file.name}: aperte Tocar (ou S) para ouvir a melodia.`
                                  : `${file.name}: escolha um perfil de som e aperte Tocar ou Varrer.`;
    announce(`${video ? 'Vídeo' : 'Imagem'} ${file.name} carregado. Aperte tocar ou varrer para ouvir.`);
    const first = () => { lastF = EJ.vision.analyze(el); if (lastF) descEl.textContent = EJ.vision.describe(lastF); };
    video ? (el.onloadeddata = first) : (el.onload = first);
  }

  $('frame-btn').onclick = () => $('file').click();
  $('file').onchange = e => { loadMedia(e.target.files[0]); e.target.value = ''; };
  $('globe-btn').onclick = () => { setMode('globe'); announce('De volta ao globo.'); };
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && EJ.score.isScoreFile(f.name)) loadScore(f); else loadMedia(f);
  });

  // ---------------------------------------------------------------- partituras (score.js)
  // Desenha as notas como um "rolo de piano" (tempo → direita, altura → cima) para quem vê.
  function pianoRoll(notes, title) {
    const W = 1600, H = 900, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), end = Math.max(...notes.map(n => n.start + n.dur));
    const lo = Math.min(...notes.map(n => n.midi)) - 2, hi = Math.max(...notes.map(n => n.midi)) + 2;
    g.fillStyle = '#050a18'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#8fa1c4'; g.font = '36px "Space Grotesk", system-ui'; g.fillText(title || 'Partitura', 40, 60);
    const x = t => 40 + t / end * (W - 80), y = m => 120 + (hi - m) / (hi - lo) * (H - 180);
    for (const n of notes) {
      g.fillStyle = `hsl(${(n.midi % 12) * 30}, 80%, 70%)`;
      g.beginPath();
      g.roundRect(x(n.start), y(n.midi) - 6, Math.max(4, x(n.start + n.dur) - x(n.start) - 2), 12, 6);
      g.fill();
    }
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `Partitura ${title || ''} com ${notes.length} notas`);
    return cv;
  }

  async function loadScore(file) {
    if (!file) return;
    stop();
    msg.textContent = `Lendo ${file.name}…`;
    let res, view;
    try {
      if (EJ.score.isScoreFile(file.name)) {
        res = await EJ.score.load(file);
        view = pianoRoll(res.notes, res.title || file.name);
      } else if (file.type.startsWith('image/')) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();
        res = EJ.score.readImage(img);
        // mostra a imagem com as notas encontradas marcadas (para conferir a leitura)
        view = document.createElement('canvas'); view.width = img.naturalWidth; view.height = img.naturalHeight;
        const g = view.getContext('2d'); g.drawImage(img, 0, 0);
        g.strokeStyle = '#00c27a'; g.lineWidth = Math.max(2, img.naturalWidth / 500);
        res.marks.forEach(m => { g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.stroke(); });
        view.setAttribute('role', 'img');
        view.setAttribute('aria-label', `Partitura lida: ${res.notes.length} notas em ${res.staves} pautas`);
      } else throw new Error('use MusicXML, MIDI ou imagem');
    } catch (err) {
      msg.textContent = `Não consegui ler ${file.name}: ${err.message}`;
      announce(msg.textContent);
      return;
    }
    if (!res.notes.length) { msg.textContent = 'A partitura não tem notas.'; announce(msg.textContent); return; }
    $('frame-view').replaceChildren(view);
    media = { kind: 'score', el: view, url: null, name: file.name, notes: res.notes };
    setMode('frame');
    const secs = Math.round(Math.max(...res.notes.map(n => n.start + n.dur)));
    const first = res.notes.slice(0, 8).map(n => EJ.score.noteName(n.midi)).join(', ');
    msg.textContent = `${res.title || file.name}: ${res.notes.length} notas, ${secs} s` +
      (res.experimental ? ' (leitura de imagem experimental — confira as marcas verdes)' : '') + '. Aperte Tocar.';
    announce(`Partitura carregada: ${res.notes.length} notas, ${secs} segundos. Começa com ${first}. Aperte tocar.`);
  }
  $('score-btn').onclick = () => $('score-file').click();
  $('score-file').onchange = e => { loadScore(e.target.files[0]); e.target.value = ''; };

  // ---------------------------------------------------------------- cartões (áudio) e camadas (globo)
  document.querySelectorAll('.card').forEach(card => {
    const k = card.dataset.layer;
    card.querySelector('.solo').onclick = () => { EJ.audio.init(); EJ.audio.toggleSolo(k); refreshCards(); };
    card.querySelector('.mute-layer').onclick = () => { EJ.audio.init(); EJ.audio.toggleLayer(k); refreshCards(); };
  });

  // interruptores das camadas: aria-checked faz a narração/leitor de tela dizer "ligado/desligado"
  const chips = document.querySelectorAll('.chip[data-viz]');
  const syncChips = () => chips.forEach(ch => ch.setAttribute('aria-checked', String(!!EJ.globe.layers[ch.dataset.viz])));
  chips.forEach(ch => {
    ch.onclick = () => { if (EJ.globe) { EJ.globe.toggle(ch.dataset.viz); syncChips(); } };
  });

  // ---------------------------------------------------------------- painéis
  // um botão abre, o mesmo botão (ou X, ou Esc) fecha; só um aberto por vez.
  // Ao abrir, o foco vai para o título do painel (a narração lê o que ele faz).
  const tools = [...document.querySelectorAll('.tool')];
  const panelOf = btn => $(btn.getAttribute('aria-controls'));
  function setOpen(btn, open, focus = true) {
    const panel = panelOf(btn);
    if (open === !panel.hidden) return;
    btn.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    if (open) {
      if (panel.id === 'p-sound' && mode === 'globe') EJ.chart.draw(cur);     // gráfico precisa estar visível
      if (focus) panel.querySelector('h2').focus();
    }
    const anyOpen = tools.some(b => b.getAttribute('aria-expanded') === 'true');
    document.body.classList.toggle('drawer-open', anyOpen);
    // tela larga: a Terra desliza para a esquerda e não fica atrás do painel
    const shown = document.querySelector('.drawer:not([hidden])');
    if (EJ.globe && EJ.globe.setShift) EJ.globe.setShift(anyOpen && innerWidth >= 992 && shown ? shown.offsetWidth / 2 + 12 : 0);
    dispatchEvent(new CustomEvent('ej-panel', { detail: { id: panel.id, open } }));   // sons da interface
  }
  function openPanel(id) {
    tools.forEach(b => { if (b.getAttribute('aria-controls') !== id) setOpen(b, false); });
    setOpen(tools.find(b => b.getAttribute('aria-controls') === id), true);
  }
  function closePanels(returnFocus = true) {
    const openBtn = tools.find(b => b.getAttribute('aria-expanded') === 'true');
    if (!openBtn) return false;
    setOpen(openBtn, false);
    if (returnFocus) openBtn.focus();                 // devolve o foco ao botão que abriu
    return true;
  }
  tools.forEach(btn => btn.onclick = () => {
    if (btn.getAttribute('aria-expanded') === 'true') closePanels();
    else openPanel(btn.getAttribute('aria-controls'));
  });
  document.querySelectorAll('.drawer .close').forEach(c => (c.onclick = () => closePanels()));

  // ---------------------------------------------------------------- teclado
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (closePanels()) e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, typing = t.closest && t.closest('input,select,textarea');
    if (e.key === ' ' && t === document.body) { e.preventDefault(); playBtn.click(); }
    else if (!typing && /^[sS]$/.test(e.key)) $('scan').click();
    else if (!typing && /^[dD]$/.test(e.key)) $('describe').click();
    else if (!typing && /^[mM]$/.test(e.key)) $('mute').click();
    else if (!typing && e.key === ']') { e.preventDefault(); jumpEvent(1); }
    else if (!typing && e.key === '[') { e.preventDefault(); jumpEvent(-1); }
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

  // usado por js/a11y.js (atalhos, guia, reduzir movimento)
  EJ.ui = { openPanel, closePanels, announce, setIcon, syncChips, describe: describeFull, isPlaying: () => playing || !!timer || scorePlaying };

  setPlay('play');
  refreshCards();
  render(EJ.YEAR_MIN, false);
})();
