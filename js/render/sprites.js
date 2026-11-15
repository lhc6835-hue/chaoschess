// 기물 픽셀 스프라이트. 문자 지도 → 팀 색으로 칠한 캔버스 (일반 / 흰 번쩍임 / 외곽선) 캐시.
// 문자: . 투명  o 외곽선  1 2 3 팀색(밝음→어두움)  a b c 장식색(밝음→어두움)  k 짙은 그림자  e 빛나는 눈  w 흰색

export const TEAM_PAL = {
  ally: { o: "#2b1d2a", 1: "#fff3d1", 2: "#e2bf86", 3: "#a97b50", e: "#5ad1ff" },
  enemy: { o: "#1c0a14", 1: "#ffa496", 2: "#d04a52", 3: "#7d2240", e: "#ffe45c" },
  summon: { o: "#1d0d33", 1: "#efc6ff", 2: "#b072f0", 3: "#6a35b0", e: "#7dffcf" },
};

const ACC = {
  gold: ["#fff1a0", "#f5c441", "#b87a1e"],
  fire: ["#fff2a8", "#ff9a3c", "#d2412c"],
  ice: ["#e9fbff", "#8fdcff", "#3b8fd1"],
  holy: ["#fffbe0", "#ffe07a", "#d9a13b"],
  shadow: ["#e3b6ff", "#9d5ce6", "#4f2a8a"],
  storm: ["#f4ffff", "#8ff0ff", "#2f9fd6"],
  wood: ["#e8b67a", "#9b6334", "#5c3a1f"],
  steel: ["#f2f6ff", "#b9c4d6", "#6d7a92"],
  blood: ["#ffb3a3", "#e0434b", "#7a1830"],
  time: ["#e8fff5", "#7af2c8", "#2f9c86"],
  bone: ["#fffdf2", "#e6dcc3", "#a89b80"],
};

const BASE = [
  "...o12222223o...",
  "..o1222222223o..",
  ".o112222222233o.",
  ".oooooooooooooo.",
];
const ROBE = [
  "....o122223o....",
  "...o11222233o...",
  "..o1112222233o..",
];
const HOOD = [
  "......oooo......",
  ".....o1112o.....",
  "....o111122o....",
  "....o1kkkk2o....",
  "....o1keek2o....",
  ".....o1223o.....",
];
const BRIM_FACE = [
  "..oooooooooooo..",
  "....okeekeeko...",
  ".....o12223o....",
];

