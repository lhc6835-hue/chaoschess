// 편성: 앞줄(8)·뒷줄(8) 칸에 보유 기물 배치. 고르고 → 칸 누르기, 배치된 것끼리는 자리 교환.
import { PIECES, STARTER } from "../data/pieces.js";
import { load, save, sell, SLOT_COUNT } from "../save.js";
import { $, h, spriteCanvas, toast, setGold, rarityTag, abilityLine } from "./common.js";
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
      : [h("p", { class: "empty" }, "모든 기물이 배치되어 있어요. 상점에서 더 데려올 수 있어요.")]),
  );

  $("#form-count").textContent = `배치 ${placed.size} / ${SLOT_COUNT}`;
  const pu = picked && byUid[picked.uid];
  $("#form-unplace").disabled = !(picked && picked.from !== "roster");
  $("#form-sell").disabled = !pu || PIECES[pu.key].unique;
  $("#form-sell").textContent = pu && !PIECES[pu.key].unique ? `판매 +${Math.floor(PIECES[pu.key].price / 2)}G` : "판매";
  const detail = $("#form-detail");
  if (pu) {
    const def = PIECES[pu.key];
    detail.replaceChildren(h("b", {}, def.name, " "), rarityTag(pu.key), h("p", { class: "muted" }, `체력 ${def.hp}, 공격 ${def.atk}. ${def.desc}`), abilityLine(def) ?? "");
  } else detail.replaceChildren();
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
      toast(`${PIECES[u.key].name}을(를) 팔고 ${got}G를 받았어요.`);
      sfx("coin");
    }
    picked = null;
    renderFormation();
  });
  $("#form-auto").addEventListener("click", () => {
    autoFormation();
    picked = null;
    renderFormation();
    toast("강한 기물부터 자동으로 배치했어요.");
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
