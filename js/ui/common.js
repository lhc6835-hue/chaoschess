// 화면 공용 도우미: 스프라이트 캔버스, 토스트, 모달, 골드 표시, 패턴 미니맵.
import { sprite } from "../render/sprites.js";
import { PIECES, RARITY } from "../data/pieces.js";
import { createBattle, makeUnit, moveTargets, attackTargets } from "../game/battle.js";

export const $ = (s, root = document) => root.querySelector(s);
export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
};

export function spriteCanvas(key, team = "ally", scale = 3) {
  const s = sprite(key, team);
  const c = document.createElement("canvas");
  c.width = s.w * scale;
  c.height = s.h * scale;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(s.img, 0, 0, c.width, c.height);
  return c;
}

let toastTimer = 0;
export function toast(msg, ms = 1800) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

export function modal(content, buttons = []) {
  return new Promise((resolve) => {
    const box = $("#modal-box");
    box.replaceChildren(...[content].flat());
    const row = h("div", { class: "row" });
    for (const b of buttons)
      row.append(h("button", { class: "btn " + (b.cls ?? ""), onclick: () => ((($("#modal").hidden = true)), resolve(b.value)) }, b.label));
    box.append(row);
    $("#modal").hidden = false;
    row.querySelector("button")?.focus();
  });
}

export function setGold(el, value) {
  const prev = Number(el.textContent);
  el.textContent = value;
  if (prev !== value) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }
}

export function rarityTag(key) {
  const r = RARITY[PIECES[key].rarity];
  return h("span", { class: "rar", style: `color:${r.color}` }, r.name);
}

/** 7×7 이동(청록)/공격(빨강) 패턴 미니맵 */
export function patternGrid(key) {
  const s = createBattle({ wave: 1, seed: 1 });
  const me = makeUnit(s, key, "ally", 3, 4);
  const mv = new Set(moveTargets(s, me).map((c) => c.x + "," + c.y));
  const at = new Set();
  for (let y = 1; y <= 7; y++)
    for (let x = 0; x <= 6; x++) {
      if (x === 3 && y === 4) continue;
      const foe = makeUnit(s, "pawn", "enemy", x, y);
      if (attackTargets(s, me).some((c) => c.x === x && c.y === y)) at.add(x + "," + y);
      s.units.pop();
    }
  const grid = h("div", { class: "grid7", "aria-hidden": "true" });
  for (let y = 1; y <= 7; y++)
    for (let x = 0; x <= 6; x++) {
      const k = x + "," + y;
      const cls = x === 3 && y === 4 ? "me" : mv.has(k) && at.has(k) ? "both" : mv.has(k) ? "mv" : at.has(k) ? "at" : "";
      grid.append(h("i", { class: cls }));
    }
  return grid;
}

export function abilityLine(def) {
  if (def.ability) return h("div", { class: "ab ability" }, h("b", {}, def.ability.name), ` (재사용 ${def.ability.cd}턴): ${def.ability.desc}`);
  return null;
}
