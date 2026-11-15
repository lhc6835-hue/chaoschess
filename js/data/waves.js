// 웨이브 구성: 웨이브가 오를수록 예산이 늘고 더 높은 등급이 섞여요. 5의 배수 웨이브엔 마왕.
import { PIECES } from "./pieces.js";

const POOL = [
  { key: "pawn", from: 1, w: 10 },
  { key: "knight", from: 1, w: 4 },
  { key: "bishop", from: 1, w: 4 },
  { key: "rook", from: 2, w: 3 },
  { key: "spearman", from: 2, w: 4 },
  { key: "archer", from: 2, w: 4 },
  { key: "shield", from: 3, w: 3 },
  { key: "imp", from: 3, w: 3 },
  { key: "queen", from: 4, w: 2 },
  { key: "frost", from: 4, w: 2 },
  { key: "pyro", from: 4, w: 2 },
  { key: "priest", from: 5, w: 2 },
  { key: "assassin", from: 5, w: 2 },
  { key: "berserker", from: 7, w: 2 },
  { key: "storm", from: 7, w: 2 },
  { key: "necro", from: 8, w: 1 },
  { key: "paladin", from: 10, w: 1 },
  { key: "chrono", from: 11, w: 1 },
  { key: "dragon", from: 12, w: 1 },
];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const waveBudget = (w) => 120 + w * 60 + Math.floor(w * w * 5);
const minCount = (w) => Math.min(14, 4 + w);
export const waveReward = (w) => 25 + w * 12;
export const killReward = (key) => Math.max(3, Math.round(PIECES[key].price * 0.12));

/** [{ key, x, y }] — 적은 위쪽 두 줄(y=0 뒷줄, y=1 앞줄)에 서요. */
export function makeWave(w, seed) {
  const R = rng(seed * 7919 + w * 104729);
  let budget = waveBudget(w);
  const picks = [];
  if (w % 5 === 0) {
    picks.push("demon");
    budget -= PIECES.demon.price * 0.6;
  }
  const pool = POOL.filter((p) => p.from <= w);
  let guard = 0;
  while (budget > 15 && picks.length < 16 && guard++ < 200) {
    const cheap = picks.length < minCount(w);
    const fits = pool.filter((p) => PIECES[p.key].price <= budget && (!cheap || PIECES[p.key].price <= Math.max(30, budget / (minCount(w) - picks.length))));
    if (!fits.length) break;
    const total = fits.reduce((a, p) => a + p.w, 0);
    let r = R() * total, choice = fits[0];
    for (const p of fits) if ((r -= p.w) < 0) {
      choice = p;
      break;
    }
    picks.push(choice.key);
    budget -= PIECES[choice.key].price;
  }
  // 배치: 폰·창병·방패병은 앞줄, 나머지는 뒷줄부터
  const front = ["pawn", "spearman", "shield", "imp"];
  const cols = [3, 4, 2, 5, 1, 6, 0, 7];
  const rows = { 0: [], 1: [] };
  const sorted = [...picks].sort((a, b) => PIECES[b].price - PIECES[a].price);
  const out = [];
  for (const key of sorted) {
    let row = front.includes(key) ? 1 : 0;
    if (rows[row].length >= 8) row = 1 - row;
    if (rows[row].length >= 8) break;
    const x = cols[rows[row].length];
    rows[row].push(key);
    out.push({ key, x, y: row });
  }
  return out;
}
