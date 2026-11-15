// Visão computacional leve: transforma um quadro (canvas, imagem ou vídeo) em
// características que o motor de áudio usa para compor.
//
//  cor (matiz)        -> notas do acorde (12 faixas de matiz = graus da escala)
//  brilho             -> abertura do filtro (escuro = abafado, claro = brilhante)
//  densidade de brilho-> quantas notas do arpejo por pulso (luzes, nuvens, relâmpagos)
//  bordas (textura)   -> chiado rítmico (chimbal)
//  movimento          -> golpes percussivos (diferença entre quadros consecutivos)
//  calor (vermelho/laranja vs. azul) -> tensão harmônica quando não há dado de temperatura
//  colunas            -> varredura esquerda→direita: altura do pixel = altura da nota
window.EJ = window.EJ || {};
EJ.vision = (function () {
  const GW = 96, GH = 54;            // grade de análise (o quadro é reduzido para isto)
  const NCOL = 48;                   // colunas da varredura
  const BRIGHT = 0.55;               // limiar de "pixel brilhante"
  const HUE_NAMES = ['vermelho', 'laranja', 'amarelo', 'verde-limão', 'verde', 'verde-água',
    'ciano', 'azul-céu', 'azul', 'violeta', 'magenta', 'rosa'];
  const HUE_NAMES_EN = ['red', 'orange', 'yellow', 'lime green', 'green', 'teal',
    'cyan', 'sky blue', 'blue', 'violet', 'magenta', 'pink'];
  const en = () => window.EJ && EJ.i18n && EJ.i18n.lang === 'en';
  const hue = bin => (en() ? HUE_NAMES_EN : HUE_NAMES)[bin];
  let canvas = null, cx = null, prevLuma = null;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // Núcleo puro (testável sem DOM): data = RGBA (Uint8ClampedArray), w×h.
  function analyzePixels(data, w, h, prev) {
    const n = w * h, luma = new Float32Array(n), hue = new Float64Array(12);
    let sumL = 0, sumSq = 0, sumS = 0, sumSw = 0, bright = 0, hueW = 0, warm = 0, cool = 0;
    const sal = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const s = mx > 0 ? d / mx : 0;
      luma[i] = l; sumL += l; sumSq += l * l;
      if (l > BRIGHT) bright++;
      sal[i] = l * (0.4 + 0.6 * s);
      const wgt = s * mx;                           // "colorido e visível"
      if (wgt > 0.04 && d > 0) {
        let hd;
        if (mx === r) hd = ((g - b) / d + 6) % 6;
        else if (mx === g) hd = (b - r) / d + 2;
        else hd = (r - g) / d + 4;
        hd *= 60;
        hue[Math.floor(((hd + 15) % 360) / 30)] += wgt;
        hueW += wgt; sumS += s * wgt; sumSw += wgt;
        if (hd < 70 || hd >= 330) warm += wgt;
        else if (hd >= 170 && hd <= 270) cool += wgt;
      }
    }
    const meanL = sumL / n;
    const contrast = Math.sqrt(Math.max(0, sumSq / n - meanL * meanL));

    // bordas: média do gradiente (diferenças centrais)
    let edge = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        edge += Math.abs(luma[i + 1] - luma[i - 1]) + Math.abs(luma[i + w] - luma[i - w]);
      }
    }
    edge /= 2 * (w - 2) * (h - 2);

    // movimento: diferença média absoluta de brilho entre dois quadros
    let motion = 0;
    if (prev && prev.length === n) {
      for (let i = 0; i < n; i++) motion += Math.abs(luma[i] - prev[i]);
      motion /= n;
    }

    // matizes dominantes (até 3), ordenados por peso
    const order = [...hue.keys()].sort((a, b) => hue[b] - hue[a]);
    const topHues = order.slice(0, 3).filter(b => hue[b] > 0.12 * hue[order[0]] && hue[b] > 0)
      .map(b => ({ bin: b, w: hue[b] / hueW }));

    // colunas p/ varredura: até 2 picos de saliência por coluna (separados por ≥ 6 linhas)
    const cw = w / NCOL, cols = [];
    for (let c = 0; c < NCOL; c++) {
      const x0 = Math.floor(c * cw), x1 = Math.max(x0 + 1, Math.floor((c + 1) * cw));
      const rows = [];
      for (let y = 0; y < h; y++) {
        let a = 0;
        for (let x = x0; x < x1; x++) a += sal[y * w + x];
        rows.push([a / (x1 - x0), y]);
      }
      rows.sort((p, q) => q[0] - p[0]);
      const peaks = [];
      for (const [a, y] of rows) {
        if (a < 0.1 || peaks.length >= 2) break;
        if (peaks.every(p => Math.abs(p.row - y) >= 6)) {
          const i = y * w + x0, r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
          const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
          let hd = 0;
          if (d > 0) {
            if (mx === r) hd = (((g - b) / d + 6) % 6) * 60;
            else if (mx === g) hd = ((b - r) / d + 2) * 60;
            else hd = ((r - g) / d + 4) * 60;
          }
          peaks.push({ row: y, y: y / (h - 1), a: clamp(a), hue: hd, bin: Math.floor(((hd + 15) % 360) / 30),
                       warm: d > 0.05 && (hd < 70 || hd >= 330) });
        }
      }
      cols.push({ x: c / (NCOL - 1), peaks });
    }

    return {
      w, h, luma,
      bright: meanL,                       // 0..1
      contrast,
      sat: sumSw ? sumS / sumSw : 0,       // saturação média das áreas coloridas
      density: bright / n,                 // fração de pixels brilhantes
      edge,                                // ~0..0.3 em imagens reais
      motion,                              // ~0..0.1
      warm: hueW ? warm / hueW : 0,        // fração do "colorido" que é quente
      cool: hueW ? cool / hueW : 0,
      hue: Array.from(hue, v => (hueW ? v / hueW : 0)),
      topHues, cols
    };
  }

  function ensure() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.width = GW; canvas.height = GH;
    cx = canvas.getContext('2d', { willReadFrequently: true });
  }

  // Analisa um <canvas>, <img> ou <video>. Retorna null se a fonte ainda não está pronta.
  function analyze(src) {
    if (!src) return null;
    if (src.tagName === 'VIDEO' && src.readyState < 2) return null;
    if (src.tagName === 'IMG' && !src.complete) return null;
    ensure();
    try {
      cx.drawImage(src, 0, 0, GW, GH);
      const img = cx.getImageData(0, 0, GW, GH);
      const f = analyzePixels(img.data, GW, GH, prevLuma);
      prevLuma = f.luma;
      return f;
    } catch (e) {                          // canvas "sujo" (CORS) ou fonte inválida
      return null;
    }
  }

  const level = (v, cuts, words) => words[cuts.filter(c => v >= c).length];

  // Descrição em texto (leitores de tela, baixa visão): o que a imagem "mostra" e por que soa assim.
  function describe(f) {
    if (!f) return '';
    // plano B: sem i18n.js carregado (ex.: testes automáticos), fala em português
    const PT = { 'vis.dominated': 'dominada por {list}', 'vis.and': ' e ', 'vis.noColor': 'quase sem cor',
      'vis.b0': 'muito escura', 'vis.b1': 'escura', 'vis.b2': 'equilibrada', 'vis.b3': 'clara',
      'vis.m0': 'sem movimento perceptível', 'vis.m1': 'com movimento suave', 'vis.m2': 'com movimento forte',
      'vis.sentence': 'Imagem {bright}, {colors}; {dens}% dos pixels são pontos brilhantes; {mov}.' };
    const t = (window.EJ && EJ.t) ? EJ.t
      : (k, v) => PT[k].replace(/\{(\w+)\}/g, (m, x) => (v && x in v ? v[x] : m));
    const names = f.topHues.map(h => hue(h.bin));
    const colors = names.length ? t('vis.dominated', { list: names.length > 1
      ? names.slice(0, -1).join(', ') + t('vis.and') + names[names.length - 1] : names[0] }) : t('vis.noColor');
    const bright = level(f.bright, [0.1, 0.25, 0.45], [t('vis.b0'), t('vis.b1'), t('vis.b2'), t('vis.b3')]);
    const dens = Math.round(f.density * 100);
    const mov = level(f.motion, [0.004, 0.02], [t('vis.m0'), t('vis.m1'), t('vis.m2')]);
    return t('vis.sentence', { bright, colors, dens, mov });
  }

  return {
    analyze, analyzePixels, describe, reset() { prevLuma = null; },
    HUE_NAMES, GW, GH, NCOL,
    hueName: bin => hue(bin)
  };
})();
