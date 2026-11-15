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
    desc: "앞으로 한 칸(첫 이동은 두 칸), 공격은 앞 대각선. 끝줄에 닿으면 퀸으로 승급해요.",
  },
  knight: {
    name: "나이트", rarity: "base", price: 60, hp: 5, atk: 2,
    move: { leap: KNIGHT }, attack: { leap: KNIGHT }, style: "melee", fx: "hoof",
    desc: "L자로 뛰어넘어요. 다른 기물에 막히지 않아요.",
  },
  bishop: {
    name: "비숍", rarity: "base", price: 60, hp: 4, atk: 2,
    move: { slide: DIAG, range: 7 }, attack: { slide: DIAG, range: 7 }, style: "melee", fx: "lightcut",
    desc: "대각선으로 끝까지 움직이고 공격해요.",
  },
  rook: {
    name: "룩", rarity: "base", price: 80, hp: 6, atk: 2,
    move: { slide: ORTHO, range: 7 }, attack: { slide: ORTHO, range: 7 }, style: "melee", fx: "crush",
    desc: "가로세로로 끝까지 움직이고 공격해요. 단단해요.",
  },
  queen: {
    name: "퀸", rarity: "rare", price: 180, hp: 6, atk: 3,
    move: { slide: ALL, range: 7 }, attack: { slide: ALL, range: 7 }, style: "melee", fx: "crossCut",
    desc: "여덟 방향으로 끝까지. 가장 자유로운 기물이에요.",
  },
  king: {
    name: "킹", rarity: "base", price: 0, hp: 10, atk: 2, unique: true, noShop: true,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "royal",
    desc: "주위 한 칸. 킹이 쓰러지면 출전이 끝나요.",
  },

  // ── 일반 ───────────────────────────────────────────────────
  spearman: {
    name: "창병", rarity: "common", price: 50, hp: 5, atk: 2,
    move: { slide: ORTHO, range: 1 }, attack: { slide: ORTHO, range: 2, pierce: true }, style: "ranged", fx: "thrust",
    desc: "가로세로 두 칸을 꿰뚫어 그 줄의 적을 모두 찔러요.",
  },
  archer: {
    name: "궁수", rarity: "common", price: 70, hp: 3, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 4, min: 2 }, style: "ranged", fx: "arrow",
    desc: "2~4칸 떨어진 적을 쏴요. 바로 옆은 못 쏴요.",
  },
  shield: {
    name: "방패병", rarity: "common", price: 70, hp: 9, atk: 1,
    move: { slide: ORTHO, range: 1 }, attack: { slide: ORTHO, range: 1 }, style: "melee", fx: "bash",
    passive: "guard",
    desc: "수호: 옆에 붙어 있는 아군이 받는 피해가 1 줄어요.",
  },

  // ── 희귀 ───────────────────────────────────────────────────
  pyro: {
    name: "화염술사", rarity: "rare", price: 150, hp: 4, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "ember",
    ability: { id: "fireball", name: "화염구", cd: 3, range: 3, desc: "3칸 이내 지점에 화염구. 3×3 범위의 적에게 2 피해." },
    desc: "작은 불씨를 쏘고, 화염구로 몰려 있는 적을 태워요.",
  },
  frost: {
    name: "빙결술사", rarity: "rare", price: 140, hp: 4, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "frost",
    passive: "freeze",
    desc: "빙결: 맞은 적은 다음 턴에 움직이지 못해요.",
  },
  priest: {
    name: "사제", rarity: "rare", price: 130, hp: 4, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "bash",
    ability: { id: "heal", name: "치유", cd: 2, range: 2, desc: "2칸 이내 아군의 체력을 4 회복." },
    desc: "다친 아군을 치유해요. 싸움은 서툴러요.",
  },
  assassin: {
    name: "암살자", rarity: "rare", price: 170, hp: 4, atk: 3,
    move: { leap: [...KNIGHT, ...DIAG] }, attack: { leap: KNIGHT }, style: "melee", fx: "daggers",
    passive: "ambush",
    desc: "급습: 체력이 가득 찬 적에게 두 배 피해. 나이트처럼 뛰어 들어가요.",
  },

  // ── 영웅 ───────────────────────────────────────────────────
  necro: {
    name: "네크로맨서", rarity: "epic", price: 320, hp: 5, atk: 1,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 2 }, style: "ranged", fx: "shadow",
    ability: { id: "raise", name: "해골 소환", cd: 3, range: 1, desc: "옆 빈칸에 보라색 해골 병사를 불러내요." },
    passive: "deathcall",
    desc: "망자의 부름: 2칸 이내에서 적이 쓰러지면 그 자리에서 해골로 일어나 아군이 돼요. (해골 최대 4)",
  },
  storm: {
    name: "뇌전술사", rarity: "epic", price: 300, hp: 5, atk: 2,
    move: { slide: ALL, range: 1 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "chain",
    passive: "chain",
    desc: "연쇄 번개: 맞은 적 옆의 적에게 두 번까지 튀어요.",
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
    desc: "화염 숨결: 한 방향 3칸 안의 적을 모두 태워요.",
  },
  chrono: {
    name: "시간술사", rarity: "legend", price: 650, hp: 6, atk: 2,
    move: { blink: 2 }, attack: { slide: ALL, range: 3 }, style: "ranged", fx: "tick",
    ability: { id: "haste", name: "시간 가속", cd: 5, range: 0, desc: "이번 턴이 끝나지 않아요. 한 번 더 행동해요." },
    desc: "2칸 이내 빈칸으로 순간이동. 시간을 비틀어 연속 행동해요.",
  },
  paladin: {
    name: "성기사", rarity: "legend", price: 600, hp: 11, atk: 3,
    move: { slide: ORTHO, range: 3 }, attack: { slide: ALL, range: 1 }, style: "melee", fx: "royal",
    ability: { id: "smite", name: "신성 강타", cd: 3, range: 1, desc: "옆의 적에게 5 피해, 주위 아군 체력 2 회복." },
    desc: "빛의 망치로 내려치고 곁의 아군을 돌봐요.",
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
    desc: "세 턴마다 임프를 불러내요. 다섯 번째 웨이브마다 나타나요.",
  },
};

