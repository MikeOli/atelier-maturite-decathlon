import { Suspense } from "react";
import {
  getPublicSessionSummary,
  getSessionCurrentCard,
  getSessionLiveState,
} from "@/features/sessions/actions";
import { listParticipants } from "@/features/participants/actions";
import { AvatarPicker } from "@/features/participants/components/avatar-picker";
import { SessionTimer } from "@/features/sessions/components/session-timer";
import { CardDisplay } from "@/features/voting/components/card-display";

async function SessionJoinScreen({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getPublicSessionSummary(code);

  if (!session) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-display text-xl font-bold">Session introuvable</h1>
        <p className="text-muted-foreground">
          Ce lien de session n&apos;est plus valide. Vérifie le lien ou le QR
          code avec ton animateur.
        </p>
      </div>
    );
  }

  // Story 4.8 (FR39): a closed session is read-only — no AvatarPicker (it
  // would let someone join and vote), just the last active card for
  // reference. Never render AvatarPicker once CLOTUREE.
  if (session.status === "CLOTUREE") {
    const currentCard = await getSessionCurrentCard(session.id);

    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-xl font-bold">Équipe {session.teamName}</h1>
        {currentCard && <CardDisplay card={currentCard} />}
        <p className="text-muted-foreground text-sm">
          Cette session est clôturée.
        </p>
      </div>
    );
  }

  const [participants, currentCard, liveState] = await Promise.all([
    listParticipants(session.id),
    getSessionCurrentCard(session.id),
    getSessionLiveState(session.id),
  ]);
  const takenKeys = participants.map((p) => p.avatarKey);

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-xl font-bold">
        Bienvenue dans la session de l&apos;équipe {session.teamName}
      </h1>
      <SessionTimer
        createdAt={session.createdAt}
        durationMinutes={session.durationMinutes}
      />
      <AvatarPicker
        sessionId={session.id}
        initialTakenKeys={takenKeys}
        currentCard={currentCard}
        initialVotesRevealed={liveState?.votesRevealed ?? false}
        transcriptionEnabled={session.transcriptionEnabled ?? false}
      />
    </div>
  );
}

export default function SessionJoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <div className="flex-1 w-full min-h-svh flex flex-col">
      <Suspense fallback={null}>
        <SessionJoinScreen params={params} />
      </Suspense>
    </div>
  );
}
