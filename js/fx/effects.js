// 카오스체스 전용 이펙트. pixelfx 코어(Painter, Particles, Lights...)만 쓰고, 모양과 연출은 전부 새로 만든 것이에요.
// 규약: (0,0) = 기준점(대상의 몸 중심 또는 발), 오른쪽을 향해 그림. 회전은 opts.angle 로.
import {
  Particles, Bits, Lights, P, PF, B, Rng, hex, fit, mix, sparkle, band, bolt, forks,
  ease, clamp, seg, bump, lerp, TAU, WHITE,
} from "../../lib/pixelfx/core/index.js";

export const PALS = {
  gold: ["#5a3410", "#9a5c1c", "#d99a2b", "#ffd45a", "#fff3b0"],
  blood: ["#3a0c18", "#7a1830", "#c42a3c", "#ff6a5a", "#ffd0b8"],
  ice: ["#123a66", "#2f78c4", "#68c2f2", "#bff0ff", "#ffffff"],
  shadow: ["#1c0b33", "#4a1f80", "#8a4ee0", "#c99bff", "#f5e6ff"],
  holy: ["#6a4a10", "#c08a24", "#ffd65a", "#fff2b0", "#ffffff"],
  storm: ["#0d2a4a", "#1f6fb8", "#4fd0ff", "#b8f6ff", "#ffffff"],
  time: ["#0c3a33", "#1f8070", "#4fe0b8", "#b8ffe6", "#ffffff"],
  fire: ["#4a1712", "#c9281f", "#ff8a2a", "#ffd36b", "#fff6c8"],
  heal: ["#0f3a20", "#2f8a3a", "#7ae05a", "#d8ffb0", "#ffffff"],
  steel: ["#2a3044", "#59657e", "#9aa8c0", "#dfe7f5", "#ffffff"],
  bone: ["#2a2233", "#6b5f7a", "#b9a9c9", "#efe6f7", "#ffffff"],
  hell: ["#2a0508", "#7a0f12", "#e0361c", "#ff9a3c", "#ffe9a0"],
  poison: ["#142a0c", "#2f6a1c", "#6fcf3a", "#c8ff8a", "#f4ffe0"],
  arcane: ["#1a0f3a", "#3f2a8a", "#7f6af0", "#c9b8ff", "#ffffff"],
  stone: ["#2a2620", "#5a5248", "#9a9080", "#d8d0c0", "#ffffff"],
};

const ramp5 = (o) => fit(o.palette ?? PALS.gold, 5);

// ── 착지 먼지 ─────────────────────────────────────────────────────
export const dust = {
  meta: { duration: 0.9, options: { palette: ["#8a8296", "#c9bfae", "#efe6d6"], seed: 1, power: 1 } },
  create(o) {
    const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 1 });
    const C = fit(o.palette, 3), n = Math.round(5 + 4 * o.power);
    for (let i = 0; i < n; i++) {
      const s = R.sign(), sp = R.range(25, 70) * o.power;
      ps.spawn(P.DUST, s * R.range(1, 6), R.range(-2, 0), s * sp, R.range(-14, -4), R.range(0.35, 0.7), C[R.int(1, 2)], R.range(1.5, 3));
    }
    for (let i = 0; i < 4; i++) ps.spawn(P.GRIT, R.range(-5, 5), -1, R.range(-40, 40), R.range(-90, -40), R.range(0.3, 0.6), C[2]);
    return { update: (dt) => ps.update(dt), draw: (p) => ps.draw(p) };
  },
};

