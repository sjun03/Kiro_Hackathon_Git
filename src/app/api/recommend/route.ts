// 추천 API 라우트.
// 프론트가 게임 목록 + 상황을 POST 하면 추천 결과를 돌려준다.
// Gemini 키는 서버 .env(GEMINI_API_KEY)에서 읽는다. 없으면 자동으로 mock으로 응답한다.

import { NextRequest, NextResponse } from "next/server";
import { recommend } from "@/lib/recommend";
import type { Game, RecommendRequestContext } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const games: Game[] = Array.isArray(body?.games) ? body.games : [];
    const ctx: RecommendRequestContext = {
      availableMinutes: Number(body?.context?.availableMinutes) || 60,
      situation: String(body?.context?.situation || ""),
      mood: body?.context?.mood === "immersive" ? "immersive" : "casual",
    };

    const result = await recommend(games, ctx);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "추천 처리 중 오류가 발생했어요." },
      { status: 400 }
    );
  }
}
