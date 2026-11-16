// 기물 정의. 이동(move)과 공격(attack) 패턴, 능력(ability), 패시브(passive), 등급과 가격.
// 좌표: x 오른쪽, y 아래. 아군의 "앞"은 y-1, 적의 "앞"은 y+1.

export const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const ALL = [...ORTHO, ...DIAG];
export const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

export const RARITY = {
  base: { name: "기본", color: "#b9b2a3", order: 0 },
  common: { name: "일반", color: "#8fd18b", order: 1 },
  rare: { name: "희귀", color: "#6fb7ff", order: 2 },
  epic: { name: "영웅", color: "#c58cff", order: 3 },
  legend: { name: "전설", color: "#ffbf47", order: 4 },
  boss: { name: "보스", color: "#ff6b6b", order: 5 },
};

// move / attack 패턴
//  { slide: dirs, range }   : 방향으로 range칸까지, 막히면 멈춤
//  { leap: offsets }        : 해당 위치로 점프
//  { pawn: true }           : 폰 규칙 (앞 1칸, 첫 이동 2칸 / 공격은 앞 대각선)
//  { blink: r }             : 체비셰프 거리 r 이내 빈칸 아무 곳
//  attack.min               : 최소 거리 (원거리 유닛)
//  attack.pierce            : 직선 위 적 전부 타격 (막히지 않음)
// style: "melee" (처치 시 그 칸으로 전진) / "ranged" (제자리)

