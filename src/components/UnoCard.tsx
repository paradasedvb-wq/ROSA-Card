import type { Card, Color } from "@/lib/uno";
import { cardLabel } from "@/lib/uno";
import { cn } from "@/lib/utils";

const bg: Record<string, string> = {
  red: "bg-uno-red", yel: "bg-uno-yel", grn: "bg-uno-grn", blu: "bg-uno-blu", wild: "bg-uno-wild",
};

export function UnoCard({ card, color, small, dim, onClick }: { card?: Card; color?: Color; small?: boolean; dim?: boolean; onClick?: (() => void) | undefined }) {
  const size = small ? "w-10 h-14 text-sm rounded-lg" : "w-16 h-24 text-2xl rounded-xl";
  if (!card)
    return <div className={cn("uno-card relative flex items-center justify-center bg-uno-red font-display text-uno-yel", size)}>{small ? "" : "UNO"}</div>;
  const c = card.color === "wild" ? (color ?? "wild") : card.color;
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn("uno-card relative flex shrink-0 items-center justify-center font-display text-primary-foreground transition-transform", size, bg[c], dim && "opacity-40", onClick && !dim && "hover:-translate-y-2 active:scale-95")}
    >
      <span className="drop-shadow">{cardLabel(card)}</span>
    </button>
  );
}
