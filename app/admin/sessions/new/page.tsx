import { redirect } from "next/navigation";

// This page's content (session form) now lives inline in the "Nouvelle
// session" tab on /admin (features/admin/components/admin-tabs.tsx) —
// keeping a second, separate rendering of the same form here would drift
// out of sync with it. Redirect rather than delete the route, since
// /admin/sessions/new may still be bookmarked or linked externally.
export default function NewSessionPage() {
  redirect("/admin?tab=new-session");
}
