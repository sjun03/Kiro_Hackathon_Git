// 사용자 설정(SteamID)을 브라우저 localStorage에 보관하는 유틸.
//
// API 키(Gemini, Steam)는 서버 .env에서 관리한다. 사용자는 SteamID만 입력한다.

export interface UserSettings {
  steamId: string;
}

const KEY = "playpick.settings.v2";

export function emptySettings(): UserSettings {
  return { steamId: "" };
}

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return emptySettings();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptySettings();
    const parsed = JSON.parse(raw);
    return { steamId: String(parsed?.steamId ?? "") };
  } catch {
    return emptySettings();
  }
}

export function saveSettings(s: UserSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
