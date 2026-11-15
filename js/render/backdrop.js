// 모든 화면 뒤에 깔리는 픽셀 배경: 밤하늘, 달, 별, 겹겹의 성과 산, 하늘에 떠다니는 거대한 체스 말 섬, 떠오르는 빛가루.
// 저해상도(가로 320)로 그린 뒤 화면 크기에 맞춰 확대해요. 화면마다 분위기(theme)가 달라요.

const W = 320;
let H = 180;

const THEMES = {
  home: { sky: ["#140d22", "#1f1533", "#2b1d45", "#3b2759", "#4f336b"], moon: "#f6e7c4", glow: "#d9a441", far: "#34244c", mid: "#271b3b", near: "#150e22", mote: "#ffd47a", island: "#4a3666" },
  shop: { sky: ["#170f1c", "#24162a", "#33203a", "#46304a", "#5c3f52"], moon: "#ffe2b0", glow: "#ff9a4a", far: "#2d1d30", mid: "#211524", near: "#160e19", mote: "#ffb36b", island: "#3d2a40" },
  battle: { sky: ["#0c1220", "#121b2e", "#18263d", "#20334d", "#2a405c"], moon: "#dfeaf2", glow: "#7fd1c8", far: "#1e2d44", mid: "#162236", near: "#0b111c", mote: "#9fe6ff", island: "#2c4260" },
  boss: { sky: ["#1a0608", "#2a0a10", "#3d0f17", "#561620", "#702028"], moon: "#ffb38a", glow: "#ff4a3a", far: "#2a0c12", mid: "#1d080d", near: "#120509", mote: "#ff7a4a", island: "#3d121b" },
  codex: { sky: ["#0f1424", "#162038", "#1e2c4a", "#283a5c", "#334a6e"], moon: "#e8f0ff", glow: "#a58cff", far: "#1b2540", mid: "#141b30", near: "#0d1222", mote: "#c9b8ff", island: "#2a3352" },
};

// 하늘에 떠 있는 체스 말 실루엣 (8x? 픽셀) — 섬처럼 아래에 바위가 매달려 있어요
const SHAPES = {
  rook: ["#.##.##.#", "#########", ".#######.", "..#####..", "..#####..", "..#####..", ".#######.", "#########"],
  knight: ["...##....", "..#####..", ".###.###.", "#######..", "...####..", "..#####..", ".#######.", "#########"],
  king: ["....#....", "...###...", "....#....", "..#####..", "...###...", "..#####..", ".#######.", "#########"],
  bishop: ["....#....", "...###...", "..##.##..", "..#####..", "...###...", "..#####..", ".#######.", "#########"],
};

