// 전투 규칙. 상태는 순수 데이터, resolve()가 상태를 바꾸고 연출용 이벤트 목록을 돌려줘요.
// AI는 clone() 한 상태에 같은 resolve()를 돌려서 수를 평가해요.
import { PIECES, ALL } from "../data/pieces.js";

export const SIZE = 8;
export const inBoard = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const other = (team) => (team === "ally" ? "enemy" : "ally");
const MAX_SKELETONS = 4;

// ── 상태 ────────────────────────────────────────────────────────
export function createBattle({ wave, seed }) {
  return { units: [], turn: "ally", turnNo: 1, wave, seed: seed >>> 0 || 1, nextId: 1, extraTurn: false, over: null };
}

export function rand(state) {
  // mulberry32, 상태 안에 시드를 두어 AI 시뮬레이션도 결정적
  let t = (state.seed = (state.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function makeUnit(state, key, team, x, y, extra = {}) {
  const def = PIECES[key];
  const u = {
    id: state.nextId++, key, team, x, y,
    hp: def.hp, maxHp: def.hp, atk: def.atk,
    cd: 0, frozen: 0, moved: false, kills: 0, timer: 0, shield: 0, poison: 0, reborn: false,
    summon: !!def.summon, ...extra,
  };
  state.units.push(u);
  return u;
}

export function clone(state) {
  return { ...state, units: state.units.map((u) => ({ ...u })) };
}

export const unitAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y && u.hp > 0);
export const byId = (s, id) => s.units.find((u) => u.id === id);
export const alive = (s, team) => s.units.filter((u) => u.hp > 0 && (!team || u.team === team));
export const canAct = (u) => u.hp > 0 && u.frozen === 0;
const forward = (u) => (u.team === "ally" ? -1 : 1);

// ── 패턴 ────────────────────────────────────────────────────────
function slideCells(s, u, dirs, range, { stopOnAny = true } = {}) {
  const out = [];
  for (const [dx, dy] of dirs)
    for (let k = 1; k <= range; k++) {
      const x = u.x + dx * k, y = u.y + dy * k;
      if (!inBoard(x, y)) break;
      if (unitAt(s, x, y)) break;
      out.push({ x, y });
    }
  return out;
}

export function moveTargets(s, u) {
  const m = PIECES[u.key].move, out = [];
  if (m.pawn) {
    const f = forward(u);
    if (inBoard(u.x, u.y + f) && !unitAt(s, u.x, u.y + f)) {
      out.push({ x: u.x, y: u.y + f });
      if (!u.moved && inBoard(u.x, u.y + 2 * f) && !unitAt(s, u.x, u.y + 2 * f)) out.push({ x: u.x, y: u.y + 2 * f });
    }
  } else if (m.leap) {
    for (const [dx, dy] of m.leap) {
      const x = u.x + dx, y = u.y + dy;
      if (inBoard(x, y) && !unitAt(s, x, y)) out.push({ x, y });
    }
  } else if (m.blink) {
    for (let y = u.y - m.blink; y <= u.y + m.blink; y++)
      for (let x = u.x - m.blink; x <= u.x + m.blink; x++)
        if (inBoard(x, y) && !unitAt(s, x, y)) out.push({ x, y });
  } else if (m.slide) out.push(...slideCells(s, u, m.slide, m.range));
  return out;
}

/** 공격 가능한 칸들: [{ x, y, hits: [unitId...], dir }] — 클릭할 칸은 적이 있는 칸. */
export function attackTargets(s, u) {
  const a = PIECES[u.key].attack, out = [];
  const foe = (t) => t && t.team !== u.team && t.hp > 0;
  if (a.pawnAttack) {
    const f = forward(u);
    for (const dx of [-1, 1]) {
      const t = unitAt(s, u.x + dx, u.y + f);
      if (foe(t)) out.push({ x: t.x, y: t.y, hits: [t.id], dir: [dx, f] });
    }
  } else if (a.leap) {
    for (const [dx, dy] of a.leap) {
      const t = unitAt(s, u.x + dx, u.y + dy);
      if (foe(t)) out.push({ x: t.x, y: t.y, hits: [t.id], dir: [Math.sign(dx), Math.sign(dy)] });
    }
  } else if (a.area) {
    // 곡사: 체비셰프 거리 min~area 안의 적이면 사이에 뭐가 있어도 맞힘
    for (const t of s.units)
      if (foe(t) && cheb(u, t) <= a.area && cheb(u, t) >= (a.min ?? 1))
        out.push({ x: t.x, y: t.y, hits: [t.id], dir: [Math.sign(t.x - u.x), Math.sign(t.y - u.y)] });
  } else if (a.slide) {
    const min = a.min ?? 1;
    for (const [dx, dy] of a.slide) {
      const line = [];
      for (let k = 1; k <= a.range; k++) {
        const x = u.x + dx * k, y = u.y + dy * k;
        if (!inBoard(x, y)) break;
        const t = unitAt(s, x, y);
        if (!t) continue;
        if (t.team === u.team) break; // 아군에 막힘
        if (k >= min) line.push(t);
        if (!a.pierce) break; // 일반 공격은 첫 기물에서 멈춤
      }
      if (!line.length) continue;
      if (a.pierce) for (const t of line) out.push({ x: t.x, y: t.y, hits: line.map((l) => l.id), dir: [dx, dy] });
      else out.push({ x: line[0].x, y: line[0].y, hits: [line[0].id], dir: [dx, dy] });
    }
  }
  return out;
}

export function abilityTargets(s, u) {
  const ab = PIECES[u.key].ability;
  if (!ab || u.cd > 0) return [];
  const out = [];
  const around = (r, fn) => {
    for (let y = u.y - r; y <= u.y + r; y++)
      for (let x = u.x - r; x <= u.x + r; x++) if (inBoard(x, y) && fn(x, y)) out.push({ x, y });
  };
  switch (ab.id) {
    case "ward":
      around(ab.range, (x, y) => {
        const t = unitAt(s, x, y);
        return t && t.team === u.team && (t.shield ?? 0) < 3;
      });
      break;
    case "bats":
      around(ab.range, (x, y) => {
        const t = unitAt(s, x, y);
        return t && t.team !== u.team;
      });
      break;
    case "swap":
      around(ab.range, (x, y) => {
        const t = unitAt(s, x, y);
        return t && t.id !== u.id;
      });
      break;
    case "meteor":
    case "fireball":
      around(ab.range, (x, y) => {
        // 3×3 안에 적이 한 명이라도 있어야 의미가 있어요
        for (let yy = y - 1; yy <= y + 1; yy++)
          for (let xx = x - 1; xx <= x + 1; xx++) {
            const t = unitAt(s, xx, yy);
            if (t && t.team !== u.team) return true;
          }
        return false;
      });
      break;
    case "heal":
      around(ab.range, (x, y) => {
        const t = unitAt(s, x, y);
        return t && t.team === u.team && t.hp < t.maxHp;
      });
      break;
    case "raise":
      if (alive(s, u.team).filter((t) => t.key === "skeleton").length < MAX_SKELETONS)
        around(1, (x, y) => !unitAt(s, x, y));
      break;
    case "haste":
      out.push({ x: u.x, y: u.y });
      break;
    case "smite":
      around(1, (x, y) => {
        const t = unitAt(s, x, y);
        return t && t.team !== u.team;
      });
      break;
  }
  return out;
}

/** 칸 하나를 골랐을 때 나오는 선택지 목록. */
export function optionsAt(s, u, x, y) {
  const opts = [];
  if (moveTargets(s, u).some((c) => c.x === x && c.y === y)) opts.push({ kind: "move", label: "이동", x, y });
  const at = attackTargets(s, u).find((c) => c.x === x && c.y === y);
  if (at) opts.push({ kind: "attack", label: "공격", x, y, hits: at.hits, dir: at.dir });
  const ab = PIECES[u.key].ability;
  if (abilityTargets(s, u).some((c) => c.x === x && c.y === y)) opts.push({ kind: "ability", label: ab.name, x, y, ability: ab.id });
  return opts;
}

export function allActions(s, u) {
  const acts = [];
  for (const c of moveTargets(s, u)) acts.push({ kind: "move", id: u.id, x: c.x, y: c.y });
  for (const c of attackTargets(s, u)) acts.push({ kind: "attack", id: u.id, x: c.x, y: c.y, hits: c.hits, dir: c.dir });
  const ab = PIECES[u.key].ability;
  for (const c of abilityTargets(s, u)) acts.push({ kind: "ability", id: u.id, x: c.x, y: c.y, ability: ab.id });
  return acts;
}

// ── 피해/사망 ───────────────────────────────────────────────────
function guarded(s, t) {
  return s.units.some((g) => g.hp > 0 && g.team === t.team && g.id !== t.id && PIECES[g.key].passive === "guard" && cheb(g, t) === 1);
}

/** 전쟁군주 옆이면 공격력 +1 */
export function atkOf(s, u) {
  const aura = s.units.some((w) => w.hp > 0 && w.team === u.team && w.id !== u.id && PIECES[w.key].passive === "aura" && cheb(w, u) === 1);
  return u.atk + (aura ? 1 : 0);
}

function damage(s, ev, src, t, amount, extra = {}) {
  if (t.hp <= 0) return;
  let dmg = amount;
  const guard = guarded(s, t);
  if (guard) dmg = Math.max(1, dmg - 1);
  const stone = PIECES[t.key].passive === "stoneskin";
  if (stone) dmg = Math.max(1, dmg - 1);
  let absorbed = 0;
  if (t.shield > 0) {
    absorbed = Math.min(t.shield, dmg);
    t.shield -= absorbed;
    dmg -= absorbed;
  }
  t.hp = Math.max(0, t.hp - dmg);
  ev.push({ t: "hit", id: t.id, from: src?.id, dmg, hp: t.hp, guard, stone, absorbed, shield: t.shield, ...extra });
  // 흡혈
  if (src && src.hp > 0 && src.team !== t.team && PIECES[src.key].passive === "lifesteal" && dmg + absorbed > 0 && !extra.counter && !extra.bats) heal(s, ev, src, 1);
  if (t.hp <= 0) return kill(s, ev, src, t);
  // 반격: 근접 거리에서 맞고 버티면 1 되돌려줌
  if (PIECES[t.key].passive === "counter" && src && src.hp > 0 && src.team !== t.team && !extra.counter && cheb(src, t) === 1 && t.frozen === 0)
    damage(s, ev, t, src, 1, { counter: true });
}

function kill(s, ev, src, t) {
  // 환생: 출전마다 한 번 되살아남
  if (PIECES[t.key].passive === "rebirth" && !t.reborn) {
    t.reborn = true;
    t.hp = Math.ceil(t.maxHp / 2);
    t.poison = 0;
    ev.push({ t: "revive", id: t.id, hp: t.hp });
    return;
  }
  ev.push({ t: "death", id: t.id, key: t.key, team: t.team, x: t.x, y: t.y });
  // 유폭: 쓰러지면 주변 적에게 3
  if (PIECES[t.key].passive === "explode") {
    ev.push({ t: "explode", id: t.id, x: t.x, y: t.y });
    for (const e of s.units.filter((e) => e.hp > 0 && e.team !== t.team && cheb(e, t) === 1)) damage(s, ev, t, e, 3, { blast: true });
  }
  if (t.key === "king" && t.team === "ally") s.over = "lose";
  if (src && src.hp > 0) {
    src.kills++;
    if (PIECES[src.key].passive === "bloodlust") {
      src.atk++;
      ev.push({ t: "buff", id: src.id, atk: src.atk });
    }
  }
  // 망자의 부름: 반대편 네크로맨서 2칸 이내에서 쓰러지면 해골로 일어남
  if (t.key !== "skeleton") {
    const necro = s.units.find((n) => n.hp > 0 && n.team !== t.team && PIECES[n.key].passive === "deathcall" && cheb(n, t) <= 2);
    if (necro && alive(s, necro.team).filter((k) => k.key === "skeleton").length < MAX_SKELETONS) {
      const sk = makeUnit(s, "skeleton", necro.team, t.x, t.y, { summon: true });
      scaleUnit(sk, s, necro.team);
      ev.push({ t: "spawn", unit: { ...sk }, fx: "rise", by: necro.id });
    }
  }
}

function heal(s, ev, t, amount) {
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + amount);
  if (t.hp > before) ev.push({ t: "heal", id: t.id, amount: t.hp - before, hp: t.hp });
}

/** 적 유닛은 웨이브에 따라 강해져요. */
export function scaleUnit(u, s, team) {
  if (team !== "enemy") return;
  const w = s.wave - 1;
  const hpMul = 1 + 0.09 * w;
  u.maxHp = u.hp = Math.max(1, Math.round(PIECES[u.key].hp * hpMul));
  u.atk = PIECES[u.key].atk + Math.floor(w / 4);
}

function promoteIfNeeded(s, ev, u) {
  if (u.key !== "pawn" || u.hp <= 0) return;
  const lastRow = u.team === "ally" ? 0 : SIZE - 1;
  if (u.y !== lastRow) return;
  const q = PIECES.queen;
  u.key = "queen";
  u.maxHp = Math.max(u.maxHp, q.hp);
  u.hp = Math.min(u.maxHp, u.hp + 3);
  u.atk = Math.max(u.atk, q.atk);
  ev.push({ t: "promote", id: u.id, key: "queen", hp: u.hp, maxHp: u.maxHp });
}

// ── 행동 처리 ───────────────────────────────────────────────────
export function resolve(s, act) {
  const ev = [];
  const u = byId(s, act.id);
  if (!u || u.hp <= 0) return ev;
  const def = PIECES[u.key];

  if (act.kind === "move") {
    const style = def.move.blink ? "blink" : def.move.leap ? "leap" : "hop";
    ev.push({ t: "move", id: u.id, from: { x: u.x, y: u.y }, to: { x: act.x, y: act.y }, style });
    u.x = act.x;
    u.y = act.y;
    u.moved = true;
    promoteIfNeeded(s, ev, u);
    if (def.passive === "hitandrun") {
      const t = alive(s, other(u.team)).filter((t) => cheb(t, u) === 1).sort((a, b) => a.hp - b.hp)[0];
      if (t) {
        ev.push({ t: "attack", id: u.id, fx: "jab", style: "melee", cell: { x: t.x, y: t.y }, dir: [Math.sign(t.x - u.x), Math.sign(t.y - u.y)], targets: [t.id], quick: true });
        damage(s, ev, u, t, 1);
      }
    }
  } else if (act.kind === "attack") {
    const targets = act.hits.map((id) => byId(s, id)).filter((t) => t && t.hp > 0);
    const main = byId(s, act.hits[0]) && unitAt(s, act.x, act.y);
    ev.push({ t: "attack", id: u.id, fx: def.fx, style: def.style, cell: { x: act.x, y: act.y }, dir: act.dir, targets: targets.map((t) => t.id) });
    if (def.passive === "chain") {
      // 첫 대상 + 옆으로 두 번 튀는 번개
      const hit = [main];
      let last = main;
      for (let j = 0; j < 2; j++) {
        const next = alive(s, other(u.team)).filter((t) => !hit.includes(t) && cheb(t, last) === 1).sort((a, b) => a.hp - b.hp)[0];
        if (!next) break;
        hit.push(next);
        last = next;
      }
      ev.push({ t: "chain", id: u.id, path: hit.map((h) => ({ id: h.id, x: h.x, y: h.y })) });
      const A = atkOf(s, u);
      hit.forEach((t, j) => damage(s, ev, u, t, j === 0 ? A : Math.max(1, A - 1), { chain: j }));
    } else {
      for (const t of targets) {
        let dmg = atkOf(s, u), crit = false;
        if (def.passive === "ambush" && t.hp === t.maxHp) (dmg *= 2), (crit = true);
        damage(s, ev, u, t, dmg, { crit });
        if (def.passive === "freeze" && t.hp > 0) {
          t.frozen = 1;
          ev.push({ t: "freeze", id: t.id });
        }
        if (def.passive === "poison" && t.hp > 0) {
          t.poison = 3;
          ev.push({ t: "poisoned", id: t.id });
        }
      }
      // 포격: 맞은 칸 주변 적에게 1
      if (def.passive === "splash")
        for (const e of alive(s, other(u.team)).filter((e) => !targets.includes(e) && Math.abs(e.x - act.x) <= 1 && Math.abs(e.y - act.y) <= 1))
          damage(s, ev, u, e, 1, { splash: true });
    }
    // 근접 기물은 대상이 쓰러지고 칸이 비면 전진
    if (def.style === "melee" && u.hp > 0 && !unitAt(s, act.x, act.y)) {
      ev.push({ t: "move", id: u.id, from: { x: u.x, y: u.y }, to: { x: act.x, y: act.y }, style: "advance" });
      u.x = act.x;
      u.y = act.y;
      u.moved = true;
      promoteIfNeeded(s, ev, u);
    }
  } else if (act.kind === "ability") {
    const ab = def.ability;
    u.cd = ab.cd + 1; // 이번 턴 끝에 1 줄어드니 +1
    ev.push({ t: "ability", id: u.id, ability: ab.id, name: ab.name, cell: { x: act.x, y: act.y } });
    if (ab.id === "fireball") {
      for (const t of alive(s, other(u.team)))
        if (Math.abs(t.x - act.x) <= 1 && Math.abs(t.y - act.y) <= 1) damage(s, ev, u, t, 2);
    } else if (ab.id === "heal") {
      const t = unitAt(s, act.x, act.y);
      if (t) heal(s, ev, t, 4);
    } else if (ab.id === "raise") {
      const sk = makeUnit(s, "skeleton", u.team, act.x, act.y, { summon: true });
      scaleUnit(sk, s, u.team);
      ev.push({ t: "spawn", unit: { ...sk }, fx: "raise", by: u.id });
    } else if (ab.id === "haste") {
      s.extraTurn = true;
      ev.push({ t: "haste", id: u.id });
    } else if (ab.id === "meteor") {
      for (const t of alive(s, other(u.team)))
        if (Math.abs(t.x - act.x) <= 1 && Math.abs(t.y - act.y) <= 1) damage(s, ev, u, t, 3);
    } else if (ab.id === "ward") {
      const t = unitAt(s, act.x, act.y);
      if (t) {
        t.shield = 3;
        ev.push({ t: "shield", id: t.id, shield: 3 });
      }
    } else if (ab.id === "bats") {
      const t = unitAt(s, act.x, act.y);
      if (t) {
        damage(s, ev, u, t, 2, { bats: true });
        if (u.hp > 0) heal(s, ev, u, 2);
      }
    } else if (ab.id === "swap") {
      const t = unitAt(s, act.x, act.y);
      if (t) {
        const a = { x: u.x, y: u.y }, b = { x: t.x, y: t.y };
        ev.push({ t: "swap", a: u.id, b: t.id, pa: a, pb: b });
        (u.x = b.x), (u.y = b.y), (t.x = a.x), (t.y = a.y);
        promoteIfNeeded(s, ev, u);
        promoteIfNeeded(s, ev, t);
      }
    } else if (ab.id === "smite") {
      const t = unitAt(s, act.x, act.y);
      if (t) damage(s, ev, u, t, 5);
      for (const a of alive(s, u.team)) if (a.id !== u.id && cheb(a, u) === 1) heal(s, ev, a, 2);
    }
  }

  s.units = s.units.filter((x) => x.hp > 0);
  if (!alive(s, "enemy").length && !s.over) s.over = "win";
  return ev;
}

/** 지금 턴 쪽 기물의 쿨다운·빙결을 정리하고 턴을 넘겨요. 턴 시작 이벤트(마왕 소환 등)를 돌려줘요. */
export function endTurn(s) {
  const ev = [];
  const team = s.turn;
  if (s.extraTurn) {
    s.extraTurn = false;
    return ev; // 시간 가속: 같은 편이 한 번 더
  }
  for (const u of alive(s, team)) {
    if (u.cd > 0) u.cd--;
    if (u.frozen > 0) u.frozen--;
  }
  s.turn = other(team);
  if (s.turn === "ally") s.turnNo++;
  // 다음 턴 쪽의 시작 효과: 독
  for (const u of alive(s, s.turn))
    if (u.poison > 0) {
      u.poison--;
      damage(s, ev, null, u, 1, { poison: true });
    }
  s.units = s.units.filter((x) => x.hp > 0);
  if (!alive(s, "enemy").length && !s.over) s.over = "win";
  for (const u of alive(s, s.turn)) {
    if (PIECES[u.key].passive === "spawner") {
      u.timer++;
      if (u.timer % 3 === 0) {
        const free = ALL.map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy })).filter((c) => inBoard(c.x, c.y) && !unitAt(s, c.x, c.y));
        if (free.length) {
          const c = free[Math.floor(rand(s) * free.length)];
          const imp = makeUnit(s, "imp", u.team, c.x, c.y);
          scaleUnit(imp, s, u.team);
          ev.push({ t: "spawn", unit: { ...imp }, fx: "hellgate", by: u.id });
        }
      }
    }
  }
  return ev;
}

export function hasAnyAction(s, team) {
  return alive(s, team).some((u) => canAct(u) && allActions(s, u).length);
}
