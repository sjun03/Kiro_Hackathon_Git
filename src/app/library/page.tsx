"use client";

// 내 게임 라이브러리 화면.
// 게임 추가/수정/삭제, localStorage 저장. 처음이면 예시 데이터를 불러올 수 있음.

import { useEffect, useState } from "react";
import {
  loadGames,
  saveGames,
  newId,
  sampleGames,
} from "@/lib/storage";
import { formatPlaytime } from "@/lib/steam";
import { loadSettings, saveSettings } from "@/lib/settings";
import {
  type Game,
  type GameStatus,
  type SessionLength,
  type SaveFlexibility,
  type Preference,
  STATUS_LABELS,
  SESSION_LABELS,
  SAVE_LABELS,
  PREFERENCE_LABELS,
} from "@/lib/types";

function emptyGame(): Game {
  return {
    id: newId(),
    title: "",
    status: "playing",
    progress: 0,
    genre: "",
    sessionLength: "medium",
    saveFlexibility: "anytime",
    preference: "neutral",
  };
}

export default function LibraryPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [draft, setDraft] = useState<Game>(emptyGame());
  const [loaded, setLoaded] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);
  const [steamId, setSteamId] = useState("");

  // 최초 로드
  useEffect(() => {
    setGames(loadGames());
    setSteamId(loadSettings().steamId);
    setLoaded(true);
  }, []);

  // 변경 시 저장
  useEffect(() => {
    if (loaded) saveGames(games);
  }, [games, loaded]);

  function addGame() {
    if (!draft.title.trim()) {
      alert("게임 제목을 입력해주세요.");
      return;
    }
    setGames((prev) => [...prev, { ...draft, id: newId() }]);
    setDraft(emptyGame());
  }

  function removeGame(id: string) {
    setGames((prev) => prev.filter((g) => g.id !== id));
  }

  function updateGame(id: string, patch: Partial<Game>) {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  // SteamID만으로 /api/steam 을 호출해 바로 가져오기 (API 키는 서버 .env)
  async function fetchFromSteamAccount() {
    setFetchMsg(null);
    const id = steamId.trim();
    if (!id) {
      setFetchMsg("SteamID(17자리 숫자)를 입력해주세요.");
      return;
    }
    if (!/^\d{17}$/.test(id)) {
      setFetchMsg("SteamID는 17자리 숫자여야 해요.");
      return;
    }
    // 기존 라이브러리가 있으면 교체 여부를 확인한다.
    // (다른 SteamID로 가져올 때 기존 목록에 쌓이지 않고 새 계정 목록으로 교체)
    if (games.length > 0) {
      const ok = confirm(
        "가져오면 현재 라이브러리를 이 계정의 게임 목록으로 교체합니다. 계속할까요?"
      );
      if (!ok) return;
    }
    // 다음 방문을 위해 저장
    saveSettings({ steamId: id });
    setFetching(true);
    try {
      const res = await fetch("/api/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchMsg(data?.error || "가져오기에 실패했어요.");
        return;
      }
      // 기존 목록에 쌓지 않고 새 계정 목록으로 교체
      setGames(data.games as Game[]);
      setFetchMsg(
        `${data.count}개 게임을 가져왔어요. 세션 길이/장르는 아래에서 다듬어 주세요.`
      );
    } catch {
      setFetchMsg("네트워크 오류로 가져오지 못했어요.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 게임 라이브러리</h1>
        {games.length === 0 && (
          <button
            onClick={() => setGames(sampleGames())}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-brand"
          >
            예시 데이터 불러오기
          </button>
        )}
      </header>

      {/* Steam 계정에서 바로 가져오기 */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="font-semibold">내 Steam 계정에서 가져오기</h2>
        <p className="mt-1 text-sm text-slate-400">
          Steam 고유 번호(SteamID 17자리)만 입력하면 보유 게임과 플레이타임을 바로
          불러옵니다. 프로필의 “게임 상세정보”가 공개여야 해요.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            placeholder="예)12345678901234567"
            inputMode="numeric"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-brand focus:outline-none sm:max-w-xs"
          />
          <button
            onClick={fetchFromSteamAccount}
            disabled={fetching}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
          >
            {fetching ? "가져오는 중..." : "가져오기"}
          </button>
        </div>
        {fetchMsg && (
          <p className="mt-2 text-sm text-slate-400">{fetchMsg}</p>
        )}
      </section>

      {/* 추가 폼 */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-4 font-semibold">게임 추가</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="제목">
            <input
              className="input"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="예: 하데스"
            />
          </Field>
          <Field label="장르">
            <input
              className="input"
              value={draft.genre}
              onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
              placeholder="예: 로그라이크"
            />
          </Field>
          <Field label="상태">
            <select
              className="input"
              value={draft.status}
              onChange={(e) =>
                setDraft({ ...draft, status: e.target.value as GameStatus })
              }
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`진행도 (${draft.progress}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={draft.progress}
              onChange={(e) =>
                setDraft({ ...draft, progress: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="세션 길이">
            <select
              className="input"
              value={draft.sessionLength}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sessionLength: e.target.value as SessionLength,
                })
              }
            >
              {Object.entries(SESSION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="저장 편의성">
            <select
              className="input"
              value={draft.saveFlexibility}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  saveFlexibility: e.target.value as SaveFlexibility,
                })
              }
            >
              {Object.entries(SAVE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="선호도">
            <select
              className="input"
              value={draft.preference}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  preference: e.target.value as Preference,
                })
              }
            >
              {Object.entries(PREFERENCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button
          onClick={addGame}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium hover:bg-brand-dark"
        >
          + 추가
        </button>
      </section>

      {/* 목록 */}
      <section className="space-y-3">
        <h2 className="font-semibold">
          등록된 게임 <span className="text-slate-500">({games.length})</span>
        </h2>
        {games.length === 0 && (
          <p className="text-sm text-slate-500">
            아직 등록된 게임이 없어요. 위에서 추가하거나 예시 데이터를
            불러오세요.
          </p>
        )}
        {games.map((g) => (
          <div
            key={g.id}
            className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{g.title}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded bg-slate-800 px-2 py-0.5">
                    {STATUS_LABELS[g.status]}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5">
                    {g.genre || "장르 미정"}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5">
                    세션 {SESSION_LABELS[g.sessionLength]}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5">
                    {SAVE_LABELS[g.saveFlexibility]}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5">
                    {PREFERENCE_LABELS[g.preference]}
                  </span>
                  {typeof g.playtimeMinutes === "number" && (
                    <span className="rounded bg-brand/20 px-2 py-0.5 text-brand">
                      플레이 {g.playtimeMinutes > 0
                        ? formatPlaytime(g.playtimeMinutes)
                        : "기록 없음"}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeGame(g.id)}
                className="text-xs text-slate-500 hover:text-red-400"
              >
                삭제
              </button>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>진행도</span>
                <span>{g.progress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={g.progress}
                onChange={(e) =>
                  updateGame(g.id, { progress: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>
        ))}
      </section>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(51 65 85);
          background: rgb(2 6 23);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: inherit;
        }
        .input:focus {
          outline: none;
          border-color: #6d5efc;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-400">{label}</span>
      {children}
    </label>
  );
}
