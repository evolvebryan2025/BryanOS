"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Users,
  MessageSquare,
  BookOpen,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Build Queue",
    href: "/dashboard/queue",
    icon: ListTodo,
  },
  {
    label: "Transcripts",
    href: "/dashboard/transcripts",
    icon: FileText,
  },
  {
    label: "Team Hub",
    href: "/dashboard/team",
    icon: Users,
  },
  {
    label: "Referrals",
    href: "/dashboard/referrals",
    icon: MessageSquare,
  },
  {
    label: "SOPs",
    href: "/dashboard/sops",
    icon: BookOpen,
  },
];

const bottomItems = [
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function isActive(href: string) {
    if (!mounted) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-red text-white font-bold text-sm">
          S
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-[family-name:var(--font-syne)] text-sm font-bold text-foreground truncate">
              Sumait AI
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              BryanOS 1.0
            </span>
          </div>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Main nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground glow-red-sm"
                  : "text-sidebar-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  active ? "text-brand-red" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border border-border">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          return linkContent;
        })}
      </nav>

      {/* Bottom section */}
      <div className="space-y-1 px-3 pb-2">
        <Separator className="mb-2 bg-sidebar-border" />
        {bottomItems.map((item) => {
          const active = isActive(item.href);
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-brand-red" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border border-border">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          return linkContent;
        })}

        {/* Logout */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-white/5 hover:text-foreground transition-smooth">
                <LogOut className="h-[18px] w-[18px] shrink-0 text-muted-foreground group-hover:text-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border border-border">
              Sign Out
            </TooltipContent>
          </Tooltip>
        ) : (
          <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-white/5 hover:text-foreground transition-smooth">
            <LogOut className="h-[18px] w-[18px] shrink-0 text-muted-foreground group-hover:text-foreground" />
            <span className="truncate">Sign Out</span>
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-full text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
