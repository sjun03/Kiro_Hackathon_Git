// 추천 엔진.
// GEMINI_API_KEY가 있으면 Gemini를 호출하고, 없으면 규칙 기반 mock으로 응답한다.
// 둘 다 동일한 RecommendResponse 형태를 반환하므로 프론트는 전환을 신경 쓸 필요가 없다.

import type {
  Game,
  Recommendation,
  RecommendRequestContext,
  RecommendResponse,
  SessionLength,
} from "./types";

/** 가용 시간(분)에 비추어 세션 길이가 적합한지 점수화 */
function sessionFitScore(
  sessionLength: SessionLength,
  availableMinutes: number
): number {
  // 각 세션 길이의 "최소 권장 시간"
  const minNeeded: Record<SessionLength, number> = {
    short: 20,
    medium: 60,
    long: 120,
  };
  const need = minNeeded[sessionLength];
  if (availableMinutes >= need) {
    // 시간이 충분할수록 높은 점수, 너무 남으면 약간 감점(짧은 게임이 애매)
    const slack = availableMinutes - need;
    return 10 - Math.min(slack / 60, 3);
  }
  // 시간이 부족하면 큰 감점
  return -5 - (need - availableMinutes) / 30;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/**
 * 규칙 기반 mock 추천.
 * - 안 산 게임은 "구매 추천" 형태로만 가볍게 다룸
 * - 세션 길이 적합도 + 기분 + 선호도 + 진행중 보너스로 점수화
 */
function mockRecommend(
  games: Game[],
  ctx: RecommendRequestContext
): Recommendation[] {
  const playable = games.filter((g) => g.status !== "not_owned");

  const scored = playable.map((g) => {
    let score = sessionFitScore(g.sessionLength, ctx.availableMinutes);

    // 기분 반영: 가볍게 원하면 아무때나 종료 가능한 게임 가점
    if (ctx.mood === "casual" && g.saveFlexibility === "anytime") score += 2;
    if (ctx.mood === "immersive" && g.sessionLength === "long") score += 2;

    // 선호도
    if (g.preference === "love") score += 2;

    // 플레이타임 가중치: 많이 한 게임일수록 선호 장르일 가능성 높음.
    // 10시간(600분)마다 +0.5, 최대 +3.
    const pt = g.playtimeMinutes ?? 0;
    score += Math.min(3, (pt / 600) * 0.5);

    // 장르가 채워져 있으면 약간 가점 (추천 근거를 댈 수 있으므로)
    if (g.genre) score += 0.3;

    // 하는 중 + 아직 안 깬 게임은 "이어서 하기" 보너스
    if (g.status === "playing" && g.progress < 100) score += 1.5;

    // 샀는데 안 한 게임도 약간 밀어줌 (쌓인 게임 소진 유도)
    if (g.status === "owned_unplayed") score += 0.5;

    return { game: g, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const recs: Recommendation[] = [];

  // 상위 2개는 추천
  for (const { game, score } of scored.slice(0, 2)) {
    if (score <= -3) continue; // 심하게 안 맞으면 추천 안 함
    const fits = sessionFitScore(game.sessionLength, ctx.availableMinutes) > 0;
    // 추천 플레이 시간: 가용 시간의 70~90%
    const suggested = Math.max(
      20,
      Math.round((ctx.availableMinutes * (fits ? 0.85 : 0.6)) / 10) * 10
    );
    const reasons: string[] = [];
    if (game.genre) reasons.push(`${game.genre} 장르`);
    const ptMin = game.playtimeMinutes ?? 0;
    if (ptMin >= 600)
      reasons.push(`지금까지 ${Math.round(ptMin / 60)}시간 플레이한 애착 게임`);
    if (fits) reasons.push("가용 시간에 세션 길이가 잘 맞아요");
    if (ctx.mood === "casual" && game.saveFlexibility === "anytime")
      reasons.push("아무때나 종료할 수 있어 가볍게 하기 좋아요");
    if (ctx.mood === "immersive" && game.sessionLength === "long")
      reasons.push("몰입해서 길게 즐기기 좋아요");
    if (game.preference === "love") reasons.push("좋아하는 게임이에요");

    recs.push({
      game: game.title,
      playTime: formatMinutes(suggested),
      reason:
        (reasons.join(", ") || "지금 상황에 무난하게 즐길 수 있어요") + ".",
      action:
        game.status === "playing"
          ? `이어서 하기 (진행도 ${game.progress}%)`
          : game.status === "owned_unplayed"
          ? "드디어 시작해보기"
          : undefined,
    });
  }

  // 시간이 많이 부족한 긴 게임이 있으면 비추천 카드 하나 추가
  const badFit = scored.find(
    (s) =>
      s.game.sessionLength === "long" &&
      sessionFitScore("long", ctx.availableMinutes) < 0 &&
      !recs.some((r) => r.game === s.game.title)
  );
  if (badFit) {
    recs.push({
      game: badFit.game.title,
      playTime: "비추천",
      reason:
        "몰입형이라 지금 시간엔 애매해요. 긴 시간이 날 때 추천해요.",
      notRecommended: true,
    });
  }

  if (recs.length === 0) {
    recs.push({
      game: "추천할 게임이 없어요",
      playTime: "-",
      reason:
        "플레이 가능한 게임이 없거나 지금 시간에 맞는 게임이 없어요. 라이브러리에 게임을 더 추가해보세요.",
      notRecommended: true,
    });
  }

  return recs;
}

/**
 * 시도할 Gemini 모델 목록(앞에서부터 순차 시도).
 * 특정 모델이 차단(404)되거나 과부하(503)여도 다음 모델로 넘어가 견고하다.
 * .env의 GEMINI_MODEL 로 맨 앞에 모델을 지정할 수도 있다.
 */
function geminiModels(): string[] {
  const preferred = (process.env.GEMINI_MODEL ?? "").trim();
  // 빠른 lite 모델을 우선 시도하고, 막히면 일반 flash로 폴백한다.
  const defaults = [
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.8-flash",
  ];
  return preferred ? [preferred, ...defaults] : defaults;
}

/** 모델 1회 호출의 최대 대기 시간(ms). 넘으면 다음 모델로 넘어간다. */
const PER_MODEL_TIMEOUT_MS = 20000;

/** 단일 모델로 Gemini 호출. 성공 시 추천 배열, 실패 시 null */
async function callGeminiModel(
  model: string,
  prompt: string,
  apiKey: string
): Promise<Recommendation[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // 로그를 남겨 어떤 모델이 왜 실패했는지 확인 가능하게 한다.
    const detail = await res.text().catch(() => "");
    console.warn(`[gemini] ${model} 실패: ${res.status} ${detail.slice(0, 200)}`);
    return null;
  }
  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.recommendations)) {
      return parsed.recommendations as Recommendation[];
    }
  } catch {
    // JSON 파싱 실패 → 다음 모델로
  }
  return null;
}

