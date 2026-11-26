import { createFileRoute } from "@tanstack/react-router";
import { OriginalUno } from "@/components/OriginalUno";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `ROSA Card 방 ${params.code}` },
      { name: "description", content: "우노 멀티플레이 게임방" },
      { property: "og:title", content: `ROSA Card 방 ${params.code}` },
      { property: "og:description", content: "코드로 입장해 함께 우노를 하세요" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});


function RoomPage() {
  const { code } = Route.useParams();
  return <OriginalUno code={code} />;
}