// ── 근접 공격: 여러 스타일 ────────────────────────────────────────
// style: arc(초승달), cross(X자), triple(연속 세 번), claw(세 줄 할퀴기), line(빛의 일자 베기), slam(내려찍기), ring(충격 고리)
export const strike = {
  meta: { duration: 0.9, options: { palette: PALS.gold, seed: 1, style: "arc", size: 1, spark: true } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), sz = o.size;
    const ps = new Particles({ rng: R, ground: () => 12, sparks: [C[4], C[3], C[2]] });
    const lights = new Lights(), bits = new Bits({ ground: () => 12 });
    const HIT = o.style === "slam" ? 0.1 : 0.06;
    let t = 0, fired = false;
    const cuts = {
      arc: [{ t0: 0, a0: -2.2, a1: 1.1, r: 15 * sz }],
      cross: [{ t0: 0, line: [-11, -11, 11, 11] }, { t0: 0.07, line: [-11, 11, 11, -11] }],
      triple: [{ t0: 0, line: [-10, -6, 10, 4] }, { t0: 0.06, line: [-9, 7, 10, -6] }, { t0: 0.12, line: [-11, 0, 11, -1] }],
      claw: [{ t0: 0, line: [-8, -10, 6, 9] }, { t0: 0.02, line: [-3, -11, 10, 7] }, { t0: 0.04, line: [2, -12, 13, 4] }],
      line: [{ t0: 0, line: [-15, 10, 15, -10], wide: 3 }],
      slam: [], ring: [],
    }[o.style] ?? [];
    return {
      update(dt) {
        t += dt;
        if (!fired && t >= HIT) {
          fired = true;
          lights.add(0, 0, 18 * sz, C[3], 0.5, 0.3);
          if (o.spark !== false)
            for (let i = 0; i < 14 * sz; i++) {
              const a = R.range(-1.2, 1.2) + (o.style === "slam" ? -Math.PI / 2 : 0), sp = R.range(90, 220);
              ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.15, 0.4));
            }
          if (o.style === "slam") {
            for (let i = 0; i < 7; i++)
              bits.add({ kind: B.CHUNK, x: R.range(-6, 6), y: 8, vx: R.range(-90, 90), vy: R.range(-200, -90), s: R.range(1, 2.2), va: R.range(-12, 12), bounce: 0.4, life: R.range(0.6, 0.9), ramp: ["#1e1a26", "#3b3446", "#6a6178", "#9d93ab", "#d5cde0"] });
            for (let i = 0; i < 8; i++) ps.spawn(P.DUST, R.range(-8, 8), 10, R.range(-60, 60), R.range(-20, -5), R.range(0.4, 0.7), "#7a7088", 2.5);
          }
        }
        ps.update(dt);
        lights.update(dt);
        bits.update(dt);
      },
      draw(p) {
        // 베기 자국
        for (const c of cuts) {
          const lt = t - c.t0;
          if (lt < 0 || lt > 0.46) continue;
          const grow = ease.outExpo(clamp(lt / 0.09)), fade = 1 - seg(lt, 0.14, 0.46);
          if (c.a0 !== undefined) {
            const a1 = lerp(c.a0, c.a1, grow);
            p.arc(0, 0, c.r, (u) => Math.sin(u * Math.PI) * 5.5 * sz * fade + 0.4, c.a0, Math.max(c.a0 + 0.05, a1),
              (u, v) => (u > 0.86 || v > 0.75 ? WHITE : v > 0.45 ? C[3] : C[2]), (u) => (u < 0.25 ? u * 4 * fade : fade));
            p.glow(Math.cos(a1) * c.r * 0.8, Math.sin(a1) * c.r * 0.8, 9 * sz, C[3], 0.3 * fade);
          } else {
            const [x0, y0, x1, y1] = c.line, ex = lerp(x0, x1, grow), ey = lerp(y0, y1, grow);
            const w = (c.wide ?? 2) * fade + 0.5;
            p.beam(x0, y0, ex, ey, w, (u, v) => (v < 0.4 ? WHITE : C[3]), (u) => Math.min(1, u * 3) * fade);
            p.glowLine(x0, y0, ex, ey, 5, C[3], 0.22 * fade);
          }
        }
        // 충격 고리 / 내려찍기 바닥 고리
        if (o.style === "ring" || o.style === "slam") {
          const lt = t - HIT;
          if (lt > 0 && lt < 0.5) {
            const r = ease.outCubic(seg(lt, 0, 0.5)) * 16 * sz, k = 1 - seg(lt, 0.1, 0.5);
            if (o.style === "slam") band(p, 0, 10, r, 0.35, 2, k, C, () => true, lt < 0.08);
            else p.ring(0, 0, r, 2, (v) => (v > 0.5 ? WHITE : C[3]), k);
            p.glowRing(0, o.style === "slam" ? 10 : 0, r, 4, C[3], 0.5 * k);
          }
        }
        // 맞는 순간 별빛
        const ft = t - HIT;
        if (ft > 0 && ft < 0.1) sparkle(p, 0, 0, (1 - ft / 0.1) * 5 * sz, C[3], C[4], 0.5);
        bits.draw(p);
        ps.draw(p);
        lights.draw(p);
      },
    };
  },
};

// ── 창 찌르기: 기준점 = 공격자, 오른쪽으로 len px ─────────────────
export const thrust = {
  meta: { duration: 0.6, options: { palette: PALS.steel, seed: 1, len: 64 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), ps = new Particles({ rng: R, sparks: [C[4], C[3], C[2]] });
    let t = 0, fired = false;
    return {
      update(dt) {
        t += dt;
        if (!fired && t > 0.08) {
          fired = true;
          for (let i = 0; i < 12; i++) ps.spawn(P.SPARK, o.len * R.range(0.4, 1), R.range(-2, 2), R.range(60, 200), R.range(-60, 60), R.range(0.15, 0.35));
        }
        ps.update(dt);
      },
      draw(p) {
        const out = ease.outExpo(seg(t, 0, 0.1)) * (1 - ease.inCubic(seg(t, 0.2, 0.42)));
        const tip = 6 + out * o.len, fade = 1 - seg(t, 0.3, 0.45);
        if (fade > 0) {
          p.beam(6, 0, tip, 0, 2.2, (u, v) => (v < 0.4 ? WHITE : C[3]), (u) => u * fade);
          p.tri(tip, -3, tip + 6, 0, tip, 3, WHITE, fade);
          p.glowLine(6, 0, tip + 4, 0, 7, C[3], 0.55 * fade);
          // 공기를 가르는 잔선
          for (let i = 0; i < 3; i++) p.line(tip - 18 - i * 6, -4 + i * 4, tip - 4 - i * 6, -4 + i * 4, C[2], 0.5 * fade);
        }
        ps.draw(p);
      },
    };
  },
};

