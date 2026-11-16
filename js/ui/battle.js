// 전투 화면 진행: 출전(run) → 웨이브 → 재배치 → 다음 웨이브 ... → 종료.
// 죽은 기물은 그 출전에서 돌아오지 않아요. 살아남은 기물은 체력이 조금(최대치의 20%) 회복돼요.
import { PIECES, levelBonus, TRAITS, LEVEL_TRAITS, abilitiesAt } from "../data/pieces.js";
import { makeWave, waveReward, killReward } from "../data/waves.js";
import { load, save, slotToCell, cellToSlot, markSeen, recordRun } from "../save.js";
import {
  createBattle, makeUnit, scaleUnit, unitAt, byId, alive, canAct, optionsAt, applyLevel, hasP,
  moveTargets, attackTargets, abilityTargets, resolve, endTurn, hasAnyAction, clone,
} from "../game/battle.js";
import { chooseAction } from "../game/ai.js";
import { BoardView, cellCX, cellFeet } from "../render/board-view.js";
import { E } from "../render/anim.js";
import * as FX from "../fx/effects.js";
import { $, h, spriteCanvas, toast, modal, setGold, rarityTag, abilityLine, lvBadge } from "./common.js";
import { sfx, jingle, music } from "../audio.js";
import { idle } from "./transition.js";
import { setBackdrop } from "../render/backdrop.js";

let view = null;
let run = null;
let battle = null;
let phase = "idle"; // player | busy | arrange | over
let selected = null;
let goHome = null;
let defeatHome = null;

const nameOf = (u) => PIECES[u.key]?.name ?? u.key;

// ── 전투 편의 설정 (기억해 둬요) ─────────────────────────────────
const UI_KEY = "chaoschess.ui.v1";
const ui = { speed: 1, threat: false };
try {
  Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY) || "{}"));
} catch {
  /* 기본값 */
}
const saveUi = () => {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* 저장 못 해도 계속 */
  }
};
function applyUi() {
  if (view) view.clock.speed = ui.speed;
  $("#btn-speed").textContent = `속도 ${ui.speed}배`;
  $("#btn-threat").setAttribute("aria-pressed", String(ui.threat));
  refreshThreat();
}

/** 적이 다음 턴에 공격할 수 있는 내 기물 */
function threatenedIds(s) {
  const out = new Set();
  for (const e of alive(s, "enemy")) {
    if (e.frozen > 0) continue;
    for (const a of attackTargets(s, e)) for (const id of a.hits) out.add(id);
  }
  return out;
}
function refreshThreat() {
  if (!view) return;
  view.threat = ui.threat && battle && (phase === "player" || phase === "busy") ? threatenedIds(battle) : new Set();
}

/** 행동을 복제 상태에 미리 적용해서 결과를 보여줘요 */
function showPreview(act) {
  if (!view) return;
  if (!act || !battle) return (view.preview = null);
  const sim = clone(battle);
  const evs = resolve(sim, act);
  const map = new Map();
  const at = (id) => (map.has(id) ? map.get(id) : map.set(id, { dmg: 0, absorbed: 0, heal: 0 }).get(id));
  for (const e of evs) {
    if (e.t === "hit") (at(e.id).dmg += e.dmg), (at(e.id).absorbed += e.absorbed ?? 0);
    else if (e.t === "death") at(e.id).kill = true;
    else if (e.t === "revive") at(e.id).revive = true;
    else if (e.t === "heal") at(e.id).heal += e.amount;
    else if (e.t === "poisoned") at(e.id).poison = true;
    else if (e.t === "freeze") at(e.id).freeze = true;
    else if (e.t === "shield") at(e.id).shield = true;
  }
  let danger = null;
  if (act.kind === "move" || act.ability === "swap") {
    const me = byId(sim, act.id);
    if (me && threatenedIds(sim).has(me.id)) danger = { x: me.x, y: me.y };
  }
  view.preview = map.size || danger ? { map, danger } : null;
}

