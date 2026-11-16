// 새 기물 규칙 테스트: node tests/rules.test.mjs
import { createBattle, makeUnit, resolve, endTurn, attackTargets, abilityTargets, moveTargets, byId, applyLevel, optionsAt, readyAbilities } from "../js/game/battle.js";
import { levelCost, PIECES } from "../js/data/pieces.js";
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
// ── 레벨업 ──
{ // 레벨 능력치: 퀸 Lv3 = 체력 6+3, 공격 3+1
  const s = S(); const q = applyLevel(makeUnit(s, "queen", "ally", 3, 6), 3); ok(q.maxHp === 9 && q.hp === 9 && q.atk === 4, "level stats");
}
{ // 레벨업 값은 구매가보다 조금 높음
  ok(levelCost("queen", 2) > PIECES.queen.price && levelCost("queen", 3) > levelCost("queen", 2), "level cost above price");
}
{ // 결계 (폰 Lv2): 보호막 2
  const s = S(); const p = applyLevel(makeUnit(s, "pawn", "ally", 3, 6), 2); ok(p.shield === 2, "barrier");
}
{ // 처형 (폰 Lv3): 절반 이하 적에게 +2
  const s = S(); const p = applyLevel(makeUnit(s, "pawn", "ally", 3, 5), 3); const e = makeUnit(s, "rook", "enemy", 4, 4); e.hp = 3;
  resolve(s, { kind: "attack", id: p.id, x: 4, y: 4, hits: [e.id], dir: [1, -1] }); ok(!byId(s, e.id), "execute (+2 → 4 dmg kills 3hp)");
}
{ // 가시 (나이트 Lv3): 공격자에게 1
  const s = S(); const k = applyLevel(makeUnit(s, "knight", "ally", 3, 5), 3); const e = makeUnit(s, "rook", "enemy", 3, 2);
  resolve(s, { kind: "attack", id: e.id, x: 3, y: 5, hits: [k.id], dir: [0, 1] }); ok(e.hp === 5, "thorns reflect");
}
{ // 재생 (킹 Lv2): 자기 차례 시작에 +1
  const s = S(); const k = applyLevel(makeUnit(s, "king", "ally", 4, 7), 2); k.hp = 5; makeUnit(s, "pawn", "enemy", 0, 0);
  s.turn = "enemy"; endTurn(s); ok(k.hp === 6, "regen");
}
{ // 질주 (광전사 Lv2): 이동 3칸
  const s = S(); const b = applyLevel(makeUnit(s, "berserker", "ally", 0, 7), 2); ok(moveTargets(s, b).some((c) => c.x === 0 && c.y === 4), "swift +1 move");
}
{ // 사거리 증가 (궁수 Lv2): 5칸
  const s = S(); const a = applyLevel(makeUnit(s, "archer", "ally", 0, 7), 2); makeUnit(s, "pawn", "enemy", 0, 2); ok(attackTargets(s, a).some((c) => c.y === 2), "longshot +1 range");
}
{ // 숙련 (화염술사 Lv3): 재사용 3 → 2
  const s = S(); const p = applyLevel(makeUnit(s, "pyro", "ally", 3, 6), 3); makeUnit(s, "pawn", "enemy", 3, 4);
  resolve(s, { kind: "ability", id: p.id, x: 3, y: 4, ability: "fireball" }); ok(p.cd === 3, "quickcast cd");
}
// ── 레벨 스킬 ──
const cast = (s, u, ab, x, y) => resolve(s, { kind: "ability", id: u.id, x, y, ability: ab });
{ // 레벨마다 스킬이 하나씩 열림
  const s = S(); const k = makeUnit(s, "knight", "ally", 3, 6);
  ok(readyAbilities(k).length === 0, "lv1 knight no skill");
  k.lv = 2; ok(readyAbilities(k).map((a) => a.id).join() === "dash", "lv2 unlocks dash");
  k.lv = 3; ok(readyAbilities(k).map((a) => a.id).join() === "dash,whirl", "lv3 unlocks whirl");
}
{ // 여러 능력의 재사용 대기는 따로: 화염술사 Lv3 화염구 후에도 저격 가능
  const s = S(); const p = applyLevel(makeUnit(s, "pyro", "ally", 3, 6), 3); makeUnit(s, "rook", "enemy", 3, 3);
  cast(s, p, "fireball", 3, 3); ok(readyAbilities(p).some((a) => a.id === "snipe") && !readyAbilities(p).some((a) => a.id === "fireball"), "independent cooldowns");
}
{ // 돌격: 일직선 3칸 안 적 앞으로 이동해 공격력+1
  const s = S(); const k = applyLevel(makeUnit(s, "knight", "ally", 3, 6), 2); const e = makeUnit(s, "rook", "enemy", 3, 3);
  ok(optionsAt(s, k, 3, 3).some((o) => o.ability === "dash"), "dash target");
  cast(s, k, "dash", 3, 3); ok(k.y === 4 && e.hp === 3, "dash moves and hits atk+1");
}
{ // 밀쳐내기: 벽에 부딪히면 추가 피해
  const s = S(); const r = applyLevel(makeUnit(s, "rook", "ally", 3, 1), 2); const e = makeUnit(s, "pawn", "enemy", 3, 0); e.hp = e.maxHp = 9;
  cast(s, r, "push", 3, 0); ok(e.hp === 6 && e.y === 0, "push into wall: 1+2");
  const s2 = S(); const r2 = applyLevel(makeUnit(s2, "rook", "ally", 3, 6), 2); const e2 = makeUnit(s2, "rook", "enemy", 3, 5);
  cast(s2, r2, "push", 3, 5); ok(e2.y === 3 && e2.hp === 5, "push 2 cells");
}
{ // 회오리 베기: 주위 적 모두
  const s = S(); const k = applyLevel(makeUnit(s, "knight", "ally", 3, 3), 3); const a = makeUnit(s, "rook", "enemy", 2, 2); const b = makeUnit(s, "rook", "enemy", 4, 4);
  cast(s, k, "whirl", 3, 3); ok(a.hp === 3 && b.hp === 3, "whirl hits all adjacent (atk 3)");
}
{ // 저격: 가로막혀도 맞힘
  const s = S(); const ar = applyLevel(makeUnit(s, "archer", "ally", 3, 7), 3); makeUnit(s, "pawn", "ally", 3, 6); const e = makeUnit(s, "rook", "enemy", 3, 3);
  ok(optionsAt(s, ar, 3, 3).some((o) => o.ability === "snipe"), "snipe ignores blockers");
  cast(s, ar, "snipe", 3, 3); ok(e.hp === 1, "snipe atk+2 (3+2)");
}
{ // 그림자 도약
  const s = S(); const a = applyLevel(makeUnit(s, "assassin", "ally", 0, 7), 2); const e = makeUnit(s, "rook", "enemy", 3, 4);
  cast(s, a, "shadowstep", 3, 4); ok(Math.max(Math.abs(a.x - 3), Math.abs(a.y - 4)) === 1 && e.hp === 3, "shadowstep");
}
{ // 참수: 절반 이하면 즉사
  const s = S(); const k = applyLevel(makeUnit(s, "king", "ally", 3, 6), 3); const e = makeUnit(s, "golem", "enemy", 3, 5); e.hp = 8;
  cast(s, k, "behead", 3, 5); ok(!byId(s, e.id), "behead executes");
}
{ // 축복: 회복 + 정화
  const s = S(); const p = applyLevel(makeUnit(s, "bishop", "ally", 3, 6), 2); const a = makeUnit(s, "rook", "ally", 4, 6); a.hp = 2; a.poison = 2; a.frozen = 1;
  cast(s, p, "bless", 4, 6); ok(a.hp === 5 && a.poison === 0 && a.frozen === 0, "bless heals and cleanses");
}
{ // 격려: 주위 아군 보호막
  const s = S(); const k = applyLevel(makeUnit(s, "king", "ally", 3, 6), 2); const a = makeUnit(s, "pawn", "ally", 5, 6); const far = makeUnit(s, "pawn", "ally", 0, 0);
  cast(s, k, "rally", 3, 6); ok(k.shield === 2 && a.shield === 2 && far.shield === 0, "rally shields within 2");
}
{ // 화살비 / 독 안개 / 냉기 폭발 / 땅울림 / 낙뢰
  const s = S(); const ar = applyLevel(makeUnit(s, "archer", "ally", 3, 7), 2); const e1 = makeUnit(s, "rook", "enemy", 3, 3); const e2 = makeUnit(s, "rook", "enemy", 4, 4);
  cast(s, ar, "volley", 3, 4); ok(e1.hp === 5 && e2.hp === 5, "volley 3x3");
  const s2 = S(); const v = applyLevel(makeUnit(s2, "venomist", "ally", 3, 7), 2); const p1 = makeUnit(s2, "rook", "enemy", 3, 4);
  cast(s2, v, "miasma", 3, 5); ok(p1.poison === 3, "miasma poisons");
  const s3 = S(); const f = applyLevel(makeUnit(s3, "frost", "ally", 3, 3), 2); const f1 = makeUnit(s3, "rook", "enemy", 3, 2);
  cast(s3, f, "frostnova", 3, 3); ok(f1.frozen === 1 && f1.hp === 5, "frostnova");
  const s4 = S(); const g = applyLevel(makeUnit(s4, "golem", "ally", 3, 3), 3); const q1 = makeUnit(s4, "rook", "enemy", 3, 2); const q2 = makeUnit(s4, "rook", "enemy", 3, 1);
  cast(s4, g, "quake", 3, 3); ok(q1.hp === 4 && q2.hp === 5, "quake 2 adjacent / 1 far");
  const s5 = S(); const st = applyLevel(makeUnit(s5, "storm", "ally", 3, 7), 2); const t1 = makeUnit(s5, "rook", "enemy", 5, 4);
  cast(s5, st, "thunder", 5, 4); ok(t1.hp === 3, "thunder 3");
}
console.log(`pass ${pass}, fail ${fail}`);
if (fail) process.exit(1);
