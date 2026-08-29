import type { Metadata } from "next";

import { GamePage } from "@/modules/game/pages/game-page";

export const metadata: Metadata = {
  title: "ClassGame | Student mission",
};

export default function Page() {
  return <GamePage />;
}
