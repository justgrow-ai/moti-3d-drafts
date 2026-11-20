import * as THREE from 'three';
import { ALL } from './variants.js';

const Q = new URLSearchParams(location.search);
const V = ALL.find(v => v.id === (Q.get('v') || 'A01').toUpperCase()) || ALL[0];
const MOBILE = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const SHOT = Q.has('shot'), DEMO = Q.has('demo'), SHOT_T = parseFloat(Q.get('t') || '1.3');
document.title = `${V.id} · ${V.name}`;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SHOT || DEMO });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = V.exposure ?? 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = bgTexture(V.bg);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(studioEnv(), 0.02).texture;
scene.environmentIntensity = V.envI ?? 0.95;

const hasArms = !!V.arms;
const camera = new THREE.PerspectiveCamera(hasArms ? 31 : 28, innerWidth / innerHeight, 0.1, 50);

const key = new THREE.DirectionalLight('#ffffff', 2.1); key.position.set(1.6, 5.2, 2.8);
key.castShadow = true; key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004;
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
const rim = new THREE.DirectionalLight(V.rim || '#fff', V.rimI ?? 2); rim.position.set(-2.2, 2.4, -4.5);
const rim2 = new THREE.DirectionalLight(V.rim || '#fff', (V.rimI ?? 2) * .55); rim2.position.set(3, .6, -4);
const fill = new THREE.DirectionalLight('#ffffff', .45); fill.position.set(-4, .5, 2.5);
scene.add(key, rim, rim2, fill, new THREE.HemisphereLight('#ffffff', '#8a8a8a', .25));

// ---------- studio environment: gradient dome + soft boxes ----------
function studioEnv() {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(V.envTop || '#d9dcdf') }, mid: { value: new THREE.Color(V.envMid || '#7d8186') }, bot: { value: new THREE.Color(V.envBot || '#2c2e31') } },
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float y=vP.y; vec3 c = y>0. ? mix(mid,top,smoothstep(0.,.8,y)) : mix(mid,bot,smoothstep(0.,.6,-y)); gl_FragColor=vec4(c,1.); }' }));
  env.add(dome);
  const box = (w, h, x, y, z, I, col = '#ffffff') => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  box(7, 5, 5, 8, 6, 5);        // key softbox top-right-front
  box(2, 9, -8, 2, 3, 2.2);     // left strip
  box(10, 3, 0, 4, -9, 3, V.rim || '#ffffff');  // back rim strip
  box(6, 2, -3, -2, 8, .8);     // low front bounce
  return env;
}

