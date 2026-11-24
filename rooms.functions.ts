import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callUno, catchUno, drawOne, pass, play, startGame, type GameState, type Player } from "@/lib/uno";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const sha = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
const code5 = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(r, (x) => c[x % c.length]).join("");
};
const Name = z.string().trim().min(1).max(10);
const Code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5}$/);
const SeatInput = z.object({ code: Code, pid: z.string().uuid(), secret: z.string().min(10).max(200) });

// Room reads require the same private per-room credential as game actions.
export const readRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SeatInput.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: sec, error: credentialError } = await db.from("room_players").select("secret_hash")
      .eq("code", data.code).eq("player_id", data.pid).maybeSingle();
    if (credentialError || !sec || sec.secret_hash !== await sha(data.secret)) throw new Error("이 방의 참가자가 아니에요");
    const { data: room, error } = await db.from("rooms")
      .select("code,host_id,max_players,status,players,state,version").eq("code", data.code).maybeSingle();
    if (error || !room || !(room.players as unknown as Player[]).some(p => p.id === data.pid)) throw new Error("방을 불러올 수 없어요");
    return room;
  });

async function addSecret(code: string, pid: string) {
  const secret = crypto.randomUUID() + crypto.randomUUID();
  const db = await admin();
  const { error } = await db.from("room_players").insert({ code, player_id: pid, secret_hash: await sha(secret) });
  if (error) throw new Error("입장 실패");
  return secret;
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: Name, max: z.number().int().min(2).max(10) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const pid = crypto.randomUUID();
    for (let i = 0; i < 5; i++) {
      const code = code5();
      const { error } = await db.from("rooms").insert({ code, host_id: pid, max_players: data.max, players: [{ id: pid, name: data.name }] });
      if (!error) return { code, pid, secret: await addSecret(code, pid) };
    }
    throw new Error("방 만들기에 실패했어요");
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: Code, name: Name }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    for (let i = 0; i < 4; i++) {
      const { data: r } = await db.from("rooms").select("*").eq("code", data.code).maybeSingle();
      if (!r) throw new Error("없는 방 코드예요");
      if (r.status !== "lobby") throw new Error("이미 시작된 게임이에요");
      const players = r.players as unknown as Player[];
      if (players.length >= r.max_players) throw new Error("방이 꽉 찼어요");
      const pid = crypto.randomUUID();
      const { data: upd } = await db.from("rooms")
        .update({ players: [...players, { id: pid, name: data.name }] as never, version: r.version + 1 })
        .eq("code", data.code).eq("version", r.version).select();
      if (upd?.length) return { code: data.code, pid, secret: await addSecret(data.code, pid) };
    }
    throw new Error("잠시 후 다시 시도해주세요");
  });

const ActionInput = z.object({
  code: Code,
  pid: z.string().uuid(),
  secret: z.string().min(10).max(200),
  action: z.enum(["start", "play", "draw", "pass", "uno", "catch"]),
  cardId: z.number().int().min(0).max(200).optional(),
  color: z.enum(["red", "yel", "grn", "blu"]).optional(),
});

export const roomAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ActionInput.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: sec } = await db.from("room_players").select("secret_hash")
      .eq("code", data.code).eq("player_id", data.pid).maybeSingle();
    if (!sec || sec.secret_hash !== (await sha(data.secret))) throw new Error("권한이 없어요");
    for (let i = 0; i < 4; i++) {
      const { data: r } = await db.from("rooms").select("*").eq("code", data.code).maybeSingle();
      if (!r) throw new Error("없는 방이에요");
      const P = r.players as unknown as Player[];
      const s = r.state as unknown as GameState | null;
      let next: GameState;
      if (data.action === "start") {
        if (r.host_id !== data.pid) throw new Error("방장만 시작할 수 있어요");
        if (P.length < 2) throw new Error("2명 이상 필요해요");
        if (s && !s.winner) throw new Error("이미 진행 중이에요");
        next = startGame(P);
      } else {
        if (!s) throw new Error("게임이 시작되지 않았어요");
        if (data.action === "play") next = play(s, P, data.pid, data.cardId ?? -1, data.color);
        else if (data.action === "draw") next = drawOne(s, P, data.pid);
        else if (data.action === "pass") next = pass(s, P, data.pid);
        else if (data.action === "uno") next = callUno(s, P, data.pid);
        else next = catchUno(s, P, data.pid);
      }
      const { data: upd } = await db.from("rooms")
        .update({ state: next as never, status: next.winner ? "over" : "playing", version: r.version + 1 })
        .eq("code", data.code).eq("version", r.version).select();
      if (upd?.length) return { ok: true };
    }
    throw new Error("잠시 후 다시 시도해주세요");
  });
