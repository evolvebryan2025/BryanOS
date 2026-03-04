"use client";

import { usePathname } from "next/navigation";
import {
  Search,
  Bell,
  Plus,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopbarProps {
  onMobileMenuToggle: () => void;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/queue": "Build Queue",
  "/dashboard/team": "Team Hub",
  "/dashboard/referrals": "Referral Messages",
  "/dashboard/sops": "SOPs",
  "/dashboard/settings": "Settings",
};

export function Topbar({ onMobileMenuToggle }: TopbarProps) {
  const pathname = usePathname();

  const title = Object.entries(pageTitles).find(([path]) => {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(path);
  })?.[1] || "BryanOS";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur-xl px-4 lg:px-6">
      {/* Left: Mobile menu + Page title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-muted-foreground"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-foreground">
          {title}
        </h1>
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tasks, clients, team..."
            className="h-9 w-full pl-9 bg-white/5 border-white/10 focus:border-brand-red/50 focus:ring-brand-red/20 placeholder:text-white/30 text-sm"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Quick add */}
        <Button
          size="sm"
          className="hidden sm:flex h-8 gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-medium glow-red-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </Button>

        {/* Mobile add */}
        <Button
          size="icon"
          className="sm:hidden h-8 w-8 bg-brand-red hover:bg-brand-red-dark text-white"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-red" />
        </Button>

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full p-0"
            >
              <Avatar className="h-8 w-8 border border-white/10">
                <AvatarFallback className="bg-brand-red/15 text-brand-red text-xs font-semibold">
                  BP
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-popover border-border"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">Bryan Prince</p>
              <p className="text-xs text-muted-foreground">bryan@sumait.ai</p>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-sm cursor-pointer focus:bg-white/5">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm cursor-pointer focus:bg-white/5">
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-sm text-brand-red cursor-pointer focus:bg-brand-red/10">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
