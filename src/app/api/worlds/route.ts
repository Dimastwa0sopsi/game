import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { worldBlocks, worlds } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(worlds).orderBy(desc(worlds.updatedAt)).limit(50);
  const counts = await db
    .select({ worldId: worldBlocks.worldId, count: sql<number>`count(*)::int` })
    .from(worldBlocks)
    .groupBy(worldBlocks.worldId);
  const countMap = new Map(counts.map((c) => [c.worldId, c.count]));
  return NextResponse.json({
    worlds: rows.map((w) => ({
      id: w.id,
      name: w.name,
      seed: w.seed,
      gameMode: w.gameMode,
      playSeconds: w.playSeconds,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      blockCount: countMap.get(w.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    seed?: string | number;
    gameMode?: string;
  };
  const name = (body.name ?? "").trim() || "Новый мир";
  let seed: number;
  if (typeof body.seed === "number") seed = Math.floor(body.seed);
  else if (typeof body.seed === "string" && body.seed.trim().length > 0) {
    const numeric = Number(body.seed.trim());
    seed = Number.isFinite(numeric) ? Math.floor(numeric) : hashString(body.seed.trim());
  } else seed = Math.floor(Math.random() * 2_000_000_000);
  const gameMode = body.gameMode === "creative" ? "creative" : "survival";
  const [row] = await db.insert(worlds).values({ name, seed, gameMode }).returning();
  return NextResponse.json({ world: { ...row, blockCount: 0 } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await db.delete(worlds).where(eq(worlds.id, id));
  return NextResponse.json({ ok: true });
}

function hashString(text: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h % 2_000_000_000;
}
