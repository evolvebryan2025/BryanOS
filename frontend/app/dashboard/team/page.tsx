"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Activity,
  LayoutGrid,
  MessageSquare,
  Settings,
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Team Hub Sections Data
// ============================================================

const assignmentRules = [
  {
    client: "All Clients",
    primary: "Assigned Builder",
    backup: "Bryan",
    notes: "Check assignment rules sheet before routing",
  },
];

const taskFlowSteps = [
  { step: 1, title: "Meeting Transcript Received", desc: "AI processes transcript and extracts tasks" },
  { step: 2, title: "Tasks Auto-Created", desc: "Tasks appear in Build Queue with client and priority" },
  { step: 3, title: "Auto-Assigned", desc: "Assignment engine routes to correct builder" },
  { step: 4, title: "Builder Works", desc: "Status moves from Not Started → In Progress" },
  { step: 5, title: "QA Review", desc: "Builder marks done → QA column for review" },
  { step: 6, title: "Complete", desc: "Task marked Done after verification" },
];

const commsRules = [
  { rule: "Slack for quick updates", detail: "Use #build-queue channel for task questions" },
  { rule: "Tag the task ID", detail: "Always reference the task ID in messages" },
  { rule: "Daily standup async", detail: "Post your update by 10am in #standup" },
  { rule: "Blocked? Escalate immediately", detail: "Don't wait — mark blocked and notify Bryan" },
  { rule: "Client comms through Bryan only", detail: "Never contact clients directly unless authorized" },
];

const bryanVsTeam = [
  { area: "Client Meetings", bryan: "Attends all meetings", team: "Reviews transcript tasks" },
  { area: "Task Creation", bryan: "AI-assisted from transcripts", team: "Manual creation if needed" },
  { area: "Assignment", bryan: "Sets rules, handles edge cases", team: "Receives assigned tasks" },
  { area: "QA", bryan: "Final review on critical tasks", team: "Self-review before QA" },
  { area: "Client Comms", bryan: "All external communication", team: "Internal Slack only" },
  { area: "Prioritization", bryan: "Sets priority levels", team: "Works in priority order" },
];

const sops = [
  {
    id: "sop-1",
    title: "SOP 1: Processing Meeting Transcripts",
    steps: [
      "Receive transcript from meeting recording",
      "Paste into BryanOS transcript processor",
      "Select the client from the dropdown",
      "Review AI-extracted tasks for accuracy",
      "Confirm to bulk-create tasks in Build Queue",
    ],
  },
  {
    id: "sop-2",
    title: "SOP 2: Working a Task",
    steps: [
      "Check Build Queue for your assigned tasks",
      "Start with highest priority first",
      "Move status to In Progress when starting",
      "Add notes/comments as you work",
      "Move to QA when ready for review",
    ],
  },
  {
    id: "sop-3",
    title: "SOP 3: Handling Blocked Tasks",
    steps: [
      "Change status to Blocked immediately",
      "Add a comment explaining the blocker",
      "Notify Bryan in Slack with task ID",
      "Work on next available task while waiting",
      "Update status once unblocked",
    ],
  },
  {
    id: "sop-4",
    title: "SOP 4: End of Day Update",
    steps: [
      "Review all your In Progress tasks",
      "Update status and notes on each",
      "Post async standup in #standup channel",
      "Flag any tasks that need help",
    ],
  },
  {
    id: "sop-5",
    title: "SOP 5: QA Review Process",
    steps: [
      "Check QA column for tasks to review",
      "Verify deliverables match task description",
      "Test functionality if applicable",
      "Move to Done or back to In Progress with notes",
    ],
  },
];

// ============================================================
// SOP Accordion Item
// ============================================================