export const PIECES = {
  // ── 기본 체스 기물 ──────────────────────────────────────────
  pawn: {
    name: "폰", rarity: "base", price: 20, hp: 3, atk: 1,
    move: { pawn: true }, attack: { pawnAttack: true }, style: "melee", fx: "jab",
    desc: "앞으로 한 칸(첫 이동은 두 칸), 공격은 앞 대각선. 끝줄에 닿으면 퀸으로 승급합니다.",
  },
  knight: {
    name: "나이트", rarity: "base", price: 60, hp: 5, atk: 2,
    move: { leap: KNIGHT }, attack: { leap: KNIGHT }, style: "melee", fx: "hoof",
    desc: "L자로 뛰어넘습니다. 다른 기물에 막히지 않습니다.",
  },
  bishop: {
    name: "비숍", rarity: "base", price: 60, hp: 4, atk: 2,
    move: { slide: DIAG, range: 7 }, attack: { slide: DIAG, range: 7 }, style: "melee", fx: "lightcut",
    desc: "대각선으로 끝까지 움직이고 공격합니다.",
  },
  rook: {
    name: "룩", rarity: "base", price: 80, hp: 6, atk: 2,
    move: { slide: ORTHO, range: 7 }, attack: { slide: ORTHO, range: 7 }, style: "melee", fx: "crush",
    desc: "가로세로로 끝까지 움직이고 공격합니다. 단단합니다.",
  },
  queen: {
    name: "퀸", rarity: "rare", price: 180, hp: 6, atk: 3,
    move: { slide: ALL, range: 7 }, attack: { slide: ALL, range: 7 }, style: "melee", fx: "crossCut",
    desc: "여덟 방향으로 끝까지. 가장 자유로운 기물입니다.",
  },
  king: {
    name: "킹", rarity: "base", price: 0, hp: 10, atk: 2, unique: true, noShop: true,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "royal",
    desc: "주위 한 칸. 킹이 쓰러지면 출전이 끝납니다.",
  },

  // ── 일반 ───────────────────────────────────────────────────
  spearman: {
    name: "창병", rarity: "common", price: 50, hp: 5, atk: 2,
    move: { slide: ORTHO, range: 1 }, attack: { slide: ORTHO, range: 2, pierce: true }, style: "ranged", fx: "thrust",
    desc: "가로세로 두 칸을 꿰뚫어 그 줄의 적을 모두 찌릅니다.",
  },
  archer: {
    name: "궁수", rarity: "common", price: 70, hp: 3, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 4, min: 2 }, style: "ranged", fx: "arrow",
    desc: "2~4칸 떨어진 적을 쏩니다. 바로 옆은 쏘지 못합니다.",
  },
  shield: {
    name: "방패병", rarity: "common", price: 70, hp: 9, atk: 1,
    move: { slide: ORTHO, range: 1 }, attack: { slide: ORTHO, range: 1 }, style: "melee", fx: "bash",
    passive: "guard",
    desc: "수호: 옆에 붙어 있는 아군이 받는 피해가 1 줄어듭니다.",
  },

  // ── 희귀 ───────────────────────────────────────────────────
  pyro: {
    name: "화염술사", rarity: "rare", price: 150, hp: 4, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "ember",
    ability: { id: "fireball", name: "화염구", cd: 3, range: 3, desc: "3칸 이내 지점에 화염구. 3×3 범위의 적에게 2 피해." },
    desc: "작은 불씨를 쏘고, 화염구로 몰려 있는 적을 태웁니다.",
  },
  frost: {
    name: "빙결술사", rarity: "rare", price: 140, hp: 4, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "frost",
    passive: "freeze",
    desc: "빙결: 맞은 적은 다음 턴에 움직이지 못합니다.",
  },
  priest: {
    name: "사제", rarity: "rare", price: 130, hp: 4, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "bash",
    ability: { id: "heal", name: "치유", cd: 2, range: 2, desc: "2칸 이내 아군의 체력을 4 회복." },
    desc: "다친 아군을 치유합니다. 싸움은 서툽니다.",
  },
  assassin: {
    name: "암살자", rarity: "rare", price: 170, hp: 4, atk: 3,
    move: { leap: [...KNIGHT, ...DIAG] }, attack: { leap: KNIGHT }, style: "melee", fx: "daggers",
    passive: "ambush",
    desc: "급습: 체력이 가득 찬 적에게 두 배 피해. 나이트처럼 뛰어 들어갑니다.",
  },

  // ── 영웅 ───────────────────────────────────────────────────
  necro: {
    name: "네크로맨서", rarity: "epic", price: 320, hp: 5, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 2 }, style: "ranged", fx: "shadow",
    ability: { id: "raise", name: "해골 소환", cd: 3, range: 1, desc: "옆 빈칸에 보라색 해골 병사를 불러냅니다." },
    passive: "deathcall",
    desc: "망자의 부름: 2칸 이내에서 적이 쓰러지면 그 자리에서 해골로 일어나 아군이 됩니다. (해골 최대 4)",
  },
  storm: {
    name: "뇌전술사", rarity: "epic", price: 300, hp: 5, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "chain",
    passive: "chain",
    desc: "연쇄 번개: 맞은 적 옆의 적에게 두 번까지 튑니다.",
  },
  berserker: {
    name: "광전사", rarity: "epic", price: 260, hp: 8, atk: 3,
    move: { slide: ALL, range: 2 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "cleave",
    passive: "bloodlust",
    desc: "피의 갈증: 적을 쓰러뜨릴 때마다 공격력 +1 (이번 출전 동안).",
  },

  // ── 전설 ───────────────────────────────────────────────────
  dragon: {
    name: "드래곤", rarity: "legend", price: 700, hp: 12, atk: 3,
    move: { slide: ALL, range: 3 }, attack: { slide: ALL, range: 3, pierce: true }, style: "ranged", fx: "breath",
    desc: "화염 숨결: 한 방향 3칸 안의 적을 모두 태웁니다.",
  },
  chrono: {
    name: "시간술사", rarity: "legend", price: 650, hp: 6, atk: 2,
    move: { blink: 2 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "tick",
    ability: { id: "haste", name: "시간 가속", cd: 5, range: 0, desc: "이번 턴이 끝나지 않습니다. 한 번 더 행동합니다." },
    desc: "2칸 이내 빈칸으로 순간이동. 시간을 비틀어 연속 행동합니다.",
  },
  paladin: {
    name: "성기사", rarity: "legend", price: 600, hp: 11, atk: 3,
    move: { slide: ORTHO, range: 3 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "royal",
    ability: { id: "smite", name: "신성 강타", cd: 3, range: 1, desc: "옆의 적에게 5 피해, 주위 아군 체력 2 회복." },
    desc: "빛의 망치로 내려치고 곁의 아군을 돌봅니다.",
  },

  // ── 추가 기물: 일반 ─────────────────────────────────────────
  slinger: {
    name: "투석병", rarity: "common", price: 45, hp: 3, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { area: 3, min: 2 }, style: "ranged", fx: "sling",
    desc: "곡사: 2~3칸 안의 적이면 사이에 누가 막고 있어도 돌을 던져 맞힙니다.",
  },
  scout: {
    name: "척후병", rarity: "common", price: 55, hp: 4, atk: 1,
    move: { slide: ALL, range: 3 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "jab",
    passive: "hitandrun",
    desc: "기습: 이동을 마치면 옆에 붙은 적 하나를 자동으로 1 때립니다. 세 칸까지 달립니다.",
  },
  monk: {
    name: "수도승", rarity: "common", price: 85, hp: 7, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "palm",
    passive: "counter",
    desc: "반격: 근접 공격을 받고 버티면 그 자리에서 1 맞받아칩니다.",
  },

  // ── 추가 기물: 희귀 ─────────────────────────────────────────
  venomist: {
    name: "독술사", rarity: "rare", price: 135, hp: 4, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "venom",
    passive: "poison",
    desc: "중독: 맞은 적은 3턴 동안 자기 차례가 올 때마다 독으로 1씩 잃습니다.",
  },
  cannoneer: {
    name: "대포병", rarity: "rare", price: 190, hp: 5, atk: 3,
    move: { slide: ORTHO, range: 1 }, attack: { slide: ORTHO, range: 5, min: 2 }, style: "ranged", fx: "cannon",
    passive: "splash",
    desc: "포격: 가로세로 2~5칸을 쏘고, 맞은 적 주변의 적에게도 1 피해를 줍니다. 바로 옆은 쏘지 못합니다.",
  },
  spellblade: {
    name: "마검사", rarity: "rare", price: 175, hp: 5, atk: 2,
    move: { slide: DIAG, range: 2 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "voidcut",
    passive: "lifesteal",
    desc: "흡혈 검: 적을 벨 때마다 체력을 1 회복합니다. 대각선으로 두 칸까지 움직입니다.",
  },
  templar: {
    name: "수호기사", rarity: "rare", price: 180, hp: 8, atk: 2,
    move: { slide: ORTHO, range: 2 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "bash",
    ability: { id: "ward", name: "가호", cd: 3, range: 2, desc: "2칸 이내 아군(자신 포함)에게 피해 3을 막는 보호막." },
    desc: "빛의 보호막으로 가장 위험한 아군을 감쌉니다.",
  },
  bomber: {
    name: "폭탄병", rarity: "rare", price: 120, hp: 3, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { area: 2 }, style: "ranged", fx: "bomb",
    passive: "explode",
    desc: "유폭: 쓰러지면 터지면서 주변 적에게 3 피해를 줍니다. 2칸 안으로 폭죽을 던집니다.",
  },

  // ── 추가 기물: 영웅 ─────────────────────────────────────────
  golem: {
    name: "골렘", rarity: "epic", price: 290, hp: 16, atk: 3,
    move: { slide: ORTHO, range: 1 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "crush",
    passive: "stoneskin",
    desc: "돌 피부: 받는 모든 피해가 1 줄어듭니다. 느리지만 무너지지 않습니다.",
  },
  vampire: {
    name: "흡혈귀", rarity: "epic", price: 340, hp: 7, atk: 3,
    move: { leap: KNIGHT }, attack: { leap: KNIGHT }, style: "melee", fx: "fang",
    passive: "lifesteal",
    ability: { id: "bats", name: "박쥐 떼", cd: 2, range: 3, desc: "3칸 이내 적에게 2 피해, 그만큼 체력 회복." },
    desc: "나이트처럼 뛰어들어 물고, 박쥐 떼로 멀리서도 피를 빱니다.",
  },
  illusionist: {
    name: "환영술사", rarity: "epic", price: 310, hp: 5, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 2 }, style: "ranged", fx: "mirage",
    ability: { id: "swap", name: "자리 바꾸기", cd: 3, range: 3, desc: "3칸 이내 기물 하나(적이든 아군이든)와 자리를 맞바꿉니다." },
    desc: "판을 뒤섞는 술사. 위험한 적을 끌어오거나 다친 아군을 빼냅니다.",
  },
  warlord: {
    name: "전쟁군주", rarity: "epic", price: 360, hp: 10, atk: 3,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "warcleave",
    passive: "aura",
    desc: "지휘: 바로 옆에 붙어 있는 아군의 공격력이 1 올라갑니다.",
  },

  // ── 추가 기물: 전설 ─────────────────────────────────────────
  archmage: {
    name: "대마법사", rarity: "legend", price: 760, hp: 6, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 4 }, style: "ranged", fx: "arcane",
    ability: { id: "meteor", name: "운석", cd: 5, range: 8, desc: "판 어디든 3×3 범위의 적에게 3 피해." },
    desc: "하늘의 별을 끌어내리는 마법사. 판 끝의 적도 안전하지 않습니다.",
  },
  phoenix: {
    name: "불사조", rarity: "legend", price: 820, hp: 8, atk: 3,
    move: { slide: ALL, range: 3 }, attack: { slide: ALL, range: 2 }, style: "ranged", fx: "flame",
    passive: "rebirth",
    desc: "환생: 출전마다 한 번, 쓰러져도 체력 절반으로 불꽃 속에서 되살아납니다.",
  },

  // ── 소환/적 전용 ───────────────────────────────────────────
  skeleton: {
    name: "해골 병사", rarity: "common", price: 0, hp: 3, atk: 1, noShop: true, summon: true,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "bone",
    desc: "네크로맨서가 불러낸 보라색 병사.",
  },
  imp: {
    name: "임프", rarity: "common", price: 30, hp: 2, atk: 1, noShop: true, enemyOnly: true,
    move: { leap: [...ALL, [0, 2], [0, -2], [2, 0], [-2, 0]] }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "claw",
    desc: "마왕이 부르는 날쌘 졸개.",
  },
  demon: {
    name: "마왕", rarity: "boss", price: 400, hp: 26, atk: 4, noShop: true, enemyOnly: true, boss: true,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 2 }, style: "ranged", fx: "hellfire",
    passive: "spawner",
    desc: "세 턴마다 임프를 불러냅니다. 다섯 번째 웨이브마다 나타납니다.",
  },
};

export const SHOP_KEYS = Object.keys(PIECES).filter((k) => !PIECES[k].noShop);

export const STARTER = [
  "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook",
  "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn",
];

// 도감에 나오는 한 줄 이야기
export const LORE = {
  pawn: "가장 앞에 서는 병사. 끝까지 살아남으면 누구보다 높이 올라갑니다.",
  knight: "혼돈의 판 위에서도 길을 잃지 않는 기사. 막힌 길은 뛰어넘으면 그만입니다.",
  bishop: "빛의 사선을 따라 걷는 사제. 대각선 너머의 적을 놓치지 않습니다.",
  rook: "걸어 다니는 성벽. 한번 정한 줄은 끝까지 밀고 나갑니다.",
  queen: "판 위의 모든 길을 아는 여왕. 승급한 폰들의 꿈입니다.",
  king: "모두가 지키는 단 하나. 왕관의 무게만큼 단단합니다.",
  spearman: "긴 창으로 두 줄을 꿰는 창병. 줄 서서 오는 적을 좋아합니다.",
  archer: "망루에서 내려온 궁수. 가까이 붙는 적을 가장 싫어합니다.",
  shield: "방패 하나로 옆 사람을 지키는 사람. 자기 몸은 뒷전입니다.",
  pyro: "모자 끝의 불씨를 절대 끄지 않는 술사. 뭉친 적을 보면 신이 납니다.",
  frost: "숨결마저 차가운 술사. 맞은 적은 한 턴 동안 생각을 멈춥니다.",
  priest: "다친 이를 못 본 척하지 못하는 사제. 지팡이가 망치보다 익숙합니다.",
  assassin: "가면 뒤의 그림자. 방심한 적은 두 배로 아픕니다.",
  necro: "보라색 등불을 든 술사. 쓰러진 적도 그에게는 새 병사입니다.",
  storm: "번개를 길들인 술사. 한 번 친 번개는 옆 사람을 찾아갑니다.",
  berserker: "싸울수록 뜨거워지는 전사. 한 번 불붙으면 멈추지 않습니다.",
  dragon: "판 밖의 하늘에서 내려온 전설. 숨 한 번에 한 줄이 타오릅니다.",
  chrono: "모래시계를 거꾸로 세우는 술사. 남들보다 한 박자 먼저 움직입니다.",
  paladin: "빛의 망치를 든 성기사. 내려칠 때마다 곁의 동료가 숨을 돌립니다.",
  slinger: "돌멩이 하나로 성벽 너머를 노리는 병사. 앞에 누가 있든 상관없습니다.",
  scout: "누구보다 먼저 달려가는 척후병. 도착하자마자 주먹부터 나갑니다.",
  monk: "맞으면 맞은 만큼 돌려주는 수도승. 마음은 고요하지만 손은 빠릅니다.",
  venomist: "초록 병을 늘 품고 다니는 술사. 한 방울이면 충분합니다.",
  cannoneer: "포탄 냄새를 좋아하는 포병. 멀리 있을수록 더 신납니다.",
  spellblade: "보랏빛 검으로 생명을 베어 마시는 검사.",
  templar: "동료 앞에 빛의 막을 펼치는 기사. 자기 상처는 나중입니다.",
  bomber: "도화선에 불을 붙이고 웃는 폭탄병. 쓰러질 때가 가장 위험합니다.",
  golem: "고대의 돌로 빚은 거인. 망치도 칼도 반쯤만 들어갑니다.",
  vampire: "밤에만 판에 오르는 귀족. 상처는 남의 피로 메웁니다.",
  illusionist: "거울 속에서 걸어 나온 술사. 눈 깜짝할 새 자리가 바뀌어 있습니다.",
  warlord: "전장의 북소리 같은 군주. 곁에 선 병사들이 덩달아 사나워집니다.",
  archmage: "별자리를 외우는 대신 별을 떨어뜨리는 대마법사.",
  phoenix: "재 속에서 다시 날아오르는 불새. 한 번 쓰러뜨렸다고 끝이 아닙니다.",
  skeleton: "네크로맨서의 부름에 일어난 해골. 보랏빛 눈으로 주인을 따릅니다.",
  imp: "마왕의 망토 자락에서 튀어나오는 졸개. 작지만 성가십니다.",
  demon: "혼돈의 판을 지배하려는 마왕. 다섯 번째 웨이브마다 모습을 드러냅니다.",
};

// ── 레벨업 (영구 성장) ─────────────────────────────────────────
// 레벨마다 붙는 특성. [Lv2 특성, Lv3 특성]
export const TRAITS = {
  barrier: { name: "결계", desc: "웨이브가 시작될 때마다 피해 2를 막는 보호막을 두릅니다." },
  execute: { name: "처형", desc: "체력이 절반 이하인 적에게 피해 +2." },
  ambush: { name: "급습", desc: "체력이 가득 찬 적에게 두 배 피해." },
  thorns: { name: "가시", desc: "공격받을 때마다 공격한 적에게 1 피해 (원거리 포함)." },
  poison: { name: "독", desc: "맞은 적은 3턴 동안 매 턴 1씩 잃습니다." },
  regen: { name: "재생", desc: "자기 차례가 시작될 때 체력을 1 회복합니다." },
  stoneskin: { name: "돌 피부", desc: "받는 모든 피해 -1." },
  splash: { name: "파편", desc: "맞은 적 주변의 적에게도 1 피해." },
  lifesteal: { name: "흡혈", desc: "공격할 때마다 체력을 1 회복합니다." },
  aura: { name: "지휘", desc: "바로 옆 아군의 공격력 +1." },
  guard: { name: "수호", desc: "바로 옆 아군이 받는 피해 -1." },
  longshot: { name: "사거리 증가", desc: "공격 사거리 +1." },
  quickcast: { name: "숙련", desc: "능력 재사용 대기 시간 -1턴." },
  swift: { name: "질주", desc: "이동 거리 +1." },
  freeze: { name: "빙결", desc: "맞은 적은 다음 턴에 움직이지 못합니다." },
  rebirth: { name: "환생", desc: "출전마다 한 번, 쓰러져도 체력 절반으로 되살아납니다." },
  counter: { name: "반격", desc: "근접 공격을 받고 버티면 1 맞받아칩니다." },
};

export const LEVEL_TRAITS = {
  pawn: ["barrier", "execute"],
  knight: ["ambush", "thorns"],
  bishop: ["poison", "regen"],
  rook: ["stoneskin", "splash"],
  queen: ["lifesteal", "aura"],
  king: ["regen", "guard"],
  spearman: ["longshot", "execute"],
  archer: ["longshot", "poison"],
  shield: ["thorns", "barrier"],
  pyro: ["splash", "quickcast"],
  frost: ["splash", "longshot"],
  priest: ["quickcast", "guard"],
  assassin: ["lifesteal", "execute"],
  necro: ["quickcast", "lifesteal"],
  storm: ["longshot", "freeze"],
  berserker: ["swift", "lifesteal"],
  dragon: ["stoneskin", "regen"],
  chrono: ["quickcast", "freeze"],
  paladin: ["quickcast", "guard"],
  slinger: ["longshot", "splash"],
  scout: ["swift", "execute"],
  monk: ["regen", "thorns"],
  venomist: ["longshot", "splash"],
  cannoneer: ["longshot", "freeze"],
  spellblade: ["swift", "execute"],
  templar: ["quickcast", "barrier"],
  bomber: ["swift", "rebirth"],
  golem: ["thorns", "regen"],
  vampire: ["quickcast", "ambush"],
  illusionist: ["quickcast", "freeze"],
  warlord: ["guard", "regen"],
  archmage: ["quickcast", "longshot"],
  phoenix: ["splash", "regen"],
  skeleton: ["thorns", "regen"],
  imp: ["swift", "thorns"],
  demon: ["stoneskin", "regen"],
};

export const MAX_LV = 3;

/** 레벨에 따른 체력/공격력 보너스 */
export function levelBonus(key, lv) {
  const hp = PIECES[key].hp;
  if (lv >= 3) return { hp: Math.max(2, Math.round(hp * 0.5)), atk: 1 };
  if (lv >= 2) return { hp: Math.max(1, Math.round(hp * 0.25)), atk: 0 };
  return { hp: 0, atk: 0 };
}

/** 다음 레벨로 올리는 값: 구매 가격보다 조금 더 높게 (Lv2 ×1.2, Lv3 ×1.45) */
export function levelCost(key, toLv) {
  const base = PIECES[key].price || 120; // 킹처럼 값이 없는 기물은 120 기준
  const raw = base * (toLv >= 3 ? 1.45 : 1.2);
  return Math.max(toLv >= 3 ? 50 : 30, Math.ceil(raw / 5) * 5);
}

/** 이 레벨까지 얻은 특성 목록 (기본 패시브 포함) */
export function traitsAt(key, lv) {
  const out = [];
  if (PIECES[key].passive) out.push(PIECES[key].passive);
  const L = LEVEL_TRAITS[key];
  if (L && lv >= 2) out.push(L[0]);
  if (L && lv >= 3) out.push(L[1]);
  return out;
}

// ── 레벨 스킬: 레벨이 오를 때마다 새 액티브 스킬이 하나씩 열림 ─────────
// target: self(자신), enemy(적 칸), ally(아군 칸), cell(범위 중심 칸)
export const SKILLS = {
  fortify: { id: "fortify", name: "철벽", cd: 3, range: 0, target: "self", desc: "자신에게 피해 4를 막는 보호막을 두릅니다." },
  dash: { id: "dash", name: "돌격", cd: 3, range: 3, target: "enemy", desc: "일직선으로 3칸 안의 적에게 달려들어 공격력 +1 피해를 줍니다." },
  whirl: { id: "whirl", name: "회오리 베기", cd: 3, range: 1, target: "self", desc: "한 바퀴 돌며 주위의 적 모두에게 공격력만큼 피해를 줍니다." },
  rally: { id: "rally", name: "격려", cd: 4, range: 2, target: "self", desc: "2칸 안의 아군 모두(자신 포함)에게 피해 2를 막는 보호막을 줍니다." },
  mend: { id: "mend", name: "응급 처치", cd: 3, range: 0, target: "self", desc: "자신의 체력을 4 회복합니다." },
  push: { id: "push", name: "밀쳐내기", cd: 2, range: 1, target: "enemy", desc: "옆의 적에게 1 피해를 주고 두 칸 밀어냅니다. 무언가에 부딪히면 2 더 피해를 줍니다." },
  volley: { id: "volley", name: "화살비", cd: 3, range: 4, target: "cell", desc: "4칸 안의 지점에 화살을 쏟아 3×3 범위의 적에게 1 피해를 줍니다." },
  snipe: { id: "snipe", name: "저격", cd: 3, range: 5, target: "enemy", desc: "5칸 안의 적 하나에게 공격력 +2 피해를 줍니다. 가로막혀도 맞힙니다." },
  frostnova: { id: "frostnova", name: "냉기 폭발", cd: 4, range: 1, target: "self", desc: "주위의 적 모두에게 1 피해를 주고 얼립니다." },
  miasma: { id: "miasma", name: "독 안개", cd: 4, range: 3, target: "cell", desc: "3칸 안의 지점에 독 안개를 퍼뜨려 3×3 범위의 적을 중독시킵니다." },
  shadowstep: { id: "shadowstep", name: "그림자 도약", cd: 3, range: 4, target: "enemy", desc: "4칸 안의 적 옆으로 순간이동해 공격력만큼 피해를 줍니다." },
  thunder: { id: "thunder", name: "낙뢰", cd: 3, range: 4, target: "enemy", desc: "4칸 안의 적 하나에게 하늘에서 번개를 내려 3 피해를 줍니다." },
  quake: { id: "quake", name: "땅울림", cd: 4, range: 2, target: "self", desc: "땅을 내리쳐 2칸 안의 적 모두에게 1, 바로 옆의 적에게는 2 피해를 줍니다." },
  behead: { id: "behead", name: "참수", cd: 3, range: 1, target: "enemy", desc: "옆의 적이 체력 절반 이하면 즉시 쓰러뜨립니다. 아니면 공격력만큼 피해를 줍니다." },
  bless: { id: "bless", name: "축복", cd: 2, range: 3, target: "ally", desc: "3칸 안의 아군 체력을 3 회복하고 독과 빙결을 풀어 줍니다." },
};

// [Lv2에 열리는 스킬, Lv3에 열리는 스킬]
export const LEVEL_SKILLS = {
  pawn: ["fortify", "dash"],
  knight: ["dash", "whirl"],
  bishop: ["bless", "thunder"],
  rook: ["push", "quake"],
  queen: ["whirl", "shadowstep"],
  king: ["rally", "behead"],
  spearman: ["push", "dash"],
  archer: ["volley", "snipe"],
  shield: ["push", "rally"],
  pyro: ["snipe", "volley"],
  frost: ["frostnova", "snipe"],
  priest: ["bless", "rally"],
  assassin: ["shadowstep", "behead"],
  necro: ["miasma", "mend"],
  storm: ["thunder", "quake"],
  berserker: ["whirl", "mend"],
  dragon: ["whirl", "quake"],
  chrono: ["shadowstep", "rally"],
  paladin: ["fortify", "rally"],
  slinger: ["volley", "snipe"],
  scout: ["dash", "shadowstep"],
  monk: ["push", "whirl"],
  venomist: ["miasma", "snipe"],
  cannoneer: ["volley", "quake"],
  spellblade: ["shadowstep", "whirl"],
  templar: ["fortify", "bless"],
  bomber: ["volley", "push"],
  golem: ["push", "quake"],
  vampire: ["shadowstep", "behead"],
  illusionist: ["shadowstep", "miasma"],
  warlord: ["rally", "whirl"],
  archmage: ["thunder", "frostnova"],
  phoenix: ["mend", "volley"],
  skeleton: ["fortify", "whirl"],
  imp: ["dash", "shadowstep"],
  demon: ["quake", "whirl"],
};

/** 이 레벨에서 쓸 수 있는 능력 목록: 기본 능력 + 열린 레벨 스킬 */
export function abilitiesAt(key, lv = 1) {
  const out = [];
  if (PIECES[key].ability) out.push(PIECES[key].ability);
  const L = LEVEL_SKILLS[key];
  if (L && lv >= 2) out.push(SKILLS[L[0]]);
  if (L && lv >= 3) out.push(SKILLS[L[1]]);
  return out;
}
