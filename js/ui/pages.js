// 도감, 기록, 게임 방법, 메인 화면 옆 패널.
import { PIECES, RARITY, LORE } from "../data/pieces.js";
import { load } from "../save.js";
import { $, h, spriteCanvas, rarityTag, patternGrid, abilityLine, setGold } from "./common.js";

// ── 메인 화면 옆 패널 ───────────────────────────────────────────
const TIPS = [
  "방패병 옆에 궁수나 술사를 붙여 두면 받는 피해가 1씩 줄어요.",
  "근접 기물은 적을 쓰러뜨리면 그 칸으로 전진해요. 너무 깊이 들어가지 않게 조심하세요.",
  "빙결술사가 얼린 적은 다음 턴에 움직이지 못해요. 위험한 적부터 얼려 두세요.",
  "네크로맨서 근처에서 적이 쓰러지면 그 자리에 보라색 해골이 일어나 내 편이 돼요.",
  "화염구는 3×3 범위라 적이 뭉쳐 있을 때 쓰면 효과가 커요.",
  "암살자는 체력이 가득 찬 적에게 두 배 피해를 줘요. 다치지 않은 강한 적을 노리세요.",
  "웨이브 사이에는 아래 두 줄 안에서 자리를 바꿀 수 있어요. 다친 기물은 뒤로 빼 주세요.",
  "다섯 번째 웨이브마다 마왕이 나와요. 세 턴마다 임프를 부르니 빨리 잡는 게 좋아요.",
  "폰이 끝줄에 닿으면 퀸으로 승급해요. 승급한 퀸은 그 출전이 끝날 때까지 유지돼요.",
  "시간술사의 시간 가속을 쓰면 그 턴이 끝나지 않아요. 한 번 더 움직일 수 있어요.",
  "쓰지 않는 기물은 편성 화면에서 반값에 팔 수 있어요.",
  "광전사는 적을 쓰러뜨릴 때마다 공격력이 1씩 올라요. 약한 적부터 먹여 키우세요.",
];
let tipIndex = Math.floor(Math.random() * TIPS.length);

export function renderHomeSide() {
  const d = load();
  const placed = Object.values(d.formation).map((uid) => d.owned.find((u) => u.uid === uid)).filter(Boolean);
  const hp = placed.reduce((a, u) => a + PIECES[u.key].hp, 0);
  const atk = placed.reduce((a, u) => a + PIECES[u.key].atk, 0);
  const kv = (k, v, cls = "") => [h("dt", {}, k), h("dd", { class: cls }, v)];
  $("#home-army").replaceChildren(
    ...kv("골드", d.gold + "G", "gold"),
    ...kv("최고 웨이브", d.best ?? 0),
    ...kv("보유 기물", d.owned.length + "기"),
    ...kv("출전 편성", `${placed.length} / 16`),
    ...kv("편성 체력 합", hp),
    ...kv("편성 공격력 합", atk),
  );
  const recent = d.history.slice(0, 4);
  $("#home-recent").replaceChildren(
    ...(recent.length
      ? recent.map((r) => h("li", { class: r.result === "retreat" ? "win" : "" }, h("span", {}, ago(r.at)), h("b", {}, `웨이브 ${r.wave}`), h("span", {}, `${r.kills}기 처치`)))
      : [h("li", { class: "empty" }, "아직 출전 기록이 없어요. 첫 출전을 시작해 보세요.")]),
  );
  showTip();
}

function showTip() {
  $("#home-tip").textContent = TIPS[tipIndex % TIPS.length];
}

export function bindHomeSide() {
  $("#home-tip-next").addEventListener("click", () => {
    tipIndex++;
    showTip();
  });
}

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const hh = Math.round(m / 60);
  if (hh < 24) return `${hh}시간 전`;
  return `${Math.round(hh / 24)}일 전`;
}

// ── 도감 ─────────────────────────────────────────────────────────
let codexFilter = "all";
let codexPick = "pawn";
const CODEX_ORDER = Object.keys(PIECES).sort(
  (a, b) => RARITY[PIECES[a].rarity].order - RARITY[PIECES[b].rarity].order || PIECES[a].price - PIECES[b].price,
);

function known(key, d) {
  const def = PIECES[key];
  if (!def.enemyOnly && !def.summon) return true; // 아군 기물은 상점에서 볼 수 있으니 항상 공개
  return !!d.seen[key];
}

