import { Suspense } from "react";
import {
  getSessionByFacilitatorToken,
  getSessionCurrentCard,
  getSessionLiveState,
  getCardConsensus,
} from "@/features/sessions/actions";
import { listParticipants } from "@/features/participants/actions";
import { ParticipantsPanel } from "@/features/participants/components/participants-panel";
import { StartSessionAsFacilitatorButton } from "@/features/sessions/components/start-session-as-facilitator-button";
import { CloseSessionAsFacilitatorButton } from "@/features/sessions/components/close-session-as-facilitator-button";
import { FacilitatorControlPanel } from "@/features/facilitate/components/facilitator-control-panel";
import { CardDisplay } from "@/features/voting/components/card-display";

// Do not add "use cache" to this component or the actions it calls above.
// This route has no other reason to stay dynamic (no cookies()/headers()
// call like the admin pages) — under cacheComponents, staying uncached here
// is the only thing making FR36 (reprise de session interrompue, Story 4.6)
// true: a facilitator reopening this link days later must always see the
// real current state, not a stale cached render.
async function FacilitateScreen({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getSessionByFacilitatorToken(code);

  if (!session) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-display text-xl font-bold">Lien invalide</h1>
        <p className="text-muted-foreground">
          Ce lien de pilotage n&apos;est plus valide.
        </p>
      </div>
    );
  }

  // Story 4.8 (FR39): a closed session is read-only for the facilitator
  // too — never render FacilitatorControlPanel once CLOTUREE (its
  // reveal/next-card buttons would just fail server-side via the guard
  // added in Story 4.5, a confusing dead-click instead of a clear message).
  if (session.status === "CLOTUREE") {
    const currentCard = await getSessionCurrentCard(session.id);

    return (
      <div className="mx-auto w-full max-w-lg p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-sand-foreground">
              Pilotage
            </p>
            <h1 className="font-display text-xl font-bold">
              Équipe {session.teamName}
            </h1>
          </div>
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            Clôturé
          </span>
        </div>
        {currentCard && (
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <CardDisplay card={currentCard} />
          </div>
        )}
      </div>
    );
  }

  const [currentCard, liveState, participants] = await Promise.all([
    getSessionCurrentCard(session.id),
    getSessionLiveState(session.id),
    listParticipants(session.id),
  ]);
  const initialConsensusValue = currentCard
    ? await getCardConsensus(session.id, currentCard.cardId)
    : null;

  return (
    <div className="mx-auto w-full max-w-lg p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-sand-foreground">
            Pilotage
          </p>
          <h1 className="font-display text-xl font-bold">
            Équipe {session.teamName}
          </h1>
        </div>
        <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-sand px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-sand-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sand-foreground" />
          En cours
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {!currentCard && (
          <StartSessionAsFacilitatorButton
            sessionId={session.id}
            facilitatorToken={code}
          />
        )}

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <ParticipantsPanel
            sessionId={session.id}
            initialParticipants={participants}
          />
        </div>

        <FacilitatorControlPanel
          sessionId={session.id}
          facilitatorToken={code}
          currentCard={currentCard}
          initialVotesRevealed={liveState?.votesRevealed ?? false}
          initialConsensusValue={initialConsensusValue}
          createdAt={session.createdAt}
          durationMinutes={session.durationMinutes}
        />

        <CloseSessionAsFacilitatorButton
          sessionId={session.id}
          facilitatorToken={code}
        />
      </div>
    </div>
  );
}

export default function FacilitatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <div className="flex-1 w-full min-h-svh flex flex-col">
      <Suspense fallback={null}>
        <FacilitateScreen params={params} />
      </Suspense>
    </div>
  );
}
