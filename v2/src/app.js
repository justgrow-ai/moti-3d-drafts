import * as THREE from 'three';
import { VERT, FRAG } from './shader.js';
import { BODIES, EYES, MOUTHS, BROWS, PALETTE } from './bodies.js';

const Q = new URLSearchParams(location.search);
const MOBILE = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const SHOT = Q.has('shot'), CAP = Q.has('cap');
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const col = h => new THREE.Color(h);

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: SHOT || CAP, powerPreference: 'high-performance' });
let pr = SHOT ? (+Q.get('pr') || 1) : Math.min(devicePixelRatio, MOBILE ? 1.0 : 1.5), prMax = pr;
renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
document.getElementById('stage').appendChild(renderer.domElement);
const el = renderer.domElement; el.style.touchAction = 'none';
const scene = new THREE.Scene(), cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const U = {
  uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uFov: { value: 30 }, uShape: { value: 0 },
  uCamPos: { value: V3() }, uCamTgt: { value: V3() }, uLight: { value: V3(-.55, .85, .5) },
  uCol: { value: col('#fff') }, uCol2: { value: col('#fff') }, uInk: { value: col('#2b2724') }, uBg0: { value: col('#eee') }, uBg1: { value: col('#ddd') }, uBlush: { value: col('#f29b8f') },
  uSq: { value: V3(1, 1, 1) }, uHop: { value: 0 }, uBodyScale: { value: 1 }, uWob: { value: 0 }, uTilt: { value: V3() },
  uDent: { value: new THREE.Vector4(0, .7, 1, 0) }, uPull: { value: V3() },
  uArm: { value: Array.from({ length: 14 }, () => new THREE.Vector4(0, -5, 0, .01)) }, uArmOn: { value: new THREE.Vector2() }, uArmR: { value: new THREE.Vector4() },
  uFace: { value: V3(0, .6, 1) }, uStyle: { value: new THREE.Vector4() }, uExA: { value: new THREE.Vector4() }, uExB: { value: new THREE.Vector4() },
  uLook: { value: new THREE.Vector2() }, uSpread: { value: .26 },
};
const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U });
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

// ---------- state ----------
const S = { bi: Math.max(0, Math.min(BODIES.length - 1, (+Q.get('b') || 1) - 1)), style: null, color: null };
let B = BODIES[S.bi];
function applyBody(i, keepStyle = false) {
  S.bi = (i + BODIES.length) % BODIES.length; B = BODIES[S.bi];
  if (!keepStyle) S.style = { eye: B.f[0], mouth: B.f[1], brow: B.f[2], cheek: B.f[3] };
  U.uShape.value = S.bi; U.uFace.value.set(...B.face);
  U.uSpread.value = (S.style.eye === 8 ? .3 : .26) * (B.spread || 1);
  const c = S.color || B.col; U.uCol.value.set(c); U.uCol2.value.set(B.col2 || c);
  const dark = new THREE.Color(c).getHSL({}).l < .4; U.uInk.value.set(dark ? '#f4efe7' : '#2b2724');
  U.uBg0.value.set(B.bg[0]); U.uBg1.value.set(B.bg[1]); U.uBlush.value.set(dark ? '#e7a196' : '#f2998c');
  U.uStyle.value.set(S.style.eye, S.style.mouth, S.style.brow, S.style.cheek);
  springs.sq.v -= 2.5; springs.wob.v += 2; resize(); document.dispatchEvent(new CustomEvent('orb-body', { detail: { i: S.bi, B, S } }));
}
const spring = (k, c, x = 0) => ({ x, v: 0, tgt: x, k, c, step(dt) { this.v += (this.k * (this.tgt - this.x) - this.c * this.v) * dt; this.x += this.v * dt; } });
const springs = { sq: spring(100, 6), dent: spring(90, 7), wob: spring(30, 3), hop: spring(160, 10), tx: spring(40, 4), tz: spring(40, 4) };
const pull = { x: V3(), v: V3(), tgt: V3() };
const EX = ['happy', 'surprise', 'squint', 'sleepy', 'dizzy', 'worried'];
const ex = Object.fromEntries(EX.map(k => [k, { w: 0, until: 0 }]));
let forcedEx = null, blink = 0, nextBlink = 3, blinkT = -1, lastTouch = 0;
const look = new THREE.Vector2(), lookT = new THREE.Vector2(); let lookLock = 0;
function setEx(k, dur) { ex[k].until = Math.max(ex[k].until, now() + dur); }

