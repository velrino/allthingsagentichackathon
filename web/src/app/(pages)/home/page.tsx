import type { Metadata } from "next";

import { GamePage } from "@/modules/game/pages/game-page";

export const metadata: Metadata = {
  title: "ClassGame | Algebra Mission",
};

export default function Page() {
  return <GamePage />;
}
