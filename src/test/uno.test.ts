import { describe, it, expect } from "vitest";
import { startGame, play, canPlay, currentId } from "@/lib/uno";

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));

describe("uno rules", () => {
  it("deals 7 cards to each of 10 players", () => {
    const s = startGame(mk(10));
    expect(s.order).toHaveLength(10);
    Object.values(s.hands).forEach((h) => expect(h.length).toBeGreaterThanOrEqual(7));
  });
  it("turn order is shuffled (not always join order)", () => {
    const orders = new Set(Array.from({ length: 30 }, () => startGame(mk(5)).order.join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });
  it("rejects playing out of turn", () => {
    const s = startGame(mk(3));
    const other = s.order.find((id) => id !== currentId(s))!;
    const card = s.hands[other]![0]!;
    expect(() => play(s, mk(3), other, card.id, "red")).toThrow();
  });
  it("wild is always playable", () => {
    const s = startGame(mk(2));
    expect(canPlay(s, { id: 999, color: "wild", type: "wild" })).toBe(true);
  });
});
