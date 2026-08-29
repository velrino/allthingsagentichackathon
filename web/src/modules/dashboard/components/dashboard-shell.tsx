"use client";

import type { User } from "firebase/auth";
import { ChevronsUpDown, LogOut, SearchIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import type { IApiTeacherClass } from "@/backend/api/api.interface";
import { SkipToMain } from "@/components/skip-to-main";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getCookie } from "@/lib/cookies";
import { cn } from "@/lib/utils";

import { dashboardSidebarData, dashboardTopNav, type DashboardNavItem } from "../data/sidebar-data";
import { rememberSelectedClass } from "../utils/teacher-class-state";

type DashboardShellProps = {
  readonly children: ReactNode;
  readonly teacherClasses?: IApiTeacherClass[];
  readonly user: User;
  readonly onSignOut: () => void;
};

export function DashboardShell({ children, onSignOut, teacherClasses = [], user }: DashboardShellProps) {
  const [activeHash, setActiveHash] = useState("#overview");
  const pathname = usePathname();

  useEffect(() => {
    function syncActiveHash() {
      setActiveHash(window.location.hash || "#overview");
    }

    syncActiveHash();
    window.addEventListener("hashchange", syncActiveHash);

    return () => {
      window.removeEventListener("hashchange", syncActiveHash);
    };
  }, []);

  return (
    <main className="dashboard-theme min-h-svh bg-sidebar text-foreground">
      <SidebarProvider defaultOpen={readSidebarDefaultOpen()}>
        <SkipToMain />
        <DashboardAppSidebar
          activeHash={activeHash}
          pathname={pathname}
          teacherClasses={teacherClasses}
          user={user}
          onSignOut={onSignOut}
        />
        <SidebarInset className="@container/content">
          <DashboardHeader activeHash={activeHash} pathname={pathname} user={user} />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </main>
  );
}

