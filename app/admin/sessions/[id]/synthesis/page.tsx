import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionDetail } from "@/features/sessions/actions";
import { getSessionSynthesis } from "@/features/synthesis/actions";
import { aggregateByTheme } from "@/features/synthesis/synthesis-utils";
import { SynthesisTable } from "@/features/synthesis/components/synthesis-table";
import { ThemeSynthesisTable } from "@/features/synthesis/components/theme-synthesis-table";
import { AiSynthesisPanel } from "@/features/synthesis/components/ai-synthesis-panel";

async function SynthesisScreen({
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

  const cards = await getSessionSynthesis(session.id, data.claims.sub);
  const themes = aggregateByTheme(cards);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/admin/sessions/${session.id}`}
        className="self-start text-sm text-foreground-soft hover:text-foreground"
      >
        ← Retour à la session
      </Link>
      <p>
        <span className="font-medium">Équipe :</span> {session.teamName}
      </p>
      <SynthesisTable cards={cards} />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Par thème</h2>
        <ThemeSynthesisTable themes={themes} />
      </div>
      {session.aiSynthesis && (
        <AiSynthesisPanel aiSynthesis={session.aiSynthesis} cards={cards} />
      )}
    </div>
  );
}

export default function SessionSynthesisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-bold">Synthèse</h1>
      <Suspense fallback={null}>
        <SynthesisScreen params={params} />
      </Suspense>
    </div>
  );
}
