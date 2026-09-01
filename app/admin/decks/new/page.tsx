import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewDeckForm } from "@/features/decks/components/new-deck-form";

async function NewDeckFormLoader() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  return <NewDeckForm />;
}

export default function NewDeckPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-bold">Nouveau deck</h1>
      <Suspense fallback={null}>
        <NewDeckFormLoader />
      </Suspense>
    </div>
  );
}
