import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/get-origin";
import {
  getSessionDetail,
  getSessionCurrentCard,
  getSessionLiveState,
  hasNextCard,
  getCardConsensus,
} from "@/features/sessions/actions";
import { generateQrCodeSvg } from "@/lib/qrcode";
import { CopyLinkButton } from "@/features/sessions/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { listParticipants } from "@/features/participants/actions";
import { ParticipantsPanel } from "@/features/participants/components/participants-panel";
import { RevealPanel } from "@/features/voting/components/reveal-panel";
import { SessionTimer } from "@/features/sessions/components/session-timer";
import { CloseSessionButton } from "@/features/sessions/components/close-session-button";
import { StartSessionButton } from "@/features/sessions/components/start-session-button";
import { LiveTranscriptPanel } from "@/features/sessions/components/live-transcript-panel";
import { cn } from "@/lib/utils";

async function SessionSummary({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  const session = await getSessionDetail(sessionId, data.claims.sub);
  if (!session) notFound();

  const origin = await getOrigin();
  const joinUrl = `${origin}/session/${session.id}`;
  // Never add an "Ouvrir" (open in new tab) button next to this one —
  // unlike joinUrl/boardUrl, it embeds `facilitatorToken`, a bearer secret
  // (FR37/FR38). Copy-only keeps it out of new-tab navigation/history. A QR
  // code was added anyway on explicit user request (2026-08-22) despite
  // that same token being trivially shareable once scanned — accepted risk,
  // not an oversight.
  const facilitateUrl = `${origin}/facilitate/${session.facilitatorToken}`;
  const boardUrl = `${origin}/board/${session.id}`;
  const qrCodeSvg = generateQrCodeSvg(joinUrl);
  const facilitateQrCodeSvg = generateQrCodeSvg(facilitateUrl);
  const [participants, currentCard, liveState, nextCardExists] =
    await Promise.all([
      listParticipants(session.id),
      getSessionCurrentCard(session.id),
      getSessionLiveState(session.id),
      hasNextCard(session.id),
    ]);
  const initialConsensusValue = currentCard
    ? await getCardConsensus(session.id, currentCard.cardId)
    : null;
  const isOpen = session.status === "EN_COURS";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-xs uppercase tracking-wider text-sand-foreground">
            Session · {session.deckName}
          </p>
          <h1 className="font-display text-2xl font-bold">
            {session.teamName}
          </h1>
          <SessionTimer
            createdAt={session.createdAt}
            durationMinutes={session.durationMinutes}
          />
        </div>
        <span
          className={cn(
            "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 font-mono text-xs uppercase tracking-wider",
            isOpen
              ? "bg-sand text-sand-foreground"
              : "bg-secondary text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isOpen
                ? "animate-pulse bg-sand-foreground"
                : "bg-muted-foreground",
            )}
          />
          {isOpen ? "En cours" : "Clôturé"}
        </span>
      </div>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="font-display mb-3.5 text-sm font-bold">Liens</h2>
        <div className="flex flex-col gap-3.5">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Rejoindre la session (lien participants)
            </p>
            <div className="flex items-center gap-2.5">
              <div
                role="img"
                aria-label={`QR code pour rejoindre la session via ${joinUrl}`}
                className="h-24 w-24 flex-shrink-0 rounded-md border bg-background p-1.5"
                dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <code className="truncate rounded-md border bg-background px-2.5 py-2 font-mono text-xs text-foreground-soft">
                  {joinUrl}
                </code>
                <CopyLinkButton url={joinUrl} />
              </div>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Lien de pilotage mobile (pour facilitateur)
            </p>
            <div className="flex items-center gap-2.5">
              <div
                role="img"
                aria-label={`QR code pour le pilotage mobile via ${facilitateUrl} — ce lien donne le contrôle complet de la session, ne le partage qu'avec le facilitateur`}
                className="h-24 w-24 flex-shrink-0 rounded-md border bg-background p-1.5"
                dangerouslySetInnerHTML={{ __html: facilitateQrCodeSvg }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <code className="truncate rounded-md border bg-background px-2.5 py-2 font-mono text-xs text-foreground-soft">
                  {facilitateUrl}
                </code>
                <CopyLinkButton url={facilitateUrl} />
              </div>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Board projeté
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-2.5 py-2 font-mono text-xs text-foreground-soft">
                {boardUrl}
              </code>
              <CopyLinkButton url={boardUrl} />
              <Button size="sm" variant="outline" asChild>
                <a
                  href={boardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ouvrir le board projeté dans un nouvel onglet"
                >
                  Ouvrir le board
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <ParticipantsPanel
          sessionId={session.id}
          initialParticipants={participants}
        />
      </div>

      {currentCard ? (
        <RevealPanel
          key={currentCard.cardId}
          sessionId={session.id}
          cardId={currentCard.cardId}
          initialVotesRevealed={liveState?.votesRevealed ?? false}
          hasNextCard={nextCardExists}
          initialConsensusValue={initialConsensusValue}
        />
      ) : isOpen ? (
        <>
          <LiveTranscriptPanel
            started={false}
            sessionId={session.id}
            facilitatorToken={session.facilitatorToken}
            initialEnabled={session.transcriptionEnabled}
          />
          <StartSessionButton sessionId={session.id} />
        </>
      ) : null}

      {currentCard && isOpen && (
        <LiveTranscriptPanel
          started={true}
          sessionId={session.id}
          facilitatorToken={session.facilitatorToken}
          transcriptionEnabled={session.transcriptionEnabled}
          initialDraft={session.transcriptDraft}
        />
      )}

      {isOpen ? (
        <CloseSessionButton sessionId={session.id} />
      ) : (
        <p className="text-muted-foreground text-sm">Atelier clôturé.</p>
      )}

      <Link
        href={`/admin/sessions/${session.id}/synthesis`}
        className="self-start text-sm font-medium text-foreground-soft underline-offset-4 hover:underline hover:text-foreground"
      >
        Voir la synthèse
      </Link>
    </div>
  );
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="self-start text-sm text-foreground-soft hover:text-foreground"
        >
          ← Retour à l&apos;espace facilitateur
        </Link>
      </div>
      <Suspense fallback={null}>
        <SessionSummary params={params} />
      </Suspense>
    </div>
  );
}
