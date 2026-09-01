import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCompletedSessionsForAdmin } from "@/features/sessions/actions";
import { DeleteSessionButton } from "@/features/sessions/components/delete-session-button";

/**
 * Story 5.3/5.4 (FR51) — counterpart of the "sessions en cours" list on
 * /admin: before this story, a `CLOTUREE` session was only reachable via a
 * saved link, which read as if "Terminer la session" had deleted it. Each
 * row links to the synthesis screen (already read-only-safe, Story 4.8)
 * and carries the one place `DeleteSessionButton` is ever rendered — never
 * on an `EN_COURS` session.
 */
export async function CompletedSessionsList() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  const sessions = await listCompletedSessionsForAdmin(data.claims.sub);

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune session terminée.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
        >
          <Link
            href={`/admin/sessions/${session.id}/synthesis`}
            className="flex flex-1 items-center justify-between gap-3 hover:text-foreground"
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
          <DeleteSessionButton sessionId={session.id} />
        </li>
      ))}
    </ul>
  );
}
