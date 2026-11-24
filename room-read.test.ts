import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: (validate: (data: unknown) => unknown) => ({
    handler: (handler: (input: { data: unknown }) => unknown) => async (input: { data: unknown }) => handler({ data: validate(input.data) }),
  }) }),
}));
const { from, maybeSingle } = vi.hoisted(() => ({ from: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
import { readRoom } from "@/lib/rooms.functions";

const pid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secret = "test-private-room-credential";
const credentials = { code: "ABCDE", pid, secret };
const room = { code: "ABCDE", host_id: pid, max_players: 4, status: "lobby", players: [{ id: pid, name: "Player" }], state: null, version: 1 };
async function hash() {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))))
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}
beforeEach(() => {
  vi.clearAllMocks();
  const builder = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle };
  from.mockReturnValue(builder);
});
describe("Participant-only room reads", () => {
  it("rejects missing credentials before database access", async () => {
    await expect(readRoom({ data: { code: "ABCDE", pid, secret: "" } })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it("rejects a wrong secret before reading any room", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { secret_hash: "wrong" }, error: null });
    await expect(readRoom({ data: credentials })).rejects.toThrow("이 방의 참가자가 아니에요");
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("room_players");
  });
  it("rejects a credential with no matching room membership", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { secret_hash: await hash() }, error: null })
      .mockResolvedValueOnce({ data: { ...room, players: [] }, error: null });
    await expect(readRoom({ data: credentials })).rejects.toThrow("방을 불러올 수 없어요");
  });
  it("returns only the verified participant's room", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { secret_hash: await hash() }, error: null })
      .mockResolvedValueOnce({ data: room, error: null });
    await expect(readRoom({ data: credentials })).resolves.toEqual(room);
  });
});