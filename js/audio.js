// 소리: 배경음악(크로스페이드), 징글(음악 잠깐 낮춤), 효과음(변형 랜덤 + 피치 흔들기 + 좌우 패닝).
// 모든 음원은 CC0 (assets/audio/CREDITS.md). 브라우저 정책상 첫 사용자 입력 때 켜져요.

const VARIANTS = {
  click: 2, hover: 1, open: 1, back: 1, error: 1, select: 2, buy: 1, coin: 1, place: 2,
  land: 5, landHeavy: 3, slash: 2, chop: 1, draw: 2, hit: 5, hitHeavy: 3, metal: 3, crush: 3, thunk: 2,
  fire: 1, burn: 2, boom: 1, breath: 1, ice: 2, shatterIce: 1, shadow: 1, shadowHit: 1, zap: 2, laser: 1,
  tick: 1, heal: 1, summon: 1, hellgate: 1, haste: 1, blink: 1, smite: 1, death: 4, promote: 1,
  freeze: 1, turn: 1, whoosh: 2,
};
const JINGLES = ["waveStart", "boss", "victory", "gameOver"];
const BASE = "assets/audio/";
const PREF_KEY = "chaoschess.audio.v1";
const VER = "?v=20261116061657"; // 음원을 바꾸면 올려서 브라우저 캐시를 비워요

let ctx = null, master, musicBus, sfxBus, duckGain;
const buffers = new Map();
const lastPlayed = new Map();
let voices = 0;
let prefs = { music: 0.55, sfx: 0.8, muted: false };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || "{}"));
} catch {
  /* 기본값 사용 */
}

let wantMusic = null; // 아직 켜지기 전에 요청된 곡
let current = null; // { key, el, gain }

function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* 저장 못 해도 계속 */
  }
}

/** 첫 사용자 입력에서 호출: 오디오 컨텍스트를 만들고 효과음을 미리 불러와요 */
export function unlock() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = prefs.muted ? 0 : 1;
  master.connect(ctx.destination);
  duckGain = ctx.createGain();
  duckGain.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = prefs.music;
  musicBus.connect(duckGain);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = prefs.sfx;
  // 작은 컴프레서로 효과음이 겹쳐도 깨지지 않게
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  sfxBus.connect(comp);
  comp.connect(master);
  preload();
  if (wantMusic) music(wantMusic);
}

async function load(path) {
  if (buffers.has(path)) return buffers.get(path);
  const p = fetch(BASE + path + VER)
    .then((r) => r.arrayBuffer())
    .then((a) => new Promise((ok, bad) => ctx.decodeAudioData(a, ok, bad)))
    .catch(() => null);
  buffers.set(path, p);
  return p;
}

function preload() {
  for (const [k, n] of Object.entries(VARIANTS)) for (let i = 0; i < n; i++) load(`sfx/${k}${i}.mp3`);
  for (const j of JINGLES) load(`jingle/${j}.mp3`);
}

/**
 * 효과음. opts: { vol, rate, x (0..1 화면 가로 위치 → 패닝), delay (초), pitchVar }
 */
export function sfx(key, opts = {}) {
  if (!ctx || prefs.muted || !VARIANTS[key]) return;
  const now = performance.now();
  if (now - (lastPlayed.get(key) ?? 0) < (opts.gap ?? 45)) return; // 같은 소리 연타 방지
  lastPlayed.set(key, now);
  if (voices > 22) return;
  const i = Math.floor(Math.random() * VARIANTS[key]);
  load(`sfx/${key}${i}.mp3`).then((buf) => {
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const pv = opts.pitchVar ?? 0.06;
    src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * pv);
    const g = ctx.createGain();
    g.gain.value = opts.vol ?? 1;
    let node = src;
    node.connect(g);
    node = g;
    if (opts.x != null && ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, (opts.x * 2 - 1) * 0.6));
      node.connect(pan);
      node = pan;
    }
    node.connect(sfxBus);
    voices++;
    src.onended = () => voices--;
    src.start(ctx.currentTime + (opts.delay ?? 0));
  });
}

/** 짧은 음악(징글): 그동안 배경음악을 낮춰요 */
export function jingle(key) {
  if (!ctx || prefs.muted) return;
  load(`jingle/${key}.mp3`).then((buf) => {
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.9 * (prefs.music > 0 ? Math.max(0.5, prefs.music / 0.55) : 0.6);
    src.connect(g);
    g.connect(master);
    const t = ctx.currentTime;
    duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setTargetAtTime(0.18, t, 0.08);
    duckGain.gain.setTargetAtTime(1, t + buf.duration - 0.2, 0.5);
    src.start(t);
  });
}

/** 배경음악 전환 (1초 크로스페이드). key: menu | battle | boss | null */
export function music(key) {
  wantMusic = key;
  if (!ctx) return;
  if (current?.key === key) return;
  const t = ctx.currentTime;
  if (current) {
    const old = current;
    old.gain.gain.cancelScheduledValues(t);
    old.gain.gain.setValueAtTime(old.gain.gain.value, t);
    old.gain.gain.linearRampToValueAtTime(0, t + 0.9);
    setTimeout(() => {
      old.el.pause();
      old.el.src = "";
    }, 1000);
    current = null;
  }
  if (!key) return;
  const el = new Audio(BASE + `bgm/${key}.mp3` + VER);
  el.loop = true;
  el.crossOrigin = "anonymous";
  const src = ctx.createMediaElementSource(el);
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(g);
  g.connect(musicBus);
  g.gain.linearRampToValueAtTime(1, t + 1.2);
  el.play().catch(() => {});
  current = { key, el, gain: g };
}

export function getPrefs() {
  return { ...prefs };
}

export function setPrefs(p) {
  Object.assign(prefs, p);
  savePrefs();
  if (!ctx) return;
  const t = ctx.currentTime;
  musicBus.gain.setTargetAtTime(prefs.music, t, 0.05);
  sfxBus.gain.setTargetAtTime(prefs.sfx, t, 0.05);
  master.gain.setTargetAtTime(prefs.muted ? 0 : 1, t, 0.05);
}
