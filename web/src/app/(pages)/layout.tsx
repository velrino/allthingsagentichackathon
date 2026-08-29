import type { ReactNode } from "react";

import { TeacherAuthProvider } from "@/modules/dashboard/auth/use-teacher-auth";

export default function PagesLayout({ children }: { readonly children: ReactNode }) {
  return <TeacherAuthProvider>{children}</TeacherAuthProvider>;
}
