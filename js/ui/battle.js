// 전투 화면 진행: 출전(run) → 웨이브 → 재배치 → 다음 웨이브 ... → 종료.
// 죽은 기물은 그 출전에서 돌아오지 않아요. 살아남은 기물은 체력이 조금(최대치의 20%) 회복돼요.
import { PIECES } from "../data/pieces.js";
import { makeWave, waveReward, killReward } from "../data/waves.js";
import { load, save, slotToCell, cellToSlot } from "../save.js";
import {
  createBattle, makeUnit, scaleUnit, unitAt, byId, alive, canAct, optionsAt,
  moveTargets, attackTargets, abilityTargets, resolve, endTurn, hasAnyAction,
} from "../game/battle.js";
import { chooseAction } from "../game/ai.js";
import { BoardView, cellCX, cellFeet } from "../render/board-view.js";
import { E } from "../render/anim.js";
import * as FX from "../fx/effects.js";
import { $, h, spriteCanvas, toast, modal, setGold, rarityTag, abilityLine } from "./common.js";

let view = null;
let run = null;
let battle = null;
let phase = "idle"; // player | busy | arrange | over
let selected = null;
let goHome = null;

const nameOf = (u) => PIECES[u.key]?.name ?? u.key;

export function bindBattle(go) {
  goHome = () => go("home");
  $("#btn-retreat").addEventListener("click", async () => {
    if (phase === "over") return;
    const ok = await modal([h("h3", {}, "귀환할까요?"), h("p", {}, "지금까지 번 골드는 그대로 남아요. 이번 출전은 여기서 끝나요.")], [
      { label: "귀환", value: true, cls: "btn-main" },
      { label: "계속 싸우기", value: false },
    ]);
    if (ok) finishRun("retreat");
  });
  $("#btn-pass").addEventListener("click", () => {
    if (phase !== "player") return;
    closeMenu();
    log("ally", "턴을 넘겼어요.");
    afterAction();
  });
  $("#btn-next-wave").addEventListener("click", () => {
    if (phase !== "arrange") return;
    $("#btn-next-wave").hidden = true;
    run.wave++;
    startWave();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
      deselect();
    }
  });
}

/** 출전 시작. 편성에 킹이 없으면 false */
export function startRun() {
  const d = load();
  const byUid = Object.fromEntries(d.owned.map((u) => [u.uid, u]));
  const units = [];
  let id = 1;
  for (const [slot, uid] of Object.entries(d.formation)) {
    const o = byUid[uid];
    if (!o) continue;
    const def = PIECES[o.key];
    units.push({ id: id++, uid, key: o.key, slot: Number(slot), hp: def.hp, maxHp: def.hp, atk: def.atk, summon: false, kills: 0 });
  }
  if (!units.some((u) => u.key === "king")) return false;
  run = { wave: 1, seed: (Date.now() & 0xffffff) | 1, units, gold: 0, kills: 0 };
  d.runs = (d.runs ?? 0) + 1;
  save();
  const host = $("#battle-board");
  if (!view) {
    const canvas = document.createElement("canvas");
    host.prepend(canvas);
    view = new BoardView(canvas);
  }
  view.resume();
  view.onCell = onCell;
  view.vps.clear();
  view.fx = [];
  requestAnimationFrame(() => view.resize());
  $("#log").replaceChildren();
  setGold($("#battle-gold"), d.gold);
  startWave();
  return true;
}

