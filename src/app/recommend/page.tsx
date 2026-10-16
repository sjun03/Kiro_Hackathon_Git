"use client";

// "지금 쉴래" 입력 + 추천 결과 화면.
// 라이브러리(localStorage)와 입력 상황을 /api/recommend 로 보내 결과를 받아 표시.

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadGames } from "@/lib/storage";
import type { Game, RecommendResponse } from "@/lib/types";

export default function RecommendPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [hours, setHours] = useState(2);
  const [situation, setSituation] = useState("");
  const [mood, setMood] = useState<"casual" | "immersive">("casual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGames(loadGames());
  }, []);

  async function getRecommendation() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          games,
          context: {
            availableMinutes: Math.round(hours * 60),
            situation,
            mood,
          },
        }),
      });
      if (!res.ok) throw new Error("추천 요청 실패");
      const data: RecommendResponse = await res.json();
      setResult(data);
    } catch {
      setError("추천을 받아오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">지금 쉴래 🎮</h1>

      {games.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
          먼저 게임을 등록해주세요.{" "}
          <Link href="/library" className="text-brand underline">
            내 라이브러리로 가기
          </Link>
        </div>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-5">
          <div>
            <label className="mb-1 block text-sm text-slate-400">
              가용 시간: <span className="text-slate-100">{hours}시간</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">
              지금 상황 (선택)
            </label>
            <input
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="예: 늦은 밤, 조금 피곤함"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">기분</label>
            <div className="flex gap-2">
              {([
                ["casual", "가볍게"],
                ["immersive", "몰입하고 싶음"],
              ] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setMood(v)}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    mood === v
                      ? "border-brand bg-brand/20 text-brand"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={getRecommendation}
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-3 font-medium hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? "추천 중..." : "추천 받기"}
          </button>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">추천 결과</h2>
            {result.mock && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                mock 모드 (API 키 없이 동작 중)
              </span>
            )}
          </div>
          <div className="grid gap-4">
            {result.recommendations.map((r, i) => (
              <div
                key={i}
                className={`rounded-xl border p-5 ${
                  r.notRecommended
                    ? "border-slate-800 bg-slate-900/20 opacity-80"
                    : "border-brand/40 bg-brand/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{r.game}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      r.notRecommended
                        ? "bg-slate-800 text-slate-400"
                        : "bg-brand text-white"
                    }`}
                  >
                    {r.playTime}
                  </span>
                </div>
                {r.action && (
                  <p className="mt-2 text-sm text-brand">▶ {r.action}</p>
                )}
                <p className="mt-2 text-sm text-slate-300">{r.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