// ── 투사체: 기준점 = 발사 지점, (dx,dy)까지 날아감 ───────────────
// kind: arrow, ember, frost, shadow, hell
export const projectile = {
  meta: { duration: 0.5, options: { palette: PALS.fire, seed: 1, dx: 64, dy: 0, kind: "ember", time: 0.3 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), T = o.time;
    const ps = new Particles({ rng: R, sparks: [C[4], C[3], C[2]] });
    const pos = (t) => {
      const lob = o.kind === "stone" || o.kind === "bomb" || o.kind === "cannon";
      const u = clamp(t / T), k = o.kind === "arrow" || lob ? u : ease.inQuad(u) * 0.35 + u * 0.65;
      const L = Math.hypot(o.dx, o.dy);
      const arc = o.kind === "arrow" ? Math.sin(u * Math.PI) * -Math.min(12, L * 0.12) : lob ? Math.sin(u * Math.PI) * -Math.min(40, 10 + L * 0.35) : 0;
      return [o.dx * k, o.dy * k + arc];
    };
    let t = 0, acc = 0;
    return {
      update(dt) {
        t += dt;
        if (t < T) {
          acc += dt;
          while (acc > 0.012) {
            acc -= 0.012;
            const [x, y] = pos(t);
            if (o.kind === "poison") ps.spawn(P.VAPOUR, x, y, R.range(-6, 6), R.range(-10, 2), R.range(0.25, 0.45), C[R.int(1, 2)], R.range(1, 2));
            else if (o.kind === "bomb") { if (R.chance(0.5)) ps.spawn(P.SPARK, x, y - 3, R.range(-30, 30), R.range(-60, -10), R.range(0.1, 0.25)); }
            else if (o.kind === "cannon") ps.spawn(P.SMOKE, x, y, R.range(-5, 5), R.range(-8, 0), R.range(0.3, 0.5), 0, R.range(1, 1.6));
            else if (o.kind === "stone") { if (R.chance(0.2)) ps.spawn(P.GRIT, x, y, 0, 0, 0.2, C[2]); }
            else if (o.kind === "arcane") ps.spawn(P.STAR, x, y, R.range(-10, 10), R.range(-10, 10), R.range(0.2, 0.4), C[R.int(3, 4)]);
            else if (o.kind === "ember" || o.kind === "hell") ps.spawn(P.FIRE, x + R.range(-1, 1), y + R.range(-1, 1), R.range(-10, 10), R.range(-20, 0), R.range(0.15, 0.3), 0, R.range(1, 2));
            else if (o.kind === "frost") ps.spawn(P.FLAKE, x, y, R.range(-15, 15), R.range(-15, 15), R.range(0.25, 0.5), C[R.int(2, 4)], 1);
            else if (o.kind === "shadow") ps.spawn(P.VAPOUR, x, y, R.range(-8, 8), R.range(-12, 4), R.range(0.25, 0.45), C[2], R.range(1.5, 2.5));
          }
        }
        ps.update(dt);
      },
      draw(p) {
        ps.draw(p, "back");
        if (t < T) {
          const [x, y] = pos(t), [px, py] = pos(Math.max(0, t - 0.04));
          const a = Math.atan2(y - py, x - px), ca = Math.cos(a), sa = Math.sin(a);
          if (o.kind === "stone" || o.kind === "cannon" || o.kind === "bomb") {
            const r = o.kind === "cannon" ? 3 : o.kind === "bomb" ? 2.6 : 1.6;
            const body = o.kind === "bomb" ? hex("#2a2233") : o.kind === "cannon" ? hex("#1c1a22") : C[2];
            p.circle(x, y, r + 0.8, hex("#120c19"));
            p.circle(x, y, r, (d, a) => (d > 0.5 && a < -1 ? C[3] : body));
            if (o.kind === "bomb") {
              p.line(x, y - r, x + 2, y - r - 3, hex("#c9a46a"));
              p.dot(x + 2, y - r - 4, WHITE);
              p.glow(x + 2, y - r - 4, 6, hex("#ffb347"), 0.7);
            }
          } else if (o.kind === "arrow") {
            p.line(x - ca * 9, y - sa * 9, x, y, hex("#9b6334"));
            p.line(x - ca * 9, y - sa * 9 - 1, x - ca * 7, y - sa * 7 - 1, WHITE);
            p.px(x + ca, y + sa, WHITE);
            p.line(x - ca * 26, y - sa * 26, x - ca * 10, y - sa * 10, C[3], (u) => u * 0.6);
          } else {
            const r = o.kind === "shadow" ? 3.2 : 2.6;
            p.circle(x, y, r + 1, C[2]);
            p.circle(x, y, r, (d) => (d < 0.45 ? WHITE : C[3]));
            if (o.kind === "frost") for (let i = 0; i < 4; i++) p.px(x + Math.cos(t * 20 + i * 1.57) * 5, y + Math.sin(t * 20 + i * 1.57) * 5, C[4]);
            if (o.kind === "shadow") for (let i = 0; i < 3; i++) p.px(x + Math.cos(-t * 18 + i * 2.1) * 5, y + Math.sin(-t * 18 + i * 2.1) * 5, C[3]);
          }
          p.glow(x, y, 12, C[3], 0.6);
        }
        ps.draw(p, "front");
      },
    };
  },
};