function onHover(c) {
  if (phase !== "player" || selected == null || !$("#action-menu").hidden) return;
  const me = byId(battle, selected);
  if (!c || !me) return showPreview(null);
  const opts = optionsAt(battle, me, c.x, c.y);
  const pick = opts.find((o) => o.kind === "attack") ?? opts.find((o) => o.kind === "ability") ?? opts[0];
  showPreview(pick ? { ...pick, id: me.id } : null);
}

export function bindBattle(go) {
  goHome = () => go("home");
  defeatHome = () => go("home", "defeat");
  $("#btn-retreat").addEventListener("click", async () => {
    if (phase === "over") return;
    const ok = await modal([h("h3", {}, "귀환하시겠습니까?"), h("p", {}, "지금까지 번 골드는 그대로 남습니다. 이번 출전은 여기서 끝납니다.")], [
      { label: "귀환", value: true, cls: "btn-main" },
      { label: "계속 싸우기", value: false },
    ]);
    if (ok) finishRun("retreat");
  });
  $("#btn-pass").addEventListener("click", () => {
    if (phase !== "player") return;
    closeMenu();
    log("ally", "턴을 넘겼습니다.");
    afterAction();
  });
  $("#btn-next-wave").addEventListener("click", () => {
    if (phase !== "arrange") return;
    $("#btn-next-wave").hidden = true;
    run.wave++;
    startWave();
  });
  $("#btn-speed").addEventListener("click", () => {
    ui.speed = ui.speed >= 3 ? 1 : ui.speed + 1;
    saveUi();
    applyUi();
  });
  $("#btn-threat").addEventListener("click", () => {
    ui.threat = !ui.threat;
    saveUi();
    applyUi();
  });
  applyUi();
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
      deselect();
    }
    if ($("#battle").hidden || e.target.closest?.("input")) return;
    if (e.key === "t" || e.key === "T" || e.key === "ㅅ") $("#btn-threat").click();
    if (e.key === "s" || e.key === "S" || e.key === "ㄴ") $("#btn-speed").click();
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
    const lv = o.lv ?? 1, b = levelBonus(o.key, lv);
    units.push({ id: id++, uid, key: o.key, lv, slot: Number(slot), hp: def.hp + b.hp, maxHp: def.hp + b.hp, atk: def.atk + b.atk, summon: false, kills: 0 });
  }
  if (!units.some((u) => u.key === "king")) return false;
  run = { wave: 1, seed: (Date.now() & 0xffffff) | 1, units, gold: 0, kills: 0, bossKills: 0, lost: 0 };
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
  view.onHover = onHover;
  applyUi();
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
    u.reborn = !!r.reborn;
    u.lv = r.lv ?? 1;
    if (hasP(u, "barrier")) u.shield = 2; // 결계: 웨이브마다 보호막
  }
  const spec = makeWave(run.wave, run.seed);
  const enemies = spec.map((s) => {
    const u = makeUnit(battle, s.key, "enemy", s.x, s.y);
    scaleUnit(u, battle, "enemy");
    applyLevel(u, s.lv ?? 1);
    return u;
  });
  // 아군은 그대로, 적은 위에서 떨어지며 등장
  view.sync({ units: battle.units.filter((u) => u.team === "ally") }, { snap: true });
  $("#wave-tag").textContent = `웨이브 ${run.wave}`;
  setTurnTag("enemy", "적이 나타납니다");
  await idle();
  const bossWave = run.wave % 5 === 0;
  music(bossWave ? "boss" : "battle");
  setBackdrop(bossWave ? "boss" : "battle");
  jingle(bossWave ? "boss" : "waveStart");
  await banner(`웨이브 ${run.wave}`, run.wave % 5 === 0 ? "마왕이 옵니다!" : `적 ${enemies.length}기`);
  enemies.sort((a, b) => a.y - b.y || Math.abs(a.x - 3.5) - Math.abs(b.x - 3.5));
  await Promise.all(enemies.map((u, i) => dropIn(u, i * 0.06)));
  log("sys", `웨이브 ${run.wave} 시작. 적 ${enemies.length}기.`);
  markSeen(enemies.map((u) => u.key));
  refreshPanels();
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
  view.sound(u.key === "demon" ? "boom" : "landHeavy", vp.x, { vol: 0.6, gap: 30 });
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
    toast("움직일 수 있는 기물이 없어 턴을 넘깁니다.");
    log("ally", "움직일 수 있는 기물이 없습니다.");
    return afterAction();
  }
  phase = "player";
  setTurnTag("ally", battle.extraTurn ? "한 번 더!" : "나의 차례");
  refreshThreat();
  $("#btn-pass").disabled = false;
}

