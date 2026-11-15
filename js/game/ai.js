// 적 AI: 가능한 행동을 하나씩 복제 상태에 적용해 보고 점수가 가장 좋은 걸 골라요.
import { PIECES } from "../data/pieces.js";
import { clone, resolve, alive, allActions, attackTargets, canAct, cheb, byId } from "./battle.js";

const value = (u) => (u.key === "king" ? 60 : 4 + PIECES[u.key].price / 25) * (u.hp / u.maxHp + 0.5);

function material(s, team) {
  let v = 0;
  for (const u of s.units) if (u.hp > 0) v += (u.team === team ? 1 : -1) * (value(u) + u.hp * 0.6 + u.atk);
  return v;
}

/** 상대 기물이 다음 턴에 공격할 수 있는 칸에 서 있으면 그만큼 감점 */
function danger(s, team) {
  let d = 0;
  const foes = alive(s, team === "ally" ? "enemy" : "ally").filter(canAct);
  const threatened = new Map();
  for (const f of foes)
    for (const a of attackTargets(s, f))
      for (const id of a.hits) threatened.set(id, Math.max(threatened.get(id) ?? 0, f.atk));
  for (const [id, atk] of threatened) {
    const u = byId(s, id);
    if (!u) continue;
    d += (atk >= u.hp ? value(u) * 0.7 : atk * 0.8);
  }
  return d;
}

export function chooseAction(s, team = "enemy", jitter = Math.random) {
  const mine = alive(s, team).filter(canAct);
  const foes = alive(s, team === "ally" ? "enemy" : "ally");
  const base = material(s, team);
  let best = null, bestScore = -Infinity;
  for (const u of mine)
    for (const act of allActions(s, u)) {
      const sim = clone(s);
      resolve(sim, act);
      let score = material(sim, team) - base;
      if (sim.over === "lose" && team === "enemy") score += 500; // 킹을 잡으면 끝
      score -= danger(sim, team) * 0.55;
      // 전진 유도: 가장 가까운 적과의 거리
      const me = byId(sim, u.id);
      if (me && foes.length) {
        const near = Math.min(...foes.map((f) => cheb(me, f)));
        const before = Math.min(...foes.map((f) => cheb(u, f)));
        score += (before - near) * 0.9;
        const k = foes.find((f) => f.key === "king");
        if (k) score += (cheb(u, k) - cheb(me, k)) * 0.35;
      }
      score += jitter() * 0.6;
      if (score > bestScore) (bestScore = score), (best = act);
    }
  return best;
}