// ── 명중 폭발 (작은) ─────────────────────────────────────────────
// kind: spark, fire, ice, shadow, storm, hell
export const impact = {
  meta: { duration: 1.1, options: { palette: PALS.fire, seed: 1, kind: "spark", size: 1 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), s = o.size;
    const ps = new Particles({ rng: R, ground: () => 11, sparks: [C[4], C[3], C[2]], haze: C[2] });
    const lights = new Lights(), bits = new Bits({ ground: () => 11 });
    lights.add(0, 0, 26 * s, C[3], 1, 0.4);
    for (let i = 0; i < 12 * s; i++) {
      const a = R.range(0, TAU), sp = R.range(60, 180) * s;
      ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.15, 0.4));
    }
    if (o.kind === "fire" || o.kind === "hell")
      for (let i = 0; i < 14 * s; i++) {
        const a = R.range(0, TAU), sp = R.range(10, 50) * s;
        ps.spawn(P.FIRE, Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.25, 0.55), 0, R.range(1.5, 3) * s, 0, PF.SMOKES);
      }
    if (o.kind === "ice")
      for (let i = 0; i < 7; i++)
        bits.add({ kind: B.SHARD, x: 0, y: 0, vx: R.range(-110, 110), vy: R.range(-190, -50), s: R.range(2, 4), a: R.range(0, TAU), va: R.range(-20, 20), c: C[R.int(2, 4)], bounce: 0.3, life: R.range(0.5, 0.9) });
    if (o.kind === "poison")
      for (let i = 0; i < 10; i++) ps.spawn(P.VAPOUR, R.range(-4, 4), R.range(-4, 4), R.range(-20, 20), R.range(-26, -4), R.range(0.5, 0.9), C[R.int(1, 3)], R.range(2, 3.5));
    if (o.kind === "shadow" || o.kind === "storm")
      for (let i = 0; i < 8; i++) ps.spawn(P.VAPOUR, R.range(-4, 4), R.range(-4, 4), R.range(-25, 25), R.range(-30, -5), R.range(0.4, 0.8), C[2], R.range(2, 3.5));
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
        lights.update(dt);
        bits.update(dt);
      },
      drawBack(p) {
        ps.draw(p, "back");
      },
      draw(p) {
        if (t < 0.1) p.circle(0, 0, (5 + 6 * (t / 0.1)) * s, t < 0.04 ? WHITE : C[4], 1 - t / 0.1);
        const rt = seg(t, 0, 0.3);
        if (rt < 1) p.ring(0, 0, (4 + 14 * ease.outCubic(rt)) * s, 1.5, C[3], 1 - rt);
        if (o.kind === "ice" && t < 0.7) {
          // 대상 주위로 솟는 얼음 결정
          for (let i = 0; i < 5; i++) {
            const g = ease.outBack(seg(t, 0.02 * i, 0.12 + 0.02 * i)) * (1 - seg(t, 0.45, 0.7));
            const a = -Math.PI / 2 + (i - 2) * 0.55, L = (7 + (i % 2) * 4) * g;
            p.beam(Math.cos(a) * 3, Math.sin(a) * 3 + 6, Math.cos(a) * (3 + L), Math.sin(a) * (3 + L) + 6, 2.5, (u) => (u > 0.7 ? WHITE : C[3]), 1);
          }
        }
        bits.draw(p);
        ps.draw(p, "front");
        lights.draw(p);
      },
    };
  },
};

// ── 화염구 폭발 3×3 ──────────────────────────────────────────────
export const blast = {
  meta: { duration: 2.2, options: { palette: PALS.fire, seed: 1 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed);
    const ps = new Particles({ rng: R, ground: () => 30, sparks: ["#ffffff", "#ffe26b", "#ff8a2a"] });
    const lights = new Lights(), bits = new Bits({ ground: () => 30 });
    lights.add(0, 0, 60, C[3], 0.9, 0.6);
    lights.add(0, 0, 24, WHITE, 0.7, 0.15);
    for (let i = 0; i < 40; i++) {
      const a = R.range(0, TAU), sp = R.range(40, 120);
      ps.spawn(P.FIRE, Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * sp, Math.sin(a) * sp * 0.75 - 20, R.range(0.35, 0.8), 0, R.range(2, 4.5), R.range(0, 0.06), PF.SMOKES | (i % 3 ? 0 : PF.BIG));
    }
    for (let i = 0; i < 26; i++) {
      const a = R.range(0, TAU), sp = R.range(120, 300);
      ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp - 60, R.range(0.25, 0.6));
    }
    for (let i = 0; i < 8; i++) ps.spawn(P.EMBER, R.range(-20, 20), R.range(-10, 20), R.range(-20, 20), R.range(-50, -20), R.range(0.8, 1.6), "#ffb347", 1, R.range(0.1, 0.4));
    for (let i = 0; i < 6; i++)
      bits.add({ kind: B.CHUNK, x: R.range(-8, 8), y: R.range(-4, 8), vx: R.range(-130, 130), vy: R.range(-260, -100), s: R.range(1.2, 2.2), va: R.range(-14, 14), bounce: 0.35, life: R.range(0.8, 1.3), ramp: ["#1a1010", "#3d2222", "#7a4030", "#c06a3a", "#ffb060"] });
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
        lights.update(dt);
        bits.update(dt);
      },
      drawBack(p) {
        // 바닥에 그을린 자국 (3×3 칸)
        const k = 1 - seg(t, 1.2, 2.1);
        if (k > 0) p.disc(0, 18, 34, C[0], (d) => 0.35 * k * (1 - d * d));
        ps.draw(p, "back");
      },
      draw(p) {
        if (t < 0.05) p.circle(0, 0, 22, (d) => (d < 0.6 ? WHITE : C[4]));
        const rt = seg(t, 0, 0.45);
        if (rt < 1) {
          p.ring(0, 0, 8 + 44 * ease.outCubic(rt), 2, (v) => (v > 0.5 ? WHITE : C[3]), 1 - rt);
          p.glowRing(0, 0, 8 + 44 * ease.outCubic(rt), 6, C[3], 0.6 * (1 - rt));
        }
        const ct = seg(t, 0, 0.35);
        if (ct < 1) p.circle(0, 0, (10 + 16 * ease.outQuart(ct)) * (1 - ct * ct), (d) => (d < 0.4 ? WHITE : d < 0.75 ? C[4] : C[3]));
        bits.draw(p);
        ps.draw(p, "front");
        lights.draw(p);
      },
    };
  },
};

