import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { listActiveSessionsForAdmin } from "@/features/sessions/actions";
import { NewSessionFormLoader } from "@/features/sessions/components/new-session-form-loader";
import { CompletedSessionsList } from "@/features/sessions/components/completed-sessions-list";
import { DeckList } from "@/features/decks/components/deck-list";
import { AdminTabs } from "@/features/admin/components/admin-tabs";

async function AdminIdentity() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  // Defense in depth: don't rely solely on the proxy for auth. If this page
  // is ever reached without a valid session, fail safe rather than render.
  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  return (
    <p className="text-sm text-muted-foreground">
      Connecté en tant que {data.claims.email}.
    </p>
  );
}

// Story 1.6 (FR40): filet de sécurité de continuité — si l'admin quitte un
// atelier sans le clôturer (lien perdu, autre appareil, autre jour), c'est
// le seul point d'entrée pour retrouver la session et reprendre le
// pilotage sur /admin/sessions/[id] (écran de pilotage déjà existant).
async function ActiveSessionsList() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  const sessions = await listActiveSessionsForAdmin(data.claims.sub);

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune session en cours.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/admin/sessions/${session.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 hover:bg-lav hover:border-transparent transition-colors"
          >
            <span className="font-medium">{session.teamName}</span>
            <span className="text-sm text-muted-foreground">
              {new Date(session.createdAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function AdminPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Espace facilitateur</h1>
        <LogoutButton />
      </div>
      <Suspense fallback={null}>
        <AdminIdentity />
      </Suspense>
      <Suspense fallback={null}>
        <AdminTabs
          sessionsContent={
            <Suspense fallback={null}>
              <ActiveSessionsList />
            </Suspense>
          }
          newSessionContent={
            <Suspense fallback={null}>
              <NewSessionFormLoader />
            </Suspense>
          }
          decksContent={
            <>
              <div className="flex justify-end">
                <Button asChild size="sm">
                  <Link href="/admin/decks/new">+ Nouveau deck</Link>
                </Button>
              </div>
              <Suspense fallback={null}>
                <DeckList />
              </Suspense>
            </>
          }
          completedSessionsContent={
            <Suspense fallback={null}>
              <CompletedSessionsList />
            </Suspense>
          }
        />
      </Suspense>
    </div>
  );
}
