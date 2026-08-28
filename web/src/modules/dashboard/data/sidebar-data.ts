import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  Gamepad2,
  LayoutDashboard,
  NotebookTabs,
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
      title: "Classroom",
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
          title: "Activity Builder",
          url: "/dashboard#activity-builder",
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
      title: "Insights",
      items: [
        {
          title: "Notebook",
          url: "/dashboard#notebook",
          icon: NotebookTabs,
          badge: "Next",
        },
        {
          title: "Analytics",
          url: "/dashboard#analytics",
          icon: BarChart3,
          disabled: true,
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
    title: "Build Activity",
    href: "/dashboard#activity-builder",
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
    title: "Notebook",
    href: "/dashboard#notebook",
    isActive: false,
    disabled: false,
  },
];