// ── 드래곤 숨결: 기준점 = 입, 오른쪽으로 len px ──────────────────
export const breath = {
  meta: { duration: 1.6, options: { palette: PALS.fire, seed: 1, len: 96 } },
  create(o) {
    const R = new Rng(o.seed), ps = new Particles({ rng: R, sparks: ["#ffffff", "#ffe26b", "#ff8a2a"] });
    const lights = new Lights();
    let t = 0, acc = 0;
    return {
      update(dt) {
        t += dt;
        if (t < 0.65) {
          acc += dt;
          while (acc > 0.006) {
            acc -= 0.006;
            const sp = o.len * R.range(2.2, 3.4), spread = R.range(-0.16, 0.16);
            ps.spawn(P.FIRE, 4, R.range(-1.5, 1.5), Math.cos(spread) * sp, Math.sin(spread) * sp, R.range(0.25, 0.4), 0, R.range(2, 4), 0, R.chance(0.3) ? PF.SMOKES : 0);
            if (R.chance(0.15)) ps.spawn(P.SPARK, 4, 0, R.range(150, 320), R.range(-60, 60), R.range(0.2, 0.4));
          }
          if (R.chance(0.3)) lights.add(R.range(10, o.len), R.range(-4, 4), 30, "#ff9a3c", 0.6, 0.25);
        }
        ps.update(dt);
        lights.update(dt);
      },
      drawBack(p) {
        ps.draw(p, "back");
      },
      draw(p) {
        const k = 1 - seg(t, 0.5, 0.8);
        if (k > 0) {
          p.glowLine(0, 0, o.len * Math.min(1, t / 0.25), 0, 12, hex("#ff8a2a"), 0.4 * k);
          p.circle(4, 0, 4 * k, (d) => (d < 0.5 ? WHITE : hex("#ffe26b")));
        }
        ps.draw(p, "front");
        lights.draw(p);
      },
    };
  },
};

// ── 연쇄 번개: path = [[x,y]...] (기준점 기준) ────────────────────
export const chain = {
  meta: { duration: 0.9, options: { palette: PALS.storm, seed: 1, path: [[0, 0], [40, 0]] } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), ps = new Particles({ rng: R, sparks: [C[4], C[3], C[2]] });
    const lights = new Lights();
    const legs = [];
    for (let i = 1; i < o.path.length; i++) legs.push({ a: o.path[i - 1], b: o.path[i], t0: (i - 1) * 0.12 });
    let t = 0, frame = -1, shapes = [];
    const fired = new Set();
    return {
      update(dt) {
        t += dt;
        for (const [i, l] of legs.entries())
          if (!fired.has(i) && t >= l.t0) {
            fired.add(i);
            lights.add(l.b[0], l.b[1], 34, C[3], 1, 0.4);
            for (let j = 0; j < 10; j++) {
              const a = R.range(0, TAU), sp = R.range(60, 200);
              ps.spawn(P.SPARK, l.b[0], l.b[1], Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.1, 0.3));
            }
          }
        // 번개 모양은 1/30초마다 다시 꿈틀
        const f = Math.floor(t * 30);
        if (f !== frame) {
          frame = f;
          shapes = legs.map((l) => {
            const path = bolt(R, l.a[0], l.a[1], l.b[0], l.b[1], { jag: 0.18, depth: 4 });
            return { path, forks: forks(R, path, { count: 2, len: 10 }) };
          });
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        legs.forEach((l, i) => {
          const lt = t - l.t0;
          if (lt < 0 || lt > 0.4) return;
          const k = 1 - seg(lt, 0.15, 0.4), sh = shapes[i];
          p.glowLine(l.a[0], l.a[1], l.b[0], l.b[1], 10, C[3], 0.5 * k);
          for (const f of sh.forks) p.polyline(f, C[3], k * 0.8);
          p.polyline(sh.path.map(([x, y]) => [x, y + 1]), C[2], k);
          p.polyline(sh.path, lt < 0.08 ? WHITE : C[4], k);
          if (lt < 0.1) sparkle(p, l.b[0], l.b[1], 6, C[3], C[4], 0.8);
        });
        ps.draw(p);
        lights.draw(p);
      },
    };
  },
};

