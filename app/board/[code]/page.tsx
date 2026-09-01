import { Suspense } from "react";
import Image from "next/image";
import {
  getPublicSessionSummary,
  getSessionCurrentCard,
  getSessionLiveState,
} from "@/features/sessions/actions";
import { listParticipants } from "@/features/participants/actions";
import { SessionBoard } from "@/features/board/components/session-board";
import { getOrigin } from "@/lib/get-origin";
import { generateQrCodeSvg } from "@/lib/qrcode";

async function BoardScreen({
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
          Ce lien de session n&apos;est plus valide.
        </p>
      </div>
    );
  }

  const [currentCard, liveState, participants, origin] = await Promise.all([
    getSessionCurrentCard(session.id),
    getSessionLiveState(session.id),
    listParticipants(session.id),
    getOrigin(),
  ]);
  const joinUrl = `${origin}/session/${session.id}`;
  const qrCodeSvg = generateQrCodeSvg(joinUrl);

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center gap-7 p-6 text-center">
      <Image
        src="/decathlon-logo.png"
        alt="Décathlon"
        width={130}
        height={26}
        className="h-[26px] w-[130px]"
        priority
      />
      <h1 className="font-display text-[clamp(24px,3.6vw,30px)] font-bold tracking-tight">
        Équipe {session.teamName}
      </h1>
      <SessionBoard
        sessionId={session.id}
        currentCard={currentCard}
        initialVotesRevealed={liveState?.votesRevealed ?? false}
        createdAt={session.createdAt}
        durationMinutes={session.durationMinutes}
        joinUrl={joinUrl}
        qrCodeSvg={qrCodeSvg}
        deckName={session.deckName}
        deckDescription={session.deckDescription}
        initialParticipants={participants}
      />
    </div>
  );
}

export default function BoardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <div className="flex-1 w-full min-h-svh flex flex-col">
      <Suspense fallback={null}>
        <BoardScreen params={params} />
      </Suspense>
    </div>
  );
}
