// 게임 라이브러리 및 추천 요청/응답에 쓰이는 공통 타입

/** 게임 보유/진행 상태 */
export type GameStatus =
  | "not_owned" // 안 삼
  | "owned_unplayed" // 샀는데 안 함
  | "playing" // 하는 중
  | "finished"; // 깸

/** 한 번 켰을 때 적정 플레이 길이 */
export type SessionLength = "short" | "medium" | "long";

/** 저장(종료) 편의성 */
export type SaveFlexibility = "anytime" | "checkpoint";

/** 선호도 */
export type Preference = "love" | "neutral";

/** 라이브러리에 등록된 게임 하나 */
export interface Game {
  id: string;
  title: string;
  status: GameStatus;
  /** 진행도 0~100 */
  progress: number;
  genre: string;
  sessionLength: SessionLength;
  saveFlexibility: SaveFlexibility;
  preference: Preference;
  /** 총 플레이타임(분). Steam에서 가져온 경우 playtime_forever. */
  playtimeMinutes?: number;
  /** Steam appid (장르 보강/식별용). */
  appid?: number;
}

/** 사용자가 추천을 요청할 때 보내는 상황 정보 */
export interface RecommendRequestContext {
  /** 가용 시간(분) */
  availableMinutes: number;
  /** 시간대/상황 메모 (예: 늦은 밤, 피곤함) */
  situation: string;
  /** 기분: 가볍게 vs 몰입 */
  mood: "casual" | "immersive";
}

/** 추천 결과 카드 하나 */
export interface Recommendation {
  game: string;
  /** 추천 플레이 시간. 비추천이면 "비추천" */
  playTime: string;
  reason: string;
  /** 이어서 하기 등 행동 제안 (선택) */
  action?: string;
  /** 비추천 여부 */
  notRecommended?: boolean;
}

/** API 응답 */
export interface RecommendResponse {
  recommendations: Recommendation[];
  /** mock 모드로 생성됐는지 여부 (UI에 배지 표시용) */
  mock: boolean;
}

export const STATUS_LABELS: Record<GameStatus, string> = {
  not_owned: "안 삼",
  owned_unplayed: "샀는데 안 함",
  playing: "하는 중",
  finished: "깸",
};

export const SESSION_LABELS: Record<SessionLength, string> = {
  short: "짧음",
  medium: "보통",
  long: "긴 편",
};

export const SAVE_LABELS: Record<SaveFlexibility, string> = {
  anytime: "아무때나 종료",
  checkpoint: "체크포인트만",
};

export const PREFERENCE_LABELS: Record<Preference, string> = {
  love: "좋아함",
  neutral: "보통",
};
