// Globo 3D (Three.js) — Terra com texturas da NASA (Blue Marble NG, Black Marble 2016,
// topografia BMNG e máscara de água MODIS — scripts/build_textures.py) e camadas dirigidas pelos dados:
//   🌊 inundação costeira (relevo real, exagero vertical p/ escala global)
//   🧊 gelo marinho do Ártico (borda calculada da extensão NASA GSFC + ruído)
//   🌃 luzes noturnas (acendem com a industrialização, no lado escuro)
//   🌡️ mapa real de anomalia de temperatura (GISTEMP + modelo GISS) + atmosfera que engrossa com CO₂
//   🌿 vegetação (MODIS NDVI)   🔥 queimadas (MODIS)   ☁️ nuvens (VIIRS, levadas pelo vento)
//   🌬️ ventos como fluido (modelo GISS, partículas com rastro na GPU)
// As texturas das camadas são geradas por scripts/build_layers.py (metadados em data/layers.js).
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

window.EJ = window.EJ || {};

const container = document.getElementById('globe');
const loadingEl = document.getElementById('loading');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function fail(msg) {
  if (!loadingEl) return;
  loadingEl.classList.remove('hide');
  loadingEl.classList.add('error');
  loadingEl.querySelector('p').innerHTML = msg;
}

let renderer = null;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
catch (e) { fail('Seu navegador não suporta WebGL — o globo 3D não vai aparecer.'); }

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // telas muito densas pesam demais
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  camera.position.set(0, 0.75, 3.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.3; controls.maxDistance = 8;
  controls.rotateSpeed = 0.5;

  // ---------- 🔍 ZOOM PRÓPRIO (corrige o zoom "bugado") ----------
  // O OrbitControls do three.js 0.160 divide o passo do zoom por (devicePixelRatio | 0): com o
  // zoom do navegador abaixo de 100% isso vira 0 → divisão por zero → a Terra pula de uma vez
  // para perto ou longe. Aqui a roda do mouse / pinça do touchpad é tratada por nós: o zoom é
  // suave e proporcional ao gesto. A pinça no celular continua com o OrbitControls (não tem o bug).
  const HOME = camera.position.clone();                         // posição inicial (para "centralizar")
  let zoomGoal = null, homeDir = null;
  let shiftGoal = 0, shiftCur = 0;                              // painel aberto: Terra desliza p/ a esquerda
  const zoomBy = f => {
    const d = zoomGoal ?? camera.position.length();
    zoomGoal = clamp(d * f, controls.minDistance, controls.maxDistance);
  };
  container.addEventListener('wheel', e => {
    e.preventDefault(); e.stopPropagation();                    // não deixa chegar no OrbitControls
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= innerHeight;   // linhas / páginas
    zoomBy(Math.exp(clamp(dy, -240, 240) * 0.0013));
  }, { capture: true, passive: false });
  controls.addEventListener('start', () => { homeDir = null; });   // usuário arrastou: cancela "centralizar"

  // ---------- estrelas ----------
  {
    const n = 4000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.randomDirection().multiplyScalar(60 + Math.random() * 120);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      const t = Math.random(), b = .35 + Math.random() * .65;
      const c = t < .72 ? [1, 1, 1] : t < .9 ? [.68, .78, 1] : [1, .85, .62];
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      size: .55, vertexColors: true, sizeAttenuation: true, depthWrite: false, transparent: true
    })));
  }

  // ---------- texturas (NASA, públicas, empacotadas em assets/) ----------
  const manager = new THREE.LoadingManager();
  manager.onLoad = () => { loadingEl.classList.add('hide'); dispatchEvent(new Event('ej-globe-ready')); };
  manager.onError = url => fail(EJ.t('load.error', { url }));
  const loader = new THREE.TextureLoader(manager);
  const tex = (p, srgb) => {
    const t = loader.load(p);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };

  // Atlas de dados (um quadro por ano): sem repetição e sem mipmaps, para um quadro
  // não "vazar" no vizinho. srgb=true só para a vegetação, que já vem colorida.
  const L = window.EJ_LAYERS || {};
  const atlas = (key, srgb) => {
    const m = L[key];
    if (!m) return { tex: null, grid: new THREE.Vector4(1, 1, 1, 1), meta: null };
    const t = loader.load(m.atlas || m.image);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return { tex: t, grid: new THREE.Vector4(m.cols || 1, m.rows || 1, m.frameW || 1, m.frameH || 1), meta: m };
  };
  const A = { temp: atlas('temp'), ndvi: atlas('ndvi', true), fire: atlas('fire'), ozone: atlas('ozone') };

  const SUN = new THREE.Vector3(4, 1.4, 2.2).normalize();
  const U = {
    uDay:   { value: tex('assets/textures/earth-day.jpg', true) },
    uNight: { value: tex('assets/textures/earth-night.jpg', true) },
    uTopo:  { value: tex('assets/textures/earth-topology.png', false) },
    uWater: { value: tex('assets/textures/earth-water.png', false) },   // branco = oceano
    uSunDir: { value: SUN },
    uHeat: { value: 0 }, uHeatOn: { value: 0 },
    uLights: { value: 0 }, uLightsOn: { value: 1 },
    uSea: { value: 0 }, uSeaOn: { value: 1 },
    uIceEdge: { value: 76 }, uIceOn: { value: 1 },
    uAtmoColor: { value: new THREE.Color(0x3f7dff) },
    uTime: { value: 0 },
    uRelief: { value: 1 },                                      // ⛰️ relevo sempre ligado (0 = liso)
    // camadas com atlas: textura, grade (colunas, linhas, largura e altura do quadro)
    // e F = (quadro A, quadro B, mistura) para transição suave entre anos
    uTempTex: { value: A.temp.tex }, uTempGrid: { value: A.temp.grid }, uTempF: { value: new THREE.Vector3() },
    uNdviTex: { value: A.ndvi.tex }, uNdviGrid: { value: A.ndvi.grid }, uNdviF: { value: new THREE.Vector3() },
    uNdviOn: { value: 0 },
    uFireTex: { value: A.fire.tex }, uFireGrid: { value: A.fire.grid }, uFireF: { value: new THREE.Vector3() },
    uFireOn: { value: 0 },
    // 🌊 água: textura das correntes (R=leste, G=norte, B=é mar) e força da visualização
    uOcean: { value: L.ocean ? (() => { const o = loader.load(L.ocean.atlas); o.generateMipmaps = false;
                                         o.minFilter = THREE.LinearFilter; return o; })() : null },
    uOceanOn: { value: 0 },
    uLic: { value: L.ocean_lic ? (() => { const o = loader.load(L.ocean_lic.image); o.wrapS = THREE.RepeatWrapping; return o; })() : null },
    uWaves: { value: (() => { const o = loader.load('assets/textures/waves.png');
                              o.wrapS = o.wrapT = THREE.RepeatWrapping; return o; })() },
    uAxis: { value: new THREE.Vector3(0, 1, 0) },               // eixo norte da Terra (para as ondas)
    uOzoneTex: { value: A.ozone.tex }, uOzoneGrid: { value: A.ozone.grid }, uOzoneF: { value: new THREE.Vector3() },
    uOzoneOn: { value: 0 }
  };

  const VERT = /* glsl */`
    varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
    void main(){
      vUv = uv;
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;

  // ⛰️ Vértices da Terra: sobe cada ponto de terra firme conforme a altitude (relevo de verdade,
  // visível na borda do planeta). Exagero vertical ~20x: em escala real o Everest teria 0,14%
  // do raio e seria invisível. O oceano não sobe.
  const RELIEF_HEIGHT = 0.03;                                   // altura máxima (fração do raio)
  const EARTH_VERT = /* glsl */`
    uniform sampler2D uTopo, uWater;
    varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
    void main(){
      vUv = uv;
      float land = 1.0 - texture2D(uWater, uv).r;
      float h = texture2D(uTopo, uv).r * land;                  // 0 no mar … 1 nos picos mais altos
      vec3 p = position * (1.0 + h * ${RELIEF_HEIGHT.toFixed(4)});
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;

  const FRAG = /* glsl */`
    uniform sampler2D uDay, uNight, uTopo, uWater;
    uniform vec3 uSunDir, uAtmoColor;
    uniform float uHeat, uHeatOn, uLights, uLightsOn, uSea, uSeaOn, uIceEdge, uIceOn, uRelief;

    // ⛰️ Relevo por "bump mapping": compara a altitude deste pixel com a dos vizinhos na tela
    // e inclina a normal da superfície. A esfera continua lisa; só a luz muda.
    // (mesma técnica do three.js — perturbNormalArb)
    vec3 reliefNormal(vec2 uv, vec3 n, vec3 pos, float scale){
      vec2 dx = dFdx(uv), dy = dFdy(uv);
      if (abs(dx.x) > 0.5 || abs(dy.x) > 0.5) return n;          // costura da textura (lon ±180°)
      float h0 = texture2D(uTopo, uv).r;
      float dHx = (texture2D(uTopo, uv + dx).r - h0) * scale;
      float dHy = (texture2D(uTopo, uv + dy).r - h0) * scale;
      vec3 sx = dFdx(pos), sy = dFdy(pos);
      vec3 r1 = cross(sy, n), r2 = cross(n, sx);
      float det = dot(sx, r1);
      vec3 grad = sign(det) * (dHx * r1 + dHy * r2);
      return normalize(abs(det) * n - grad);
    }
    uniform float uTime, uNdviOn, uFireOn, uOzoneOn, uOceanOn;
    uniform sampler2D uOcean, uLic, uWaves;
    uniform vec3 uAxis;
    uniform sampler2D uTempTex, uNdviTex, uFireTex, uOzoneTex;
    uniform vec4 uTempGrid, uNdviGrid, uFireGrid, uOzoneGrid;
    uniform vec3 uTempF, uNdviF, uFireF, uOzoneF;
    varying vec2 vUv; varying vec3 vN; varying vec3 vPos;

    // Coordenada dentro do atlas para o quadro 'frame' (quadros contados da esquerda
    // para a direita, de cima para baixo). Recua meio pixel da borda para não vazar.
    vec2 atlasUv(vec2 uv, float frame, vec4 g){
      float col = mod(frame, g.x), row = floor(frame / g.x);
      vec2 px = g.zw;
      vec2 inner = clamp(uv * px, vec2(0.5), px - 0.5) / px;
      return vec2((col + inner.x) / g.x, 1.0 - (row + 1.0 - inner.y) / g.y);
    }
    // Lê o ano atual misturando dois quadros (A e B) pela fração F.z
    vec4 atlas(sampler2D t, vec4 g, vec3 F){
      return mix(texture2D(t, atlasUv(vUv, F.x, g)), texture2D(t, atlasUv(vUv, F.y, g)), F.z);
    }
    // Paleta da anomalia de temperatura (°C): azul (frio) → transparente → amarelo → vermelho → magenta
    vec4 tempColor(float a){
      vec3 c = a < 0.0 ? vec3(0.25, 0.55, 1.0)
             : a < 1.5 ? mix(vec3(1.0, 0.92, 0.45), vec3(1.0, 0.55, 0.15), a / 1.5)
             : a < 4.0 ? mix(vec3(1.0, 0.55, 0.15), vec3(0.85, 0.08, 0.10), (a - 1.5) / 2.5)
             :           mix(vec3(0.85, 0.08, 0.10), vec3(0.55, 0.0, 0.45), clamp((a - 4.0) / 5.0, 0.0, 1.0));
      return vec4(c, smoothstep(0.25, 1.6, abs(a)) * 0.82);
    }

    // ruído pseudoaleatório SEM sin(): estável em qualquer placa de vídeo (Dave Hoskins, hash12)
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
                 mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
    }
    float fbm(vec2 p){ return vnoise(p) * .55 + vnoise(p * 2.7) * .3 + vnoise(p * 6.3) * .15; }

    void main(){
      vec3 n = normalize(vN);
      vec3 day = texture2D(uDay, vUv).rgb;
      float water = texture2D(uWater, vUv).r;        // 1 = oceano
      float land = 1.0 - water;
      float elev = texture2D(uTopo, vUv).r;          // 0 = nível do mar
      float lat = (vUv.y - 0.5) * 180.0;
      float lon = (vUv.x - 0.5) * 360.0;

      // --- 🌊 inundação costeira (exagero vertical para leitura global)
      float t = uSeaOn * uSea * 0.05;
      float flood = land * (1.0 - smoothstep(t * 0.45, t, elev)) * step(0.0001, t);
      vec3 shallow = vec3(0.10, 0.42, 0.60), deep = vec3(0.02, 0.14, 0.34);
      day = mix(day, mix(deep, shallow, clamp(elev / max(t, 1e-4), 0.0, 1.0)), clamp(flood, 0.0, 1.0) * 0.92);

      // --- 🌿 vegetação (NDVI médio do ano; transparente no oceano)
      vec4 nd = atlas(uNdviTex, uNdviGrid, uNdviF);
      day = mix(day, nd.rgb, nd.a * uNdviOn * 0.7 * (1.0 - flood));

      // --- 🧊 gelo marinho (borda da extensão real + ruído; retém perto da Groenlândia)
      float bias = 7.0 * exp(-pow((lon + 60.0) / 42.0, 2.0));
      float nz = (fbm(vUv * vec2(90.0, 45.0)) - 0.5) * 5.0;
      float edgeN = uIceEdge - bias + nz;
      float iceN = smoothstep(edgeN, edgeN + 2.0, lat) * water;
      float edgeS = -62.0 + nz;
      float iceS = (1.0 - smoothstep(edgeS - 2.0, edgeS, lat)) * water;
      float ice = uIceOn * clamp(iceN + iceS, 0.0, 1.0);
      vec3 iceCol = vec3(0.93, 0.97, 1.0) * (0.82 + 0.18 * vnoise(vUv * 260.0));
      day = mix(day, iceCol, ice);
      flood *= 1.0 - ice;

      // --- 🌡️ mapa de anomalia de temperatura (vem depois do gelo para mostrar o Ártico esquentando)
      vec4 tRaw = atlas(uTempTex, uTempGrid, uTempF);
      float anom = (tRaw.r * 255.0 - 1.0) / 254.0 * 18.0 - 6.0;        // decodifica 1..255 -> -6..+12 °C
      vec4 tc = tempColor(anom) * step(0.5 / 255.0, tRaw.r);          // 0 = sem dado
      day = mix(day, tc.rgb, tc.a * uHeatOn);

      // --- iluminação (sol fixo; a Terra gira => dia e noite)
      // relevo só em terra firme (sem gelo/inundação por cima)
      // --- 🌊 ÁGUA EM MOVIMENTO (flow map, tudo com texturas prontas = leve)
      // Ondas e "riscos" das correntes são arrastados na direção e velocidade das correntes reais.
      // Truque das duas fases: duas cópias defasadas meio ciclo; enquanto uma "reinicia", a outra
      // está no auge — o arrasto nunca estica nem dá salto.
      float sea = water * (1.0 - ice);                                           // só mar aberto
      vec3 nw = n;
      if (sea > 0.01) {
        vec3 oc = texture2D(uOcean, vUv).rgb;
        vec2 cur = ((oc.rg * 255.0 - 1.0) / 254.0 * 2.0 - 1.0) * step(0.5, oc.b);   // m/s (leste, norte)
        float cl = max(cos(radians(lat)), 0.2);
        vec2 flowUv = vec2(cur.x / cl / 360.0, cur.y / 180.0) * 14.0;            // deslocamento por ciclo
        float T = uTime * 0.22, p0 = fract(T), p1 = fract(T + 0.5);
        float w0 = 1.0 - abs(2.0 * p0 - 1.0);

        // ondas: textura repetível (R altura, G/B inclinação), sempre derivando devagar
        vec2 wb = vUv * vec2(360.0, 180.0) / 8.0 + vec2(uTime * 0.006, uTime * 0.002);
        vec2 fw = flowUv * vec2(360.0, 180.0) / 8.0 * uOceanOn;
        vec3 wa = texture2D(uWaves, wb - fw * p0).rgb, wc = texture2D(uWaves, wb + 0.37 - fw * p1).rgb;
        vec3 wv = wa * w0 + wc * (1.0 - w0);
        float hw = wv.r;
        vec2 g = wv.gb * 2.0 - 1.0;                                              // inclinação leste/norte

        // 🧭 caminhos das correntes: riscos alinhados ao fluxo (LIC) deslizando ao longo do caminho
        float la = texture2D(uLic, vUv - flowUv * p0).r, lb = texture2D(uLic, vUv - flowUv * p1 + vec2(0.5, 0.0)).r;
        float streak = smoothstep(0.45, 0.78, la * w0 + lb * (1.0 - w0));
        float spd = smoothstep(0.015, 0.12, length(cur)) * uOceanOn;            // só onde há corrente de verdade

        day = mix(day, day * (0.85 + 0.3 * hw), sea);                            // tom das ondas
        day += vec3(0.18, 0.70, 0.75) * streak * spd * sea;                      // trilhas verde-água
        vec3 east = normalize(cross(uAxis, n) + 1e-5), north = cross(n, east);
        nw = normalize(n - 0.12 * sea * (g.x * east + g.y * north));
      }

      vec3 nr = reliefNormal(vUv, n, vPos, 0.07 * uRelief * land * (1.0 - clamp(flood, 0.0, 1.0)));
      float sun = dot(nr, normalize(uSunDir));
      float dayAmt = clamp(sun * 1.6 + 0.12, 0.0, 1.0);
      vec3 viewDir = normalize(cameraPosition - vPos);
      vec3 h = normalize(normalize(uSunDir) + viewDir);
      // brilho do sol na água: usa a normal das ondas, então o reflexo cintila e anda com a corrente
      float spec = pow(max(dot(nw, h), 0.0), 70.0) * sea * dayAmt;
      float glint = pow(max(dot(nw, h), 0.0), 600.0) * sea * dayAmt;
      vec3 col = day * (dayAmt * 1.05 + 0.05) + spec * vec3(0.9, 0.95, 1.0) * 0.55 + glint * vec3(1.0) * 1.2;

      // --- 🌃 luzes das cidades no lado escuro (NASA Black Marble 2016; crescem com a industrialização)
      float nightSide = 1.0 - smoothstep(0.0, 0.28, dayAmt);
      vec3 city = texture2D(uNight, vUv).rgb * vec3(1.0, 0.84, 0.58) * 1.7;
      col += city * uLightsOn * uLights * nightSide
           * (1.0 - clamp(flood, 0.0, 1.0) * 0.85)   // cidades inundadas apagam
           * (1.0 - ice);
      // --- 🌙 luar: o lado da noite fica azul-escuro (igual em todos os anos), não preto total
      col += nightSide * (vec3(0.0012, 0.0060, 0.0120) * (0.6 + 0.4 * water) + day * vec3(0.020, 0.028, 0.045));

      // --- 🔥 queimadas: brasas que tremulam; só fogo frequente, mais forte no lado da noite
      float fire = smoothstep(0.3, 0.9, atlas(uFireTex, uFireGrid, uFireF).r);    // ignora focos raros
      float flicker = 0.7 + 0.3 * sin(uTime * 7.0 + hash(floor(vUv * 720.0)) * 30.0);
      float night = 1.0 - smoothstep(0.0, 0.3, dayAmt);
      col += vec3(1.0, 0.38, 0.06) * fire * flicker * uFireOn * (0.45 + 1.4 * night);

      // --- 🛡️ buraco de ozônio: abaixo de 220 DU (definição oficial de "buraco") fica roxo;
      //     entre 240 e 220 DU vai aparecendo em azul. Visível de dia e de noite.
      float ozRaw = atlas(uOzoneTex, uOzoneGrid, uOzoneF).r;
      float du = (ozRaw * 255.0 - 1.0) / 254.0 * 400.0 + 100.0;      // decodifica 1..255 -> 100..500 DU
      float hole = smoothstep(240.0, 205.0, du) * step(0.5 / 255.0, ozRaw);
      vec3 ozCol = mix(vec3(0.20, 0.45, 1.0), vec3(0.55, 0.10, 0.85), smoothstep(220.0, 140.0, du));
      col = mix(col, ozCol, hole * 0.8 * uOzoneOn);

      // --- halo atmosférico na borda
      col += uAtmoColor * pow(1.0 - max(dot(n, viewDir), 0.0), 3.5) * (0.22 + uHeat * 0.18);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  const tilt = new THREE.Group();
  tilt.rotation.z = THREE.MathUtils.degToRad(-23.4);
  scene.add(tilt);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 512, 256),                     // malha fina: o relevo precisa de vértices
    new THREE.ShaderMaterial({ uniforms: U, vertexShader: EARTH_VERT, fragmentShader: FRAG })
  );
  tilt.add(earth);

  // ---------- atmosfera (fresnel aditivo) ----------
  const atmoU = { uColor: U.uAtmoColor, uIntensity: { value: 0.8 } };
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.07, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: atmoU,
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uIntensity;
        varying vec3 vN; varying vec3 vPos;
        void main(){
          vec3 v = normalize(cameraPosition - vPos);
          float f = pow(1.0 - abs(dot(normalize(vN), v)), 3.2);
          gl_FragColor = vec4(uColor * f * uIntensity, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  scene.add(atmo);

  // ---------- 🌬️ campo de vento do ano atual (compartilhado por nuvens e ventos) ----------
  // O atlas (data/layers.js → wind) tem um quadro por década; aqui os dois quadros em volta do ano
  // são misturados na CPU numa textura pequena (144×90) que REPETE na longitude: a GPU interpola
  // sem emenda no meridiano de 180°. R = vento para leste, G = para norte (1..255 → −15..+15 m/s).
  const WM = L.wind;
  const windW = WM ? WM.frameW : 1, windH = WM ? WM.frameH : 1;
  const windData = new Uint8Array(windW * windH * 4).fill(128);   // 128 ≈ vento zero até carregar
  const windCur = new THREE.DataTexture(windData, windW, windH);
  windCur.wrapS = THREE.RepeatWrapping;
  windCur.minFilter = windCur.magFilter = THREE.LinearFilter;
  windCur.needsUpdate = true;
  let windPx = null, windKey = '';
  if (WM) new THREE.ImageLoader(manager).load(WM.atlas, img => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    windPx = g.getImageData(0, 0, img.width, img.height).data;
    windKey = '';
  });
  // F = [quadro A, quadro B, mistura]; só refaz a textura quando algo mudou de verdade
  function setWind(F) {
    if (!windPx) return;
    const key = F[0] + ':' + F[1] + ':' + F[2].toFixed(2);
    if (key === windKey) return;
    windKey = key;
    const W = WM.cols * WM.frameW, t = F[2];
    const base = f => [(f % WM.cols) * WM.frameW, Math.floor(f / WM.cols) * WM.frameH];
    const [ax, ay] = base(F[0]), [bx, by] = base(F[1]);
    for (let y = 0; y < windH; y++) {
      const row = windH - 1 - y;                                  // textura: linha 0 = sul
      for (let x = 0; x < windW; x++) {
        const ia = ((ay + row) * W + ax + x) * 4, ib = ((by + row) * W + bx + x) * 4, o = (y * windW + x) * 4;
        windData[o] = windPx[ia] + (windPx[ib] - windPx[ia]) * t;
        windData[o + 1] = windPx[ia + 1] + (windPx[ib + 1] - windPx[ia + 1]) * t;
        windData[o + 3] = 255;
      }
    }
    windCur.needsUpdate = true;
  }
  // GLSL comum: vento (m/s) num ponto da textura (lon/lat → uv como nas outras camadas)
  const WIND_GLSL = /* glsl */`
    uniform sampler2D uWind;
    vec2 windAt(vec2 uv){ return (texture2D(uWind, uv).rg * 255.0 - 1.0) / 254.0 * 30.0 - 15.0; }`;

  // ---------- ☁️ nuvens: dias reais que se transformam um no outro, levados pelo vento ----------
  // Antes: troca de imagem a cada 1,5 s → as nuvens "piscavam" (somem num lugar, aparecem em outro).
  // Agora, entre o dia A e o dia B (uMix vai de 0 a 1):
  //   • o dia A é levado PARA A FRENTE pelo vento real (até 1 dia de deslocamento) e
  //   • o dia B é trazido DE VOLTA (de −1 dia até 0) — os dois tendem a se encontrar no meio,
  //     como acontece com as nuvens de verdade de um dia para o outro;
  //   • a troca A→B acontece em manchas (ruído), cada pedaço do céu no seu tempo, sem "piscar" geral.
  // Imagens em tons de cinza carregadas como textura de 1 canal (4× menos memória de vídeo); os
  // primeiros dias entram no carregamento e os outros chegam aos poucos, em segundo plano.
  const cloudList = L.clouds ? (L.clouds.images || [L.clouds.image]) : [];
  const cloudTex = [], cloudReady = [];
  const lazyLoader = new THREE.TextureLoader();
  function loadCloud(i, first) {
    if (i >= cloudList.length || cloudTex[i]) return;
    cloudTex[i] = (first ? loader : lazyLoader).load(cloudList[i], () => { cloudReady[i] = true; });
    cloudTex[i].format = THREE.RedFormat;
    cloudTex[i].wrapS = THREE.RepeatWrapping;
  }
  loadCloud(0, true); loadCloud(1, true);
  const CLOUD_DAY_S = 7;                                         // segundos por dia de nuvem
  const cloudU = { uCloudA: { value: cloudTex[0] || null }, uCloudB: { value: cloudTex[1] || cloudTex[0] || null },
                   uMix: { value: 0 }, uSunDir: { value: SUN }, uOn: { value: 1 }, uWind: { value: windCur } };
  let cloudDay = 0, cloudF = 0;                                  // dia A atual e progresso até o dia B
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.034, 96, 96),
    new THREE.ShaderMaterial({
      uniforms: cloudU, vertexShader: VERT, transparent: true, depthWrite: false,
      fragmentShader: /* glsl */`
        uniform sampler2D uCloudA, uCloudB; uniform vec3 uSunDir; uniform float uOn, uMix;
        varying vec2 vUv; varying vec3 vN;
        ${WIND_GLSL}
        float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
        }
        void main(){
          float lat = (vUv.y - 0.5) * 3.14159265;
          vec2 w = windAt(vUv);
          // 1 dia de vento em coordenadas de textura (u = 360° de longitude, v = 180° de latitude)
          vec2 day = vec2(w.x / (111320.0 * max(cos(lat), 0.25)) / 360.0, w.y / 110540.0 / 180.0) * 86400.0;
          day *= 1.0 - smoothstep(1.15, 1.40, abs(lat));          // perto dos polos não desloca
          float f = uMix;
          float a = texture2D(uCloudA, vUv - day * f).r;           // dia A levado adiante
          float b = texture2D(uCloudB, vUv + day * (1.0 - f)).r;   // dia B trazido de volta
          // troca em manchas: cada região passa de A para B num momento diferente
          float n = vnoise(vUv * vec2(26.0, 13.0)) * 0.65 + vnoise(vUv * vec2(71.0, 35.5)) * 0.35;
          float t = smoothstep(0.0, 1.0, clamp((f - n * 0.6) / 0.4, 0.0, 1.0));
          float c = mix(a, b, t);                                  // 0 = céu limpo, 1 = nuvem densa
          c = smoothstep(0.06, 0.85, c);                           // névoa fraca some, nuvem grossa fica
          float lit = clamp(dot(normalize(vN), normalize(uSunDir)) * 1.6 + 0.12, 0.0, 1.0);
          gl_FragColor = vec4(vec3(lit * 1.02 + 0.03), c * uOn * 0.9);   // de noite fica escura
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );

  clouds.renderOrder = 1;
  earth.add(clouds);                                             // gira junto com a Terra (o vento move)

  // ---------- 🌬️ ventos como FLUIDO: 65 mil partículas na placa de vídeo, com rastro ----------
  // Técnica de "traçadores" de mecânica dos fluidos (como os mapas de vento animados):
  //   1. ATUALIZA: as posições ficam numa textura 256×256 (uma partícula por pixel). Um shader move
  //      cada uma pelo vento real (campo acima) e, de vez em quando, a faz renascer em outro lugar.
  //   2. RASTRO: numa textura do planeta inteiro (2048×1024, mapa lat/lon) o quadro anterior é
  //      redesenhado um pouco mais apagado e as partículas são pintadas por cima → linhas de corrente
  //      contínuas que escorrem e somem devagar, como tinta num fluido.
  //   3. MOSTRA: uma esfera logo acima das nuvens pinta o rastro (azul onde o vento é fraco, branco
  //      onde é forte). Tudo na GPU: o processador quase não trabalha, e nada roda com a camada desligada.
  // Posições guardadas em 2 bytes por eixo (precisão 1/65025) com arredondamento aleatório, para
  // partículas lentas não "travarem" — funciona em qualquer placa com WebGL2, sem extensões.
  function makeWindFluid() {
    if (!WM || !renderer.capabilities.isWebGL2) return null;
    const S = 128, N = S * S, TW = 2048, TH = 1024;              // 16.384 partículas
    const rt = (w, h, o) => {
      const t = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false, generateMipmaps: false, ...o });
      return t;
    };
    const near = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    const state = [rt(S, S, near), rt(S, S, near)];
    const trail = [0, 1].map(() => {
      const t = rt(TW, TH, { format: THREE.RedFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      t.texture.wrapS = THREE.RepeatWrapping;
      return t;
    });
    // posições iniciais: uniformes sobre a esfera (latitude = asen de um número aleatório)
    const init = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) {
      const u = Math.random(), v = Math.asin(Math.random() * 2 - 1) / Math.PI + 0.5;
      const pu = u * 255, pv = Math.min(v, 0.99999) * 255;
      init[i * 4] = Math.round((pu % 1) * 255); init[i * 4 + 1] = Math.round((pv % 1) * 255);
      init[i * 4 + 2] = Math.floor(pu); init[i * 4 + 3] = Math.floor(pv);
    }
    const initTex = new THREE.DataTexture(init, S, S);
    initTex.needsUpdate = true;
    const RAND = /* glsl */`
      float rand(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec2 decodePos(vec4 c){ return vec2(c.r / 255.0 + c.b, c.g / 255.0 + c.a); }`;
    const QUAD_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = m => { const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false; return q; };

    // 1. atualizar posições
    const updMat = new THREE.ShaderMaterial({
      uniforms: { uState: { value: initTex }, uWind: { value: windCur }, uDt: { value: 0 },
                  uSpeed: { value: 0.5 }, uSeed: { value: 0 } },
      vertexShader: QUAD_VERT, depthTest: false, depthWrite: false,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform sampler2D uState; uniform float uDt, uSpeed, uSeed;
        varying vec2 vUv;
        ${WIND_GLSL}
        ${RAND}
        void main(){
          vec2 pos = decodePos(texture2D(uState, vUv));
          vec2 w = windAt(pos);
          float lat = (pos.y - 0.5) * 3.14159265;
          pos += vec2(w.x / max(cos(lat), 0.08) / 360.0, w.y / 180.0) * uSpeed * uDt;   // uSpeed: graus/s por m/s
          vec2 seed = vUv * 517.3 + uSeed;
          float life = 0.0035 + length(w) * 0.0004;                // ~5 s de vida; vento forte renova mais
          if (rand(seed) < life * uDt * 60.0 || pos.y < 0.025 || pos.y > 0.975)
            pos = vec2(rand(seed + 1.7), asin(rand(seed + 3.1) * 2.0 - 1.0) / 3.14159265 + 0.5);
          pos += (vec2(rand(seed + 5.3), rand(seed + 7.9)) - 0.5) / 65025.0;   // arredondamento aleatório
          pos = vec2(fract(pos.x), clamp(pos.y, 0.0, 0.99998));
          gl_FragColor = vec4(fract(pos * 255.0), floor(pos * 255.0) / 255.0);
        }`
    });
    const updScene = new THREE.Scene(); updScene.add(quad(updMat));

    // 2. rastro: quadro anterior mais apagado + partículas por cima
    // apaga um pouco o quadro anterior: as linhas antigas somem devagar e formam a cauda.
    // (−0,5/255: sem isso, valores baixos "travariam" na precisão de 8 bits e nunca sumiriam)
    const fadeMat = new THREE.ShaderMaterial({
      uniforms: { uPrev: { value: null }, uFade: { value: 0.97 } },
      vertexShader: QUAD_VERT, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      fragmentShader: /* glsl */`
        uniform sampler2D uPrev; uniform float uFade; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(max(texture2D(uPrev, vUv).r * uFade - 0.5 / 255.0, 0.0)); }`
    });
    const fadeQuad = quad(fadeMat); fadeQuad.renderOrder = 0;
    // cada partícula = um segmento da posição ANTERIOR até a NOVA: o rastro fica contínuo mesmo
    // quando o computador desenha poucos quadros por segundo
    const idx = new Float32Array(N * 2 * 3);
    for (let i = 0; i < N; i++) { idx[i * 6] = i; idx[i * 6 + 3] = i; idx[i * 6 + 4] = 1; }
    const segGeo = new THREE.BufferGeometry();
    segGeo.setAttribute('position', new THREE.BufferAttribute(idx, 3));    // x = partícula, y = 0 antes / 1 agora
    const drawMat = new THREE.ShaderMaterial({
      uniforms: { uOld: { value: null }, uNew: { value: null }, uWind: { value: windCur } },
      depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform sampler2D uOld, uNew; varying float vSpd;
        ${WIND_GLSL}
        ${RAND}
        void main(){
          vec2 st = (vec2(mod(position.x, ${S}.0), floor(position.x / ${S}.0)) + 0.5) / ${S}.0;
          vec2 pNew = decodePos(texture2D(uNew, st)), pOld = decodePos(texture2D(uOld, st));
          vec2 d = abs(pNew - pOld);
          bool jump = d.x > 0.02 || d.y > 0.02;                    // renasceu ou cruzou 180°: sem traço
          vec2 pos = (position.y > 0.5 || jump) ? pNew : pOld;
          vSpd = length(windAt(pNew));
          gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying float vSpd;
        void main(){ gl_FragColor = vec4(vec3(0.16 + 0.34 * smoothstep(0.5, 9.0, vSpd)), 1.0); }`
    });
    const segs = new THREE.LineSegments(segGeo, drawMat); segs.frustumCulled = false; segs.renderOrder = 1;
    const trailScene = new THREE.Scene(); trailScene.add(fadeQuad, segs);

    // 3. esfera que mostra o rastro (gira com a Terra)
    const dispMat = new THREE.ShaderMaterial({
      uniforms: { uTrail: { value: trail[0].texture }, uWind: { value: windCur }, uOn: { value: 0 }, uSunDir: { value: SUN } },
      vertexShader: VERT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      fragmentShader: /* glsl */`
        uniform sampler2D uTrail; uniform float uOn; uniform vec3 uSunDir;
        varying vec2 vUv; varying vec3 vN;
        ${WIND_GLSL}
        void main(){
          float t = texture2D(uTrail, vUv).r;
          float spd = length(windAt(vUv));
          vec3 col = mix(vec3(0.28, 0.58, 1.0), vec3(0.88, 1.0, 1.0), smoothstep(1.5, 10.0, spd));
          float side = 0.75 + 0.25 * smoothstep(-0.3, 0.3, dot(normalize(vN), normalize(uSunDir)));  // um pouco mais suave à noite
          gl_FragColor = vec4(col * min(t * 1.6, 1.0) * uOn * side, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.038, 128, 64), dispMat);
    shell.visible = false;
    shell.renderOrder = 2;                                        // depois das nuvens: o vento fica por cima
    earth.add(shell);

    let cur = 0, tcur = 0;
    function step(dt, on) {
      shell.visible = on > 0.01;
      dispMat.uniforms.uOn.value = on;
      if (!shell.visible || dt <= 0) return;                    // desligado ou congelado: GPU livre
      updMat.uniforms.uDt.value = dt;
      updMat.uniforms.uSeed.value = Math.random() * 1000;
      const old = updMat.uniforms.uState.value;                   // posições antes deste passo
      renderer.setRenderTarget(state[1 - cur]); renderer.render(updScene, quadCam);
      updMat.uniforms.uState.value = state[1 - cur].texture; cur = 1 - cur;
      fadeMat.uniforms.uPrev.value = trail[tcur].texture;
      fadeMat.uniforms.uFade.value = Math.pow(0.982, dt * 60);    // rastro some em ~2 s
      drawMat.uniforms.uOld.value = old;
      drawMat.uniforms.uNew.value = state[cur].texture;
      renderer.setRenderTarget(trail[1 - tcur]); renderer.render(trailScene, quadCam);
      tcur = 1 - tcur;
      renderer.setRenderTarget(null);
      dispMat.uniforms.uTrail.value = trail[tcur].texture;
    }
    return { step };
  }
  const wind = makeWindFluid();
  // 🌊 as correntes do mar são desenhadas no próprio shader da Terra (água em movimento)

  // Qual quadro do atlas mostrar para um ano: devolve { idx, ok } (ok=false se não há dado)
  // frames: { hist: [primeiro, último, índice inicial, passo], ssp126: [...], ... }
  function frameOf(meta, year) {
    if (!meta) return { idx: 0, ok: false };
    const pick = r => year >= r[0] && year < r[1] + r[3] ? { idx: r[2] + Math.floor((year - r[0]) / r[3]), ok: true } : null;
    const h = meta.frames.hist, s = meta.frames[EJ.scenario];
    const hit = pick(h) || (s && pick(s));
    if (hit) return hit;
    if (year < h[0]) return { idx: h[2], ok: false };
    const last = s || h;
    return { idx: last[2] + Math.floor((last[1] - last[0]) / last[3]), ok: false };
  }
  // Quadros A e B ao redor do ano "contínuo" (que desliza suavemente) e a mistura entre eles
  function frames(meta, y) {
    const step = meta ? meta.frames.hist[3] : 1;
    const y0 = Math.floor(y / step) * step;
    const a = frameOf(meta, y0), b = frameOf(meta, y0 + step);
    return { F: [a.idx, b.ok ? b.idx : a.idx, b.ok ? (y - y0) / step : 0], ok: a.ok };
  }

  // ---------- estado e alvos (interpolados p/ transições suaves) ----------
  const layers = { lights: true, sea: true, ice: true, heat: false, spin: true,
                   clouds: true, ndvi: false, fire: false, wind: false, ozone: false, ocean: false };
  const T = { heat: 0, lights: 0, sea: 0, iceEdge: 76, atmo: 0.25, year: EJ.YEAR_MIN };
  let yearCur = EJ.YEAR_MIN;                                     // ano que desliza suavemente até T.year
  const on = { ndvi: 0, fire: 0, wind: 0, heat: 0, ozone: 0, ocean: 0 };  // disponibilidade × botão, suavizados
  let curAtmo = 0.25;
  const COLD = new THREE.Color(0x3f7dff), HOT = new THREE.Color(0xff7a3c);

  // (colega) Urbanização/eletrificação: curva logística (meados de 1960 = metade), normalizada
  // para valer 1 em 2020. Continua subindo devagar nas projeções (até ~1,1 em 2100).
  const logistic = y => 1 / (1 + Math.exp(-(y - 1965) / 22));
  const L0 = logistic(1900), L1 = logistic(2020);

  function update(v) {
    T.heat = EJ.level('temp', v.temp);                           // mesma curva do áudio (data.js)
    T.lights = clamp((logistic(v.year) - L0) / (L1 - L0), 0, 1.25);
    T.sea = clamp((v.sea ?? 0) / 800, 0, 1);                     // só a subida pós-1993 inunda
    const A = EJ.orFirst('ice', v.ice) * 1e12;                   // m² (antes de 1979: 1º valor da NASA)
    T.iceEdge = THREE.MathUtils.radToDeg(Math.asin(clamp(1 - A / 2.551e14, -1, 1)));
    T.atmo = EJ.level('co2', v.co2);
    T.year = v.year;
  }
  let active = true;                                             // false no modo "imagem/vídeo"

  const clock = new THREE.Clock();
  function resize() {
    // o zoom do navegador muda o devicePixelRatio: reajusta para a Terra não ficar borrada
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize); resize();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const k = 1 - Math.exp(-dt * 3.5);
    if (!active) return;                                // modo imagem/vídeo: globo pausado
    if (layers.spin) earth.rotation.y += dt * 0.05;   // só gira se a rotação estiver ligada
    U.uHeat.value += (T.heat - U.uHeat.value) * k;
    U.uLights.value += (T.lights - U.uLights.value) * k;
    U.uSea.value += (T.sea - U.uSea.value) * k;
    U.uIceEdge.value += (T.iceEdge - U.uIceEdge.value) * k;
    // camadas com atlas: escolhe os quadros do ano e só acende se houver dado naquele ano
    yearCur += (T.year - yearCur) * Math.min(1, k * 2);
    if (Math.abs(T.year - yearCur) > 30) yearCur = T.year;     // pulo grande no slider: vai direto
    const fT = frames(A.temp.meta, yearCur), fN = frames(A.ndvi.meta, yearCur);
    const fF = frames(A.fire.meta, yearCur), fW = frames(L.wind, yearCur);
    U.uTempF.value.set(...fT.F); U.uNdviF.value.set(...fN.F); U.uFireF.value.set(...fF.F);
    on.heat += ((layers.heat && fT.ok ? 1 : 0) - on.heat) * k;
    on.ndvi += ((layers.ndvi && fN.ok ? 1 : 0) - on.ndvi) * k;
    on.fire += ((layers.fire && fF.ok ? 1 : 0) - on.fire) * k;
    on.wind += ((layers.wind && fW.ok ? 1 : 0) - on.wind) * k;
    const fO = frames(A.ozone.meta, yearCur);
    U.uOzoneF.value.set(...fO.F);
    on.ozone += ((layers.ozone && fO.ok ? 1 : 0) - on.ozone) * k;
    U.uHeatOn.value = on.heat; U.uNdviOn.value = on.ndvi; U.uFireOn.value = on.fire; U.uOzoneOn.value = on.ozone;
    setWind(fW.F);                                              // vento da década atual (nuvens + ventos)
    cloudU.uOn.value += ((layers.clouds ? 1 : 0) - cloudU.uOn.value) * k;
    clouds.visible = cloudU.uOn.value > 0.005;
    if (layers.spin && cloudList.length > 1) {                  // com a Terra parada, as nuvens também param
      const n = cloudList.length, next = (cloudDay + 1) % n;
      loadCloud(next); loadCloud((cloudDay + 2) % n);           // os próximos dias chegam em segundo plano
      if (cloudReady[cloudDay] && cloudReady[next]) {           // só avança quando o próximo dia já carregou
        cloudF += dt / CLOUD_DAY_S;
        if (cloudF >= 1) { cloudF -= 1; cloudDay = next; }
      }
      const b = (cloudDay + 1) % n;
      cloudU.uCloudA.value = cloudTex[cloudDay];
      cloudU.uCloudB.value = cloudReady[b] ? cloudTex[b] : cloudTex[cloudDay];
      cloudU.uMix.value = cloudReady[b] ? cloudF : 0;
    }
    // o vento continua escorrendo com a Terra parada (dá para observar uma região); só congela
    // com a opção "reduzir movimento"
    if (wind) wind.step(document.body.classList.contains('reduce-motion') ? 0 : dt, on.wind);
    on.ocean += ((layers.ocean ? 1 : 0) - on.ocean) * k;          // correntes: campo fixo (clima atual)
    U.uOceanOn.value = on.ocean;
    U.uAxis.value.set(0, 1, 0).applyQuaternion(tilt.quaternion);   // eixo inclinado 23,4°
    U.uTime.value += dt;
    U.uLightsOn.value += ((layers.lights ? 1 : 0) - U.uLightsOn.value) * k;
    U.uSeaOn.value += ((layers.sea ? 1 : 0) - U.uSeaOn.value) * k;
    U.uIceOn.value += ((layers.ice ? 1 : 0) - U.uIceOn.value) * k;
    curAtmo += (T.atmo - curAtmo) * k;
    U.uAtmoColor.value.copy(COLD).lerp(HOT, U.uHeat.value * (layers.heat ? 1 : 0) * 0.9);
    atmoU.uIntensity.value = 0.75 + curAtmo * 1.0;
    // zoom suave: anda uma fração do caminho até a distância desejada a cada quadro
    if (zoomGoal !== null) {
      const d = camera.position.length(), nd = d + (zoomGoal - d) * Math.min(1, dt * 9);
      camera.position.setLength(nd);
      if (Math.abs(nd - zoomGoal) < 1e-4) zoomGoal = null;
    }
    // painel aberto: desloca a "janela" da câmera (a Terra vai para a esquerda e o céu cobre a tela toda)
    if (Math.abs(shiftGoal - shiftCur) > 0.3 || shiftCur !== 0) {
      shiftCur += (shiftGoal - shiftCur) * Math.min(1, dt * 6);
      if (Math.abs(shiftCur) < 0.3 && shiftGoal === 0) { shiftCur = 0; camera.clearViewOffset(); }
      else camera.setViewOffset(innerWidth, innerHeight, shiftCur, 0, innerWidth, innerHeight);
    }
    // centralizar: gira a câmera de volta para a direção inicial
    if (homeDir) {
      const d = camera.position.length();
      const dir = camera.position.clone().normalize().lerp(homeDir, Math.min(1, dt * 5)).normalize();
      camera.position.copy(dir.multiplyScalar(d));
      if (dir.distanceTo(homeDir) < 1e-3) homeDir = null;
    }
    controls.update();
    renderer.render(scene, camera);
  });

  EJ.globe = {
    update, layers,
    toggle(name) { layers[name] = !layers[name]; return layers[name]; },
    // (colega) Renderiza agora e devolve o <canvas>: a visão (vision.js) lê os pixels do globo.
    // A leitura precisa acontecer logo depois, na mesma tarefa.
    frame() { if (!active) return null; renderer.render(scene, camera); return renderer.domElement; },
    setActive(on) { active = on; container.style.visibility = on ? '' : 'hidden'; },
    // 🔍 zoom para botões e teclado (+ − 0)
    setShift(px) { shiftGoal = px; },                           // usado ao abrir/fechar painéis
    zoomIn() { zoomBy(0.78); },
    zoomOut() { zoomBy(1.28); },
    resetView() { zoomGoal = HOME.length(); homeDir = HOME.clone().normalize(); },
    // 0% = o mais longe possível, 100% = o mais perto (a narração fala isso)
    zoomLevel() {
      const d = zoomGoal ?? camera.position.length();
      return Math.round((controls.maxDistance - d) / (controls.maxDistance - controls.minDistance) * 100);
    }
  };
}
