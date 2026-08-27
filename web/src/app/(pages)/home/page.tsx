import type { Metadata } from "next";
import { HomePage } from "@/modules/home/pages/home-page";

export const metadata: Metadata = {
  title: "ClassGame | Home",
};

export default function Page() {
  return <HomePage />;
}
