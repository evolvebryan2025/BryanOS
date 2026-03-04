"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  FileText,
  CheckCircle2,
  ListTodo,
  Copy,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { useConfigStore, useTaskStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

export default function TranscriptsPage() {
  const { clients, fetchConfig } = useConfigStore();
  const { createTask, fetchTasks } = useTaskStore();

  const [selectedClient, setSelectedClient] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // AI results
  const [formattedOutput, setFormattedOutput] = useState("");
  const [parsedTasks, setParsedTasks] = useState<Partial<Task>[]>([]);
  const [copiedFormatted, setCopiedFormatted] = useState(false);
  const [tasksCreated, setTasksCreated] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleProcess() {
    if (!transcript.trim() || !selectedClient) return;

    setIsProcessing(true);
    setFormattedOutput("");
    setParsedTasks([]);
    setTasksCreated(false);

    try {
      const result = await api.processTranscript(transcript.trim(), selectedClient);
      setFormattedOutput(result.formatted);
      setParsedTasks(result.tasks || []);
    } catch (error) {
      console.error("Failed to process transcript:", error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCreateTasks() {
    if (parsedTasks.length === 0) return;

    setIsCreating(true);
    try {
      for (const task of parsedTasks) {
        await createTask({
          ...task,
          client_id: selectedClient,
        });
      }
      setTasksCreated(true);
      await fetchTasks();
    } catch (error) {
      console.error("Failed to create tasks:", error);
    } finally {
      setIsCreating(false);
    }
  }

  function handleReset() {
    setTranscript("");
    setSelectedClient("");
    setFormattedOutput("");
    setParsedTasks([]);
    setTasksCreated(false);
  }

  function handleCopyFormatted() {
    navigator.clipboard.writeText(formattedOutput);
    setCopiedFormatted(true);
    setTimeout(() => setCopiedFormatted(false), 2000);
  }

  const clientName = clients.find((c) => c.id === selectedClient)?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-bold text-foreground">
          Process Meeting Transcript
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a raw meeting transcript and AI will extract actionable tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Input Form */}
        <div className="space-y-5">
          <Card className="glass border-white/8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Meeting Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Client *
                </label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="h-10 bg-white/5 border-white/10 focus:border-brand-red/50">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {clients
                      .filter((c) => c.is_active)
                      .map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transcript textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Meeting Transcript *
                </label>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste your raw meeting transcript here..."
                  rows={12}
                  className="bg-white/5 border-white/10 focus:border-brand-red/50 resize-none placeholder:text-white/30 font-mono text-sm"
                />
                {transcript.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {transcript.length.toLocaleString()} characters
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Process Button */}
          <Button
            onClick={handleProcess}
            disabled={isProcessing || !transcript.trim() || !selectedClient}
            className="w-full h-11 bg-brand-red hover:bg-brand-red-dark text-white font-medium glow-red-hover"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing with AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Process Transcript
              </>
            )}
          </Button>
        </div>

        {/* Right: AI Output */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-red" />
              AI Output
            </h3>
            {parsedTasks.length > 0 && (
              <Badge variant="outline" className="text-[10px] border-white/10">
                {parsedTasks.length} task{parsedTasks.length !== 1 ? "s" : ""} found
              </Badge>
            )}
          </div>

          {!formattedOutput && !isProcessing ? (
            <Card className="glass border-white/8">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 mb-4">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a client and paste your transcript, then click Process.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  AI will extract tasks, priorities, and assignments automatically.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Formatted output */}
              {formattedOutput && (
                <Card className="glass border-white/8">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Formatted Document
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyFormatted}
                        className={cn(
                          "h-7 text-xs gap-1",
                          copiedFormatted
                            ? "text-green-400"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {copiedFormatted ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-mono bg-white/3 rounded-lg p-3 max-h-[300px] overflow-y-auto">
                      {formattedOutput}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Parsed tasks */}
              {parsedTasks.length > 0 && (
                <Card className="glass border-white/8">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <ListTodo className="h-3.5 w-3.5" />
                      Extracted Tasks ({parsedTasks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {parsedTasks.map((task, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg bg-white/3 p-3"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-red/15 text-[10px] font-bold text-brand-red mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            {task.priority && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] border-white/10",
                                  task.priority === "critical" && "border-red-500/30 text-red-400",
                                  task.priority === "high" && "border-orange-500/30 text-orange-400",
                                  task.priority === "medium" && "border-yellow-500/30 text-yellow-400",
                                  task.priority === "low" && "border-green-500/30 text-green-400"
                                )}
                              >
                                {task.priority}
                              </Badge>
                            )}
                            {task.status && (
                              <Badge variant="outline" className="text-[10px] border-white/10">
                                {task.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Create tasks button */}
                    <div className="pt-3 flex gap-2">
                      {tasksCreated ? (
                        <div className="flex items-center gap-2 text-green-400 text-sm font-medium w-full justify-center py-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {parsedTasks.length} task{parsedTasks.length !== 1 ? "s" : ""} created successfully!
                        </div>
                      ) : (
                        <>
                          <Button
                            onClick={handleCreateTasks}
                            disabled={isCreating}
                            className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white font-medium"
                          >
                            {isCreating ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Confirm & Create {parsedTasks.length} Task{parsedTasks.length !== 1 ? "s" : ""}
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleReset}
                            className="h-10 border-white/10 text-muted-foreground hover:text-foreground"
                          >
                            Reset
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Process another */}
              {tasksCreated && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full h-10 border-white/10 text-muted-foreground hover:text-foreground"
                >
                  Process Another Transcript
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
