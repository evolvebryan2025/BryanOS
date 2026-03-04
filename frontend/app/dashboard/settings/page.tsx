"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield, Bell, Palette, Database, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-bold text-foreground">
          Settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace configuration.
        </p>
      </div>

      {/* Profile */}
      <Card className="glass border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-brand-red" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <Input
                defaultValue="Bryan Prince"
                className="h-10 bg-white/5 border-white/10 focus:border-brand-red/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input
                defaultValue="bryan@sumait.ai"
                disabled
                className="h-10 bg-white/3 border-white/5 text-muted-foreground"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="bg-brand-red hover:bg-brand-red-dark text-white text-xs"
          >
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card className="glass border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-red" />
            Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Sumait AI</p>
              <p className="text-xs text-muted-foreground">Workspace ID: sumait-ai</p>
            </div>
            <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px]">
              Pro Plan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="glass border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-brand-red" />
            Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "Google Sheets", status: "Connected", active: true },
              { name: "OpenAI API", status: "Connected", active: true },
              { name: "Supabase", status: "Not Connected", active: false },
              { name: "Slack", status: "Coming Soon", active: false },
            ].map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between rounded-lg bg-white/3 px-4 py-3"
              >
                <span className="text-sm text-foreground">{integration.name}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    integration.active
                      ? "border-green-500/30 text-green-400"
                      : "border-white/10 text-muted-foreground"
                  )}
                >
                  {integration.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="glass border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-brand-red" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notification settings will be available once Supabase is connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

