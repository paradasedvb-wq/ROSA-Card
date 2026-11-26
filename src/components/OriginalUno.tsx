import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { createRoom, joinRoom, roomAction, readRoom } from "@/lib/rooms.functions";
import { getNick, getSeat, saveSeat, setNick, type Seat } from "@/lib/session";
import type { Color, GameState, Player } from "@/lib/uno";

interface Room { code: string; host_id: string; max_players: number; status: string; players: Player[]; state: GameState | null; version: number }
interface OriginalWindow extends Window { unoOnline?: { changeMode: (online: boolean) => void; renderRoom: (room: Room, pid: string) => void } }
type Action = { action: "start" | "play" | "draw" | "pass" | "uno" | "catch"; cardId?: number; color?: Color };

export function OriginalUno({ code }: { code?: string }) {
  const nav = useNavigate();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(!!code);
  const [room, setRoom] = useState<Room | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [max, setMax] = useState(4);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, refreshWinner] = useState(0);
  const original = useCallback(() => frame.current?.contentWindow as OriginalWindow | null, []);
  const document = ready ? frame.current?.contentDocument : null;

  const load = useCallback(async () => {
    if (!code) return;
    const saved = getSeat(code);
    if (!saved) { setError("이 방의 참가자가 아니에요"); return; }
    try {
      const data = await readRoom({ data: { code, ...saved } });
      setRoom(previous => !previous || data.version >= previous.version ? data as unknown as Room : previous);
    } catch { setError("이 방의 참가자 정보를 확인할 수 없어요. 코드로 다시 입장해주세요."); }
  }, [code]);

  useEffect(() => {
    if (!code) return;
    setSeat(getSeat(code));
    void load();
    const timer = setInterval(() => { void load(); }, 2000);
    return () => { clearInterval(timer); };
  }, [code, load]);

  useEffect(() => {
    if (!ready) return;
    original()?.unoOnline?.changeMode(online);
    if (room && seat && room.players.some(p => p.id === seat.pid)) original()?.unoOnline?.renderRoom(room, seat.pid);
  }, [ready, online, room, seat, original]);

  async function send(action: Action) {
    if (!code || !seat || busy) return;
    setBusy(true); setError("");
    try { await roomAction({ data: { code, ...seat, ...action } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "다시 시도해주세요"); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin || event.data?.source !== "vkuno-original") return;
      const data = event.data;
      if (data.kind === "mode" && !code) setOnline(false);
      if (data.kind === "action") void send({ action: data.action, ...(data.cardId !== undefined ? { cardId: data.cardId } : {}), ...(data.color ? { color: data.color } : {}) });
      if (data.kind === "quit") void nav({ to: "/" });
      if (data.kind === "winner") refreshWinner(n => n + 1);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  });

  async function enter(create: boolean) {
    if (busy) return;
    const nick = frame.current?.contentDocument?.getElementById("nickIn") as HTMLInputElement | null;
    const name = nick?.value.trim() ?? "";
    if (!name) { setError("닉네임을 입력하세요"); nick?.focus(); return; }
    const c = joinCode.trim().toUpperCase();
    if (!create && !/^[A-Z0-9]{5}$/.test(c)) { setError("5자리 방 코드를 입력하세요"); return; }
    setNick(name); setBusy(true); setError("");
    try {
      if (!create && getSeat(c)) { await nav({ to: "/room/$code", params: { code: c } }); return; }
      const result = create ? await createRoom({ data: { name, max } }) : await joinRoom({ data: { code: c, name } });
      saveSeat(result.code, result);
      await nav({ to: "/room/$code", params: { code: result.code } });
    } catch (e) { setError(e instanceof Error ? e.message : "다시 시도해주세요"); }
    finally { setBusy(false); }
  }

  function loaded() {
    const doc = frame.current?.contentDocument;
    if (!doc || doc.location.pathname !== "/solo.html" || doc.getElementById("onlineBridge")) return;
    const script = doc.createElement("script");
    script.id = "onlineBridge";
    script.src = "/online-bridge.js";
    script.onload = () => {
      const nick = doc.getElementById("nickIn") as HTMLInputElement | null;
      if (nick) nick.value = getNick();
      setReady(true);
    };
    doc.body.appendChild(script);
  }

  // The static iframe can finish loading before React hydrates the parent page.
  useEffect(() => {
    if (frame.current?.contentDocument?.readyState === "complete") loaded();
  }, []);

  const modeSlot = document?.getElementById("onlineMode");
  const controls = document?.getElementById("onlineControls");
  const winner = document?.getElementById("onlineWinner");
  const member = !!seat && !!room?.players.some(p => p.id === seat.pid);
  const host = member && room?.host_id === seat?.pid;

  return <>
    <iframe ref={frame} src="/solo.html" title="ROSA Card 게임" className="fixed inset-0 h-dvh w-full border-0 bg-card" onLoad={loaded} />
    {modeSlot && createPortal(<Button className={`cb${online ? " on" : ""}`} onClick={() => { setOnline(true); original()?.unoOnline?.changeMode(true); }}>🌐 멀티</Button>, modeSlot)}
    {controls && online && createPortal(<>
      {!code ? <>
        <div className="flabel">인원 수 · {max}명</div>
        <div className="brow">{Array.from({ length: 9 }, (_, i) => i + 2).map(n => <Button key={n} className={`cb${max === n ? " on" : ""}`} aria-pressed={max === n} onClick={() => setMax(n)}>{n}</Button>)}</div>
        <Button className="go-btn" disabled={busy} onClick={() => { void enter(true); }}>방 만들기</Button>
        <div className="online-row"><input className="nick-in" aria-label="방 코드" placeholder="방 코드" maxLength={5} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} /><Button className="cb" disabled={busy} onClick={() => { void enter(false); }}>입장</Button></div>
      </> : !room ? <p>{error || "불러오는 중…"}</p> : !member ? <><p>이 방의 참가자가 아니에요</p><Button className="go-btn" onClick={() => { void nav({ to: "/" }); }}>코드로 입장하기</Button></> : <>
        <div className="flabel">방 코드</div>
        <Button className="cb online-code" aria-label="방 코드 복사" onClick={() => { void navigator.clipboard?.writeText(code); }}>{code} ⧉</Button>
        <div className="flabel">참가자 {room.players.length} / {room.max_players}</div>
        <ul className="online-players">{room.players.map(p => <li key={p.id}>{p.name}{p.id === room.host_id ? " 👑" : ""}{p.id === seat?.pid ? " (나)" : ""}</li>)}</ul>
        {host ? <Button className="go-btn" disabled={busy || room.players.length < 2} onClick={() => { void send({ action: "start" }); }}>{room.players.length < 2 ? "2명 이상 필요해요" : "게임 시작 (순서 랜덤)"}</Button> : <p>방장이 시작하길 기다리는 중…</p>}
      </>}
      {error && <p className="online-error" role="alert">{error}</p>}
    </>, controls)}
    {winner && createPortal(<>{host ? <Button className="go-btn" disabled={busy} onClick={() => { void send({ action: "start" }); }}>다시 하기</Button> : <p>방장이 다시 시작할 수 있어요</p>}<Button className="cb" onClick={() => { void nav({ to: "/" }); }}>처음으로</Button>{error && <p role="alert">{error}</p>}</>, winner)}
    {error && room?.state && document && createPortal(<p className="online-error" role="alert">{error}</p>, document.getElementById("logBox") ?? document.body)}
  </>;
}