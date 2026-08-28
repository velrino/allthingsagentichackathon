"use client";

import { useSyncExternalStore } from "react";

const mobileBreakpoint = 768;
const mobileQuery = `(max-width: ${mobileBreakpoint - 1}px)`;

export function useIsMobile() {
  return useSyncExternalStore(
    (callback) => {
      const mediaQueryList = window.matchMedia(mobileQuery);
      mediaQueryList.addEventListener("change", callback);

      return () => mediaQueryList.removeEventListener("change", callback);
    },
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
}
