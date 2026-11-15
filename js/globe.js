// Globo 3D (Three.js) — Terra com texturas NASA (Blue Marble, Black Marble,
// relevo e máscara de oceano) e camadas dirigidas pelos dados:
//   🌊 inundação costeira (relevo real, exagero vertical p/ escala global)
//   🧊 gelo marinho do Ártico (borda calculada da extensão NASA GSFC + ruído)
//   🌃 luzes noturnas (acendem com a industrialização, no lado escuro)
//   🌡️ mapa real de anomalia de temperatura (GISTEMP + modelo GISS) + atmosfera que engrossa com CO₂
//   🌿 vegetação (MODIS NDVI)   🔥 queimadas (MODIS)   ☁️ nuvens (VIIRS)   🌬️ ventos (modelo GISS)
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
  controls.minDistance = 1.4; controls.maxDistance = 12;
  controls.rotateSpeed = 0.5;

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
  manager.onError = url => fail('Não consegui carregar <b>' + url + '</b>.<br>Abra pelo <b>run.bat</b> (servidor local), não pelo arquivo direto.');
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
    uRelief: { value: 1 },                                      // ⛰️ intensidade do relevo (0 = liso)
    // camadas com atlas: textura, grade (colunas, linhas, largura e altura do quadro)
    // e F = (quadro A, quadro B, mistura) para transição suave entre anos
    uTempTex: { value: A.temp.tex }, uTempGrid: { value: A.temp.grid }, uTempF: { value: new THREE.Vector3() },
    uNdviTex: { value: A.ndvi.tex }, uNdviGrid: { value: A.ndvi.grid }, uNdviF: { value: new THREE.Vector3() },
    uNdviOn: { value: 0 },
    uFireTex: { value: A.fire.tex }, uFireGrid: { value: A.fire.grid }, uFireF: { value: new THREE.Vector3() },
    uFireOn: { value: 0 },
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
    uniform float uTime, uNdviOn, uFireOn, uOzoneOn;
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

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
      vec3 nr = reliefNormal(vUv, n, vPos, 0.07 * uRelief * land * (1.0 - clamp(flood, 0.0, 1.0)));
      float sun = dot(nr, normalize(uSunDir));
      float dayAmt = clamp(sun * 1.6 + 0.12, 0.0, 1.0);
      vec3 viewDir = normalize(cameraPosition - vPos);
      vec3 h = normalize(normalize(uSunDir) + viewDir);
      float spec = pow(max(dot(n, h), 0.0), 90.0) * water * dayAmt * (1.0 - ice);
      vec3 col = day * (dayAmt * 1.05 + 0.05) + spec * vec3(0.9, 0.95, 1.0) * 0.5;

      // --- 🌃 luzes das cidades no lado escuro (crescem com a industrialização)
      vec3 city = texture2D(uNight, vUv).rgb * vec3(1.0, 0.84, 0.58) * 2.6;
      col += city * uLightsOn * uLights
           * (1.0 - smoothstep(0.0, 0.28, dayAmt))   // só na noite
           * (1.0 - clamp(flood, 0.0, 1.0) * 0.85)   // cidades inundadas apagam
           * (1.0 - ice);

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
    new THREE.SphereGeometry(1, 96, 96),
    new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG })
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

  // ---------- ☁️ nuvens: segunda esfera, um pouco maior, que deriva devagar ----------
  // 16 dias seguidos de nuvens reais: mostra o dia A misturando com o dia B (uMix), em loop
  const cloudTex = L.clouds ? (L.clouds.images || [L.clouds.image]).map(p => loader.load(p)) : [];
  const cloudU = { uCloudA: { value: cloudTex[0] || null }, uCloudB: { value: cloudTex[1] || cloudTex[0] || null },
                   uMix: { value: 0 }, uSunDir: { value: SUN }, uOn: { value: 1 } };
  let cloudT = 0;                                                // "relógio" das nuvens, em dias
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 96, 96),
    new THREE.ShaderMaterial({
      uniforms: cloudU, vertexShader: VERT, transparent: true, depthWrite: false,
      fragmentShader: /* glsl */`
        uniform sampler2D uCloudA, uCloudB; uniform vec3 uSunDir; uniform float uOn, uMix;
        varying vec2 vUv; varying vec3 vN;
        void main(){
          float a = mix(texture2D(uCloudA, vUv).r, texture2D(uCloudB, vUv).r, uMix);  // 0 = céu limpo, 1 = nuvem densa
          float lit = clamp(dot(normalize(vN), normalize(uSunDir)) * 1.6 + 0.12, 0.0, 1.0);
          gl_FragColor = vec4(vec3(lit * 1.02 + 0.03), a * uOn * 0.92);  // de noite fica escura
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );
  tilt.add(clouds);

  // ---------- 🌬️ ventos: partículas que seguem o vento médio da década ----------
  // Cada partícula é um traço curto: cabeça brilhante, cauda apagada, na direção do vento.
  const wind = (() => {
    const m = L.wind, N = 8000;
    if (!m) return null;
    let data = null;                                             // pixels do atlas (RGBA)
    new THREE.ImageLoader(manager).load(m.atlas, img => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      data = g.getImageData(0, 0, img.width, img.height).data;
    });
    const [lo, hi] = m.range, W = m.cols * m.frameW;
    // vento (m/s) no quadro f, na posição lat/lon, com interpolação bilinear
    function sample(f, lat, lon) {
      const col = f % m.cols, row = Math.floor(f / m.cols);
      const x = ((lon + 180) / 360 * m.frameW - 0.5 + m.frameW) % m.frameW;
      const y = clamp((90 - lat) / 180 * m.frameH - 0.5, 0, m.frameH - 1);
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const x1 = (x0 + 1) % m.frameW, y1 = Math.min(y0 + 1, m.frameH - 1);
      const px = (xx, yy, ch) => data[((row * m.frameH + yy) * W + col * m.frameW + xx) * 4 + ch];
      const bil = ch => (px(x0, y0, ch) * (1 - fx) + px(x1, y0, ch) * fx) * (1 - fy)
                      + (px(x0, y1, ch) * (1 - fx) + px(x1, y1, ch) * fx) * fy;
      const dec = b => (b - 1) / 254 * (hi - lo) + lo;
      return [dec(bil(0)), dec(bil(1))];
    }
    const lat = new Float32Array(N), lon = new Float32Array(N), age = new Float32Array(N), life = new Float32Array(N);
    const spawn = i => {
      lat[i] = THREE.MathUtils.radToDeg(Math.asin(Math.random() * 2 - 1));   // uniforme na esfera
      lon[i] = Math.random() * 360 - 180;
      age[i] = 0; life[i] = 2 + Math.random() * 3;
    };
    for (let i = 0; i < N; i++) { spawn(i); age[i] = Math.random() * life[i]; }
    const pos = new Float32Array(N * 6), col = new Float32Array(N * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0,
                                              blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);
    earth.add(lines);                                            // gira junto com a Terra
    const R = 1.016, D2R = Math.PI / 180;
    // mesma conversão lat/lon -> xyz que a SphereGeometry usa para a textura
    function xyz(la, lo, out, o) {
      const phi = (lo + 180) * D2R, th = (90 - la) * D2R;
      out[o] = -Math.cos(phi) * Math.sin(th) * R; out[o + 1] = Math.cos(th) * R; out[o + 2] = Math.sin(phi) * Math.sin(th) * R;
    }
    function step(dt, F, opacity) {
      mat.opacity = opacity;
      if (!data || opacity < 0.01) return;
      const SPEED = 0.9, TAIL = 1.1;                             // graus por segundo por m/s · cauda em segundos
      for (let i = 0; i < N; i++) {
        age[i] += dt;
        const a = sample(F[0], lat[i], lon[i]), b = sample(F[1], lat[i], lon[i]);
        const u = a[0] + (b[0] - a[0]) * F[2], v = a[1] + (b[1] - a[1]) * F[2];
        const cl = Math.max(Math.cos(lat[i] * D2R), 0.05);
        const dLon = u * SPEED / cl, dLat = v * SPEED;
        lat[i] += dLat * dt; lon[i] += dLon * dt;
        if (lon[i] > 180) lon[i] -= 360; if (lon[i] < -180) lon[i] += 360;
        if (age[i] > life[i] || Math.abs(lat[i]) > 85) spawn(i);
        xyz(lat[i], lon[i], pos, i * 6);
        xyz(lat[i] - dLat * TAIL, lon[i] - dLon * TAIL, pos, i * 6 + 3);
        const spd = Math.hypot(u, v), fade = Math.sin(Math.PI * age[i] / life[i]);
        const br = fade * clamp(spd / 5, 0.35, 1) * 1.5;
        col.set([0.75 * br, 0.95 * br, br, 0, 0, 0], i * 6);     // cabeça ciano-clara, cauda apagada
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
    return { step };
  })();

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
                   clouds: true, ndvi: false, fire: false, wind: false, ozone: false, relief: true };
  const T = { heat: 0, lights: 0, sea: 0, iceEdge: 76, atmo: 0.25, year: EJ.YEAR_MIN };
  let yearCur = EJ.YEAR_MIN;                                     // ano que desliza suavemente até T.year
  const on = { ndvi: 0, fire: 0, wind: 0, heat: 0, ozone: 0 };  // disponibilidade × botão, suavizados
  let curAtmo = 0.25;
  const COLD = new THREE.Color(0x3f7dff), HOT = new THREE.Color(0xff7a3c);

  // (colega) Urbanização/eletrificação: curva logística (meados de 1960 = metade), normalizada
  // para valer 1 em 2020. Continua subindo devagar nas projeções (até ~1,1 em 2100).
  const logistic = y => 1 / (1 + Math.exp(-(y - 1965) / 22));
  const L0 = logistic(1900), L1 = logistic(2020);

  function update(v) {
    T.heat = EJ.level('temp', v.temp);                           // mesma curva do áudio (data.js)
    T.lights = clamp((logistic(v.year) - L0) / (L1 - L0), 0, 1.25);
    T.sea = clamp(v.sea / 800, 0, 1);                            // só a subida pós-1993 inunda
    const A = (v.ice == null ? 7.8 : v.ice) * 1e12;              // m²
    T.iceEdge = THREE.MathUtils.radToDeg(Math.asin(clamp(1 - A / 2.551e14, -1, 1)));
    T.atmo = EJ.level('co2', v.co2);
    T.year = v.year;
  }
  let active = true;                                             // false no modo "imagem/vídeo"

  const clock = new THREE.Clock();
  function resize() {
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
    cloudU.uOn.value += ((layers.clouds ? 1 : 0) - cloudU.uOn.value) * k;
    if (layers.spin) {                                          // com a Terra parada, as nuvens também param
      clouds.rotation.y += dt * 0.057;                          // nuvens um pouco mais rápidas que a Terra
      cloudT += dt / 1.5;                                       // 1 dia de nuvens a cada 1,5 s
      if (cloudTex.length > 1) {
        const n = cloudTex.length, i = Math.floor(cloudT) % n, f = cloudT - Math.floor(cloudT);
        cloudU.uCloudA.value = cloudTex[i];
        cloudU.uCloudB.value = cloudTex[(i + 1) % n];
        cloudU.uMix.value = f * f * (3 - 2 * f);                // transição suave (smoothstep)
      }
    }
    if (wind) wind.step(dt, fW.F, on.wind * 0.9);
    U.uTime.value += dt;
    U.uLightsOn.value += ((layers.lights ? 1 : 0) - U.uLightsOn.value) * k;
    U.uSeaOn.value += ((layers.sea ? 1 : 0) - U.uSeaOn.value) * k;
    U.uIceOn.value += ((layers.ice ? 1 : 0) - U.uIceOn.value) * k;
    U.uRelief.value += ((layers.relief ? 1 : 0) - U.uRelief.value) * k;
    curAtmo += (T.atmo - curAtmo) * k;
    U.uAtmoColor.value.copy(COLD).lerp(HOT, U.uHeat.value * (layers.heat ? 1 : 0) * 0.9);
    atmoU.uIntensity.value = 0.75 + curAtmo * 1.0;
    controls.update();
    renderer.render(scene, camera);
  });

  EJ.globe = {
    update, layers,
    toggle(name) { layers[name] = !layers[name]; return layers[name]; },
    // (colega) Renderiza agora e devolve o <canvas>: a visão (vision.js) lê os pixels do globo.
    // A leitura precisa acontecer logo depois, na mesma tarefa.
    frame() { if (!active) return null; renderer.render(scene, camera); return renderer.domElement; },
    setActive(on) { active = on; container.style.visibility = on ? '' : 'hidden'; }
  };
}
