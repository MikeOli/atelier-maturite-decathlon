"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "sessions" | "new-session" | "decks" | "completed-sessions";

const TABS: Tab[] = ["sessions", "new-session", "decks", "completed-sessions"];

function isTab(value: string | null): value is Tab {
  return value !== null && (TABS as string[]).includes(value);
}

export function AdminTabs({
  sessionsContent,
  newSessionContent,
  decksContent,
  completedSessionsContent,
}: {
  sessionsContent: ReactNode;
  newSessionContent: ReactNode;
  decksContent: ReactNode;
  completedSessionsContent: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  // Read initial state directly from the URL so a link like
  // `/admin?tab=decks` (deck detail's back link, new-deck-form's redirect,
  // etc.) lands on the right tab instead of always resetting to the
  // default — cross-page navigation back into /admin must stay coherent
  // with in-page tab switching.
  const [tab, setTab] = useState<Tab>(isTab(tabParam) ? tabParam : "sessions");

  const selectTab = (next: Tab) => {
    setTab(next);
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  };

  return (
    <>
      <div className="flex gap-3">
        <Button
          type="button"
          variant={tab === "sessions" ? "default" : "outline"}
          onClick={() => selectTab("sessions")}
        >
          Sessions en cours
        </Button>
        <Button
          type="button"
          variant={tab === "new-session" ? "default" : "outline"}
          onClick={() => selectTab("new-session")}
        >
          Nouvelle session
        </Button>
        <Button
          type="button"
          variant={tab === "decks" ? "default" : "outline"}
          onClick={() => selectTab("decks")}
        >
          Mes decks
        </Button>
        <Button
          type="button"
          variant={tab === "completed-sessions" ? "default" : "outline"}
          onClick={() => selectTab("completed-sessions")}
        >
          Sessions terminées
        </Button>
      </div>
      {/* Kept mounted (hidden via CSS, not conditional rendering) so
          switching tabs never discards in-progress state — e.g. a
          half-filled "Nouvelle session" form. */}
      <div className={cn("flex flex-col gap-2", tab !== "sessions" && "hidden")}>
        {sessionsContent}
      </div>
      <div className={cn("flex flex-col gap-2", tab !== "new-session" && "hidden")}>
        {newSessionContent}
      </div>
      <div className={cn("flex flex-col gap-2", tab !== "decks" && "hidden")}>
        {decksContent}
      </div>
      <div
        className={cn(
          "flex flex-col gap-2",
          tab !== "completed-sessions" && "hidden",
        )}
      >
        {completedSessionsContent}
      </div>
    </>
  );
}
