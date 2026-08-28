import { Suspense } from "react";

import { DashboardPage } from "@/modules/dashboard/pages/dashboard-page";

type DashboardClassRouteProps = {
  readonly params: Promise<{ classId: string }>;
};

export default function DashboardClassRoute({ params }: DashboardClassRouteProps) {
  return (
    <Suspense fallback={<ClassDashboardFallback />}>
      {params.then(({ classId }) => (
        <DashboardPage initialClassId={classId} />
      ))}
    </Suspense>
  );
}

function ClassDashboardFallback() {
  return (
    <main className="grid min-h-svh place-items-center bg-slate-950 px-4 text-white">
      <div className="text-center">
        <p className="text-xs font-bold uppercase text-cyan-300">ClassGame</p>
        <p className="mt-3 text-lg font-semibold">Loading class...</p>
      </div>
    </main>
  );
}