// ── 치유: 기준점 = 발 ────────────────────────────────────────────
export const healFx = {
  meta: { duration: 1.5, options: { palette: PALS.heal, seed: 1 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), ps = new Particles({ rng: R });
    const crosses = Array.from({ length: 6 }, (_, i) => ({ x: R.range(-9, 9), d: i * 0.1 + R.range(0, 0.05), sp: R.range(18, 30) }));
    for (let i = 0; i < 12; i++) ps.spawn(P.MOTE, R.range(-10, 10), R.range(-4, 2), R.range(-5, 5), R.range(-45, -20), R.range(0.5, 1), C[R.int(2, 4)], 1, R.range(0, 0.5));
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
      },
      drawBack(p) {
        const k = bump(t, 0, 1.2);
        band(p, 0, 0, 10 + 3 * ease.outCubic(seg(t, 0, 0.4)), 0.35, 2, k, C, (g) => Math.sin(g) < 0);
      },
      draw(p) {
        const k = bump(t, 0, 1.2);
        band(p, 0, 0, 10 + 3 * ease.outCubic(seg(t, 0, 0.4)), 0.35, 2, k, C, (g) => Math.sin(g) >= 0);
        p.glow(0, -8, 18, C[3], 0.5 * k);
        for (const c of crosses) {
          const lt = t - c.d;
          if (lt < 0 || lt > 1) continue;
          const y = -6 - lt * c.sp, a = 1 - seg(lt, 0.6, 1), s = lt < 0.1 ? 1 : 1.5;
          p.rect(c.x - 0.5, y - s - 0.5, 1, s * 2 + 1, lt < 0.15 ? WHITE : C[3], a);
          p.rect(c.x - s - 0.5, y - 0.5, s * 2 + 1, 1, lt < 0.15 ? WHITE : C[3], a);
          p.light(c.x, y, C[3], 0.6 * a);
        }
        ps.draw(p);
      },
    };
  },
};

// ── 소환 마법진 (해골 소환 / 마왕의 임프): 기준점 = 발 ────────────
export const summon = {
  meta: { duration: 1.6, options: { palette: PALS.shadow, seed: 1 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), ps = new Particles({ rng: R, haze: C[2] });
    const lights = new Lights();
    let t = 0, fired = false;
    const souls = Array.from({ length: 5 }, (_, i) => ({ a: (i / 5) * TAU, d: R.range(0, 0.15) }));
    return {
      update(dt) {
        t += dt;
        if (!fired && t > 0.45) {
          fired = true;
          lights.add(0, -8, 40, C[3], 1.1, 0.5);
          for (let i = 0; i < 16; i++) ps.spawn(P.VAPOUR, R.range(-8, 8), R.range(-2, 2), R.range(-30, 30), R.range(-40, -8), R.range(0.5, 1), C[R.int(1, 2)], R.range(2, 3.5));
          for (let i = 0; i < 10; i++) ps.spawn(P.STAR, R.range(-12, 12), R.range(-26, -2), 0, R.range(-20, -6), R.range(0.4, 0.9), C[4], 1, R.range(0, 0.3));
        }
        ps.update(dt);
        lights.update(dt);
      },
      drawBack(p) {
        const open = ease.outBack(seg(t, 0, 0.35)), k = 1 - seg(t, 1.0, 1.5);
        const r = 13 * open;
        band(p, 0, 0, r, 0.4, 1.5, k, C, (g) => Math.sin(g) < 0, t < 0.5);
        band(p, 0, 0, r * 0.62, 0.4, 1, k * 0.8, C, (g) => Math.sin(g) < 0);
        // 회전하는 룬 점
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + t * 2.2;
          if (Math.sin(a) < 0) p.dot(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82 * 0.4, C[4], k);
        }
        ps.draw(p, "back");
      },
      draw(p) {
        const open = ease.outBack(seg(t, 0, 0.35)), k = 1 - seg(t, 1.0, 1.5);
        const r = 13 * open;
        band(p, 0, 0, r, 0.4, 1.5, k, C, (g) => Math.sin(g) >= 0, t < 0.5);
        band(p, 0, 0, r * 0.62, 0.4, 1, k * 0.8, C, (g) => Math.sin(g) >= 0);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + t * 2.2;
          if (Math.sin(a) >= 0) p.dot(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82 * 0.4, C[4], k);
        }
        p.glow(0, 0, 22, C[2], 0.5 * k);
        // 소용돌이치며 솟는 영혼
        for (const s of souls) {
          const lt = t - s.d;
          if (lt < 0.15 || lt > 0.75) continue;
          const u = seg(lt, 0.15, 0.75), rr = 12 * (1 - u), a = s.a + u * 7;
          const x = Math.cos(a) * rr, y = -u * 22 + Math.sin(a) * rr * 0.4;
          p.dot(x, y, C[4], 1 - u * 0.5);
          p.dot(x, y + 1, C[3], 0.7);
          p.dot(x, y + 2, C[2], 0.4);
          p.light(x, y, C[3], 0.6);
        }
        // 기둥처럼 솟는 빛
        const bt = seg(t, 0.4, 0.75);
        if (bt > 0 && bt < 1) p.beam(0, 0, 0, -30 * ease.outCubic(bt), 6 * (1 - bt) + 1, (u, v) => (v < 0.4 ? WHITE : C[3]), (u) => (1 - u) * (1 - bt));
        ps.draw(p, "front");
        lights.draw(p);
      },
    };
  },
};

