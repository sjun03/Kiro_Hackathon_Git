// Steam 보유 게임 가져오기 API 라우트.
//
// 사용자는 SteamID(17자리)만 보낸다. Steam API 키는 서버 .env(STEAM_API_KEY)에서
// 읽어 사용한다. 브라우저는 CORS로 Steam을 직접 못 부르므로 이 라우트가 중계한다.

import { NextRequest, NextResponse } from "next/server";
import {
  fromSteamOwnedGames,
  enrichGenres,
  type SteamOwnedGamesResponse,
} from "@/lib/steam";

export async function POST(req: NextRequest) {
  try {
    const steamApiKey = (process.env.STEAM_API_KEY ?? "").trim();
    if (!steamApiKey) {
      return NextResponse.json(
        {
          error:
            "서버에 Steam API 키가 설정되어 있지 않아요. 관리자가 .env의 STEAM_API_KEY를 설정해야 합니다.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const steamId = String(body?.steamId ?? "").trim();

    if (!steamId) {
      return NextResponse.json(
        { error: "SteamID(17자리 숫자)를 입력해주세요." },
        { status: 400 }
      );
    }
    if (!/^\d{17}$/.test(steamId)) {
      return NextResponse.json(
        { error: "SteamID는 17자리 숫자여야 해요." },
        { status: 400 }
      );
    }

    const url =
      "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/" +
      `?key=${encodeURIComponent(steamApiKey)}` +
      `&steamid=${encodeURIComponent(steamId)}` +
      "&include_appinfo=1&include_played_free_games=1&format=json";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            "Steam API 호출에 실패했어요. SteamID가 올바른지, 프로필의 게임 상세정보가 공개인지 확인해주세요.",
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as SteamOwnedGamesResponse;
    const base = fromSteamOwnedGames(data);

    if (base.length === 0) {
      return NextResponse.json(
        {
          error:
            "가져온 게임이 없어요. SteamID가 맞는지, 프로필 공개 설정(게임 상세정보 공개)을 확인해주세요.",
        },
        { status: 404 }
      );
    }

    // Store API로 장르 보강 (플레이타임 상위 일부). 실패해도 게임 목록은 그대로 반환.
    const games = await enrichGenres(base, { maxGames: 25 });

    return NextResponse.json({ games, count: games.length });
  } catch {
    return NextResponse.json(
      { error: "Steam 데이터 처리 중 오류가 발생했어요." },
      { status: 400 }
    );
  }
}
