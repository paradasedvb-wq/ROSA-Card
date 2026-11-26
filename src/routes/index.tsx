import { createFileRoute } from "@tanstack/react-router";
import { OriginalUno } from "@/components/OriginalUno";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ROSA Card 멀티플레이 — 코드로 친구와 우노" },
      { name: "description", content: "방을 만들고 코드를 공유해 2~10명이 함께 우노를 즐기세요." },
      { property: "og:title", content: "ROSA Card 멀티플레이" },
      { property: "og:description", content: "방 코드로 친구와 함께하는 우노 게임" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OriginalUno,
});