async function enemyTurn() {
  phase = "busy";
  setTurnTag("enemy", "적의 차례");
  sfx("turn", { vol: 0.5 });
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
  log("enemy", "적이 숨을 고르고 있습니다.");
  afterAction();
}

async function perform(act) {
  phase = "busy";
  view.preview = null;
  const u = byId(battle, act.id);
  const names = new Map(battle.units.map((x) => [x.id, nameOf(x)]));
  const evs = resolve(battle, act);
  narrate(u, act, evs, names);
  payKills(evs);
  await view.play(evs);
  view.sync(battle);
  refreshCard();
  refreshPanels();
  afterAction();
}

async function afterAction() {
  if (battle.over === "lose") return finishRun("lose");
  if (battle.over === "win") return waveClear();
  const evs = endTurn(battle);
  if (evs.length) {
    await view.play(evs);
    view.sync(battle);
    markSeen(evs.filter((e) => e.t === "spawn").map((e) => e.unit.key));
    payKills(evs);
    refreshPanels();
    if (battle.over === "lose") return finishRun("lose");
    if (battle.over === "win") return waveClear();
  }
  if (battle.turn === "enemy") enemyTurn();
  else playerTurn();
}

function payKills(evs) {
  const d = load();
  let got = 0;
  for (const e of evs) {
    if (e.t === "death" && e.team === "enemy") {
      got += killReward(e.key);
      run.kills++;
      if (e.key === "demon") run.bossKills++;
    }
    if (e.t === "death" && e.team === "ally" && e.key !== "skeleton") run.lost++;
    if (e.t === "spawn") markSeen([e.unit.key]);
  }
  if (got) {
    d.gold += got;
    run.gold += got;
    save();
    setTimeout(() => {
      setGold($("#battle-gold"), d.gold);
      sfx("coin", { vol: 0.6 });
    }, 450);
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
  jingle("victory");
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
    next.push({ id: u.id, key: u.key, slot, hp: Math.min(u.maxHp, u.hp + heal), maxHp: u.maxHp, atk: u.atk, summon: u.summon, kills: u.kills, reborn: u.reborn, lv: u.lv });
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
      if (u) Object.assign(u, { x: c.x, y: c.y, hp: r.hp, frozen: 0, cd: 0, poison: 0, shield: 0 });
      vp.frozen = false;
      vp.cd = 0;
    }),
  );
  refreshPanels();
  enterArrange();
}

function enterArrange() {
  phase = "arrange";
  selected = null;
  view.selected = null;
  view.zone = { y0: 6, y1: 7 };
  view.marks = { move: [], attack: [], ability: [], swap: [] };
  setTurnTag("ally", "재배치: 아래 두 줄 안에서 자리를 바꿀 수 있습니다");
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
    view.sound("select", vp.x, { vol: 0.6 });
  }
  showCard(u);
  if (!canAct(u)) {
    view.marks = { move: [], attack: [], ability: [], swap: [] };
    toast("얼어붙어서 이번 턴에는 움직일 수 없습니다.");
    return;
  }
  view.marks = { move: moveTargets(battle, u), attack: attackTargets(battle, u), ability: abilityTargets(battle, u), swap: [] };
}

