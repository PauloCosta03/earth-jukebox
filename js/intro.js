// 🎬 Introdução (intro.html): aparece no primeiro acesso, antes do Earth Jukebox.
//  1. Escolha do idioma (P = português, E = English, ou os botões).
//  2. Qualquer letra ou número começa a apresentação falada (3 frases); Esc pula.
//  3. "Ouvir o guia ao entrar" + Entrar → salva a escolha e abre o index.html.
// Voz: inglês usa a narração gravada (narrator-online.js); português usa a voz do navegador;
// se nenhuma funcionar, a voz offline (narrator-fallback.js). Reabrir: botão "Reassistir à introdução".
window.EJ = window.EJ || {};
EJ.intro = (() => {
  const $ = id => document.getElementById(id);
  const synth = window.speechSynthesis;
  let generation = 0, stage = 'language', language = null, pendingDone = null;
  const timers = new Set();
  const captions = [
    ['Bem-vindo ao Earth Jukebox.', 'Welcome to Earth Jukebox.'],
    ['Uma experiência do Grupo Orichalcum para o NASA Space Apps Challenge. Dados ambientais da NASA se transformam em música e imagens sobre a Terra.',
     'An experience by Grupo Orichalcum for the NASA Space Apps Challenge. NASA environmental data becomes music and images of Earth.'],
    ['Explore o planeta em três dimensões, ouça os instrumentos do clima e acompanhe sua história.',
     'Explore our planet in three dimensions, listen to the instruments of climate, and follow its history.'],
  ];
  $('intro-guide').checked = EJ.introPreferences.read().guide;
  function stop() {
    generation++;
    timers.forEach(clearTimeout); timers.clear();
    synth?.cancel(); EJ.narratorOnline?.stop(); EJ.narratorFallback?.stop();
    pendingDone?.(false); pendingDone = null;
    document.body.classList.remove('narrating');
  }
  function freeze() {
    document.body.classList.add('intro-stopped');
    EJ.globe?.setActive(false);
  }
  function choose() {
    if (!language || stage === 'entry' || stage === 'leaving') return;
    stop(); stage = 'entry'; freeze();
    $('intro-skip').hidden = true;
    $('intro-caption').textContent = EJ.L('Seu planeta. Sua música.', 'Your planet. Your music.');
    $('intro-entry').hidden = false;
    $('intro-progress').textContent = '03 / 03';
    $('intro-enter').focus();
  }
  function selectLanguage(value) {
    if (stage !== 'language' || !['pt', 'en'].includes(value)) return;
    synth?.cancel();                                            // para a fala das opções
    language = value; EJ.i18n.set(value); stage = 'ready';
    $('intro-choice').hidden = true;
    $('intro-skip').hidden = false;
    $('intro-skip').textContent = EJ.L('Pular introdução (ESC)', 'Skip introduction (ESC)');
    $('intro-skip').setAttribute('aria-label', $('intro-skip').textContent);
    $('intro-caption').textContent = EJ.L('Pressione qualquer tecla alfanumérica para iniciar a introdução.', 'Press any letter or number key to start the introduction.');
    $('intro-caption').lang = value === 'pt' ? 'pt-BR' : 'en';
    document.querySelector('.intro-subtitle').textContent = EJ.L('A música do planeta', 'The music of our planet');
    $('intro-footer-label').textContent = EJ.L('Ciência · Música · Terra', 'Science · Music · Earth');
    $('intro-guide-label').textContent = EJ.L('Ouvir o guia ao entrar', 'Hear the guide when entering');
    $('intro-enter').textContent = EJ.L('Entrar →', 'Enter →');
    $('intro-title').setAttribute('tabindex', '-1');
    $('intro-title').focus();
    speech($('intro-caption').textContent, value, generation);   // fala o próximo passo no idioma escolhido
  }
  function speech(text, language, token) {
    return new Promise(resolve => {
      let settled = false, fallbackStarted = false;
      const done = ok => {
        if (settled) return; settled = true;
        timers.forEach(clearTimeout); timers.clear();
        pendingDone = null; document.body.classList.remove('narrating'); resolve(ok);
      };
      pendingDone = done;
      const onStart = () => { if (token === generation) document.body.classList.add('narrating'); };
      const backup = () => {
        if (token !== generation || settled || fallbackStarted) return;
        fallbackStarted = true;
        EJ.narratorFallback.speak(text, language, 1.05, onStart, done);
      };
      // A bounded failure wait keeps the introduction usable even with no audio device.
      const limit = setTimeout(() => { synth?.cancel(); EJ.narratorOnline.stop(); EJ.narratorFallback.stop(); done(false); }, 45000);
      timers.add(limit);
      // voz do navegador no idioma escolhido; sem voz instalada → voz offline
      const device = () => {
        if (token !== generation || settled) return;
        const voices = synth?.getVoices() || [];
        const voice = language === 'en'
          ? voices.find(v => /^en[-_]US$/i.test(v.lang)) || voices.find(v => /^en(?:[-_]|$)/i.test(v.lang))
          : voices.find(v => /^pt[-_]BR$/i.test(v.lang)) || voices.find(v => /^pt(?:[-_]|$)/i.test(v.lang));
        if (!voice) { backup(); return; }
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice; u.lang = language === 'en' ? 'en-US' : 'pt-BR'; u.rate = 1.05;
        let began = false;
        u.onstart = () => { began = true; onStart(); };
        u.onend = () => { if (!fallbackStarted) done(true); };
        u.onerror = backup;
        synth.speak(u);
        const watchdog = setTimeout(() => { if (!began && !settled) { fallbackStarted = false; u.onend = null; u.onerror = null; synth.cancel(); backup(); } }, 3000);
        timers.add(watchdog);
      };
      // inglês: primeiro a narração gravada (se existir para este texto)
      if (language === 'en') {
        EJ.narratorOnline.speak(text, language, 1.05, onStart, ok => {
          if (token !== generation || settled) return;
          if (ok) done(true); else device();
        });
      } else device();
    });
  }
  async function start() {
    if (stage !== 'ready') return;
    stop(); stage = 'playing'; const token = generation;
    for (let i = 0; i < captions.length; i++) {
        if (token !== generation) return;
        $('intro-progress').textContent = `${String(i + 1).padStart(2, '0')} / 03`;
        const text = captions[i][language === 'pt' ? 0 : 1];
        $('intro-caption').textContent = text;
        await speech(text, language, token);
    }
    if (token === generation) choose();
  }
  // ♿ Para quem não enxerga a tela: ao apertar qualquer tecla na escolha de idioma, a voz diz
  // como escolher — em português e em inglês, cada frase na voz do seu idioma.
  function sayChoice() {
    const lines = [['Para usar em português, aperte a letra P.', 'pt'],
                   ['To use Earth Jukebox in English, press the letter E.', 'en']];
    if (!synth) {                                               // navegador sem voz: voz offline
      EJ.narratorFallback?.speak(lines[0][0], 'pt', 1, null, () => EJ.narratorFallback.speak(lines[1][0], 'en', 1));
      return;
    }
    if (synth.speaking || synth.pending) return;                // já está falando: não recomeça a cada tecla
    const voices = synth.getVoices();                           // (pode vir vazia: aí o navegador escolhe pelo idioma)
    const pick = l => l === 'en'
      ? voices.find(v => /^en[-_]US$/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang))
      : voices.find(v => /^pt[-_]BR$/i.test(v.lang)) || voices.find(v => /^pt/i.test(v.lang));
    lines.forEach(([text, l]) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = pick(l); if (v) u.voice = v;
      u.lang = l === 'en' ? 'en-US' : 'pt-BR'; u.rate = 1.0;
      synth.speak(u);
    });
  }
  // Os navegadores só deixam a página falar depois de um toque/tecla: tenta falar ao abrir (funciona
  // quando o navegador permite) e, garantido, no primeiro clique ou toque em qualquer lugar.
  setTimeout(() => { if (stage === 'language') sayChoice(); }, 600);
  addEventListener('pointerdown', () => { if (stage === 'language') sayChoice(); }, true);
  synth?.addEventListener?.('voiceschanged', () => {});         // carrega a lista de vozes cedo
  $('intro-skip').onclick = choose;
  addEventListener('keydown', e => {
    if (e.repeat || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
    if (stage === 'language') {
      if (/^[pe]$/i.test(e.key)) { e.preventDefault(); selectLanguage(e.key.toLowerCase() === 'p' ? 'pt' : 'en'); }
      else if (e.key !== 'Tab' && e.key !== 'Shift') sayChoice();   // qualquer outra tecla: fala as opções
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); choose(); }
    else if (stage === 'ready' && /^[a-z0-9]$/i.test(e.key)) { e.preventDefault(); start(); }
  }, true);
  document.querySelectorAll('[data-language]').forEach(button => {
    button.onclick = () => selectLanguage(button.dataset.language);
  });
  $('intro-enter').onclick = () => {
      if (stage !== 'entry') return;
      if (!EJ.introPreferences.complete(language, $('intro-guide').checked)) return;
      stage = 'leaving'; stop(); freeze();
      window.location.replace('index.html');               // entra no Earth Jukebox
  };
  addEventListener('ej-globe-ready', () => {
    if (stage === 'entry' || stage === 'leaving') freeze();
    else if (matchMedia('(prefers-reduced-motion: reduce)').matches) EJ.globe.layers.spin = false;
  });
  addEventListener('pagehide', () => { stop(); freeze(); });
  return { start, skip: choose, get stage() { return stage; }, captions };
})();