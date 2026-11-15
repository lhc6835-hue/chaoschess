// 화면 전환과 메인 화면.
import { load, slotToCell } from "./save.js";
import { PIECES } from "./data/pieces.js";
import { makeWave } from "./data/waves.js";
import { BoardView } from "./render/board-view.js";
import { createBattle, makeUnit } from "./game/battle.js";
import { $, setGold, toast } from "./ui/common.js";
import { renderShop } from "./ui/shop.js";
import { renderFormation, bindFormation } from "./ui/formation.js";
import { bindBattle, startRun, battleView } from "./ui/battle.js";
import { cover, reveal, isBusy } from "./ui/transition.js";
import { unlock, music, sfx, getPrefs, setPrefs } from "./audio.js";

let homeView = null;
let idleTimer = 0;

function show(name) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== name;
  $("#action-menu").hidden = true;
  clearInterval(idleTimer);
  homeView?.pause();
  if (name !== "battle") battleView()?.pause();
  if (name === "home") renderHome();
  if (name === "shop") renderShop();
  if (name === "formation") renderFormation();
  if (name !== "battle") music("menu");
  window.scrollTo(0, 0);
}

/** 체스판 전환을 거쳐 화면 이동. style: board | battle | defeat */
async function navigate(name, style = "board") {
  if (isBusy()) return;
  await cover(style);
  show(name);
  if (name === "battle" && !startRun()) {
    show("formation");
    toast("편성에 킹을 넣어야 출전할 수 있어요.");
  }
  await reveal();
}

function hasKing() {
  const d = load();
  return Object.values(d.formation).some((uid) => d.owned.find((u) => u.uid === uid)?.key === "king");
}

function renderHome() {
  const d = load();
  setGold($("#home-gold"), d.gold);
  $("#home-best").textContent = d.best ?? 0;
  $("#home-hint").textContent = hasKing() ? "" : "편성에 킹이 있어야 출전할 수 있어요.";

  // 메인 화면 보드: 내 편성 + 첫 웨이브 적이 서로 마주보며 들썩여요
  const host = $("#home-board");
  if (!homeView) {
    const c = document.createElement("canvas");
    host.append(c);
    homeView = new BoardView(c);
    homeView.onCell = (cell) => {
      const vp = cell && [...homeView.vps.values()].find((v) => v.cx === cell.x && v.cy === cell.y);
      if (vp) {
        vp.sq.v = 0.7;
        vp.sq.vel = 0;
        homeView.hop(vp, vp.x, vp.y, { height: 12, dur: 0.3 });
      }
    };
  }
  homeView.resume();
  const s = createBattle({ wave: 1, seed: 7 });
  for (const [slot, uid] of Object.entries(d.formation)) {
    const o = d.owned.find((u) => u.uid === uid);
    if (!o || !PIECES[o.key]) continue;
    const c = slotToCell(Number(slot));
    makeUnit(s, o.key, "ally", c.x, c.y);
  }
  for (const e of makeWave(1, 7)) makeUnit(s, e.key, "enemy", e.x, e.y);
  homeView.vps.clear();
  homeView.sync(s, { snap: true });
  requestAnimationFrame(() => homeView.resize());
  idleTimer = setInterval(() => {
    const list = [...homeView.vps.values()];
    const vp = list[Math.floor(Math.random() * list.length)];
    if (vp && !vp.z) homeView.hop(vp, vp.x, vp.y, { height: 7 + Math.random() * 6, dur: 0.26, silent: true });
  }, 900);
}

// ── 소리 설정 ───────────────────────────────────────────────────
function bindSound() {
  const btn = $("#sound-btn"), panel = $("#sound-panel");
  const m = $("#vol-music"), f = $("#vol-sfx"), mute = $("#vol-mute");
  const sync = () => {
    const p = getPrefs();
    m.value = Math.round(p.music * 100);
    f.value = Math.round(p.sfx * 100);
    mute.checked = p.muted;
    btn.classList.toggle("off", p.muted);
    btn.setAttribute("aria-label", p.muted ? "소리 꺼짐" : "소리 설정");
  };
  sync();
  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });
  m.addEventListener("input", () => setPrefs({ music: m.value / 100 }));
  f.addEventListener("input", () => setPrefs({ sfx: f.value / 100 }));
  f.addEventListener("change", () => sfx("hit"));
  mute.addEventListener("change", () => {
    setPrefs({ muted: mute.checked });
    sync();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) panel.hidden = true;
  });
}

function bindUiSounds() {
  // 첫 입력에서 오디오 켜기 (브라우저 자동재생 정책)
  const first = () => unlock();
  window.addEventListener("pointerdown", first, { capture: true });
  window.addEventListener("keydown", first, { capture: true });
  // 버튼류 공통 클릭/호버 소리
  const sel = ".btn, .slot, .roster-item, .filters button, #sound-btn";
  document.addEventListener("click", (e) => {
    const el = e.target.closest(sel);
    if (!el || el.disabled || el.dataset.sfx === "none") return;
    sfx(el.dataset.sfx || (el.classList.contains("k-cancel") ? "back" : "click"), { vol: 0.7 });
  });
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest(".btn, .card, .roster-item");
    if (!el || el.disabled || e.pointerType !== "mouse" || el.contains(e.relatedTarget)) return;
    sfx("hover", { vol: 0.25, gap: 70 });
  });
}

function init() {
  load();
  for (const b of document.querySelectorAll("[data-go]"))
    b.addEventListener("click", () => {
      const to = b.dataset.go;
      if (to === "battle") {
        if (!hasKing()) {
          sfx("error");
          toast("편성에 킹을 넣어야 출전할 수 있어요.");
          return;
        }
        navigate("battle", "battle");
        return;
      }
      navigate(to);
    });
  bindFormation();
  bindBattle(navigate);
  bindSound();
  bindUiSounds();
  document.fonts?.ready.then(() => homeView?.resize());
  show("home");
}

init();
