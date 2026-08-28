import { Suspense } from "react";

import { LoginPage } from "@/modules/dashboard/pages/login-page";

export default function LoginRoute() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