let canvas, g, img, theme = THEMES.home, themeName = "home", t = 0, last = 0, running = true;
let px = 0, py = 0; // 마우스 패럴랙스
let fade = 1, prevTheme = null;

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixc(a, b, k) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`;
}
const rnd = (i, s = 1) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function initBackdrop() {
  canvas = document.createElement("canvas");
  canvas.className = "backdrop";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  g = canvas.getContext("2d");
  resize();
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => {
    px = e.clientX / innerWidth - 0.5;
    py = e.clientY / innerHeight - 0.5;
  });
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(loop);
  });
  requestAnimationFrame(loop);
}

function resize() {
  H = Math.max(140, Math.round((W * innerHeight) / innerWidth));
  canvas.width = W;
  canvas.height = H;
}

export function setBackdrop(name) {
  if (name === themeName || !THEMES[name]) return;
  prevTheme = theme;
  theme = THEMES[name];
  themeName = name;
  fade = 0;
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  t += reduce ? 0 : dt;
  fade = Math.min(1, fade + dt * 1.5);
  draw();
  requestAnimationFrame(loop);
}

function col(key) {
  return prevTheme && fade < 1 ? mixc(prevTheme[key], theme[key], fade) : theme[key];
}

function draw() {
  // 하늘: 계단식 띠 + 띠 경계는 디더링
  const bands = theme.sky.length;
  for (let i = 0; i < bands; i++) {
    const y0 = Math.floor((i * H) / bands), y1 = Math.floor(((i + 1) * H) / bands);
    g.fillStyle = prevTheme && fade < 1 ? mixc(prevTheme.sky[i], theme.sky[i], fade) : theme.sky[i];
    g.fillRect(0, y0, W, y1 - y0);
    if (i > 0) {
      g.fillStyle = prevTheme && fade < 1 ? mixc(prevTheme.sky[i - 1], theme.sky[i - 1], fade) : theme.sky[i - 1];
      for (let x = 0; x < W; x += 2) g.fillRect(x + (y0 % 2), y0, 1, 1);
    }
  }
  // 별
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rnd(i) * W), y = Math.floor(rnd(i, 2) * H * 0.62);
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + rnd(i, 3) * 2) + i);
    if (tw < 0.25) continue;
    g.fillStyle = tw > 0.85 && rnd(i, 4) > 0.7 ? "#ffffff" : "#c9bfd8";
    g.globalAlpha = 0.35 + tw * 0.55;
    g.fillRect(x - Math.round(px * 2), y - Math.round(py * 1), 1, 1);
    if (tw > 0.95 && rnd(i, 5) > 0.8) {
      g.fillRect(x - 1 - Math.round(px * 2), y - Math.round(py), 3, 1);
      g.fillRect(x - Math.round(px * 2), y - 1 - Math.round(py), 1, 3);
    }
  }
  g.globalAlpha = 1;
  // 달 + 후광
  const mx = Math.round(W * 0.78 - px * 4), my = Math.round(H * 0.22 - py * 3), mr = 15;
  for (let r = mr + 14; r > mr; r -= 3) {
    g.globalAlpha = 0.05 + (0.06 * (mr + 14 - r)) / 14;
    disc(mx, my, r, col("glow"));
  }
  g.globalAlpha = 1;
  disc(mx, my, mr, col("moon"));
  g.globalAlpha = 0.18;
  disc(mx - 4, my - 3, 4, "#000000");
  disc(mx + 5, my + 4, 3, "#000000");
  disc(mx + 3, my - 6, 2, "#000000");
  g.globalAlpha = 1;
  // 떠다니는 체스 말 섬 (먼 층)
  const islands = [
    { s: "rook", x: 0.14, y: 0.2, k: 3, sp: 0.6 },
    { s: "knight", x: 0.42, y: 0.12, k: 2, sp: 0.8 },
    { s: "king", x: 0.6, y: 0.34, k: 2, sp: 0.5 },
    { s: "bishop", x: 0.92, y: 0.46, k: 2, sp: 0.7 },
  ];
  for (const [i, isl] of islands.entries()) {
    const bob = Math.sin(t * isl.sp + i * 1.7) * 3;
    const drift = ((t * 1.5 * isl.sp + isl.x * W) % (W + 60)) - 30;
    island(Math.round(drift - px * 6 * isl.k), Math.round(isl.y * H + bob - py * 4), SHAPES[isl.s], isl.k, col("island"), col("glow"), i);
  }
  // 먼 산맥
  ridge(H * 0.62, 26, 0.012, col("far"), 1, 6);
  // 성곽 실루엣 (중간 층)
  castle(H * 0.7, col("mid"), 10);
  // 가까운 언덕
  ridge(H * 0.84, 12, 0.03, col("near"), 3, 14);
  // 떠오르는 빛가루
  for (let i = 0; i < 40; i++) {
    const life = (t * (0.05 + rnd(i, 7) * 0.08) + rnd(i, 8)) % 1;
    const x = (rnd(i, 9) * W + Math.sin(t * 0.8 + i) * 6 - px * 10) % W;
    const y = H - life * H * 0.9;
    g.globalAlpha = Math.sin(life * Math.PI) * 0.8;
    g.fillStyle = col("mote");
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  g.globalAlpha = 1;
  // 안개 띠
  g.globalAlpha = 0.12;
  g.fillStyle = col("glow");
  for (let x = 0; x < W; x++) {
    const y = H * 0.78 + Math.sin(x * 0.05 + t * 0.4) * 3 + Math.sin(x * 0.013 - t * 0.2) * 5;
    g.fillRect(x, Math.round(y), 1, 2);
  }
  g.globalAlpha = 1;
}

function disc(cx, cy, r, c) {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

function ridge(base, amp, freq, c, par, seed) {
  g.fillStyle = c;
  const off = -px * par * 6;
  for (let x = 0; x < W; x++) {
    const u = (x - off) * freq;
    const h = Math.sin(u + seed) * amp * 0.5 + Math.sin(u * 2.3 + seed * 2) * amp * 0.25 + Math.sin(u * 5.1) * amp * 0.1;
    const y = Math.round(base - Math.abs(h));
    g.fillRect(x, y, 1, H - y);
  }
}

function castle(base, c, seed) {
  g.fillStyle = c;
  const off = Math.round(-px * 10);
  let x = -20 + off;
  let i = 0;
  while (x < W + 20) {
    const w = 10 + Math.floor(rnd(i, seed) * 18), h = 8 + Math.floor(rnd(i, seed + 1) * 22);
    const top = Math.round(base - h);
    g.fillRect(x, top, w, H - top);
    // 성가퀴
    for (let k = 0; k < w; k += 3) g.fillRect(x + k, top - 2, 2, 2);
    // 탑
    if (rnd(i, seed + 2) > 0.6) {
      const tw = 5 + Math.floor(rnd(i, seed + 3) * 4), th = 10 + Math.floor(rnd(i, seed + 4) * 14);
      const tx = x + Math.floor(w / 2 - tw / 2);
      g.fillRect(tx, top - th, tw, th);
      for (let k = 0; k <= tw; k++) g.fillRect(tx + k, top - th - Math.ceil((tw / 2 - Math.abs(k - tw / 2)) * 1.2), 1, Math.ceil((tw / 2 - Math.abs(k - tw / 2)) * 1.2));
      // 창문 불빛
      g.fillStyle = col("glow");
      g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2 + i);
      g.fillRect(tx + Math.floor(tw / 2), top - th + 4, 1, 2);
      g.globalAlpha = 1;
      g.fillStyle = c;
    }
    x += w + Math.floor(rnd(i, seed + 5) * 6);
    i++;
  }
}

function island(x, y, rows, k, c, glow, i) {
  g.fillStyle = c;
  const h = rows.length, w = rows[0].length;
  for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) if (rows[r][q] === "#") g.fillRect(x + q * k, y + r * k, k, k);
  // 아래로 매달린 바위
  const bw = w * k;
  for (let r = 0; r < 4 * k; r++) {
    const ww = Math.max(1, Math.round(bw * (1 - r / (4 * k)) * (0.8 + 0.2 * Math.sin(r + i))));
    g.fillRect(x + Math.round((bw - ww) / 2), y + h * k + r, ww, 1);
  }
  // 빛나는 룬
  g.fillStyle = glow;
  g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 2);
  g.fillRect(x + Math.floor(bw / 2), y + h * k + 2, 1, 1);
  g.globalAlpha = 1;
}
