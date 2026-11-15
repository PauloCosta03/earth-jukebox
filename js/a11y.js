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

  // ------------------------------------------------------------------ opções salvas
  const KEY = 'ej-a11y';
  const sysMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sysContrast = matchMedia('(prefers-contrast: more)').matches;
  const opt = { voice: true, chimes: true, rate: 1.05, size: 1, contrast: sysContrast, motion: sysMotion,
                story: true };   // story = pausar a música nos acontecimentos e contá-los
  try { Object.assign(opt, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sem armazenamento */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(opt)); } catch (e) { /* ok */ } };

  // como o usuário está navegando: só narra o foco quando veio do teclado
  let lastInput = 'pointer', userActed = false;   // sons só depois da 1ª interação (regra dos navegadores)
  addEventListener('keydown', () => { lastInput = 'keyboard'; userActed = true; }, true);
  addEventListener('pointerdown', () => { lastInput = 'pointer'; userActed = true; }, true);

  // ================================================================== 1. NARRAÇÃO
  const synth = window.speechSynthesis;
  let voice = null, welcomed = false;
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    voice = vs.find(v => /pt-BR/i.test(v.lang) && /natural|online|neural/i.test(v.name))
         || vs.find(v => /pt-BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || null;
  }
  if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

  let speaking = 0;
  const duck = on => { try { EJ.audio && EJ.audio.duck(on); } catch (e) { /* áudio ainda não iniciou */ } };
  // fala um texto. Textos longos são divididos em frases (o Chrome corta falas muito longas).
  function speak(text, { interrupt = true, force = false, onDone = null } = {}) {
    if (!synth || !text || (!opt.voice && !force)) { if (onDone) onDone(false); return; }
    if (interrupt) { synth.cancel(); speaking = 0; }
    const parts = String(text).replace(/\s+/g, ' ').match(/[^.!?;:]+[.!?;:]?/g) || [text];
    const chunks = [];
    for (const p of parts) {
      const last = chunks[chunks.length - 1];
      if (last && (last + p).length < 180) chunks[chunks.length - 1] = last + p; else chunks.push(p.trim());
    }
    const list = chunks.filter(Boolean);
    list.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      u.lang = 'pt-BR'; if (voice) u.voice = voice;
      u.rate = opt.rate; u.pitch = 1;
      u.onstart = () => { speaking++; duck(true); };
      u.onend = u.onerror = () => {
        speaking = Math.max(0, speaking - 1); if (!synth.speaking) duck(false);
        if (i === list.length - 1 && onDone) onDone(true);           // avisa quando a ÚLTIMA frase terminou
      };
      synth.speak(u);
    });
  }
  // fala e devolve uma Promise que termina quando a voz acaba (usada no modo "Contar a história").
  // Segurança: se o navegador nunca avisar o fim, libera depois do tempo estimado de fala.
  function speakAsync(text) {
    return new Promise(resolve => {
      if (!synth || !opt.voice) { resolve(false); return; }
      const limit = setTimeout(() => resolve(true), 4000 + String(text).length * 110 / opt.rate);
      speak(text, { onDone: ok => { clearTimeout(limit); resolve(ok); } });
    });
  }
  const quiet = () => { if (synth) synth.cancel(); duck(false); };

  // ---- o que dizer sobre um elemento
  const isOn = el => el.getAttribute('aria-checked') === 'true';
  function nameOf(el) {
    return (el.querySelector && el.querySelector('b') && el.querySelector('b').textContent) ||
      el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ');
  }
  function stateOf(el) {
    const s = [];
    if (el.getAttribute('role') === 'switch') s.push(isOn(el) ? 'Ligado.' : 'Desligado.', 'Espaço ou Enter alterna.');
    if (el.hasAttribute('aria-expanded')) s.push(el.getAttribute('aria-expanded') === 'true' ? 'Painel aberto.' : 'Painel fechado.');
    if (el.hasAttribute('aria-pressed')) {
      const p = el.getAttribute('aria-pressed') === 'true';
      if (el.classList.contains('mute-layer')) s.push(p ? 'Agora está silenciado.' : 'Agora está tocando.');
      else if (el.classList.contains('solo')) s.push(p ? 'Solo ligado.' : '');
      else if (el.id === 'mute') s.push(p ? 'A música está silenciada.' : '');
      else s.push(p ? 'Ativado.' : 'Desativado.');
    }
    if (el.type === 'checkbox') s.push(el.checked ? 'Marcado.' : 'Desmarcado.');
    if (el.type === 'radio') {
      const group = [...document.querySelectorAll(`input[name="${el.name}"]`)];
      s.push(`Opção ${group.indexOf(el) + 1} de ${group.length}${el.checked ? ', selecionada' : ''}. Setas trocam a opção.`);
    }
    if (el.type === 'range') s.push('Valor: ' + (el.getAttribute('aria-valuetext') || el.value) + '.');
    if (el.tagName === 'SELECT') s.push('Selecionado: ' + (el.selectedOptions[0] ? el.selectedOptions[0].textContent : '') + '.');
    if (el.classList.contains('solo')) {
      const val = el.querySelector('.val');
      if (val && val.textContent !== '–') s.push('Valor no ano atual: ' + val.textContent + '.');
    }
    if (el.tagName === 'A' && el.target === '_blank') s.push('Link, abre em nova aba.');
    if (el.disabled) s.push('Indisponível agora.');
    return s.filter(Boolean).join(' ');
  }
  function describe(el) {
    const what = el.dataset.say || nameOf(el);
    return `${what} ${stateOf(el)}`.trim();
  }

  const WELCOME = 'Earth Jukebox, a música do clima. A narração por voz está ligada: cada botão diz o que faz quando você chega nele com Tab. ' +
    'Se você já usa um leitor de tela, aperte V para desligar a narração. Aperte interrogação para ver os atalhos, ou espaço para tocar.';

  document.addEventListener('focusin', e => {
    const el = e.target;
    if (lastInput !== 'keyboard' || el === document.body) return;
    chimeFocus(el);
    if (!opt.voice) return;
    if (!welcomed) { welcomed = true; speak(WELCOME); speak(describe(el), { interrupt: false }); return; }
    speak(describe(el));
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
      if (el.getAttribute('role') === 'switch') speak(`${nameOf(el)}: ${on ? 'ligado' : 'desligado'}.`);
      else if (el.classList.contains('mute-layer')) speak(on ? 'Silenciado.' : 'Tocando de novo.');
      else if (el.classList.contains('solo')) speak(on ? `Ouvindo só ${nameOf(el.querySelector('.lbl') || el)}.` : 'Todos os instrumentos de volta.');
      else if (el.id === 'mute') speak(on ? 'Música silenciada.' : 'Música de volta.');
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
  $('volume').addEventListener('input', e => { if (lastInput === 'keyboard') speak(e.target.value + ' por cento'); });
  $('loop').addEventListener('change', e => {
    chime(e.target.checked ? 'on' : 'off');
    if (lastInput === 'keyboard') speak(e.target.checked ? 'Repetir ligado.' : 'Repetir desligado.');
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
    if (hide) { uiShow.focus(); speak('Interface escondida. Aperte H, ou o botão Mostrar interface no canto inferior direito, para trazer os botões de volta.'); }
    else { $('ui-hide').focus(); speak('Interface de volta.'); }
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
    fsBtn.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia');
    chime(on ? 'full' : 'unfull');
    speak(on ? 'Tela cheia. Aperte F ou Esc para sair.' : 'Saiu da tela cheia.');
  });

  const zoomSay = () => EJ.globe && speak(`Zoom ${EJ.globe.zoomLevel()} por cento.`);
  const zoom = kind => {
    if (!EJ.globe) return;
    if (kind === 'in') { EJ.globe.zoomIn(); chime('zoomIn'); }
    else if (kind === 'out') { EJ.globe.zoomOut(); chime('zoomOut'); }
    else { EJ.globe.resetView(); chime('show'); speak('Terra centralizada.'); return; }
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
    if (!on) speak('Narração desligada. Aperte V para ligar de novo.', { force: true });
    opt.voice = on; save(); setSwitch('opt-voice', on);
    if (on) speak('Narração ligada.');
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
    speak(on ? 'Contar a história ligado: a música pausa em cada acontecimento para contar o que aconteceu e o impacto na Terra.'
             : 'Contar a história desligado: a música toca sem pausas.');
  };
  $('opt-story').onclick = () => setStory(!opt.story);
  $('story').onclick = () => setStory(!opt.story);
  $('opt-rate').onchange = e => { opt.rate = +e.target.value; save(); speak('Velocidade da voz ajustada.'); };
  document.querySelectorAll('input[name="opt-size"]').forEach(r => r.addEventListener('change', () => {
    opt.size = +r.value; save(); apply();
    dispatchEvent(new Event('resize'));                               // redesenha o gráfico no novo tamanho
  }));
  addEventListener('ej-globe-ready', () => {
    if (opt.motion && EJ.globe.layers.spin) { EJ.globe.toggle('spin'); EJ.ui.syncChips(); }
  });

  // guia falado (botão "Ouvir o guia")
  const TOUR = [
    'Guia do Earth Jukebox.',
    'No centro da tela está a Terra em 3D. Cada dado do clima medido pela NASA vira um instrumento: a temperatura é a melodia, o gás carbônico é um som grave, o gelo do Ártico são sinos e o nível do mar são ondas.',
    'Embaixo fica a barra de reprodução: o botão Tocar, o ano atual e a linha do tempo de 1880 a 2100. Até 2025 são medições; depois, projeções do modelo da NASA. Quanto mais quente, menos harmônica a música.',
    'No topo ficam cinco painéis: Camadas, para ligar o que aparece no globo e escolher o cenário do futuro; Instrumentos, para ouvir cada som sozinho; Ouvir, para transformar imagens e partituras em música; Acessibilidade; e Sobre.',
    'Atalhos: espaço toca e pausa; setas mudam o ano; D descreve a tela; V liga ou desliga esta narração; H esconde os botões; F deixa em tela cheia; mais e menos aproximam e afastam a Terra.',
    'Aperte Tab para começar a explorar. Boa viagem pelo clima do planeta.',
  ].join(' ');
  $('tour').onclick = () => speak(TOUR, { force: true });

  apply();
  return { speak, speakAsync, quiet, chime, describe, options: opt };
})();
