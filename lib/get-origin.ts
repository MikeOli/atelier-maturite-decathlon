import { headers } from "next/headers";

/**
 * Extracted from `app/admin/sessions/[id]/page.tsx` (Story 1.5) during
 * Story 3.10, which needs the same origin computation on `/board/[code]`.
 */
export async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) {
    throw new Error("Missing host header — cannot build session join URL.");
  }
  const forwardedProto = headerList.get("x-forwarded-proto");
  const protocol =
    forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
