"use client";

import Image from "next/image";

import { Main } from "@/components/layout/main";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { useTeacherAuth } from "../auth/use-teacher-auth";
import { DashboardShell } from "../components/dashboard-shell";

const ARCHITECTURE_IMAGE_SRC =
  "/assets/diagrams/architecture/architecture-graphviz.svg";
const LIFECYCLE_IMAGE_SRC = "/assets/diagrams/lifecycle/content-lifecycle.png";

export function ArchitecturePage() {
  const auth = useTeacherAuth();

  async function handleSignOut() {
    await auth.signOutTeacher();
  }

  return (
    <DashboardShell user={auth.user!} onSignOut={handleSignOut}>
      <Main id="main-content">
        <Tabs defaultValue="architecture" className="gap-4">
          <TabsList className="grid w-full grid-cols-2 sm:w-fit">
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          </TabsList>

          <TabsContent value="architecture">
            <DiagramImage
              src={ARCHITECTURE_IMAGE_SRC}
              alt="ClassGame production architecture diagram"
            />
          </TabsContent>

          <TabsContent value="lifecycle">
            <DiagramImage
              src={LIFECYCLE_IMAGE_SRC}
              alt="ClassGame content lifecycle diagram"
            />
          </TabsContent>
        </Tabs>
      </Main>
    </DashboardShell>
  );
}

function DiagramImage({ alt, src }: { readonly alt: string; readonly src: string }) {
  return (
    <section className="overflow-hidden bg-white">
      <div className="overflow-auto">
        <Image
          src={src}
          alt={alt}
          width={1920}
          height={1080}
          priority
          className="h-auto min-w-[960px] max-w-none"
        />
      </div>
    </section>
  );
}
