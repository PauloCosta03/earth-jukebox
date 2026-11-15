// ♿ Acessibilidade e "camada sonora" da interface.
//
//  1. NARRAÇÃO POR VOZ — ao chegar num controle com Tab, a voz do navegador diz o que ele faz
//     (atributo data-say no HTML) e o estado atual (ligado/desligado, aberto, valor...).
//     As mensagens da região viva (#sr-live) também são faladas. A música abaixa enquanto a voz fala.
//  2. SONS DA INTERFACE — toques curtos na MESMA tonalidade da música (lá maior pentatônica):
//     foco, ligar/desligar, abrir/fechar painel, esconder interface, tela cheia.
//  3. ESCONDER/MOSTRAR A INTERFACE (H), TELA CHEIA (F), ZOOM (+ − 0), atalhos V e ?.
//  4. OPÇÕES — narração, velocidade da voz, sons, tamanho do texto, alto contraste, reduzir movimento.
//     Ficam salvas neste navegador (localStorage), só por conveniência.
window.EJ = window.EJ || {};
EJ.a11y = (function () {
  const $ = id => document.getElementById(id);
  const body = document.body, app = $('app'), uiShow = $('ui-show');
  const T = EJ.t;                                                    // textos no idioma atual

  // ------------------------------------------------------------------ opções salvas
  const KEY = 'ej-a11y';
  const sysMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sysContrast = matchMedia('(prefers-contrast: more)').matches;
  const opt = { voice: true, chimes: true, rate: 1.05, size: 1, contrast: sysContrast, motion: sysMotion,
                story: true };   // story = pausar a música nos acontecimentos e contá-los
  try { Object.assign(opt, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sem armazenamento */ }
  opt.voice = true;                         // narração SEMPRE ligada ao abrir a página (V desliga só nesta visita)
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(opt)); } catch (e) { /* ok */ } };

  // como o usuário está navegando: só narra o foco quando veio do teclado
  let lastInput = 'pointer', userActed = false;   // sons só depois da 1ª interação (regra dos navegadores)
  addEventListener('keydown', () => { lastInput = 'keyboard'; userActed = true; }, true);
  addEventListener('pointerdown', () => { lastInput = 'pointer'; userActed = true; }, true);

  // ================================================================== 1. NARRAÇÃO
  const synth = window.speechSynthesis;
  // uma voz por idioma: prefere as vozes "naturais/online/neural" (soam muito melhor no Edge)
  let welcomed = false;
  const voices = {};
  function pickVoices() {
    if (!synth) return;
    const vs = synth.getVoices();
    const best = (exact, base) => vs.find(v => exact.test(v.lang) && /natural|online|neural/i.test(v.name))
      || vs.find(v => exact.test(v.lang)) || vs.find(v => base.test(v.lang)) || null;
    voices.pt = best(/pt-BR/i, /^pt/i);
    voices.en = best(/en-US/i, /^en/i);
  }
  if (synth) { pickVoices(); synth.addEventListener?.('voiceschanged', pickVoices); }
  const langKey = l => (/^en/i.test(l || '') ? 'en' : 'pt');

  const duck = on => { try { EJ.audio && EJ.audio.duck(on); } catch (e) { /* áudio ainda não iniciou */ } };
  // Três vozes, nesta ordem:
  //  1. narração GRAVADA em inglês (js/narrator-online.js), quando existe MP3 para o texto exato
  //  2. voz do navegador/sistema no idioma (speechSynthesis)
  //  3. voz OFFLINE de reserva (js/narrator-fallback.js), se não houver voz instalada no idioma
  const recorded = EJ.narratorOnline, offline = EJ.narratorFallback;
  let gen = 0;                                        // muda a cada interrupção: falas antigas não continuam
  function stopAll() {
    gen++;
    if (synth) synth.cancel();
    if (recorded) recorded.stop();
    if (offline) offline.stop();
  }
  // fala um texto. lang: idioma desta fala ('pt-BR' / 'en'); por padrão, o idioma atual do site
  function speak(text, { interrupt = true, force = false, onDone = null, lang = null } = {}) {
    if (!text || (!opt.voice && !force)) { if (onDone) onDone(false); return; }
    if (interrupt) stopAll();
    const token = gen, k = langKey(lang || EJ.i18n.speechLang()), full = String(text);
    const finish = ok => { duck(false); if (onDone) onDone(ok); };
    // 3. voz offline (carrega ≈5 MB só na primeira vez)
    const viaOffline = rest => {
      if (token !== gen) return;
      if (!offline) { finish(false); return; }
      offline.speak(rest, k, opt.rate, () => duck(true), ok => { if (token === gen) finish(ok); });
    };
    // 2. voz do navegador. Textos longos são divididos em frases (o Chrome corta falas muito longas).
    const viaDevice = () => {
      if (token !== gen) return;
      if (synth && !voices[k]) pickVoices();          // as vozes podem chegar depois de abrir a página
      if (!synth || !voices[k]) { viaOffline(full); return; }
      const parts = full.replace(/\s+/g, ' ').match(/[^.!?;:]+[.!?;:]?/g) || [full];
      const chunks = [];
      for (const p of parts) {
        const last = chunks[chunks.length - 1];
        if (last && (last + p).length < 180) chunks[chunks.length - 1] = last + p; else chunks.push(p.trim());
      }
      const list = chunks.filter(Boolean);
      let failed = false;
      list.forEach((c, i) => {
        const u = new SpeechSynthesisUtterance(c);
        u.lang = k === 'en' ? 'en-US' : 'pt-BR'; u.voice = voices[k];
        u.rate = opt.rate; u.pitch = 1;
        u.onstart = () => duck(true);
        u.onend = () => { if (i === list.length - 1 && !failed && token === gen) finish(true); };   // fim da ÚLTIMA frase
        u.onerror = e => {
          if (failed || token !== gen) return;
          if (e.error === 'interrupted' || e.error === 'canceled') { if (i === list.length - 1) finish(false); return; }
          failed = true; synth.cancel(); viaOffline(list.slice(i).join(' '));   // voz quebrou: continua na offline
        };
        synth.speak(u);
      });
    };
    // 1. gravação em inglês (só se existir MP3 para este texto)
    if (k === 'en' && recorded) {
      recorded.has(full, 'en').then(yes => {
        if (token !== gen) return;
        if (!yes) { viaDevice(); return; }
        recorded.speak(full, 'en', opt.rate, () => duck(true), ok => {
          if (token !== gen) return;
          if (ok) finish(true); else viaDevice();
        });
      });
    } else viaDevice();
  }
  // fala e devolve uma Promise que termina quando a voz acaba (usada no modo "Contar a história").
  // Segurança: se nunca vier o aviso de fim, libera depois do tempo estimado de fala.
  function speakAsync(text) {
    return new Promise(resolve => {
      if (!opt.voice) { resolve(false); return; }
      const limit = setTimeout(() => resolve(true), 6000 + String(text).length * 110 / opt.rate);
      speak(text, { onDone: ok => { clearTimeout(limit); resolve(ok); } });
    });
  }
  const quiet = () => { stopAll(); duck(false); };

  // ---- o que dizer sobre um elemento
  const isOn = el => el.getAttribute('aria-checked') === 'true';
  function nameOf(el) {
    return (el.querySelector && el.querySelector('b') && el.querySelector('b').textContent) ||
      el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ');
  }
  function stateOf(el) {
    const s = [];
    if (el.getAttribute('role') === 'switch') s.push(T(isOn(el) ? 'a.on' : 'a.off'), T('a.toggleHint'));
    if (el.hasAttribute('aria-expanded')) s.push(T(el.getAttribute('aria-expanded') === 'true' ? 'a.panelOpen' : 'a.panelClosed'));
    if (el.hasAttribute('aria-pressed')) {
      const p = el.getAttribute('aria-pressed') === 'true';
      if (el.classList.contains('mute-layer')) s.push(T(p ? 'a.muted' : 'a.playing'));
      else if (el.classList.contains('solo')) s.push(p ? T('a.soloOn') : '');
      else if (el.id === 'mute') s.push(p ? T('a.musicMuted') : '');
      else s.push(T(p ? 'a.active' : 'a.inactive'));
    }
    if (el.type === 'checkbox') s.push(T(el.checked ? 'a.checked' : 'a.unchecked'));
    if (el.type === 'radio') {
      const group = [...document.querySelectorAll(`input[name="${el.name}"]`)];
      s.push(T('a.radio', { i: group.indexOf(el) + 1, n: group.length, sel: el.checked ? T('a.selected') : '' }));
    }
    if (el.type === 'range') s.push(T('a.value', { v: el.getAttribute('aria-valuetext') || el.value }));
    if (el.tagName === 'SELECT') s.push(T('a.chosen', { v: el.selectedOptions[0] ? el.selectedOptions[0].textContent : '' }));
    if (el.classList.contains('solo')) {
      const val = el.querySelector('.val');
      if (val && val.textContent !== '–') s.push(T('a.yearValue', { v: val.textContent }));
    }
    if (el.tagName === 'A' && el.target === '_blank') s.push(T('a.newTab'));
    if (el.disabled) s.push(T('a.disabled'));
    return s.filter(Boolean).join(' ');
  }
  function describe(el) {
    const what = el.dataset.say || nameOf(el);
    return `${what} ${stateOf(el)}`.trim();
  }

  const dlg = $('lang-dialog');
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (lastInput !== 'keyboard' || el === document.body) return;
    chimeFocus(el);
    if (!opt.voice) return;
    // cada controle é falado no idioma em que está escrito (ex.: "English" na caixa de idioma)
    const lang = el.closest('[lang]') ? el.closest('[lang]').getAttribute('lang') : null;
    if (dlg.open) { speak(el.dataset.say || nameOf(el), { lang }); return; }
    if (!welcomed) { welcomed = true; speak(T('a.welcome')); speak(describe(el), { interrupt: false }); return; }
    speak(describe(el), { lang });
  });

  // mudanças de estado do elemento em foco (ligar/desligar, silenciar...) são faladas e "soam"
  new MutationObserver(list => {
    for (const m of list) {
      const el = m.target;
      if (m.attributeName === 'aria-expanded') continue;                 // o título do painel já é lido
      const v = el.getAttribute(m.attributeName);
      if (v === m.oldValue) continue;
      const on = v === 'true';
      if (el.getAttribute('role') === 'switch' || m.attributeName === 'aria-pressed') chime(on ? 'on' : 'off');
      if (el !== document.activeElement) continue;
      if (el.getAttribute('role') === 'switch') speak(T('a.switchState', { name: nameOf(el), state: T(on ? 'a.onWord' : 'a.offWord') }));
      else if (el.classList.contains('mute-layer')) speak(T(on ? 'a.layerMuted' : 'a.layerBack'));
      else if (el.classList.contains('solo')) speak(on ? T('a.soloOnly', { name: nameOf(el.querySelector('.lbl') || el) }) : T('a.allBack'));
      else if (el.id === 'mute') speak(T(on ? 'a.musicOff' : 'a.musicOn'));
      else if (el.id === 'fullscreen') { /* falado no evento de tela cheia */ }
    }
  }).observe(body, { subtree: true, attributes: true, attributeOldValue: true,
                     attributeFilter: ['aria-checked', 'aria-pressed', 'aria-expanded'] });

  // a região viva (eventos históricos, descrição da tela, avisos) também é falada
  new MutationObserver(() => {
    const t = $('sr-live').textContent.trim();
    if (t) speak(t);
  }).observe($('sr-live'), { childList: true, characterData: true, subtree: true });

  // controles deslizantes: fala o valor na hora (a descrição completa vem depois, pela região viva)
  $('slider').addEventListener('input', e => { if (lastInput === 'keyboard') speak(String(e.target.value)); });
  $('volume').addEventListener('input', e => { if (lastInput === 'keyboard') speak(T('fmt.pct', { v: e.target.value })); });
  $('loop').addEventListener('change', e => {
    chime(e.target.checked ? 'on' : 'off');
    if (lastInput === 'keyboard') speak(T(e.target.checked ? 'a.repeatOn' : 'a.repeatOff'));
  });

  // ================================================================== 2. SONS DA INTERFACE
  // Lá maior pentatônica (lá, si, dó#, mi, fá#) — a mesma tonalidade da música (lá = 220 Hz).
  const N = { A4: 440, B4: 493.88, Cs5: 554.37, E5: 659.25, Fs5: 739.99, A5: 880, Cs6: 1108.73, E6: 1318.51 };
  const PHRASE = {
    on: [N.E5, N.A5], off: [N.A5, N.E5],
    open: [N.A4, N.Cs5, N.E5], close: [N.E5, N.Cs5, N.A4],
    hide: [N.A5, N.E5, N.Cs5, N.A4], show: [N.A4, N.Cs5, N.E5, N.A5],
    full: [N.A4, N.E5, N.A5], unfull: [N.A5, N.E5, N.A4],
    zoomIn: [N.Cs5, N.E5], zoomOut: [N.E5, N.Cs5],
  };
  let actx = null;
  function ctx() {
    if (!userActed) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, at, dur, vol, type = 'sine') {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 3200;                     // som macio, sem "bip" agudo
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function chime(name) {
    if (!opt.chimes || !PHRASE[name]) return;
    PHRASE[name].forEach((fq, i) => tone(fq, i * 0.075, 0.32, 0.05, 'triangle'));
  }
  // foco: um toque baixinho, com altura diferente por tipo de controle (dá para "ouvir" onde se está)
  function chimeFocus(el) {
    if (!opt.chimes) return;
    const f = el.closest('.toolbar') ? N.E5 : el.closest('.viewtools') ? N.Fs5 : el.matches('.chip,[role=switch]') ? N.Cs5
      : el.closest('.player') ? N.A5 : el.matches('h2') ? N.A4 : el.closest('.card') ? N.B4 : N.Cs6;
    tone(f, 0, 0.12, 0.025, 'sine');
  }
  addEventListener('ej-panel', e => chime(e.detail.open ? 'open' : 'close'));

  // ================================================================== 3. ESCONDER / TELA CHEIA / ZOOM
  function setUiHidden(hide) {
    body.classList.toggle('ui-hidden', hide);
    app.inert = hide;                                                 // ninguém tropeça em botões invisíveis
    uiShow.hidden = !hide;
    chime(hide ? 'hide' : 'show');
    if (hide) { uiShow.focus(); speak(T('a.hidden')); }
    else { $('ui-hide').focus(); speak(T('a.shown')); }
  }
  $('ui-hide').onclick = () => setUiHidden(true);
  uiShow.onclick = () => setUiHidden(false);

  const fsBtn = $('fullscreen');
  if (!document.fullscreenEnabled) fsBtn.hidden = true;               // ex.: iPhone
  const toggleFullscreen = () => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
  };
  fsBtn.onclick = toggleFullscreen;
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    EJ.ui.setIcon(fsBtn, on ? 'minimize' : 'maximize');
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.setAttribute('aria-label', T(on ? 'a.fsExit' : 'a.fsEnter'));
    chime(on ? 'full' : 'unfull');
    speak(T(on ? 'a.fsOn' : 'a.fsOff'));
  });

  const zoomSay = () => EJ.globe && speak(T('a.zoom', { v: EJ.globe.zoomLevel() }));
  const zoom = kind => {
    if (!EJ.globe) return;
    if (kind === 'in') { EJ.globe.zoomIn(); chime('zoomIn'); }
    else if (kind === 'out') { EJ.globe.zoomOut(); chime('zoomOut'); }
    else { EJ.globe.resetView(); chime('show'); speak(T('a.centered')); return; }
    if (lastInput === 'keyboard') zoomSay();
  };
  $('zoom-in').onclick = () => zoom('in');
  $('zoom-out').onclick = () => zoom('out');
  $('zoom-reset').onclick = () => zoom('reset');

  // atalhos (letras que não aparecem em "ocarina", para não brigar com o easter egg)
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = e.target.closest && e.target.closest('input[type=text],input:not([type]),select,textarea');
    if (typing) return;
    const k = e.key;
    if (k === 'Escape' && body.classList.contains('ui-hidden')) { setUiHidden(false); return; }
    if (/^[fF]$/.test(k)) toggleFullscreen();
    else if (/^[hH]$/.test(k)) setUiHidden(!body.classList.contains('ui-hidden'));
    else if (/^[vV]$/.test(k)) setVoice(!opt.voice);
    else if (/^[lL]$/.test(k)) openLang(e.target);
    else if (k === '+' || k === '=') zoom('in');
    else if (k === '-' || k === '_') zoom('out');
    else if (k === '0' && e.target.type !== 'range') zoom('reset');
    else if (k === '?') { if (body.classList.contains('ui-hidden')) setUiHidden(false); EJ.ui.openPanel('p-a11y'); }
    else return;
    e.preventDefault();
  });

  // ================================================================== 4. OPÇÕES
  function setSwitch(id, on) { $(id).setAttribute('aria-checked', String(on)); }
  function setVoice(on) {
    if (!on) speak(T('a.voiceOff'), { force: true });
    opt.voice = on; save(); setSwitch('opt-voice', on);
    if (on) speak(T('a.voiceOn'));
  }
  function apply() {
    setSwitch('opt-voice', opt.voice);
    setSwitch('opt-chimes', opt.chimes);
    setSwitch('opt-contrast', opt.contrast);
    setSwitch('opt-motion', opt.motion);
    setSwitch('opt-story', opt.story);
    const sb = $('story'); sb.setAttribute('aria-pressed', String(opt.story));
    $('opt-rate').value = String(opt.rate);
    const r = document.querySelector(`input[name="opt-size"][value="${opt.size}"]`); if (r) r.checked = true;
    document.documentElement.style.setProperty('--text-scale', opt.size);
    body.classList.toggle('hc', !!opt.contrast);
    body.classList.toggle('reduce-motion', !!opt.motion);
  }
  $('opt-voice').onclick = () => setVoice(!opt.voice);
  $('opt-chimes').onclick = () => { opt.chimes = !opt.chimes; save(); setSwitch('opt-chimes', opt.chimes); if (opt.chimes) chime('on'); };
  $('opt-contrast').onclick = () => { opt.contrast = !opt.contrast; save(); apply(); };
  $('opt-motion').onclick = () => {
    opt.motion = !opt.motion; save(); apply();
    if (EJ.globe && opt.motion && EJ.globe.layers.spin) { EJ.globe.toggle('spin'); EJ.ui.syncChips(); }
  };
  // modo "Contar a história": mesmo estado no painel Acessibilidade e no botão de livro da barra
  const setStory = on => {
    opt.story = on; save(); apply();
    speak(T(on ? 'a.storyOn' : 'a.storyOff'));
  };
  $('opt-story').onclick = () => setStory(!opt.story);
  $('story').onclick = () => setStory(!opt.story);
  $('opt-rate').onchange = e => { opt.rate = +e.target.value; save(); speak(T('a.rate')); };
  document.querySelectorAll('input[name="opt-size"]').forEach(r => r.addEventListener('change', () => {
    opt.size = +r.value; save(); apply();
    dispatchEvent(new Event('resize'));                               // redesenha o gráfico no novo tamanho
  }));
  addEventListener('ej-globe-ready', () => {
    if (opt.motion && EJ.globe.layers.spin) { EJ.globe.toggle('spin'); EJ.ui.syncChips(); }
  });

  // guia falado (botão "Ouvir o guia")
  $('tour').onclick = () => speak(T('a.tour'), { force: true });

  // ---- introdução (intro.html)
  $('intro-replay').onclick = () => location.assign('intro.html');
  // "Ouvir o guia ao entrar" (marcado na introdução): toca o guia UMA vez, quando o globo carrega.
  // Os navegadores só deixam a página falar depois de um clique/tecla NESTA página; se ainda não
  // houve, avisa e toca na primeira tecla (essa tecla não faz mais nada).
  let guideOnce = false;
  try { guideOnce = sessionStorage.getItem('ej-guide-once') === 'true'; sessionStorage.removeItem('ej-guide-once'); }
  catch (e) { /* sem armazenamento */ }
  if (guideOnce) {
    let played = false, waiting = false;
    const play = () => {
      if (played) return; played = true; welcomed = true;
      removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', play, true);
      speak(T('a.tour'), { force: true });
    };
    const onKey = e => { e.preventDefault(); e.stopImmediatePropagation(); play(); };
    const ready = () => {
      if (played || waiting) return;
      if (!navigator.userActivation || navigator.userActivation.hasBeenActive) { play(); return; }
      waiting = true;
      addEventListener('keydown', onKey, true);
      addEventListener('pointerdown', play, true);
      EJ.ui.announce(T('a.guideKey'));
    };
    addEventListener('ej-globe-ready', ready, { once: true });
    setTimeout(ready, 20000);                                         // globo demorou: não espera mais
  }

  // ================================================================== 5. IDIOMA
  // Caixa modal (<dialog>): prende o foco, Esc fecha. Aparece no 1º acesso; L e os botões reabrem.
  let langOpener = null;
  function updateLangBtn() {
    $('lang-btn').querySelector('.lang-now').textContent = EJ.i18n.lang === 'en' ? 'EN' : 'PT';
    $('lang-btn').setAttribute('aria-label', T('lang.btn'));
    dlg.querySelectorAll('.lang-opt').forEach(b => b.classList.toggle('current', b.dataset.lang === EJ.i18n.lang));
  }
  function openLang(from) {
    if (dlg.open) return;
    langOpener = from && from !== document.body ? from : null;
    updateLangBtn();
    dlg.showModal();
    dlg.querySelector(`.lang-opt[data-lang="${EJ.i18n.lang}"]`).focus();     // começa no idioma atual
  }
  function choose(l) {
    const first = !EJ.i18n.chosen;
    dlg.close();
    EJ.i18n.set(l);
    EJ.i18n.markChosen();
    pickVoices();
    updateLangBtn();
    if (opt.voice) {                                                       // confirma no idioma escolhido
      speak(T('a.langSet') + (first ? ' ' + T('a.welcome') : ''), { force: false });
      welcomed = true;
    }
    if (langOpener && document.contains(langOpener)) langOpener.focus();
  }
  dlg.querySelectorAll('.lang-opt').forEach(b => (b.onclick = () => choose(b.dataset.lang)));
  dlg.addEventListener('cancel', e => { e.preventDefault(); choose(EJ.i18n.lang); });   // Esc: mantém o idioma atual
  $('lang-btn').onclick = e => openLang(e.currentTarget);
  $('opt-lang').onclick = e => openLang(e.currentTarget);
  EJ.i18n.onChange(() => {                                                 // rótulos que o a11y controla
    const fs = !!document.fullscreenElement;
    fsBtn.setAttribute('aria-label', T(fs ? 'a.fsExit' : 'a.fsEnter'));
    updateLangBtn();
  });
  updateLangBtn();
  fsBtn.setAttribute('aria-label', T('a.fsEnter'));
  if (!EJ.i18n.chosen) openLang(null);                                     // primeiro acesso: pergunta o idioma

  apply();
  return { speak, speakAsync, quiet, chime, describe, openLang, options: opt };
})();
