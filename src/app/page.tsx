"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorldSummary } from "@/lib/game/save";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} ч ${m % 60} мин`;
  if (m > 0) return `${m} мин`;
  return `${seconds} с`;
}

export default function MainMenu() {
  const router = useRouter();
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [mode, setMode] = useState<"survival" | "creative">("survival");
  const [tab, setTab] = useState<"play" | "create" | "help">("play");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/worlds", { cache: "no-store" });
    const data = (await res.json()) as { worlds: WorldSummary[] };
    setWorlds(data.worlds ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createWorld() {
    setCreating(true);
    const res = await fetch("/api/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "Новый мир", seed, gameMode: mode }),
    });
    const data = (await res.json()) as { world: { id: number } };
    setCreating(false);
    if (data.world?.id) router.push(`/world/${data.world.id}`);
  }

  async function removeWorld(id: number) {
    await fetch(`/api/worlds/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-white">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center blur-[2px]"
        style={{ backgroundImage: "url(/images/menu-bg.jpg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/50 to-slate-950/90" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center px-4 py-10">
        <h1
          className="text-center text-5xl font-black tracking-[0.2em] text-lime-300 sm:text-7xl"
          style={{ textShadow: "4px 4px 0 #1b3a13, 8px 8px 14px rgba(0,0,0,.6)" }}
        >
          КУБОКРАФТ
        </h1>
        <p className="mt-2 text-center text-sm text-lime-100/80 sm:text-base">
          3D песочница: бесконечные миры, деревни с жителями, сундуки, мобы, выживание и творчество
        </p>
        <div className="mt-4 w-full max-w-3xl rounded-lg border-2 border-amber-300/60 bg-gradient-to-r from-amber-900/40 via-orange-900/40 to-amber-900/40 p-4 shadow-xl backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="rounded bg-amber-400 px-2 py-1 text-xs font-black uppercase text-black">NEW</span>
            <span className="text-sm font-black uppercase tracking-wide text-amber-200">Обновление 2.0 — Новые горизонты уже здесь!</span>
            <span className="ml-auto hidden text-xs text-white/50 sm:block">14.10.2026</span>
          </div>
          <ul className="mt-2 grid gap-1 text-xs text-white/80 sm:grid-cols-2">
            <li>🔥 Печь и переплавка руд</li>
            <li>🟠 Медная руда и блоки</li>
            <li>💜 Аметистовые жеоды</li>
            <li>🏮 Фонари и костры</li>
            <li>🌧 Динамическая погода (дождь)</li>
            <li>☁️ Объёмные облака</li>
            <li>🏃 Спринт + голод</li>
            <li>🏆 12 достижений</li>
            <li>🗺 Мини-карта + компас</li>
            <li>📱 Управление для телефонов</li>
            <li>🌻 Ягодные кусты и подсолнухи</li>
            <li>⚡️ Оптимизация чанков</li>
          </ul>
          <button onClick={()=>setTab("help")} className="mt-3 w-full border-2 border-amber-300 bg-amber-500/20 py-1.5 text-xs font-black uppercase tracking-wide hover:bg-amber-500/30">Подробнее — вкладка Управление</button>
        </div>

        <div className="mt-8 flex gap-2">
          {(
            [
              ["play", "Миры"],
              ["create", "Создать мир"],
              ["help", "Управление"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-2 px-5 py-2 text-sm font-bold uppercase tracking-wide transition ${
                tab === key
                  ? "border-lime-300 bg-lime-500/30 text-lime-100"
                  : "border-white/20 bg-black/40 text-white/70 hover:border-lime-300/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "play" && (
          <div className="mt-6 w-full max-w-3xl">
            {loading ? (
              <p className="py-10 text-center text-white/70">Загрузка миров…</p>
            ) : worlds.length === 0 ? (
              <div className="border-2 border-white/20 bg-black/50 p-8 text-center">
                <p className="text-lg font-bold">Миров пока нет</p>
                <p className="mt-1 text-sm text-white/60">Создай первый мир — он сохранится в базе данных.</p>
                <button
                  onClick={() => setTab("create")}
                  className="mt-4 border-2 border-lime-300 bg-lime-500/30 px-6 py-2 font-bold uppercase hover:bg-lime-500/50"
                >
                  Создать мир
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {worlds.map((w) => (
                  <li key={w.id} className="border-2 border-white/20 bg-black/55 p-4 transition hover:border-lime-300/70">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">{w.name}</span>
                          <span
                            className={`border px-2 py-0.5 text-[11px] font-bold uppercase ${
                              w.gameMode === "creative"
                                ? "border-sky-300 text-sky-200"
                                : "border-amber-300 text-amber-200"
                            }`}
                          >
                            {w.gameMode === "creative" ? "творческий" : "выживание"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/60">
                          Сид: <span className="font-mono text-lime-200">{w.seed}</span> · В игре:{" "}
                          {formatTime(w.playSeconds)} · Изменений блоков: {w.blockCount ?? 0}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/world/${w.id}`)}
                          className="border-2 border-lime-300 bg-lime-500/30 px-5 py-2 font-bold uppercase text-lime-100 hover:bg-lime-500/50"
                        >
                          Играть
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Удалить мир «${w.name}»?`)) void removeWorld(w.id);
                          }}
                          className="border-2 border-red-400/70 px-3 py-2 font-bold uppercase text-red-200 hover:bg-red-500/30"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "create" && (
          <div className="mt-6 w-full max-w-3xl border-2 border-white/20 bg-black/55 p-6">
            <h2 className="text-lg font-bold uppercase tracking-wide text-lime-200">Новый мир</h2>
            <label className="mt-4 block text-xs font-bold uppercase text-white/60">Название мира</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мой мир"
              className="mt-1 w-full border-2 border-white/25 bg-black/60 px-3 py-2 font-mono outline-none focus:border-lime-300"
            />
            <label className="mt-4 block text-xs font-bold uppercase text-white/60">Сид генератора (необязательно)</label>
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="например: 12345 или forest-2026"
              className="mt-1 w-full border-2 border-white/25 bg-black/60 px-3 py-2 font-mono outline-none focus:border-lime-300"
            />
            <p className="mt-4 text-xs font-bold uppercase text-white/60">Игровой режим</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["survival", "Выживание", "Здоровье, голод, мобы атакуют, добыча ресурсов, крафт"],
                  ["creative", "Творческий", "Полёт, мгновенная добыча, все блоки, бессмертие"],
                ] as const
              ).map(([key, title, desc]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`border-2 p-3 text-left transition ${
                    mode === key ? "border-lime-300 bg-lime-500/20" : "border-white/20 bg-black/40 hover:border-lime-300/60"
                  }`}
                >
                  <p className="font-bold uppercase">{title}</p>
                  <p className="mt-1 text-xs text-white/60">{desc}</p>
                </button>
              ))}
            </div>
            <button
              disabled={creating}
              onClick={() => void createWorld()}
              className="mt-6 w-full border-2 border-lime-300 bg-lime-500/30 px-6 py-3 text-lg font-black uppercase tracking-wide hover:bg-lime-500/50 disabled:opacity-50"
            >
              {creating ? "Генерация…" : "Создать и играть"}
            </button>
          </div>
        )}

        {tab === "help" && (
          <div className="mt-6 w-full max-w-3xl space-y-4">
            <div className="border-2 border-lime-300/40 bg-black/60 p-4">
              <h3 className="text-sm font-black uppercase text-lime-200">Что нового в 2.0</h3>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <div className="border border-white/10 bg-black/40 p-2"><b className="text-amber-200">Печь:</b> ПКМ по печи → плавка руд (медь, железо, золото), стекла, еды. Топливо — уголь, палки, доски.</div>
                <div className="border border-white/10 bg-black/40 p-2"><b className="text-sky-200">Погода:</b> дождь с каплями, переключается в паузе или автоматически. Облака движутся.</div>
                <div className="border border-white/10 bg-black/40 p-2"><b className="text-lime-200">Спринт:</b> Shift+W — бег (тратит голод), индикатор «БЕГ», прыжок с разбега выше.</div>
                <div className="border border-white/10 bg-black/40 p-2"><b className="text-purple-200">Аметист:</b> редкие жеоды глубоко под землёй дают аметист для светящихся блоков.</div>
                <div className="border border-white/10 bg-black/40 p-2"><b className="text-orange-200">Медь:</b> новая руда на высоте 20-48, блоки с патиной, переплавка из сырой меди.</div>
                <div className="border border-white/10 bg-black/40 p-2"><b className="text-emerald-200">Растения:</b> ягодные кусты (ПКМ — собрать ягоды), подсолнухи на равнинах.</div>
              </div>
            </div>
            <div className="grid gap-3 border-2 border-white/20 bg-black/55 p-6 text-sm sm:grid-cols-2">
              {[
                ["W A S D", "движение"],
                ["Пробел", "прыжок / вверх в полёте"],
                ["Shift + W", "бег (тратит голод)"],
                ["Ctrl", "красться медленно"],
                ["F", "полёт (творческий) / двойной Пробел"],
                ["ЛКМ", "копать / атаковать (зажми)"],
                ["ПКМ", "ставить блок / открыть сундук·печь·жителя"],
                ["Колесо / 1-9", "выбор предмета"],
                ["E", "инвентарь и крафт"],
                ["Esc", "пауза, погода, достижения"],
                ["СКМ", "копировать блок (пипетка)"],
                ["F3", "дебаг / координаты"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3 border border-white/10 bg-black/40 px-3 py-2">
                  <span className="min-w-24 border border-lime-300/60 bg-lime-500/10 px-2 py-1 text-center font-mono text-xs text-lime-200">
                    {key}
                  </span>
                  <span className="text-white/75">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col items-center gap-2 pt-8 text-center text-xs text-white/40">
          <span className="rounded border border-lime-300/20 bg-lime-500/10 px-2 py-1 font-mono text-lime-200">v2.0.0 Новые горизонты · 14.10.2026</span>
          <span>
            Миры, постройки, печи и сундуки сохраняются в PostgreSQL · генерация: поля, леса, пустыни, тайга, реки, озёра,
            пещеры, аметистовые жеоды, деревни с кузницами и кострами
          </span>
          <span className="text-white/20">Облака · дождь · спринт · достижения · мини-карта · мобайл</span>
        </div>
      </div>
    </div>
  );
}