// ── 웨이브 ──────────────────────────────────────────────────────
async function startWave() {
  phase = "busy";
  view.zone = null;
  view.marks = { move: [], attack: [], ability: [], swap: [] };
  const prev = battle;
  battle = createBattle({ wave: run.wave, seed: run.seed + run.wave * 977 });
  battle.nextId = Math.max(1000, (prev?.nextId ?? 0) + 1);
  for (const r of run.units) {
    const c = slotToCell(r.slot);
    const u = makeUnit(battle, r.key, "ally", c.x, c.y, { summon: r.summon });
    // 출전 단위의 id/체력/공격력을 그대로
    u.id = r.id;
    u.hp = r.hp;
    u.maxHp = r.maxHp;
    u.atk = r.atk;
    u.kills = r.kills;
  }
  const spec = makeWave(run.wave, run.seed);
  const enemies = spec.map((s) => {
    const u = makeUnit(battle, s.key, "enemy", s.x, s.y);
    scaleUnit(u, battle, "enemy");
    return u;
  });
  // 아군은 그대로, 적은 위에서 떨어지며 등장
  view.sync({ units: battle.units.filter((u) => u.team === "ally") }, { snap: true });
  $("#wave-tag").textContent = `웨이브 ${run.wave}`;
  setTurnTag("enemy", "적이 나타나요");
  await banner(`웨이브 ${run.wave}`, run.wave % 5 === 0 ? "마왕이 온다!" : `적 ${enemies.length}기`);
  enemies.sort((a, b) => a.y - b.y || Math.abs(a.x - 3.5) - Math.abs(b.x - 3.5));
  await Promise.all(enemies.map((u, i) => dropIn(u, i * 0.06)));
  log("sys", `웨이브 ${run.wave} 시작. 적 ${enemies.length}기.`);
  playerTurn();
}

async function dropIn(u, delay) {
  await view.clock.wait(delay);
  const vp = view.addVp(u, { alpha: 0 });
  vp.z = 60;
  await view.clock.tween(0.32, (t) => {
    vp.alpha = Math.min(1, t * 3);
    vp.z = 60 * (1 - t);
  }, E.inQuad);
  vp.z = 0;
  vp.sq.v = 1.4;
  vp.sq.vel = 0;
  view.spawnFx(FX.dust, { x: vp.x, y: vp.y, power: u.key === "demon" ? 2 : 1 });
  view.kickShake(u.key === "demon" ? 5 : 1);
}

function setTurnTag(team, text) {
  const t = $("#turn-tag");
  t.textContent = text;
  t.classList.toggle("enemy", team === "enemy");
}

function playerTurn() {
  if (battle.over) return;
  if (!hasAnyAction(battle, "ally")) {
    toast("움직일 수 있는 기물이 없어 턴을 넘겨요.");
    log("ally", "움직일 수 있는 기물이 없어요.");
    return afterAction();
  }
  phase = "player";
  setTurnTag("ally", battle.extraTurn ? "한 번 더!" : "나의 차례");
  $("#btn-pass").disabled = false;
}

async function enemyTurn() {
  phase = "busy";
  setTurnTag("enemy", "적의 차례");
  $("#btn-pass").disabled = true;
  await view.clock.wait(0.35);
  if (hasAnyAction(battle, "enemy")) {
    const act = chooseAction(battle, "enemy");
    if (act) {
      const u = byId(battle, act.id);
      // 누가 움직이는지 잠깐 보여줘요
      view.selected = act.id;
      const vp = view.vps.get(act.id);
      if (vp) vp.sq.kick(-5);
      await view.clock.wait(0.25);
      view.selected = null;
      await perform(act, u);
      return;
    }
  }
  log("enemy", "적이 숨을 고르고 있어요.");
  afterAction();
}

async function perform(act) {
  phase = "busy";
  const u = byId(battle, act.id);
  const names = new Map(battle.units.map((x) => [x.id, nameOf(x)]));
  const evs = resolve(battle, act);
  narrate(u, act, evs, names);
  payKills(evs);
  await view.play(evs);
  view.sync(battle);
  refreshCard();
  afterAction();
}

async function afterAction() {
  if (battle.over === "lose") return finishRun("lose");
  if (battle.over === "win") return waveClear();
  const evs = endTurn(battle);
  if (evs.length) {
    await view.play(evs);
    view.sync(battle);
  }
  if (battle.turn === "enemy") enemyTurn();
  else playerTurn();
}

function payKills(evs) {
  const d = load();
  let got = 0;
  for (const e of evs) if (e.t === "death" && e.team === "enemy") (got += killReward(e.key)), run.kills++;
  if (got) {
    d.gold += got;
    run.gold += got;
    save();
    setTimeout(() => setGold($("#battle-gold"), d.gold), 450);
  }
}