// ---------- procedural textures ----------
function bgTexture([a, b]) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const lin = g.createLinearGradient(0, 0, 0, 512); lin.addColorStop(0, a); lin.addColorStop(1, b);
  g.fillStyle = lin; g.fillRect(0, 0, 512, 512);
  const rad = g.createRadialGradient(256, 200, 10, 256, 230, 360);
  rad.addColorStop(0, 'rgba(255,255,255,0.16)'); rad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rad; g.fillRect(0, 0, 512, 512);
  const vig = g.createRadialGradient(256, 256, 200, 256, 256, 420);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.10)');
  g.fillStyle = vig; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noiseNormal(kind) {
  const N = 512, freq = kind === 'fine' ? 96 : 14, oct = kind === 'fine' ? 2 : 3;
  const rnd = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  const h = new Float32Array(N * N);
  for (let o = 0; o < oct; o++) {
    const F = freq * 2 ** o, amp = 0.5 ** o;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * F, fy = y / N * F, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), w = (i) => ((i % F) + F) % F;
      const a = rnd(w(ix), w(iy), o), b = rnd(w(ix + 1), w(iy), o), c = rnd(w(ix), w(iy + 1), o), d = rnd(w(ix + 1), w(iy + 1), o);
      h[y * N + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
    }
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const H = (xx, yy) => h[((yy + N) % N) * N + ((xx + N) % N)];
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.5, dy = (H(x, y + 1) - H(x, y - 1)) * 2.5;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx / l * .5 + .5) * 255; img.data[i + 1] = (-dy / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
}
function speckleMap() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 260; i++) { const r = Math.random() * 1.1 + .35; g.fillStyle = `rgba(60,55,50,${.25 + Math.random() * .4})`; g.beginPath(); g.arc(Math.random() * 1024, 40 + Math.random() * 432, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(.45, 'rgba(0,0,0,0.22)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}

// ---------- shape (shared by GLSL + JS) ----------
const GLSL = /* glsl */`
uniform float uTime, uWob, uWobF, uDentA, uShape; uniform vec3 uDentP, uPull;
float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
vec3 shapeP(vec3 p){
  if(uShape>.5&&uShape<1.5){ p.xz*=1.06+.32*smoothstep(.25,-.75,p.y); p.y=.5*(p.y-.5+sqrt((p.y+.5)*(p.y+.5)+.06))*.97; }
  else if(uShape>1.5&&uShape<2.5){ float t=max(p.y,0.); p.xz*=1.-pow(t,2.4)*.6; p.y*=1.+t*.22; }
  else if(uShape>2.5&&uShape<3.5){ p.y*=.8; p.xz*=1.1+.08*smoothstep(.2,-.6,p.y); p.y=.5*(p.y-.45+sqrt((p.y+.45)*(p.y+.45)+.04)); }
  else if(uShape>3.5&&uShape<4.5){ p.y*=1.1; p.xz*=1.-.1*p.y; }
  else if(uShape>4.5){ p.x*=1.16; p.y*=.92; p.z*=.98; }
  return p; }
vec3 deform(vec3 q){
  vec3 n=normalize(q); vec3 p=shapeP(n);
  float w=vn(n*uWobF+vec3(0.,uTime*.55,uTime*.31))+.5*vn(n*uWobF*2.1-vec3(uTime*.4,0.,0.))-.75;
  p+=n*w*uWob;
  float d=distance(n,normalize(uDentP)); p-=n*uDentA*exp(-d*d*5.0);
  float pl=length(uPull); if(pl>1e-4){ float pd=max(dot(n,uPull/pl),0.); p+=uPull*pow(pd,2.5); }
  return p; }`;
function shapeJS(d) { // unit dir -> surface point (no noise)
  const p = d.clone().normalize(), s = V.shape;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  if (s === 1) { const k = 1.06 + .32 * ss(.25, -.75, p.y); p.x *= k; p.z *= k; p.y = .5 * (p.y - .5 + Math.sqrt((p.y + .5) ** 2 + .06)) * .97; }
  else if (s === 2) { const t = Math.max(p.y, 0); const k = 1 - Math.pow(t, 2.4) * .6; p.x *= k; p.z *= k; p.y *= 1 + t * .22; }
  else if (s === 3) { p.y *= .8; const k = 1.1 + .08 * ss(.2, -.6, p.y); p.x *= k; p.z *= k; p.y = .5 * (p.y - .45 + Math.sqrt((p.y + .45) ** 2 + .04)); }
  else if (s === 4) { p.y *= 1.1; const k = 1 - .1 * p.y; p.x *= k; p.z *= k; }
  else if (s === 5) { p.x *= 1.16; p.y *= .92; p.z *= .98; }
  return p;
}
function surfFrame(dir) {
  const p = shapeJS(dir), e = .01, n0 = dir.clone().normalize();
  const tg = new THREE.Vector3().crossVectors(Math.abs(n0.y) < .99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), n0).normalize();
  const bt = new THREE.Vector3().crossVectors(n0, tg);
  const p1 = shapeJS(n0.clone().addScaledVector(tg, e)), p2 = shapeJS(n0.clone().addScaledVector(bt, e));
  const n = new THREE.Vector3().crossVectors(p1.sub(p), p2.sub(p)).normalize();
  return { p, n };
}

// ---------- materials ----------
const nmap = V.normal ? noiseNormal(V.normal.kind) : null;
const smap = V.speckle ? speckleMap() : null;
const U = { uTime: { value: 0 }, uWob: { value: V.wob }, uWobF: { value: 1.6 }, uDentA: { value: 0 }, uShape: { value: V.shape }, uDentP: { value: new THREE.Vector3(0, 0, 1) }, uPull: { value: new THREE.Vector3() } };
function makeMat(params, deform, extra = {}) {
  const p = { ...params, ...extra };
  if (p.iridescenceThicknessRange) p.iridescenceThicknessRange = [...p.iridescenceThicknessRange];
  const m = new THREE.MeshPhysicalMaterial(p);
  if (nmap) { m.normalMap = nmap; m.normalScale = new THREE.Vector2(V.normal.s, V.normal.s); }
  if (smap) m.map = smap;
  if (deform) m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL)
      .replace('#include <beginnormal_vertex>', `vec3 _p0=deform(position); vec3 _nn=normalize(position);
        vec3 _tg=normalize(cross(abs(_nn.y)<.99?vec3(0.,1.,0.):vec3(1.,0.,0.),_nn)); vec3 _bt=cross(_nn,_tg);
        vec3 _p1=deform(position+_tg*.012); vec3 _p2=deform(position+_bt*.012);
        vec3 objectNormal=normalize(cross(_p1-_p0,_p2-_p0));
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed=_p0;');
  };
  return m;
}
const bodyMat = makeMat(V.mat, true);
const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
depthMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL).replace('#include <begin_vertex>', 'vec3 transformed=deform(position);'); };
const solidish = (V.mat.transmission || 0) > 0;
// lids share the body's own (transmissive) material so they read as the same skin
const lidMat = makeMat(V.mat, false, solidish ? { color: V.lid || V.mat.color, attenuationDistance: (V.mat.attenuationDistance || 1) * .5 } : {});
const armMat = makeMat(V.mat, false);

// ---------- rig ----------
const rig = new THREE.Group(), inner = new THREE.Group(); rig.add(inner); scene.add(rig);
const body = new THREE.Mesh(new THREE.SphereGeometry(1, MOBILE ? 128 : 192, MOBILE ? 96 : 144), bodyMat);
body.customDepthMaterial = depthMat; body.castShadow = true; inner.add(body);
if (V.core) {
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: V.core.color, emissive: V.core.emissive, emissiveIntensity: V.core.ei, roughness: .6 }));
  core.scale.setScalar(V.core.s); core.position.y = -0.05; body.add(core);
}
const bottom = shapeJS(new THREE.Vector3(0, -1, 0)).y, top = shapeJS(new THREE.Vector3(0, 1, 0)).y;
const groundY = -1.25;
const restY = V.float ? groundY - bottom + .38 : groundY - bottom;   // body center height
// pivot squash at bottom for grounded, center for floating
const pivotOff = V.float ? 0 : bottom;
rig.position.y = restY + pivotOff; inner.position.y = -pivotOff;

// ground: soft shadow catcher + contact blob
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: solidish ? .09 : .14 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = groundY; ground.receiveShadow = true; scene.add(ground);
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; blob.position.y = groundY + .002; scene.add(blob);

// ---------- eyes with real lids ----------
const E = V.eye, glow = !!E.glow;
// transparent:true keeps eyes/lids out of the transmission buffer (otherwise they refract as big dark blobs)
const eyeMat = glow ? new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true })
  : new THREE.MeshPhysicalMaterial({ color: '#070708', roughness: .05, clearcoat: 1, clearcoatRoughness: .02, transparent: true });

const eyeGeo = new THREE.SphereGeometry(1, 48, 32);
const lidCache = [];
const lidGeoAt = k => lidCache[k] || (lidCache[k] = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, k / 40 * Math.PI));
const eyes = [-1, 1].map(side => {
  const g = new THREE.Group(), pupil = new THREE.Group(); const ball = new THREE.Mesh(eyeGeo, eyeMat);
  const d = E.w * .5; ball.scale.set(E.w, E.h, d); ball.position.z = -d * .3; pupil.add(ball);
  const mk = () => { const l = new THREE.Mesh(eyeGeo, lidMat); l.scale.set(E.w * 1.13, E.h * 1.1, d * 1.25 + .006); l.position.z = -d * .3; l.visible = false; return l; };
  const lid = mk(), low = mk(); low.rotation.z = Math.PI;
  g.add(pupil, lid, low); inner.add(g);
  if (glow) { const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: haloTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); halo.scale.set(E.w * 6, E.h * 4.2, 1); halo.position.z = .004; halo.renderOrder = 2; pupil.add(halo); }
  return { g, pupil, ball, lid, low, side };
});
function haloTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(200,225,255,0.35)'); r.addColorStop(1, 'rgba(200,225,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function setLidMesh(m, a) { const k = Math.round(Math.min(1, Math.max(0, a)) * 40); m.visible = k > 0; if (k > 0) m.geometry = lidGeoAt(k); }
function setLids(up, low) { eyes.forEach(e => { setLidMesh(e.lid, up); setLidMesh(e.low, Math.min(low, .98 - up)); }); }
const _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
function placeEye(e, lx, ly) {
  const yaw = e.side * E.sep + lx * .24, pitch = E.y + ly * .18;
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const { p, n } = surfFrame(dir);
  // follow the same pull / dent the vertex shader applies, so eyes ride the surface
  const nd = dir.clone().normalize(), pull = U.uPull.value, pl = pull.length();
  if (pl > 1e-4) p.addScaledVector(pull, Math.pow(Math.max(nd.dot(pull) / pl, 0), 2.5));
  const dd = nd.distanceTo(U.uDentP.value.clone().normalize()); p.addScaledVector(nd, -U.uDentA.value * Math.exp(-dd * dd * 5));
  const u = _up.clone().addScaledVector(n, -n.dot(_up)).normalize(), x = new THREE.Vector3().crossVectors(u, n);
  _m.makeBasis(x, u, n); e.g.quaternion.setFromRotationMatrix(_m);
  e.g.position.copy(p).addScaledVector(n, -0.004);
}

// ---------- arms ----------
const arms = (V.arms || []).map(cfg => {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), armMat); mesh.castShadow = true; inner.add(mesh);
  let hand = null;
  if (cfg.hand === 'glow') hand = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  else hand = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), armMat);
  hand.castShadow = true; inner.add(hand);
  const yaw = THREE.MathUtils.degToRad(cfg.yaw) * cfg.side, pit = THREE.MathUtils.degToRad(cfg.pitch);
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit));
  const f = surfFrame(dir);
  return { cfg, mesh, hand, root: f.p.clone().multiplyScalar(.72), sh: f.p.clone().addScaledVector(f.n, -.02), n: f.n, jig: { x: 0, v: 0 } };
});
const RS = 14, TS = 44;
function smooth01(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
function cyc(t, period, on, ramp = .35) { const u = ((t % period) + period) % period; return smooth01(u / ramp) * (1 - smooth01((u - on) / ramp)); }
function pose(m, t, rt, side = 1) {
  const R = { th: (rt ?? -.78) + .04 * Math.sin(1.6 * t), be: rt != null ? .25 : -.6, ph: .16, inn: 0 };
  const mix = (a, b, k) => ({ th: a.th + (b.th - a.th) * k, be: a.be + (b.be - a.be) * k, ph: a.ph + (b.ph - a.ph) * k, inn: a.inn + (b.inn - a.inn) * k });
  switch (m) {
    case 'wave': return mix(R, { th: 1.05, be: .35 + .6 * Math.sin(7 * t), ph: .25, inn: 0 }, cyc(t, 4.6, 3.1));
    case 'bigwave': return mix(R, { th: 1.2, be: .25 + .75 * Math.sin(4.2 * t), ph: .2, inn: 0 }, cyc(t, 5, 3.6));
    case 'hello': return mix(R, { th: 1.3, be: .3, ph: .2, inn: 0 }, cyc(t, 3.2, 1.2));
    case 'hello2': return mix(R, { th: 1.3, be: .3, ph: .2, inn: 0 }, cyc(t + 1.6, 3.2, 1.2));
    case 'flap': return { th: -.05 + .4 * Math.sin(6.5 * t), be: .15, ph: .2, inn: 0 };
    case 'swing': return { th: -1.05, be: .2, ph: .5 * Math.sin(2.3 * t), inn: 0 };
    case 'swing2': return { th: -1.05, be: .2, ph: -.5 * Math.sin(2.3 * t), inn: 0 };
    case 'cheer': return mix(R, { th: .78 + .12 * Math.sin(6 * t), be: .35, ph: .12, inn: 0 }, cyc(t, 3.6, 2.2));
    case 'sway': return { th: -.55 + .25 * Math.sin(2 * t), be: .45 * Math.sin(2 * t + 1), ph: .3, inn: 0 };
    case 'clap': { const k = cyc(t, 3.4, 2.1); return mix(R, { th: .3, be: -.2, ph: 1.0, inn: .98 + .22 * Math.sin(11 * t) }, k); }
    case 'wiggle': return { th: .1 + .22 * Math.sin(4.5 * t + side), be: .55 * Math.sin(6 * t + side * 1.3), ph: .25, inn: 0 };
    case 'tuck': return { th: -1.25, be: 1.15, ph: .55, inn: 0 };
    default: return R;
  }
}
function updateArm(a, t) {
  const c = a.cfg, P = pose(c.motion, t, c.rest, c.side), side = c.side;
  P.th += a.jig.x;
  const o = new THREE.Vector3(side, 0, 0).lerp(a.n, .35).setY(0).normalize(), up = new THREE.Vector3(0, 1, 0), fw = new THREE.Vector3(0, 0, 1);
  const d1 = o.clone().multiplyScalar(Math.cos(P.th) - P.inn).addScaledVector(up, Math.sin(P.th)).addScaledVector(fw, P.ph).normalize();
  const perp = up.clone().addScaledVector(d1, -up.dot(d1)); if (perp.lengthSq() < 1e-4) perp.copy(o); perp.normalize();
  const d2 = d1.clone().multiplyScalar(Math.cos(P.be)).addScaledVector(perp, Math.sin(P.be));
  const p1 = a.sh.clone().addScaledVector(d1, .04), p2 = a.sh.clone().addScaledVector(d1, c.len * .5), p3 = p2.clone().addScaledVector(d2, c.len * .5);
  const curve = new THREE.CatmullRomCurve3([a.root, p1, p2, p3], false, 'centripetal');
  const fr = curve.computeFrenetFrames(TS, false), pos = [], nor = [], idx = [];
  for (let i = 0; i <= TS; i++) {
    const t01 = i / TS, P0 = curve.getPointAt(t01);
    const r = c.r0 + (c.r1 - c.r0) * smooth01(t01) + (1 - smooth01(t01 * 4)) * c.r0 * .35;
    for (let j = 0; j <= RS; j++) {
      const ang = j / RS * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang) * (c.flat || 1);
      const nx = fr.normals[i].clone().multiplyScalar(cs).addScaledVector(fr.binormals[i], sn);
      pos.push(P0.x + nx.x * r, P0.y + nx.y * r, P0.z + nx.z * r);
      const nn = fr.normals[i].clone().multiplyScalar(cs * (c.flat || 1)).addScaledVector(fr.binormals[i], Math.sin(ang)).normalize();
      nor.push(nn.x, nn.y, nn.z);
    }
  }
  for (let i = 0; i < TS; i++) for (let j = 0; j < RS; j++) { const a0 = i * (RS + 1) + j, b0 = a0 + RS + 1; idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1); }
  const g = a.mesh.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  const tip = curve.getPointAt(1), tan = curve.getTangentAt(1);
  const hs = c.hand && c.hand !== 'none' ? c.hs : c.r1 * 1.0;
  a.hand.position.copy(tip).addScaledVector(tan, c.hand === 'ball' || c.hand === 'glow' ? hs * .6 : c.hand === 'mitten' ? hs * .35 : 0);
  if (c.hand === 'mitten') { a.hand.scale.set(hs, hs * .9, hs * .72); a.hand.quaternion.setFromUnitVectors(up, tan); }
  else if (c.flat) { a.hand.scale.set(hs, hs, hs * c.flat); a.hand.quaternion.setFromUnitVectors(up, tan); }
  else a.hand.scale.setScalar(hs);
}

// ---------- springs & input ----------
const spring = (k, c) => ({ x: 0, v: 0, tgt: 0, k, c, step(dt) { this.v += (this.k * (this.tgt - this.x) - this.c * this.v) * dt; this.x += this.v * dt; } });
const squash = spring(140, 7.5), dent = spring(95, 6.5), wobX = spring(30, 3);
const pull = { x: new THREE.Vector3(), v: new THREE.Vector3(), tgt: new THREE.Vector3() };
const look = new THREE.Vector2(), lookT = new THREE.Vector2(); let lastMove = -10, dragging = false, dragStart = new THREE.Vector3();
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function toNDC(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }
function planePt() { ray.setFromCamera(ndc, camera); const p = new THREE.Vector3(); ray.ray.intersectPlane(plane, p); return p; }
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
// expression state: timers in seconds (sim time)
const mood = { happy: 0, dizzy: 0, surprise: 0, squint: 0 };
let armBoost = 0;
function poke(localDir, power = 1) {
  U.uDentP.value.copy(localDir); dent.v += 2.6 * power; squash.v -= 2.4 * power; wobX.v += 2.5 * power;
  arms.forEach(a => a.jig.v += (Math.random() - .3) * 6 * power);
}
function pop(power = 1) { squash.v += 3.2 * power; wobX.v += 2 * power; mood.surprise = .45; arms.forEach(a => a.jig.v += 5 * power); }
const el = renderer.domElement;
el.style.touchAction = 'none';
el.addEventListener('contextmenu', e => e.preventDefault());
const P = { id: null, onBody: false, x0: 0, y0: 0, t0: 0, lastX: 0, lastT: 0, dirX: 0, revs: [], dragging: false, holding: false, holdBuzz: false, speed: 0 };
const taps = [];
let motionAsked = false;
function askMotion() {
  if (motionAsked) return; motionAsked = true;
  const D = window.DeviceMotionEvent; if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(() => { });
}
addEventListener('devicemotion', e => {
  const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
  const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  if (m > 24) { wobX.v += 3; squash.v += (Math.random() - .5) * 4; if (mood.dizzy < 1.2) buzz(20); mood.dizzy = Math.max(mood.dizzy, 2.2); }
});
el.addEventListener('pointerdown', e => {
  askMotion(); el.setPointerCapture(e.pointerId);
  toNDC(e); lookT.set(ndc.x, ndc.y); lastMove = nowT();
  ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(body)[0];
  Object.assign(P, { id: e.pointerId, onBody: !!hit, x0: e.clientX, y0: e.clientY, t0: nowT(), lastX: e.clientX, lastT: performance.now(), dirX: 0, revs: [], dragging: false, holding: false, holdBuzz: false, speed: 0 });
  if (hit) { poke(body.worldToLocal(hit.point.clone()).normalize(), .55); buzz(8); dragStart.copy(planePt()); }
  document.dispatchEvent(new CustomEvent('orb-touch'));
});
el.addEventListener('pointermove', e => {
  toNDC(e); lookT.set(ndc.x, ndc.y); lastMove = nowT();
  if (P.id !== e.pointerId) return;
  const dx = e.clientX - P.x0, dy = e.clientY - P.y0, now = performance.now();
  if (P.onBody) {
    if (!P.dragging && Math.hypot(dx, dy) > 12) { P.dragging = true; P.holding = false; }
    if (P.dragging) {
      const vx = (e.clientX - P.lastX) / Math.max(1, now - P.lastT) * 1000; P.speed = P.speed * .8 + Math.abs(vx) * .2;
      const dir = Math.sign(e.clientX - P.lastX);
      if (dir && Math.abs(e.clientX - P.lastX) > 2) {
        if (P.dirX && dir !== P.dirX) { P.revs.push(now); P.revs = P.revs.filter(t => now - t < 1200); wobX.v += 1.2; buzz(6);
          if (P.revs.length >= 3) { if (P.speed > 1800) { mood.dizzy = Math.max(mood.dizzy, 2.2); } else { mood.happy = Math.max(mood.happy, 1.8); } } }
        P.dirX = dir;
      }
      const rubbing = P.revs.length >= 2;
      const p = planePt(), d = inner.worldToLocal(p.clone()).sub(inner.worldToLocal(dragStart.clone()));
      if (rubbing) { d.multiplyScalar(.35); const hitDir = new THREE.Vector3(ndc.x * 1.4, ndc.y, 1).normalize(); U.uDentP.value.lerp(hitDir, .3); dent.tgt = .25; }
      if (d.length() > .6) d.setLength(.6); pull.tgt.copy(d);
    }
  }
  P.lastX = e.clientX; P.lastT = now;
});
function endPointer(e) {
  if (P.id !== e.pointerId) return; P.id = null;
  const dx = e.clientX - P.x0, dy = e.clientY - P.y0, dur = nowT() - P.t0;
  if (P.onBody) {
    if (P.dragging) { const amt = pull.tgt.length(); pull.tgt.set(0, 0, 0); dent.tgt = 0; squash.v += 1.5 + amt * 3; wobX.v += 2; buzz(amt > .3 ? [12, 40, 8] : 10); }
    else if (P.holding) { const k = Math.min(1, (dur - .28) * 1.6); pop(1 + k * .8); buzz([10, 30, 22]); }
    else { // tap
      pop(.8); buzz(12);
      const now = nowT(); taps.push(now); while (taps.length && now - taps[0] > 2.2) taps.shift();
      if (taps.length >= 6) { mood.dizzy = 2.4; taps.length = 0; buzz([20, 40, 20, 40, 20]); }
      else if (taps.length >= 3) mood.happy = Math.max(mood.happy, 1.6);
    }
  } else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dur < 1.5) {
    document.dispatchEvent(new CustomEvent('orb-swipe', { detail: dx < 0 ? 1 : -1 }));
  }
  P.holding = false; P.dragging = false;
}
el.addEventListener('pointerup', endPointer); el.addEventListener('pointercancel', endPointer);

// ---------- loop ----------
const clock = new THREE.Clock(); const CAP = Q.has('cap'); let simT = 0; const nowT = () => CAP ? simT : clock.elapsedTime; let releaseAt = -1;
let nextBlink = 3.5, blinkT = -1, demoNext = 1.2, demoPhase = 0;
// scripted demo for video: tap, long-press, drag, rub, rapid taps
const DEMO_SEQ = ['tap', 'hold', 'drag', 'rub', 'tap', 'taps'];
let demoAct = null;
function frame() {
  const raw = CAP ? 1 / 30 : Math.min(clock.getDelta(), .12), dt = Math.min(raw, 1 / 30); if (CAP) simT += dt;
  const T = nowT(), t = SHOT ? SHOT_T : T;
  U.uTime.value = t;
  if (DEMO && !demoAct && T > demoNext) { demoAct = { k: DEMO_SEQ[demoPhase++ % DEMO_SEQ.length], t0: T, n: 0 }; }
  if (demoAct) {
    const a = demoAct, u = T - a.t0, front = new THREE.Vector3(.15, .1, 1).normalize();
    if (a.k === 'tap') { if (a.n === 0) { poke(front, .55); a.n = 1; } if (u > .12) { pop(.8); demoAct = null; } }
    else if (a.k === 'hold') { if (a.n === 0) { poke(front, .55); a.n = 1; } P.holding = true; P.t0 = a.t0; if (u > 1.3) { P.holding = false; pop(1.8); demoAct = null; } }
    else if (a.k === 'drag') { pull.tgt.set(.55 * Math.min(1, u * 2), .25 * Math.min(1, u * 2), .2); lookT.set(.6, .2); lastMove = T; if (u > .9) { pull.tgt.set(0, 0, 0); squash.v += 2.8; wobX.v += 2; demoAct = null; } }
    else if (a.k === 'rub') { pull.tgt.set(.16 * Math.sin(u * 14), 0, 0); U.uDentP.value.set(Math.sin(u * 14) * .4, .4, 1).normalize(); dent.tgt = .25; mood.happy = Math.max(mood.happy, 1.4); lookT.set(Math.sin(u * 14) * .3, .3); lastMove = T; if (u > 1.4) { pull.tgt.set(0, 0, 0); dent.tgt = 0; demoAct = null; } }
    else if (a.k === 'taps') { if (u > a.n * .16 && a.n < 7) { poke(new THREE.Vector3((Math.random() - .5), (Math.random() - .3) * .6, 1).normalize(), .6); pop(.5); a.n++; } if (a.n >= 7) { mood.dizzy = 2.4; demoAct = null; } }
    if (!demoAct) demoNext = T + 1.1;
  }
  if (releaseAt > 0 && T > releaseAt) { releaseAt = -1; pull.tgt.set(0, 0, 0); squash.v += 1.2; wobX.v += 1.5; }
  // long press: flatten progressively
  if (P.id !== null && P.onBody && !P.dragging && T - P.t0 > .28) { P.holding = true; if (!P.holdBuzz) { P.holdBuzz = true; buzz(18); } }
  const holdK = P.holding ? Math.min(1, (T - P.t0 - .28) * 1.6) : 0;
  squash.tgt = -holdK * 1.25; if (!P.dragging && !demoAct) dent.tgt = holdK * .35;
  [squash, dent, wobX].forEach(s => s.step(dt));
  pull.v.addScaledVector(pull.tgt.clone().sub(pull.x).multiplyScalar(75).sub(pull.v.clone().multiplyScalar(6)), dt); pull.x.addScaledVector(pull.v, dt);
  for (const k in mood) mood[k] = Math.max(0, mood[k] - raw);
  const dz = smooth01(mood.dizzy / .6), hp = smooth01(mood.happy / .5), sp = smooth01(mood.surprise / .3);
  U.uDentA.value = SHOT ? 0 : THREE.MathUtils.clamp(dent.x, -.25, .4) * .55;
  U.uPull.value.copy(SHOT ? new THREE.Vector3() : pull.x);
  U.uWob.value = V.wob * (1 + Math.min(1.6, Math.abs(wobX.x) * 2.5 + Math.abs(wobX.v) * .3) + dz * .8);
  const breath = .018 * Math.sin(t * 1.9) + hp * .03 * Math.sin(t * 16), s = (SHOT ? 0 : squash.x) * .22 + breath;
  rig.scale.set(1 - s * .55, 1 + s, 1 - s * .55);
  const bob = V.float ? .06 * Math.sin(t * 1.25) : 0;
  rig.position.y = restY + pivotOff + bob;
  rig.rotation.z = dz * .12 * Math.sin(t * 5.5);
  blob.scale.setScalar((V.float ? 1.7 - bob * 2 : 2.1) * (1 - s * .4)); blob.material.opacity = V.float ? .55 - bob * 1.5 : .8;
  // look
  if (SHOT) lookT.set(.28, .08);
  else if (T - lastMove > 2.5) lookT.set(.45 * Math.sin(t * .37) * Math.cos(t * .21), .22 * Math.sin(t * .53 + 1));
  look.lerp(lookT, 1 - Math.exp(-dt * 9));
  inner.rotation.y = look.x * .32; inner.rotation.x = -look.y * .16;
  // lids: blink + expressions (happy = lower lids rise ^^, squeeze = squint, surprise = wide)
  let up = E.lidRest || 0;
  if (!SHOT) {
    if (T > nextBlink && blinkT < 0 && !hp && Q.get('blink') !== '0') blinkT = 0;
    if (blinkT >= 0) { blinkT += raw; const k = blinkT / .2; up = up + (1 - up) * Math.sin(Math.min(1, k) * Math.PI); if (k >= 1) { blinkT = -1; nextBlink = T + (Math.random() < .2 ? .25 : 2.2 + Math.random() * 3); } }
  }
  up = Math.max(up * (1 - sp), holdK * .62);
  const low = Math.max(hp * .58, holdK * .3);
  setLids(Q.has('lid') ? +Q.get('lid') : up, Q.has('low') ? +Q.get('low') : low);
  const es = 1 + sp * .22 - holdK * .06;
  eyes.forEach(e => {
    const ox = dz ? Math.cos(t * 9 * e.side) * .35 * dz : 0, oy = dz ? Math.sin(t * 9 * e.side) * .35 * dz : 0;
    placeEye(e, look.x * (1 - dz) + ox, look.y * (1 - dz) + oy);
    e.pupil.scale.setScalar(es);
  });
  armBoost = hp;
  arms.forEach(a => { a.jig.v += (-140 * a.jig.x - 7 * a.jig.v) * dt + (hp ? Math.sin(t * 14 + a.cfg.side) * 30 * hp * dt : 0) + (holdK ? -holdK * 20 * dt : 0); a.jig.x += a.jig.v * dt; updateArm(a, t); });
  renderer.render(scene, camera);
  if (!window.__ready && T > (SHOT ? .2 : .5)) window.__ready = true;
  if (!CAP) requestAnimationFrame(frame);
}
window.__step = (n = 1) => { for (let i = 0; i < n; i++) frame(); };
window.__mood = mood;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h;
  const cy = restY + (V.float ? 0 : (top + bottom) / 2) + (hasArms ? .12 : 0);
  const tn = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), needH = hasArms ? 3.6 : 2.8, needW = hasArms ? 3.9 : 2.9;
  const dist = Math.max(needH / tn, needW / (tn * camera.aspect));
  camera.position.set(0, cy + 1.05, dist); camera.lookAt(0, cy - .05, 0); camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize(); frame();
window.__V = V;