// ---------- arms (grown out of the body via smooth union in the SDF) ----------
const arms = [0, 1].map(side => ({ side: side ? 1 : -1, g: spring(17, 6), tip: { x: V3(), v: V3() }, ctl: { x: V3(), v: V3() }, task: null }));
function attach(a) { const p = B.a[a.side > 0 ? 1 : 0]; return V3(...p); }
function topPt() { return V3(...B.a[2]); }
function outward(a) { const A = attach(a); const c = V3(B.cx || 0, B.box[3], 0); return A.clone().sub(c).setZ(Math.max(0, A.z - c.z) + .15).normalize(); }
const easeOut = x => 1 - (1 - x) ** 3;
function gesture(kind, opt = {}) {
  const t0 = now(); lastTouch = t0;
  const R = arms[1], Lf = arms[0];
  const sideArm = s => s > 0 ? R : Lf;
  if (kind === 'wave') { const a = sideArm(opt.side || 1); a.task = { t0, dur: 2.6, fn: (u, A) => A.clone().add(V3(.36 * a.side + .3 * Math.sin(u * 8) * Math.min(1, u * 1.5), .82 + .05 * Math.sin(u * 16), .42)) }; setEx('happy', 2.4); }
  if (kind === 'cheer') { for (const a of arms) a.task = { t0, dur: 2.1, fn: (u, A) => A.clone().add(V3(.32 * a.side, 1.0 + .08 * Math.sin(u * 11), .12)) }; setEx('happy', 2.2); springs.hop.v += 3; }
  if (kind === 'point') { const a = sideArm(opt.side || 1); const dir = (opt.dir || V3(.55 * a.side, .3, .8)).clone().normalize(); a.task = { t0, dur: 1.9, fn: (u, A) => A.clone().addScaledVector(dir, opt.len || .95).add(V3(0, .03 * Math.sin(u * 6), 0)) }; setEx('surprise', .35); }
  if (kind === 'think') { const a = R; a.task = { t0, dur: 2.9, bend: .55, fn: (u, A) => topPt().add(V3(.2, .14, .22)).add(u > .7 ? V3(.05 * Math.cos(u * 11), .05 * Math.sin(u * 11), 0) : V3()) }; setEx('worried', 2.8); lookT.set(-.6, .7); lookLock = t0 + 2.8; }
  if (kind === 'reach') { const a = sideArm(opt.target.x >= (B.cx || 0) ? 1 : -1); const A = attach(a); const d = opt.target.clone().sub(A); if (d.length() > 1.7) d.setLength(1.7); if (A.y + d.y < .12) d.y = .12 - A.y; const lim = 1.45 - Math.abs(B.cx || 0); if (Math.abs(A.x + d.x) > lim) d.x = Math.sign(A.x + d.x) * lim - A.x;
    a.task = { t0, dur: 1.7, fn: (u) => A.clone().add(d).add(V3(0, .03 * Math.sin(u * 7), 0)) }; setEx('surprise', .4); }
}
function armUpdate(a, dt, T) {
  const A = attach(a); let tgt;
  if (a.task && (a.task.grab || T < a.task.t0 + a.task.dur)) { a.g.tgt = 1; tgt = a.task.grab ? a.task.grab.clone() : a.task.fn(T - a.task.t0, A); }
  else { a.task = null; a.g.tgt = 0; tgt = A.clone().addScaledVector(outward(a), .3); }
  const gPrev = a.g.x; a.g.step(dt); a.g.x = Math.max(0, Math.min(1.08, a.g.x));
  springs.wob.v += Math.abs(a.g.x - gPrev) * 6;
  // tip follows with overshoot, the middle lags behind -> trailing wobble along the arm
  const kT = a.task?.grab ? 120 : 70;
  a.tip.v.addScaledVector(tgt.clone().sub(a.tip.x).multiplyScalar(kT).sub(a.tip.v.clone().multiplyScalar(9)), dt); a.tip.x.addScaledVector(a.tip.v, dt);
  const mid = A.clone().lerp(a.tip.x, .5).addScaledVector(outward(a), a.task?.bend ?? .22).add(V3(0, .08, 0));
  a.ctl.v.addScaledVector(mid.sub(a.ctl.x).multiplyScalar(32).sub(a.ctl.v.clone().multiplyScalar(5)), dt); a.ctl.x.addScaledVector(a.ctl.v, dt);
}
function armUniforms(a, i) {
  const g = Math.min(1, a.g.x), A = attach(a), R = A.clone().lerp(V3(B.cx || 0, B.box[3], 0), .2);
  const e = easeOut(Math.min(1, g * 1.15));
  const T = R.clone().lerp(a.tip.x, e), C = R.clone().lerp(a.ctl.x, e);
  const bud = Math.sqrt(Math.min(1, g * 3));
  const r0 = .25 * bud, r1 = .12 * bud + .025, rt = .135 * (.5 + .5 * e) * bud;
  for (let k = 0; k < 7; k++) { const t = k / 6, u = 1 - t; const P = R.clone().multiplyScalar(u * u).addScaledVector(C, 2 * u * t).addScaledVector(T, t * t);
    U.uArm.value[i * 7 + k].set(P.x, P.y, P.z, k === 6 ? Math.max(.005, rt) : 0); }
  U.uArmR.value.setComponent(i * 2, Math.max(.005, r0)); U.uArmR.value.setComponent(i * 2 + 1, Math.max(.005, r1));
  U.uArmOn.value.setComponent(i, g > .004 ? 1 : 0);
  return { g, T };
}
// ---------- camera & projection ----------
const camPos = V3(), camTgt = V3();
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); U.uRes.value.set(w * pr, h * pr);
  const asp = w / h, port = asp < .8; U.uFov.value = port ? 36 : 30; const tf = Math.tan(THREE.MathUtils.degToRad(U.uFov.value / 2));
  const needH = 3.0, needW = port ? 3.25 : 3.9; const dist = Math.max(needH / (2 * tf), needW / (2 * tf * asp));
  const cy = port ? .62 : .95;
  camTgt.set(B?.cx || 0, cy, 0); camPos.set((B?.cx || 0), cy + dist * .26, dist);
  U.uCamPos.value.copy(camPos); U.uCamTgt.value.copy(camTgt);
}
function rayFrom(cx, cy) {
  const w = innerWidth, h = innerHeight; const px = (2 * cx - w) / h, py = (h - 2 * cy) / h;
  const ww = camTgt.clone().sub(camPos).normalize(), uu = ww.clone().cross(V3(0, 1, 0)).normalize(), vv = uu.clone().cross(ww);
  const tf = Math.tan(THREE.MathUtils.degToRad(U.uFov.value / 2));
  return ww.addScaledVector(uu, px * tf).addScaledVector(vv, py * tf).normalize();
}
function toScreen(P) {
  const ww = camTgt.clone().sub(camPos).normalize(), uu = ww.clone().cross(V3(0, 1, 0)).normalize(), vv = uu.clone().cross(ww);
  const d = P.clone().add(V3(0, springs.hop.x, 0)).sub(camPos); const z = d.dot(ww), tf = Math.tan(THREE.MathUtils.degToRad(U.uFov.value / 2));
  const px = d.dot(uu) / z / tf, py = d.dot(vv) / z / tf; const h = innerHeight; return { x: (px * h + innerWidth) / 2, y: (h - py * h) / 2 };
}
function hitBody(cx, cy) { // ray vs body ellipsoid (box: hx,hy,hz,cy)
  const rd = rayFrom(cx, cy), [hx, hy, hz, by] = B.box, c = V3(B.cx || 0, by + springs.hop.x, 0), s = V3(hx, hy, hz);
  const o = camPos.clone().sub(c).divide(s), d = rd.clone().divide(s);
  const a = d.dot(d), b = 2 * o.dot(d), cc = o.dot(o) - 1, D = b * b - 4 * a * cc; if (D < 0) return null;
  const t = (-b - Math.sqrt(D)) / (2 * a); return camPos.clone().addScaledVector(rd, t).sub(V3(0, springs.hop.x, 0));
}
function planePoint(cx, cy, z = .35) { const rd = rayFrom(cx, cy); const t = (z - camPos.z) / rd.z; return camPos.clone().addScaledVector(rd, t).sub(V3(0, springs.hop.x, 0)); }

