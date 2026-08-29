import {
  BookOpenCheck,
  ClipboardList,
  Gamepad2,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DashboardNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
  items?: DashboardNavSubItem[];
};

export type DashboardNavSubItem = {
  title: string;
  url: string;
  classId: string;
};

export type DashboardNavGroup = {
  title: string;
  items: DashboardNavItem[];
};

export type DashboardSidebarData = {
  team: {
    name: string;
    plan: string;
    logo: LucideIcon;
  };
  navGroups: DashboardNavGroup[];
};

export const dashboardSidebarData: DashboardSidebarData = {
  team: {
    name: "ClassGame",
    plan: "Teacher workspace",
    logo: Gamepad2,
  },
  navGroups: [
    {
      title: "General",
      items: [
        {
          title: "Overview",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Classes",
          url: "/dashboard/classes",
          icon: BookOpenCheck,
        },
        {
          title: "Missions",
          url: "/dashboard#mission-builder",
          icon: ClipboardList,
        },
        {
          title: "Students",
          url: "/dashboard#students",
          icon: Users,
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          title: "Settings",
          url: "/dashboard#settings",
          icon: Settings,
          disabled: true,
        },
      ],
    },
  ],
};

export const dashboardTopNav = [
  {
    title: "Overview",
    href: "/dashboard",
    isActive: true,
    disabled: false,
  },
  {
    title: "Classes",
    href: "/dashboard/classes",
    isActive: false,
    disabled: false,
  },
  {
    title: "Missions",
    href: "/dashboard#mission-builder",
    isActive: false,
    disabled: false,
  },
  {
    title: "Students",
    href: "/dashboard#students",
    isActive: false,
    disabled: false,
  },
  {
    title: "Teacher notes",
    href: "/dashboard#notebook",
    isActive: false,
    disabled: false,
  },
];
