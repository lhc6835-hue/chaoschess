// 화면 전환: 체스판 칸이 대각선으로 "톡톡" 튀어나와 화면을 덮고, 반대로 쏙쏙 빠지며 걷혀요.
// style: "board"(기본) | "battle"(출전: 나이트가 L자로 뛰어 지나감) | "defeat"(진홍색 칸이 무너지듯)
import { sprite } from "../render/sprites.js";
import { sfx } from "../audio.js";

const PAL = {
  board: ["#5f8a86", "#43676a", "#2b2236"],
  battle: ["#5f8a86", "#43676a", "#2b2236"],
  defeat: ["#7d2240", "#4f1a33", "#1c0a14"],
};

let canvas = null, g = null, busy = false, idleWaiters = [];
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function setup() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "transition";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  g = canvas.getContext("2d");
}

function size() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.ceil(innerWidth * dpr);
  canvas.height = Math.ceil(innerHeight * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
}

const outBack = (t) => (t >= 1 ? 1 : 1 + 2.9 * Math.pow(t - 1, 3) + 1.9 * Math.pow(t - 1, 2));
const inBack = (t) => 2.7 * t * t * t - 1.7 * t * t;
const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function grid() {
  const cell = Math.max(44, Math.min(72, Math.round(Math.min(innerWidth, innerHeight) / 9)));
  const cols = Math.ceil(innerWidth / cell) + 1, rows = Math.ceil(innerHeight / cell) + 1;
  const tiles = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      // 결정적인 작은 흔들림: 칸마다 조금씩 늦거나 빨라서 "혼돈"스러운 물결
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      tiles.push({ x, y, jitter: (h - Math.floor(h)) * 0.12 });
    }
  return { cell, cols, rows, tiles };
}

function drawTiles(gr, colors, prog, mode) {
  // prog: 칸별 진행 0..1 → 크기. mode: in(덮기) / out(걷기)
  g.clearRect(0, 0, innerWidth, innerHeight);
  const { cell, cols, rows, tiles } = gr;
  const span = cols + rows;
  for (const t of tiles) {
    const order = mode === "in" ? (t.x + t.y) / span : 1 - (t.x + t.y) / span;
    const local = clamp((prog - order * 0.62 - t.jitter) / 0.3);
    const s = mode === "in" ? outBack(local) : 1 - inBack(local);
    if (s <= 0.001) continue;
    const cx = t.x * cell + cell / 2, cy = t.y * cell + cell / 2;
    // 쫀득하게: 커질 때 세로로 살짝 늘었다가 제자리
    const sq = mode === "in" ? 1 + 0.18 * Math.sin(local * Math.PI) : 1 - 0.12 * Math.sin(local * Math.PI);
    const w = cell * s * sq + 1, h = cell * s / sq + 1;
    g.fillStyle = colors[2];
    g.fillRect(Math.round(cx - w / 2) - 1, Math.round(cy - h / 2) - 1, Math.round(w) + 2, Math.round(h) + 2);
    g.fillStyle = (t.x + t.y) % 2 ? colors[1] : colors[0];
    g.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
  }
}

function anim(dur, fn) {
  return new Promise((done) => {
    const t0 = performance.now();
    const step = (now) => {
      const u = clamp((now - t0) / (dur * 1000));
      fn(u);
      if (u < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}

/** 나이트가 덮인 화면 위를 L자(→→↑)로 두 번 뛰어 지나가요 */
async function knightLeap(gr, colors) {
  const sp = sprite("knight", "ally");
  const Z = Math.max(6, Math.round(gr.cell / 6));
  const w = sp.w * Z, h = sp.h * Z;
  const y0 = innerHeight * 0.62, mid = innerWidth / 2;
  const hops = [
    [-w, y0, mid - gr.cell, y0],
    [mid - gr.cell, y0, mid + gr.cell * 1.4, y0 - gr.cell],
    [mid + gr.cell * 1.4, y0 - gr.cell, innerWidth + w, y0 - gr.cell],
  ];
  for (const [i, [ax, ay, bx, by]] of hops.entries()) {
    if (i > 0) sfx("land", { vol: 0.7, x: ax / innerWidth });
    await anim(i === 1 ? 0.26 : 0.2, (u) => {
      drawTiles(gr, colors, 1, "in");
      const x = ax + (bx - ax) * u, y = ay + (by - ay) * u - Math.sin(u * Math.PI) * gr.cell * 0.9;
      const sq = 1 + 0.22 * Math.sin(u * Math.PI); // 공중에선 쭉 늘어남
      g.fillStyle = "rgba(20, 16, 28, .35)";
      g.beginPath();
      g.ellipse(x, ay + (by - ay) * u + 2, w * 0.32, Z * 1.5, 0, 0, Math.PI * 2);
      g.fill();
      g.drawImage(sp.img, Math.round(x - (w / sq) / 2), Math.round(y - h * sq), Math.round(w / sq), Math.round(h * sq));
    });
  }
}

/** 화면을 덮어요. 다 덮이면 resolve */
export async function cover(style = "board") {
  setup();
  busy = true;
  size();
  canvas.hidden = false;
  canvas.style.opacity = "1";
  const colors = PAL[style] ?? PAL.board;
  if (reduced()) {
    g.fillStyle = colors[2];
    g.fillRect(0, 0, innerWidth, innerHeight);
    return;
  }
  const gr = grid();
  sfx(style === "defeat" ? "death" : "whoosh", { vol: 0.8 });
  await anim(style === "defeat" ? 0.75 : 0.42, (u) => drawTiles(gr, colors, u, "in"));
  canvas._grid = gr;
  canvas._colors = colors;
  if (style === "battle") await knightLeap(gr, colors);
}

/** 덮인 화면을 걷어요 */
export async function reveal() {
  if (!canvas) return;
  if (reduced()) {
    await anim(0.2, (u) => (canvas.style.opacity = String(1 - u)));
  } else {
    const gr = canvas._grid ?? grid();
    const colors = canvas._colors ?? PAL.board;
    await anim(0.42, (u) => drawTiles(gr, colors, u, "out"));
  }
  canvas.hidden = true;
  busy = false;
  idleWaiters.splice(0).forEach((f) => f());
}

export const isBusy = () => busy;
/** 전환이 끝날 때까지 기다려요 (전환 중이 아니면 바로) */
export function idle() {
  return busy ? new Promise((r) => idleWaiters.push(r)) : Promise.resolve();
}
