// 🎙️ Narração GRAVADA em inglês (voz de narrador de documentário).
//
// Cada fala dos acontecimentos em inglês tem um MP3 pronto em audio/en/, com o nome do "hash"
// (FNV-1a de 32 bits) do texto EXATO da fala. audio/en/manifest.json lista os que existem.
//  - Se o texto tem MP3: toca o arquivo (onDone(true) quando termina).
//  - Se não tem (ou é português, ou o navegador bloqueou o áudio): onDone(false) e o a11y.js
//    usa a voz do navegador ou a voz offline (narrator-fallback.js).
// Mudou o texto em inglês de um acontecimento? O MP3 dele deixa de ser encontrado (cai na voz
// do navegador) até ser gravado de novo.
// Não precisa de servidor nem de chave: são só arquivos estáticos (funciona no GitHub Pages).
window.EJ = window.EJ || {};
EJ.narratorOnline = (() => {
  const BASE = 'audio/en/';
  let context, active, generation = 0;
  const cache = new Map();                                   // texto → áudio já decodificado (até 40)
  const hash = text => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
  const manifest = fetch(BASE + 'manifest.json').then(r => r.ok ? r.json() : []).then(list => new Set(list)).catch(() => new Set());

  // o navegador só libera o áudio depois de um clique ou tecla
  function unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = context || new AudioContext();
    context.resume().catch(() => {});
  }
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);

  // existe gravação para este texto? (sem baixar nada)
  async function has(text, language) {
    return language === 'en' && (await manifest).has(hash(String(text)));
  }

  function stop() {
    generation++;
    if (active) { try { active.stop(); } catch (e) { /* já tinha parado */ } }
    active = null;
  }

  async function speak(text, language, rate, onStart, onDone) {
    unlock();
    const token = generation;
    try {
      if (language !== 'en' || !context) throw new Error('sem gravação');
      let buffer = cache.get(text);
      if (!buffer) {
        const key = hash(text);
        if (!(await manifest).has(key)) throw new Error('sem gravação');
        if (token !== generation) return;
        const response = await fetch(BASE + key + '.mp3');
        if (!response.ok) throw new Error('arquivo indisponível');
        const bytes = await response.arrayBuffer();
        if (token !== generation) return;
        buffer = await context.decodeAudioData(bytes);
        if (token !== generation) return;
        if (cache.size >= 40) cache.delete(cache.keys().next().value);
        cache.set(text, buffer);
      }
      await context.resume();
      if (token !== generation) return;
      const source = context.createBufferSource();
      source.buffer = buffer; source.playbackRate.value = rate;   // respeita a velocidade da voz
      source.connect(context.destination); active = source;
      source.onended = () => {
        if (active === source) active = null;
        if (token === generation) onDone?.(true);
      };
      onStart?.(); source.start();
    } catch (e) {
      if (token === generation) onDone?.(false);
    }
  }
  return { speak, stop, has };
})();
