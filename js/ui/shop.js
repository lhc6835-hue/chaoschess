// 상점: 등급별 카드, 패턴 미니맵, 구매.
import { PIECES, RARITY, SHOP_KEYS } from "../data/pieces.js";
import { load, buy } from "../save.js";
import { $, h, spriteCanvas, toast, setGold, rarityTag, patternGrid, abilityLine } from "./common.js";

let filter = "all";

export function renderShop() {
  const d = load();
  setGold($("#shop-gold"), d.gold);
  const filters = $("#shop-filters");
  const tiers = ["all", "base", "common", "rare", "epic", "legend"];
  filters.replaceChildren(
    ...tiers.map((t) =>
      h("button", { "aria-pressed": String(filter === t), onclick: () => ((filter = t), renderShop()) }, t === "all" ? "전체" : RARITY[t].name),
    ),
  );
  const keys = SHOP_KEYS.filter((k) => filter === "all" || PIECES[k].rarity === filter).sort(
    (a, b) => RARITY[PIECES[a].rarity].order - RARITY[PIECES[b].rarity].order || PIECES[a].price - PIECES[b].price,
  );
  const grid = $("#shop-grid");
  grid.replaceChildren(...keys.map((k) => card(k, d)));
}

function card(key, d) {
  const def = PIECES[key];
  const owned = d.owned.filter((u) => u.key === key).length;
  const afford = d.gold >= def.price;
  const btn = h("button", { class: "btn btn-small " + (afford ? "btn-main" : ""), disabled: !afford, "data-sfx": "buy" }, "구매");
  btn.addEventListener("click", () => {
    const u = buy(key);
    if (!u) return toast("골드가 부족합니다.");
    toast(`${def.name}을(를) 데려왔습니다.`);
    renderShop();
  });
  return h("article", { class: "card" },
    h("div", { class: "pic" }, spriteCanvas(key, "ally", 3)),
    h("h4", {}, def.name, rarityTag(key)),
    h("div", { class: "nums" }, h("span", {}, "체력 ", h("b", {}, def.hp)), h("span", {}, "공격 ", h("b", {}, def.atk)), h("span", {}, def.style === "ranged" ? "원거리" : "근접")),
    h("p", { class: "desc" }, def.desc),
    abilityLine(def),
    h("div", { class: "pattern" }, patternGrid(key), h("span", { class: "legend" }, h("i", { style: "background:#a8d8c8" }), "이동", h("i", { style: "background:var(--ember)" }), "공격")),
    h("div", { class: "buy" }, h("span", { class: "price" }, def.price, "G"), h("span", { class: "owned" }, `보유 ${owned}`), btn),
  );
}
