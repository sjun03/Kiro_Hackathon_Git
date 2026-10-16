import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">
          “지금 2시간 비었어” <br className="sm:hidden" />
          <span className="text-brand">뭐 하지?</span>
        </h1>
        <p className="mx-auto max-w-xl text-slate-400">
          내 게임 목록과 지금 비어 있는 시간을 입력하면, 무슨 게임을 몇 시간 하면
          좋은지 이유와 함께 추천해줍니다.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/library"
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium hover:border-brand"
          >
            1. 게임 등록하기
          </Link>
          <Link
            href="/recommend"
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium hover:bg-brand-dark"
          >
            2. 추천 받기
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            step: "①",
            title: "라이브러리 등록",
            desc: "보유/진행 상태, 진행도, 세션 길이를 기록해요.",
          },
          {
            step: "②",
            title: "지금 상황 입력",
            desc: "가용 시간과 기분을 알려주세요.",
          },
          {
            step: "③",
            title: "AI 추천",
            desc: "지금 할 게임과 플레이 분량을 이유와 함께 받아요.",
          },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
          >
            <div className="text-2xl text-brand">{c.step}</div>
            <h3 className="mt-2 font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{c.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