// ── 시간 가속: 기준점 = 몸 중심 ──────────────────────────────────
export const warp = {
  meta: { duration: 1.4, options: { palette: PALS.time, seed: 1 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), ps = new Particles({ rng: R });
    for (let i = 0; i < 16; i++) {
      const a = R.range(0, TAU);
      ps.spawn(P.STREAK, Math.cos(a) * 30, Math.sin(a) * 30, -Math.cos(a) * 80, -Math.sin(a) * 80, R.range(0.25, 0.4), C[3], 1, R.range(0, 0.2));
    }
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
      },
      draw(p) {
        for (let i = 0; i < 3; i++) {
          const lt = seg(t, 0.35 + i * 0.12, 1.1 + i * 0.12);
          if (lt <= 0 || lt >= 1) continue;
          const r = 6 + 34 * ease.outCubic(lt);
          p.ring(0, 0, r, 1, C[3], 1 - lt);
          // 시계 눈금
          for (let j = 0; j < 12; j++) {
            const a = (j / 12) * TAU + lt * 1.2;
            p.dot(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), j % 3 ? C[2] : WHITE, 1 - lt);
          }
          p.glowRing(0, 0, r, 4, C[3], 0.4 * (1 - lt));
        }
        // 시곗바늘
        const k = bump(t, 0, 1.0);
        const a1 = -Math.PI / 2 + t * 14, a2 = -Math.PI / 2 + t * 3;
        p.line(0, 0, Math.cos(a1) * 9, Math.sin(a1) * 9, C[4], k);
        p.line(0, 0, Math.cos(a2) * 6, Math.sin(a2) * 6, WHITE, k);
        p.glow(0, 0, 14, C[3], 0.6 * k);
        ps.draw(p);
      },
    };
  },
};

// ── 신성 강타: 하늘에서 내리꽂는 빛, 기준점 = 대상 발 ───────────
export const smite = {
  meta: { duration: 1.4, options: { palette: PALS.holy, seed: 1 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 1, sparks: [C[4], C[3], C[2]] });
    const lights = new Lights();
    let t = 0, fired = false;
    const HIT = 0.16;
    return {
      update(dt) {
        t += dt;
        if (!fired && t >= HIT) {
          fired = true;
          lights.add(0, -10, 44, C[3], 0.8, 0.45);
          for (let i = 0; i < 22; i++) {
            const a = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(90, 240);
            ps.spawn(P.SPARK, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.5));
          }
          for (let i = 0; i < 8; i++) ps.spawn(P.STAR, R.range(-14, 14), R.range(-30, -4), 0, R.range(-15, -5), R.range(0.4, 0.9), C[4], 1, R.range(0, 0.3));
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        // 떨어지는 빛줄기
        const d = ease.inQuad(seg(t, 0, HIT));
        if (t < HIT) p.beam(0, -90, 0, -90 + 90 * d, 3, WHITE, 1);
        const bt = seg(t, HIT, HIT + 0.5);
        if (t >= HIT && bt < 1) {
          const w = 9 * (1 - ease.inCubic(bt));
          p.beam(0, -80, 0, 0, w, (u, v) => (v < 0.35 ? WHITE : v < 0.7 ? C[4] : C[3]), 1);
          p.glowLine(0, -80, 0, 0, 16, C[3], 0.6 * (1 - bt));
          band(p, 0, 0, 6 + 18 * ease.outCubic(bt), 0.35, 2, 1 - bt, C, () => true, bt < 0.15);
        }
        if (t >= HIT && t < HIT + 0.06) p.circle(0, -4, 9, (d) => (d < 0.6 ? WHITE : C[4]));
        ps.draw(p);
        lights.draw(p);
      },
    };
  },
};

