// 편성: 앞줄(8)·뒷줄(8) 칸에 보유 기물 배치. 고르고 → 칸 누르기, 배치된 것끼리는 자리 교환.
import { PIECES, STARTER, RARITY } from "../data/pieces.js";
import { load, save, sell, SLOT_COUNT } from "../save.js";
import { $, h, spriteCanvas, toast, setGold, rarityTag, abilityLine, patternGrid } from "./common.js";
import { sfx } from "../audio.js";

let picked = null; // { uid, from: "roster" | slotIndex }

// 화면에는 앞줄(슬롯 8~15)이 위, 뒷줄(0~7)이 아래
const ORDER = [8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7];

export function renderFormation() {
  const d = load();
  setGold($("#form-gold"), d.gold);
  const byUid = Object.fromEntries(d.owned.map((u) => [u.uid, u]));
  const placed = new Set(Object.values(d.formation));

  const board = $("#form-board");
  board.replaceChildren(
    ...ORDER.map((slot, i) => {
      const uid = d.formation[slot];
      const u = uid && byUid[uid];
      const light = (i % 8 + Math.floor(i / 8)) % 2 === 0;
      const el = h("button", {
        class: `slot ${light ? "l" : "d"} ${picked && picked.from === slot ? "sel" : ""} ${picked && picked.from !== slot ? "target" : ""}`,
        "aria-label": u ? PIECES[u.key].name : "빈 칸",
        onclick: () => clickSlot(slot),
      });
      if (u) el.append(spriteCanvas(u.key, "ally", 3));
      return el;
    }),
  );

  const roster = $("#form-roster");
  const waiting = d.owned.filter((u) => !placed.has(u.uid));
  roster.replaceChildren(
    ...(waiting.length
      ? waiting.map((u) =>
          h("button", { class: "roster-item " + (picked?.uid === u.uid ? "sel" : ""), onclick: () => pickRoster(u.uid) }, spriteCanvas(u.key, "ally", 2), h("span", {}, PIECES[u.key].name)),
        )
      : [h("p", { class: "empty" }, "모든 기물이 배치되어 있습니다. 상점에서 더 데려올 수 있습니다.")]),
  );

  $("#form-count").textContent = `배치 ${placed.size} / ${SLOT_COUNT}`;
  // 편성 요약: 체력·공격 합, 원거리 수, 등급 분포
  const units = [...placed].map((id) => byUid[id]).filter(Boolean).map((u) => PIECES[u.key]);
  const stat = (label, v) => h("div", {}, h("span", {}, label), h("b", {}, v));
  const bar = h("div", { class: "rarbar", title: "등급 분포" });
  for (const r of ["base", "common", "rare", "epic", "legend"]) {
    const n = units.filter((u) => u.rarity === r).length;
    if (n) bar.append(h("i", { style: `width:${(n / units.length) * 100}%;background:${RARITY[r].color}`, title: `${RARITY[r].name} ${n}` }));
  }
  $("#form-summary").replaceChildren(
    stat("체력 합", units.reduce((a, u) => a + u.hp, 0)),
    stat("공격력 합", units.reduce((a, u) => a + u.atk, 0)),
    stat("원거리", units.filter((u) => u.style === "ranged").length + "기"),
    stat("능력 보유", units.filter((u) => u.ability || u.passive).length + "기"),
    bar,
  );
  const pu = picked && byUid[picked.uid];
  $("#form-unplace").disabled = !(picked && picked.from !== "roster");
  $("#form-sell").disabled = !pu || PIECES[pu.key].unique;
  $("#form-sell").textContent = pu && !PIECES[pu.key].unique ? `판매 +${Math.floor(PIECES[pu.key].price / 2)}G` : "판매";
  const detail = $("#form-detail");
  if (pu) {
    const def = PIECES[pu.key];
    detail.replaceChildren(
      h("div", { class: "detail-head" }, spriteCanvas(pu.key, "ally", 4), h("div", {}, h("b", {}, def.name, " "), rarityTag(pu.key), h("p", { class: "muted" }, `체력 ${def.hp}, 공격 ${def.atk}, ${def.style === "ranged" ? "원거리" : "근접"}`))),
      h("p", {}, def.desc),
      h("div", { class: "pattern" }, patternGrid(pu.key), h("span", { class: "legend" }, h("i", { style: "background:#a8d8c8" }), "이동", h("i", { style: "background:var(--ember)" }), "공격")),
      abilityLine(def) ?? "",
    );
  } else
    detail.replaceChildren(
      h("b", {}, "기물을 골라 보십시오"),
      h("p", { class: "muted" }, "위 대기 목록이나 편성 칸의 기물을 누르면 체력, 공격력, 능력이 여기에 나옵니다. 고른 상태에서 다른 칸을 누르면 자리가 바뀝니다."),
    );
}

function pickRoster(uid) {
  picked = picked?.uid === uid ? null : { uid, from: "roster" };
  renderFormation();
}

function clickSlot(slot) {
  const d = load();
  const here = d.formation[slot];
  if (!picked) {
    if (here) picked = { uid: here, from: slot };
  } else if (picked.from === slot) {
    picked = null;
  } else {
    if (picked.from === "roster") {
      d.formation[slot] = picked.uid; // 있던 기물은 대기열로
    } else {
      d.formation[picked.from] = here;
      if (!here) delete d.formation[picked.from];
      d.formation[slot] = picked.uid;
    }
    picked = null;
    save();
    sfx("place", { delay: 0.04 });
  }
  renderFormation();
}

export function bindFormation() {
  $("#form-unplace").addEventListener("click", () => {
    if (!picked || picked.from === "roster") return;
    const d = load();
    delete d.formation[picked.from];
    picked = null;
    save();
    renderFormation();
  });
  $("#form-sell").addEventListener("click", () => {
    if (!picked) return;
    const d = load();
    const u = d.owned.find((o) => o.uid === picked.uid);
    const got = sell(picked.uid);
    if (got) {
      toast(`${PIECES[u.key].name}을(를) 팔고 ${got}G를 받았습니다.`);
      sfx("coin");
    }
    picked = null;
    renderFormation();
  });
  $("#form-auto").addEventListener("click", () => {
    autoFormation();
    picked = null;
    renderFormation();
    toast("강한 기물부터 자동으로 배치했습니다.");
  });
}

/** 킹은 뒷줄 가운데, 단단한 근접은 앞줄, 원거리·마법사는 뒷줄 */
export function autoFormation() {
  const d = load();
  const pool = [...d.owned].sort((a, b) => PIECES[b.key].price - PIECES[a.key].price);
  d.formation = {};
  const king = pool.find((u) => u.key === "king");
  const rest = pool.filter((u) => u !== king).slice(0, king ? 15 : 16);
  if (king) d.formation[4] = king.uid;
  const frontish = (k) => ["pawn", "shield", "spearman", "berserker", "paladin", "knight", "assassin"].includes(k);
  const backCols = [3, 5, 2, 6, 1, 7, 0, 4];
  const frontCols = [3, 4, 2, 5, 1, 6, 0, 7];
  for (const u of rest) {
    const wantFront = frontish(u.key);
    const tryRows = wantFront ? ["f", "b"] : ["b", "f"];
    let done = false;
    for (const r of tryRows) {
      for (const c of r === "f" ? frontCols : backCols) {
        const slot = r === "f" ? 8 + c : c;
        if (!d.formation[slot]) {
          d.formation[slot] = u.uid;
          done = true;
          break;
        }
      }
      if (done) break;
    }
  }
  save();
}

export { STARTER };
