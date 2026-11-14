// Globo 3D (Three.js) — Terra com texturas NASA (Blue Marble, Black Marble,
// relevo e máscara de oceano) e camadas dirigidas pelos dados:
//   🌊 inundação costeira (relevo real, exagero vertical p/ escala global)
//   🧊 gelo marinho do Ártico (borda calculada da extensão NSIDC + ruído)
//   🌃 luzes noturnas (acendem com a industrialização, no lado escuro)
//   🌡️ tinta de calor + atmosfera que engrossa com CO₂
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
    uAtmoColor: { value: new THREE.Color(0x3f7dff) }
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
    uniform float uHeat, uHeatOn, uLights, uLightsOn, uSea, uSeaOn, uIceEdge, uIceOn;
    varying vec2 vUv; varying vec3 vN; varying vec3 vPos;

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

      // --- 🌡️ tinta de calor
      vec3 hot = day * vec3(1.32, 0.80, 0.60) + vec3(0.15, 0.02, 0.0);
      day = mix(day, hot, uHeatOn * uHeat * 0.85);

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

      // --- iluminação (sol fixo; a Terra gira => dia e noite)
      float sun = dot(n, normalize(uSunDir));
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

  // ---------- estado e alvos (interpolados p/ transições suaves) ----------
  const layers = { lights: true, sea: true, ice: true, heat: false, spin: true };
  const T = { heat: 0, lights: 0, sea: 0, iceEdge: 76, atmo: 0.25 };
  let curAtmo = 0.25;
  const COLD = new THREE.Color(0x3f7dff), HOT = new THREE.Color(0xff7a3c);

  function update(v) {
    T.heat = clamp((v.temp + 0.5) / 3, 0, 1);
    T.lights = clamp((v.year - 1900) / 110, 0, 1);
    T.sea = clamp(v.sea / 800, 0, 1);                 // só a subida pós-1993 inunda
    const A = (v.ice == null ? 7.8 : v.ice) * 1e12;   // m²
    T.iceEdge = THREE.MathUtils.radToDeg(Math.asin(clamp(1 - A / 2.551e14, -1, 1)));
    T.atmo = clamp((v.co2 - 280) / 600, 0, 1);
  }

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
    if (layers.spin) earth.rotation.y += dt * 0.05;   // só gira se a rotação estiver ligada
    U.uHeat.value += (T.heat - U.uHeat.value) * k;
    U.uLights.value += (T.lights - U.uLights.value) * k;
    U.uSea.value += (T.sea - U.uSea.value) * k;
    U.uIceEdge.value += (T.iceEdge - U.uIceEdge.value) * k;
    U.uHeatOn.value += ((layers.heat ? 1 : 0) - U.uHeatOn.value) * k;
    U.uLightsOn.value += ((layers.lights ? 1 : 0) - U.uLightsOn.value) * k;
    U.uSeaOn.value += ((layers.sea ? 1 : 0) - U.uSeaOn.value) * k;
    U.uIceOn.value += ((layers.ice ? 1 : 0) - U.uIceOn.value) * k;
    curAtmo += (T.atmo - curAtmo) * k;
    U.uAtmoColor.value.copy(COLD).lerp(HOT, U.uHeat.value * U.uHeatOn.value * 0.9);
    atmoU.uIntensity.value = 0.75 + curAtmo * 1.0;
    controls.update();
    renderer.render(scene, camera);
  });

  EJ.globe = {
    update, layers,
    toggle(name) { layers[name] = !layers[name]; return layers[name]; }
  };
}
