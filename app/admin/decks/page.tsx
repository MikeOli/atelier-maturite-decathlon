import { redirect } from "next/navigation";

// This page's content (deck list) now lives inline in the "Mes decks" tab
// on /admin (features/admin/components/admin-tabs.tsx) — keeping a second,
// separate rendering of the same list here would drift out of sync with
// it. Redirect rather than delete the route, since /admin/decks may still
// be bookmarked or linked externally.
export default function DecksPage() {
  redirect("/admin?tab=decks");
}
