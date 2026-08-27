export function HomePage() {
  return (
    <main className="min-h-dvh bg-[#080b10] text-white">
      <section className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-[0.18em] text-cyan-200 uppercase">
            ClassGame
          </span>
          <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs text-cyan-100">
            Home
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-5 py-12">
          <p className="text-sm font-medium text-cyan-200">
            Mobile-first learning lab
          </p>
          <h1 className="max-w-3xl text-4xl leading-tight font-semibold text-balance sm:text-6xl">
            A 3D math game guided by an adaptive tutor agent.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            This route is ready for the first playable ClassGame experience:
            mock agent responses, simulated SSE events, and the Algebra Basics
            mission.
          </p>
        </div>
      </section>
    </main>
  );
}