export const SHOP_KEYS = Object.keys(PIECES).filter((k) => !PIECES[k].noShop);

export const STARTER = [
  "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook",
  "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "pawn",
];

// 도감에 나오는 한 줄 이야기
export const LORE = {
  pawn: "가장 앞에 서는 병사. 끝까지 살아남으면 누구보다 높이 올라가요.",
  knight: "혼돈의 판 위에서도 길을 잃지 않는 기사. 막힌 길은 뛰어넘으면 그만이에요.",
  bishop: "빛의 사선을 따라 걷는 사제. 대각선 너머의 적을 놓치지 않아요.",
  rook: "걸어 다니는 성벽. 한번 정한 줄은 끝까지 밀고 나가요.",
  queen: "판 위의 모든 길을 아는 여왕. 승급한 폰들의 꿈이에요.",
  king: "모두가 지키는 단 하나. 왕관의 무게만큼 단단해요.",
  spearman: "긴 창으로 두 줄을 꿰는 창병. 줄 서서 오는 적을 좋아해요.",
  archer: "망루에서 내려온 궁수. 가까이 붙는 적이 제일 싫어요.",
  shield: "방패 하나로 옆 사람을 지키는 사람. 자기 몸은 뒷전이에요.",
  pyro: "모자 끝의 불씨를 절대 끄지 않는 술사. 뭉친 적을 보면 신이 나요.",
  frost: "숨결마저 차가운 술사. 맞은 적은 한 턴 동안 생각을 멈춰요.",
  priest: "다친 이를 못 본 척하지 못하는 사제. 지팡이가 망치보다 익숙해요.",
  assassin: "가면 뒤의 그림자. 방심한 적은 두 배로 아파요.",
  necro: "보라색 등불을 든 술사. 쓰러진 적도 그에겐 새 병사예요.",
  storm: "번개를 길들인 술사. 한 번 친 번개는 옆 사람을 찾아가요.",
  berserker: "싸울수록 뜨거워지는 전사. 한 번 불붙으면 멈추지 않아요.",
  dragon: "판 밖의 하늘에서 내려온 전설. 숨 한 번에 한 줄이 타올라요.",
  chrono: "모래시계를 거꾸로 세우는 술사. 남들보다 한 박자 먼저 움직여요.",
  paladin: "빛의 망치를 든 성기사. 내려칠 때마다 곁의 동료가 숨을 돌려요.",
  skeleton: "네크로맨서의 부름에 일어난 해골. 보라빛 눈으로 주인을 따라요.",
  imp: "마왕의 망토 자락에서 튀어나오는 졸개. 작지만 성가셔요.",
  demon: "혼돈의 판을 지배하려는 마왕. 다섯 번째 웨이브마다 모습을 드러내요.",
};