function SopItem({ sop }: { sop: (typeof sops)[0] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/3 transition-smooth"
      >
        <span className="text-sm font-medium text-foreground">{sop.title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 py-3">
          <ol className="space-y-2">
            {sop.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-red/15 text-[10px] font-bold text-brand-red">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Team Hub Page
// ============================================================

export default function TeamPage() {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-bold text-foreground">
          Team Operations Hub
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything your team needs to operate efficiently.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="bg-white/5 border border-white/8 p-1 h-auto flex-wrap">
          <TabsTrigger
            value="assignments"
            className="data-[state=active]:bg-brand-red/15 data-[state=active]:text-brand-red text-xs gap-1.5"
          >
            <Users className="h-3.5 w-3.5" />
            Assignments
          </TabsTrigger>
          <TabsTrigger
            value="task-flow"
            className="data-[state=active]:bg-brand-red/15 data-[state=active]:text-brand-red text-xs gap-1.5"
          >
            <Activity className="h-3.5 w-3.5" />
            Task Flow
          </TabsTrigger>
          <TabsTrigger
            value="comms"
            className="data-[state=active]:bg-brand-red/15 data-[state=active]:text-brand-red text-xs gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Comms Rules
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            className="data-[state=active]:bg-brand-red/15 data-[state=active]:text-brand-red text-xs gap-1.5"
          >
            <Settings className="h-3.5 w-3.5" />
            Bryan vs Team
          </TabsTrigger>
          <TabsTrigger
            value="sops"
            className="data-[state=active]:bg-brand-red/15 data-[state=active]:text-brand-red text-xs gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            SOPs
          </TabsTrigger>
        </TabsList>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card className="glass border-white/8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Assignment Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-white/8 overflow-hidden">
                <div className="grid grid-cols-4 gap-4 bg-white/3 px-4 py-2.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Primary</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Backup</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notes</span>
                </div>
                {assignmentRules.map((rule, i) => (
                  <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3 border-t border-white/5">
                    <span className="text-sm text-foreground">{rule.client}</span>
                    <span className="text-sm text-muted-foreground">{rule.primary}</span>
                    <span className="text-sm text-muted-foreground">{rule.backup}</span>
                    <span className="text-xs text-muted-foreground">{rule.notes}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Assignment rules are managed in Settings. The assignment engine auto-routes tasks based on these rules.
              </p>
            </CardContent>
          </Card>

          {/* Shift Coverage */}
          <Card className="glass border-white/8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Shift Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white/3 p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Morning</p>
                  <p className="mt-1 text-sm text-foreground">Bryan</p>
                  <p className="text-xs text-muted-foreground">8am – 12pm EST</p>
                </div>
                <div className="rounded-lg bg-white/3 p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Afternoon</p>
                  <p className="mt-1 text-sm text-foreground">Team Builder</p>
                  <p className="text-xs text-muted-foreground">12pm – 5pm EST</p>
                </div>
                <div className="rounded-lg bg-white/3 p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Evening</p>
                  <p className="mt-1 text-sm text-foreground">On-call</p>
                  <p className="text-xs text-muted-foreground">5pm – 8pm EST</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Task Flow Tab */}
        <TabsContent value="task-flow">
          <Card className="glass border-white/8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">How Tasks Flow Through BryanOS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {taskFlowSteps.map((step, i) => (
                  <div key={step.step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red/15 text-sm font-bold text-brand-red">
                        {step.step}
                      </div>
                      {i < taskFlowSteps.length - 1 && (
                        <div className="mt-1 h-full w-px bg-white/10" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comms Rules Tab */}
        <TabsContent value="comms">
          <Card className="glass border-white/8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Communication Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {commsRules.map((rule, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg bg-white/3 p-3 group"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-red/15 text-[10px] font-bold text-brand-red mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{rule.rule}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{rule.detail}</p>
                    </div>
                    <button
                      onClick={() => handleCopy(`${rule.rule}: ${rule.detail}`, `comm-${i}`)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copiedItem === `comm-${i}` ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bryan vs Team Tab */}
        <TabsContent value="roles">
          <Card className="glass border-white/8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Role Clarification — Bryan vs Team</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-white/8 overflow-hidden">
                <div className="grid grid-cols-3 gap-4 bg-white/3 px-4 py-2.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Area</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bryan</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Team</span>
                </div>
                {bryanVsTeam.map((row, i) => (
                  <div key={i} className="grid grid-cols-3 gap-4 px-4 py-3 border-t border-white/5">
                    <span className="text-sm font-medium text-foreground">{row.area}</span>
                    <span className="text-sm text-muted-foreground">{row.bryan}</span>
                    <span className="text-sm text-muted-foreground">{row.team}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOPs Tab */}
        <TabsContent value="sops">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Standard Operating Procedures for the team. Click to expand each SOP.
            </p>
            {sops.map((sop) => (
              <SopItem key={sop.id} sop={sop} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