// ── 웨이브 클리어 → 재배치 ──────────────────────────────────────
async function waveClear() {
  phase = "busy";
  const d = load();
  const reward = waveReward(run.wave);
  d.gold += reward;
  run.gold += reward;
  d.best = Math.max(d.best ?? 0, run.wave);
  save();
  setGold($("#battle-gold"), d.gold);
  log("sys", `웨이브 ${run.wave} 클리어! +${reward}G`);
  setTurnTag("ally", "웨이브 클리어");
  for (const vp of view.vps.values()) vp.sq.kick(8 + Math.random() * 6);
  await banner("웨이브 클리어", `+${reward}G`);

  // 살아남은 기물만 다음 웨이브로. 체력 20% 회복.
  const survivors = alive(battle, "ally");
  const used = new Set();
  const next = [];
  for (const u of survivors) {
    const prev = run.units.find((r) => r.id === u.id);
    let slot = prev ? prev.slot : null;
    if (slot == null || used.has(slot)) slot = null;
    const heal = Math.ceil(u.maxHp * 0.2);
    next.push({ id: u.id, key: u.key, slot, hp: Math.min(u.maxHp, u.hp + heal), maxHp: u.maxHp, atk: u.atk, summon: u.summon, kills: u.kills });
    if (slot != null) used.add(slot);
  }
  // 소환수 등 자리가 없는 기물은 빈 칸에 (앞줄 우선)
  for (const r of next)
    if (r.slot == null) {
      const free = [8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7].find((s) => !used.has(s));
      if (free == null) continue;
      r.slot = free;
      used.add(free);
    }
  run.units = next.filter((r) => r.slot != null);

  // 체력 회복 연출 + 원래 자리로 돌아가기
  battle.units = battle.units.filter((u) => u.team === "ally");
  await Promise.all(
    run.units.map(async (r, i) => {
      const vp = view.vps.get(r.id);
      if (!vp) return;
      await view.clock.wait(i * 0.05);
      const c = slotToCell(r.slot);
      if (vp.cx !== c.x || vp.cy !== c.y) await view.moveTo(vp, c.x, c.y, "hop");
      const gained = r.hp - vp.hp;
      vp.hp = r.hp;
      if (gained > 0) view.float("+" + gained, vp.x, vp.y - 24, "#9dff7a");
      const u = byId(battle, r.id);
      if (u) Object.assign(u, { x: c.x, y: c.y, hp: r.hp, frozen: 0, cd: 0 });
      vp.frozen = false;
      vp.cd = 0;
    }),
  );
  enterArrange();
}

function enterArrange() {
  phase = "arrange";
  selected = null;
  view.selected = null;
  view.zone = { y0: 6, y1: 7 };
  view.marks = { move: [], attack: [], ability: [], swap: [] };
  setTurnTag("ally", "재배치: 아래 두 줄 안에서 자리를 바꿀 수 있어요");
  $("#btn-next-wave").hidden = false;
  $("#btn-pass").disabled = true;
  $("#btn-next-wave").focus();
}

async function arrangeClick(c) {
  const here = run.units.find((r) => slotToCell(r.slot).x === c.x && slotToCell(r.slot).y === c.y);
  if (selected == null) {
    if (here) selectArrange(here.id);
    return;
  }
  const me = run.units.find((r) => r.id === selected);
  const slot = cellToSlot(c.x, c.y);
  if (!me || slot < 0 || here?.id === me.id) return deselect();
  phase = "busy";
  const from = me.slot;
  me.slot = slot;
  const jobs = [hopTo(me)];
  if (here) {
    here.slot = from;
    jobs.push(hopTo(here));
  }
  deselect();
  await Promise.all(jobs);
  phase = "arrange";
}

async function hopTo(r) {
  const vp = view.vps.get(r.id), c = slotToCell(r.slot);
  const u = byId(battle, r.id);
  if (u) (u.x = c.x), (u.y = c.y);
  if (vp) await view.moveTo(vp, c.x, c.y, "hop");
}

function selectArrange(id) {
  selected = id;
  view.selected = id;
  const cells = [];
  for (let y = 6; y <= 7; y++) for (let x = 0; x < 8; x++) cells.push({ x, y });
  view.marks = { move: [], attack: [], ability: [], swap: cells };
  showCard(byId(battle, id));
}

