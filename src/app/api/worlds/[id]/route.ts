import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { worldBlocks, worldChests, worldFurnaces, worlds } from "@/db/schema";
import type { SavePayload } from "@/lib/game/save";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const worldId = Number(id);
  if (!Number.isFinite(worldId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId));
  if (!world) return NextResponse.json({ error: "not found" }, { status: 404 });
  const edits = await db
    .select({ x: worldBlocks.x, y: worldBlocks.y, z: worldBlocks.z, block: worldBlocks.block })
    .from(worldBlocks)
    .where(eq(worldBlocks.worldId, worldId));
  let chests: any[] = [];
  try {
    chests = await db
      .select({ x: worldChests.x, y: worldChests.y, z: worldChests.z, items: worldChests.items })
      .from(worldChests)
      .where(eq(worldChests.worldId, worldId));
  } catch { chests = []; }
  let furnaces: any[] = [];
  try {
    const rows = await db.select({ x: worldFurnaces.x, y: worldFurnaces.y, z: worldFurnaces.z, data: worldFurnaces.data }).from(worldFurnaces).where(eq(worldFurnaces.worldId, worldId));
    furnaces = rows.map((r: any) => ({ x: r.x, y: r.y, z: r.z, data: r.data }));
  } catch { furnaces = []; }
  return NextResponse.json({
    world: {
      id: world.id,
      name: world.name,
      seed: world.seed,
      gameMode: world.gameMode,
      playSeconds: world.playSeconds,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
      blockCount: edits.length,
    },
    player: world.playerState ?? null,
    edits,
    chests: chests.map((c: any) => ({ x: c.x, y: c.y, z: c.z, items: (c.items ?? []) as Array<null | { id: string; count: number; durability?: number }> })),
    furnaces,
  });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const worldId = Number(id);
  if (!Number.isFinite(worldId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as SavePayload | null;
  if (!body?.player) return NextResponse.json({ error: "bad payload" }, { status: 400 });

  await db
    .update(worlds)
    .set({
      playerState: body.player,
      gameMode: body.player.mode,
      playSeconds: sqlAddPlaySeconds(worldId, body.playSeconds ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(worlds.id, worldId));

  const edits = (body.edits ?? []).filter((e) => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.z));
  for (let i = 0; i < edits.length; i += 400) {
    const batch = edits.slice(i, i + 400).map((e) => ({ worldId, x: e.x, y: e.y, z: e.z, block: e.block }));
    if (batch.length === 0) continue;
    await db
      .insert(worldBlocks)
      .values(batch)
      .onConflictDoUpdate({
        target: [worldBlocks.worldId, worldBlocks.x, worldBlocks.y, worldBlocks.z],
        set: { block: sqlExcluded("block") },
      });
  }

  const removed = (body.chests ?? []).filter((c) => c.deleted && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z));
  for (const c of removed) {
    await db
      .delete(worldChests)
      .where(sql`${worldChests.worldId} = ${worldId} and ${worldChests.x} = ${c.x} and ${worldChests.y} = ${c.y} and ${worldChests.z} = ${c.z}`);
  }

  const chests = (body.chests ?? []).filter(
    (c) => !c.deleted && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z),
  );
  for (let i = 0; i < chests.length; i += 200) {
    const batch = chests.slice(i, i + 200).map((c) => ({ worldId, x: c.x, y: c.y, z: c.z, items: c.items }));
    if (batch.length === 0) continue;
    await db
      .insert(worldChests)
      .values(batch)
      .onConflictDoUpdate({
        target: [worldChests.worldId, worldChests.x, worldChests.y, worldChests.z],
        set: { items: sqlExcluded("items") },
      });
  }

  // furnaces (optional, ignore if table missing)
  try {
    const removedF = (body as any).furnaces?.filter((c: any) => c.deleted && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z)) ?? [];
    for (const c of removedF) {
      await db
        .delete(worldFurnaces)
        .where(sql`${worldFurnaces.worldId} = ${worldId} and ${worldFurnaces.x} = ${c.x} and ${worldFurnaces.y} = ${c.y} and ${worldFurnaces.z} = ${c.z}`);
    }
    const furnaces = ((body as any).furnaces ?? []).filter((c: any) => !c.deleted && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z) && c.data);
    for (let i = 0; i < furnaces.length; i += 100) {
      const batch = furnaces.slice(i, i + 100).map((c: any) => ({ worldId, x: c.x, y: c.y, z: c.z, data: c.data }));
      if (batch.length === 0) continue;
      await db
        .insert(worldFurnaces)
        .values(batch)
        .onConflictDoUpdate({
          target: [worldFurnaces.worldId, worldFurnaces.x, worldFurnaces.y, worldFurnaces.z],
          set: { data: sqlExcluded("data") },
        });
    }
  } catch (e) {
    console.warn("[save] furnace table missing or failed", e);
  }

  return NextResponse.json({ ok: true, saved: { edits: edits.length, chests: chests.length, furnaces: ((body as any).furnaces ?? []).length } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const worldId = Number(id);
  if (!Number.isFinite(worldId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await db.delete(worlds).where(eq(worlds.id, worldId));
  return NextResponse.json({ ok: true });
}


function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

function sqlAddPlaySeconds(_worldId: number, seconds: number) {
  return sql`${worlds.playSeconds} + ${seconds}`;
}
