import { describe, expect, it } from "vitest";
import { buildDeck, currentId, drawOne, nextIdx, pass, play, shuffle, startGame, type Card, type GameState } from "@/lib/uno";

const players = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player${i}` }));
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function fixture(count: number, card: Card): GameState {
  const order = players(count).map(p => p.id);
  const filler: Card = { id: 300, color: "blu", type: "num", val: 8 };
  return { order, hands: Object.fromEntries(order.map((id, i) => [id, i === 0 ? [card, filler] : [filler]])),
    deck: buildDeck(), discard: [{ id: 200, color: "red", type: "num", val: 1 }],
    turn: 0, dir: 1, color: "red", drawn: false, vuln: null, winner: null, logs: [] };
}

describe.each([2, 3, 4, 5, 6, 7, 8, 9, 10])("%i-player games", count => {
  it("deals every player in a random permutation without losing any of the 108 cards", () => {
    const p = players(count);
    const state = startGame(p, seeded(42));
    expect(state.order).toHaveLength(count);
    expect([...state.order].sort()).toEqual(p.map(x => x.id).sort());
    expect(state.order).not.toEqual(p.map(x => x.id));
    for (const hand of Object.values(state.hands)) expect(hand.length).toBeGreaterThanOrEqual(7);
    const cards = [...state.deck, ...state.discard, ...Object.values(state.hands).flat()];
    expect(cards).toHaveLength(108);
    expect(new Set(cards.map(c => c.id)).size).toBe(108);
    const orders = new Set([1, 1000, 2000, 3000, 4000].map(seed => shuffle(p.map(x => x.id), seeded(seed)).join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("draws one card and passes to the next player without changing the input state", () => {
    const state = fixture(count, { id: 201, color: "red", type: "num", val: 2 });
    const drawn = drawOne(state, players(count), "p0");
    expect(drawn.hands["p0"]).toHaveLength(3);
    expect(state.hands["p0"]).toHaveLength(2);
    expect(currentId(drawn)).toBe("p0");
    expect(drawn.drawn).toBe(true);
    expect(() => drawOne(drawn, players(count), "p0")).toThrow();
    const passed = pass(drawn, players(count), "p0");
    expect(currentId(passed)).toBe("p1");
    expect(passed.drawn).toBe(false);
  });

  it.each(["num", "skip", "rev", "d2", "wild", "d4"] as const)("advances %s with the correct direction, skipped turn, color and penalty", type => {
    const card: Card = { id: 201, color: type === "wild" || type === "d4" ? "wild" : "red", type, ...(type === "num" ? { val: 2 } : {}) };
    const state = fixture(count, card);
    expect(() => play(state, players(count), "p1", 300, "grn")).toThrow();
    const result = play(state, players(count), "p0", card.id, "grn");
    expect(result.hands["p0"]).toHaveLength(1);
    expect(result.discard.at(-1)?.id).toBe(card.id);
    expect(result.color).toBe(card.color === "wild" ? "grn" : "red");
    expect(result.dir).toBe(type === "rev" ? -1 : 1);
    const skip = ["skip", "d2", "d4"].includes(type) || (type === "rev" && count === 2);
    const expectedTurn = type === "rev" ? (count === 2 ? 0 : count - 1) : (skip ? 2 : 1) % count;
    expect(result.turn).toBe(expectedTurn);
    expect(result.hands["p1"]).toHaveLength(type === "d2" ? 3 : type === "d4" ? 5 : 1);
    expect(nextIdx(result)).toBe((result.turn + result.dir + count) % count);
  });
});