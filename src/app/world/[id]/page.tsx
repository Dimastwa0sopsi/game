import GameView from "@/components/GameView";

export default async function WorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GameView worldId={Number(id)} />;
}