// ---------- input ----------
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
const P = { id: null, on: false, grab: null, x0: 0, y0: 0, t0: 0, lastX: 0, lastT: 0, dir: 0, revs: [], drag: false, hold: false, holdBuzz: false, speed: 0, start: V3() };
const taps = []; let motionAsked = false;
function poke(pt, power = 1) { U.uDent.value.set(pt.x, pt.y, pt.z, 0); springs.dent.v += 2.4 * power; springs.sq.v -= 2.2 * power; springs.wob.v += 2.2 * power; }
function pop(power = 1) { springs.sq.v += 3 * power; springs.wob.v += 1.8 * power; setEx('surprise', .4); }
el.addEventListener('contextmenu', e => e.preventDefault());
el.addEventListener('pointerdown', e => {
  if (!motionAsked) { motionAsked = true; const D = window.DeviceMotionEvent; if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(() => { }); }
  el.setPointerCapture(e.pointerId); lastTouch = now(); ex.sleepy.until = 0;
  const w = innerWidth, h = innerHeight; lookT.set((e.clientX / w) * 2 - 1, -(e.clientY / h) * 2 + 1);
  // grab an extended arm tip?
  let grab = null; for (const a of arms) if (a.g.x > .5) { const s = toScreen(a.tip.x); if (Math.hypot(s.x - e.clientX, s.y - e.clientY) < 70) grab = a; }
  const hit = grab ? null : hitBody(e.clientX, e.clientY);
  Object.assign(P, { id: e.pointerId, on: !!hit, grab, x0: e.clientX, y0: e.clientY, t0: now(), lastX: e.clientX, lastT: performance.now(), dir: 0, revs: [], drag: false, hold: false, holdBuzz: false, speed: 0 });
  if (grab) { grab.task = { grab: planePoint(e.clientX, e.clientY, grab.tip.x.z) }; buzz(10); setEx('surprise', .4); }
  else if (hit) { poke(hit, .55); buzz(8); P.start.copy(planePoint(e.clientX, e.clientY)); }
  document.dispatchEvent(new CustomEvent('orb-touch'));
});
el.addEventListener('pointermove', e => {
  const w = innerWidth, h = innerHeight; if (now() > lookLock) lookT.set((e.clientX / w) * 2 - 1, -(e.clientY / h) * 2 + 1);
  if (P.id !== e.pointerId) return; const dx = e.clientX - P.x0, dy = e.clientY - P.y0, nowp = performance.now();
  if (P.grab) { const A = attach(P.grab), p = planePoint(e.clientX, e.clientY, P.grab.tip.x.z), d = p.clone().sub(A); if (d.length() > 2.4) d.setLength(2.4); P.grab.task.grab = A.clone().add(d); return; }
  if (!P.on) return;
  if (!P.drag && Math.hypot(dx, dy) > 12) { P.drag = true; P.hold = false; }
  if (P.drag) {
    const vx = (e.clientX - P.lastX) / Math.max(1, nowp - P.lastT) * 1000; P.speed = P.speed * .8 + Math.abs(vx) * .2;
    const dir = Math.sign(e.clientX - P.lastX);
    if (dir && Math.abs(e.clientX - P.lastX) > 2) { if (P.dir && dir !== P.dir) { P.revs.push(nowp); P.revs = P.revs.filter(t => nowp - t < 1200); springs.wob.v += 1.1; buzz(6);
      if (P.revs.length >= 3) { if (P.speed > 1800) setEx('dizzy', 2.2); else setEx('happy', 1.6); } } P.dir = dir; }
    const rub = P.revs.length >= 2, d = planePoint(e.clientX, e.clientY).sub(P.start);
    if (rub) { d.multiplyScalar(.3); springs.dent.tgt = .2; } if (d.length() > .65) d.setLength(.65); pull.tgt.copy(d);
  }
  P.lastX = e.clientX; P.lastT = nowp;
});
function endP(e) {
  if (P.id !== e.pointerId) return; P.id = null; const dx = e.clientX - P.x0, dy = e.clientY - P.y0, dur = now() - P.t0;
  if (P.grab) { P.grab.task = null; springs.wob.v += 2.5; buzz([10, 30, 10]); setEx('happy', .8); }
  else if (P.on) {
    if (P.drag) { const amt = pull.tgt.length(); pull.tgt.set(0, 0, 0); springs.dent.tgt = 0; springs.sq.v += 1.5 + amt * 3; springs.wob.v += 2; buzz(amt > .3 ? [12, 40, 8] : 10); }
    else if (P.hold) { const k = Math.min(1, (dur - .28) * 1.5); pop(1 + k); setEx('happy', 1); buzz([10, 30, 22]); }
    else { pop(.8); buzz(12); const t = now(); taps.push(t); while (taps.length && t - taps[0] > 2.2) taps.shift();
      if (taps.length >= 6) { setEx('dizzy', 2.4); taps.length = 0; buzz([20, 40, 20, 40, 20]); } else if (taps.length >= 3) setEx('happy', 1.4); }
  } else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dur < 2.5) { applyBody(S.bi + (dx < 0 ? 1 : -1)); buzz(8); }
  else if (Math.hypot(dx, dy) < 14 && dur < .5) { gesture('reach', { target: planePoint(e.clientX, e.clientY, .45) }); lookT.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); lookLock = now() + 1.6; buzz(6); }
  P.hold = false; P.drag = false; P.grab = null;
}
el.addEventListener('pointerup', endP); el.addEventListener('pointercancel', endP);
addEventListener('devicemotion', e => { const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return; const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  if (m > 24) { springs.wob.v += 3; springs.sq.v += (Math.random() - .5) * 4; if (ex.dizzy.until < now()) buzz(20); setEx('dizzy', 2.2); } });
addEventListener('keydown', e => { if (e.key === 'ArrowRight') applyBody(S.bi + 1); if (e.key === 'ArrowLeft') applyBody(S.bi - 1); });

