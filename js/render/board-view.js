// 보드 렌더러 + 전투 연출. 논리 해상도 288×292 픽셀, 화면 배율로 확대해서 그려요.
// 기물은 소수점 위치로 그려서 이동이 부드럽고, 이펙트는 pixelfx 프레임(색 + 빛 버퍼)을 합성해요.
import { createFrame, clearFrame, createFx } from "../../lib/pixelfx/core/index.js";
import { PIECES } from "../data/pieces.js";
import { sprite } from "./sprites.js";
import { Clock, Spring, E } from "./anim.js";
import * as FX from "../fx/effects.js";
import { sfx } from "../audio.js";

export const CELL = 32, BX = 16, BY = 22, W = 288, H = 292;
export const cellCX = (x) => BX + x * CELL + CELL / 2;
export const cellFeet = (y) => BY + y * CELL + 26;
const BODY = 10; // 발에서 몸 중심까지

const TILE_LIGHT = "#5f8a86", TILE_DARK = "#43676a";

let seedN = 1;

export class BoardView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.clock = new Clock();
    this.vps = new Map();
    this.fx = [];
    this.floats = [];
    this.shake = 0;
    this.punch = 0;
    this.marks = { move: [], attack: [], ability: [], swap: [] };
    this.selected = null;
    this.hover = null;
    this.zone = null; // 재배치 구역 표시 { y0, y1 }
    this.preview = null; // 행동 결과 미리보기: Map(id → { dmg, absorbed, kill, heal, revive, poison, freeze, shield }) + danger 칸
    this.threat = new Set(); // 적이 다음 턴에 칠 수 있는 내 기물 id
    this.onHover = null;
    this.onCell = null;
    this.frameBack = createFrame(W, H);
    this.frameFront = createFrame(W, H);
    this.layer = [mkLayer(), mkLayer()];
    this.lightLayer = [mkLayer(), mkLayer()];
    this.boardTex = this.paintBoard();
    this.k = 2;
    this.last = performance.now();
    this.running = true;
    this.bindInput();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((t) => this.tick(t));
  }

  /** 위치(x: 논리 픽셀)에 맞춰 좌우로 패닝한 효과음 */
  sound(key, x = W / 2, opts = {}) {
    if (this.quiet) return;
    sfx(key, { x: x / W, ...opts });
  }

  pause() {
    this.running = false;
  }
  resume() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  // ── 크기 ──────────────────────────────────────────────────────
  resize() {
    const host = this.canvas.parentElement;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const css = Math.max(0.8, Math.min(r.width / W, (r.height || r.width) / H));
    const dpr = window.devicePixelRatio || 1;
    this.css = css;
    this.k = Math.max(1, Math.round(css * dpr));
    this.canvas.width = W * this.k;
    this.canvas.height = H * this.k;
    this.canvas.style.width = W * css + "px";
    this.canvas.style.height = H * css + "px";
  }

  bindInput() {
    const toCell = (e) => {
      const r = this.canvas.getBoundingClientRect();
      const lx = ((e.clientX - r.left) / r.width) * W, ly = ((e.clientY - r.top) / r.height) * H;
      const x = Math.floor((lx - BX) / CELL), y = Math.floor((ly - BY) / CELL);
      return x >= 0 && y >= 0 && x < 8 && y < 8 ? { x, y } : null;
    };
    this.canvas.addEventListener("pointermove", (e) => {
      const c = toCell(e);
      const changed = (c?.x ?? -1) !== (this.hover?.x ?? -1) || (c?.y ?? -1) !== (this.hover?.y ?? -1);
      this.hover = c;
      if (changed) this.onHover?.(c);
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hover = null;
      this.onHover?.(null);
    });
    this.canvas.addEventListener("click", (e) => {
      const c = toCell(e);
      this.onCell?.(c, e);
    });
  }

  /** 칸 중심의 화면 좌표 (메뉴 띄우기용) */
  cellToClient(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (cellCX(x) / W) * r.width, y: r.top + ((BY + y * CELL + CELL / 2) / H) * r.height, cell: (CELL / W) * r.width };
  }

  // ── 기물 시각 객체 ────────────────────────────────────────────
  vpTeam(u) {
    return u.team === "ally" && u.summon ? "summon" : u.team;
  }
  addVp(u, opts = {}) {
    const vp = {
      id: u.id, key: u.key, team: this.vpTeam(u), cx: u.x, cy: u.y,
      x: cellCX(u.x), y: cellFeet(u.y), z: 0,
      sq: new Spring(1, 520, 13), ox: new Spring(0, 300, 12), oy: new Spring(0, 300, 12),
      flash: 0, alpha: opts.alpha ?? 1, scale: opts.scale ?? 1, tilt: 0,
      hp: u.hp, maxHp: u.maxHp, ghost: u.hp, ghostDelay: 0, frozen: u.frozen > 0, cd: u.cd,
      shield: u.shield ?? 0, poison: u.poison ?? 0, lv: u.lv ?? 1,
      bob: Math.random() * 10,
    };
    this.vps.set(u.id, vp);
    return vp;
  }
  /** 상태와 시각 객체를 맞춰요 (연출 없이) */
  sync(state, { snap = false } = {}) {
    const seen = new Set();
    for (const u of state.units) {
      if (u.hp <= 0) continue;
      seen.add(u.id);
      let vp = this.vps.get(u.id);
      if (!vp) vp = this.addVp(u);
      vp.key = u.key;
      vp.team = this.vpTeam(u);
      vp.hp = u.hp;
      vp.maxHp = u.maxHp;
      vp.frozen = u.frozen > 0;
      vp.cd = u.cd;
      vp.shield = u.shield ?? 0;
      vp.poison = u.poison ?? 0;
      vp.lv = u.lv ?? 1;
      if (snap) {
        vp.ghost = u.hp;
        vp.cx = u.x;
        vp.cy = u.y;
        vp.x = cellCX(u.x);
        vp.y = cellFeet(u.y);
        vp.z = 0;
      }
    }
    for (const id of [...this.vps.keys()]) if (!seen.has(id)) this.vps.delete(id);
  }

  // ── 이펙트 ────────────────────────────────────────────────────
  spawnFx(mod, opts) {
    const fx = createFx(mod, { seed: seedN++, ...opts });
    this.fx.push(fx);
    return fx;
  }
  float(text, x, y, color, { big = false, delay = 0 } = {}) {
    this.floats.push({ text, x, y, color, big, t: -delay });
  }
  kickShake(a) {
    this.shake = Math.min(6, this.shake + a);
  }

  // ── 연출 기본기 ───────────────────────────────────────────────
  async hop(vp, toX, toY, { height = 8, dur = 0.26, style = "hop", silent = false } = {}) {
    const c = this.clock;
    const x0 = vp.x, y0 = vp.y;
    // 예비 동작: 꾹 눌렸다가
    vp.sq.kick(-6);
    await c.wait(0.07);
    if (style === "blink") {
      if (!silent) this.sound("blink", x0);
      this.spawnFx(FX.impact, { x: x0, y: y0 - BODY, kind: "storm", palette: FX.PALS.time, size: 0.6 });
      await c.tween(0.1, (u) => ((vp.scale = 1 - u), (vp.alpha = 1 - u)), E.inQuad);
      vp.x = toX;
      vp.y = toY;
      this.spawnFx(FX.impact, { x: toX, y: toY - BODY, kind: "storm", palette: FX.PALS.time, size: 0.6 });
      await c.tween(0.16, (u) => ((vp.scale = u), (vp.alpha = u)), E.outBackBig);
      vp.sq.kick(8);
      return;
    }
    vp.sq.kick(10); // 쭉 늘어나며 출발
    await c.tween(dur, (u) => {
      vp.x = x0 + (toX - x0) * E.inOutCubic(u);
      vp.y = y0 + (toY - y0) * E.inOutCubic(u);
      vp.z = Math.sin(u * Math.PI) * height;
      vp.tilt = Math.sin(u * Math.PI) * Math.sign(toX - x0) * 0.12;
    });
    vp.z = 0;
    vp.tilt = 0;
    // 착지: 납작 → 출렁
    vp.sq.v = 1.32;
    vp.sq.vel = 0;
    this.spawnFx(FX.dust, { x: toX, y: toY, power: Math.min(1.6, 0.6 + height / 14) });
    if (!silent) this.sound(height >= 14 ? "landHeavy" : "land", toX, { vol: Math.min(1, 0.55 + height / 30) });
    this.kickShake(0.6 + height / 20);
  }

  async moveTo(vp, cx, cy, style) {
    const dist = Math.hypot(cx - vp.cx, cy - vp.cy);
    vp.cx = cx;
    vp.cy = cy;
    const leap = style === "leap";
    await this.hop(vp, cellCX(cx), cellFeet(cy), {
      height: leap ? 18 : style === "advance" ? 6 : 5 + dist * 2.2,
      dur: Math.min(0.5, 0.18 + dist * 0.05 + (leap ? 0.08 : 0)),
      style,
    });
  }

  /** 근접 공격 예비동작 + 돌진. 맞는 순간에 resolve. 회복 Promise 를 돌려줘요. */
  async lunge(vp, tx, ty) {
    const c = this.clock, x0 = vp.x, y0 = vp.y;
    const dx = tx - x0, dy = ty - y0, L = Math.hypot(dx, dy) || 1, nx = dx / L, ny = dy / L;
    const back = 5, reach = Math.min(L * 0.55, L - 10);
    // 뒤로 젖히며 움츠림
    vp.sq.kick(-5);
    await c.tween(0.13, (u) => {
      vp.x = x0 - nx * back * u;
      vp.y = y0 - ny * back * u;
      vp.z = u * 3;
    }, E.outQuad);
    // 확 튀어나감
    vp.sq.kick(14);
    this.sound("whoosh", x0, { vol: 0.45 });
    await c.tween(0.075, (u) => {
      vp.x = x0 + nx * (-back + (reach + back) * u);
      vp.y = y0 + ny * (-back + (reach + back) * u);
      vp.z = 3 * (1 - u);
    }, E.inQuad);
    vp.z = 0;
    return () =>
      c.tween(0.24, (u) => {
        vp.x = x0 + nx * reach * (1 - u);
        vp.y = y0 + ny * reach * (1 - u);
      }, E.outBack);
  }

  /** 원거리: 뒤로 반동 */
  async recoil(vp, tx, ty) {
    const c = this.clock, x0 = vp.x, y0 = vp.y;
    const dx = tx - x0, dy = ty - y0, L = Math.hypot(dx, dy) || 1;
    vp.sq.kick(-7);
    await c.tween(0.12, (u) => (vp.z = u * 4), E.outQuad);
    vp.sq.kick(12);
    vp.ox.kick((-dx / L) * 90);
    vp.oy.kick((-dy / L) * 90);
    vp.z = 0;
  }

  hitVp(ev, from) {
    const vp = this.vps.get(ev.id);
    if (!vp) return;
    vp.flash = 1;
    vp.sq.v = 1.25;
    vp.sq.vel = -4;
    if (from) {
      const dx = vp.x - from.x, dy = vp.y - from.y, L = Math.hypot(dx, dy) || 1;
      const p = 70 + ev.dmg * 30;
      vp.ox.kick((dx / L) * p);
      vp.oy.kick((dy / L) * p * 0.6);
    }
    vp.hp = ev.hp;
    vp.shield = ev.shield ?? vp.shield;
    vp.ghostDelay = 0.35;
    if (ev.poison) {
      this.sound("shadowHit", vp.x, { vol: 0.5 });
      this.spawnFx(FX.impact, { x: vp.x, y: vp.y - BODY, kind: "poison", palette: FX.PALS.poison, size: 0.6 });
    } else this.sound(ev.crit || ev.dmg >= 4 ? "hitHeavy" : "hit", vp.x, { vol: ev.splash ? 0.5 : 0.8 });
    if (ev.guard || ev.stone) this.sound("metal", vp.x, { vol: 0.6, delay: 0.03 });
    if (ev.absorbed) {
      this.sound("metal", vp.x, { vol: 0.7 });
      this.float(`막음 ${ev.absorbed}`, vp.x - 8, vp.y - 34, "#ffe9a0", { delay: 0.05 });
    }
    const col = ev.poison ? "#9dff5a" : ev.crit ? "#ffe45c" : vp.team === "enemy" ? "#ffffff" : "#ff8a8a";
    if (ev.dmg > 0 || !ev.absorbed) this.float(String(ev.dmg), vp.x, vp.y - 24, col, { big: ev.crit || ev.dmg >= 4 });
    if (ev.counter) this.float("반격", vp.x + 8, vp.y - 34, "#ffd47a", { delay: 0.08 });
    if (ev.thorns) this.float("가시", vp.x + 8, vp.y - 34, "#b8ff8a", { delay: 0.05 });
    if (ev.exec) this.float("처형!", vp.x, vp.y - 36, "#ff7a7a", { big: true, delay: 0.05 });
    if (ev.crit) this.float("급습!", vp.x, vp.y - 34, "#ffe45c", { delay: 0.05 });
    if (ev.guard) this.float("수호", vp.x + 10, vp.y - 14, "#b9c4d6", { delay: 0.1 });
    this.kickShake(0.8 + ev.dmg * 0.5 + (ev.crit ? 1.5 : 0));
    this.clock.hitstop(Math.min(0.15, 0.05 + ev.dmg * 0.022 + (ev.crit ? 0.04 : 0)));
  }

  async die(ev) {
    const vp = this.vps.get(ev.id);
    if (!vp) return;
    const c = this.clock;
    vp.flash = 1;
    await c.tween(0.09, (u) => (vp.scale = 1 + 0.25 * u), E.outQuad);
    const sp = sprite(vp.key, vp.team, vp.lv);
    this.sound("death", vp.x);
    this.spawnFx(FX.shatter, { x: vp.x + vp.ox.v, y: vp.y + vp.oy.v, pixels: sp.pixels, dir: Math.sign(vp.ox.v || 1) });
    this.vps.delete(ev.id);
    this.kickShake(2);
  }

  async appear(unit, fxKind) {
    const palette = fxKind === "hellgate" ? FX.PALS.hell : FX.PALS.shadow;
    const x = cellCX(unit.x), y = cellFeet(unit.y);
    this.spawnFx(FX.summon, { x, y, palette });
    this.sound(fxKind === "hellgate" ? "hellgate" : "summon", x);
    await this.clock.wait(0.42);
    const vp = this.addVp(unit, { alpha: 0, scale: 0.2 });
    vp.z = 10;
    await this.clock.tween(0.22, (u) => {
      vp.alpha = Math.min(1, u * 2);
      vp.scale = 0.2 + 0.8 * u;
      vp.z = 10 * (1 - u);
    }, E.outBackBig);
    vp.sq.v = 1.35;
    this.spawnFx(FX.dust, { x, y, power: 0.8 });
  }

  // ── 이벤트 재생 ───────────────────────────────────────────────
  async play(events) {
    const c = this.clock;
    let recover = null;
    let attacker = null;
    const flushRecover = async () => {
      if (recover) {
        await recover();
        recover = null;
      }
    };
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.t) {
        case "move": {
          await flushRecover();
          const vp = this.vps.get(ev.id);
          if (vp) await this.moveTo(vp, ev.to.x, ev.to.y, ev.style);
          break;
        }
        case "attack": {
          await flushRecover();
          attacker = this.vps.get(ev.id);
          recover = await this.attackAnim(ev, events, i);
          break;
        }
        case "ability": {
          await flushRecover();
          attacker = this.vps.get(ev.id);
          recover = await this.abilityAnim(ev);
          break;
        }
        case "chain":
          break; // attackAnim 에서 처리
        case "hit": {
          const delay = ev.chain ? 0.12 : 0;
          if (delay) await c.wait(delay);
          this.hitVp(ev, attacker);
          break;
        }
        case "death":
          await c.wait(0.12);
          await this.die(ev);
          break;
        case "heal": {
          const vp = this.vps.get(ev.id);
          if (!vp) break;
          vp.hp = ev.hp;
          vp.ghost = Math.min(vp.ghost, ev.hp);
          vp.sq.kick(6);
          this.spawnFx(FX.healFx, { x: vp.x, y: vp.y });
          this.sound("heal", vp.x, { vol: ev.regen ? 0.35 : 0.7 });
          this.float(ev.regen ? `재생 +${ev.amount}` : "+" + ev.amount, vp.x, vp.y - 24, "#9dff7a");
          break;
        }
        case "freeze": {
          const vp = this.vps.get(ev.id);
          if (!vp) break;
          vp.frozen = true;
          this.spawnFx(FX.freeze, { x: vp.x, y: vp.y });
          this.sound("freeze", vp.x);
          this.float("빙결", vp.x, vp.y - 34, "#bff0ff", { delay: 0.1 });
          break;
        }
        case "buff": {
          const vp = this.vps.get(ev.id);
          if (vp) this.float("공격 " + ev.atk, vp.x, vp.y - 34, "#ff6a5a", { delay: 0.2 });
          break;
        }
        case "promote": {
          await flushRecover();
          const vp = this.vps.get(ev.id);
          if (!vp) break;
          this.spawnFx(FX.promote, { x: vp.x, y: vp.y });
          this.sound("promote", vp.x);
          await c.wait(0.3);
          vp.key = ev.key;
          vp.hp = ev.hp;
          vp.maxHp = ev.maxHp;
          vp.ghost = ev.hp;
          vp.sq.v = 0.7;
          vp.flash = 1;
          this.float("승급!", vp.x, vp.y - 36, "#ffe07a", { big: true });
          await c.wait(0.35);
          break;
        }
        case "spawn":
          await flushRecover();
          await this.appear(ev.unit, ev.fx);
          break;
        case "poisoned": {
          const vp = this.vps.get(ev.id);
          if (!vp) break;
          vp.poison = 3;
          this.spawnFx(FX.impact, { x: vp.x, y: vp.y - BODY, kind: "poison", palette: FX.PALS.poison, size: 0.7 });
          this.float("중독", vp.x, vp.y - 34, "#9dff5a", { delay: 0.1 });
          break;
        }
        case "shield": {
          const vp = this.vps.get(ev.id);
          if (!vp) break;
          vp.shield = ev.shield;
          vp.sq.kick(8);
          this.spawnFx(FX.freeze, { x: vp.x, y: vp.y, palette: FX.PALS.holy });
          this.sound("promote", vp.x, { vol: 0.7 });
          this.float("보호막", vp.x, vp.y - 34, "#ffe9a0");
          await c.wait(0.25);
          break;
        }
        case "revive": {
          const vp = this.vps.get(ev.id);
          if (!vp) break;
          await c.wait(0.2);
          this.spawnFx(FX.promote, { x: vp.x, y: vp.y, palette: FX.PALS.fire });
          this.spawnFx(FX.impact, { x: vp.x, y: vp.y - BODY, kind: "fire", palette: FX.PALS.fire, size: 1.2 });
          this.sound("fire", vp.x);
          this.sound("promote", vp.x, { delay: 0.1 });
          vp.hp = ev.hp;
          vp.ghost = ev.hp;
          vp.flash = 1;
          vp.sq.v = 0.6;
          this.float("환생!", vp.x, vp.y - 36, "#ffb347", { big: true });
          await c.wait(0.45);
          break;
        }
        case "explode": {
          const x = cellCX(ev.x), y = cellFeet(ev.y);
          this.spawnFx(FX.blast, { x, y: y - BODY });
          this.sound("boom", x);
          this.sound("burn", x, { delay: 0.05 });
          this.kickShake(4);
          this.punch = 0.8;
          this.clock.hitstop(0.08);
          await c.wait(0.12);
          break;
        }
        case "swap": {
          await flushRecover();
          const a = this.vps.get(ev.a), b = this.vps.get(ev.b);
          await Promise.all([a && this.moveTo(a, ev.pb.x, ev.pb.y, "blink"), b && this.moveTo(b, ev.pa.x, ev.pa.y, "blink")]);
          break;
        }
        case "haste": {
          const vp = this.vps.get(ev.id);
          if (vp) this.float("한 번 더!", vp.x, vp.y - 36, "#7af2c8", { big: true, delay: 0.3 });
          break;
        }
      }
    }
    await flushRecover();
    await c.wait(0.12);
  }

  async attackAnim(ev, events, idx) {
    const c = this.clock, vp = this.vps.get(ev.id);
    if (!vp) return null;
    const tx = cellCX(ev.cell.x), ty = cellFeet(ev.cell.y);
    const fx = ev.fx;
    const ang = Math.atan2(ty - vp.y, tx - vp.x);
    const targets = ev.targets.map((id) => this.vps.get(id)).filter(Boolean);
    const far = targets.reduce((m, t) => Math.max(m, Math.hypot(t.x - vp.x, t.y - vp.y)), 0);

    const MELEE = {
      jab: { style: "arc", palette: FX.PALS.gold, size: 0.75 },
      hoof: { style: "ring", palette: FX.PALS.gold, size: 1 },
      lightcut: { style: "line", palette: FX.PALS.holy, size: 1 },
      crush: { style: "slam", palette: FX.PALS.steel, size: 1.1 },
      crossCut: { style: "cross", palette: FX.PALS.gold, size: 1 },
      royal: { style: "arc", palette: FX.PALS.holy, size: 1.2 },
      bash: { style: "ring", palette: FX.PALS.steel, size: 0.9 },
      daggers: { style: "triple", palette: FX.PALS.steel, size: 1 },
      cleave: { style: "arc", palette: FX.PALS.blood, size: 1.35 },
      bone: { style: "claw", palette: FX.PALS.bone, size: 0.9 },
      claw: { style: "claw", palette: FX.PALS.blood, size: 0.9 },
      palm: { style: "ring", palette: FX.PALS.holy, size: 1.1 },
      voidcut: { style: "cross", palette: FX.PALS.shadow, size: 1.1 },
      fang: { style: "claw", palette: FX.PALS.blood, size: 1.1 },
      warcleave: { style: "arc", palette: FX.PALS.gold, size: 1.45 },
    };
    const PROJ = {
      arrow: { kind: "arrow", palette: FX.PALS.steel, impact: "spark", ipal: FX.PALS.steel, speed: 520, sLaunch: "draw", sHit: "thunk" },
      ember: { kind: "ember", palette: FX.PALS.fire, impact: "fire", ipal: FX.PALS.fire, speed: 300, sLaunch: "fire", sHit: "burn" },
      frost: { kind: "frost", palette: FX.PALS.ice, impact: "ice", ipal: FX.PALS.ice, speed: 300, sLaunch: "ice", sHit: "shatterIce" },
      shadow: { kind: "shadow", palette: FX.PALS.shadow, impact: "shadow", ipal: FX.PALS.shadow, speed: 260, sLaunch: "shadow", sHit: "shadowHit" },
      tick: { kind: "shadow", palette: FX.PALS.time, impact: "storm", ipal: FX.PALS.time, speed: 360, sLaunch: "tick", sHit: "laser" },
      sling: { kind: "stone", palette: FX.PALS.stone, impact: "spark", ipal: FX.PALS.stone, speed: 260, size: 0.7, sLaunch: "whoosh", sHit: "thunk" },
      venom: { kind: "poison", palette: FX.PALS.poison, impact: "poison", ipal: FX.PALS.poison, speed: 260, sLaunch: "shadow", sHit: "shadowHit" },
      cannon: { kind: "cannon", palette: FX.PALS.stone, impact: "fire", ipal: FX.PALS.fire, speed: 300, size: 1.3, sLaunch: "boom", sHit: "burn" },
      bomb: { kind: "bomb", palette: FX.PALS.fire, impact: "fire", ipal: FX.PALS.fire, speed: 220, sLaunch: "whoosh", sHit: "burn" },
      mirage: { kind: "shadow", palette: FX.PALS.arcane, impact: "shadow", ipal: FX.PALS.arcane, speed: 280, sLaunch: "shadow", sHit: "shadowHit" },
      arcane: { kind: "arcane", palette: FX.PALS.arcane, impact: "storm", ipal: FX.PALS.arcane, speed: 340, sLaunch: "laser", sHit: "zap" },
      flame: { kind: "ember", palette: FX.PALS.fire, impact: "fire", ipal: FX.PALS.fire, speed: 320, size: 1.1, sLaunch: "fire", sHit: "burn" },
      hellfire: { kind: "hell", palette: FX.PALS.hell, impact: "hell", ipal: FX.PALS.hell, speed: 240, size: 1.3, sLaunch: "fire", sHit: "burn" },
    };

    if (MELEE[fx]) {
      const m = MELEE[fx];
      const rec = await this.lunge(vp, tx, ty);
      const MSFX = { crush: "crush", hoof: "landHeavy", bash: "metal", cleave: "chop", daggers: "draw", palm: "hitHeavy", warcleave: "chop", fang: "slash", voidcut: "slash" };
      this.sound(MSFX[fx] ?? "slash", tx);
      const lvl = vp.lv ?? 1;
      for (const t of targets) {
        this.spawnFx(FX.strike, { x: t.x, y: t.y - BODY, angle: ang, style: m.style, palette: lvl >= 3 ? FX.PALS.holy : m.palette, size: m.size * (lvl >= 3 ? 1.25 : lvl >= 2 ? 1.1 : 1) });
        if (lvl >= 2) this.spawnFx(FX.levelBurst, { x: t.x, y: t.y - BODY, tier: lvl });
      }
      if (lvl >= 3) this.sound("smite", tx, { vol: 0.35, rate: 1.6 });
      return rec;
    }
    if (PROJ[fx]) {
      const p = PROJ[fx];
      await this.recoil(vp, tx, ty);
      const sx = vp.x, sy = vp.y - BODY - 2, dx = tx - sx, dy = ty - BODY - sy;
      const time = Math.max(0.12, Math.hypot(dx, dy) / p.speed);
      this.spawnFx(FX.projectile, { x: sx, y: sy, dx, dy, kind: p.kind, palette: p.palette, time });
      this.sound(p.sLaunch, sx, { vol: 0.7 });
      await c.wait(time);
      this.sound(p.sHit, tx);
      if (fx === "cannon") (this.kickShake(3), (this.punch = 0.6));
      for (const t of targets) {
        this.spawnFx(FX.impact, { x: t.x, y: t.y - BODY, kind: p.impact, palette: p.ipal, size: (p.size ?? 1) * ((vp.lv ?? 1) >= 3 ? 1.2 : 1) });
        if ((vp.lv ?? 1) >= 2) this.spawnFx(FX.levelBurst, { x: t.x, y: t.y - BODY, tier: vp.lv });
      }
      return null;
    }
    if (fx === "thrust") {
      await this.recoil(vp, tx, ty);
      vp.ox.kick(Math.cos(ang) * 260);
      vp.oy.kick(Math.sin(ang) * 260);
      this.spawnFx(FX.thrust, { x: vp.x, y: vp.y - BODY, angle: ang, len: far - 4 });
      this.sound("draw", vp.x);
      await c.wait(0.09);
      return null;
    }
    if (fx === "breath") {
      vp.sq.kick(-8);
      await c.tween(0.25, (u) => (vp.z = u * 5), E.outQuad);
      vp.sq.kick(14);
      vp.ox.kick(-Math.cos(ang) * 120);
      vp.z = 0;
      this.sound("breath", vp.x);
      this.spawnFx(FX.breath, { x: vp.x + Math.cos(ang) * 6, y: vp.y - BODY - 4 + Math.sin(ang) * 6, angle: ang, len: far + 10 });
      this.kickShake(2.5);
      await c.wait(0.22);
      return null;
    }
    if (fx === "chain") {
      await this.recoil(vp, tx, ty);
      const chainEv = events.slice(idx + 1).find((e) => e.t === "chain");
      const pts = [[0, 0]];
      if (chainEv)
        for (const p of chainEv.path) {
          const t = this.vps.get(p.id);
          if (t) pts.push([t.x - vp.x, t.y - BODY - (vp.y - BODY - 4)]);
        }
      this.spawnFx(FX.chain, { x: vp.x, y: vp.y - BODY - 4, path: pts });
      this.sound("zap", vp.x);
      this.sound("laser", tx, { delay: 0.12, vol: 0.6 });
      return null;
    }
    // 알 수 없는 fx → 기본 근접
    return this.lunge(vp, tx, ty);
  }

  async abilityAnim(ev) {
    const c = this.clock, vp = this.vps.get(ev.id);
    if (!vp) return null;
    const tx = cellCX(ev.cell.x), ty = cellFeet(ev.cell.y);
    // 시전: 살짝 떠올랐다 내려오며 기를 모음
    vp.sq.kick(-6);
    await c.tween(0.18, (u) => (vp.z = Math.sin(u * Math.PI * 0.5) * 6), E.outQuad);
    vp.sq.kick(12);
    switch (ev.ability) {
      case "fireball": {
        const sx = vp.x, sy = vp.y - BODY - 8, dx = tx - sx, dy = ty - BODY - sy;
        const time = Math.max(0.2, Math.hypot(dx, dy) / 220);
        this.spawnFx(FX.projectile, { x: sx, y: sy, dx, dy, kind: "ember", palette: FX.PALS.fire, time });
        this.sound("fire", sx);
        await c.tween(time, (u) => (vp.z = 6 * (1 - u)));
        this.spawnFx(FX.blast, { x: tx, y: ty - BODY });
        this.sound("boom", tx);
        this.sound("burn", tx, { delay: 0.05 });
        this.kickShake(4);
        this.punch = 1;
        this.clock.hitstop(0.08);
        break;
      }
      case "heal":
        await c.tween(0.1, (u) => (vp.z = 6 * (1 - u)));
        break;
      case "raise":
        await c.tween(0.12, (u) => (vp.z = 6 * (1 - u)));
        break;
      case "haste":
        this.spawnFx(FX.warp, { x: vp.x, y: vp.y - BODY });
        this.sound("haste", vp.x);
        await c.tween(0.3, (u) => (vp.z = 6 * (1 - u)), E.outBack);
        this.float("시간 가속", vp.x, vp.y - 28, "#7af2c8");
        break;
      case "meteor": {
        const sx = tx - 70, sy = ty - 170, time = 0.5;
        this.spawnFx(FX.projectile, { x: sx, y: sy, dx: tx - sx, dy: ty - BODY - sy, kind: "ember", palette: FX.PALS.arcane, time });
        this.sound("fire", tx, { rate: 0.7 });
        await c.tween(time, (u) => (vp.z = 6 * (1 - u)));
        this.spawnFx(FX.blast, { x: tx, y: ty - BODY, palette: FX.PALS.arcane });
        this.sound("boom", tx);
        this.sound("zap", tx, { delay: 0.05 });
        this.kickShake(5);
        this.punch = 1;
        this.clock.hitstop(0.1);
        break;
      }
      case "ward":
        await c.tween(0.12, (u) => (vp.z = 6 * (1 - u)));
        break;
      case "bats": {
        const sx = vp.x, sy = vp.y - BODY - 6, dx = tx - sx, dy = ty - BODY - sy;
        const time = Math.max(0.2, Math.hypot(dx, dy) / 240);
        for (let i = 0; i < 3; i++) this.spawnFx(FX.projectile, { x: sx + (i - 1) * 4, y: sy - i * 3, dx: dx - (i - 1) * 4, dy: dy + i * 3, kind: "shadow", palette: FX.PALS.blood, time: time + i * 0.05 });
        this.sound("shadow", sx);
        await c.tween(time, (u) => (vp.z = 6 * (1 - u)));
        this.sound("slash", tx);
        break;
      }
      case "swap":
        this.spawnFx(FX.warp, { x: vp.x, y: vp.y - BODY, palette: FX.PALS.arcane });
        this.sound("blink", vp.x);
        await c.tween(0.15, (u) => (vp.z = 6 * (1 - u)));
        break;
      case "smite":
        this.spawnFx(FX.smite, { x: tx, y: ty });
        this.sound("smite", tx, { delay: 0.12 });
        await c.tween(0.16, (u) => (vp.z = 6 * (1 - u)), E.inQuad);
        this.kickShake(3);
        this.punch = 0.8;
        break;
    }
    vp.z = 0;
    vp.sq.v = 1.25;
    return null;
  }

  // ── 그리기 ────────────────────────────────────────────────────
  paintBoard() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    // 테두리 (돌판 + 놋쇠 테)
    g.fillStyle = "#2b2236";
    g.fillRect(BX - 6, BY - 6, 8 * CELL + 12, 8 * CELL + 12);
    g.fillStyle = "#c99a4b";
    g.fillRect(BX - 3, BY - 3, 8 * CELL + 6, 8 * CELL + 6);
    g.fillStyle = "#6e4f25";
    g.fillRect(BX - 2, BY - 2, 8 * CELL + 4, 8 * CELL + 4);
    g.fillStyle = "#1b1424";
    g.fillRect(BX - 1, BY - 1, 8 * CELL + 2, 8 * CELL + 2);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const light = (x + y) % 2 === 0;
        g.fillStyle = light ? TILE_LIGHT : TILE_DARK;
        const px = BX + x * CELL, py = BY + y * CELL;
        g.fillRect(px, py, CELL, CELL);
        // 돌 질감: 위/왼쪽 밝은 테, 아래/오른쪽 그림자, 결정적인 얼룩
        g.fillStyle = light ? "#6f9c97" : "#4d7476";
        g.fillRect(px, py, CELL, 1);
        g.fillRect(px, py, 1, CELL);
        g.fillStyle = light ? "#507672" : "#385658";
        g.fillRect(px, py + CELL - 1, CELL, 1);
        g.fillRect(px + CELL - 1, py, 1, CELL);
        for (let i = 0; i < 6; i++) {
          const h = ((x * 73856093) ^ (y * 19349663) ^ (i * 83492791)) >>> 0;
          g.fillStyle = light ? "#6a958f" : "#3c5f61";
          g.fillRect(px + 3 + (h % 25), py + 3 + ((h >> 8) % 25), 2, 1);
        }
      }
    return c;
  }

  tick(now) {
    if (!this.running) return;
    const real = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const dt = this.clock.step(real);
    this.update(dt, real);
    this.draw();
    requestAnimationFrame((t) => this.tick(t));
  }

  update(dt, real) {
    for (const vp of this.vps.values()) {
      vp.sq.step(dt);
      vp.ox.step(dt);
      vp.oy.step(dt);
      vp.flash = Math.max(0, vp.flash - real * 7);
      vp.bob += dt;
      if (vp.ghostDelay > 0) vp.ghostDelay -= dt;
      else if (vp.ghost > vp.hp) vp.ghost = Math.max(vp.hp, vp.ghost - dt * Math.max(2, (vp.ghost - vp.hp) * 4));
      else vp.ghost = vp.hp;
    }
    for (const f of this.fx) f.update(dt);
    this.fx = this.fx.filter((f) => !f.done());
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < 0.95);
    this.shake = Math.max(0, this.shake - real * 14);
    this.punch = Math.max(0, this.punch - real * 5);
  }

  draw() {
    const g = this.ctx, k = this.k;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = (Math.random() * 2 - 1) * this.shake, sy = (Math.random() * 2 - 1) * this.shake;
    const z = 1 + this.punch * 0.025;
    g.setTransform(k * z, 0, 0, k * z, (sx - (W * (z - 1)) / 2) * k, (sy - (H * (z - 1)) / 2) * k);
    g.drawImage(this.boardTex, 0, 0);
    this.drawMarks(g);

    const hasFx = this.fx.length > 0;
    if (hasFx) {
      clearFrame(this.frameBack);
      clearFrame(this.frameFront);
      for (const f of this.fx) {
        f.draw(this.frameBack, "back");
        f.draw(this.frameFront, "front");
      }
      this.blit(g, this.frameBack, 0);
    }
    this.drawPieces(g);
    if (hasFx) this.blit(g, this.frameFront, 1);
    this.drawFloats(g);
    this.drawPreview(g);
  }

  drawPreview(g) {
    const pv = this.preview;
    if (!pv) return;
    const bob = Math.sin(performance.now() / 220) * 1.5;
    const label = (text, x, y, color) => {
      g.save();
      g.font = "9px Galmuri11, Galmuri9, monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const w = g.measureText(text).width + 6;
      g.fillStyle = "rgba(20, 14, 28, .88)";
      g.fillRect(Math.round(x - w / 2), Math.round(y - 6), Math.round(w), 12);
      g.fillStyle = color;
      g.fillRect(Math.round(x - w / 2), Math.round(y + 6), Math.round(w), 1);
      g.fillText(text, x, y + 0.5);
      g.restore();
    };
    for (const [id, p] of pv.map ?? []) {
      const vp = this.vps.get(id);
      if (!vp) continue;
      const x = vp.x + vp.ox.v, y = vp.y - 34 + bob;
      const bits = [];
      if (p.revive) bits.push(["환생", "#ffb347"]);
      else if (p.kill) bits.push(["처치!", "#ffe45c"]);
      else if (p.dmg > 0) bits.push([`-${p.dmg}`, "#ff6a6a"]);
      if (p.absorbed > 0) bits.push([`막음 ${p.absorbed}`, "#ffe9a0"]);
      if (p.heal > 0) bits.push([`+${p.heal}`, "#9dff7a"]);
      if (p.poison) bits.push(["중독", "#9dff5a"]);
      if (p.freeze) bits.push(["빙결", "#bff0ff"]);
      if (p.shield) bits.push(["보호막", "#ffe9a0"]);
      bits.forEach(([t, c], i) => label(t, x, y - i * 13, c));
    }
    if (pv.danger) label("위험", cellCX(pv.danger.x), BY + pv.danger.y * CELL + 4 + bob, "#ff5a5a");
  }

  blit(g, frame, i) {
    const L = this.layer[i], LL = this.lightLayer[i];
    L.u32.set(frame.color);
    L.g.putImageData(L.img, 0, 0);
    const src = frame.light, dst = LL.u32;
    let any = false;
    for (let j = 0; j < src.length; j++) {
      const v = src[j];
      dst[j] = v ? v | 0xff000000 : 0;
      if (v) any = true;
    }
    g.drawImage(L.c, 0, 0);
    if (any) {
      LL.g.putImageData(LL.img, 0, 0);
      g.globalCompositeOperation = "lighter";
      g.drawImage(LL.c, 0, 0);
      g.globalCompositeOperation = "source-over";
    }
  }

  drawMarks(g) {
    const t = this.clock.t + performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    if (this.zone) {
      g.fillStyle = "rgba(255, 214, 120, 0.10)";
      g.fillRect(BX, BY + this.zone.y0 * CELL, 8 * CELL, (this.zone.y1 - this.zone.y0 + 1) * CELL);
    }
    if (this.hover) {
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.fillRect(BX + this.hover.x * CELL, BY + this.hover.y * CELL, CELL, CELL);
    }
    for (const c of this.marks.move) {
      const px = cellCX(c.x), py = BY + c.y * CELL + CELL / 2;
      g.fillStyle = "rgba(20, 30, 34, 0.35)";
      g.fillRect(px - 3, py - 2, 6, 5);
      g.fillStyle = `rgba(255, 240, 200, ${0.55 + 0.35 * pulse})`;
      g.fillRect(px - 2, py - 2, 4, 4);
    }
    const bracket = (c, col, inset) => {
      const x0 = BX + c.x * CELL + inset, y0 = BY + c.y * CELL + inset, s = CELL - inset * 2, L = 6;
      g.fillStyle = col;
      for (const [ax, ay, dx, dy] of [[x0, y0, 1, 1], [x0 + s, y0, -1, 1], [x0, y0 + s, 1, -1], [x0 + s, y0 + s, -1, -1]]) {
        g.fillRect(dx > 0 ? ax : ax - L, dy > 0 ? ay : ay - 2, L, 2);
        g.fillRect(dx > 0 ? ax : ax - 2, dy > 0 ? ay : ay - L, 2, L);
      }
    };
    const inset = 2 + pulse * 1.5;
    for (const c of this.marks.attack) {
      g.fillStyle = "rgba(255, 70, 70, 0.16)";
      g.fillRect(BX + c.x * CELL, BY + c.y * CELL, CELL, CELL);
      bracket(c, "#ff5a5a", inset);
    }
    for (const c of this.marks.ability) {
      g.fillStyle = "rgba(160, 110, 255, 0.18)";
      g.fillRect(BX + c.x * CELL + 1, BY + c.y * CELL + 1, CELL - 2, CELL - 2);
      bracket(c, "#c99bff", inset + 1);
    }
    for (const c of this.marks.swap) bracket(c, "rgba(255, 228, 160, 0.7)", 3);
    // 위협 범위: 적이 칠 수 있는 내 기물 칸에 붉은 빗금
    if (this.threat.size) {
      for (const id of this.threat) {
        const vp = this.vps.get(id);
        if (!vp) continue;
        const x0 = BX + vp.cx * CELL, y0 = BY + vp.cy * CELL;
        g.fillStyle = `rgba(255, 60, 60, ${0.16 + 0.1 * pulse})`;
        g.fillRect(x0, y0, CELL, CELL);
        g.fillStyle = `rgba(255, 110, 110, ${0.5 + 0.25 * pulse})`;
        for (let k = -CELL; k < CELL; k += 5)
          for (let i = 0; i < CELL; i++) {
            const xx = k + i;
            if (xx >= 0 && xx < CELL && i % 2 === 0) g.fillRect(x0 + xx, y0 + CELL - 1 - i, 1, 1);
          }
      }
    }
    // 이동 미리보기: 그 칸에 가면 적에게 맞을 수 있으면 경고
    if (this.preview?.danger) {
      const c = this.preview.danger;
      g.fillStyle = `rgba(255, 60, 60, ${0.18 + 0.12 * pulse})`;
      g.fillRect(BX + c.x * CELL, BY + c.y * CELL, CELL, CELL);
      bracket(c, "#ff5a5a", 1);
    }
    if (this.selected) {
      const vp = this.vps.get(this.selected);
      if (vp) bracket({ x: vp.cx, y: vp.cy }, "#ffd45a", 1);
    }
  }

  drawPieces(g) {
    const list = [...this.vps.values()].sort((a, b) => a.y + a.oy.v - (b.y + b.oy.v));
    // 그림자 먼저
    for (const vp of list) {
      const x = vp.x + vp.ox.v, y = vp.y + vp.oy.v;
      const s = Math.max(0.4, 1 - vp.z / 30) * vp.scale;
      g.globalAlpha = 0.35 * vp.alpha;
      g.fillStyle = "#14101c";
      g.beginPath();
      g.ellipse(x, y + 1, 7 * s, 2.5 * s, 0, 0, Math.PI * 2);
      g.fill();
      // 레벨 오라: Lv2 파란 기운, Lv3 금빛 오라가 발밑에서 일렁임
      if (vp.lv >= 2) {
        const pulse = 0.5 + 0.5 * Math.sin(vp.bob * 3 + vp.id);
        g.globalAlpha = vp.alpha * (vp.lv >= 3 ? 0.35 + 0.25 * pulse : 0.22 + 0.15 * pulse);
        g.strokeStyle = vp.lv >= 3 ? "#ffd45a" : "#6fa8ff";
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(x, y + 1, (9 + pulse * 1.5) * s, (3.2 + pulse * 0.5) * s, 0, 0, Math.PI * 2);
        g.stroke();
        if (vp.lv >= 3) {
          g.globalAlpha = vp.alpha * 0.18 * (0.6 + 0.4 * pulse);
          g.fillStyle = "#ffd45a";
          g.beginPath();
          g.ellipse(x, y + 1, 8 * s, 2.8 * s, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    for (const vp of list) this.drawPiece(g, vp);
  }

  drawPiece(g, vp) {
    const sp = sprite(vp.key, vp.team, vp.lv);
    const x = vp.x + vp.ox.v, y = vp.y + vp.oy.v - vp.z;
    const sq = Math.max(0.55, Math.min(1.6, vp.sq.v));
    // 숨쉬는 듯한 아주 작은 들썩임
    const breathe = 1 + Math.sin(vp.bob * 2.4) * 0.025;
    const sxs = sq * vp.scale, sys = (1 / sq) * vp.scale * breathe;
    g.save();
    g.translate(x, y);
    g.rotate(vp.tilt);
    g.scale(sxs, sys);
    g.globalAlpha = vp.alpha;
    const ix = -sp.w / 2, iy = -sp.h + 1;
    if (this.selected === vp.id) {
      g.globalAlpha = vp.alpha * (0.6 + 0.4 * Math.sin(performance.now() / 120));
      g.filter = "none";
      g.drawImage(tinted(sp, "outline", "#ffd45a"), ix, iy);
      g.globalAlpha = vp.alpha;
    }
    g.drawImage(sp.img, ix, iy);
    if (vp.frozen) {
      g.globalAlpha = vp.alpha * 0.55;
      g.drawImage(tinted(sp, "white", "#9fe6ff"), ix, iy);
    }
    if (vp.poison > 0) {
      g.globalAlpha = vp.alpha * (0.22 + 0.12 * Math.sin(vp.bob * 5));
      g.drawImage(tinted(sp, "white", "#7dff4a"), ix, iy);
    }
    if (vp.shield > 0) {
      g.globalAlpha = vp.alpha * (0.55 + 0.3 * Math.sin(vp.bob * 4));
      g.drawImage(tinted(sp, "outline", "#ffe9a0"), ix, iy);
    }
    if (vp.flash > 0) {
      g.globalAlpha = vp.alpha * Math.min(1, vp.flash * 1.4);
      g.drawImage(sp.white, ix, iy);
    }
    g.restore();
    g.globalAlpha = 1;
    // 체력 바
    const showHp = this.preview?.map?.has(vp.id) || vp.team === "enemy" || vp.hp < vp.maxHp || vp.ghost > vp.hp || this.selected === vp.id || (this.hover && this.hover.x === vp.cx && this.hover.y === vp.cy);
    if (vp.alpha > 0.5 && vp.z < 3 && showHp) this.drawHp(g, vp, x, vp.y + vp.oy.v);
  }

  drawHp(g, vp, x, y) {
    const w = Math.min(22, 10 + vp.maxHp), x0 = Math.round(x - w / 2), y0 = Math.round(y + 2);
    g.fillStyle = "#14101c";
    g.fillRect(x0 - 1, y0 - 1, w + 2, 4);
    const f = vp.hp / vp.maxHp, gf = vp.ghost / vp.maxHp;
    g.fillStyle = "#fff4e0";
    g.fillRect(x0, y0, Math.round(w * gf), 2);
    g.fillStyle = vp.team === "enemy" ? "#ff5a5a" : vp.team === "summon" ? "#c58cff" : "#8fe36a";
    g.fillRect(x0, y0, Math.round(w * f), 2);
    // 미리보기: 깎일 만큼 깜빡이기, 회복될 만큼 연두색
    const pv = this.preview?.map?.get(vp.id);
    if (pv) {
      const blink = 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 160));
      if (pv.dmg > 0) {
        const after = Math.max(0, vp.hp - pv.dmg) / vp.maxHp;
        g.globalAlpha = blink;
        g.fillStyle = "#ffffff";
        g.fillRect(x0 + Math.round(w * after), y0, Math.round(w * f) - Math.round(w * after), 2);
        g.globalAlpha = 1;
      }
      if (pv.heal > 0) {
        const after = Math.min(vp.maxHp, vp.hp + pv.heal) / vp.maxHp;
        g.globalAlpha = blink;
        g.fillStyle = "#c8ff8a";
        g.fillRect(x0 + Math.round(w * f), y0, Math.round(w * after) - Math.round(w * f), 2);
        g.globalAlpha = 1;
      }
    }
    if (vp.lv >= 2) {
      g.fillStyle = vp.lv >= 3 ? "#ffd45a" : "#6fa8ff";
      for (let i = 0; i < vp.lv - 1; i++) g.fillRect(x0 - 3, y0 + 2 - i * 3, 2, 2);
    }
    if (vp.cd > 0) {
      g.fillStyle = "#c99bff";
      for (let i = 0; i < Math.min(5, vp.cd - 1); i++) g.fillRect(x0 + i * 2, y0 + 3, 1, 1);
    }
  }

  drawFloats(g) {
    for (const f of this.floats) {
      if (f.t < 0) continue;
      const u = f.t / 0.95;
      const pop = f.t < 0.18 ? E.outBackBig(f.t / 0.18) : 1;
      const y = f.y - 10 * E.outCubic(Math.min(1, f.t / 0.5));
      const size = f.big ? 11 : 9;
      g.save();
      g.globalAlpha = 1 - Math.max(0, (u - 0.65) / 0.35);
      g.translate(f.x, y);
      g.scale(pop, pop);
      g.font = `${size}px Galmuri11, Galmuri9, monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 3;
      g.strokeStyle = "#1b1020";
      g.strokeText(f.text, 0, 0);
      g.fillStyle = f.color;
      g.fillText(f.text, 0, 0);
      g.restore();
    }
  }
}

function mkLayer() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const img = g.createImageData(W, H);
  return { c, g, img, u32: new Uint32Array(img.data.buffer) };
}

const tintCache = new Map();
function tinted(sp, which, color) {
  const key = sp.img.width + ":" + which + ":" + color + ":" + (sp.id ??= Math.random());
  if (tintCache.has(key)) return tintCache.get(key);
  const src = which === "outline" ? sp.outline : sp.white;
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  return c;
}

export function pieceName(key) {
  return PIECES[key]?.name ?? key;
}