export function renderCodex() {
  const d = load();
  const total = CODEX_ORDER.length, found = CODEX_ORDER.filter((k) => known(k, d)).length;
  $("#codex-count").textContent = `발견 ${found} / ${total}`;
  const tabs = [["all", "전체"], ["ally", "아군 기물"], ["foe", "적·소환"]];
  $("#codex-filters").replaceChildren(
    ...tabs.map(([k, label]) => h("button", { "aria-pressed": String(codexFilter === k), onclick: () => ((codexFilter = k), renderCodex()) }, label)),
  );
  const keys = CODEX_ORDER.filter((k) => {
    const def = PIECES[k];
    if (codexFilter === "ally") return !def.enemyOnly && !def.summon;
    if (codexFilter === "foe") return def.enemyOnly || def.summon;
    return true;
  });
  $("#codex-grid").replaceChildren(
    ...keys.map((k) => {
      const ok = known(k, d);
      const team = PIECES[k].enemyOnly ? "enemy" : PIECES[k].summon ? "summon" : "ally";
      return h("button", { class: `codex-item ${ok ? "" : "unknown"} ${codexPick === k ? "sel" : ""}`, onclick: () => ((codexPick = k), renderCodex()) },
        h("div", { class: "pic" }, spriteCanvas(k, team, 3)),
        h("span", {}, ok ? PIECES[k].name : "???"),
      );
    }),
  );
  renderCodexDetail(d);
}

function renderCodexDetail(d) {
  const k = codexPick, def = PIECES[k], el = $("#codex-detail");
  if (!known(k, d)) {
    el.replaceChildren(
      h("div", { class: "stage" }, spriteCanvas(k, "enemy", 5)),
      h("h4", {}, "???"),
      h("p", { class: "lore" }, "아직 만나지 못한 존재예요. 웨이브를 더 깊이 나아가면 마주칠 거예요."),
    );
    el.querySelector("canvas").style.filter = "brightness(0)";
    return;
  }
  const teams = def.enemyOnly ? ["enemy"] : def.summon ? ["summon", "enemy"] : ["ally", "enemy"];
  const owned = d.owned.filter((u) => u.key === k).length;
  el.replaceChildren(
    h("div", { class: "stage" }, ...teams.map((t) => spriteCanvas(k, t, 5))),
    h("h4", {}, def.name, rarityTag(k)),
    h("p", { class: "lore" }, LORE[k] ?? ""),
    h("div", { class: "row" },
      h("span", {}, "체력 ", h("b", {}, def.hp)),
      h("span", {}, "공격 ", h("b", {}, def.atk)),
      h("span", {}, def.style === "ranged" ? "원거리" : "근접"),
      def.noShop ? h("span", {}, def.enemyOnly ? "적 전용" : "소환 전용") : h("span", {}, "가격 ", h("b", {}, def.price), " 골드"),
      !def.enemyOnly && !def.summon ? h("span", {}, "보유 ", h("b", {}, owned)) : null,
    ),
    h("div", { class: "pattern" }, patternGrid(k), h("span", { class: "legend" }, h("i", { style: "background:#a8d8c8" }), "이동", h("i", { style: "background:var(--ember)" }), "공격")),
    h("p", { class: "lore" }, def.desc),
    abilityLine(def) ?? "",
  );
}

