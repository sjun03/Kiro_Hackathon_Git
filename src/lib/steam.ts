// Steam 라이브러리 데이터를 PlayPick의 Game 모델로 변환하는 유틸.
//
// 사용 흐름(개발/데모 시드용):
//   1) Kiro에 steam-mcp 서버를 연결하고 "내 보유 게임 목록 가져와줘" 요청
//   2) 받은 원본 JSON을 fromSteamOwnedGames()에 넣어 Game[] 로 변환
//   3) 변환 결과를 라이브러리(localStorage) 로 가져와 추천에 사용
//
// 주의: 이 변환기는 Steam Web API의 GetOwnedGames 응답 형태를 기준으로 한다.
// playtime 값은 "분" 단위다.

import type {
  Game,
  GameStatus,
  Preference,
  SaveFlexibility,
  SessionLength,
} from "./types";
import { newId } from "./storage";

/** Steam GetOwnedGames 가 돌려주는 게임 1건 (필요한 필드만) */
export interface SteamOwnedGame {
  appid: number;
  name: string;
  /** 총 플레이타임(분) */
  playtime_forever?: number;
  /** 최근 2주 플레이타임(분) */
  playtime_2weeks?: number;
  img_icon_url?: string;
}

/** GetOwnedGames 전체 응답(래핑 형태 다양성 대응) */
export interface SteamOwnedGamesResponse {
  response?: {
    game_count?: number;
    games?: SteamOwnedGame[];
  };
  // 일부 MCP 도구는 games 배열을 바로 주기도 하므로 느슨하게 받는다.
  games?: SteamOwnedGame[];
}

/** 변환 시 세부 동작을 조정하는 옵션 */
export interface FromSteamOptions {
  /**
   * "하는 중"으로 볼 최소 총 플레이타임(분). 기본 30분.
   * 이보다 적게 플레이했으면 "샀는데 안 함"으로 본다.
   */
  playingThresholdMinutes?: number;
  /**
   * "깸"으로 추정할 플레이타임(분). 기본 2400분(40시간).
   * 최근 2주 플레이가 없고 누적이 많으면 '깸'으로 추정한다. (어디까지나 추정)
   */
  finishedThresholdMinutes?: number;
  /** 변환할 최대 개수 (라이브러리가 너무 크면 상위 N개만). 기본 제한 없음 */
  limit?: number;
}

/**
 * 총/최근 플레이타임으로 보유 상태를 추정한다.
 * Steam은 "깸" 여부를 직접 알려주지 않으므로 휴리스틱이다.
 */
function inferStatus(
  playtimeForever: number,
  playtime2weeks: number,
  opts: Required<Pick<FromSteamOptions, "playingThresholdMinutes" | "finishedThresholdMinutes">>
): GameStatus {
  if (playtimeForever < opts.playingThresholdMinutes) {
    return "owned_unplayed"; // 거의 안 함
  }
  // 최근에 안 하고 누적이 아주 많으면 '깸'으로 추정
  if (playtime2weeks === 0 && playtimeForever >= opts.finishedThresholdMinutes) {
    return "finished";
  }
  return "playing";
}

/**
 * 세션 길이 추정.
 * 데이터만으로는 알 수 없으므로 "보통"을 기본값으로 둔다.
 * (사용자가 라이브러리 화면에서 손쉽게 수정 가능)
 */
function inferSessionLength(): SessionLength {
  return "medium";
}

/** 저장 편의성도 데이터로 알 수 없어 기본값 */
function inferSaveFlexibility(): SaveFlexibility {
  return "anytime";
}

/** 최근 2주 플레이가 있으면 선호도를 'love'로 추정 */
function inferPreference(playtime2weeks: number): Preference {
  return playtime2weeks > 0 ? "love" : "neutral";
}

/**
 * 진행도 추정.
 * 깸=100, 안 함=0, 하는 중은 플레이타임 기반 러프 추정(최대 90%로 캡).
 */
function inferProgress(status: GameStatus, playtimeForever: number): number {
  if (status === "finished") return 100;
  if (status === "owned_unplayed") return 0;
  // 하는 중: 20시간(1200분)을 대략 80%로 보는 느슨한 스케일, 90% 상한
  const pct = Math.round((playtimeForever / 1200) * 80);
  return Math.max(5, Math.min(90, pct));
}

/**
 * Steam GetOwnedGames 응답(또는 games 배열)을 Game[] 로 변환한다.
 * 응답 래핑 형태가 달라도(response.games / 최상위 games / 배열) 모두 처리한다.
 */
export function fromSteamOwnedGames(
  raw: SteamOwnedGamesResponse | SteamOwnedGame[],
  options: FromSteamOptions = {}
): Game[] {
  const opts = {
    playingThresholdMinutes: options.playingThresholdMinutes ?? 30,
    finishedThresholdMinutes: options.finishedThresholdMinutes ?? 2400,
  };

  // 다양한 래핑에서 games 배열을 추출
  let games: SteamOwnedGame[] = [];
  if (Array.isArray(raw)) {
    games = raw;
  } else if (raw?.response?.games) {
    games = raw.response.games;
  } else if (raw?.games) {
    games = raw.games;
  }

  if (options.limit && options.limit > 0) {
    // 플레이타임 많은 순으로 상위 N개
    games = [...games]
      .sort((a, b) => (b.playtime_forever ?? 0) - (a.playtime_forever ?? 0))
      .slice(0, options.limit);
  }

  return games
    .filter((g) => g && typeof g.name === "string" && g.name.length > 0)
    .map((g) => {
      const forever = g.playtime_forever ?? 0;
      const recent = g.playtime_2weeks ?? 0;
      const status = inferStatus(forever, recent, opts);
      return {
        id: newId(),
        title: g.name,
        status,
        progress: inferProgress(status, forever),
        genre: "", // Steam GetOwnedGames엔 장르가 없음 → 사용자가 채우거나 추후 store API로 보강
        sessionLength: inferSessionLength(),
        saveFlexibility: inferSaveFlexibility(),
        preference: inferPreference(recent),
      } satisfies Game;
    });
}

/** 분을 "n시간 m분" 사람 친화 문자열로 (디버깅/표시용) */
export function formatPlaytime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