// ── 입력 ────────────────────────────────────────────────────────
function onCell(c) {
  closeMenu();
  if (!c) return deselect();
  if (phase === "arrange") return arrangeClick(c);
  const there = unitAt(battle, c.x, c.y);
  if (phase !== "player") {
    if (there) showCard(there);
    return;
  }
  const me = selected != null ? byId(battle, selected) : null;
  if (me) {
    const opts = optionsAt(battle, me, c.x, c.y);
    if (opts.length) return openMenu(me, c, opts);
  }
  if (there && there.team === "ally") {
    if (selected === there.id) return deselect();
    return select(there);
  }
  deselect();
  if (there) showCard(there);
}

function select(u) {
  selected = u.id;
  view.selected = u.id;
  const vp = view.vps.get(u.id);
  if (vp) {
    vp.sq.v = 0.82;
    vp.sq.vel = 0;
  }
  showCard(u);
  if (!canAct(u)) {
    view.marks = { move: [], attack: [], ability: [], swap: [] };
    toast("얼어붙어서 이번 턴엔 움직일 수 없어요.");
    return;
  }
  view.marks = { move: moveTargets(battle, u), attack: attackTargets(battle, u), ability: abilityTargets(battle, u), swap: [] };
}

function deselect() {
  selected = null;
  if (view) {
    view.selected = null;
    if (phase !== "arrange") view.marks = { move: [], attack: [], ability: [], swap: [] };
    else view.marks.swap = [];
  }
}

function openMenu(me, c, opts) {
  const menu = $("#action-menu");
  const pos = view.cellToClient(c.x, c.y);
  const buttons = opts.map((o) =>
    h("button", {
      class: "btn k-" + o.kind,
      onclick: () => {
        closeMenu();
        const act = { ...o, id: me.id };
        deselect();
        perform(act);
      },
    }, o.label),
  );
  buttons.push(h("button", { class: "btn k-cancel", onclick: () => closeMenu() }, "취소"));
  menu.replaceChildren(...buttons);
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  let x = pos.x + pos.cell * 0.55, y = pos.y - pos.cell * 0.3;
  if (x + r.width > window.innerWidth - 8) x = pos.x - pos.cell * 0.55 - r.width;
  if (y + r.height > window.innerHeight - 8) y = window.innerHeight - 8 - r.height;
  menu.style.left = Math.max(8, x) + "px";
  menu.style.top = Math.max(8, y) + "px";
  menu.style.animation = "none";
  void menu.offsetWidth;
  menu.style.animation = "";
  buttons[0].focus({ preventScroll: true });
}

function closeMenu() {
  $("#action-menu").hidden = true;
}

// ── 정보 카드 / 로그 / 배너 ─────────────────────────────────────
let cardUnit = null;
function showCard(u) {
  cardUnit = u?.id ?? null;
  refreshCard();
}
function refreshCard() {
  const el = $("#unit-card");
  const u = cardUnit != null && battle ? byId(battle, cardUnit) : null;
  if (!u) {
    el.replaceChildren(h("p", { class: "muted" }, "기물을 누르면 정보가 나와요."));
    return;
  }
  const def = PIECES[u.key];
  const team = u.team === "ally" && u.summon ? "summon" : u.team;
  const status = [];
  if (u.frozen) status.push("빙결");
  if (def.ability && u.cd > 0) status.push(`${def.ability.name} ${u.cd - (battle.turn === u.team ? 0 : 1)}턴 뒤`);
  if (u.atk > def.atk && u.team === "ally") status.push(`공격 +${u.atk - def.atk}`);
  el.replaceChildren(
    h("div", { class: "head" },
      h("div", { class: "pic" }, spriteCanvas(u.key, team, 2)),
      h("div", {}, h("h4", {}, def.name, " ", rarityTag(u.key)), h("div", { class: "row" }, h("span", {}, u.team === "ally" ? (u.summon ? "소환된 아군" : "아군") : "적"), status.length ? h("span", {}, status.join(", ")) : null)),
    ),
    h("div", { class: "hpbar " + (u.team === "enemy" ? "enemy" : "") }, h("i", { style: `width:${(u.hp / u.maxHp) * 100}%` })),
    h("div", { class: "row" }, h("span", {}, "체력 ", h("b", {}, `${u.hp}/${u.maxHp}`)), h("span", {}, "공격 ", h("b", {}, u.atk)), h("span", {}, def.style === "ranged" ? "원거리" : "근접")),
    h("p", {}, def.desc),
    abilityLine(def) ?? "",
  );
}

