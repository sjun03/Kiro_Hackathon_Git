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

/** Gemini 호출 (키가 있을 때만). 실패 시 null 반환 → 호출부에서 mock으로 폴백 */
async function geminiRecommend(
  games: Game[],
  ctx: RecommendRequestContext,
  apiKey: string
): Promise<Recommendation[] | null> {
  const prompt = buildPrompt(games, ctx);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.recommendations)) {
      return parsed.recommendations as Recommendation[];
    }
    return null;
  } catch {
    return null;
  }
}

function buildPrompt(games: Game[], ctx: RecommendRequestContext): string {
  return [
    "너는 게임 여가 추천 전문가야.",
    "아래 사용자의 게임 라이브러리와 지금 상황을 보고,",
    "지금 하기 좋은 게임 2개와, 지금은 하지 말아야 할 게임이 있으면 1개를 골라줘.",
    "반드시 아래 JSON 형식으로만 응답해:",
    '{ "recommendations": [ { "game": string, "playTime": string, "reason": string, "action"?: string, "notRecommended"?: boolean } ] }',
    "",
    "[게임 라이브러리]",
    JSON.stringify(games, null, 2),
    "",
    "[지금 상황]",
    `가용 시간: ${ctx.availableMinutes}분`,
    `상황: ${ctx.situation || "(없음)"}`,
    `기분: ${ctx.mood === "casual" ? "가볍게" : "몰입하고 싶음"}`,
  ].join("\n");
}

/** 추천 메인 진입점. 키 유무에 따라 자동 분기한다. */
export async function recommend(
  games: Game[],
  ctx: RecommendRequestContext
): Promise<RecommendResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    const ai = await geminiRecommend(games, ctx, apiKey);
    if (ai) return { recommendations: ai, mock: false };
    // 실패하면 조용히 mock으로 폴백
  }
  return { recommendations: mockRecommend(games, ctx), mock: true };
}