function DashboardAppSidebar({
  activeHash,
  onSignOut,
  pathname,
  teacherClasses,
  user,
}: {
  readonly activeHash: string;
  readonly onSignOut: () => void;
  readonly pathname: string;
  readonly teacherClasses: IApiTeacherClass[];
  readonly user: User;
}) {
  const TeamLogo = dashboardSidebarData.team.logo;
  const navGroups = useMemo(
    () =>
      dashboardSidebarData.navGroups.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const scopedItem = {
            ...item,
            url: resolveScopedDashboardURL(item.url, pathname),
          };

          return item.title === "Classes"
            ? {
                ...scopedItem,
                items: teacherClasses.map((teacherClass) => ({
                  classId: teacherClass.class_id,
                  title: teacherClass.class_name.trim() || teacherClass.class_code,
                  url: `/dashboard/class/${encodeURIComponent(teacherClass.class_id)}`,
                })),
              }
            : scopedItem;
        }),
      })),
    [pathname, teacherClasses],
  );

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={dashboardSidebarData.team.name}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TeamLogo className="size-4" aria-hidden />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{dashboardSidebarData.team.name}</span>
                <span className="truncate text-xs">{dashboardSidebarData.team.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{titleCase(group.title)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <DashboardSidebarItem
                    key={`${group.title}-${item.title}`}
                    activeHash={activeHash}
                    item={item}
                    pathname={pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUser user={user} onSignOut={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function DashboardSidebarItem({
  activeHash,
  item,
  pathname,
}: {
  readonly activeHash: string;
  readonly item: DashboardNavItem;
  readonly pathname: string;
}) {
  const { setOpenMobile } = useSidebar();
  const Icon = item.icon;
  const hasActiveChild = item.items?.some((subItem) =>
    isActiveDashboardRoute(subItem.url, pathname, activeHash),
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        aria-disabled={item.disabled}
        isActive={
          isActiveDashboardRoute(item.url, pathname, activeHash) ||
          hasActiveChild
        }
        tooltip={item.title}
      >
        <a
          href={item.disabled ? undefined : item.url}
          onClick={(event) => {
            if (item.disabled) {
              event.preventDefault();
              return;
            }

            setOpenMobile(false);
          }}
        >
          <Icon aria-hidden />
          <span>{item.title}</span>
          {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
        </a>
      </SidebarMenuButton>
      {item.items?.length ? (
        <ul className="mx-3 flex min-w-0 flex-col gap-1 border-l border-sidebar-border px-2 py-1 group-data-[collapsible=icon]:hidden">
          {item.items.map((subItem) => (
            <li key={subItem.classId} className="min-w-0">
              <a
                href={subItem.url}
                className={cn(
                  "block truncate rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActiveDashboardRoute(subItem.url, pathname, activeHash) &&
                    "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                )}
                title={subItem.title}
                onClick={() => {
                  rememberSelectedClass(subItem.classId);
                  setOpenMobile(false);
                }}
              >
                {subItem.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </SidebarMenuItem>
  );
}

function DashboardHeader({
  activeHash,
  pathname,
  user,
}: {
  readonly activeHash: string;
  readonly pathname: string;
  readonly user: User;
}) {
  return (
    <header className="z-50 h-16">
      <div className="relative flex h-full items-center gap-3 p-4 sm:gap-4">
        <SidebarTrigger className="max-md:scale-125" />
        <Separator orientation="vertical" className="h-6" />

        <nav className="hidden items-center space-x-4 lg:flex xl:space-x-6">
          {dashboardTopNav.map((link) => {
            const href = resolveScopedDashboardURL(link.href, pathname);

            return (
              <a
                key={link.title}
                href={link.disabled ? undefined : href}
                aria-disabled={link.disabled}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  !isActiveDashboardRoute(href, pathname, activeHash) &&
                    "text-muted-foreground",
                  link.disabled && "pointer-events-none opacity-50",
                )}
              >
                {link.title}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="group relative h-8 w-full flex-1 justify-start rounded-md bg-muted/25 text-sm font-normal text-muted-foreground shadow-none hover:bg-accent sm:w-40 sm:pr-12 md:flex-none lg:w-52 xl:w-64"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <SearchIcon aria-hidden className="absolute left-1.5 top-1/2 size-4 -translate-y-1/2" />
            <span className="ml-4 truncate">Search class notes</span>
            <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 select-none group-hover:bg-accent sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <TeacherAvatar user={user} />
        </div>
      </div>
    </header>
  );
}

function SidebarUser({ onSignOut, user }: { readonly onSignOut: () => void; readonly user: User }) {
  const displayName = user.displayName ?? user.email ?? "Teacher";
  const email = user.email ?? "Teacher account";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={displayName} onClick={onSignOut}>
          <UserAvatar user={user} className="rounded-lg" />
          <div className="grid flex-1 text-start text-sm leading-tight">
            <span className="truncate font-semibold">{displayName}</span>
            <span className="truncate text-xs">{email}</span>
          </div>
          <LogOut className="ml-auto size-4" aria-hidden />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function TeacherAvatar({ user }: { readonly user: User }) {
  return (
    <Button type="button" variant="ghost" className="relative h-8 w-8 rounded-full p-0">
      <UserAvatar user={user} />
      <span className="sr-only">Teacher account</span>
    </Button>
  );
}

function UserAvatar({ className, user }: { readonly className?: string; readonly user: User }) {
  const displayName = user.displayName ?? user.email ?? "Teacher";

  if (user.photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.photoURL} alt="" className={cn("size-8 rounded-full object-cover", className)} />;
  }

  return (
    <span className={cn("grid size-8 place-items-center rounded-full bg-muted text-sm font-semibold", className)}>
      {displayName.charAt(0).toUpperCase()}
    </span>
  );
}

function readSidebarDefaultOpen() {
  return getCookie("sidebar_state") !== "false";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function isActiveDashboardRoute(target: string, pathname: string, activeHash: string) {
  const route = parseDashboardRoute(target);
  if (route.pathname !== pathname) {
    return false;
  }

  if (!route.hash) {
    return activeHash === "" || activeHash === "#overview";
  }

  return route.hash === activeHash;
}

function parseDashboardRoute(target: string) {
  if (target.startsWith("#")) {
    return {
      pathname: "/dashboard",
      hash: target,
    };
  }

  const [pathname, hash] = target.split("#");

  return {
    pathname: pathname || "/dashboard",
    hash: hash ? `#${hash}` : "",
  };
}

function resolveScopedDashboardURL(target: string, pathname: string) {
  if (!pathname.startsWith("/dashboard/class/")) {
    return target;
  }

  const route = parseDashboardRoute(target);
  if (route.pathname !== "/dashboard") {
    return target;
  }

  return `${pathname}${route.hash || "#overview"}`;
}
