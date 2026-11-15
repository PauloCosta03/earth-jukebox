// 🎼 Partituras: transforma um arquivo em uma lista de notas { midi, start, dur } (segundos).
//
//   MusicXML (.musicxml, .xml, .mxl) — formato padrão de partitura digital (MuseScore, Finale,
//                                       Sibelius, IMSLP...). Leitura exata: notas, ritmo, andamento.
//   MIDI (.mid, .midi)               — notas e tempos exatos.
//   Imagem (foto/scan de partitura)   — EXPERIMENTAL (leitura óptica): pauta limpa, clave de sol,
//                                       uma linha de melodia. Não lê armadura, acidentes nem ritmo:
//                                       todas as notas saem com a mesma duração.
//
// O tocador fica em audio.js (EJ.audio.playNotes).
window.EJ = window.EJ || {};
EJ.score = (function () {
  const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // ------------------------------------------------------------------ MusicXML
  function parseMusicXML(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error(EJ.t('score.err.xml'));
    const part = doc.querySelector('part');
    if (!part) throw new Error(EJ.t('score.err.part'));
    const title = (doc.querySelector('work-title') || doc.querySelector('movement-title') || {}).textContent || '';
    let divisions = 1, tempo = 100, t = 0, lastStart = 0;          // t em semínimas
    const notes = [];
    const ties = {};                                               // midi -> nota aberta por ligadura
    for (const m of part.querySelectorAll(':scope > measure')) {
      for (const el of m.children) {
        if (el.tagName === 'attributes') {
          const d = el.querySelector('divisions');
          if (d) divisions = +d.textContent || 1;
        } else if (el.tagName === 'direction' || el.tagName === 'sound') {
          const s = el.tagName === 'sound' ? el : el.querySelector('sound');
          if (s && s.getAttribute('tempo')) tempo = +s.getAttribute('tempo');
        } else if (el.tagName === 'backup') {
          t -= (+el.querySelector('duration').textContent) / divisions;
        } else if (el.tagName === 'forward') {
          t += (+el.querySelector('duration').textContent) / divisions;
        } else if (el.tagName === 'note') {
          if (el.querySelector('grace')) continue;                  // apojaturas: ignora
          const dur = (+(el.querySelector('duration') || {}).textContent || 0) / divisions;
          const chord = !!el.querySelector('chord');
          const start = chord ? lastStart : t;
          const p = el.querySelector('pitch');
          if (p) {
            const midi = 12 * (+p.querySelector('octave').textContent + 1)
              + STEP[p.querySelector('step').textContent.trim()]
              + (+(p.querySelector('alter') || {}).textContent || 0);
            const tieStop = el.querySelector('tie[type="stop"]'), tieStart = el.querySelector('tie[type="start"]');
            if (tieStop && ties[midi]) ties[midi].beats += dur;     // continua a nota ligada
            else {
              const n = { midi, beat: start, beats: dur };
              notes.push(n);
              if (tieStart) ties[midi] = n;
            }
            if (!tieStart) delete ties[midi];
          }
          if (!chord) { lastStart = t; t += dur; }
        }
      }
    }
    const spb = 60 / tempo;                                        // segundos por semínima
    return { title: title.trim(), tempo, notes: notes.map(n => ({ midi: n.midi, start: n.beat * spb, dur: n.beats * spb })) };
  }

  // .mxl = MusicXML compactado (zip). Lê o zip com a descompressão nativa do navegador.
  async function unzipMXL(buf) {
    const dv = new DataView(buf), files = {};
    let i = 0;
    while (i + 30 <= buf.byteLength && dv.getUint32(i, true) === 0x04034b50) {
      const method = dv.getUint16(i + 8, true), csize = dv.getUint32(i + 18, true);
      const nlen = dv.getUint16(i + 26, true), xlen = dv.getUint16(i + 28, true);
      const name = new TextDecoder().decode(new Uint8Array(buf, i + 30, nlen));
      const data = new Uint8Array(buf, i + 30 + nlen + xlen, csize);
      files[name] = { method, data };
      i += 30 + nlen + xlen + csize;
    }
    const inflate = async f => f.method === 0 ? f.data :
      new Uint8Array(await new Response(new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    let main = null;
    if (files['META-INF/container.xml']) {
      const c = new TextDecoder().decode(await inflate(files['META-INF/container.xml']));
      const m = c.match(/full-path="([^"]+)"/);
      if (m) main = m[1];
    }
    main = main || Object.keys(files).find(n => /\.(xml|musicxml)$/i.test(n) && !n.startsWith('META-INF'));
    if (!main) throw new Error(EJ.t('score.err.mxl'));
    return new TextDecoder().decode(await inflate(files[main]));
  }

  // ------------------------------------------------------------------ MIDI
  function parseMIDI(buf) {
    const d = new DataView(buf);
    let p = 0;
    const str = n => { let s = ''; for (let k = 0; k < n; k++) s += String.fromCharCode(d.getUint8(p + k)); p += n; return s; };
    const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
    const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
    const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
    if (str(4) !== 'MThd') throw new Error(EJ.t('score.err.midi'));
    p += 4; u16(); const ntr = u16(), div = u16();
    if (div & 0x8000) throw new Error(EJ.t('score.err.smpte'));
    const events = [];                                              // { tick, type, ... }
    for (let k = 0; k < ntr; k++) {
      if (str(4) !== 'MTrk') throw new Error(EJ.t('score.err.track'));
      const end = u32() + p;
      let tick = 0, status = 0;
      while (p < end) {
        tick += vlq();
        let b = d.getUint8(p);
        if (b & 0x80) { status = b; p++; } else b = status;         // "running status"
        const hi = status & 0xf0;
        if (status === 0xff) {
          const type = d.getUint8(p++), len = vlq();
          if (type === 0x51) events.push({ tick, tempo: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2) });
          p += len;
        } else if (status === 0xf0 || status === 0xf7) { p += vlq(); }
        else if (hi === 0x90 || hi === 0x80) {
          const note = d.getUint8(p), vel = d.getUint8(p + 1); p += 2;
          if ((status & 0x0f) === 9) continue;                      // canal 10 = bateria: ignora
          events.push({ tick, on: hi === 0x90 && vel > 0, note });
        } else if (hi === 0xc0 || hi === 0xd0) p += 1;
        else p += 2;
      }
      p = end;
    }
    events.sort((a, b) => a.tick - b.tick);
    // ticks -> segundos, respeitando mudanças de andamento
    let usPerBeat = 500000, lastTick = 0, sec = 0;
    const open = {}, notes = [];
    for (const e of events) {
      sec += (e.tick - lastTick) / div * usPerBeat / 1e6; lastTick = e.tick;
      if (e.tempo) usPerBeat = e.tempo;
      else if (e.on) (open[e.note] = open[e.note] || []).push(sec);
      else if (open[e.note] && open[e.note].length) {
        const s = open[e.note].shift();
        notes.push({ midi: e.note, start: s, dur: Math.max(.05, sec - s) });
      }
    }
    notes.sort((a, b) => a.start - b.start);
    return { title: '', tempo: Math.round(60e6 / usPerBeat), notes };
  }

  // ------------------------------------------------------------------ Imagem (OMR experimental)
  // 1) tons de cinza + limiar automático (Otsu)  2) acha as linhas da pauta (linhas quase todas pretas)
  // 3) agrupa de 5 em 5 = pautas  4) apaga as linhas  5) apaga hastes (finas e verticais)
  // 6) o que sobra do tamanho de uma cabeça de nota vira nota  7) altura -> nota (clave de sol)
  function readImage(img) {
    const scale = Math.min(1, 1600 / img.naturalWidth);
    const W = Math.round(img.naturalWidth * scale), H = Math.round(img.naturalHeight * scale);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); cx.drawImage(img, 0, 0, W, H);
    const px = cx.getImageData(0, 0, W, H).data;
    const gray = new Uint8Array(W * H), hist = new Array(256).fill(0);
    for (let i = 0; i < W * H; i++) {
      const g = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000 | 0;
      gray[i] = g; hist[g]++;
    }
    // Otsu
    let sum = 0; for (let k = 0; k < 256; k++) sum += k * hist[k];
    let sB = 0, wB = 0, best = 0, thr = 128;
    for (let k = 0; k < 256; k++) {
      wB += hist[k]; if (!wB) continue;
      const wF = W * H - wB; if (!wF) break;
      sB += k * hist[k];
      const mB = sB / wB, mF = (sum - sB) / wF, between = wB * wF * (mB - mF) ** 2;
      if (between > best) { best = between; thr = k; }
    }
    const ink = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) ink[i] = gray[i] < thr ? 1 : 0;

    // linhas da pauta: linhas com muita tinta
    const rowInk = new Array(H).fill(0);
    for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) c += ink[y * W + x]; rowInk[y] = c; }
    const maxRow = Math.max(...rowInk);
    const lines = [];
    for (let y = 0; y < H; y++) {
      if (rowInk[y] > maxRow * 0.5) {
        let y2 = y; while (y2 + 1 < H && rowInk[y2 + 1] > maxRow * 0.5) y2++;
        lines.push((y + y2) / 2); y = y2;
      }
    }
    // agrupa em pautas de 5 linhas igualmente espaçadas
    const staves = [];
    for (let i = 0; i + 4 < lines.length; i++) {
      const g = lines.slice(i, i + 5), gaps = g.slice(1).map((v, k) => v - g[k]);
      const s = gaps.reduce((a, b) => a + b) / 4;
      if (s > 3 && gaps.every(v => Math.abs(v - s) < s * 0.25)) { staves.push({ top: g[0], bottom: g[4], s }); i += 4; }
    }
    if (!staves.length) throw new Error(EJ.t('score.err.staff'));

    // apaga as linhas da pauta (só onde a tinta é fina na vertical, para não cortar as notas)
    const clean = ink.slice();
    for (const st of staves) {
      const lw = Math.max(1, Math.round(st.s * 0.18));
      for (let k = 0; k < 5; k++) {
        const ly = Math.round(st.top + k * st.s);
        for (let x = 0; x < W; x++) {
          let up = 0, dn = 0;
          while (up < st.s && ly - lw - up >= 0 && ink[(ly - lw - up) * W + x]) up++;
          while (dn < st.s && ly + lw + dn < H && ink[(ly + lw + dn) * W + x]) dn++;
          if (up + dn < st.s * 0.3) for (let y = ly - lw; y <= ly + lw; y++) if (y >= 0 && y < H) clean[y * W + x] = 0;
        }
      }
    }
    // apaga hastes: abertura horizontal (só sobra o que tem largura >= ~0,5 espaço)
    const s0 = staves[0].s, minW = Math.max(2, Math.round(s0 * 0.5));
    const heads = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      let run = 0;
      for (let x = 0; x <= W; x++) {
        if (x < W && clean[y * W + x]) run++;
        else { if (run >= minW) for (let k = x - run; k < x; k++) heads[y * W + k] = 1; run = 0; }
      }
    }
    // apaga traços horizontais finos (linhas suplementares, ex.: o dó abaixo da pauta):
    // abertura vertical — só fica o que tem altura >= ~0,4 espaço
    const minH = Math.max(2, Math.round(s0 * 0.4));
    for (let x = 0; x < W; x++) {
      let run = 0;
      for (let y = 0; y <= H; y++) {
        if (y < H && heads[y * W + x]) run++;
        else { if (run && run < minH) for (let k = y - run; k < y; k++) heads[k * W + x] = 0; run = 0; }
      }
    }
    // componentes conectados com tamanho de cabeça de nota
    const seen = new Uint8Array(W * H), found = [];
    for (let i = 0; i < W * H; i++) {
      if (!heads[i] || seen[i]) continue;
      const stack = [i]; seen[i] = 1;
      let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0, sx = 0, sy = 0;
      while (stack.length) {
        const j = stack.pop(), x = j % W, y = (j / W) | 0;
        n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const k of [j - 1, j + 1, j - W, j + W]) if (k >= 0 && k < W * H && heads[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, fill = n / (bw * bh);
      found.push({ cx: sx / n, cy: sy / n, bw, bh, fill });
    }
    const notes = [], marks = [];
    staves.forEach((st, si) => {
      const s = st.s;
      // ignora a margem esquerda (clave) — ~4 espaços depois do começo da tinta da pauta
      const inStaff = found.filter(c => c.cy > st.top - s * 3 && c.cy < st.bottom + s * 3);
      const leftEdge = Math.min(...inStaff.map(c => c.cx - c.bw / 2), W);
      inStaff
        .filter(c => c.bh > s * 0.55 && c.bh < s * 1.6 && c.bw > s * 0.8 && c.bw < s * 2.0 && c.fill > 0.5
                  && c.cx > leftEdge + s * 4)
        .sort((a, b) => a.cx - b.cx)
        .forEach(c => {
          // posição em meios-espaços acima da linha de baixo (mi4 na clave de sol)
          const steps = Math.round((st.bottom - c.cy) / (s / 2));
          const diat = 2 + steps;                                   // 0=dó4, 1=ré4, 2=mi4...
          const oct = Math.floor(diat / 7), deg = ((diat % 7) + 7) % 7;
          const midi = 60 + oct * 12 + [0, 2, 4, 5, 7, 9, 11][deg];
          notes.push({ midi, staff: si, x: c.cx });
          marks.push({ x: c.cx / scale, y: c.cy / scale, r: s / scale * 0.7 });
        });
    });
    if (!notes.length) throw new Error(EJ.t('score.err.notes'));
    // acordes: notas quase na mesma posição horizontal tocam juntas
    const beat = 0.45, out = [];
    let t = 0, lastX = -1e9, lastStaff = -1;
    for (const n of notes) {
      if (n.staff !== lastStaff || n.x - lastX > staves[n.staff].s * 0.6) { if (lastStaff !== -1) t += beat; }
      out.push({ midi: n.midi, start: t, dur: beat * 0.9 });
      lastX = n.x; lastStaff = n.staff;
    }
    return { title: '', tempo: Math.round(60 / beat), notes: out, marks, staves: staves.length, experimental: true };
  }

  // ------------------------------------------------------------------ entrada única
  const KIND = name => /\.(mid|midi)$/i.test(name) ? 'midi' : /\.mxl$/i.test(name) ? 'mxl'
    : /\.(musicxml|xml)$/i.test(name) ? 'xml' : null;

  async function load(file) {
    const kind = KIND(file.name);
    if (kind === 'midi') return parseMIDI(await file.arrayBuffer());
    if (kind === 'mxl') return parseMusicXML(await unzipMXL(await file.arrayBuffer()));
    if (kind === 'xml') return parseMusicXML(await file.text());
    throw new Error(EJ.t('score.err.format'));
  }

  const NAMES = ['dó', 'dó#', 'ré', 'ré#', 'mi', 'fá', 'fá#', 'sol', 'sol#', 'lá', 'lá#', 'si'];
  const NAMES_EN = ['C', 'C sharp', 'D', 'D sharp', 'E', 'F', 'F sharp', 'G', 'G sharp', 'A', 'A sharp', 'B'];
  const noteName = m => (EJ.i18n && EJ.i18n.lang === 'en' ? NAMES_EN : NAMES)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

  return { load, readImage, parseMusicXML, parseMIDI, isScoreFile: n => !!KIND(n), noteName };
})();