// ── 기록 ─────────────────────────────────────────────────────────
export function renderRecords() {
  const d = load();
  setGold($("#records-gold"), d.gold);
  const s = d.stats;
  const tile = (label, v) => h("div", { class: "tile" }, h("span", {}, label), h("b", {}, v));
  $("#records-tiles").replaceChildren(
    tile("출전 횟수", d.runs ?? 0),
    tile("최고 웨이브", d.best ?? 0),
    tile("누적 처치", s.kills),
    tile("마왕 처치", s.bossKills),
    tile("번 골드", s.goldEarned + "G"),
    tile("잃은 기물", s.deaths),
  );
  $("#records-history").replaceChildren(
    ...(d.history.length
      ? d.history.map((r) =>
          h("li", {},
            h("span", { class: "when" }, ago(r.at)),
            h("span", {}, `웨이브 ${r.wave} 클리어`, h("span", { class: "res" + (r.result === "retreat" ? " ok" : "") }, r.result === "retreat" ? "  귀환" : "  패배")),
            h("span", {}, `${r.kills}기 처치`),
            h("span", { class: "g" }, `+${r.gold}G`),
          ),
        )
      : [h("li", { class: "empty" }, "아직 기록이 없어요. 출전하면 여기에 쌓여요.")]),
  );
  // 가장 많이 가진 기물 (킹 제외)
  const count = {};
  for (const u of d.owned) if (u.key !== "king") count[u.key] = (count[u.key] ?? 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1] || PIECES[b[0]].price - PIECES[a[0]].price).slice(0, 8);
  $("#records-army").replaceChildren(
    ...(top.length
      ? top.map(([k, n]) => h("li", {}, spriteCanvas(k, "ally", 2), h("span", {}, PIECES[k].name, " ", rarityTag(k)), h("em", {}, `${n}기`)))
      : [h("li", { class: "empty" }, "보유한 기물이 없어요.")]),
  );
}

// ── 게임 방법 ────────────────────────────────────────────────────
export function renderHelp() {
  const sec = (title, illu, ...body) => h("section", { class: "panel" }, h("h3", {}, title), illu ? h("div", { class: "illu" }, ...illu) : null, ...body);
  const p = (t) => h("p", {}, t);
  const ul = (...items) => h("ul", {}, ...items.map((i) => h("li", {}, i)));
  $("#help-grid").replaceChildren(
    sec("목표", [spriteCanvas("king", "ally", 4), spriteCanvas("demon", "enemy", 3)],
      p("몰려오는 적을 웨이브마다 모두 쓰러뜨리면 돼요. 내 킹이 쓰러지면 출전이 끝나요."),
      p("웨이브가 오를수록 적이 많아지고 강해져요. 다섯 번째 웨이브마다 마왕이 나와요.")),
    sec("한 턴의 흐름", [spriteCanvas("knight", "ally", 4), patternGrid("knight")],
      ul("내 기물을 누르면 갈 수 있는 칸(점), 공격할 수 있는 칸(빨간 테두리), 능력을 쓸 수 있는 칸(보라 테두리)이 보여요.",
        "칸을 누르면 이동, 공격, 능력 중에서 고를 수 있어요.",
        "한 턴에 기물 하나만 움직여요. 그다음엔 적이 한 번 움직여요.",
        "움직일 게 없으면 턴 넘기기를 누르세요.")),
    sec("공격과 체력", [spriteCanvas("rook", "ally", 4), spriteCanvas("pawn", "enemy", 4)],
      ul("모든 기물에 체력이 있어요. 공격하면 공격력만큼 체력이 줄어요.",
        "근접 기물은 적을 쓰러뜨리면 그 칸으로 전진하고, 원거리 기물은 제자리에서 쏴요.",
        "폰이 끝줄에 닿으면 퀸으로 승급해요.")),
    sec("웨이브 사이", [spriteCanvas("priest", "ally", 4), spriteCanvas("shield", "ally", 4)],
      ul("쓰러진 기물은 그 출전에서 돌아오지 않아요.",
        "살아남은 기물은 처음 자리로 돌아가고, 최대 체력의 20%를 회복해요.",
        "다음 웨이브 전에 아래 두 줄 안에서 자리를 바꿀 수 있어요.")),
    sec("성장", [spriteCanvas("dragon", "ally", 4), spriteCanvas("necro", "ally", 4), spriteCanvas("skeleton", "summon", 4)],
      ul("적을 쓰러뜨리고 웨이브를 넘길 때마다 골드를 받아요. 귀환하거나 져도 번 골드는 남아요.",
        "상점에서 일반부터 전설까지 특수 능력 기물을 데려올 수 있어요.",
        "편성에서 앞줄 8칸, 뒷줄 8칸을 채워요. 킹은 꼭 넣어야 해요.")),
    sec("조작", null,
      ul(h("span", {}, h("span", { class: "key" }, "Esc"), " 선택 취소, 메뉴 닫기"),
        "왼쪽 아래 막대 버튼에서 배경음악과 효과음 크기를 바꿀 수 있어요.",
        "전투 화면 왼쪽 목록에서 기물을 누르면 정보를 볼 수 있어요.")),
  );
}
