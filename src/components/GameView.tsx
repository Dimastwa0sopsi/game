"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Game, GameState, GameMode, TRADES } from "@/lib/game/engine";
import { getItem, RECIPES, CREATIVE_TABS, ITEMS } from "@/lib/game/registry";
import { getItemIcon } from "@/lib/game/textures";
import type { SavePayload, WorldLoadResponse } from "@/lib/game/save";

function ItemIcon({ id, size = 36 }: { id: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getItemIcon(id)}
      alt={getItem(id)?.name ?? id}
      width={size}
      height={size}
      draggable={false}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function SlotView({
  slot,
  onClick,
  selected,
  size = 44,
  label,
}: {
  slot: { id: string; count: number } | null;
  onClick?: (right: boolean, shift: boolean) => void;
  selected?: boolean;
  size?: number;
  label?: string;
}) {
  return (
    <button
      title={slot ? getItem(slot.id)?.name : label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick?.(e.button === 2, e.shiftKey);
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center border-2 ${
        selected ? "border-lime-300 bg-lime-400/20" : "border-white/25 bg-black/45 hover:border-white/60"
      }`}
    >
      {slot && <ItemIcon id={slot.id} size={size - 10} />}
      {slot && slot.count > 1 && (
        <span className="absolute bottom-0 right-0.5 text-[11px] font-bold text-white drop-shadow-[1px_1px_0_#000]">
          {slot.count}
        </span>
      )}
      {slot && getItem(slot.id)?.tool && (
        <span className="absolute left-0.5 top-0.5 h-1 w-full max-w-[80%] bg-black/40">
          <span
            className="block h-1 bg-lime-400"
            style={{ width: `${Math.max(0, Math.min(100, (slot as { durability?: number }).durability ?? 100))}%` }}
          />
        </span>
      )}
    </button>
  );
}

function Hearts({ health }: { health: number }) {
  const hearts = [];
  for (let i = 0; i < 10; i++) {
    const filled = health >= (i + 1) * 2;
    const half = !filled && health >= i * 2 + 1;
    hearts.push(
      <span key={i} className="relative text-lg leading-none">
        <span className="text-black/70">❤</span>
        <span className={`absolute left-0 top-0 overflow-hidden ${filled ? "w-full" : half ? "w-1/2" : "w-0"}`}>❤</span>
      </span>,
    );
  }
  return <div className="flex gap-0.5 drop-shadow-[1px_1px_0_#000]">{hearts}</div>;
}

function Food({ food }: { food: number }) {
  return (
    <div className="flex gap-0.5 drop-shadow-[1px_1px_0_#000]">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={`text-lg leading-none ${food >= (i + 1) * 2 ? "text-amber-400" : "text-black/60"}`}>
          🍗
        </span>
      ))}
    </div>
  );
}

export default function GameView({ worldId }: { worldId: number }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [worldName, setWorldName] = useState("мир");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [creativeTab, setCreativeTab] = useState<string>("blocks");
  const [debug, setDebug] = useState(false);

  const save = useCallback(
    async (payload: SavePayload) => {
      await fetch(`/api/worlds/${worldId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    [worldId],
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const res = await fetch(`/api/worlds/${worldId}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Мир не найден");
        return;
      }
      const data = (await res.json()) as WorldLoadResponse;
      if (cancelled) return;
      setWorldName(data.world.name);
      const game = new Game({
        canvas: canvasRef.current!,
        seed: data.world.seed,
        mode: data.world.gameMode === "creative" ? "creative" : "survival",
        player: data.player,
        edits: data.edits,
        chests: data.chests,
        furnaces: (data as any).furnaces ?? [],
        onState: (s) => setState(s),
        onAutoSave: (payload) => void save(payload as any),
      });
      gameRef.current = game;
      game.start();
      setReady(true);
    }
    void boot();
    return () => {
      cancelled = true;
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, [worldId, save]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setCursorPos({ x: e.clientX, y: e.clientY });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F3") setDebug((d) => !d);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const game = gameRef.current;
  const slots = state?.slots ?? new Array(36).fill(null);
  const chestSlots = useMemo(() => {
    if (!state?.chestKey || !game) return new Array(27).fill(null);
    return game.chests.get(state.chestKey) ?? new Array(27).fill(null);
  }, [state?.chestKey, state, game]);
  const furnace = state?.furnace ?? null;

  const recipes = useMemo(() => {
    return RECIPES.map((r, i) => ({ ...r, index: i, can: (state?.craftable ?? []).includes(i) }));
  }, [state?.craftable]);

  const creativeItems = useMemo(() => {
    return Object.values(ITEMS).filter((i) => i.category === creativeTab);
  }, [creativeTab]);

  async function saveAndExit() {
    const g = gameRef.current;
    if (g) {
      g.setPaused(true);
      await save(g.savePayload());
    }
    router.push("/");
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <p className="text-xl font-bold">{error}</p>
          <button onClick={() => router.push("/")} className="mt-4 border-2 border-lime-300 px-4 py-2 font-bold">
            В главное меню
          </button>
        </div>
      </div>
    );
  }

  const inMenu = Boolean(state && (state.inventoryOpen || state.paused || state.dead || state.tradeOffers || state.chestKey || state.furnaceKey));

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" onClick={() => gameRef.current?.requestLock()} />

      {/* underwater tint */}
      {state?.underwater && <div className="pointer-events-none absolute inset-0 bg-blue-600/30" />}
      {/* damage vignette */}
      {state && state.health <= 6 && !state.dead && (
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_rgba(180,0,0,0.7)]" />
      )}

      {/* crosshair */}
      {!inMenu && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-6 w-6 opacity-80 mix-blend-difference">
            <div className="absolute left-1/2 top-0 h-6 w-0.5 -translate-x-1/2 bg-white" />
            <div className="absolute top-1/2 left-0 h-0.5 w-6 -translate-y-1/2 bg-white" />
          </div>
        </div>
      )}

      {/* mining progress ring */}
      {state && state.progress > 0 && !inMenu && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 mt-8 h-1.5 w-24 -translate-x-1/2 bg-black/60">
          <div className="h-full bg-lime-400" style={{ width: `${Math.min(100, state.progress * 100)}%` }} />
        </div>
      )}

      {/* sprint indicator */}
      {state?.sprinting && !inMenu && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 border border-sky-300/40 bg-sky-500/20 px-3 py-0.5 text-xs font-bold text-sky-100">БЕГ</div>
      )}

      {/* mobile controls */}
      <div className="absolute inset-0 sm:hidden">
        <div className="absolute bottom-20 left-3 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-1 opacity-40">
            <div />
            <button className="pointer-events-auto h-12 w-12 border-2 border-white/30 bg-black/40 active:bg-white/20" onTouchStart={(e)=>{e.preventDefault(); game?.["keys"]?.add("KeyW")}} onTouchEnd={()=>game?.["keys"]?.delete("KeyW")}>W</button>
            <div />
            <button className="pointer-events-auto h-12 w-12 border-2 border-white/30 bg-black/40 active:bg-white/20" onTouchStart={(e)=>{e.preventDefault(); game?.["keys"]?.add("KeyA")}} onTouchEnd={()=>game?.["keys"]?.delete("KeyA")}>A</button>
            <button className="pointer-events-auto h-12 w-12 border-2 border-white/30 bg-black/40 active:bg-white/20" onTouchStart={(e)=>{e.preventDefault(); game?.["keys"]?.add("KeyS")}} onTouchEnd={()=>game?.["keys"]?.delete("KeyS")}>S</button>
            <button className="pointer-events-auto h-12 w-12 border-2 border-white/30 bg-black/40 active:bg-white/20" onTouchStart={(e)=>{e.preventDefault(); game?.["keys"]?.add("KeyD")}} onTouchEnd={()=>game?.["keys"]?.delete("KeyD")}>D</button>
          </div>
          <button className="pointer-events-auto h-10 w-20 border-2 border-amber-300/40 bg-amber-500/10 text-xs font-bold active:bg-amber-500/30" onTouchStart={(e)=>{e.preventDefault(); game?.["keys"]?.add("Space")}} onTouchEnd={()=>game?.["keys"]?.delete("Space")}>Прыжок</button>
        </div>
        <div className="absolute bottom-20 right-3 flex flex-col gap-2">
          <button className="pointer-events-auto h-12 w-12 rounded-full border-2 border-red-300/60 bg-red-500/20 font-bold active:bg-red-500/40" onTouchStart={()=>{ const g=game; if(g) (g as any).attack?.call(g) }}>⚔</button>
          <button className="pointer-events-auto h-12 w-12 rounded-full border-2 border-white/30 bg-black/40 font-bold active:bg-white/20" onTouchStart={()=>game?.["keys"]?.add("KeyE")} onTouchEnd={()=>game?.["keys"]?.delete("KeyE")}>E</button>
          <button className="pointer-events-auto h-10 w-10 border-2 border-white/20 bg-black/40 text-[10px] active:bg-white/20" onClick={()=>game?.toggleInventory()}>INV</button>
        </div>
      </div>

      {/* debug */}
      {debug && state && (
        <div className="pointer-events-none absolute left-2 top-2 space-y-0.5 bg-black/60 p-2 font-mono text-[11px] text-lime-200">
          <div>KUBOKRAFT · {state.fps} fps</div>
          <div>
            XYZ {state.pos.x.toFixed(1)} / {state.pos.y.toFixed(1)} / {state.pos.z.toFixed(1)}
          </div>
          <div>биом: {state.biome}</div>
          <div>чанков: {state.chunks} · сущностей: {state.mobs}</div>
          <div>время: {state.clock} · режим: {state.mode}</div>
          {state.target && <div>блок: {state.target}</div>}
          <div>мир: {worldName}</div>
        </div>
      )}

      {/* minimap */}
      {state && (
        <div className="pointer-events-none absolute left-2 top-2 hidden sm:block">
          <div className="border-2 border-white/20 bg-black/60 p-1">
            <div className="relative h-28 w-28 overflow-hidden bg-emerald-900/30">
              <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 50% 50%, #5fa33a 2px, transparent 3px)`, backgroundSize: `14px 14px` }} />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-red-500 shadow" />
              <div className="absolute bottom-1 left-1 text-[8px] font-mono text-white/60">{Math.floor(state.pos.x)}, {Math.floor(state.pos.z)}</div>
              <div className="absolute top-1 left-1 text-[7px] font-bold uppercase text-lime-200">{state.biome}</div>
            </div>
            <div className="mt-1 flex justify-between text-[8px] font-bold text-white/50">
              <span>чанков {state.chunks}</span>
              <span>{state.mobs} мобов</span>
            </div>
          </div>
          {state.achievements && (
            <div className="mt-2 border border-amber-300/20 bg-black/50 px-2 py-1 text-[10px]">
              <div className="font-bold text-amber-200">Достижения {Object.values(state.achievements).filter(Boolean).length}/12</div>
              <div className="mt-0.5 flex gap-0.5 flex-wrap max-w-[110px]">
                {Object.entries(state.achievements).filter(([,v])=>v).slice(0,8).map(([k])=>(
                  <span key={k} className="h-1.5 w-1.5 bg-amber-400 rounded-full" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* top-right status */}
      <div className="pointer-events-none absolute right-2 top-2 flex flex-col items-end gap-1 text-xs">
        <div className="bg-black/50 px-2 py-1 font-bold uppercase tracking-wide">
          {state?.mode === "creative" ? "Творческий" : "Выживание"} · {state?.clock} {state?.sprinting ? " · бег" : ""}
        </div>
        {state?.saveState !== "idle" && (
          <div className="bg-black/50 px-2 py-1 text-lime-200">
            {state?.saveState === "saving" ? "Сохранение…" : "Сохранено"}
          </div>
        )}
        <div className="flex gap-1">
          <div className="bg-black/50 px-2 py-1 text-white/70">{worldName}</div>
          <button
            onClick={() => game?.toggleWeather()}
            className="pointer-events-auto border border-white/20 bg-black/60 px-2 py-1 hover:border-sky-300"
          >
            {state?.weather === "rain" ? "🌧 дождь" : "☀ ясно"}
          </button>
        </div>
        {state?.version && <div className="bg-lime-500/20 border border-lime-300/40 px-2 py-0.5 text-[10px] font-bold text-lime-200">{state.version}</div>}
      </div>

      {/* HUD bottom */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
        {state?.message && (
          <div className="mb-1 border border-lime-300/50 bg-black/70 px-3 py-1 text-sm text-lime-100">{state.message}</div>
        )}
        {state?.toast && (
          <div className="mb-1 flex items-center gap-2 border-2 border-amber-300 bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-100 shadow-lg animate-bounce">
            <span>🏆</span> <span>{state.toast.title}</span> <span className="text-xs font-normal opacity-70">{state.toast.desc}</span>
          </div>
        )}
        {state?.heldName && <div className="text-xs text-white/80 drop-shadow-[1px_1px_0_#000]">{state.heldName}</div>}
        {state?.mode === "survival" && (
          <div className="flex w-full items-end justify-between gap-6">
            <Hearts health={state.health} />
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-1.5 w-24 overflow-hidden border border-white/20 bg-black/60">
                <div className="h-full bg-sky-400" style={{ width: `${Math.min(100, (state.xpLevel / 30) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-sky-200">ур. {state.xpLevel} · {state.travelled} м</span>
            </div>
            <Food food={state.food} />
          </div>
        )}
        <div className="pointer-events-auto flex gap-1 border-2 border-black/60 bg-black/45 p-1">
          {slots.slice(0, 9).map((slot, i) => (
            <SlotView
              key={i}
              slot={slot}
              selected={state?.selected === i}
              onClick={() => gameRef.current?.setSelected(i)}
            />
          ))}
        </div>
      </div>

      {/* click to play */}
      {ready && !inMenu && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="mt-40 rounded border border-white/20 bg-black/55 px-4 py-2 text-sm text-white/80">
            Клик — захватить мышь · ЛКМ — копать · ПКМ — ставить/открыть · E — инвентарь · Esc — пауза
          </div>
        </div>
      )}

      {/* loading */}
      {(!ready || state?.loading) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80">
          <p className="text-lg font-bold tracking-wide text-lime-200">
            {ready ? "Генерация рельефа, лесов и деревень…" : "Загрузка мира…"}
          </p>
          <div className="h-2 w-64 overflow-hidden border border-lime-300/40">
            <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] bg-lime-400" />
          </div>
          <style>{`@keyframes loading { 0% { transform: translateX(-100%) } 100% { transform: translateX(300%) } }`}</style>
        </div>
      )}

      {/* cursor stack */}
      {state?.cursor && inMenu && (
        <div
          className="pointer-events-none fixed z-50 flex items-center justify-center"
          style={{ left: cursorPos.x - 18, top: cursorPos.y - 18 }}
        >
          <ItemIcon id={state.cursor.id} size={36} />
          {state.cursor.count > 1 && (
            <span className="absolute bottom-0 right-0 text-xs font-bold drop-shadow-[1px_1px_0_#000]">
              {state.cursor.count}
            </span>
          )}
        </div>
      )}

      {/* inventory */}
      {state?.inventoryOpen && game && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-full w-full max-w-4xl overflow-auto border-4 border-slate-700 bg-slate-800/95 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-wide text-lime-200">
                {state.mode === "creative" ? "Творческий инвентарь" : "Инвентарь и верстак"}
              </h2>
              <button
                onClick={() => game.toggleInventory()}
                className="border-2 border-white/30 px-3 py-1 text-sm font-bold hover:border-red-300 hover:text-red-200"
              >
                Закрыть (E)
              </button>
            </div>

            {state.mode === "creative" ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {CREATIVE_TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setCreativeTab(t.key)}
                      className={`border-2 px-3 py-1 text-sm font-bold ${
                        creativeTab === t.key ? "border-lime-300 bg-lime-500/20" : "border-white/20 bg-black/40"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid max-h-64 grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-1 overflow-auto border border-white/10 bg-black/40 p-2">
                  {creativeItems.map((item) => (
                    <SlotView
                      key={item.id}
                      slot={{ id: item.id, count: 1 }}
                      size={46}
                      label={item.name}
                      onClick={(right) => {
                        game.giveCreative(item.id);
                        if (right) game.inventory.add(item.id, 63);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase text-white/60">Крафт</p>
                  <div className="mt-1 max-h-72 space-y-1 overflow-auto border border-white/10 bg-black/40 p-2">
                    {recipes.map((r) => (
                      <button
                        key={`${r.out}-${r.index}`}
                        onClick={() => game.craft(r.index)}
                        disabled={!r.can}
                        className={`flex w-full items-center gap-2 border px-2 py-1 text-left text-sm ${
                          r.can ? "border-lime-300/60 bg-lime-500/10 hover:bg-lime-500/25" : "border-white/10 opacity-45"
                        }`}
                      >
                        <ItemIcon id={r.out} size={28} />
                        <span className="flex-1">
                          {getItem(r.out)?.name ?? r.out} <span className="text-white/60">×{r.count}</span>
                        </span>
                        <span className="flex flex-wrap justify-end gap-1">
                          {Object.entries(r.need).map(([id, n]) => (
                            <span key={id} className="flex items-center gap-0.5 text-[11px] text-white/70">
                              <ItemIcon id={id} size={16} />×{n}
                            </span>
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col">
                  <p className="text-xs font-bold uppercase text-white/60">Инвентарь</p>
                  <div className="mt-1 grid grid-cols-9 gap-1">
                    {slots.slice(9).map((slot, i) => (
                      <SlotView
                        key={i + 9}
                        slot={slot}
                        onClick={(right, shift) => game.clickSlot(i + 9, right, shift)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs font-bold uppercase text-white/60">Панель быстрого доступа</p>
            <div className="mt-1 grid grid-cols-9 gap-1">
              {slots.slice(0, 9).map((slot, i) => (
                <SlotView key={i} slot={slot} selected={state.selected === i} onClick={(right, shift) => game.clickSlot(i, right, shift)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* chest */}
      {state?.chestKey && game && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl border-4 border-amber-800/80 bg-[#8b5a2b]/40 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-wide text-amber-100">Сундук</h2>
              <div className="flex gap-2">
                <button onClick={() => game.takeChestAll()} className="border-2 border-amber-200/70 px-3 py-1 text-sm font-bold hover:bg-amber-500/30">
                  Забрать всё
                </button>
                <button onClick={() => game.closeChest()} className="border-2 border-white/30 px-3 py-1 text-sm font-bold hover:border-red-300">
                  Закрыть
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-9 gap-1">
              {chestSlots.map((slot, i) => (
                <SlotView key={i} slot={slot} onClick={(right, shift) => game.clickChest(i, right, shift)} />
              ))}
            </div>
            <p className="mt-4 text-xs font-bold uppercase text-amber-100/80">Инвентарь</p>
            <div className="mt-1 grid grid-cols-9 gap-1">
              {slots.slice(9).map((slot, i) => (
                <SlotView key={i + 9} slot={slot} onClick={(right, shift) => game.clickSlot(i + 9, right, shift)} />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-9 gap-1">
              {slots.slice(0, 9).map((slot, i) => (
                <SlotView key={i} slot={slot} selected={state.selected === i} onClick={(right, shift) => game.clickSlot(i, right, shift)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* furnace */}
      {state?.furnaceKey && furnace && game && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md border-4 border-stone-600 bg-stone-800/95 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-wide text-orange-200">Печь</h2>
              <button onClick={() => game.closeFurnace()} className="border-2 border-white/30 px-3 py-1 text-sm font-bold hover:border-red-300">Закрыть</button>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase text-white/60">Вход</span>
                <SlotView slot={furnace.input} onClick={(r,sh)=>game.clickFurnace(0,r,sh)} size={54} />
                <span className="text-[10px] text-white/40">{furnace.input ? (getItem(furnace.input.id)?.name ?? furnace.input.id) : "пусто"}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-orange-400 text-xl">🔥</div>
                <div className="h-16 w-2 overflow-hidden border border-white/20 bg-black/40">
                  <div className="bg-orange-500 w-full transition-all" style={{ height: `${furnace.burnMax ? (furnace.burnTime / furnace.burnMax) * 100 : 0}%` }} />
                </div>
                <div className="h-2 w-16 overflow-hidden border border-white/20 bg-black/40">
                  <div className="bg-lime-400 h-full transition-all" style={{ width: `${(furnace.cookTime / furnace.cookMax) * 100}%` }} />
                </div>
                <div className="text-xs text-white/60">{furnace.burnTime > 0 ? "горит" : "потухла"}</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase text-white/60">Выход</span>
                <SlotView slot={furnace.output} onClick={(r,sh)=>game.clickFurnace(2,r,sh)} size={54} />
                <button onClick={()=>game.takeFurnaceOutput()} className="mt-1 w-full border border-lime-300/40 bg-lime-500/10 py-0.5 text-[10px] font-bold hover:bg-lime-500/20">Забрать</button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-xs uppercase text-white/60">Топливо</span>
              <SlotView slot={furnace.fuel} onClick={(r,sh)=>game.clickFurnace(1,r,sh)} size={44} />
              <span className="text-xs text-white/40">уголь, палки, доски</span>
            </div>
            <p className="mt-3 text-center text-xs text-white/50">Положи руду + уголь → получи слиток. Shift+клик — быстрый перенос.</p>
            <p className="mt-2 text-center text-xs font-bold uppercase text-white/60">Инвентарь</p>
            <div className="mt-1 grid grid-cols-9 gap-1">
              {slots.slice(9).map((slot, i) => (
                <SlotView key={i + 9} slot={slot} onClick={(right, shift) => game.clickSlot(i + 9, right, shift)} />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-9 gap-1">
              {slots.slice(0, 9).map((slot, i) => (
                <SlotView key={i} slot={slot} selected={state.selected === i} onClick={(right, shift) => game.clickSlot(i, right, shift)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* villager trade */}
      {state?.tradeOffers && game && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg border-4 border-emerald-700/70 bg-slate-800/95 p-4">
            <h2 className="text-lg font-black uppercase tracking-wide text-emerald-200">Житель предлагает обмен</h2>
            <div className="mt-3 space-y-2">
              {state.tradeOffers.map((offer: (typeof TRADES)[number], i: number) => (
                <button
                  key={i}
                  onClick={() => game.tryTrade(i)}
                  className="flex w-full items-center gap-3 border-2 border-white/20 bg-black/40 px-3 py-2 text-left hover:border-emerald-300"
                >
                  <ItemIcon id={offer.give.id} size={28} />
                  <span className="font-mono text-sm">×{offer.give.count}</span>
                  <span className="text-white/50">→</span>
                  <ItemIcon id={offer.get.id} size={28} />
                  <span className="font-mono text-sm">×{offer.get.count}</span>
                  <span className="ml-auto text-xs text-white/60">{getItem(offer.get.id)?.name}</span>
                </button>
              ))}
            </div>
            <button onClick={() => game.closeTrade()} className="mt-4 w-full border-2 border-white/30 py-2 font-bold hover:border-red-300">
              Уйти
            </button>
          </div>
        </div>
      )}

      {/* pause */}
      {state?.paused && !state.dead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border-4 border-slate-700 bg-slate-800/95 p-6 text-center">
            <h2 className="text-2xl font-black uppercase tracking-wide text-lime-200">Пауза</h2>
            <p className="mt-1 text-sm text-white/60">Мир «{worldName}» сохраняется автоматически</p>
            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  game?.setPaused(false);
                  game?.requestLock();
                }}
                className="w-full border-2 border-lime-300 bg-lime-500/20 py-2 font-bold uppercase hover:bg-lime-500/40"
              >
                Продолжить
              </button>
              <button
                onClick={() => game?.setMode(state.mode === "creative" ? "survival" : "creative")}
                className="w-full border-2 border-sky-300/70 py-2 font-bold uppercase hover:bg-sky-500/20"
              >
                Режим: {state.mode === "creative" ? "творческий" : "выживание"} (сменить)
              </button>
              <button
                onClick={() => game?.toggleWeather()}
                className="w-full border-2 border-indigo-300/70 py-2 font-bold uppercase hover:bg-indigo-500/20"
              >
                Погода: {state.weather === "rain" ? "🌧 дождь" : "☀ ясно"} (сменить)
              </button>
              <div className="border-2 border-amber-300/30 bg-black/30 p-2 text-left">
                <div className="text-xs font-bold uppercase text-amber-200">Достижения {state.achievements ? Object.values(state.achievements).filter(Boolean).length : 0}/12</div>
                <div className="mt-1 grid grid-cols-6 gap-1">
                  {(["first_block","craft_table","furnace","copper","amethyst","village","trade","kill_mob","furnace_smelt","explorer","diamonds","lantern"] as const).map(id=>(
                    <div key={id} className={`h-6 w-6 border flex items-center justify-center text-[10px] ${state.achievements?.[id] ? "border-amber-300 bg-amber-500/30" : "border-white/10 bg-black/20 opacity-40"}`} title={id}>{state.achievements?.[id] ? "★" : "·"}</div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 border-2 border-white/20 p-2">
                <span className="text-xs uppercase text-white/60">Дальность</span>
                <input
                  type="range"
                  min={3}
                  max={9}
                  defaultValue={5}
                  onChange={(e) => game?.setRenderDistance(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
              <button
                onClick={() => {
                  game?.flushSave();
                  game?.notify("Мир сохранён");
                }}
                className="w-full border-2 border-emerald-300/70 py-2 font-bold uppercase hover:bg-emerald-500/20"
              >
                Сохранить сейчас
              </button>
              <button
                onClick={() => void saveAndExit()}
                className="w-full border-2 border-amber-300/70 py-2 font-bold uppercase hover:bg-amber-500/20"
              >
                Сохранить и выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* death */}
      {state?.dead && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/80 p-4">
          <div className="w-full max-w-md border-4 border-red-500/60 bg-black/70 p-6 text-center">
            <h2 className="text-3xl font-black uppercase tracking-wide text-red-300">Вы погибли</h2>
            <p className="mt-2 text-sm text-white/70">Инвентарь сохранён, но придётся начать с точки появления.</p>
            <div className="mt-5 space-y-2">
              <button
                onClick={() => game?.respawn()}
                className="w-full border-2 border-lime-300 bg-lime-500/20 py-2 font-bold uppercase hover:bg-lime-500/40"
              >
                Возродиться
              </button>
              <button onClick={() => void saveAndExit()} className="w-full border-2 border-white/30 py-2 font-bold uppercase hover:bg-white/10">
                В главное меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
