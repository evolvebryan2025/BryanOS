"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Sparkles,
  Copy,
  Check,
  Loader2,
  MessageSquare,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Contact {
  id: number;
  name: string;
  relationship: string;
  platform: string;
}

interface GeneratedMessage {
  contact: Contact;
  message: string;
  copied: boolean;
}

const relationships = [
  "Past Client",
  "Partner",
  "Colleague",
  "Friend",
  "Industry Contact",
  "Mentor",
];

const platforms = ["WhatsApp", "LinkedIn", "Email", "SMS", "Instagram DM"];

export default function ReferralsPage() {
  const [contacts, setContacts] = useState<Contact[]>([
    { id: 1, name: "", relationship: "Past Client", platform: "WhatsApp" },
  ]);
  const [pitch, setPitch] = useState("");
  const [offer, setOffer] = useState("");
  const [senderName, setSenderName] = useState("Bryan");
  const [messages, setMessages] = useState<GeneratedMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function addContact() {
    if (contacts.length >= 10) return;
    setContacts([
      ...contacts,
      {
        id: Date.now(),
        name: "",
        relationship: "Past Client",
        platform: "WhatsApp",
      },
    ]);
  }

  function removeContact(id: number) {
    if (contacts.length <= 1) return;
    setContacts(contacts.filter((c) => c.id !== id));
  }

  function updateContact(id: number, field: keyof Contact, value: string) {
    setContacts(
      contacts.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  async function handleGenerate() {
    const validContacts = contacts.filter((c) => c.name.trim());
    if (validContacts.length === 0 || !pitch.trim()) return;

    setIsGenerating(true);
    try {
      const result = await api.generateReferralMessages(
        validContacts.map((c) => ({
          name: c.name,
          company: undefined,
          relationship: c.relationship,
        })),
        pitch,
        offer || undefined,
        senderName || undefined
      );

      setMessages(
        result.messages.map((m, i) => ({
          contact: validContacts[i] || validContacts[0],
          message: m.message,
          copied: false,
        }))
      );
    } catch (error) {
      console.error("Failed to generate messages:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopy(index: number, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const validContactCount = contacts.filter((c) => c.name.trim()).length;
  const copiedCount = messages.filter((m) => m.copied).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-bold text-foreground">
          Referral Message Generator
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-powered personalized outreach messages for your referral network.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Input Form */}
        <div className="space-y-5">
          {/* Pitch & Offer */}
          <Card className="glass border-white/8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Your Pitch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  What are you pitching? *
                </label>
                <Textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="e.g., We build AI-powered automation systems for businesses..."
                  rows={3}
                  className="bg-white/5 border-white/10 focus:border-brand-red/50 resize-none placeholder:text-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Special offer (optional)
                </label>
                <Input
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder="e.g., Free consultation, 20% discount..."
                  className="h-10 bg-white/5 border-white/10 focus:border-brand-red/50 placeholder:text-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Your name
                </label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Bryan"
                  className="h-10 bg-white/5 border-white/10 focus:border-brand-red/50 placeholder:text-white/30"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card className="glass border-white/8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Contacts
                  <Badge variant="outline" className="ml-2 text-[10px] border-white/10">
                    {validContactCount}/10
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addContact}
                  disabled={contacts.length >= 10}
                  className="h-7 text-xs text-brand-red hover:text-brand-red-light hover:bg-brand-red/10"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {contacts.map((contact, i) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-2 rounded-lg bg-white/3 p-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <Input
                    value={contact.name}
                    onChange={(e) => updateContact(contact.id, "name", e.target.value)}
                    placeholder="Name"
                    className="h-8 bg-white/5 border-white/8 text-sm flex-1"
                  />
                  <Select
                    value={contact.relationship}
                    onValueChange={(v) => updateContact(contact.id, "relationship", v)}
                  >
                    <SelectTrigger className="h-8 w-[110px] bg-white/5 border-white/8 text-xs shrink-0 hidden sm:flex">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {relationships.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={contact.platform}
                    onValueChange={(v) => updateContact(contact.id, "platform", v)}
                  >
                    <SelectTrigger className="h-8 w-[100px] bg-white/5 border-white/8 text-xs shrink-0 hidden md:flex">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeContact(contact.id)}
                    disabled={contacts.length <= 1}
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || validContactCount === 0 || !pitch.trim()}
            className="w-full h-11 bg-brand-red hover:bg-brand-red-dark text-white font-medium glow-red-hover"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Messages...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {validContactCount} Message{validContactCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>

        {/* Right: Generated Messages */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand-red" />
              Generated Messages
            </h3>
            {messages.length > 0 && (
              <Badge variant="outline" className="text-[10px] border-white/10">
                {copiedCount}/{messages.length} copied
              </Badge>
            )}
          </div>

          {messages.length === 0 ? (
            <Card className="glass border-white/8">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 mb-4">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Add contacts and your pitch, then click Generate.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  AI will create personalized messages for each contact.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <Card
                  key={i}
                  className={cn(
                    "glass border-white/8 transition-smooth",
                    copiedId === i && "border-green-500/30"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-red/15">
                          <User className="h-3.5 w-3.5 text-brand-red" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {msg.contact.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {msg.contact.relationship} &middot; {msg.contact.platform}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(i, msg.message)}
                        className={cn(
                          "h-7 text-xs gap-1",
                          copiedId === i
                            ? "text-green-400"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {copiedId === i ? (
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
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {msg.message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
