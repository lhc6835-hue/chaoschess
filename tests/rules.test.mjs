// 새 기물 규칙 테스트: node tests/rules.test.mjs
import { createBattle, makeUnit, resolve, endTurn, attackTargets, abilityTargets, byId } from "../js/game/battle.js";
let pass = 0, fail = 0;
const ok = (c, msg) => (c ? pass++ : (fail++, console.log("FAIL", msg)));
const S = () => createBattle({ wave: 1, seed: 1 });
{ // 곡사: 사이에 막혀도 맞힘
  const s = S(); const a = makeUnit(s, "slinger", "ally", 3, 6); makeUnit(s, "pawn", "ally", 3, 5); const e = makeUnit(s, "pawn", "enemy", 3, 4);
  ok(attackTargets(s, a).some((t) => t.x === 3 && t.y === 4), "slinger lob over blocker");
}
{ // 기습
  const s = S(); const a = makeUnit(s, "scout", "ally", 0, 7); const e = makeUnit(s, "pawn", "enemy", 1, 4);
  const ev = resolve(s, { kind: "move", id: a.id, x: 0, y: 4 }); ok(byId(s, e.id).hp === 2, "scout hit and run");
}
{ // 반격
  const s = S(); const m = makeUnit(s, "monk", "ally", 3, 5); const e = makeUnit(s, "knight", "enemy", 3, 4);
  resolve(s, { kind: "attack", id: e.id, x: 3, y: 5, hits: [m.id], dir: [0, 1] }); ok(byId(s, e.id).hp === 4, "monk counter");
}
{ // 독
  const s = S(); const v = makeUnit(s, "venomist", "ally", 3, 6); const e = makeUnit(s, "rook", "enemy", 3, 3);
  resolve(s, { kind: "attack", id: v.id, x: 3, y: 3, hits: [e.id], dir: [0, -1] }); ok(e.hp === 5 && e.poison === 3, "venom applied");
  endTurn(s); ok(e.hp === 4 && e.poison === 2, "poison tick");
}
{ // 포격 + 스플래시
  const s = S(); const c = makeUnit(s, "cannoneer", "ally", 3, 7); const e = makeUnit(s, "rook", "enemy", 3, 4); const e2 = makeUnit(s, "pawn", "enemy", 4, 4);
  resolve(s, { kind: "attack", id: c.id, x: 3, y: 4, hits: [e.id], dir: [0, -1] }); ok(e.hp === 3 && byId(s, e2.id).hp === 2, "cannon splash");
}
{ // 흡혈
  const s = S(); const b = makeUnit(s, "spellblade", "ally", 3, 5); b.hp = 3; const e = makeUnit(s, "rook", "enemy", 3, 4);
  resolve(s, { kind: "attack", id: b.id, x: 3, y: 4, hits: [e.id], dir: [0, -1] }); ok(b.hp === 4, "lifesteal");
}
{ // 보호막
  const s = S(); const t = makeUnit(s, "templar", "ally", 3, 6); const k = makeUnit(s, "king", "ally", 4, 6); const e = makeUnit(s, "knight", "enemy", 4, 5);
  resolve(s, { kind: "ability", id: t.id, x: 4, y: 6, ability: "ward" }); ok(k.shield === 3, "ward");
  resolve(s, { kind: "attack", id: e.id, x: 4, y: 6, hits: [k.id], dir: [0, 1] }); ok(k.hp === 10 && k.shield === 1, "shield absorbs");
}
{ // 유폭
  const s = S(); const b = makeUnit(s, "bomber", "ally", 3, 5); b.hp = 1; const e = makeUnit(s, "rook", "enemy", 3, 4); const e2 = makeUnit(s, "pawn", "enemy", 2, 4);
  resolve(s, { kind: "attack", id: e.id, x: 3, y: 5, hits: [b.id], dir: [0, 1] });
  ok(!byId(s, b.id) && byId(s, e.id)?.hp === 3 && !byId(s, e2.id), "bomber explode");
}
{ // 돌 피부
  const s = S(); const g = makeUnit(s, "golem", "ally", 3, 5); const e = makeUnit(s, "rook", "enemy", 3, 4);
  resolve(s, { kind: "attack", id: e.id, x: 3, y: 5, hits: [g.id], dir: [0, 1] }); ok(g.hp === 15, "stoneskin");
}
{ // 박쥐 떼
  const s = S(); const v = makeUnit(s, "vampire", "ally", 3, 6); v.hp = 3; const e = makeUnit(s, "rook", "enemy", 3, 3);
  resolve(s, { kind: "ability", id: v.id, x: 3, y: 3, ability: "bats" }); ok(e.hp === 4 && v.hp === 5, "bats");
}
{ // 자리 바꾸기
  const s = S(); const i = makeUnit(s, "illusionist", "ally", 3, 6); const e = makeUnit(s, "rook", "enemy", 5, 4);
  resolve(s, { kind: "ability", id: i.id, x: 5, y: 4, ability: "swap" }); ok(i.x === 5 && i.y === 4 && e.x === 3 && e.y === 6, "swap");
}
{ // 지휘
  const s = S(); const w = makeUnit(s, "warlord", "ally", 2, 5); const p = makeUnit(s, "pawn", "ally", 3, 5); const e = makeUnit(s, "rook", "enemy", 4, 4);
  resolve(s, { kind: "attack", id: p.id, x: 4, y: 4, hits: [e.id], dir: [1, -1] }); ok(e.hp === 4, "aura +1");
}
{ // 운석
  const s = S(); const a = makeUnit(s, "archmage", "ally", 0, 7); const e = makeUnit(s, "rook", "enemy", 6, 0); const e2 = makeUnit(s, "rook", "enemy", 7, 1);
  ok(abilityTargets(s, a).some((c) => c.x === 7 && c.y === 0), "meteor reach");
  resolve(s, { kind: "ability", id: a.id, x: 7, y: 0, ability: "meteor" }); ok(e.hp === 3 && e2.hp === 3, "meteor dmg");
}
{ // 환생
  const s = S(); const ph = makeUnit(s, "phoenix", "ally", 3, 5); ph.hp = 2; const e = makeUnit(s, "rook", "enemy", 3, 4);
  resolve(s, { kind: "attack", id: e.id, x: 3, y: 5, hits: [ph.id], dir: [0, 1] }); ok(byId(s, ph.id)?.hp === 4 && ph.reborn, "rebirth");
  ph.hp = 1; resolve(s, { kind: "attack", id: e.id, x: 3, y: 5, hits: [ph.id], dir: [0, 1] }); ok(!byId(s, ph.id), "rebirth only once");
}
console.log(`pass ${pass}, fail ${fail}`);
if (fail) process.exit(1);