// ── 부서짐: 기물 픽셀이 흩어져 떨어짐. pixels = [{x,y,c}] 발 기준 ───
export const shatter = {
  meta: { duration: 1.6, options: { seed: 1, pixels: [], dir: 1 } },
  create(o) {
    const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 1 });
    const parts = o.pixels.filter((q) => !q.o).map((q) => ({
      x: q.x, y: q.y, c: hex(q.c),
      vx: q.x * R.range(6, 14) + o.dir * R.range(10, 50), vy: R.range(-150, -40) + q.y * 2,
      life: R.range(0.7, 1.4), rest: false,
    }));
    for (let i = 0; i < 8; i++) ps.spawn(P.DUST, R.range(-6, 6), 0, R.range(-40, 40), R.range(-20, -5), R.range(0.4, 0.8), "#6b6478", R.range(2, 3));
    let t = 0;
    return {
      update(dt) {
        t += dt;
        for (const q of parts) {
          if (q.rest) continue;
          q.vy += 600 * dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          if (q.y > 2 + (q.x % 3)) {
            if (q.vy > 120) (q.vy *= -0.3), (q.vx *= 0.6), (q.y = 2);
            else q.rest = true;
          }
        }
        ps.update(dt);
      },
      draw(p) {
        if (t < 0.05) p.circle(0, -9, 9, WHITE);
        for (const q of parts) {
          const a = clamp((q.life - t) / 0.4);
          if (a > 0) p.dot(q.x, q.y, q.c, a);
        }
        ps.draw(p);
      },
    };
  },
};

// ── 승급: 금빛 기둥과 별 ─────────────────────────────────────────
export const promote = {
  meta: { duration: 1.5, options: { palette: PALS.holy, seed: 1 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), ps = new Particles({ rng: R });
    for (let i = 0; i < 18; i++) ps.spawn(P.STAR, R.range(-12, 12), R.range(-28, 0), R.range(-10, 10), R.range(-40, -10), R.range(0.5, 1.1), C[R.int(3, 4)], 1, R.range(0, 0.5));
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
      },
      draw(p) {
        const k = bump(t, 0, 1.1);
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * 3.5, h = 26 + (i % 2) * 10;
          p.beam(x, 0, x, -h * ease.outCubic(seg(t, 0.03 * i, 0.4)), 1.5, C[3], (u) => (1 - u) * k * 0.8);
        }
        p.glow(0, -12, 26, C[3], 0.6 * k);
        if (t > 0.3 && t < 0.4) sparkle(p, 0, -24, 9, C[3], C[4], 1);
        ps.draw(p);
      },
    };
  },
};

// ── 빙결 표식 (얼어붙는 순간) ────────────────────────────────────
export const freeze = {
  meta: { duration: 1.0, options: { palette: PALS.ice, seed: 1 } },
  create(o) {
    const C = ramp5(o), R = new Rng(o.seed), ps = new Particles({ rng: R });
    for (let i = 0; i < 14; i++) ps.spawn(P.FLAKE, R.range(-10, 10), R.range(-22, 0), R.range(-8, 8), R.range(-10, 6), R.range(0.5, 1), C[R.int(3, 4)], R.chance(0.3) ? 2 : 1, R.range(0, 0.3));
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
      },
      draw(p) {
        const k = bump(t, 0, 0.9);
        band(p, 0, 0, 11, 0.4, 2, k, C, () => true, t < 0.1);
        p.glow(0, -8, 18, C[3], 0.5 * k);
        ps.draw(p);
      },
    };
  },
};

// ── 레벨 효과: 공격이 맞을 때 레벨 색 폭발 (Lv2 파란 별 파편, Lv3 금빛 광선 폭발) ──
export const levelBurst = {
  meta: { duration: 1.0, options: { seed: 1, tier: 2 } },
  create(o) {
    const R = new Rng(o.seed), lv3 = o.tier >= 3;
    const C = fit(lv3 ? ["#5a3410", "#c8901e", "#ffd45a", "#ffe9a0", "#ffffff"] : ["#122a55", "#2f5fb0", "#6fa8ff", "#bfdcff", "#ffffff"], 5);
    const ps = new Particles({ rng: R, sparks: [C[4], C[3], C[2]] });
    const lights = new Lights();
    lights.add(0, 0, lv3 ? 34 : 20, C[3], lv3 ? 0.9 : 0.6, 0.35);
    const n = lv3 ? 18 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R.range(-0.2, 0.2), sp = R.range(70, lv3 ? 190 : 130);
      ps.spawn(lv3 ? P.SPARK : P.STAR, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.2, 0.45), C[R.int(3, 4)], 1);
    }
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        // Lv3: 8갈래 광선이 뻗었다 사라짐
        if (lv3 && t < 0.3) {
          const k = 1 - t / 0.3, L = 8 + 16 * ease.outCubic(t / 0.3);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.39, len = i % 2 ? L * 0.6 : L;
            p.line(Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a) * len, Math.sin(a) * len, i % 2 ? C[3] : WHITE, k);
          }
        }
        // 레벨 색 고리
        const rt = seg(t, 0.02, lv3 ? 0.45 : 0.35);
        if (rt > 0 && rt < 1) {
          const r = (lv3 ? 6 : 4) + (lv3 ? 16 : 10) * ease.outCubic(rt);
          p.ring(0, 0, r, lv3 ? 2 : 1, (v) => (v > 0.5 ? C[4] : C[3]), 1 - rt);
          p.glowRing(0, 0, r, 4, C[3], 0.4 * (1 - rt));
        }
        if (t < 0.08) sparkle(p, 0, 0, lv3 ? 6 : 4, C[3], C[4], 0.7);
        ps.draw(p);
        lights.draw(p);
      },
    };
  },
};
