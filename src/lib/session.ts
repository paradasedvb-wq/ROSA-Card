export const getNick = () => localStorage.getItem("uno_nick") ?? "";
export const setNick = (n: string) => localStorage.setItem("uno_nick", n);
export interface Seat { pid: string; secret: string }
export const saveSeat = (code: string, s: Seat) => localStorage.setItem("uno_seat_" + code, JSON.stringify(s));
export function getSeat(code: string): Seat | null {
  try { return JSON.parse(localStorage.getItem("uno_seat_" + code) ?? "null"); } catch { return null; }
}
