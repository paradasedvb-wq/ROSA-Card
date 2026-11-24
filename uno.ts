export type Color = "red" | "yel" | "grn" | "blu";
export const COLORS: Color[] = ["red", "yel", "grn", "blu"];
export type CardType = "num" | "skip" | "rev" | "d2" | "wild" | "d4";
export interface Card { id: number; color: Color | "wild"; type: CardType; val?: number }
export interface Player { id: string; name: string }
export interface GameState {
  order: string[];
  hands: Record<string, Card[]>;
  deck: Card[];
  discard: Card[];
  turn: number;
  dir: 1 | -1;
  color: Color;
  drawn: boolean;
  vuln: string | null;
  winner: string | null;
  logs: string[];
}

export function buildDeck(): Card[] {
  let id = 0;
  const d: Card[] = [];
  COLORS.forEach((c) => {
    d.push({ id: id++, color: c, type: "num", val: 0 });
    for (let n = 1; n <= 9; n++) {
      d.push({ id: id++, color: c, type: "num", val: n });
      d.push({ id: id++, color: c, type: "num", val: n });
    }
    (["skip", "rev", "d2"] as const).forEach((t) => {
      d.push({ id: id++, color: c, type: t });
      d.push({ id: id++, color: c, type: t });
    });
  });
  for (let i = 0; i < 4; i++) {
    d.push({ id: id++, color: "wild", type: "wild" });
    d.push({ id: id++, color: "wild", type: "d4" });
  }
  return d;
}

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j]!, b[i]!];
  }
  return b;
}

export const COLOR_KO: Record<Color, string> = { red: "빨강", yel: "노랑", grn: "초록", blu: "파랑" };
export function cardLabel(c: Card) {
  return { num: String(c.val), skip: "⦸", rev: "⟲", d2: "+2", wild: "★", d4: "+4" }[c.type];
}

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "?";

/** Deck size is 108, so at most 10 players * 7 cards = 70 fits. Turn order is random. */
export function startGame(players: Player[], rnd: () => number = Math.random): GameState {
  const deck = shuffle(buildDeck(), rnd);
  const order = shuffle(players.map((p) => p.id), rnd);
  const hands: Record<string, Card[]> = {};
  order.forEach((id) => (hands[id] = deck.splice(0, 7)));
  let first = deck.pop()!;
  while (first.type === "d4") {
    deck.unshift(first);
    first = deck.pop()!;
  }
  const s: GameState = {
    order, hands, deck, discard: [first], turn: 0, dir: 1,
    color: first.color === "wild" ? COLORS[Math.floor(rnd() * 4)]! : first.color,
    drawn: false, vuln: null, winner: null,
    logs: [`게임 시작! 첫 순서: ${nameOf(players, order[0]!)}`],
  };
  if (first.type === "skip") adv(s);
  else if (first.type === "rev") { s.dir = -1; s.turn = 0; }
  else if (first.type === "d2") { draw(s, order[0]!, 2); adv(s); }
  return s;
}

export const nextIdx = (s: GameState, from = s.turn) => (from + s.dir + s.order.length) % s.order.length;
function adv(s: GameState) { s.turn = nextIdx(s); s.drawn = false; }
export const currentId = (s: GameState) => s.order[s.turn]!;
export const top = (s: GameState) => s.discard[s.discard.length - 1]!;

export function canPlay(s: GameState, c: Card) {
  const t = top(s);
  if (c.color === "wild") return true;
  if (c.color === s.color) return true;
  if (t.type === "num" && c.type === "num" && c.val === t.val) return true;
  if (c.type !== "num" && c.type === t.type) return true;
  return false;
}

function draw(s: GameState, pid: string, n: number) {
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      if (s.discard.length <= 1) break;
      const t = s.discard.pop()!;
      s.deck = shuffle(s.discard);
      s.discard = [t];
    }
    s.hands[pid]!.push(s.deck.pop()!);
  }
  if (s.vuln === pid && s.hands[pid]!.length !== 1) s.vuln = null;
}

const log = (s: GameState, m: string) => { s.logs = [m, ...s.logs].slice(0, 30); };
const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

export function play(s0: GameState, players: Player[], pid: string, cardId: number, chosen?: Color): GameState {
  if (s0.winner || currentId(s0) !== pid) throw new Error("내 차례가 아니에요");
  const s = clone(s0);
  const hand = s.hands[pid]!;
  const c = hand.find((x) => x.id === cardId);
  if (!c || !canPlay(s, c)) throw new Error("낼 수 없는 카드예요");
  if (c.color === "wild" && !chosen) throw new Error("색을 골라주세요");
  s.hands[pid] = hand.filter((x) => x.id !== cardId);
  s.discard.push(c);
  s.color = c.color === "wild" ? chosen! : c.color;
  const me = nameOf(players, pid);
  let skip = false;
  if (c.type === "skip") { skip = true; log(s, `${me}: 스킵`); }
  else if (c.type === "rev") { s.dir = (s.dir * -1) as 1 | -1; if (s.order.length === 2) skip = true; log(s, `${me}: 방향 전환`); }
  else if (c.type === "d2") { const v = s.order[nextIdx(s)]!; draw(s, v, 2); skip = true; log(s, `${me}: +2 → ${nameOf(players, v)}`); }
  else if (c.type === "d4") { const v = s.order[nextIdx(s)]!; draw(s, v, 4); skip = true; log(s, `${me}: +4 → ${nameOf(players, v)} (${COLOR_KO[s.color]})`); }
  else if (c.type === "wild") log(s, `${me}: 와일드 (${COLOR_KO[s.color]})`);
  else log(s, `${me}: ${COLOR_KO[c.color as Color]} ${c.val}`);
  if (s.hands[pid]!.length === 0) { s.winner = pid; s.vuln = null; log(s, `🏆 ${me} 승리!`); return s; }
  s.vuln = s.hands[pid]!.length === 1 ? pid : s.vuln === pid ? null : s.vuln;
  adv(s);
  if (skip) adv(s);
  return s;
}

export function drawOne(s0: GameState, players: Player[], pid: string): GameState {
  if (s0.winner || currentId(s0) !== pid || s0.drawn) throw new Error("지금은 뽑을 수 없어요");
  const s = clone(s0);
  draw(s, pid, 1);
  s.drawn = true;
  log(s, `${nameOf(players, pid)}: 카드 1장 뽑음`);
  return s;
}

export function pass(s0: GameState, players: Player[], pid: string): GameState {
  if (currentId(s0) !== pid || !s0.drawn) throw new Error("먼저 카드를 뽑아야 해요");
  const s = clone(s0);
  log(s, `${nameOf(players, pid)}: 패스`);
  adv(s);
  return s;
}

export function callUno(s0: GameState, players: Player[], pid: string): GameState {
  if (s0.vuln !== pid) return s0;
  const s = clone(s0);
  s.vuln = null;
  log(s, `${nameOf(players, pid)}: UNO! 🔴`);
  return s;
}

export function catchUno(s0: GameState, players: Player[], catcher: string): GameState {
  const v = s0.vuln;
  if (!v || v === catcher) return s0;
  const s = clone(s0);
  s.vuln = null;
  draw(s, v, 2);
  log(s, `${nameOf(players, catcher)}가 ${nameOf(players, v)}의 UNO를 잡음! +2`);
  return s;
}
