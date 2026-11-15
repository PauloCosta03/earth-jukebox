// 🥚 Easter egg: digite "ocarina" em qualquer lugar da página.
//
// Toca uma melodia ORIGINAL do Earth Jukebox com som de ocarina.
// Para testar com um MIDI seu, só no seu computador: coloque o arquivo em
// assets/easter/ocarina.mid — essa pasta é ignorada pelo git (não vai para o GitHub),
// então nenhuma música de terceiros é distribuída junto com o projeto.
window.EJ = window.EJ || {};
EJ.easter = (function () {
  const SECRET = 'ocarina';
  const LOCAL_MIDI = 'assets/easter/ocarina.mid';
  let typed = '';

  // "Canção do Planeta Azul" — composição original para o projeto (ré dórico, 3/4, ~84 bpm).
  // [nota MIDI, duração em tempos]; 62 = ré4


const THEME = [
  [74, 2], [76, 2], [86, 2.333],
  [85, 0.333], [84, 0.333], [83, 5],
  [81, 0.5], [79, 1.5], [74, 1], [76, 1],
  [86, 2.333], [85, 0.333], [84, 0.333], [83, 2.5],
  [84, 0.5], [83, 1.5], [81, 0.5], [79, 2],
  [74, 1], [76, 1], [86, 2.333],
  [85, 0.333], [84, 0.333], [83, 5],
  [81, 0.5], [79, 1.5], [74, 1], [76, 1],
  [86, 2.333], [85, 0.333], [84, 0.333], [83, 2],
  [88, 1], [83, 6],
  [81, 1], [76, 3], [74, 1], [79, 3],
  [81, 1], [76, 3], [83, 1], [79, 3],
  [81, 1], [76, 3], [84, 1], [79, 3],
  [77, 1], [79, 3],
];

function themeNotes() {
  const spb = 60 / 74;
  let t = 0;

  return THEME.map(([midi, beats]) => {
    const n = {
      midi,
      start: t * spb,
      dur: beats * spb
    };

    t += beats;
    return n;
  });
}

  async function notes() {
    try {
      const r = await fetch(LOCAL_MIDI, { cache: 'no-store' });
      if (r.ok) return { notes: EJ.score.parseMIDI(await r.arrayBuffer()).notes, local: true };
    } catch (e) { /* sem arquivo local: usa o tema original */ }
    return { notes: themeNotes(), local: false };
  }

  function say(text) {
    const msg = document.getElementById('msg'), live = document.getElementById('sr-live');
    if (msg) msg.textContent = text;
    if (live) { live.textContent = ''; setTimeout(() => (live.textContent = text), 60); }
  }

  async function play() {
    await EJ.audio.init();
    const { notes: list, local } = await notes();
    const secs = EJ.audio.playNotes(list, { timbre: 'ocarina' });
    say(local ? `🎶 Ocarina: tocando seu MIDI local (${Math.round(secs)} s). Esc ou Tocar para parar.`
              : '🎶 Você achou o segredo da ocarina! "Canção do Planeta Azul" — Earth Jukebox.');
  }

  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest && e.target.closest('input,select,textarea')) return;   // digitando num campo
    typed = (typed + e.key.toLowerCase()).slice(-SECRET.length);
    if (typed === SECRET) { typed = ''; play(); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') EJ.audio.stopNotes(); });

  return { play };
})();