function log(team, html) {
  const li = h("li", { class: team });
  li.innerHTML = html;
  const ol = $("#log");
  ol.prepend(li);
  while (ol.children.length > 40) ol.lastChild.remove();
}

function narrate(u, act, evs, names = new Map()) {
  if (!u) return;
  const who = `<b>${nameOf(u)}</b>`;
  const parts = [];
  for (const e of evs) {
    if (e.t === "move" && e.style !== "advance") parts.push(`${who} 이동`);
    else if (e.t === "ability") parts.push(`${who}의 ${e.name}`);
    else if (e.t === "hit") {
      parts.push(`${names.get(e.id) ?? "상대"} -${e.dmg}${e.crit ? " (급습)" : ""}`);
    } else if (e.t === "death") parts.push(`${PIECES[e.key].name} 쓰러짐`);
    else if (e.t === "spawn") parts.push(`${PIECES[e.unit.key].name} 등장`);
    else if (e.t === "heal") parts.push(`회복 +${e.amount}`);
    else if (e.t === "promote") parts.push(`퀸으로 승급`);
    else if (e.t === "attack") parts.push(`${who} 공격`);
  }
  log(u.team, parts.join(", "));
}

async function banner(title, sub = "") {
  const b = $("#banner");
  b.replaceChildren(title, sub ? h("small", {}, sub) : "");
  b.className = "banner show";
  b.hidden = false;
  await view.clock.wait(1.0);
  b.className = "banner hide";
  await view.clock.wait(0.3);
  b.hidden = true;
}

// ── 종료 ────────────────────────────────────────────────────────
async function finishRun(reason) {
  phase = "over";
  closeMenu();
  const d = load();
  const cleared = reason === "lose" || reason === "retreat" ? run.wave - 1 : run.wave;
  d.best = Math.max(d.best ?? 0, cleared);
  save();
  if (reason === "lose") {
    await view.clock.wait(0.6);
    await banner("킹이 쓰러졌어요", "");
  }
  await modal(
    [
      h("h3", {}, reason === "retreat" ? "귀환했어요" : "출전 종료"),
      h("p", {}, `클리어한 웨이브: ${cleared}`),
      h("p", {}, `쓰러뜨린 적: ${run.kills}기`),
      h("p", {}, `번 골드: ${run.gold}G`),
      h("p", { class: "muted" }, "번 골드로 상점에서 새 기물을 데려올 수 있어요."),
    ],
    [{ label: "메인으로", value: true, cls: "btn-main" }],
  );
  view.vps.clear();
  view.pause();
  battle = null;
  goHome();
}

// 자동 테스트용 도우미: 지금 할 수 있는 공격(없으면 전진)을 하나 알려줘요.
window.__cc = {
  phase: () => phase,
  wave: () => run?.wave,
  autoAct() {
    if (!battle || phase !== "player") return false;
    const act = chooseAction(battle, "ally");
    if (!act) return false;
    perform(act);
    return true;
  },
  speed(n) {
    if (view) view.clock.speed = n;
  },
  nextWave() {
    if (phase === "arrange") $("#btn-next-wave").click();
  },
  findAttack() {
    if (!battle || phase !== "player") return null;
    for (const u of alive(battle, "ally").filter(canAct)) {
      const a = attackTargets(battle, u)[0];
      if (a) return { ux: u.x, uy: u.y, tx: a.x, ty: a.y };
    }
    for (const u of alive(battle, "ally").filter(canAct)) {
      const m = moveTargets(battle, u).sort((p, q) => p.y - q.y)[0];
      if (m) return { ux: u.x, uy: u.y, tx: m.x, ty: m.y };
    }
    return null;
  },
};

export function battleView() {
  return view;
}
export { cellCX, cellFeet };