/** Gemini 호출 (키가 있을 때만). 모델을 순차 시도하고, 전부 실패하면 null */
async function geminiRecommend(
  games: Game[],
  ctx: RecommendRequestContext,
  apiKey: string
): Promise<Recommendation[] | null> {
  const prompt = buildPrompt(games, ctx);
  for (const model of geminiModels()) {
    try {
      const result = await callGeminiModel(model, prompt, apiKey);
      if (result) return result;
    } catch (e) {
      console.warn(`[gemini] ${model} 예외:`, e);
    }
  }
  return null;
}

function buildPrompt(games: Game[], ctx: RecommendRequestContext): string {
  // 각 게임을 "장르"와 "플레이타임"이 잘 드러나는 한 줄 요약으로 정리한다.
  const statusKo: Record<string, string> = {
    not_owned: "미보유",
    owned_unplayed: "미플레이",
    playing: "진행중",
    finished: "완료",
  };
  const lines = games.map((g, i) => {
    const pt =
      typeof g.playtimeMinutes === "number" && g.playtimeMinutes > 0
        ? `${(g.playtimeMinutes / 60).toFixed(1)}시간`
        : "플레이 기록 없음";
    const genre = g.genre || "장르 미상";
    return `${i + 1}. ${g.title} | 장르: ${genre} | 총 플레이타임: ${pt} | 상태: ${
      statusKo[g.status] ?? g.status
    } | 진행도: ${g.progress}%`;
  });

  return [
    "너는 게임 여가 추천 전문가야.",
    "아래 사용자의 게임 라이브러리와 지금 상황을 보고,",
    "지금 하기 좋은 게임 2개와, 지금은 하지 말아야 할 게임이 있으면 1개를 골라줘.",
    "",
    "추천 기준(중요):",
    "- 각 게임의 '장르'와 '총 플레이타임'을 핵심 근거로 삼아라.",
    "- 플레이타임이 많은 게임은 사용자가 좋아하는 장르일 가능성이 높다.",
    "- 가용 시간과 게임 장르의 보통 세션 길이를 맞춰라. (예: 짧게 즐기는 로그라이크/캐주얼은 짧은 시간에, 오픈월드/RPG는 긴 시간에)",
    "- reason 에는 반드시 장르와 플레이타임을 언급해 근거를 설명해라.",
    "",
    "형식 규칙:",
    "- 같은 게임을 중복해서 추천하지 마.",
    "- 모든 텍스트(playTime, reason, action)는 한국어로 작성해.",
    '- playTime 은 "지금 이번에 플레이할 추천 시간"이다. 가용 시간을 넘지 않게 "1시간 30분" 처럼 표기. 총 플레이타임이 아니다. 비추천이면 "비추천".',
    '- action 은 "이어서 하기", "새로 시작하기" 처럼 한국어 행동 제안. 없으면 생략.',
    "- notRecommended 는 지금 하지 말아야 할 게임일 때만 true.",
    "반드시 아래 JSON 형식으로만 응답해:",
    '{ "recommendations": [ { "game": string, "playTime": string, "reason": string, "action"?: string, "notRecommended"?: boolean } ] }',
    "",
    "[게임 라이브러리]",
    ...lines,
    "",
    "[지금 상황]",
    `가용 시간: ${ctx.availableMinutes}분`,
    `상황: ${ctx.situation || "(없음)"}`,
    `기분: ${ctx.mood === "casual" ? "가볍게" : "몰입하고 싶음"}`,
  ].join("\n");
}

/**
 * 추천 메인 진입점. 서버 .env의 GEMINI_API_KEY 유무에 따라 자동 분기한다.
 * 키가 없으면 규칙 기반 mock 추천으로 응답한다.
 */
export async function recommend(
  games: Game[],
  ctx: RecommendRequestContext
): Promise<RecommendResponse> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (apiKey.length > 0) {
    const ai = await geminiRecommend(games, ctx, apiKey);
    if (ai) return { recommendations: ai, mock: false };
    // 실패하면 조용히 mock으로 폴백
  }
  return { recommendations: mockRecommend(games, ctx), mock: true };
}