// ---------- loop ----------
const clock = new THREE.Clock(); let simT = 0; const now = () => (CAP ? simT : clock.elapsedTime);
let shotOverride = null, demo = null, ftAvg = 16, lastAdj = 0;
function idle(T) { // per-body personality in the idle motion
  const id = B.p.idle; let hop = 0, tx = 0, tz = 0, ty = 0, br = .018 * Math.sin(T * 1.9);
  if (id === 'sag') br = .03 * Math.sin(T * 1.2);
  if (id === 'bob') hop = .05 * (.5 + .5 * Math.sin(T * 2.4));
  if (id === 'hop') { const u = T % 3.2; hop = u < .45 ? Math.sin(u / .45 * Math.PI) * .18 : 0; }
  if (id === 'rock') tz = .07 * Math.sin(T * 1.6);
  if (id === 'tilt') tz = .06 * Math.sin(T * 2.1);
  if (id === 'jiggle') br = .025 * Math.sin(T * 3.1);
  if (id === 'spin') { tx = .09 * Math.sin(T * 2.2); tz = .09 * Math.cos(T * 2.2); ty = T * .9; }
  if (id === 'sway') tz = .05 * Math.sin(T * 1.3);
  if (id === 'nod') tz = .02 * Math.sin(T * 1.6);
  if (id === 'float') { hop = .06 + .05 * Math.sin(T * 1.3); br = .02 * Math.sin(T * 1.3); }
  if (id === 'weeble') tz = .12 * Math.sin(T * 1.7) * (.6 + .4 * Math.sin(T * .37));
  if (id === 'tail') hop = .03 * Math.sin(T * 3);
  if (id === 'melt') br = -.015 + .012 * Math.sin(T * .8);
  return { hop, tx, tz, ty, br };
}
function frame() {
  const t0 = performance.now();
  const raw = CAP ? 1 / 30 : Math.min(clock.getDelta(), .1), dt = Math.min(raw, 1 / 30); if (CAP) simT += dt;
  const T = shotOverride ? shotOverride.t : now();
  U.uTime.value = T;
  if (demo) demo(T);
  springs.sq.k = B.p.k; springs.sq.c = B.p.c;
  // long press
  if (P.id !== null && P.on && !P.drag && now() - P.t0 > .28) { P.hold = true; if (!P.holdBuzz) { P.holdBuzz = true; buzz(18); } }
  const holdK = P.hold ? Math.min(1, (now() - P.t0 - .28) * 1.5) : (demo && demo.hold ? demo.hold : 0);
  springs.sq.tgt = -holdK * 1.6; if (!P.drag) springs.dent.tgt = holdK * .3 + (springs.dent.tgt > .19 && !P.drag ? 0 : 0);
  for (const k in springs) springs[k].step(dt);
  pull.v.addScaledVector(pull.tgt.clone().sub(pull.x).multiplyScalar(70).sub(pull.v.clone().multiplyScalar(6)), dt); pull.x.addScaledVector(pull.v, dt);
  // arms
  let armG = 0; const pullArm = V3();
  arms.forEach((a, i) => { if (!shotOverride) armUpdate(a, dt, T); const r = armUniforms(a, i); armG += r.g; pullArm.addScaledVector(outward(a).setY(0), -.07 * r.g); });
  // body deformation
  const id = SHOT ? { hop: 0, tx: 0, tz: 0, ty: 0, br: 0 } : idle(T);
  const s = springs.sq.x * .2 + id.br;
  U.uSq.value.set(1 - s * .5, 1 + s, 1 - s * .5); U.uBodyScale.value = 1 - .04 * armG;
  U.uHop.value = Math.max(0, id.hop + springs.hop.x * .0);
  const dz = ex.dizzy.w;
  U.uTilt.value.set(id.tx + dz * .1 * Math.sin(T * 4.3), id.ty * 0 + 0, id.tz + springs.tz.x * .1 + dz * .12 * Math.sin(T * 5.5));
  U.uDent.value.w = SHOT ? 0 : Math.max(-.1, Math.min(.35, springs.dent.x)) * .5;
  U.uPull.value.copy(pull.x).add(pullArm);
  U.uWob.value = SHOT ? 0 : Math.min(.035, B.p.wob * (Math.abs(springs.wob.x) * 1.6 + Math.abs(springs.wob.v) * .25) + dz * .02);
  // expressions
  const tNow = now(); if (!SHOT && tNow - lastTouch > 14) ex.sleepy.until = tNow + .5;
  if (holdK > .05) ex.squint.until = tNow + .1;
  for (const k of EX) { const tg = forcedEx ? (forcedEx[k] || 0) : (ex[k].until > tNow ? 1 : 0); ex[k].w += (tg - ex[k].w) * (1 - Math.exp(-raw * 12)); }
  // blink (skipped for closed-style eyes)
  if (!SHOT && S.style.eye !== 3 && S.style.eye !== 6) { if (tNow > nextBlink && blinkT < 0) blinkT = 0; if (blinkT >= 0) { blinkT += raw; const k = blinkT / .18; blink = Math.sin(Math.min(1, k) * Math.PI); if (k >= 1) { blinkT = -1; blink = 0; nextBlink = tNow + (Math.random() < .2 ? .25 : 2.4 + Math.random() * 3); } } }
  else blink = 0;
  U.uExA.value.set(ex.happy.w, ex.surprise.w, ex.squint.w, ex.sleepy.w); U.uExB.value.set(ex.dizzy.w, ex.worried.w, shotOverride?.blink ?? blink, 0);
  // look: pointer, or the arm tip when an arm is out, or idle wander
  let anyArm = arms.find(a => a.g.x > .3 && a.task);
  if (shotOverride) lookT.copy(shotOverride.look || new THREE.Vector2(.25, .05));
  else if (anyArm && tNow > lookLock) { const s2 = toScreen(anyArm.tip.x); lookT.set((s2.x / innerWidth) * 2 - 1, -(s2.y / innerHeight) * 2 + 1); }
  else if (tNow - lastTouch > 3 && tNow > lookLock) lookT.set(.5 * Math.sin(T * .37) * Math.cos(T * .21), .3 * Math.sin(T * .53 + 1));
  look.lerp(lookT.clone().clampScalar(-1, 1), 1 - Math.exp(-raw * 8)); U.uLook.value.copy(look);
  renderer.render(scene, cam2);
  // adaptive resolution
  const ft = performance.now() - t0; ftAvg = ftAvg * .9 + raw * 1000 * .1;
  if (!SHOT && !CAP && tNow - lastAdj > 1.5) { lastAdj = tNow; if (ftAvg > 26 && pr > .55) { pr = Math.max(.55, pr - .15); renderer.setPixelRatio(pr); resize(); } else if (ftAvg < 15 && pr < prMax) { pr = Math.min(prMax, pr + .1); renderer.setPixelRatio(pr); resize(); } }
  if (!window.__ready && (SHOT || tNow > .4)) window.__ready = true;
  if (!CAP && !SHOT) requestAnimationFrame(frame);
}
addEventListener('resize', resize);
// ---------- API for UI + capture ----------
window.ORB = {
  BODIES, EYES, MOUTHS, BROWS, PALETTE, get S() { return S; }, get B() { return B; },
  setBody: i => applyBody(i), next: d => applyBody(S.bi + d),
  setStyle: (k, v) => { S.style[k] = v; applyBody(S.bi, true); }, setColor: c => { S.color = c; applyBody(S.bi, true); },
  reset: () => { S.color = null; applyBody(S.bi); }, gesture,
};
// shot: set a frozen state and render one frame synchronously
window.__shot = (o = {}) => {
  if (o.b != null) { S.color = o.color || null; applyBody(o.b - 1); }
  if (o.style) { Object.assign(S.style, o.style); applyBody(S.bi, true); }
  forcedEx = o.ex || {}; for (const k of EX) ex[k].w = forcedEx[k] || 0;
  shotOverride = { t: o.t ?? 1.2, look: o.look ? new THREE.Vector2(...o.look) : null, blink: o.blink || 0 };
  springs.sq.x = springs.sq.v = 0; springs.wob.x = springs.wob.v = 0;
  arms.forEach(a => { a.task = null; a.g.x = 0; });
  if (o.arm) { // pose arms directly: [{side, at:[x,y,z] offset from attach | 'top'..., g}]
    for (const c of o.arm) { const a = arms[c.side > 0 ? 1 : 0], A = attach(a); a.g.x = c.g ?? 1;
      a.tip.x.copy(c.abs ? V3(...c.abs) : A.clone().add(V3(...c.at))); a.ctl.x.copy(A.clone().lerp(a.tip.x, .5).addScaledVector(outward(a), c.bend ?? .22).add(V3(0, .08, 0))); } }
  frame();
};
window.__step = (n = 1) => { for (let i = 0; i < n; i++) frame(); };
window.__demo = (fn) => { demo = fn; };
window.__arms = arms; window.__V3 = V3; window.__attach = attach; window.__springs = springs; window.__ex = ex; window.__now = now;
window.__toScreen = toScreen; window.__poke = (x, y, z, pw) => poke(V3(x, y, z), pw); window.__pop = pop; window.__setEx = setEx; window.__pull = pull;
applyBody(S.bi); resize();
if (!SHOT) frame(); else window.__ready = true;
