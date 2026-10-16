import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayPick · 게임 여가 추천기",
  description:
    "지금 비어 있는 시간과 내 게임 라이브러리를 보고, 무슨 게임을 몇 시간 하면 좋은지 추천해줍니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand">
              🎮 PlayPick
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/library" className="hover:text-brand">
                내 라이브러리
              </Link>
              <Link href="/recommend" className="hover:text-brand">
                지금 쉴래
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-4xl px-4 py-8 text-center text-xs text-slate-500">
          Kiro Hackathon · 게임 여가 추천기
        </footer>
      </body>
    </html>
  );
}