function deselect() {
  selected = null;
  if (view) {
    view.selected = null;
    view.preview = null;
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
      onmouseenter: () => showPreview({ ...o, id: me.id }),
      onfocus: () => showPreview({ ...o, id: me.id }),
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
  sfx("open", { vol: 0.6 });
  const r = menu.getBoundingClientRect();
  let x = pos.x + pos.cell * 0.55, y = pos.y - pos.cell * 0.3;
  if (x + r.width > window.innerWidth - 8) x = pos.x - pos.cell * 0.55 - r.width;
  if (y + r.height > window.innerHeight - 8) y = window.innerHeight - 8 - r.height;
  menu.style.left = Math.max(8, x) + "px";
  menu.style.top = Math.max(8, y) + "px";
  menu.style.animation = "none";
  void menu.offsetWidth;
  menu.style.animation = "";
  showPreview({ ...(opts.find((o) => o.kind === "attack") ?? opts[0]), id: me.id });
  buttons[0].focus({ preventScroll: true });
}

function closeMenu() {
  $("#action-menu").hidden = true;
  if (view) view.preview = null;
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
    el.replaceChildren(h("p", { class: "muted" }, "기물을 누르면 정보가 나옵니다."));
    return;
  }
  const def = PIECES[u.key];
  const team = u.team === "ally" && u.summon ? "summon" : u.team;
  const status = [];
  if (u.frozen) status.push("빙결");
  if (u.poison) status.push(`중독 ${u.poison}턴`);
  if (u.shield) status.push(`보호막 ${u.shield}`);
  if (def.passive === "rebirth") status.push(u.reborn ? "환생 사용함" : "환생 준비");
  // (재사용 대기는 아래 능력 목록에 표시)
  if (u.atk > def.atk && u.team === "ally") status.push(`공격 +${u.atk - def.atk}`);
  el.replaceChildren(
    h("div", { class: "head" },
      h("div", { class: "pic" }, spriteCanvas(u.key, team, 2, u.lv)),
      h("div", {}, h("h4", {}, def.name, " ", rarityTag(u.key), " ", (u.lv ?? 1) > 1 ? lvBadge(u.lv) : ""), h("div", { class: "row" }, h("span", {}, u.team === "ally" ? (u.summon ? "소환된 아군" : "아군") : "적"), status.length ? h("span", {}, status.join(", ")) : null)),
    ),
    h("div", { class: "hpbar " + (u.team === "enemy" ? "enemy" : "") }, h("i", { style: `width:${(u.hp / u.maxHp) * 100}%` })),
    h("div", { class: "row" }, h("span", {}, "체력 ", h("b", {}, `${u.hp}/${u.maxHp}`)), h("span", {}, "공격 ", h("b", {}, u.atk)), h("span", {}, def.style === "ranged" ? "원거리" : "근접")),
    h("p", {}, def.desc),
    ...abilitiesAt(u.key, u.lv ?? 1).map((ab) => {
      const cd = Math.max(0, (u.cds?.[ab.id] ?? 0) - (battle.turn === u.team ? 0 : 1));
      return h("div", { class: "ab ability" + (cd ? " cooling" : "") }, h("b", {}, ab.name), cd ? ` (${cd}턴 뒤 사용 가능)` : ` (재사용 ${ab.cd}턴)`, `: ${ab.desc}`);
    }),
    (u.lv ?? 1) > 1 && LEVEL_TRAITS[u.key]
      ? h("div", { class: "ab lvtraits" }, h("b", {}, "레벨 특성 "), LEVEL_TRAITS[u.key].slice(0, u.lv - 1).map((t) => `${TRAITS[t].name}: ${TRAITS[t].desc}`).join(" "))
      : "",
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
      parts.push(`${names.get(e.id) ?? "상대"} -${e.dmg}${e.crit ? " (급습)" : e.exec ? " (처형)" : ""}`);
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
  recordRun({ wave: cleared, kills: run.kills, gold: run.gold, result: reason, bossKills: run.bossKills, lost: run.lost });
  d.best = Math.max(d.best ?? 0, cleared);
  save();
  if (reason === "lose") {
    music(null);
    await view.clock.wait(0.6);
    jingle("gameOver");
    await banner("킹이 쓰러졌습니다", "");
  }
  await modal(
    [
      h("h3", {}, reason === "retreat" ? "귀환했습니다" : "출전 종료"),
      h("p", {}, `클리어한 웨이브: ${cleared}`),
      h("p", {}, `쓰러뜨린 적: ${run.kills}기`),
      h("p", {}, `번 골드: ${run.gold}G`),
      h("p", { class: "muted" }, "번 골드로 상점에서 새 기물을 데려올 수 있습니다."),
    ],
    [{ label: "메인으로", value: true, cls: "btn-main" }],
  );
  battle = null;
  if (reason === "lose") defeatHome();
  else goHome();
}

// ── 왼쪽 현황 목록 + 웨이브 진행 막대 ────────────────────────────
function refreshPanels() {
  if (!battle || !run) return;
  refreshThreat();
  const list = (team) => {
    const units = battle.units.filter((u) => u.team === team && u.hp > 0).sort((a, b) => (b.key === "king") - (a.key === "king") || PIECES[b.key].price - PIECES[a.key].price);
    return units.map((u) => {
      const def = PIECES[u.key];
      const vteam = team === "ally" && u.summon ? "summon" : team;
      const li = h("li", { class: `${u.summon ? "summon" : ""} ${u.frozen ? "frozen" : ""}`, title: def.name },
        spriteCanvas(u.key, vteam, 1, u.lv),
        h("div", { class: "nm" }, h("span", {}, def.name), h("em", {}, `${u.hp}/${u.maxHp}`)),
        h("div", { class: "bar" }, h("i", { style: `width:${(u.hp / u.maxHp) * 100}%` })),
      );
      li.addEventListener("click", () => {
        if (phase === "player" && u.team === "ally" && byId(battle, u.id)) select(byId(battle, u.id));
        else showCard(u);
        const vp = view.vps.get(u.id);
        if (vp) vp.sq.kick(-6);
      });
      return li;
    });
  };
  const allies = list("ally"), enemies = list("enemy");
  $("#ally-list").replaceChildren(...allies);
  $("#enemy-list").replaceChildren(...(enemies.length ? enemies : [h("li", { class: "gone" }, h("span", {}, "남은 적이 없습니다"))]));
  $("#ally-count").textContent = `${allies.length}기`;
  $("#enemy-count").textContent = `${enemies.length}기`;
  // 진행 막대: 다섯 웨이브 묶음, 다섯 번째가 마왕
  const w = run.wave, base = Math.floor((w - 1) / 5) * 5;
  const pips = h("div", { class: "pips", "aria-hidden": "true" });
  for (let i = 1; i <= 5; i++) {
    const n = base + i;
    pips.append(h("i", { class: `${n < w ? "done" : n === w ? "now" : ""} ${i === 5 ? "boss" : ""}` }));
  }
  const toBoss = 5 - ((w - 1) % 5) - 1;
  $("#wave-strip").replaceChildren(
    pips,
    h("span", {}, "턴 ", h("b", {}, battle.turnNo ?? 1)),
    h("span", {}, toBoss === 0 ? h("b", {}, "마왕 웨이브!") : ["마왕까지 ", h("b", {}, `${toBoss}웨이브`)]),
    h("span", {}, "이번 출전 ", h("b", {}, `${run.kills}기 처치`), ", ", h("b", {}, `+${run.gold}G`)),
  );
}

// 자동 테스트용 도우미: 지금 할 수 있는 공격(없으면 전진)을 하나 알려줘요.
window.__cc = {
  phase: () => phase,
  threats: () => view?.threat?.size ?? 0,
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
