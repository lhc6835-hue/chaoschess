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

let homeView = null;
let idleTimer = 0;

function go(name) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== name;
  $("#action-menu").hidden = true;
  clearInterval(idleTimer);
  homeView?.pause();
  if (name !== "battle") battleView()?.pause();
  if (name === "home") renderHome();
  if (name === "shop") renderShop();
  if (name === "formation") renderFormation();
  window.scrollTo(0, 0);
}

function renderHome() {
  const d = load();
  setGold($("#home-gold"), d.gold);
  $("#home-best").textContent = d.best ?? 0;
  const hasKing = Object.values(d.formation).some((uid) => d.owned.find((u) => u.uid === uid)?.key === "king");
  $("#home-hint").textContent = hasKing ? "" : "편성에 킹이 있어야 출전할 수 있어요.";

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
    if (vp && !vp.z) homeView.hop(vp, vp.x, vp.y, { height: 7 + Math.random() * 6, dur: 0.26 });
  }, 900);
}

function init() {
  load();
  for (const b of document.querySelectorAll("[data-go]"))
    b.addEventListener("click", () => {
      const to = b.dataset.go;
      if (to === "battle") {
        go("battle");
        if (!startRun()) {
          toast("편성에 킹을 넣어야 출전할 수 있어요.");
          go("formation");
        }
        return;
      }
      go(to);
    });
  bindFormation();
  bindBattle(go);
  document.fonts?.ready.then(() => homeView?.resize());
  go("home");
}

init();
