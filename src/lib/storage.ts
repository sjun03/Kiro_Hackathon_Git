// 브라우저 localStorage에 게임 라이브러리를 저장/로드하는 유틸.
// (DB 없이 MVP를 돌리기 위한 임시 저장소. 추후 DB로 교체 가능)

import type { Game } from "./types";

const KEY = "playpick.games.v1";

export function loadGames(): Game[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Game[]) : [];
  } catch {
    return [];
  }
}

export function saveGames(games: Game[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(games));
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** 처음 방문자를 위한 예시 데이터 */
export function sampleGames(): Game[] {
  return [
    {
      id: newId(),
      title: "하데스",
      status: "playing",
      progress: 45,
      genre: "로그라이크",
      sessionLength: "short",
      saveFlexibility: "anytime",
      preference: "love",
    },
    {
      id: newId(),
      title: "엘든링",
      status: "playing",
      progress: 60,
      genre: "액션RPG",
      sessionLength: "long",
      saveFlexibility: "checkpoint",
      preference: "love",
    },
    {
      id: newId(),
      title: "발라트로",
      status: "owned_unplayed",
      progress: 0,
      genre: "덱빌딩",
      sessionLength: "medium",
      saveFlexibility: "anytime",
      preference: "neutral",
    },
  ];
}
