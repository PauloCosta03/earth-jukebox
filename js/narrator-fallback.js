// 🗣️ Voz OFFLINE de reserva (meSpeak / eSpeak, licença GPL-3.0, em js/vendor/mespeak/).
// Usada quando o computador não tem voz instalada no idioma (comum em Linux e em alguns
// Windows sem voz em português). Não precisa de internet, chave nem serviço externo.
// Só é baixada (≈5 MB) na primeira vez que for necessária.
window.EJ = window.EJ || {};
EJ.narratorFallback = (() => {
  const base = 'js/vendor/mespeak/';
  let ready, context, active, generation = 0;
  let queue = Promise.resolve();
  function unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = context || new AudioContext();
    context.resume().catch(() => {});
  }
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
  function load() {
    if (!ready) ready = (async () => {
      if (!window.meSpeak) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = base + 'engine.js';
        script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
      });
      const files = await Promise.all(['config.json', 'en-us.json', 'pt.json'].map(async file => {
        const response = await fetch(base + file);
        if (!response.ok) throw new Error('Voice could not load');
        return response.json();
      }));
      window.meSpeak.loadConfig(files[0]);
      window.meSpeak.loadVoice(files[1]);
      window.meSpeak.loadVoice(files[2]);
      return window.meSpeak;
    })().catch(error => { ready = null; throw error; });
    return ready;
  }
  function stop() {
    generation++;
    active?.stop(); active = null;
    queue = Promise.resolve();
  }
  function speak(text, language, rate, onStart, onDone) {
    unlock();
    const token = generation;
    queue = queue.catch(() => {}).then(async () => {
      try {
        const engine = await load();
        if (token !== generation) { onDone?.(false); return; }
        const wav = engine.speak(text, { voice: language === 'en' ? 'en/en-us' : 'pt', speed: Math.round(175 * rate), rawdata: 'array' });
        if (!wav || !context) throw new Error('Audio unavailable');
        const buffer = await context.decodeAudioData(new Uint8Array(wav).buffer);
        if (token !== generation) { onDone?.(false); return; }
        await context.resume();
        await new Promise(resolve => {
          const source = context.createBufferSource();
          source.buffer = buffer; source.connect(context.destination);
          active = source;
          source.onended = () => {
            if (active === source) active = null;
            onDone?.(token === generation); resolve();
          };
          onStart?.(); source.start();
        });
      } catch (error) { onDone?.(false); }
    });
  }
  return { speak, stop };
})();