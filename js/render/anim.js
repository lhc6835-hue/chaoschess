// 애니메이션 시계: 히트스톱이 걸리면 월드 시간이 멈춰요. tween/wait 는 월드 시간 기준 Promise.

export const E = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outBackBig: (t) => 1 + 3.6 * Math.pow(t - 1, 3) + 2.6 * Math.pow(t - 1, 2),
};

export class Clock {
  constructor() {
    this.t = 0;
    this.stop = 0; // 히트스톱 남은 시간 (실시간)
    this.speed = 1;
    this.jobs = [];
  }
  hitstop(sec) {
    this.stop = Math.max(this.stop, sec);
  }
  /** 실시간 dt → 월드 dt */
  step(realDt) {
    if (this.stop > 0) {
      this.stop -= realDt;
      return 0;
    }
    const dt = realDt * this.speed;
    this.t += dt;
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      const j = this.jobs[i];
      j.el += dt;
      const u = Math.min(1, j.el / j.dur);
      j.fn?.(j.ease(u));
      if (u >= 1) {
        this.jobs.splice(i, 1);
        j.done();
      }
    }
    return dt;
  }
  tween(dur, fn, ease = E.linear) {
    return new Promise((done) => {
      if (dur <= 0) {
        fn?.(1);
        return done();
      }
      fn?.(0);
      this.jobs.push({ dur, fn, ease, el: 0, done });
    });
  }
  wait(dur) {
    return this.tween(dur, null);
  }
}

/** 감쇠 스프링 하나 (값이 target 으로 출렁이며 돌아옴) */
export class Spring {
  constructor(value = 0, stiff = 420, damp = 16) {
    this.v = value;
    this.target = value;
    this.vel = 0;
    this.k = stiff;
    this.c = damp;
  }
  kick(dv) {
    this.vel += dv;
  }
  set(v) {
    this.v = v;
  }
  step(dt) {
    if (!dt) return;
    // 큰 dt 에도 안정적이도록 잘게 나눠서
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.k * (this.v - this.target) - this.c * this.vel;
      this.vel += a * h;
      this.v += this.vel * h;
    }
  }
}