const S = {
  pawn: { acc: "gold", rows: [
    "......oooo......",
    ".....o1112o.....",
    "....o111223o....",
    "....o112223o....",
    "....o122233o....",
    ".....o2233o.....",
    "......o23o......",
    "....o122223o....",
    "...o11222233o...",
  ] },
  knight: { acc: "gold", rows: [
    ".......o.o......",
    "......o1o2o.....",
    ".....o111122o...",
    "....o11k111223o.",
    "....o111112222o.",
    ".....o1112oooo..",
    ".....o1122o.....",
    "....o111223o....",
    "....o112223o....",
    "...o11222233o...",
  ] },
  bishop: { acc: "gold", rows: [
    ".......oo.......",
    "......o11o......",
    ".......oo.......",
    "......o112o.....",
    ".....o111k3o....",
    "....o111k223o...",
    "....o11k2223o...",
    "....o112k233o...",
    ".....o12233o....",
    "......o223o.....",
    "....o122223o....",
    "...o11222233o...",
  ] },
  rook: { acc: "gold", rows: [
    "..ooo.oooo.ooo..",
    "..o1o.o12o.o3o..",
    "..o11oo122oo3o..",
    "..o1111122223o..",
    "...o11122223o...",
    "....o112223o....",
    "....o11kk23o....",
    "....o112223o....",
    "...o11222233o...",
    "..o1112222233o..",
  ] },
  queen: { acc: "gold", rows: [
    "..o....oo....o..",
    ".oao..o11o..oao.",
    "..o1oo1122oo2o..",
    "..o1a111222a3o..",
    "...o11122223o...",
    "....oooooooo....",
    "....o112223o....",
    ".....o1223o.....",
    ".....o1223o.....",
    "....o112223o....",
    "...o11222233o...",
    "..o1112222233o..",
  ] },
  king: { acc: "gold", rows: [
    ".......oo.......",
    "......oaao......",
    ".....ooaaoo.....",
    ".....oaaaao.....",
    ".....ooabooo....",
    "......oabo......",
    "...oooooooooo...",
    "...o1a11122a3o..",
    "....o112223o....",
    "....o112223o....",
    ".....o1223o.....",
    "....o112223o....",
    "...o11222233o...",
    "..o1112222233o..",
  ] },
  spearman: { acc: "wood", rows: [
    ".............o..",
    "............owo.",
    "............owo.",
    ".....oooo...oco.",
    "....o1112o..obo.",
    "...o111122o.obo.",
    "...okeeeeko.obo.",
    "...o112223o.obo.",
    "....o1223o.oaoo.",
    "...o112223oobo..",
    "...o11222233bo..",
    "..o1112222233o..",
  ] },
  archer: { acc: "wood", rows: [
    "......oooo..oo..",
    ".....o1112ooaco.",
    "....o111122o.oco",
    "....o1kkkk2o.obo",
    "....o1keek2o.wbo",
    ".....o1223o..wbo",
    "....o112223o.wbo",
    "...o11222233owbo",
    "...o11222233oco.",
    "..o1112222233oo.",
  ] },
  shield: { acc: "steel", rows: [
    ".....oooooo.....",
    "....o111122o....",
    "....o1keek2o....",
    "....o111222o....",
    "..oooooooooooo..",
    "..oabbbbbbbbco..",
    "..oabbbaabbbco..",
    "..oabbaaaabbco..",
    "..oabbbaabbbco..",
    "...oabbbbbbco...",
    "....oabbbbco....",
    ".....oabbco.....",
    "......oooo......",
  ] },
  pyro: { acc: "fire", mage: true, rows: [
    ".......oao......",
    "......oabao.....",
    ".......oco......",
    "......o12o......",
    "......o122o.....",
    ".....o11223o....",
    "....o1112223o...",
  ] },
  frost: { acc: "ice", mage: true, rows: [
    ".......oo.......",
    "......oaao......",
    ".....oabbco.....",
    "......obco......",
    "......o122o.....",
    ".....o11223o....",
    "....o1112223o...",
  ] },
  storm: { acc: "storm", mage: true, rows: [
    "........oo......",
    ".......oao......",
    "......oao.......",
    "......oaaao.....",
    "........oao.....",
    ".....o11ao3o....",
    "....o1112223o...",
  ] },
  priest: { acc: "holy", hood: true, top: [
    ".....oooooo.....",
    "....oa....ao....",
    ".....oooooo.....",
  ], rows: [
    "....o1a1a23o....",
    "....o11aa23o....",
  ] },
  assassin: { acc: "steel", hood: true, top: [], rows: [
    "....o112223oao..",
    "...o11222233ao..",
    "...o1122223oco..",
  ] },
  necro: { acc: "shadow", hood: true, top: [
    "..oo............",
    ".owwo...........",
    ".okwko..........",
    "..oco...........",
  ], rows: [
    "..obo122223o....",
    "..ob11222233o...",
    "..obo1222223o...",
  ], hoodShift: 1 },
  berserker: { acc: "blood", rows: [
    "..oo........oo..",
    ".oao........oao.",
    ".oabo.oooo.obao.",
    "..oaoo1112ooao..",
    "...oo111122oo...",
    "....okeeeek.o...",
    "....o112223o....",
    "...o11222233o...",
    "..oo1122223oowo.",
    "..o1112222233oco",
  ] },
  dragon: { acc: "fire", wide: true, rows: [
    "o..............o",
    "oo....oooo....oo",
    "o3o..o1112o..o3o",
    "o23oo11e11eoo32o",
    "o223o111122o322o",
    ".o22o112ooooo22o",
    ".o222o11abao222o",
    "..o22o112ooo22o.",
    "...ooo11223ooo..",
    "....o112223o....",
    "...o11222233o...",
    "..o1112222233o..",
  ] },
  chrono: { acc: "time", rows: [
    "....oooooooo....",
    "....o1111223o...",
    ".....oaaaao.....",
    "......oaao......",
    ".......oo.......",
    "......obbo......",
    ".....obbbbo.....",
    "....o1111223o...",
    "....oooooooo....",
    "....okeekeeko...",
    "....o112223o....",
    "...o11222233o...",
    "..o1112222233o..",
  ] },
  paladin: { acc: "holy", rows: [
    ".oo..........oo.",
    ".oao.oooooo.oao.",
    "..oaoo11112oao..",
    "...ooo111122oo..",
    "....o1aaaaa2o...",
    "....okeeeeeko...",
    "....o1112223o...",
    "..oooo12223oooo.",
    "..obboo1223obbo.",
    "...oo112223oaoo.",
    "...o11222233ao..",
    "..o1112222233o..",
  ] },
  skeleton: { acc: "bone", rows: [
    ".....oooooo.....",
    "....o111112o....",
    "....o1ee1ee2o...",
    "....o111122o....",
    ".....o1o1o2o....",
    "......oooo......",
    ".....o1o1o3o....",
    "....o1o2o2o3o...",
    ".....o2o2o3o....",
    "...o11222233o...",
  ] },
  imp: { acc: "blood", rows: [
    "....o......o....",
    "...oao....oao...",
    "o...oooooooo...o",
    "ooo.o111122o.ooo",
    "o3ooo1ee1e2ooo3o",
    ".o33o111122o33o.",
    "..ooo112223ooo..",
    "....o112223o....",
    "...o11222233o...",
  ] },
  demon: { acc: "blood", rows: [
    "oo..............oo",
    "oao............oao",
    ".oao..oooooo..oao.",
    ".oabooo11112oobao.",
    "..oaao1111122oao..",
    "...oo111111222o...",
    "...o11ee111ee23o..",
    "...o1111111222o...",
    "...o11o11o12o23o..",
    "....o11ooooo23o...",
    "..ooo11122222ooo..",
    ".o33o1112222o333o.",
    ".o333o11222o3333o.",
    "..oo3o1122223o3oo.",
    "....o111222223o...",
    "...o11122222233o..",
    "..o111222222223o..",
  ], noBase: false },
};

