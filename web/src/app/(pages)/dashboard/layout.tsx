import type { ReactNode } from "react";

import { TeacherDashboardGate } from "@/modules/dashboard/auth/teacher-dashboard-gate";

export default function DashboardLayout({ children }: { readonly children: ReactNode }) {
  return <TeacherDashboardGate>{children}</TeacherDashboardGate>;
}
