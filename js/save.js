// 영구 저장: 골드, 보유 기물, 편성, 최고 기록.
import { STARTER, PIECES } from "./data/pieces.js";

const KEY = "chaoschess.save.v1";
// 편성 칸: 0..7 = 뒷줄(y=7), 8..15 = 앞줄(y=6)
export const SLOT_COUNT = 16;
export const slotToCell = (i) => ({ x: i % 8, y: i < 8 ? 7 : 6 });
export const cellToSlot = (x, y) => (y === 7 ? x : y === 6 ? 8 + x : -1);

function freshStats() {
  return { kills: 0, goldEarned: 0, wavesCleared: 0, bossKills: 0, deaths: 0 };
}

function fresh() {
  const owned = STARTER.map((key, i) => ({ uid: "u" + (i + 1), key }));
  const formation = {};
  owned.forEach((u, i) => (formation[i] = u.uid));
  return { gold: 150, best: 0, runs: 0, nextUid: owned.length + 1, owned, formation, stats: freshStats(), history: [], seen: {} };
}

let data = null;

export function load() {
  if (data) return data;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!data || !Array.isArray(data.owned)) data = fresh();
  // 예전 저장 데이터에 새 항목 채우기
  data.stats = { ...freshStats(), ...(data.stats ?? {}) };
  data.history ??= [];
  data.seen ??= {};
  // 정의가 사라진 기물은 정리
  data.owned = data.owned.filter((u) => PIECES[u.key]);
  const ids = new Set(data.owned.map((u) => u.uid));
  for (const s of Object.keys(data.formation)) if (!ids.has(data.formation[s])) delete data.formation[s];
  return data;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 저장소를 못 쓰는 환경에서도 게임은 돌아가요 */
  }
}

export function resetSave() {
  data = fresh();
  save();
  return data;
}

export function buy(key) {
  const d = load(), def = PIECES[key];
  if (!def || def.noShop || d.gold < def.price) return null;
  d.gold -= def.price;
  const u = { uid: "u" + d.nextUid++, key };
  d.owned.push(u);
  // 빈 편성 칸이 있으면 자동 배치 (앞줄 우선)
  for (const i of [8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7])
    if (!d.formation[i]) {
      d.formation[i] = u.uid;
      break;
    }
  save();
  return u;
}

export function sell(uid) {
  const d = load(), u = d.owned.find((o) => o.uid === uid);
  if (!u || PIECES[u.key].unique) return 0;
  const refund = Math.floor(PIECES[u.key].price / 2);
  d.owned = d.owned.filter((o) => o.uid !== uid);
  for (const s of Object.keys(d.formation)) if (d.formation[s] === uid) delete d.formation[s];
  d.gold += refund;
  save();
  return refund;
}

/** 도감: 만난 기물 기록 */
export function markSeen(keys) {
  const d = load();
  let changed = false;
  for (const k of keys) if (!d.seen[k]) (d.seen[k] = true), (changed = true);
  if (changed) save();
}

/** 출전 하나가 끝났을 때 기록 */
export function recordRun(r) {
  const d = load();
  d.history.unshift({ at: Date.now(), ...r });
  d.history = d.history.slice(0, 30);
  d.stats.kills += r.kills;
  d.stats.goldEarned += r.gold;
  d.stats.wavesCleared += r.wave;
  d.stats.bossKills += r.bossKills ?? 0;
  d.stats.deaths += r.lost ?? 0;
  save();
}