function buildRows(key) {
  const d = S[key];
  let rows = [];
  if (d.hood) {
    const shift = d.hoodShift ?? 0;
    const pad = (r) => (shift ? ".".repeat(shift) + r.slice(0, r.length - shift) : r);
    rows = [...(d.top ?? []), ...HOOD.map(pad), ...d.rows];
    // 망토 아래쪽이 없으면 붙여 줘요
    if (d.rows.length < 3) rows.push(...ROBE.slice(d.rows.length));
  } else if (d.mage) {
    rows = [...d.rows, ...BRIM_FACE, ...ROBE.slice(1)];
  } else rows = [...d.rows];
  rows.push(...BASE.map((r) => (key === "demon" ? "." + r + "." : r)));
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, "."));
}

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paint(rows, pal, mode) {
  const w = rows[0].length, h = rows.length;
  const c = document.createElement("canvas");
  c.width = w + 2;
  c.height = h + 2;
  const g = c.getContext("2d");
  const img = g.createImageData(w + 2, h + 2);
  const put = (x, y, rgb, a = 255) => {
    const i = ((y + 1) * (w + 2) + (x + 1)) * 4;
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = a;
  };
  const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== ".";
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === ".") continue;
      if (mode === "white") put(x, y, [255, 255, 255]);
      else if (mode === "outline") continue;
      else put(x, y, hexToRgb(pal[ch] ?? "#ff00ff"));
    }
  if (mode === "outline") {
    // 실루엣 바깥 1px 테두리
    for (let y = -1; y <= h; y++)
      for (let x = -1; x <= w; x++) {
        if (solid(x, y)) continue;
        if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) put(x, y, [255, 255, 255]);
      }
  }
  g.putImageData(img, 0, 0);
  return c;
}

const cache = new Map();

/** { img, white, outline, w, h } — 이미지는 사방 1px 여백이 있어요. 발 위치 = 아래 가운데. */
export function sprite(key, team) {
  const id = key + ":" + team;
  if (cache.has(id)) return cache.get(id);
  const rows = buildRows(S[key] ? key : "pawn");
  const tp = TEAM_PAL[team] ?? TEAM_PAL.ally;
  const [a, b, c] = ACC[S[key]?.acc ?? "gold"];
  const pal = { ...tp, a, b, c, k: "#1a1220", w: "#ffffff" };
  const out = {
    img: paint(rows, pal, "color"),
    white: paint(rows, pal, "white"),
    outline: paint(rows, pal, "outline"),
    w: rows[0].length + 2,
    h: rows.length + 2,
    pixels: pixelList(rows, pal),
  };
  cache.set(id, out);
  return out;
}

/** 부서지는 연출용: [{ x, y, c }] 로컬 좌표 (발 = 0,0) */
function pixelList(rows, pal) {
  const out = [], w = rows[0].length, h = rows.length;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch !== ".") out.push({ x: x - w / 2, y: y - h, c: pal[ch] ?? "#fff", o: ch === "o" || ch === "k" });
    }
  return out;
}

export const spriteKeys = Object.keys(S);
